import { ForbiddenException, Injectable, Logger, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { shouldPropagate } from '../constants/propagation-conditions';
import { PatientAccessService, Accessor } from './patient-access.service';
import { ConsentRecordsService, CONSENT_TYPES } from './consent-records.service';

// R1 interim disclosure rule (P-002/P-003): until R2/FX-012 lands
// consent-based household disclosure, diagnosis-bearing household paths are
// clinical-roles-only. R2 KEEPS this as the stage-1 role gate (now incl.
// counsellor) and adds stage 2: per-event consent + relationship +
// adolescent handling. The R1 spec pins this behavior; the new model
// subsumes it (strictly stronger), so the function and message stay.
const INTERIM_CLINICAL_ROLES = new Set(['doctor', 'nurse', 'admin', 'counsellor']);

export function assertInterimClinicalRole(callerRole: string | undefined, path: string): void {
  if (!callerRole || !INTERIM_CLINICAL_ROLES.has(callerRole)) {
    throw new ForbiddenException(
      `Household disclosure path '${path}' is restricted to clinical roles until R2 authorization lands`,
    );
  }
}

// R2 / FX-012: conditions whose household propagation ALWAYS requires
// explicit per-event consent (never automatic). Substring match, same
// convention as shouldPropagate.
export const SENSITIVE_CONDITIONS = [
  'hiv', 'aids', 'sti', 'std', 'syphilis', 'gonorrh', 'chlamydia',
  'trichomoniasis', 'herpes', 'hpv', 'tuberculosis', 'tb',
  'hepatitis b', 'hepatitis c',
];

export type DisclosureCategory = 'infectious_exposure' | 'genetic_risk' | 'sensitive';

export function categorizeDisclosure(conditionName: string): DisclosureCategory | null {
  const lower = conditionName.toLowerCase();
  if (SENSITIVE_CONDITIONS.some((c) => lower.includes(c))) return 'sensitive';
  const { type } = shouldPropagate(conditionName);
  return type;
}

// Adolescent/minor boundary for disclosure gating (WHO adolescent 10–19;
// assent logic keys off legal minority < 18).
export const MINOR_AGE = 18;

export function ageFromDob(dob: string | Date | null | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export type PropagationResult = { alertsCreated: number; blockedReason?: string };

/** R2 / FX-011+FX-012 disclosure model. Caller is a role string (legacy
 * role-only path, kept for the pinned R1 behavior) or an Accessor (full
 * model: role gate + relationship + consent + age). HTTP handlers MUST pass
 * an Accessor; the string path exists only for pre-R2 in-process callers. */
function roleOf(caller: string | Accessor | undefined | null): string | undefined {
  if (caller === undefined || caller === null) return undefined;
  return typeof caller === 'string' ? caller : caller.role;
}

@Injectable()
export class HouseholdRiskService {
  private readonly logger = new Logger(HouseholdRiskService.name);

  constructor(
    @Optional() private readonly patientAccess?: PatientAccessService,
    @Optional() private readonly consentRecords?: ConsentRecordsService,
  ) {}

  private requireAccess(): PatientAccessService {
    if (!this.patientAccess) {
      throw new ForbiddenException('Authorization layer unavailable — denying access');
    }
    return this.patientAccess;
  }

  private async requireClinicalAccessor(
    db: any,
    patientId: string,
    caller: string | Accessor,
    path: string,
  ): Promise<Accessor | null> {
    // Stage 1 (pinned R1 behavior): role gate, zero queries for outsiders.
    assertInterimClinicalRole(roleOf(caller), path);
    if (typeof caller === 'string') return null; // legacy role-only path
    const acc = caller as Accessor;
    // Stage 1b (R2): adolescent rule precedes the relationship check so a
    // non-clinical role can never reach a minor's disclosure data by any
    // path. One DOB read runs here; content stays gated below.
    if (await this.isMinorPatient(db, patientId) && !['counsellor', 'doctor', 'nurse'].includes(acc.role)) {
      throw new ForbiddenException(
        'Adolescent/minor disclosure data is restricted to clinical roles (counsellor/doctor/nurse)',
      );
    }
    // Stage 2 (R2): relationship via the single authorization layer.
    await this.requireAccess().assertCanAccess(db, acc, patientId, 'disclosure-read');
    return acc;
  }

  private async isMinorPatient(db: any, patientId: string): Promise<boolean> {
    const [row] = await db.query(`SELECT date_of_birth FROM patients WHERE id = $1`, [patientId]);
    const age = ageFromDob(row?.date_of_birth);
    return age !== null && age < MINOR_AGE;
  }

  private async requireMinorAssent(db: any, patientId: string): Promise<void> {
    if (!this.consentRecords) {
      throw new ForbiddenException('Consent service unavailable — denying minor disclosure');
    }
    const ok = await this.consentRecords.hasActiveConsent(patientId, CONSENT_TYPES.MINOR_ASSENT, db);
    if (!ok) {
      throw new ForbiddenException(
        'Adolescent/minor disclosure requires an active minor-assent consent record',
      );
    }
  }

  async linkPatients(
    db: DataSource,
    patientAId: string,
    patientBId: string,
    relationship: string,
    doNotNotify = false,
  ): Promise<void> {
    for (const [a, b] of [[patientAId, patientBId], [patientBId, patientAId]]) {
      await db.query(
        `INSERT INTO patient_family_links (patient_a_id, patient_b_id, relationship, do_not_notify)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (patient_a_id, patient_b_id)
         DO UPDATE SET relationship = EXCLUDED.relationship, do_not_notify = EXCLUDED.do_not_notify`,
        [a, b, relationship, doNotNotify],
      );
    }
  }

  async assignHousehold(db: DataSource, patientId: string, householdId: string): Promise<void> {
    await db.query(
      `UPDATE patients SET household_id = $1 WHERE id = $2`,
      [householdId, patientId],
    );
  }

  async createHousehold(
    db: DataSource,
    address: { line1?: string; line2?: string; suburb?: string; city?: string },
  ): Promise<string> {
    const [row] = await db.query(
      `INSERT INTO household_groups (address_line1, address_line2, suburb, city)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [address.line1 ?? null, address.line2 ?? null, address.suburb ?? null, address.city ?? null],
    );
    return row.id;
  }

  async requestDisclosureConsent(
    db: any,
    params: {
      sourcePatientId: string;
      targetHouseholdId?: string | null;
      targetPatientId?: string | null;
      conditionCategory: string;
      collectedBy: string;
      expiresAt?: string | null;
    },
  ): Promise<{ id: string }> {
    const [row] = await db.query(
      `INSERT INTO household_disclosure_consents
         (source_patient_id, target_household_id, target_patient_id, condition_category, collected_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        params.sourcePatientId,
        params.targetHouseholdId ?? null,
        params.targetPatientId ?? null,
        params.conditionCategory,
        params.collectedBy,
        params.expiresAt ?? null,
      ],
    );
    return { id: row.id };
  }

  async revokeDisclosureConsent(db: any, consentId: string, reason: string): Promise<void> {
    await db.query(
      `UPDATE household_disclosure_consents
       SET status = 'revoked', withdrawn_at = NOW(), withdrawn_reason = $2
       WHERE id = $1`,
      [consentId, reason],
    );
  }

  private async hasDisclosureConsent(
    db: any,
    sourcePatientId: string,
    householdId: string,
    category: string,
  ): Promise<boolean> {
    const rows = await db.query(
      `SELECT 1 FROM household_disclosure_consents
       WHERE source_patient_id = $1 AND target_household_id = $2 AND condition_category = $3
         AND status = 'active' AND withdrawn_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [sourcePatientId, householdId, category],
    );
    return rows.length > 0;
  }

  async propagateDiagnosis(
    db: DataSource,
    patientId: string,
    conditionName: string,
    caller: string | Accessor,
  ): Promise<PropagationResult> {
    // Stage 1: role gate, zero queries for outsiders (pinned R1 behavior).
    assertInterimClinicalRole(roleOf(caller), 'propagateDiagnosis');
    if (typeof caller === 'string') {
      return this.propagateLegacy(db, patientId, conditionName);
    }
    // Stage 2: consent-gated disclosure — no automatic propagation of
    // anything; every family/household disclosure needs per-event consent.
    const category = categorizeDisclosure(conditionName);
    if (!category) return { alertsCreated: 0 };

    const [patient] = await db.query(`SELECT household_id FROM patients WHERE id = $1`, [patientId]);
    if (!patient?.household_id) return { alertsCreated: 0, blockedReason: 'no-household' };

    // Safeguard flag wins over everything (abuser-linked-as-household).
    const unsafe = await db.query(
      `SELECT 1 FROM patient_family_links pfl
       JOIN patients p ON p.id = pfl.patient_b_id
       WHERE pfl.patient_a_id = $1 AND pfl.do_not_notify AND p.household_id = $2
       LIMIT 1`,
      [patientId, patient.household_id],
    );
    if (unsafe.length > 0) {
      return { alertsCreated: 0, blockedReason: 'safeguard do-not-notify link — disclosure unsafe' };
    }

    const consented = await this.hasDisclosureConsent(db, patientId, patient.household_id, category);
    if (!consented) {
      return { alertsCreated: 0, blockedReason: 'no active per-event disclosure consent' };
    }

    // Minor source: assent required on top of the disclosure consent.
    const [src] = await db.query(`SELECT date_of_birth FROM patients WHERE id = $1`, [patientId]);
    const age = ageFromDob(src?.date_of_birth);
    if (age !== null && age < MINOR_AGE) await this.requireMinorAssent(db, patientId);

    return this.insertAlert(db, patient.household_id, patientId, conditionName, category);
  }

  private async propagateLegacy(
    db: DataSource,
    patientId: string,
    conditionName: string,
  ): Promise<PropagationResult> {
    const { type, severity } = shouldPropagate(conditionName);
    if (!type) return { alertsCreated: 0 };
    const [patient] = await db.query(`SELECT household_id FROM patients WHERE id = $1`, [patientId]);
    if (!patient?.household_id) return { alertsCreated: 0 };
    await this.insertAlert(db, patient.household_id, patientId, conditionName, type);
    return { alertsCreated: 1 };
  }

  private async insertAlert(
    db: any,
    householdId: string,
    patientId: string,
    conditionName: string,
    type: DisclosureCategory | 'infectious_exposure' | 'genetic_risk',
  ): Promise<PropagationResult> {
    const message =
      type === 'genetic_risk'
        ? `Family member diagnosed with ${conditionName}. Genetic risk assessment recommended.`
        : `Household contact of patient diagnosed with ${conditionName}. Screening recommended.`;
    await db.query(
      `INSERT INTO household_alerts
         (household_id, source_patient_id, alert_type, condition_name, message, severity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [householdId, patientId, type, conditionName, message, type === 'sensitive' ? 'urgent' : 'advisory'],
    );
    this.logger.log(`Propagated ${conditionName} (${type}) from patient=${patientId}`);
    return { alertsCreated: 1 };
  }

  async getFamilyPanel(db: DataSource, patientId: string, caller: string | Accessor): Promise<any[]> {
    // Minor rule lives in requireClinicalAccessor (stage 1b); by here the
    // caller is clinical-or-legacy and relationship-checked.
    await this.requireClinicalAccessor(db, patientId, caller, 'getFamilyPanel');
    return db.query(
      `SELECT pfl.relationship,
         p.id, p.first_name, p.last_name,
         p.latest_risk_level,
         (SELECT d.description FROM diagnoses d
          WHERE d.patient_id = p.id
          ORDER BY d.created_at DESC LIMIT 1) AS latest_diagnosis
       FROM patient_family_links pfl
       JOIN patients p ON p.id = pfl.patient_b_id
       WHERE pfl.patient_a_id = $1`,
      [patientId],
    );
  }

  async getHouseholdAlerts(db: DataSource, patientId: string, caller: string | Accessor): Promise<any[]> {
    await this.requireClinicalAccessor(db, patientId, caller, 'getHouseholdAlerts');
    return db.query(
      `SELECT ha.*
       FROM household_alerts ha
       JOIN patients p ON p.household_id = ha.household_id
       WHERE p.id = $1 AND ha.resolved_at IS NULL
       ORDER BY ha.created_at DESC`,
      [patientId],
    );
  }

  async resolveAlert(db: DataSource, alertId: string, caller: string | Accessor): Promise<void> {
    assertInterimClinicalRole(roleOf(caller), 'resolveAlert');
    if (typeof caller !== 'string') {
      const [alert] = await db.query(
        `SELECT source_patient_id FROM household_alerts WHERE id = $1`,
        [alertId],
      );
      if (alert?.source_patient_id) {
        await this.requireAccess().assertCanAccess(db, caller, alert.source_patient_id, 'disclosure-write');
      }
    }
    await db.query(`UPDATE household_alerts SET resolved_at = now() WHERE id = $1`, [alertId]);
  }
}
