import { Injectable } from '@nestjs/common';

const K_LEVEL_DESCRIPTIONS: Record<number, string> = {
  0: 'K0 — No potential to ambulate or transfer. Prosthesis does not enhance quality of life.',
  1: 'K1 — Limited household ambulator. Fixed cadence, level surfaces.',
  2: 'K2 — Limited community ambulator. Traverses low-level environmental barriers.',
  3: 'K3 — Community ambulator. Variable cadence, traverses most barriers.',
  4: 'K4 — High activity. Exceeds basic ambulation, prosthetic limb demands beyond community.',
};

@Injectable()
export class ProstheticsService {

  async registerAmputee(db: any, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO amputee_register (patient_id, amputation_date, amputation_level, laterality, aetiology, residual_limb_length, skin_condition, phantom_pain, residual_pain, referral_source, notes)
       VALUES ($1,$2::date,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (patient_id) DO UPDATE SET amputation_level=$3, laterality=$4, aetiology=$5
       RETURNING *`,
      [body.patientId, body.amputationDate ?? null, body.amputationLevel, body.laterality, body.aetiology, body.residualLimbLength ?? null, body.skinCondition ?? null, body.phantomPain ?? false, body.residualPain ?? false, body.referralSource ?? null, body.notes ?? null],
    );
    return rows[0] ?? null;
  }

  async getAmputeeRegister(db: any): Promise<any[]> {
    return db.query(
      `SELECT ar.*, p.first_name, p.last_name, p.date_of_birth
       FROM amputee_register ar
       JOIN patients p ON p.id = ar.patient_id
       ORDER BY p.last_name, p.first_name`,
    );
  }

  async updateKLevel(db: any, patientId: string, kLevel: number): Promise<any> {
    const rows = await db.query(
      `UPDATE amputee_register SET k_level=$1, k_assessed_date=CURRENT_DATE WHERE patient_id=$2 RETURNING *`,
      [kLevel, patientId],
    );
    const result = rows[0];
    return { ...result, k_description: K_LEVEL_DESCRIPTIONS[kLevel] };
  }

  async prescribeDevice(db: any, prosthetistId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO prosthetic_prescriptions (patient_id, device_category, device_type, socket_type, suspension_system, knee_component, foot_ankle_component, liner_type, prescribed_k_level, cost_usd, notes, prosthetist_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [body.patientId, body.deviceCategory, body.deviceType, body.socketType ?? null, body.suspensionSystem ?? null, body.kneeComponent ?? null, body.footAnkleComponent ?? null, body.linerType ?? null, body.prescribedKLevel ?? null, body.costUsd ?? null, body.notes ?? null, prosthetistId],
    );
    return rows[0] ?? null;
  }

  async getPatientPrescriptions(db: any, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT * FROM prosthetic_prescriptions WHERE patient_id=$1 ORDER BY prescribed_date DESC`,
      [patientId],
    );
  }

  async updateDeviceStatus(db: any, id: string, body: any): Promise<any> {
    const rows = await db.query(
      `UPDATE prosthetic_prescriptions SET status=$1, delivery_date=COALESCE($2::date, delivery_date) WHERE id=$3 RETURNING *`,
      [body.status, body.deliveryDate ?? null, id],
    );
    return rows[0] ?? null;
  }

  async startRehabEpisode(db: any, therapistId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO prosthetic_rehab_episodes (patient_id, prescription_id, total_sessions_planned, goals, therapist_id)
       VALUES ($1,$2,$3,$4::jsonb,$5) RETURNING *`,
      [body.patientId, body.prescriptionId ?? null, body.totalSessionsPlanned ?? 20, JSON.stringify(body.goals ?? []), therapistId],
    );
    return rows[0] ?? null;
  }

  async recordOutcome(db: any, recordedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO prosthetic_outcomes (episode_id, patient_id, measured_at, tug_seconds, six_mwt_metres, amp_pro_score, satisfaction_score, daily_wear_hours, gait_deviation, recorded_by)
       VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [body.episodeId, body.patientId, body.measuredAt ?? new Date().toISOString().slice(0, 10), body.tugSeconds ?? null, body.sixMwtMetres ?? null, body.ampProScore ?? null, body.satisfactionScore ?? null, body.dailyWearHours ?? null, body.gaitDeviation ?? null, recordedBy],
    );
    return rows[0] ?? null;
  }

  async getOutcomes(db: any, episodeId: string): Promise<any[]> {
    return db.query(
      `SELECT * FROM prosthetic_outcomes WHERE episode_id=$1 ORDER BY measured_at ASC`,
      [episodeId],
    );
  }
}
