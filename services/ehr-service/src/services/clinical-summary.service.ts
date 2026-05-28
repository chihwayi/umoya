import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

@Injectable()
export class ClinicalSummaryService {
  private readonly logger = new Logger(ClinicalSummaryService.name);

  async getSummary(patientId: string, db: any): Promise<unknown | null> {
    const rows = await db.query(
      `SELECT * FROM patient_clinical_summaries WHERE patient_id = $1`,
      [patientId],
    );
    return rows[0] ?? null;
  }

  async generateSummary(patientId: string, db: any): Promise<unknown> {
    const [patient, diagnoses, meds, labs, riskScore, timeline] = await Promise.all([
      db.query(
        `SELECT first_name, last_name, date_of_birth, sex FROM patients WHERE id = $1`,
        [patientId],
      ),
      db.query(
        `SELECT description, status, icd10_code FROM patient_diagnoses
         WHERE patient_id = $1 AND status IN ('active','chronic') LIMIT 5`,
        [patientId],
      ),
      db.query(
        `SELECT drug_name, dose FROM prescriptions
         WHERE patient_id = $1 AND status = 'active' LIMIT 5`,
        [patientId],
      ),
      db.query(
        `SELECT test_name, value, unit, flag FROM lab_results
         WHERE patient_id = $1 AND status = 'resulted'
         ORDER BY resulted_at DESC LIMIT 3`,
        [patientId],
      ),
      db.query(
        `SELECT score, band FROM mortality_risk_scores
         WHERE patient_id = $1 ORDER BY scored_at DESC LIMIT 1`,
        [patientId],
      ),
      db.query(
        `SELECT one_line_summary FROM patient_ai_timeline WHERE patient_id = $1`,
        [patientId],
      ),
    ]);

    const pt = patient[0] ?? {};
    const age = pt.date_of_birth
      ? Math.floor(
          (Date.now() - new Date(pt.date_of_birth).getTime()) /
            (365.25 * 24 * 3600 * 1000),
        )
      : '?';

    const dataKey = JSON.stringify({
      d: diagnoses.length,
      m: meds.length,
      l: labs.length,
    });
    const dataHash = createHash('md5').update(dataKey).digest('hex');

    const existing = await db.query(
      `SELECT * FROM patient_clinical_summaries WHERE patient_id = $1`,
      [patientId],
    );
    if (existing.length > 0 && existing[0].data_hash === dataHash) {
      return existing[0];
    }

    const s1 = `${pt.first_name ?? 'Patient'} is a ${age}-year-old ${pt.sex ?? 'patient'} with ${
      diagnoses
        .map((d: any) => d.description)
        .slice(0, 2)
        .join(' and ') || 'no documented chronic conditions'
    }.`;
    const s2 =
      meds.length > 0
        ? `Currently on ${meds.map((m: any) => m.drug_name).join(', ')}.`
        : 'No active medications on record.';
    const s3 =
      labs.length > 0
        ? `Recent labs: ${labs
            .map(
              (l: any) =>
                `${l.test_name} ${l.value} ${l.unit ?? ''} ${l.flag ? `[${l.flag}]` : ''}`.trim(),
            )
            .join('; ')}.`
        : 'No recent lab results.';
    const risk = riskScore[0];
    const s4 = risk
      ? `30-day mortality risk: ${risk.score}/100 (${risk.band}).`
      : 'Mortality risk not yet assessed.';
    const s5 = timeline[0]?.one_line_summary ?? 'No AI timeline summary available.';

    const sentences = [s1, s2, s3, s4, s5];
    const summaryText = sentences.join(' ');

    const rows = await db.query(
      `INSERT INTO patient_clinical_summaries
         (patient_id, summary_text, sentences, data_hash)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (patient_id) DO UPDATE SET
         summary_text = EXCLUDED.summary_text,
         sentences = EXCLUDED.sentences,
         data_hash = EXCLUDED.data_hash,
         generated_at = now()
       RETURNING *`,
      [patientId, summaryText, JSON.stringify(sentences), dataHash],
    );
    return rows[0];
  }

  async submitFeedback(
    patientId: string,
    positive: boolean,
    db: any,
  ): Promise<void> {
    const col = positive ? 'feedback_positive' : 'feedback_negative';
    await db.query(
      `UPDATE patient_clinical_summaries SET ${col} = ${col} + 1 WHERE patient_id = $1`,
      [patientId],
    );
  }
}
