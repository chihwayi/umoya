import { Injectable } from '@nestjs/common';

function interpretEpds(totalScore: number, q10Score: number): { level: string; action: string } {
  if (q10Score >= 1) {
    return {
      level: 'critical',
      action: 'IMMEDIATE SAFETY CONCERN: Patient endorsed self-harm ideation (Q10). Do not leave patient alone. Conduct urgent psychiatric assessment NOW. Complete risk assessment. Notify senior clinician.',
    };
  }
  if (totalScore >= 13) {
    return {
      level: 'high',
      action: 'EPDS >=13: Probable major depressive episode. Refer to psychiatrist or perinatal mental health specialist within 24 hours. Consider pharmacotherapy. Ensure safe home environment and support.',
    };
  }
  if (totalScore >= 10) {
    return {
      level: 'moderate',
      action: 'EPDS 10-12: Possible depression. Enhanced monitoring. Schedule review in 2 weeks. Counsel on sleep, support networks. Consider CBT referral. Repeat EPDS in 2 weeks.',
    };
  }
  return {
    level: 'low',
    action: 'EPDS <10: Low risk. Routine postnatal support. Re-screen at 3 months postpartum as scheduled.',
  };
}

@Injectable()
export class PerinatalMentalHealthService {

  async createAssessment(db: any, assessedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO pmh_assessments (patient_id, assessment_date, days_postpartum, timing, previous_pmh, previous_pmh_details, current_medications, social_support_adequate, domestic_violence_screen, substance_use, housing_concerns, assessed_by)
       VALUES ($1,$2::date,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [body.patientId, body.assessmentDate ?? new Date().toISOString().slice(0, 10), body.daysPostpartum ?? null, body.timing, body.previousPmh ?? false, body.previousPmhDetails ?? null, body.currentMedications ?? null, body.socialSupportAdequate ?? null, body.domesticViolenceScreen ?? null, body.substanceUse ?? false, body.housingConcerns ?? false, assessedBy],
    );
    return rows[0] ?? null;
  }

  async submitEpds(db: any, _reviewedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO epds_responses (assessment_id, patient_id, q1_score, q2_score, q3_score, q4_score, q5_score, q6_score, q7_score, q8_score, q9_score, q10_score)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *, total_score, risk_level, self_harm_ideation`,
      [body.assessmentId, body.patientId, body.q1, body.q2, body.q3, body.q4, body.q5, body.q6, body.q7, body.q8, body.q9, body.q10],
    );
    const result = rows[0];
    const interpretation = interpretEpds(result?.total_score ?? 0, body.q10);

    if (result && result.risk_level !== 'critical') {
      await this.scheduleFollowups(db, body.patientId);
    }

    return {
      ...result,
      cdss_alert: interpretation.action,
      cdss_risk_level: interpretation.level,
    };
  }

  async scheduleFollowups(db: any, patientId: string): Promise<void> {
    const now = new Date();
    const followups = [
      { timing: 'postnatal_6w',  offsetDays: 42  },
      { timing: 'postnatal_3m',  offsetDays: 90  },
      { timing: 'postnatal_6m',  offsetDays: 180 },
    ];
    for (const f of followups) {
      const due = new Date(now.getTime() + f.offsetDays * 86400000);
      await db.query(
        `INSERT INTO pmh_followup_schedule (patient_id, due_date, assessment_timing)
         VALUES ($1,$2::date,$3) ON CONFLICT DO NOTHING`,
        [patientId, due.toISOString().slice(0, 10), f.timing],
      );
    }
  }

  async getEpdsHistory(db: any, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT *, total_score, risk_level, self_harm_ideation FROM epds_responses WHERE patient_id=$1 ORDER BY created_at DESC`,
      [patientId],
    );
  }

  async getCriticalQueue(db: any): Promise<any[]> {
    return db.query(
      `SELECT er.*, p.first_name, p.last_name, p.phone
       FROM epds_responses er
       JOIN patients p ON p.id = er.patient_id
       WHERE er.risk_level = 'critical' AND er.reviewed_at IS NULL
       ORDER BY er.created_at ASC`,
    );
  }

  async markEpdsReviewed(db: any, id: string, reviewedBy: string): Promise<any> {
    const rows = await db.query(
      `UPDATE epds_responses SET reviewed_by=$1, reviewed_at=NOW() WHERE id=$2 RETURNING *`,
      [reviewedBy, id],
    );
    return rows[0] ?? null;
  }

  async raiseSafeguardingFlag(db: any, flaggedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO pmh_safeguarding_flags (patient_id, assessment_id, risk_factors, risk_level, referred_to, referral_date, notes, flagged_by)
       VALUES ($1,$2,$3::jsonb,$4,$5,$6::date,$7,$8) RETURNING *`,
      [body.patientId, body.assessmentId ?? null, JSON.stringify(body.riskFactors ?? []), body.riskLevel, body.referredTo ?? null, body.referralDate ?? null, body.notes ?? null, flaggedBy],
    );
    return rows[0] ?? null;
  }

  async getSafeguardingFlags(db: any, patientId: string): Promise<any[]> {
    return db.query(`SELECT * FROM pmh_safeguarding_flags WHERE patient_id=$1 ORDER BY flag_date DESC`, [patientId]);
  }

  async getOverdueFollowups(db: any): Promise<any[]> {
    return db.query(
      `SELECT pf.*, p.first_name, p.last_name, p.phone
       FROM pmh_followup_schedule pf
       JOIN patients p ON p.id = pf.patient_id
       WHERE pf.completed = FALSE AND pf.due_date < CURRENT_DATE
       ORDER BY pf.due_date ASC`,
    );
  }
}
