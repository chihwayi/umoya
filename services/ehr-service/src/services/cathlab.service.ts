import { Injectable } from '@nestjs/common';

@Injectable()
export class CathLabService {

  async scheduleCase(db: any, operatorId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO cathlab_cases
         (patient_id, encounter_id, procedure_type, indication, priority, scheduled_at, operator_id, referring_cardiologist_id)
       VALUES ($1,$2,$3,$4,$5,$6::timestamptz,$7,$8)
       RETURNING *`,
      [body.patientId, body.encounterId ?? null, body.procedureType, body.indication,
       body.priority ?? 'elective', body.scheduledAt ?? null, operatorId, body.referringCardiologistId ?? null],
    );
    return rows[0] ?? null;
  }

  async listCases(db: any, filters: { status?: string; priority?: string; date?: string }): Promise<any[]> {
    return db.query(
      `SELECT cc.id, cc.procedure_type, cc.priority, cc.status, cc.scheduled_at, cc.door_to_balloon_mins,
              p.first_name, p.last_name, p.date_of_birth
       FROM cathlab_cases cc
       JOIN patients p ON p.id = cc.patient_id
       WHERE ($1::text IS NULL OR cc.status = $1)
         AND ($2::text IS NULL OR cc.priority = $2)
         AND ($3::date IS NULL OR cc.scheduled_at::date = $3::date)
       ORDER BY cc.scheduled_at DESC NULLS LAST`,
      [filters.status ?? null, filters.priority ?? null, filters.date ?? null],
    );
  }

  async getCase(db: any, id: string): Promise<any> {
    const rows = await db.query(
      `SELECT cc.*, p.first_name, p.last_name, p.date_of_birth, p.gender
       FROM cathlab_cases cc
       JOIN patients p ON p.id = cc.patient_id
       WHERE cc.id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async startCase(db: any, id: string, accessSite?: string): Promise<any> {
    const rows = await db.query(
      `UPDATE cathlab_cases
       SET status='in_progress', started_at=NOW(), access_site=$1, updated_at=NOW()
       WHERE id=$2 RETURNING *`,
      [accessSite ?? null, id],
    );
    return rows[0] ?? null;
  }

  async completeCase(db: any, id: string, body: any): Promise<any> {
    const rows = await db.query(
      `UPDATE cathlab_cases SET
         status='completed', ended_at=NOW(),
         contrast_volume_ml=$1, fluoroscopy_time_mins=$2,
         timi_flow_pre=$3, timi_flow_post=$4,
         complications=$5::jsonb, outcome=$6, notes=$7, updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [body.contrastVolumeMl, body.fluoroscopyTimeMins, body.timiFlowPre, body.timiFlowPost,
       JSON.stringify(body.complications ?? []), body.outcome, body.notes, id],
    );
    return rows[0] ?? null;
  }

  async addLesion(db: any, caseId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO cathlab_lesions
         (case_id, vessel, stenosis_percent, lesion_length_mm, is_calcified, is_bifurcation,
          is_chronic_total_occlusion, intervention_done, stent_type, stent_brand,
          stent_diameter_mm, stent_length_mm, ivus_done, oct_done, ffr_value, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [caseId, body.vessel, body.stenosisPercent, body.lesionLengthMm,
       body.isCalcified ?? false, body.isBifurcation ?? false, body.isCto ?? false,
       body.interventionDone ?? false, body.stentType ?? 'none', body.stentBrand,
       body.stentDiameterMm, body.stentLengthMm, body.ivusDone ?? false,
       body.octDone ?? false, body.ffrValue, body.notes],
    );
    return rows[0] ?? null;
  }

  async getLesions(db: any, caseId: string): Promise<any[]> {
    return db.query(`SELECT * FROM cathlab_lesions WHERE case_id=$1 ORDER BY vessel`, [caseId]);
  }

  async recordHemodynamics(db: any, caseId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO cathlab_hemodynamics
         (case_id, aortic_pressure_systolic, aortic_pressure_diastolic, lvedp, heart_rate, spo2, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [caseId, body.aorticSystolic, body.aorticDiastolic, body.lvedp,
       body.heartRate, body.spo2, body.notes],
    );
    return rows[0] ?? null;
  }

  async activateStemi(db: any, activatedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO stemi_activations
         (patient_id, activated_by, activation_source, ecg_at, door_in_at, notes)
       VALUES ($1,$2,$3,$4::timestamptz,$5::timestamptz,$6) RETURNING *`,
      [body.patientId, activatedBy, body.activationSource,
       body.ecgAt ?? null, body.doorInAt ?? null, body.notes],
    );
    return rows[0] ?? null;
  }

  async recordBalloonTime(db: any, activationId: string, body: any): Promise<any> {
    const rows = await db.query(
      `UPDATE stemi_activations
       SET balloon_at=$1::timestamptz, cathlab_case_id=$2
       WHERE id=$3 RETURNING *, d2b_mins, outcome_target_met`,
      [body.balloonAt, body.cathlabCaseId ?? null, activationId],
    );
    return rows[0] ?? null;
  }

  async getD2bMetrics(db: any): Promise<any[]> {
    return db.query(`SELECT * FROM cathlab_d2b_metrics LIMIT 12`);
  }

  async recordPostProcedure(db: any, caseId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO cathlab_post_procedure
         (case_id, sheath_removal_at, vascular_complication, post_troponin_result,
          dapt_duration_months, follow_up_date, discharge_medications, notes)
       VALUES ($1,$2::timestamptz,$3,$4,$5,$6::date,$7::jsonb,$8) RETURNING *`,
      [caseId, body.sheathRemovalAt, body.vascularComplication, body.postTroponin,
       body.daptDurationMonths, body.followUpDate,
       JSON.stringify(body.dischargeMedications ?? []), body.notes],
    );
    return rows[0] ?? null;
  }

  async getDashboard(db: any): Promise<any> {
    const [today, stemi30d, d2b] = await Promise.all([
      db.query(
        `SELECT status, COUNT(*) AS cnt FROM cathlab_cases WHERE scheduled_at::date = CURRENT_DATE GROUP BY status`,
      ),
      db.query(
        `SELECT COUNT(*) AS cnt, ROUND(AVG(d2b_mins)) AS avg_d2b FROM stemi_activations WHERE door_in_at >= CURRENT_DATE - 30`,
      ),
      db.query(
        `SELECT COUNT(*) FILTER (WHERE outcome_target_met) AS met, COUNT(*) AS total FROM stemi_activations WHERE door_in_at >= CURRENT_DATE - 90`,
      ),
    ]);
    return { todayCases: today, stemi30d: stemi30d[0], d2bQuality: d2b[0] };
  }

  async getPatientCases(db: any, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT cc.id, cc.procedure_type, cc.priority, cc.status, cc.scheduled_at,
              cc.outcome, cc.timi_flow_post
       FROM cathlab_cases cc
       WHERE cc.patient_id = $1
       ORDER BY cc.scheduled_at DESC NULLS LAST`,
      [patientId],
    );
  }
}
