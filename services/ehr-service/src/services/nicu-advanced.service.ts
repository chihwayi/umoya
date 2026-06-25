import { Injectable } from '@nestjs/common';

// PN target ranges per postnatal day and gestational age
// Source: ESPGHAN 2018 neonatal nutrition guidelines
function computePNTargets(postnatalDay: number, gaWeeks: number): Record<string, number> {
  const premature = gaWeeks < 37;
  const vlbw = gaWeeks < 30;

  const fluidTarget = postnatalDay <= 1
    ? (premature ? 80 : 60)
    : postnatalDay <= 3
      ? (premature ? 100 : 80)
      : (premature ? 150 : 120);

  const aaTarget = postnatalDay <= 1
    ? (vlbw ? 2.5 : 1.5)
    : postnatalDay <= 3
      ? (vlbw ? 3.0 : 2.0)
      : (vlbw ? 3.5 : 2.5);

  const lipidTarget = postnatalDay <= 1 ? 1.0 : postnatalDay <= 3 ? 2.0 : 3.0;
  const glucoseTarget = vlbw ? 7.0 : 5.0;

  return {
    fluid_ml_per_kg_per_day: fluidTarget,
    amino_acid_g_per_kg_per_day: aaTarget,
    lipid_g_per_kg_per_day: lipidTarget,
    glucose_g_per_kg_per_day: glucoseTarget,
    sodium_mmol_per_kg_per_day: postnatalDay <= 2 ? 0 : 2.0,
    potassium_gir_mg_per_kg_per_min: postnatalDay <= 2 ? 0 : 1.5,
    calcium_mmol_per_kg_per_day: 1.0,
  };
}

@Injectable()
export class NicuAdvancedService {

  async getFormulary(db: any): Promise<any[]> {
    return db.query(`SELECT * FROM nicu_drug_formulary WHERE is_active ORDER BY category, drug_name`);
  }

  async orderDrug(db: any, orderedBy: string, body: any): Promise<any> {
    const formulary = await db.query(
      `SELECT * FROM nicu_drug_formulary WHERE drug_code=$1 LIMIT 1`,
      [body.drugCode],
    );
    if (!formulary[0]) throw new Error(`Drug code ${body.drugCode} not in formulary.`);

    const drug = formulary[0];
    const doseMg = body.weightKg * drug.dose_mg_per_kg;
    const exceedsMax = drug.dose_max_mg != null && doseMg > drug.dose_max_mg;
    const nearToxicity = drug.toxicity_threshold_mg_per_kg != null
      && body.weightKg * drug.toxicity_threshold_mg_per_kg < doseMg * 1.2;

    const rows = await db.query(
      `INSERT INTO nicu_drug_orders (admission_id, drug_code, weight_kg, exceeds_max, near_toxicity, ordered_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *, dose_calculated_mg`,
      [body.admissionId, body.drugCode, body.weightKg, exceedsMax, nearToxicity, orderedBy, body.notes ?? null],
    );
    const result = rows[0];
    const alerts: string[] = [];
    if (exceedsMax) alerts.push(`⚠ DOSE EXCEEDS MAXIMUM: ${drug.drug_name} maximum dose is ${drug.dose_max_mg} mg. Calculated: ${doseMg.toFixed(3)} mg. Use max dose.`);
    if (nearToxicity) alerts.push(`⚠ NEAR TOXICITY THRESHOLD: Monitor ${drug.monitoring_required} closely.`);
    if (drug.monitoring_required) alerts.push(`Monitoring required: ${drug.monitoring_required}.`);

    return { ...result, cdss_alerts: alerts, recommended_dose_mg: exceedsMax ? drug.dose_max_mg : doseMg.toFixed(4) };
  }

  async getDrugOrders(db: any, admissionId: string): Promise<any[]> {
    return db.query(
      `SELECT no.*, df.drug_name, df.route, df.frequency, df.monitoring_required
       FROM nicu_drug_orders no
       JOIN nicu_drug_formulary df ON df.drug_code = no.drug_code
       WHERE no.admission_id=$1 ORDER BY no.ordered_at DESC`,
      [admissionId],
    );
  }

  async prescribePN(db: any, prescribedBy: string, body: any): Promise<any> {
    const targets = computePNTargets(body.postnatalDay, body.gestationalAgeWeeks);

    const rows = await db.query(
      `INSERT INTO nicu_pn_prescriptions (admission_id, weight_kg, postnatal_day, gestational_age_weeks,
         fluid_ml_per_kg_per_day, glucose_g_per_kg_per_day, amino_acid_g_per_kg_per_day,
         lipid_g_per_kg_per_day, sodium_mmol_per_kg_per_day, potassium_gir_mg_per_kg_per_min,
         calcium_mmol_per_kg_per_day, prescribed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *, total_kcal_per_kg_per_day`,
      [body.admissionId, body.weightKg, body.postnatalDay, body.gestationalAgeWeeks,
        targets.fluid_ml_per_kg_per_day, targets.glucose_g_per_kg_per_day,
        targets.amino_acid_g_per_kg_per_day, targets.lipid_g_per_kg_per_day,
        targets.sodium_mmol_per_kg_per_day, targets.potassium_gir_mg_per_kg_per_min,
        targets.calcium_mmol_per_kg_per_day, prescribedBy],
    );
    const result = rows[0];
    const w = body.weightKg;
    return {
      ...result,
      absolute_targets: {
        total_fluid_ml_per_day: (targets.fluid_ml_per_kg_per_day * w).toFixed(1),
        amino_acid_ml_per_day_at_10pct: (targets.amino_acid_g_per_kg_per_day * w / 0.1).toFixed(1),
        lipid_ml_per_day_at_20pct: (targets.lipid_g_per_kg_per_day * w / 0.2).toFixed(1),
      },
    };
  }

  async getPNHistory(db: any, admissionId: string): Promise<any[]> {
    return db.query(
      `SELECT *, total_kcal_per_kg_per_day FROM nicu_pn_prescriptions WHERE admission_id=$1 ORDER BY prescription_date DESC`,
      [admissionId],
    );
  }

  async recordScreening(db: any, performedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO nicu_screening_results (admission_id, patient_id, screening_type, result_status, result_details, notes, performed_by)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7) RETURNING *, followup_required`,
      [body.admissionId, body.patientId, body.screeningType, body.resultStatus, JSON.stringify(body.resultDetails ?? {}), body.notes ?? null, performedBy],
    );
    const result = rows[0];
    return {
      ...result,
      cdss_alert: result?.followup_required
        ? `⚠ SCREENING ${body.screeningType.toUpperCase()}: Result is ${body.resultStatus.toUpperCase()}. Referral and follow-up documentation required.`
        : null,
    };
  }

  async getScreeningResults(db: any, admissionId: string): Promise<any[]> {
    return db.query(
      `SELECT *, followup_required FROM nicu_screening_results WHERE admission_id=$1 ORDER BY performed_at DESC`,
      [admissionId],
    );
  }

  async getPendingScreeningFollowups(db: any): Promise<any[]> {
    return db.query(
      `SELECT ns.*, p.first_name, p.last_name, na.gestational_age_weeks
       FROM nicu_screening_results ns
       JOIN nicu_admissions na ON na.id = ns.admission_id
       JOIN patients p ON p.id = ns.patient_id
       WHERE ns.followup_required = TRUE AND ns.referred_at IS NULL
       ORDER BY ns.performed_at ASC`,
    );
  }

  async recordNasScore(db: any, scoredBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO nicu_nas_scores (admission_id, score_items, total_score, scored_by)
       VALUES ($1,$2::jsonb,$3,$4) RETURNING *, requires_treatment, treatment_escalation_needed`,
      [body.admissionId, JSON.stringify(body.scoreItems), body.totalScore, scoredBy],
    );
    const result = rows[0];
    let alert: string | null = null;
    if (result?.treatment_escalation_needed) {
      alert = `⚠ NAS SCORE ${body.totalScore} ≥ 12: TREATMENT ESCALATION REQUIRED. Consider increasing morphine dose or adding clonidine. Senior review immediately.`;
    } else if (result?.requires_treatment) {
      alert = `NAS SCORE ${body.totalScore} ≥ 8: Initiate morphine treatment per NAS protocol. Supportive measures: swaddle, reduce stimulation, non-nutritive sucking.`;
    }
    return { ...result, cdss_alert: alert };
  }

  async getNasHistory(db: any, admissionId: string): Promise<any[]> {
    return db.query(
      `SELECT *, requires_treatment, treatment_escalation_needed FROM nicu_nas_scores WHERE admission_id=$1 ORDER BY scored_at DESC`,
      [admissionId],
    );
  }
}
