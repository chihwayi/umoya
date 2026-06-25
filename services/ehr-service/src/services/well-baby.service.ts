import { Injectable } from '@nestjs/common';

function computeWfaZscore(weightKg: number, ageMonths: number, sex: string, references: any[]): number | null {
  const ref = references.find(
    (r: any) => Number(r.age_months) === Math.round(ageMonths) && r.sex === sex && r.indicator === 'wfa',
  );
  if (!ref) return null;
  const median = Number(ref.median);
  const sd = weightKg >= median
    ? (Number(ref.sd_pos1) - median)
    : (median - Number(ref.sd_neg1));
  return sd > 0 ? Math.round(((weightKg - median) / sd) * 10) / 10 : null;
}

function classifyNutrition(wfaZscore: number | null, muacCm?: number, oedema?: boolean): string {
  if (oedema) return 'sam';
  if (muacCm !== undefined && muacCm !== null) {
    if (muacCm < 11.5) return 'sam';
    if (muacCm < 12.5) return 'mam';
  }
  if (wfaZscore !== null) {
    if (wfaZscore < -3) return 'sam';
    if (wfaZscore < -2) return 'mam';
    if (wfaZscore < -1) return 'mild_wasting';
  }
  return 'normal';
}

@Injectable()
export class WellBabyService {

  async recordVisit(db: any, clinicianId: string, body: any): Promise<any> {
    let wfaZscore: number | null = null;
    let sex = 'male';

    if (body.weightKg && body.ageMonths !== undefined) {
      const [refs, patientRows] = await Promise.all([
        db.query(`SELECT * FROM who_growth_references WHERE indicator='wfa' AND age_months=$1`, [Math.round(body.ageMonths)]),
        db.query(`SELECT gender FROM patients WHERE id=$1`, [body.patientId]),
      ]);
      sex = patientRows[0]?.gender === 'female' ? 'female' : 'male';
      wfaZscore = computeWfaZscore(body.weightKg, body.ageMonths, sex, refs);
    }

    const nutritionStatus = classifyNutrition(wfaZscore);

    const rows = await db.query(
      `INSERT INTO wbc_visits (patient_id, visit_type, weight_kg, length_cm, head_circ_cm, age_months,
         wfa_zscore, nutrition_status, breastfeeding, vitamin_a_given, iron_given, zinc_given,
         deworming_given, parental_concerns, clinical_notes, next_visit_due, clinician_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::date,$17)
       RETURNING *`,
      [body.patientId, body.visitType, body.weightKg ?? null, body.lengthCm ?? null,
       body.headCircCm ?? null, body.ageMonths ?? null, wfaZscore, nutritionStatus,
       body.breastfeeding ?? null, body.vitaminAGiven ?? false, body.ironGiven ?? false,
       body.zincGiven ?? false, body.dewormingGiven ?? false, body.parentalConcerns ?? null,
       body.clinicalNotes ?? null, body.nextVisitDue ?? null, clinicianId],
    );

    if (body.weightKg && body.ageMonths !== undefined) {
      await db.query(
        `INSERT INTO wbc_growth_points (patient_id, visit_id, age_months, weight_kg, length_cm, head_circ_cm, wfa_zscore, sex)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [body.patientId, rows[0]?.id ?? null, body.ageMonths, body.weightKg,
         body.lengthCm ?? null, body.headCircCm ?? null, wfaZscore, sex],
      );
    }

    return {
      ...(rows[0] ?? {}),
      cdss_growth_alert: wfaZscore !== null && wfaZscore < -2
        ? `Growth faltering: WFA z-score ${wfaZscore}. ${wfaZscore < -3
            ? 'SAM — enrol in CMAM programme immediately.'
            : 'MAM — counsel on nutrition, recheck in 2 weeks.'}`
        : null,
    };
  }

  async getVisitHistory(db: any, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT * FROM wbc_visits WHERE patient_id=$1 ORDER BY visit_date DESC`,
      [patientId],
    );
  }

  async getGrowthChart(db: any, patientId: string): Promise<any> {
    const [points, refs] = await Promise.all([
      db.query(`SELECT * FROM wbc_growth_points WHERE patient_id=$1 ORDER BY age_months ASC`, [patientId]),
      db.query(`SELECT * FROM who_growth_references WHERE indicator='wfa' ORDER BY age_months ASC`),
    ]);
    return { growthPoints: points, whoReferences: refs };
  }

  async recordMilestones(db: any, clinicianId: string, patientId: string, body: any): Promise<any> {
    const scores = [body.communicationScore, body.grossMotorScore, body.fineMotorScore,
                    body.problemSolvingScore, body.personalSocialScore].filter(s => s !== undefined);
    const anyBelow = scores.some(s => s < 30);
    const overallResult = body.overallResult ?? (anyBelow ? 'monitor' : 'on_track');

    const rows = await db.query(
      `INSERT INTO wbc_milestones (patient_id, visit_id, age_months, communication_score, gross_motor_score,
         fine_motor_score, problem_solving_score, personal_social_score, overall_result, red_flags,
         referral_made, referral_type, clinician_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13) RETURNING *`,
      [patientId, body.visitId ?? null, body.ageMonths, body.communicationScore ?? null,
       body.grossMotorScore ?? null, body.fineMotorScore ?? null, body.problemSolvingScore ?? null,
       body.personalSocialScore ?? null, overallResult, JSON.stringify(body.redFlags ?? []),
       body.referralMade ?? false, body.referralType ?? null, clinicianId],
    );
    return rows[0] ?? null;
  }

  async getMilestones(db: any, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT * FROM wbc_milestones WHERE patient_id=$1 ORDER BY screening_date DESC`,
      [patientId],
    );
  }

  async recordNutritionAssessment(db: any, clinicianId: string, patientId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO wbc_nutrition_assessments (patient_id, visit_id, muac_cm, oedema, classification, appetite_test, enrolled_rutf, notes, clinician_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [patientId, body.visitId ?? null, body.muacCm ?? null, body.oedema ?? false,
       body.classification, body.appetiteTest ?? null, body.enrolledRutf ?? false,
       body.notes ?? null, clinicianId],
    );
    return rows[0] ?? null;
  }

  async getOverdueVisits(db: any, days: number): Promise<any[]> {
    return db.query(
      `SELECT v.next_visit_due, v.visit_type, p.first_name, p.last_name, p.id AS patient_id, p.phone
       FROM wbc_visits v
       JOIN patients p ON p.id = v.patient_id
       WHERE v.next_visit_due < CURRENT_DATE - ($1 || ' days')::interval
         AND NOT EXISTS (
           SELECT 1 FROM wbc_visits v2
           WHERE v2.patient_id = v.patient_id AND v2.visit_date > v.visit_date
         )
       ORDER BY v.next_visit_due ASC
       LIMIT 100`,
      [days],
    );
  }

  async getDashboard(db: any): Promise<any> {
    const [visits, malnutrition, milestoneResults] = await Promise.all([
      db.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE visit_date = CURRENT_DATE) AS today FROM wbc_visits`),
      db.query(`SELECT classification, COUNT(*) AS cnt FROM wbc_nutrition_assessments WHERE assessed_at >= CURRENT_DATE - 30 GROUP BY classification`),
      db.query(`SELECT overall_result, COUNT(*) AS cnt FROM wbc_milestones WHERE screening_date >= CURRENT_DATE - 90 GROUP BY overall_result`),
    ]);
    return { visitSummary: visits[0], malnutrition30d: malnutrition, milestoneResults90d: milestoneResults };
  }
}
