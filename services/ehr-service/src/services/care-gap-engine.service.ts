import { Injectable, Logger } from '@nestjs/common';

interface CareGap {
  gapType: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  recommendedAction: string;
  guidelineReference?: string;
}

@Injectable()
export class CareGapEngineService {
  private readonly logger = new Logger(CareGapEngineService.name);

  async detectGaps(patientId: string, db: any): Promise<CareGap[]> {
    const gaps: CareGap[] = [];

    const [patient, diagnoses, labs, vaccinations, encounters] = await Promise.all([
      db.query(`SELECT date_of_birth, sex FROM patients WHERE id = $1`, [patientId]),
      db.query(
        `SELECT icd10_code, description, status FROM patient_diagnoses WHERE patient_id = $1`,
        [patientId],
      ),
      db.query(
        `SELECT test_name, resulted_at FROM lab_results
         WHERE patient_id = $1 AND status = 'resulted' ORDER BY resulted_at DESC`,
        [patientId],
      ),
      db.query(
        `SELECT vaccine_name, administered_at FROM vaccinations WHERE patient_id = $1`,
        [patientId],
      ),
      db.query(
        `SELECT status, created_at FROM encounters
         WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [patientId],
      ),
    ]);

    const pt = patient[0] ?? {};
    const age = pt.date_of_birth
      ? Math.floor(
          (Date.now() - new Date(pt.date_of_birth).getTime()) /
            (365.25 * 24 * 3600 * 1000),
        )
      : 0;
    const sex = pt.sex?.toUpperCase() ?? '';

    // Cervical cancer screening (women 25–65, no pap smear in last 3 years)
    if (sex === 'F' && age >= 25 && age <= 65) {
      const pap = labs.find((l: any) => /pap smear|cervical/i.test(l.test_name));
      const daysSincePap = pap
        ? (Date.now() - new Date(pap.resulted_at).getTime()) / (1000 * 3600 * 24)
        : Infinity;
      if (daysSincePap > 1095) {
        gaps.push({
          gapType: 'cervical_screening',
          description: 'Cervical cancer screening overdue (>3 years)',
          priority: 'high',
          recommendedAction: 'Order Pap smear or HPV DNA test',
          guidelineReference: 'WHO Cervical Cancer Screening Guidelines 2021',
        });
      }
    }

    // Diabetes monitoring: HbA1c every 3 months for diabetics
    const hasDiabetes = diagnoses.some((d: any) => /^E1[01]/.test(d.icd10_code ?? ''));
    if (hasDiabetes) {
      const hba1c = labs.find((l: any) =>
        /hba1c|glycated|glycosylated/i.test(l.test_name),
      );
      const daysSince = hba1c
        ? (Date.now() - new Date(hba1c.resulted_at).getTime()) / (1000 * 3600 * 24)
        : Infinity;
      if (daysSince > 90) {
        gaps.push({
          gapType: 'diabetes_hba1c',
          description: 'HbA1c not checked in last 90 days — required for diabetes management',
          priority: 'high',
          recommendedAction: 'Order HbA1c blood test',
          guidelineReference: 'ADA Standards of Diabetes Care 2024',
        });
      }
    }

    // HIV testing (adults 15–65, no HIV test in last 12 months)
    if (age >= 15 && age <= 65) {
      const hivTest = labs.find((l: any) => /hiv|rapid test/i.test(l.test_name));
      const daysSince = hivTest
        ? (Date.now() - new Date(hivTest.resulted_at).getTime()) / (1000 * 3600 * 24)
        : Infinity;
      if (daysSince > 365) {
        gaps.push({
          gapType: 'hiv_screening',
          description: 'Annual HIV screening overdue',
          priority: 'medium',
          recommendedAction: 'Order HIV rapid test',
          guidelineReference: 'UNAIDS/WHO Testing Guidelines 2020',
        });
      }
    }

    // Flu vaccination (annual)
    const fluVax = vaccinations.find((v: any) =>
      /influenza|flu/i.test(v.vaccine_name),
    );
    const daysSinceFlu = fluVax
      ? (Date.now() - new Date(fluVax.administered_at).getTime()) / (1000 * 3600 * 24)
      : Infinity;
    if (daysSinceFlu > 365) {
      gaps.push({
        gapType: 'flu_vaccination',
        description: 'Annual influenza vaccination overdue',
        priority: 'low',
        recommendedAction: 'Schedule influenza vaccination',
        guidelineReference: 'WHO Influenza Vaccination Policy',
      });
    }

    // Lapsed follow-up (>90 days since last encounter)
    const lastEncounter = encounters[0];
    if (lastEncounter) {
      const days =
        (Date.now() - new Date(lastEncounter.created_at).getTime()) / (1000 * 3600 * 24);
      if (days > 90) {
        gaps.push({
          gapType: 'lapsed_followup',
          description: `No clinical contact in ${Math.round(days)} days`,
          priority: days > 180 ? 'high' : 'medium',
          recommendedAction: 'Schedule follow-up appointment',
          guidelineReference: 'Internal care continuity standard',
        });
      }
    }

    return gaps;
  }

  async upsertGaps(patientId: string, gaps: CareGap[], db: any): Promise<void> {
    for (const gap of gaps) {
      await db.query(
        `INSERT INTO care_gaps
           (patient_id, gap_type, description, priority, recommended_action, guideline_reference)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (patient_id, gap_type) DO UPDATE SET
           description = EXCLUDED.description,
           priority = EXCLUDED.priority,
           recommended_action = EXCLUDED.recommended_action,
           detected_at = now()
         WHERE care_gaps.status = 'open'`,
        [
          patientId,
          gap.gapType,
          gap.description,
          gap.priority,
          gap.recommendedAction,
          gap.guidelineReference ?? null,
        ],
      );
    }
  }

  async getOpenGaps(patientId: string, db: any): Promise<unknown[]> {
    return db.query(
      `SELECT * FROM care_gaps
       WHERE patient_id = $1
         AND status = 'open'
         AND (dismissed_until IS NULL OR dismissed_until < now())
       ORDER BY
         CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END`,
      [patientId],
    );
  }

  async dismissGap(gapId: string, dismissedBy: string, db: any): Promise<void> {
    await db.query(
      `UPDATE care_gaps
       SET status = 'dismissed', dismissed_by = $2,
           dismissed_at = now(),
           dismissed_until = now() + INTERVAL '30 days'
       WHERE id = $1`,
      [gapId, dismissedBy],
    );
  }

  async resolveGap(gapId: string, db: any): Promise<void> {
    await db.query(
      `UPDATE care_gaps SET status = 'resolved', resolved_at = now() WHERE id = $1`,
      [gapId],
    );
  }

  async refreshPatient(patientId: string, db: any): Promise<void> {
    const gaps = await this.detectGaps(patientId, db);
    await this.upsertGaps(patientId, gaps, db);
  }
}
