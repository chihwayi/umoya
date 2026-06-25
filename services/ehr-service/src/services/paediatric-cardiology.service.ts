import { Injectable } from '@nestjs/common';

// LV shortening fraction normal range in children: 28–44%
const LV_SF_NORMAL_MIN = 28;
const LV_SF_NORMAL_MAX = 44;

@Injectable()
export class PaediatricCardiologyService {

  async registerChd(db: any, cardiologistId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO chd_register (patient_id, primary_diagnosis, diagnosis_date, anatomy_detail, chd_category, shunt_direction, genetic_syndrome, antenatal_diagnosis, primary_cardiologist)
       VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (patient_id) DO UPDATE SET primary_diagnosis=$2, chd_category=$5, current_status='active'
       RETURNING *`,
      [body.patientId, body.primaryDiagnosis, body.diagnosisDate ?? null, body.anatomyDetail ?? null, body.chdCategory, body.shuntDirection ?? null, body.geneticSyndrome ?? null, body.antenatalDiagnosis ?? false, cardiologistId],
    );
    return rows[0] ?? null;
  }

  async getChdRegister(db: any): Promise<any[]> {
    return db.query(
      `SELECT cr.*, p.first_name, p.last_name, p.date_of_birth
       FROM chd_register cr
       JOIN patients p ON p.id = cr.patient_id
       WHERE cr.current_status != 'lost_to_followup'
       ORDER BY cr.chd_category, p.last_name`,
    );
  }

  async recordEcho(db: any, reportingBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO paed_echo_reports (patient_id, echo_date, indication, weight_kg,
         lv_edd_mm, lv_esd_mm, lv_ef_pct, rv_function, septal_motion,
         mitral_regurg, tricuspid_regurg, aortic_stenosis_mean_grad_mmhg, pulm_stenosis_peak_grad_mmhg,
         pa_systolic_pressure_mmhg, pda_present, asd_present, vsd_present, defect_size_mm, shunt_direction,
         reporting_cardiologist, conclusion)
       VALUES ($1,$2::date,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING *, lv_sf_pct, pulmonary_hypertension`,
      [body.patientId, body.echoDate ?? new Date().toISOString().slice(0, 10), body.indication, body.weightKg ?? null,
       body.lvEddMm ?? null, body.lvEsdMm ?? null, body.lvEfPct ?? null, body.rvFunction ?? null, body.septalMotion ?? null,
       body.mitralRegurg ?? null, body.tricuspidRegurg ?? null, body.aorticStenosisMeanGradMmhg ?? null, body.pulmStenosisPeakGradMmhg ?? null,
       body.paSystolicPressureMmhg ?? null, body.pdaPresent ?? false, body.asdPresent ?? false, body.vsdPresent ?? false, body.defectSizeMm ?? null, body.shuntDirection ?? null,
       reportingBy, body.conclusion ?? null],
    );
    const result = rows[0];
    const alerts: string[] = [];
    const sf = result?.lv_sf_pct;
    if (sf != null) {
      if (sf < LV_SF_NORMAL_MIN) alerts.push(`LV shortening fraction ${sf}% is BELOW normal (28–44%). Systolic dysfunction — cardiology review urgently.`);
      else if (sf > LV_SF_NORMAL_MAX) alerts.push(`LV SF ${sf}% above normal range. Consider volume depletion or hyperdynamic circulation.`);
    }
    if (result?.pulmonary_hypertension) {
      alerts.push(`PA systolic pressure ${body.paSystolicPressureMmhg} mmHg — PULMONARY HYPERTENSION. Formal evaluation and specialist referral required.`);
    }
    if (body.mitralRegurg === 'severe' || body.tricuspidRegurg === 'severe') {
      alerts.push('Severe valvular regurgitation identified. Surgical/interventional cardiology referral required.');
    }
    return { ...result, cdss_alerts: alerts };
  }

  async getEchoHistory(db: any, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT *, lv_sf_pct, pulmonary_hypertension FROM paed_echo_reports WHERE patient_id=$1 ORDER BY echo_date DESC`,
      [patientId],
    );
  }

  async recordIntervention(db: any, surgeonId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO paed_cardiac_interventions (patient_id, procedure_date, intervention_type, intent, approach, bypass_minutes, cross_clamp_mins, outcome, discharge_date, complications, notes, surgeon_id)
       VALUES ($1,$2::date,$3,$4,$5,$6,$7,$8,$9::date,$10::jsonb,$11,$12) RETURNING *`,
      [body.patientId, body.procedureDate ?? new Date().toISOString().slice(0, 10), body.interventionType, body.intent, body.approach, body.bypassMinutes ?? null, body.crossClampMins ?? null, body.outcome, body.dischargeDate ?? null, JSON.stringify(body.complications ?? []), body.notes ?? null, surgeonId],
    );
    return rows[0] ?? null;
  }

  async scheduleFollowup(db: any, assignedTo: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO paed_cardiac_followup (patient_id, followup_type, due_date, reason, assigned_to)
       VALUES ($1,$2,$3::date,$4,$5) RETURNING *`,
      [body.patientId, body.followupType, body.dueDate, body.reason ?? null, assignedTo],
    );
    return rows[0] ?? null;
  }

  async getOverdueFollowups(db: any): Promise<any[]> {
    return db.query(
      `SELECT pf.*, p.first_name, p.last_name, cr.primary_diagnosis
       FROM paed_cardiac_followup pf
       JOIN patients p ON p.id = pf.patient_id
       LEFT JOIN chd_register cr ON cr.patient_id = pf.patient_id
       WHERE pf.is_overdue = TRUE
       ORDER BY pf.due_date ASC`,
    );
  }

  async markFollowupComplete(db: any, id: string): Promise<any> {
    const rows = await db.query(
      `UPDATE paed_cardiac_followup SET completed=TRUE, completed_date=CURRENT_DATE WHERE id=$1 RETURNING *`,
      [id],
    );
    return rows[0] ?? null;
  }
}
