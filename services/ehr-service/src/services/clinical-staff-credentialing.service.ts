import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';

// S275 — Clinical Staff Credentialing & Privileging. Tracks medical staff license
// expiry, malpractice/indemnity cover, CPD/CME compliance, and facility-granted
// scope-of-practice privileges. See docs/SOUTHERN-AFRICA-HOSPITAL-READINESS-ROADMAP.md.

const EXPIRY_WINDOWS_DAYS = [30, 60, 90];

@Injectable()
export class ClinicalStaffCredentialingService {
  async createCredential(db: any, tenantId: string, body: any): Promise<any> {
    const existing = await db.query(
      `SELECT id FROM clinical_staff_credentials WHERE tenant_id = $1 AND user_id = $2`,
      [tenantId, body.userId],
    );
    if (existing[0]) throw new ConflictException('Credential record already exists for this staff member');

    const rows = await db.query(
      `INSERT INTO clinical_staff_credentials
         (tenant_id, user_id, license_number, license_body, license_expiry_date,
          malpractice_provider, malpractice_policy_number, malpractice_expiry_date,
          cpd_points_current_cycle, cpd_points_required, cpd_cycle_end_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        tenantId,
        body.userId,
        body.licenseNumber,
        body.licenseBody ?? null,
        body.licenseExpiryDate,
        body.malpracticeProvider ?? null,
        body.malpracticePolicyNumber ?? null,
        body.malpracticeExpiryDate ?? null,
        body.cpdPointsCurrentCycle ?? 0,
        body.cpdPointsRequired ?? 0,
        body.cpdCycleEndDate ?? null,
        body.notes ?? null,
      ],
    );
    return rows[0];
  }

  async updateCredential(db: any, tenantId: string, credentialId: string, body: any): Promise<any> {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;

    const settable: Record<string, string> = {
      licenseNumber: 'license_number',
      licenseBody: 'license_body',
      licenseExpiryDate: 'license_expiry_date',
      malpracticeProvider: 'malpractice_provider',
      malpracticePolicyNumber: 'malpractice_policy_number',
      malpracticeExpiryDate: 'malpractice_expiry_date',
      cpdPointsCurrentCycle: 'cpd_points_current_cycle',
      cpdPointsRequired: 'cpd_points_required',
      cpdCycleEndDate: 'cpd_cycle_end_date',
      status: 'status',
      notes: 'notes',
    };
    for (const [key, column] of Object.entries(settable)) {
      if (body[key] !== undefined) { fields.push(`${column} = $${idx++}`); params.push(body[key]); }
    }
    fields.push(`updated_at = now()`);

    params.push(credentialId, tenantId);
    const rows = await db.query(
      `UPDATE clinical_staff_credentials SET ${fields.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`,
      params,
    );
    if (!rows[0]) throw new NotFoundException('Credential record not found');
    return rows[0];
  }

  async listCredentials(db: any, tenantId: string, filters: any = {}): Promise<any> {
    const conditions: string[] = ['csc.tenant_id = $1'];
    const params: any[] = [tenantId];
    let idx = 2;

    if (filters.status) { conditions.push(`csc.status = $${idx++}`); params.push(filters.status); }

    const rows = await db.query(
      `SELECT csc.*, u.first_name, u.last_name, u.role
       FROM clinical_staff_credentials csc
       JOIN users u ON u.id = csc.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY csc.license_expiry_date ASC`,
      params,
    );
    return rows;
  }

  async getCredential(db: any, tenantId: string, credentialId: string): Promise<any> {
    const [credential] = await db.query(
      `SELECT csc.*, u.first_name, u.last_name, u.role
       FROM clinical_staff_credentials csc
       JOIN users u ON u.id = csc.user_id
       WHERE csc.id = $1 AND csc.tenant_id = $2`,
      [credentialId, tenantId],
    );
    if (!credential) throw new NotFoundException('Credential record not found');

    const privileges = await db.query(
      `SELECT * FROM clinical_staff_privileges WHERE credential_id = $1 ORDER BY granted_at DESC`,
      [credentialId],
    );
    return { ...credential, privileges };
  }

  async grantPrivilege(db: any, tenantId: string, credentialId: string, grantedBy: string, body: any): Promise<any> {
    const [credential] = await db.query(
      `SELECT id FROM clinical_staff_credentials WHERE id = $1 AND tenant_id = $2`,
      [credentialId, tenantId],
    );
    if (!credential) throw new NotFoundException('Credential record not found');

    const rows = await db.query(
      `INSERT INTO clinical_staff_privileges
         (credential_id, tenant_id, procedure_or_scope, granted_by, expiry_date)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [credentialId, tenantId, body.procedureOrScope, grantedBy, body.expiryDate ?? null],
    );
    return rows[0];
  }

  async revokePrivilege(db: any, tenantId: string, privilegeId: string, revokedBy: string, reason?: string): Promise<any> {
    const rows = await db.query(
      `UPDATE clinical_staff_privileges
       SET status = 'revoked', revoked_at = now(), revoked_by = $3, revoked_reason = $4, updated_at = now()
       WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [privilegeId, tenantId, revokedBy, reason ?? null],
    );
    if (!rows[0]) throw new NotFoundException('Privilege not found');
    return rows[0];
  }

  /** Checks whether a clinician holds an active, non-expired privilege for the given procedure/scope. */
  async checkPrivilege(db: any, tenantId: string, userId: string, procedureOrScope: string): Promise<{ privileged: boolean; reason?: string }> {
    const rows = await db.query(
      `SELECT csp.* FROM clinical_staff_privileges csp
       JOIN clinical_staff_credentials csc ON csc.id = csp.credential_id
       WHERE csc.tenant_id = $1 AND csc.user_id = $2 AND csp.procedure_or_scope = $3
         AND csp.status = 'active' AND (csp.expiry_date IS NULL OR csp.expiry_date >= CURRENT_DATE)`,
      [tenantId, userId, procedureOrScope],
    );
    if (rows[0]) return { privileged: true };
    return { privileged: false, reason: `No active privilege granted for "${procedureOrScope}"` };
  }

  /** Staff whose license, malpractice cover, or CPD cycle expires within 30/60/90 days, or has already lapsed. */
  async getExpiryAlerts(db: any, tenantId: string): Promise<any> {
    const rows = await db.query(
      `SELECT csc.id, csc.user_id, u.first_name, u.last_name, u.role,
              csc.license_expiry_date, csc.malpractice_expiry_date, csc.cpd_cycle_end_date,
              csc.cpd_points_current_cycle, csc.cpd_points_required
       FROM clinical_staff_credentials csc
       JOIN users u ON u.id = csc.user_id
       WHERE csc.tenant_id = $1
         AND (
           csc.license_expiry_date <= CURRENT_DATE + INTERVAL '90 days'
           OR csc.malpractice_expiry_date <= CURRENT_DATE + INTERVAL '90 days'
           OR csc.cpd_cycle_end_date <= CURRENT_DATE + INTERVAL '90 days'
         )
       ORDER BY csc.license_expiry_date ASC`,
      [tenantId],
    );

    const today = new Date();
    const daysUntil = (dateStr: string | null) => {
      if (!dateStr) return null;
      return Math.ceil((new Date(dateStr).getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    };
    const bucket = (days: number | null): string | null => {
      if (days === null) return null;
      if (days < 0) return 'lapsed';
      for (const window of EXPIRY_WINDOWS_DAYS) {
        if (days <= window) return `within_${window}_days`;
      }
      return null;
    };

    return rows.map((r: any) => {
      const licenseDays = daysUntil(r.license_expiry_date);
      const malpracticeDays = daysUntil(r.malpractice_expiry_date);
      const cpdDays = daysUntil(r.cpd_cycle_end_date);
      const cpdShortfall = Number(r.cpd_points_required) > Number(r.cpd_points_current_cycle);
      return {
        credentialId: r.id,
        userId: r.user_id,
        name: `${r.first_name} ${r.last_name}`,
        role: r.role,
        license: { expiryDate: r.license_expiry_date, daysRemaining: licenseDays, alertBucket: bucket(licenseDays) },
        malpractice: { expiryDate: r.malpractice_expiry_date, daysRemaining: malpracticeDays, alertBucket: bucket(malpracticeDays) },
        cpd: {
          cycleEndDate: r.cpd_cycle_end_date, daysRemaining: cpdDays, alertBucket: bucket(cpdDays),
          pointsCurrent: Number(r.cpd_points_current_cycle), pointsRequired: Number(r.cpd_points_required), shortfall: cpdShortfall,
        },
      };
    });
  }
}
