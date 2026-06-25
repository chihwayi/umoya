import { Injectable } from '@nestjs/common';

@Injectable()
export class AestheticsService {

  async enrollPatient(db: any, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO aesthetics_patients (patient_id, fitzpatrick_type, glogau_class, primary_concerns, allergies, smoking_status, is_on_retinoids, is_on_blood_thinners)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8)
       ON CONFLICT (patient_id) DO UPDATE SET fitzpatrick_type=$2, glogau_class=$3, primary_concerns=$4::jsonb
       RETURNING *`,
      [body.patientId, body.fitzpatrickType ?? null, body.glogauClass ?? null, JSON.stringify(body.primaryConcerns ?? []), body.allergies ?? null, body.smokingStatus ?? null, body.isOnRetinoids ?? false, body.isOnBloodThinners ?? false],
    );
    return rows[0] ?? null;
  }

  async getProfile(db: any, patientId: string): Promise<any> {
    const [profile, recent, skin] = await Promise.all([
      db.query(`SELECT ap.*, p.first_name, p.last_name, p.date_of_birth FROM aesthetics_patients ap JOIN patients p ON p.id=ap.patient_id WHERE ap.patient_id=$1`, [patientId]),
      db.query(`SELECT * FROM aesthetic_procedures WHERE patient_id=$1 ORDER BY procedure_date DESC LIMIT 10`, [patientId]),
      db.query(`SELECT * FROM skin_analysis_records WHERE patient_id=$1 ORDER BY assessed_at DESC LIMIT 1`, [patientId]),
    ]);
    return { profile: profile[0] ?? null, recent_procedures: recent, latest_skin_analysis: skin[0] ?? null };
  }

  async recordConsent(db: any, witnessedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO aesthetic_consent_records (patient_id, procedure_type, consent_version, risks_explained, patient_questions, signed_by_patient, witnessed_by)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7) RETURNING *`,
      [body.patientId, body.procedureType, body.consentVersion ?? '1.0', JSON.stringify(body.risksExplained ?? []), body.patientQuestions ?? null, body.signedByPatient ?? true, witnessedBy],
    );
    return rows[0] ?? null;
  }

  async recordProcedure(db: any, performedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO aesthetic_procedures (patient_id, procedure_type, treatment_areas, product_used, product_lot, product_expiry, units_or_ml, pre_photo_ref, post_photo_ref, next_session_due, performed_by, cost_usd, notes)
       VALUES ($1,$2,$3::jsonb,$4,$5,$6::date,$7,$8,$9,$10::date,$11,$12,$13) RETURNING *`,
      [body.patientId, body.procedureType, JSON.stringify(body.treatmentAreas ?? []), body.productUsed ?? null, body.productLot ?? null, body.productExpiry ?? null, body.unitsOrMl ?? null, body.prePhotoRef ?? null, body.postPhotoRef ?? null, body.nextSessionDue ?? null, performedBy, body.costUsd ?? null, body.notes ?? null],
    );
    return rows[0] ?? null;
  }

  async getPatientProcedures(db: any, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT * FROM aesthetic_procedures WHERE patient_id=$1 ORDER BY procedure_date DESC`,
      [patientId],
    );
  }

  async recordPrpSession(db: any, performedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO prp_sessions (procedure_id, patient_id, blood_drawn_ml, centrifuge_rpm, centrifuge_mins, prp_yield_ml, platelet_count_before, platelet_count_prp, activation_agent, injection_sites, performed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)
       RETURNING *, platelet_concentration_factor`,
      [body.procedureId, body.patientId, body.bloodDrawnMl, body.centrifugeRpm ?? null, body.centrifugeMins ?? null, body.prpYieldMl ?? null, body.plateletCountBefore ?? null, body.plateletCountPrp ?? null, body.activationAgent ?? 'none', JSON.stringify(body.injectionSites ?? []), performedBy],
    );
    const result = rows[0];
    return {
      ...result,
      cdss_note: result?.platelet_concentration_factor
        ? `PRP concentration factor: ${result.platelet_concentration_factor}x. Therapeutic range typically 3–8x baseline.`
        : null,
    };
  }

  async recordSkinAnalysis(db: any, assessedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO skin_analysis_records (patient_id, assessed_at, hydration_score, sebum_score, pigmentation_score, pore_score, wrinkle_score, skin_age_estimate, analysis_device, recommendations, assessed_by)
       VALUES ($1,$2::date,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11) RETURNING *`,
      [body.patientId, body.assessedAt ?? new Date().toISOString().slice(0, 10), body.hydrationScore ?? null, body.sebumScore ?? null, body.pigmentationScore ?? null, body.poreScore ?? null, body.wrinkleScore ?? null, body.skinAgeEstimate ?? null, body.analysisDevice ?? null, JSON.stringify(body.recommendations ?? []), assessedBy],
    );
    return rows[0] ?? null;
  }

  async getSkinHistory(db: any, patientId: string): Promise<any[]> {
    return db.query(`SELECT * FROM skin_analysis_records WHERE patient_id=$1 ORDER BY assessed_at DESC`, [patientId]);
  }

  async getUpcomingSessions(db: any): Promise<any[]> {
    return db.query(
      `SELECT ap.*, p.first_name, p.last_name
       FROM aesthetic_procedures ap
       JOIN patients p ON p.id = ap.patient_id
       WHERE ap.next_session_due IS NOT NULL AND ap.next_session_due BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '14 days'
       ORDER BY ap.next_session_due ASC`,
    );
  }
}
