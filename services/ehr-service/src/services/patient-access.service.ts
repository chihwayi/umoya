import { ForbiddenException, Injectable, Logger } from '@nestjs/common';

// R2 / FX-011 (S-001, I-017): the SINGLE patient authorization layer.
// Every patient-returning entry point (REST, FHIR, census, exports,
// websockets, disclosure reads) must go through canAccessPatient /
// assertCanAccess / filterAccessiblePatientIds. Default deny: a caller
// with a valid token but no established relationship is rejected.
//
// Relationship = active patient_care_team row OR a non-cancelled
// appointment linking doctor_id = caller (treating relationship) OR an
// unexpired break-glass grant. Facility-admin bypass applies only when
// BOTH user.facility_id and patient.facility_id are set and equal, and
// NEVER for vip_flag / restricted-tier patients (those need a
// relationship or break-glass, and every granted access is audit-logged).
//
// Fail closed: any error inside the checks denies. Existence is not
// distinguished from denial at the HTTP layer (both surface as 403 via
// assertCanAccess) so IDs cannot be enumerated by status code.

export interface Accessor {
  userId: string;
  role: string;
  facilityId?: string | null;
}

export type AccessDecision =
  | { allowed: true; via: 'care-team' | 'treating-relationship' | 'facility-admin' | 'break-glass' }
  | { allowed: false; reason: string };

const RESTRICTED_TIERS = new Set(['restricted', 'confidential']);
const BREAK_GLASS_MIN_MINUTES = 1;
const BREAK_GLASS_MAX_MINUTES = 480; // 8h shift

@Injectable()
export class PatientAccessService {
  private readonly logger = new Logger(PatientAccessService.name);

  async canAccessPatient(
    db: any,
    accessor: Accessor,
    patientId: string,
    purpose: string,
  ): Promise<AccessDecision> {
    try {
      const [patient] = await db.query(
        `SELECT id, is_active, facility_id, vip_flag, confidentiality_tier
         FROM patients WHERE id = $1`,
        [patientId],
      );
      if (!patient || patient.is_active === false) {
        return { allowed: false, reason: 'no-relationship' };
      }
      const [user] = await db.query(`SELECT id, role, facility_id FROM users WHERE id = $1`, [
        accessor.userId,
      ]);
      if (!user) return { allowed: false, reason: 'unknown-caller' };

      const sensitive =
        patient.vip_flag === true || RESTRICTED_TIERS.has(patient.confidentiality_tier);

      // 1. Break-glass: unexpired grant for (user, patient).
      const [grant] = await db.query(
        `SELECT id FROM break_glass_access_log
         WHERE user_id = $1 AND patient_id = $2 AND action = 'grant'
           AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY created_at DESC LIMIT 1`,
        [accessor.userId, patientId],
      );
      if (grant) {
        try {
          await db.query(
            `INSERT INTO break_glass_access_log (user_id, patient_id, reason, action)
             VALUES ($1, $2, $3, 'use')`,
            [accessor.userId, patientId, `use under grant ${grant.id} for ${purpose}`],
          );
        } catch (e: any) {
          // The access itself was legitimately granted; a logging failure must
          // not block care (audit dead-letter is R8/FX-021). Still loud.
          this.logger.error(`break-glass use-log failed: ${e?.message}`);
        }
        return { allowed: true, via: 'break-glass' };
      }

      // 2. Care-team assignment.
      const [team] = await db.query(
        `SELECT 1 FROM patient_care_team
         WHERE patient_id = $1 AND user_id = $2 AND active`,
        [patientId, accessor.userId],
      );
      if (team) {
        if (sensitive) await this.auditSensitive(db, accessor, patientId, purpose, user);
        return { allowed: true, via: 'care-team' };
      }

      // 3. Treating relationship: a non-cancelled appointment as the doctor.
      const [appt] = await db.query(
        `SELECT 1 FROM appointments
         WHERE patient_id = $1 AND doctor_id = $2 AND status <> 'cancelled' LIMIT 1`,
        [patientId, accessor.userId],
      );
      if (appt) {
        if (sensitive) await this.auditSensitive(db, accessor, patientId, purpose, user);
        return { allowed: true, via: 'treating-relationship' };
      }

      // 4. Facility-admin bypass — never for sensitive patients, never on
      // NULL facility data (NULL = legacy/unknown, not a match).
      const dbRole = String(user.role ?? '');
      const userFac = user.facility_id ?? null;
      const patFac = patient.facility_id ?? null;
      if (
        !sensitive &&
        dbRole === 'admin' &&
        userFac !== null &&
        patFac !== null &&
        String(userFac) === String(patFac)
      ) {
        return { allowed: true, via: 'facility-admin' };
      }

      return { allowed: false, reason: 'no-relationship' };
    } catch (e: any) {
      this.logger.error(`access check failed closed: ${e?.message}`);
      return { allowed: false, reason: 'check-error' };
    }
  }

  async assertCanAccess(db: any, accessor: Accessor, patientId: string, purpose: string): Promise<void> {
    const d = await this.canAccessPatient(db, accessor, patientId, purpose);
    if (!d.allowed) {
      throw new ForbiddenException('Access denied: no established relationship to this patient');
    }
  }

  async filterAccessiblePatientIds(db: any, accessor: Accessor, patientIds: string[]): Promise<string[]> {
    const out: string[] = [];
    for (const id of patientIds) {
      const d = await this.canAccessPatient(db, accessor, id, 'census');
      if (d.allowed) out.push(id);
    }
    return out;
  }

  async grantBreakGlass(
    db: any,
    params: { userId: string; patientId: string; reason: string; minutes: number },
  ): Promise<{ id: string; expiresAt: string }> {
    const reason = String(params.reason ?? '').trim();
    if (!reason) throw new ForbiddenException('Break-glass requires an explicit reason');
    const minutes = Number(params.minutes);
    if (!Number.isFinite(minutes) || minutes < BREAK_GLASS_MIN_MINUTES || minutes > BREAK_GLASS_MAX_MINUTES) {
      throw new ForbiddenException(
        `Break-glass duration must be ${BREAK_GLASS_MIN_MINUTES}-${BREAK_GLASS_MAX_MINUTES} minutes`,
      );
    }
    const [row] = await db.query(
      `INSERT INTO break_glass_access_log (user_id, patient_id, reason, action, expires_at)
       VALUES ($1, $2, $3, 'grant', NOW() + ($4 || ' minutes')::INTERVAL)
       RETURNING id, expires_at`,
      [params.userId, params.patientId, reason, String(Math.floor(minutes))],
    );
    return { id: row.id, expiresAt: row.expires_at };
  }

  private async auditSensitive(db: any, accessor: Accessor, patientId: string, purpose: string, user: any): Promise<void> {
    try {
      await db.query(
        `INSERT INTO hipaa_audit_logs (user_id, user_role, action, resource_type, resource_id, patient_id, outcome, reason, risk_level, event_type, operation, data_classification)
         VALUES ($1, $2, 'sensitive-patient-access', 'patient', $3, $3, 'allowed', $4, 'high', 'access', 'read', 'restricted')`,
        [accessor.userId, String(user.role ?? accessor.role), patientId, `vip/restricted access for ${purpose}`],
      );
    } catch (e: any) {
      this.logger.error(`sensitive-access audit failed: ${e?.message}`);
    }
  }
}
