import { Injectable } from '@nestjs/common';

// AAP 2011 CCHD pulse-oximetry algorithm
function interpretCchd(rightHandSpo2: number, footSpo2: number, attempt: number): string {
  if (rightHandSpo2 < 90 || footSpo2 < 90) {
    return 'URGENT: SpO₂ <90%. Immediate paediatric/cardiology evaluation. Rule out CCHD, sepsis, respiratory failure.';
  }
  if (rightHandSpo2 >= 95 && footSpo2 >= 95 && Math.abs(rightHandSpo2 - footSpo2) <= 3) {
    return 'CCHD screen PASSED. No further action required.';
  }
  if (attempt >= 3) {
    return '3 consecutive failed attempts. Echocardiography and paediatric cardiology referral required.';
  }
  return `Attempt ${attempt} failed. Repeat in 1 hour. 3 consecutive fails requires cardiac evaluation.`;
}

@Injectable()
export class NeonatalScreeningService {

  async createNbsBatch(db: any, createdBy: string, body: any): Promise<any> {
    const ref = `NBS-${Date.now().toString(36).toUpperCase()}`;
    const rows = await db.query(
      `INSERT INTO nbs_batches (batch_ref, lab_name, created_by) VALUES ($1,$2,$3) RETURNING *`,
      [ref, body.labName ?? 'NSSA / MOHCC NBS Laboratory', createdBy],
    );
    return rows[0] ?? null;
  }

  async addNbsSample(db: any, collectedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO nbs_samples (batch_id, patient_id, admission_id, card_number, age_at_collection_hours, collected_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [body.batchId, body.patientId, body.admissionId ?? null, body.cardNumber, body.ageAtCollectionHours ?? null, collectedBy],
    );
    await db.query(`UPDATE nbs_batches SET sample_count = sample_count + 1 WHERE id=$1`, [body.batchId]);
    return rows[0] ?? null;
  }

  async recordNbsResults(db: any, id: string, body: any): Promise<any> {
    const rows = await db.query(
      `UPDATE nbs_samples SET
         tsh_result=$1, pku_result=$2, g6pd_result=$3, scd_result=$4, scd_abnormal=$5, result_status=$6
       WHERE id=$7 RETURNING *, tsh_abnormal, pku_abnormal, any_abnormal`,
      [body.tshResult ?? null, body.pkuResult ?? null, body.g6pdResult ?? null, body.scdResult ?? null, body.scdAbnormal ?? false, body.resultStatus, id],
    );
    const result = rows[0];
    return {
      ...result,
      cdss_alert: result?.any_abnormal
        ? '⚠ ABNORMAL NBS RESULT: Immediate escalation required. Notify paediatric team. Do not wait for symptoms.'
        : null,
    };
  }

  async getAbnormalNbsResults(db: any): Promise<any[]> {
    return db.query(
      `SELECT ns.*, p.first_name, p.last_name, p.date_of_birth, b.batch_ref
       FROM nbs_samples ns
       JOIN patients p ON p.id = ns.patient_id
       JOIN nbs_batches b ON b.id = ns.batch_id
       WHERE ns.any_abnormal = TRUE AND ns.notified = FALSE
       ORDER BY ns.created_at DESC`,
    );
  }

  async recordHearingScreen(db: any, screenedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO hearing_screening_records (patient_id, method, left_ear_result, right_ear_result, screened_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *, overall_result, requires_abr`,
      [body.patientId, body.method ?? 'aoae', body.leftEarResult, body.rightEarResult, screenedBy, body.notes ?? null],
    );
    const result = rows[0];
    return {
      ...result,
      cdss_alert: result?.requires_abr
        ? `Hearing screen: ${result.overall_result?.replace(/_/g, ' ')}. ABR referral required. Schedule within 3 months.`
        : null,
    };
  }

  async getPendingAbrReferrals(db: any): Promise<any[]> {
    return db.query(
      `SELECT hs.*, p.first_name, p.last_name
       FROM hearing_screening_records hs
       JOIN patients p ON p.id = hs.patient_id
       WHERE hs.requires_abr = TRUE AND hs.abr_scheduled = FALSE
       ORDER BY hs.screened_at ASC`,
    );
  }

  async recordCchdScreen(db: any, screenedBy: string, body: any): Promise<any> {
    const attempt = body.attemptNumber ?? 1;
    const action = interpretCchd(body.rightHandSpo2, body.footSpo2, attempt);
    const rows = await db.query(
      `INSERT INTO cchd_screening_records (patient_id, age_at_screen_hours, attempt_number, right_hand_spo2, foot_spo2, screened_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *, screen_result, differential`,
      [body.patientId, body.ageAtScreenHours, attempt, body.rightHandSpo2, body.footSpo2, screenedBy],
    );
    return { ...rows[0], cdss_alert: action };
  }

  async getCoverage(db: any): Promise<any[]> {
    return db.query(`SELECT * FROM neo_screening_coverage LIMIT 12`);
  }

  async getPatientScreeningSummary(db: any, patientId: string): Promise<any> {
    const [nbs, hearing, cchd] = await Promise.all([
      db.query(`SELECT * FROM nbs_samples WHERE patient_id=$1 ORDER BY created_at DESC LIMIT 1`, [patientId]),
      db.query(`SELECT *, overall_result, requires_abr FROM hearing_screening_records WHERE patient_id=$1 ORDER BY screened_at DESC LIMIT 1`, [patientId]),
      db.query(`SELECT *, screen_result, differential FROM cchd_screening_records WHERE patient_id=$1 ORDER BY screened_at DESC LIMIT 1`, [patientId]),
    ]);
    return { nbs: nbs[0] ?? null, hearing: hearing[0] ?? null, cchd: cchd[0] ?? null };
  }
}
