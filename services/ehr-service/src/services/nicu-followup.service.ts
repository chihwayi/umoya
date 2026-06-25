import { Injectable } from '@nestjs/common';

// Bayley-III composite score <85 = 1 SD below mean = significant delay
const BAYLEY_THRESHOLD = 85;

@Injectable()
export class NicuFollowupService {

  async enrollPatient(db: any, enrolledBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO nicu_followup_register
         (patient_id, nicu_admission_id, discharge_date, gestational_age_weeks,
          birth_weight_g, discharge_weight_g, risk_tier, primary_diagnosis, enrolled_by)
       VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (patient_id) DO UPDATE SET is_active=TRUE
       RETURNING *`,
      [
        body.patientId, body.nicuAdmissionId ?? null, body.dischargeDate,
        body.gestationalAgeWeeks, body.birthWeightG, body.dischargeWeightG ?? null,
        body.riskTier ?? 'high', body.primaryDiagnosis ?? null, enrolledBy,
      ],
    );
    return rows[0] ?? null;
  }

  async getRegister(db: any): Promise<any[]> {
    return db.query(
      `SELECT nfr.*, p.first_name, p.last_name, p.date_of_birth,
              ca.corrected_age_months, ca.corrected_age_days
       FROM nicu_followup_register nfr
       JOIN patients p ON p.id = nfr.patient_id
       LEFT JOIN nicu_corrected_ages ca ON ca.patient_id = nfr.patient_id
       WHERE nfr.is_active = TRUE
       ORDER BY ca.corrected_age_months ASC`,
    );
  }

  async getCorrectedAge(db: any, patientId: string): Promise<any> {
    const rows = await db.query(
      `SELECT * FROM nicu_corrected_ages WHERE patient_id=$1`,
      [patientId],
    );
    return rows[0] ?? null;
  }

  async recordVisit(db: any, seenBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO nicu_followup_visits
         (register_id, patient_id, visit_date, corrected_age_months, weight_g, length_cm,
          head_circ_cm, feeding_type, developmental_concerns, vision_concern, hearing_concern,
          next_visit_due, seen_by, notes)
       VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11,$12::date,$13,$14)
       RETURNING *`,
      [
        body.registerId, body.patientId,
        body.visitDate ?? new Date().toISOString().slice(0, 10),
        body.correctedAgeMonths ?? null, body.weightG ?? null, body.lengthCm ?? null,
        body.headCircCm ?? null, body.feedingType ?? null,
        body.developmentalConcerns ?? null, body.visionConcern ?? false,
        body.hearingConcern ?? false, body.nextVisitDue ?? null, seenBy, body.notes ?? null,
      ],
    );
    return rows[0] ?? null;
  }

  async recordBayley(db: any, assessedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO bayley_assessments
         (patient_id, register_id, assessed_at, corrected_age_months, cognitive_composite,
          language_composite, motor_composite, receptive_comm_ss, expressive_comm_ss,
          fine_motor_ss, gross_motor_ss, assessed_by, referral_type, notes)
       VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *, cognitive_delay, language_delay, motor_delay, any_significant_delay`,
      [
        body.patientId, body.registerId,
        body.assessedAt ?? new Date().toISOString().slice(0, 10),
        body.correctedAgeMonths, body.cognitiveComposite ?? null,
        body.languageComposite ?? null, body.motorComposite ?? null,
        body.receptiveCommSs ?? null, body.expressiveCommSs ?? null,
        body.fineMotorSs ?? null, body.grossMotorSs ?? null,
        assessedBy, body.referralType ?? null, body.notes ?? null,
      ],
    );
    const result = rows[0];
    const alerts: string[] = [];
    if (result?.cognitive_delay) alerts.push(`Cognitive composite ${body.cognitiveComposite} <${BAYLEY_THRESHOLD} — significant delay. Early intervention referral required.`);
    if (result?.language_delay)  alerts.push(`Language composite ${body.languageComposite} <${BAYLEY_THRESHOLD} — speech-language therapy referral required.`);
    if (result?.motor_delay)     alerts.push(`Motor composite ${body.motorComposite} <${BAYLEY_THRESHOLD} — physiotherapy/OT referral required.`);
    return { ...result, cdss_alerts: alerts };
  }

  async getBayleyHistory(db: any, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT *, any_significant_delay FROM bayley_assessments WHERE patient_id=$1 ORDER BY assessed_at ASC`,
      [patientId],
    );
  }

  async recordRop(db: any, screenedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO rop_records
         (patient_id, admission_id, screening_date, right_eye_zone, right_eye_stage,
          right_plus_disease, left_eye_zone, left_eye_stage, left_plus_disease,
          next_screen_due, screened_by, notes)
       VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10::date,$11,$12)
       RETURNING *, treatment_required`,
      [
        body.patientId, body.admissionId ?? null,
        body.screeningDate ?? new Date().toISOString().slice(0, 10),
        body.rightEyeZone ?? null, body.rightEyeStage ?? null,
        body.rightPlusDisease ?? false, body.leftEyeZone ?? null,
        body.leftEyeStage ?? null, body.leftPlusDisease ?? false,
        body.nextScreenDue ?? null, screenedBy, body.notes ?? null,
      ],
    );
    const result = rows[0];
    return {
      ...result,
      cdss_alert: result?.treatment_required
        ? `⚠ ROP TREATMENT REQUIRED: Stage ≥3 in zone 1/2 or plus disease identified. Urgent ophthalmology referral for laser/anti-VEGF within 48 hours.`
        : null,
    };
  }

  async getRopPendingScreening(db: any): Promise<any[]> {
    return db.query(
      `SELECT rr.*, p.first_name, p.last_name
       FROM rop_records rr
       JOIN patients p ON p.id = rr.patient_id
       WHERE rr.next_screen_due IS NOT NULL AND rr.next_screen_due <= CURRENT_DATE + INTERVAL '3 days'
       ORDER BY rr.next_screen_due ASC`,
    );
  }

  async recordHie(db: any, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO hie_records
         (patient_id, admission_id, sarnat_grade, cooling_initiated,
          cooling_start_hours_of_life, amplitude_eeg_performed, amplitude_eeg_result,
          mri_performed, mri_date, mri_result, mri_classification)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::date,$10,$11)
       RETURNING *`,
      [
        body.patientId, body.admissionId ?? null, body.sarnatGrade,
        body.coolingInitiated ?? false, body.coolingStartHoursOfLife ?? null,
        body.amplitudeEegPerformed ?? false, body.amplitudeEegResult ?? null,
        body.mriPerformed ?? false, body.mriDate ?? null,
        body.mriResult ?? null, body.mriClassification ?? null,
      ],
    );
    const result = rows[0];
    return {
      ...result,
      cdss_alert: body.sarnatGrade >= 2 && !body.coolingInitiated
        ? `⚠ HIE Grade ${body.sarnatGrade}: Therapeutic hypothermia (cooling) indicated if ≤6 hours of life. Initiate immediately if criteria met and not already done.`
        : null,
    };
  }

  async recordHieOutcome(db: any, id: string, body: { outcome: string; assessedAt?: string }): Promise<any> {
    const rows = await db.query(
      `UPDATE hie_records SET neurodevelopmental_outcome=$1, outcome_assessed_at=$2::date WHERE id=$3 RETURNING *`,
      [body.outcome, body.assessedAt ?? new Date().toISOString().slice(0, 10), id],
    );
    return rows[0] ?? null;
  }
}
