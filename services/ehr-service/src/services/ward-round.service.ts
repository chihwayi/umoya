import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class WardRoundService {
  private readonly logger = new Logger(WardRoundService.name);

  async getInpatientCensus(db: DataSource, doctorId?: string): Promise<any[]> {
    const params: any[] = [];
    const doctorFilter = doctorId
      ? `AND ia.current_doctor_id = $${params.push(doctorId)}`
      : '';
    return db.query(
      `SELECT
         ia.id AS admission_id, ia.admitted_at, ia.status,
         wb.ward_name, wb.bay_name, wb.bed_code,
         p.id AS patient_id, p.first_name, p.last_name, p.date_of_birth,
         p.latest_risk_score, p.latest_risk_level,
         (SELECT jsonb_build_object(
            'bp_systolic', MAX(v.bp_systolic),
            'pulse_bpm', MAX(v.pulse_bpm),
            'temperature_c', MAX(v.temperature_c),
            'spo2_pct', MAX(v.spo2_pct)
          )
          FROM vitals v
          WHERE v.patient_id = p.id AND v.recorded_at > now() - interval '24 hours'
         ) AS latest_vitals,
         (SELECT wrn.plan FROM ward_round_notes wrn
          WHERE wrn.admission_id = ia.id
          ORDER BY wrn.created_at DESC LIMIT 1) AS last_plan
       FROM inpatient_admissions ia
       JOIN patients p ON p.id = ia.patient_id
       LEFT JOIN ward_beds wb ON wb.id = ia.bed_id
       WHERE ia.status = 'admitted' ${doctorFilter}
       ORDER BY wb.ward_name, wb.bay_name, wb.bed_code`,
      params,
    );
  }

  async saveRoundNote(
    db: DataSource,
    admissionId: string,
    encounterId: string,
    clinicianId: string,
    payload: { subjective?: string; objective?: string; assessment?: string; plan?: string; dictationRaw?: string },
  ): Promise<string> {
    const [existing] = await db.query(
      `SELECT id FROM ward_round_notes
       WHERE admission_id = $1 AND clinician_id = $2 AND note_date = CURRENT_DATE`,
      [admissionId, clinicianId],
    );

    if (existing) {
      await db.query(
        `UPDATE ward_round_notes
         SET subjective = $1, objective = $2, assessment = $3, plan = $4,
             dictation_raw = COALESCE($5, dictation_raw), updated_at = now()
         WHERE id = $6`,
        [payload.subjective ?? null, payload.objective ?? null,
         payload.assessment ?? null, payload.plan ?? null,
         payload.dictationRaw ?? null, existing.id],
      );
      return existing.id;
    }

    const [row] = await db.query(
      `INSERT INTO ward_round_notes
         (admission_id, encounter_id, clinician_id, subjective, objective, assessment, plan, dictation_raw)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [admissionId, encounterId, clinicianId,
       payload.subjective ?? null, payload.objective ?? null,
       payload.assessment ?? null, payload.plan ?? null,
       payload.dictationRaw ?? null],
    );
    return row.id;
  }

  async createOrder(
    db: DataSource,
    admissionId: string,
    encounterId: string,
    orderedBy: string,
    payload: {
      orderType: 'medication' | 'lab' | 'imaging' | 'nursing';
      drugName?: string;
      dose?: string;
      route?: string;
      frequency?: string;
      durationDays?: number;
      testName?: string;
      taskDescription?: string;
      priority?: string;
      notes?: string;
    },
  ): Promise<string> {
    const [row] = await db.query(
      `INSERT INTO ward_orders
         (admission_id, encounter_id, ordered_by, order_type,
          drug_name, dose, route, frequency, duration_days,
          test_name, task_description, priority, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id`,
      [admissionId, encounterId, orderedBy, payload.orderType,
       payload.drugName ?? null, payload.dose ?? null,
       payload.route ?? null, payload.frequency ?? null,
       payload.durationDays ?? null, payload.testName ?? null,
       payload.taskDescription ?? null, payload.priority ?? 'routine',
       payload.notes ?? null],
    );
    this.logger.log(`Ward order created: type=${payload.orderType} admission=${admissionId}`);
    return row.id;
  }

  async getAdmissionOrders(db: DataSource, admissionId: string): Promise<any[]> {
    return db.query(
      `SELECT wo.*, u.first_name || ' ' || u.last_name AS ordered_by_name
       FROM ward_orders wo
       LEFT JOIN users u ON u.id = wo.ordered_by
       WHERE wo.admission_id = $1
       ORDER BY wo.ordered_at DESC`,
      [admissionId],
    );
  }

  async getRoundNotes(db: DataSource, admissionId: string): Promise<any[]> {
    return db.query(
      `SELECT wrn.*, u.first_name || ' ' || u.last_name AS clinician_name
       FROM ward_round_notes wrn
       LEFT JOIN users u ON u.id = wrn.clinician_id
       WHERE wrn.admission_id = $1
       ORDER BY wrn.note_date DESC, wrn.created_at DESC`,
      [admissionId],
    );
  }

  async admitPatient(
    db: DataSource,
    patientId: string,
    encounterId: string,
    bedId: string,
    admittingDoctorId: string,
    notes?: string,
  ): Promise<string> {
    const [row] = await db.query(
      `INSERT INTO inpatient_admissions
         (patient_id, encounter_id, bed_id, admitting_doctor_id, current_doctor_id, admission_notes)
       VALUES ($1,$2,$3,$4,$4,$5)
       RETURNING id`,
      [patientId, encounterId, bedId, admittingDoctorId, notes ?? null],
    );
    return row.id;
  }

  async dischargePatient(db: DataSource, admissionId: string): Promise<void> {
    await db.query(
      `UPDATE inpatient_admissions
       SET status = 'discharged', discharged_at = now()
       WHERE id = $1`,
      [admissionId],
    );
  }
}
