import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  CreateTelemedicineConsentDto,
  UpdateTelemedicineConsentDto,
} from '../dto/telemedicine.dto';

@Injectable()
export class TelemedicineConsentService {
  private readonly logger = new Logger(TelemedicineConsentService.name);

  private ensureTenantDb(tenantDb: DataSource) {
    if (!tenantDb) {
      throw new BadRequestException('Tenant database connection unavailable');
    }
  }

  /**
   * Grant consent
   */
  async grantConsent(tenantDb: DataSource, dto: CreateTelemedicineConsentDto, userId?: string) {
    this.ensureTenantDb(tenantDb);

    // Check if consent already exists and is active
    const existing = await tenantDb.query(
      `SELECT * FROM telemedicine_consents
       WHERE patient_id = $1 
         AND consent_type = $2
         AND consent_status = 'granted'
         AND (expiry_date IS NULL OR expiry_date > NOW())`,
      [dto.patientId, dto.consentType],
    );

    if (existing.length > 0) {
      throw new BadRequestException(`Active consent of type ${dto.consentType} already exists for this patient`);
    }

    const result = await tenantDb.query(
      `INSERT INTO telemedicine_consents (
        patient_id, consent_type, consent_status, consent_date,
        expiry_date, consent_document_url, ip_address, user_agent,
        witnessed_by, notes, created_at, updated_at
      ) VALUES ($1, $2, COALESCE($3, 'granted'), NOW(), $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *`,
      [
        dto.patientId,
        dto.consentType,
        dto.consentStatus ?? 'granted',
        dto.expiryDate ?? null,
        dto.consentDocumentUrl ?? null,
        dto.ipAddress ?? null,
        dto.userAgent ?? null,
        dto.witnessedById ?? null,
        dto.notes ?? null,
      ],
    );

    return result[0];
  }

  /**
   * Check if patient has valid consent
   */
  async checkConsent(
    tenantDb: DataSource,
    patientId: string,
    consentType = 'general_telehealth',
  ): Promise<boolean> {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `SELECT id FROM telemedicine_consents
       WHERE patient_id = $1 
         AND consent_type = $2
         AND consent_status = 'granted'
         AND (expiry_date IS NULL OR expiry_date > NOW())`,
      [patientId, consentType],
    );

    return result.length > 0;
  }

  /**
   * Get consent history
   */
  async getConsentHistory(tenantDb: DataSource, patientId: string) {
    this.ensureTenantDb(tenantDb);

    const consents = await tenantDb.query(
      `SELECT c.*,
              u.first_name || ' ' || u.last_name as witnessed_by_name
       FROM telemedicine_consents c
       LEFT JOIN users u ON u.id = c.witnessed_by
       WHERE c.patient_id = $1
       ORDER BY c.consent_date DESC`,
      [patientId],
    );

    return consents;
  }

  /**
   * Revoke consent
   */
  async revokeConsent(
    tenantDb: DataSource,
    consentId: string,
    reason?: string,
  ) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `UPDATE telemedicine_consents
       SET consent_status = 'revoked',
           revoked_date = NOW(),
           notes = COALESCE(notes || E'\\n', '') || $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [reason ? `Revoked: ${reason}` : 'Revoked', consentId],
    );

    if (!result.length) {
      throw new NotFoundException(`Consent ${consentId} not found`);
    }

    return result[0];
  }

  /**
   * Validate consent for consultation
   */
  async validateConsent(
    tenantDb: DataSource,
    patientId: string,
    consultationId: string,
  ): Promise<{ valid: boolean; missingConsents?: string[] }> {
    this.ensureTenantDb(tenantDb);

    const requiredConsents = ['general_telehealth'];
    const missingConsents: string[] = [];

    for (const consentType of requiredConsents) {
      const hasConsent = await this.checkConsent(tenantDb, patientId, consentType);
      if (!hasConsent) {
        missingConsents.push(consentType);
      }
    }

    // Update consultation with consent status
    if (missingConsents.length === 0) {
      await tenantDb.query(
        `UPDATE telemedicine_consultations
         SET patient_consent = true, consent_date = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [consultationId],
      );
    }

    return {
      valid: missingConsents.length === 0,
      missingConsents: missingConsents.length > 0 ? missingConsents : undefined,
    };
  }
}
