import { Injectable } from '@nestjs/common';

@Injectable()
export class DialysisService {

  async registerDialysisPatient(db: any, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO dialysis_patients (patient_id, modality, start_date, primary_diagnosis, target_weight_kg, dialysis_frequency)
       VALUES ($1,$2,$3::date,$4,$5,$6)
       ON CONFLICT (patient_id) DO UPDATE SET modality=$2, is_active=TRUE, target_weight_kg=$5
       RETURNING *`,
      [body.patientId, body.modality, body.startDate, body.primaryDiagnosis, body.targetWeightKg ?? null, body.dialysisFrequency ?? 'thrice_weekly'],
    );
    return rows[0] ?? null;
  }

  async registerAccess(db: any, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO vascular_access (patient_id, access_type, site, creation_date, status, is_primary)
       VALUES ($1,$2,$3,$4::date,$5,$6) RETURNING *`,
      [body.patientId, body.accessType, body.site, body.creationDate, body.status ?? 'maturing', body.isPrimary ?? true],
    );
    return rows[0] ?? null;
  }

  async updateAccessStatus(db: any, id: string, body: any): Promise<any> {
    const rows = await db.query(
      `UPDATE vascular_access SET status=$1, flow_ml_min=COALESCE($2, flow_ml_min) WHERE id=$3 RETURNING *`,
      [body.status, body.flowMlMin ?? null, id],
    );
    return rows[0] ?? null;
  }

  async startHdSession(db: any, accessNeedledBy: string, body: any): Promise<any> {
    const now = new Date();
    const startTime = now.toTimeString().slice(0, 5);
    const rows = await db.query(
      `INSERT INTO hd_sessions (patient_id, access_id, start_time, pre_weight_kg, blood_flow_ml_min, dialysate_flow_ml_min, pre_bp_systolic, pre_bp_diastolic, access_needled_by)
       VALUES ($1,$2,$3::time,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [body.patientId, body.accessId ?? null, startTime, body.preWeightKg, body.bloodFlowMlMin ?? null, body.dialysateFlowMlMin ?? null, body.preBpSystolic ?? null, body.preBpDiastolic ?? null, accessNeedledBy],
    );
    return rows[0] ?? null;
  }

  async completeHdSession(db: any, id: string, body: any): Promise<any> {
    const rows = await db.query(
      `UPDATE hd_sessions
       SET post_weight_kg=$1, kt_v_measured=$2, end_time=$3::time, session_completed=TRUE,
           complications=$4::jsonb, post_bp_systolic=$5, post_bp_diastolic=$6
       WHERE id=$7 RETURNING *, kt_v_adequate, uf_volume_ml, duration_hours`,
      [body.postWeightKg, body.ktV ?? null, body.endTime, JSON.stringify(body.complications ?? []), body.postBpSystolic ?? null, body.postBpDiastolic ?? null, id],
    );
    const result = rows[0];
    return {
      ...result,
      cdss_alert: result?.kt_v_adequate === false
        ? `⚠ Kt/V ${result.kt_v_measured} is BELOW 1.2 target. Review session length, blood flow, and access adequacy. Consider increasing dialysis frequency.`
        : null,
    };
  }

  async getHdHistory(db: any, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT *, kt_v_adequate, uf_volume_ml, duration_hours
       FROM hd_sessions WHERE patient_id=$1 ORDER BY session_date DESC, start_time DESC LIMIT 30`,
      [patientId],
    );
  }

  async startCrrt(db: any, managedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO crrt_sessions (patient_id, icu_admission_id, modality, blood_flow_ml_min, dialysate_flow_ml_h, replacement_rate_ml_h, target_effluent_ml_kg_h, anticoagulation, managed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [body.patientId, body.icuAdmissionId ?? null, body.modality ?? 'cvvhdf', body.bloodFlowMlMin ?? null, body.dialysateFlowMlH ?? null, body.replacementRateMlH ?? null, body.targetEffluentMlKgH ?? 25, body.anticoagulation ?? 'none', managedBy],
    );
    return rows[0] ?? null;
  }

  async recordPdExchange(db: any, recordedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO pd_exchanges (patient_id, exchange_number, fill_volume_ml, dwell_hours, drain_volume_ml, glucose_pct, effluent_colour, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *, ultrafiltration_ml, is_cloudy`,
      [body.patientId, body.exchangeNumber, body.fillVolumeMl, body.dwellHours, body.drainVolumeMl ?? null, body.glucosePct, body.effluentColour ?? null, recordedBy],
    );
    const result = rows[0];
    return {
      ...result,
      cdss_alert: result?.is_cloudy
        ? `⚠ CLOUDY EFFLUENT: Suspected peritonitis. Send effluent for cell count, culture and sensitivity. Start empirical antibiotics per PD peritonitis protocol.`
        : null,
    };
  }

  async getAdequacy(db: any, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT * FROM dialysis_adequacy_summary WHERE patient_id=$1 LIMIT 12`,
      [patientId],
    );
  }

  async getDashboard(db: any): Promise<any> {
    const [activePatients, todaySessions, inadequate] = await Promise.all([
      db.query(`SELECT COUNT(*) AS count FROM dialysis_patients WHERE is_active=TRUE`),
      db.query(`SELECT COUNT(*) AS count FROM hd_sessions WHERE session_date=CURRENT_DATE`),
      db.query(`SELECT COUNT(*) AS count FROM hd_sessions WHERE kt_v_adequate=FALSE AND session_date >= CURRENT_DATE - INTERVAL '30 days'`),
    ]);
    return {
      active_patients: Number(activePatients[0]?.count ?? 0),
      sessions_today: Number(todaySessions[0]?.count ?? 0),
      inadequate_sessions_30d: Number(inadequate[0]?.count ?? 0),
    };
  }
}
