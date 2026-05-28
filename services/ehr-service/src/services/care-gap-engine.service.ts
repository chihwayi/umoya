import { Injectable, Logger, Optional } from '@nestjs/common';
import { ClinicalLlmService } from './clinical-llm.service';
import { AbstentionLogService } from './abstention-log.service';
import { ClinicalNlpService } from './clinical-nlp.service';

interface CareGap {
  gapType: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  recommendedAction: string;
  guidelineReference?: string;
  aiSource?: string;
}

@Injectable()
export class CareGapEngineService {
  private readonly logger = new Logger(CareGapEngineService.name);

  constructor(
    @Optional() private readonly llm?: ClinicalLlmService,
    @Optional() private readonly abstentionLog?: AbstentionLogService,
    @Optional() private readonly nlp?: ClinicalNlpService,
  ) {}

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

    // Enrich structured diagnoses with NLP-extracted diagnoses from recent notes
    if (this.nlp) {
      const recentNotes = await db.query(
        `SELECT content FROM clinical_notes
          WHERE patient_id = $1 AND note_type IN ('soap','progress','discharge')
          ORDER BY created_at DESC LIMIT 3`,
        [patientId],
      );
      if (recentNotes.length > 0) {
        const noteText = recentNotes.map((n: any) => n.content).join('\n---\n');
        const extracted = await this.nlp.extractEntities(
          noteText,
          { context: 'care_gap_nlp', patientId: Number(patientId) },
          db,
        );
        for (const d of extracted.diagnoses) {
          if (!diagnoses.find((x: any) => x.description?.toLowerCase() === d.text.toLowerCase())) {
            diagnoses.push({
              icd10_code: d.icd10Hint ?? '',
              description: d.text,
              status: 'active',
            });
          }
        }
      }
    }

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

    return this.enrichGapsWithLlm(gaps, { age, sex, diagnoses }, db);
  }

  async upsertGaps(patientId: string, gaps: CareGap[], db: any): Promise<void> {
    for (const gap of gaps) {
      await db.query(
        `INSERT INTO care_gaps
           (patient_id, gap_type, description, priority, recommended_action,
            guideline_reference, ai_source)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (patient_id, gap_type) DO UPDATE SET
           description = EXCLUDED.description,
           priority = EXCLUDED.priority,
           recommended_action = EXCLUDED.recommended_action,
           ai_source = EXCLUDED.ai_source,
           detected_at = now()
         WHERE care_gaps.status = 'open'`,
        [
          patientId,
          gap.gapType,
          gap.description,
          gap.priority,
          gap.recommendedAction,
          gap.guidelineReference ?? null,
          gap.aiSource ?? 'rule',
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

  private async enrichGapsWithLlm(
    gaps: CareGap[],
    context: { age: number; sex: string; diagnoses: any[] },
    db?: any,
  ): Promise<CareGap[]> {
    if (!this.llm || gaps.length === 0) {
      return gaps.map(g => ({ ...g, aiSource: 'rule' }));
    }

    const dxList =
      context.diagnoses
        .map((d: any) => d.description)
        .slice(0, 5)
        .join(', ') || 'none';

    const genderLabel =
      context.sex === 'F' ? 'female' : context.sex === 'M' ? 'male' : 'patient';

    const gapSummary = gaps
      .map(
        (g, i) =>
          `${i + 1}. [${g.gapType}] ${g.description} — current action: ${g.recommendedAction}`,
      )
      .join('\n');

    const prompt =
      `You are a clinical care management assistant. A ${context.age}-year-old ${genderLabel} ` +
      `with active diagnoses (${dxList}) has ${gaps.length} care gap(s):\n${gapSummary}\n\n` +
      `Return a JSON array of ${gaps.length} strings — one enhanced recommended action per gap, ` +
      `same order. Each action must be 1 sentence, patient-specific, and clinically precise. ` +
      `JSON only, no other text. Example: ["Action 1","Action 2"]`;

    try {
      const result = await this.llm.generate(
        prompt,
        { context: 'care_gap', maxTokens: 400, temperature: 0.2 },
        db,
      );

      if (result && result.text.length > 10) {
        const raw = result.text.trim();
        const start = raw.indexOf('[');
        const end = raw.lastIndexOf(']');
        if (start !== -1 && end !== -1) {
          const actions: string[] = JSON.parse(raw.slice(start, end + 1));
          if (Array.isArray(actions) && actions.length === gaps.length) {
            return gaps.map((g, i) => ({
              ...g,
              recommendedAction: actions[i] ?? g.recommendedAction,
              aiSource: `llm:${result.backend}`,
            }));
          }
        }
      }

      await this.abstentionLog?.log(db, 'care_gap', 'low_confidence', {});
    } catch {
      // Fall through to rule
    }

    return gaps.map(g => ({ ...g, aiSource: 'rule' }));
  }
}
