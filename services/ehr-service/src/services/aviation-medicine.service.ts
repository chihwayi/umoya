import { Injectable } from '@nestjs/common';

@Injectable()
export class AviationMedicineService {

  async registerApplicant(db: any, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO aviation_applicants (patient_id, licence_type, class_required, caaz_licence_number, total_flight_hours)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (patient_id) DO UPDATE SET licence_type=$2, class_required=$3 RETURNING *`,
      [body.patientId, body.licenceType, body.classRequired, body.caazLicenceNumber ?? null, body.totalFlightHours ?? null],
    );
    return rows[0] ?? null;
  }

  async getApplicants(db: any): Promise<any[]> {
    return db.query(
      `SELECT aa.*, p.first_name, p.last_name, p.date_of_birth
       FROM aviation_applicants aa
       JOIN patients p ON p.id = aa.patient_id
       WHERE aa.is_active ORDER BY p.last_name`,
    );
  }

  async createExamination(db: any, ameUserId: string, body: any): Promise<any> {
    const ameRows = await db.query(`SELECT id FROM ame_examiners WHERE user_id=$1 LIMIT 1`, [ameUserId]);
    if (!ameRows[0]) throw new Error('Current user is not registered as an AME.');
    const ameId = ameRows[0].id;

    const rows = await db.query(
      `INSERT INTO aviation_examinations (
         applicant_id, ame_id, exam_class, exam_type,
         height_cm, weight_kg, bp_systolic, bp_diastolic, resting_hr,
         vision_meets_standard, hearing_meets_standard,
         colour_vision, ecg_performed, ecg_result,
         fev1_percent, fvc_percent, spirometry_normal,
         no_disqualifying_neuro, no_disqualifying_psych, no_substance_use, no_medications_disqualifying
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING *, bmi, bp_meets_standard`,
      [body.applicantId, ameId, body.examClass, body.examType ?? 'renewal',
       body.heightCm ?? null, body.weightKg ?? null, body.bpSystolic ?? null, body.bpDiastolic ?? null, body.restingHr ?? null,
       body.visionMeetsStandard ?? null, body.hearingMeetsStandard ?? null,
       body.colourVision ?? null, body.ecgPerformed ?? false, body.ecgResult ?? null,
       body.fev1Percent ?? null, body.fvcPercent ?? null, body.spirometryNormal ?? null,
       body.noDisqualifyingNeuro ?? true, body.noDisqualifyingPsych ?? true, body.noSubstanceUse ?? true, body.noMedicationsDisqualifying ?? true],
    );
    return rows[0] ?? null;
  }

  async recordDecision(db: any, id: string, body: any): Promise<any> {
    const rows = await db.query(
      `UPDATE aviation_examinations SET overall_decision=$1, limitations=$2::jsonb, next_exam_months=$3, examiner_notes=$4
       WHERE id=$5 RETURNING *, bmi, bp_meets_standard`,
      [body.decision, JSON.stringify(body.limitations ?? []), body.nextExamMonths ?? 12, body.notes ?? null, id],
    );
    const result = rows[0];
    const alerts: string[] = [];
    if (!result.bp_meets_standard) alerts.push(`Blood pressure ${result.bp_systolic}/${result.bp_diastolic} mmHg exceeds ICAO Class 1 standard (≤160/95). Certificate cannot be issued.`);
    if (!result.vision_meets_standard) alerts.push('Visual acuity does not meet ICAO standard. Refer to ophthalmology.');
    if (!result.hearing_meets_standard) alerts.push('Hearing does not meet audiometric standard. Refer to audiologist.');
    return { ...result, cdss_alerts: alerts };
  }

  async issueCertificate(db: any, issuedBy: string, body: any): Promise<any> {
    const certNumber = `ZW-CAA-${Date.now().toString(36).toUpperCase()}`;
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + (body.validityMonths ?? 12));

    const rows = await db.query(
      `INSERT INTO aviation_certificates (examination_id, applicant_id, cert_number, cert_class, expiry_date, limitations_text, issued_by)
       VALUES ($1,$2,$3,$4,$5::date,$6,$7) RETURNING *, is_valid, days_to_expiry`,
      [body.examinationId, body.applicantId, certNumber, body.certClass, expiryDate.toISOString().slice(0, 10), body.limitationsText ?? null, issuedBy],
    );
    await db.query(`UPDATE aviation_applicants SET next_medical_due=$1 WHERE id=$2`, [expiryDate.toISOString().slice(0, 10), body.applicantId]);
    return rows[0] ?? null;
  }

  async getCertificates(db: any, applicantId: string): Promise<any[]> {
    return db.query(
      `SELECT *, is_valid, days_to_expiry FROM aviation_certificates WHERE applicant_id=$1 AND voided=FALSE ORDER BY issued_date DESC`,
      [applicantId],
    );
  }

  async getExpiringSoon(db: any): Promise<any[]> {
    return db.query(
      `SELECT ac.*, p.first_name, p.last_name, aa.licence_type
       FROM aviation_certificates ac
       JOIN aviation_applicants aa ON aa.id = ac.applicant_id
       JOIN patients p ON p.id = aa.patient_id
       WHERE ac.voided=FALSE AND ac.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
       ORDER BY ac.expiry_date ASC`,
    );
  }

  async recordWaiver(db: any, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO aviation_waivers (applicant_id, condition_code, condition_desc, waiver_requested, notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [body.applicantId, body.conditionCode, body.conditionDesc, body.waiverRequested ?? true, body.notes ?? null],
    );
    return rows[0] ?? null;
  }
}
