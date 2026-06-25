import { Injectable } from '@nestjs/common';

@Injectable()
export class IcuService {

  async getCensus(db: any, icuType?: string): Promise<any[]> {
    return db.query(
      `SELECT ia.id, ia.icu_type, ia.bed_code, ia.admission_at, ia.los_days, ia.isolation_required,
              ia.ventilator_required, ia.status,
              p.first_name, p.last_name, p.date_of_birth,
              COALESCE(latest_sofa.sofa_total, 0) AS latest_sofa,
              latest_vent.is_alarm_driving_pressure, latest_vent.is_alarm_plateau
       FROM icu_admissions ia
       JOIN patients p ON p.id = ia.patient_id
       LEFT JOIN LATERAL (
         SELECT sofa_total FROM icu_scores WHERE admission_id = ia.id ORDER BY scored_at DESC LIMIT 1
       ) latest_sofa ON TRUE
       LEFT JOIN LATERAL (
         SELECT is_alarm_driving_pressure, is_alarm_plateau
         FROM icu_ventilator_settings WHERE admission_id = ia.id ORDER BY recorded_at DESC LIMIT 1
       ) latest_vent ON TRUE
       WHERE ia.status = 'active'
         AND ($1::text IS NULL OR ia.icu_type = $1)
       ORDER BY ia.los_days DESC`,
      [icuType ?? null],
    );
  }

  async admitPatient(db: any, admittedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO icu_admissions (patient_id, encounter_id, icu_type, bed_code, admission_diagnosis,
         ventilator_required, isolation_required, isolation_type, admitted_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [body.patientId, body.encounterId ?? null, body.icuType ?? 'general', body.bedCode,
       body.diagnosis ?? null, body.ventilatorRequired ?? false, body.isolationRequired ?? false,
       body.isolationType ?? null, admittedBy],
    );
    return rows[0] ?? null;
  }

  async dischargePatient(db: any, id: string, destination?: string): Promise<any> {
    const rows = await db.query(
      `UPDATE icu_admissions
       SET status='discharged', discharge_at=NOW(), discharge_destination=$1, updated_at=NOW()
       WHERE id=$2 RETURNING *, los_days`,
      [destination ?? null, id],
    );
    return rows[0] ?? null;
  }

  async chartVitals(db: any, chartedBy: string, admissionId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO icu_vitals (admission_id, hr, bp_systolic, bp_diastolic, map, cvp, spo2, rr, temp,
         gcs_eye, gcs_verbal, gcs_motor, urine_output_ml, etco2, charted_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [admissionId, body.hr ?? null, body.bpSystolic ?? null, body.bpDiastolic ?? null,
       body.map ?? null, body.cvp ?? null, body.spo2 ?? null, body.rr ?? null, body.temp ?? null,
       body.gcsEye ?? null, body.gcsVerbal ?? null, body.gcsMotor ?? null,
       body.urineOutputMl ?? null, body.etco2 ?? null, chartedBy],
    );
    return rows[0] ?? null;
  }

  async getVitals(db: any, admissionId: string, hours: number): Promise<any[]> {
    return db.query(
      `SELECT * FROM icu_vitals
       WHERE admission_id=$1 AND charted_at >= NOW() - ($2 || ' hours')::interval
       ORDER BY charted_at`,
      [admissionId, hours],
    );
  }

  async recordVentilatorSettings(db: any, recordedBy: string, admissionId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO icu_ventilator_settings (admission_id, mode, fio2, peep, tidal_volume_ml, rate,
         ps_above_peep, plateau_pressure, compliance_ml_cmH2O, pip, i_e_ratio, pf_ratio, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *, driving_pressure, is_alarm_driving_pressure, is_alarm_plateau`,
      [admissionId, body.mode ?? null, body.fio2 ?? null, body.peep ?? null,
       body.tidalVolumeMl ?? null, body.rate ?? null, body.psAbovePeep ?? null,
       body.plateauPressure ?? null, body.complianceMlCmH2O ?? null,
       body.pip ?? null, body.ieRatio ?? null, body.pfRatio ?? null, recordedBy],
    );
    return rows[0] ?? null;
  }

  async getVentilatorHistory(db: any, admissionId: string): Promise<any[]> {
    return db.query(
      `SELECT * FROM icu_ventilator_settings WHERE admission_id=$1 ORDER BY recorded_at DESC LIMIT 48`,
      [admissionId],
    );
  }

  async getActiveVentilatorAlarms(db: any, admissionId: string): Promise<any[]> {
    return db.query(
      `SELECT * FROM icu_ventilator_settings
       WHERE admission_id=$1
         AND (is_alarm_driving_pressure = TRUE OR is_alarm_plateau = TRUE)
       ORDER BY recorded_at DESC LIMIT 10`,
      [admissionId],
    );
  }

  async upsertFluidBalance(db: any, recordedBy: string, admissionId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO icu_fluid_balance (admission_id, balance_date, iv_fluids_ml, medications_ml,
         enteral_ml, oral_ml, blood_products_ml, urine_out_ml, drain_out_ml, ng_out_ml,
         stool_out_ml, insensible_ml, recorded_by)
       VALUES ($1,COALESCE($2::date,CURRENT_DATE),$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (admission_id, balance_date) DO UPDATE SET
         iv_fluids_ml=$3, medications_ml=$4, enteral_ml=$5, oral_ml=$6, blood_products_ml=$7,
         urine_out_ml=$8, drain_out_ml=$9, ng_out_ml=$10, stool_out_ml=$11, insensible_ml=$12,
         recorded_by=$13, updated_at=NOW()
       RETURNING *, net_balance_ml`,
      [admissionId, body.balanceDate ?? null, body.ivFluidsMl ?? 0, body.medicationsMl ?? 0,
       body.enteralMl ?? 0, body.oralMl ?? 0, body.bloodProductsMl ?? 0,
       body.urineOutMl ?? 0, body.drainOutMl ?? 0, body.ngOutMl ?? 0,
       body.stoolOutMl ?? 0, body.insensibleMl ?? 400, recordedBy],
    );
    return rows[0] ?? null;
  }

  async getFluidBalance(db: any, admissionId: string): Promise<any[]> {
    return db.query(
      `SELECT *, net_balance_ml FROM icu_fluid_balance
       WHERE admission_id=$1 ORDER BY balance_date DESC LIMIT 7`,
      [admissionId],
    );
  }

  async startInfusion(db: any, orderedBy: string, admissionId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO icu_infusions (admission_id, drug_name, concentration, rate_ml_hr, dose_mcg_kg_min, rationale, ordered_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [admissionId, body.drugName, body.concentration ?? null,
       body.rateMlHr ?? null, body.doseMcgKgMin ?? null, body.rationale ?? null, orderedBy],
    );
    return rows[0] ?? null;
  }

  async stopInfusion(db: any, infusionId: string): Promise<any> {
    const rows = await db.query(
      `UPDATE icu_infusions SET stopped_at=NOW() WHERE id=$1 RETURNING *`,
      [infusionId],
    );
    return rows[0] ?? null;
  }

  async getActiveInfusions(db: any, admissionId: string): Promise<any[]> {
    return db.query(
      `SELECT * FROM icu_infusions
       WHERE admission_id=$1 AND stopped_at IS NULL ORDER BY started_at`,
      [admissionId],
    );
  }

  async saveDailyGoals(db: any, completedBy: string, admissionId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO icu_daily_goals (admission_id, goal_date, dvt_prophylaxis, stress_ulcer_prx,
         hob_elevation_30, oral_care_done, spontaneous_breathing_trial, cam_icu_result,
         rass_target, rass_actual, central_line_days, foley_days, ett_days,
         nutrition_goal_kcal, nutrition_delivered_kcal, goals_met, notes, completed_by)
       VALUES ($1,COALESCE($2::date,CURRENT_DATE),$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (admission_id, goal_date) DO UPDATE SET
         dvt_prophylaxis=$3, stress_ulcer_prx=$4, hob_elevation_30=$5, oral_care_done=$6,
         spontaneous_breathing_trial=$7, cam_icu_result=$8, rass_target=$9, rass_actual=$10,
         central_line_days=$11, foley_days=$12, ett_days=$13, nutrition_goal_kcal=$14,
         nutrition_delivered_kcal=$15, goals_met=$16, notes=$17, completed_by=$18
       RETURNING *`,
      [admissionId, body.goalDate ?? null, body.dvtProphylaxis ?? null, body.stressUlcerPrx ?? null,
       body.hobElevation30 ?? null, body.oralCareDone ?? null, body.spontaneousBreathingTrial ?? null,
       body.camIcuResult ?? null, body.rassTarget ?? null, body.rassActual ?? null,
       body.centralLineDays ?? null, body.foleyDays ?? null, body.ettDays ?? null,
       body.nutritionGoalKcal ?? null, body.nutritionDeliveredKcal ?? null,
       body.goalsMet ?? null, body.notes ?? null, completedBy],
    );
    return rows[0] ?? null;
  }

  async getDailyGoals(db: any, admissionId: string): Promise<any[]> {
    return db.query(
      `SELECT * FROM icu_daily_goals WHERE admission_id=$1 ORDER BY goal_date DESC LIMIT 3`,
      [admissionId],
    );
  }

  async recordScore(db: any, scoredBy: string, admissionId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO icu_scores (admission_id, sofa_resp, sofa_coag, sofa_liver, sofa_cardio,
         sofa_cns, sofa_renal, apache2_score, scored_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *, sofa_total`,
      [admissionId, body.sofaResp ?? null, body.sofaCoag ?? null, body.sofaLiver ?? null,
       body.sofaCardio ?? null, body.sofaCns ?? null, body.sofaRenal ?? null,
       body.apache2Score ?? null, scoredBy],
    );
    return rows[0] ?? null;
  }

  async getScores(db: any, admissionId: string): Promise<any[]> {
    return db.query(
      `SELECT *, sofa_total FROM icu_scores WHERE admission_id=$1 ORDER BY scored_at DESC LIMIT 10`,
      [admissionId],
    );
  }

  async getDashboard(db: any): Promise<any> {
    const [census, alarms, avgSofa] = await Promise.all([
      db.query(`SELECT icu_type, COUNT(*) AS cnt FROM icu_admissions WHERE status='active' GROUP BY icu_type`),
      db.query(
        `SELECT COUNT(*) AS cnt FROM icu_ventilator_settings
         WHERE (is_alarm_driving_pressure OR is_alarm_plateau)
           AND recorded_at >= NOW() - INTERVAL '1 hour'`,
      ),
      db.query(
        `SELECT ROUND(AVG(sofa_total),1) AS avg_sofa FROM icu_scores
         WHERE scored_at >= NOW() - INTERVAL '24 hours'`,
      ),
    ]);
    return {
      census,
      recentVentAlarms: Number(alarms[0]?.cnt ?? 0),
      avgSofa24h: avgSofa[0]?.avg_sofa ?? null,
    };
  }
}
