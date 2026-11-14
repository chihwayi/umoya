import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash, randomInt } from 'crypto';
import { DataSource } from 'typeorm';
import { ClinicianNetworkMasterDbService } from './clinician-network-master-db.service';

// S285 — Clinician Network identity resolution. A doctor's cross-tenant network
// identity is anchored on their real-world council registration
// (clinical_staff_credentials.license_body + license_number, captured per tenant by
// S275 credentialing). The master-DB clinicians row is keyed by
// sha256(license_body | license_number) — never the raw number — so a locum working
// at two clinics still maps to exactly one network identity. The real-identity link
// (tenant user_id <-> master clinician_id) is stored ONLY in the originating
// tenant's own clinician_network_identity_links table — see
// docs/CLINICIAN-NETWORK-ARCHITECTURE.md.

export interface ClinicianIdentity {
  clinicianId: string;
  isNew: boolean;
}

interface CredentialRow {
  license_number: string | null;
  license_body: string | null;
}

// Specialty-agnostic handle parts — never derived from the clinician's real name.
const HANDLE_ADJECTIVES = [
  'Calm',
  'Bright',
  'Steady',
  'Keen',
  'Wise',
  'Bold',
  'Kind',
  'Sharp',
  'Noble',
  'Quick',
];

const MAX_HANDLE_ATTEMPTS = 5;

@Injectable()
export class ClinicianIdentityService {
  private readonly logger = new Logger(ClinicianIdentityService.name);

  constructor(private readonly masterDbService: ClinicianNetworkMasterDbService) {}

  private normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  private hashLicense(licenseBody: string, licenseNumber: string): string {
    return createHash('sha256')
      .update(`${this.normalize(licenseBody)}|${this.normalize(licenseNumber)}`, 'utf8')
      .digest('hex');
  }

  private isDisplayHandleConflict(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    const pgError = error as { code?: string; constraint?: string; detail?: string };
    if (pgError.code !== '23505') {
      return false;
    }
    const where = `${pgError.constraint ?? ''} ${pgError.detail ?? ''}`;
    return where.includes('display_handle');
  }

  private generateDisplayHandle(): string {
    const adjective = HANDLE_ADJECTIVES[randomInt(HANDLE_ADJECTIVES.length)];
    const digits = String(randomInt(100, 1000));
    return `${adjective}Doctor${digits}`;
  }

  /**
   * S287 — non-creating lookup for read endpoints. Returns the linked
   * clinician_id, or null when this user has never joined (no throw, no
   * side effects — unlike resolveOrCreate, which requires credentials).
   */
  async findClinicianIdForUser(tenantDb: DataSource, userId: string): Promise<string | null> {
    const linkRows = await tenantDb.query(
      `SELECT clinician_id FROM clinician_network_identity_links WHERE user_id = $1`,
      [userId],
    );
    if (linkRows && linkRows.length > 0) {
      return String(linkRows[0].clinician_id);
    }
    return null;
  }

  async resolveOrCreateClinicianIdentity(
    tenantDb: DataSource,
    userId: string,
  ): Promise<ClinicianIdentity> {
    const linkRows = await tenantDb.query(
      `SELECT clinician_id FROM clinician_network_identity_links WHERE user_id = $1`,
      [userId],
    );
    if (linkRows && linkRows.length > 0) {
      return { clinicianId: String(linkRows[0].clinician_id), isNew: false };
    }

    const credentialRows: CredentialRow[] = await tenantDb.query(
      `SELECT license_number, license_body FROM clinical_staff_credentials WHERE user_id = $1 LIMIT 1`,
      [userId],
    );
    const credential = credentialRows && credentialRows.length > 0 ? credentialRows[0] : null;
    if (
      !credential ||
      !credential.license_number ||
      !String(credential.license_number).trim() ||
      !credential.license_body ||
      !String(credential.license_body).trim()
    ) {
      throw new BadRequestException(
        'No clinical staff credential (license body + license number) found for this user. ' +
          'Add license info first before joining the Clinician Network.',
      );
    }

    const licenseBody = this.normalize(String(credential.license_body));
    const licenseNumberHash = this.hashLicense(
      String(credential.license_body),
      String(credential.license_number),
    );

    // Reuse the existing network identity if this doctor already joined from any
    // (other) tenant — e.g. a locum working at two clinics maps to one identity.
    const existing = await this.masterDbService.query(
      `SELECT id FROM clinician_network.clinicians
        WHERE license_body = $1 AND license_number_hash = $2`,
      [licenseBody, licenseNumberHash],
    );
    let clinicianId: string | null =
      existing && existing.length > 0 ? String(existing[0].id) : null;
    let isNew = false;

    if (!clinicianId) {
      for (let attempt = 1; attempt <= MAX_HANDLE_ATTEMPTS; attempt += 1) {
        const handle = this.generateDisplayHandle();
        let inserted: Array<{ id: string }>;
        try {
          inserted = await this.masterDbService.query(
            `INSERT INTO clinician_network.clinicians (license_body, license_number_hash, display_handle)
             VALUES ($1, $2, $3)
             ON CONFLICT (license_body, license_number_hash) DO NOTHING
             RETURNING id`,
            [licenseBody, licenseNumberHash, handle],
          );
        } catch (error) {
          // display_handle UNIQUE collision — retry with a fresh random suffix.
          if (this.isDisplayHandleConflict(error)) {
            this.logger.warn(
              `Clinician Network display_handle collision on attempt ${attempt}, retrying`,
            );
            continue;
          }
          throw error;
        }
        if (inserted && inserted.length > 0) {
          clinicianId = String(inserted[0].id);
          isNew = true;
          break;
        }
        // ON CONFLICT DO NOTHING fired — another tenant created this identity
        // concurrently. Re-read instead of inserting a duplicate.
        const raced = await this.masterDbService.query(
          `SELECT id FROM clinician_network.clinicians
            WHERE license_body = $1 AND license_number_hash = $2`,
          [licenseBody, licenseNumberHash],
        );
        if (raced && raced.length > 0) {
          clinicianId = String(raced[0].id);
          break;
        }
      }
    }

    if (!clinicianId) {
      throw new BadRequestException(
        'Could not create a Clinician Network identity for this user. Please try again.',
      );
    }

    await tenantDb.query(
      `INSERT INTO clinician_network_identity_links (user_id, clinician_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, clinicianId],
    );

    return { clinicianId, isNew };
  }
}
