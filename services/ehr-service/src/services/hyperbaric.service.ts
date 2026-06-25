import { Injectable } from '@nestjs/common';

@Injectable()
export class HyperbaricService {

  async createCourse(db: any, prescribingPhysician: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO hbot_courses (patient_id, indication, indication_category, prescribed_sessions, target_ata, o2_pct, session_minutes, prescribing_physician)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [body.patientId, body.indication, body.indicationCategory, body.prescribedSessions ?? 20, body.targetAta ?? 2.4, body.o2Pct ?? 100, body.sessionMinutes ?? 90, prescribingPhysician],
    );
    return rows[0] ?? null;
  }

  async getActiveCourses(db: any): Promise<any[]> {
    return db.query(
      `SELECT hc.*, p.first_name, p.last_name,
              hc.prescribed_sessions - hc.completed_sessions AS remaining_sessions
       FROM hbot_courses hc
       JOIN patients p ON p.id = hc.patient_id
       WHERE hc.status = 'active'
       ORDER BY hc.start_date ASC`,
    );
  }

  async screenContraindications(db: any, screenedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO hbot_contraindication_screens (course_id, untreated_pneumothorax, bleomycin_use, cisplatin_use, doxorubicin_concurrent, disulfiram_use, severe_copd, claustrophobia_severe, pregnancy, viral_urti_active, screened_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *, has_absolute_contraindication, has_relative_contraindication`,
      [body.courseId, body.untreatedPneumothorax ?? false, body.bleomycinUse ?? false, body.cisplatinUse ?? false, body.doxorubicinConcurrent ?? false, body.disulfiramUse ?? false, body.severeCopd ?? false, body.claustrophobiaSevere ?? false, body.pregnancy ?? false, body.viralUrtiActive ?? false, screenedBy],
    );
    const result = rows[0];
    const alerts: string[] = [];
    if (result?.has_absolute_contraindication) {
      alerts.push('ABSOLUTE CONTRAINDICATION identified. HBOT session CANNOT proceed. Notify prescribing physician immediately.');
    }
    if (result?.has_relative_contraindication) {
      alerts.push('RELATIVE CONTRAINDICATION: Requires senior physician review before proceeding. Document risk-benefit discussion.');
    }
    if (body.viralUrtiActive) {
      alerts.push('Active URTI noted. Ear/sinus barotrauma risk increased. Consider postponing session until resolved.');
    }
    return { ...result, cdss_alerts: alerts, cleared_to_proceed: result?.has_absolute_contraindication === false };
  }

  async startSession(db: any, nurseId: string, body: any): Promise<any> {
    const now = new Date();
    const startTime = now.toTimeString().slice(0, 5);
    const rows = await db.query(
      `INSERT INTO hbot_sessions (course_id, chamber_id, session_number, start_time, pre_spo2, pre_bp_systolic, pre_bp_diastolic, nurse_id)
       VALUES ($1,$2,$3,$4::time,$5,$6,$7,$8) RETURNING *`,
      [body.courseId, body.chamberId, body.sessionNumber, startTime, body.preSpo2 ?? null, body.preBpSystolic ?? null, body.preBpDiastolic ?? null, nurseId],
    );
    return rows[0] ?? null;
  }

  async completeSession(db: any, id: string, body: any): Promise<any> {
    const now = new Date();
    const endTime = now.toTimeString().slice(0, 5);
    const rows = await db.query(
      `UPDATE hbot_sessions SET end_time=$1::time, actual_ata=$2, o2_pct=$3, air_breaks=$4, post_spo2=$5, ear_clearance=$6, completed=TRUE, notes=$7
       WHERE id=$8 RETURNING *, duration_mins`,
      [endTime, body.actualAta ?? null, body.o2Pct ?? null, body.airBreaks ?? 0, body.postSpo2 ?? null, body.earClearance ?? null, body.notes ?? null, id],
    );
    const result = rows[0];
    if (result) {
      await db.query(
        `UPDATE hbot_courses SET completed_sessions = completed_sessions + 1 WHERE id = (SELECT course_id FROM hbot_sessions WHERE id=$1)`,
        [id],
      );
    }
    return result ?? null;
  }

  async recordWoundProgress(db: any, recordedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO hbot_wound_progress (course_id, session_number, measured_at, wound_length_cm, wound_width_cm, wound_depth_cm, granulation_pct, epithelialisation_pct, slough_pct, exudate_level, photo_ref, recorded_by)
       VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *, wound_area_cm2`,
      [body.courseId, body.sessionNumber, body.measuredAt ?? new Date().toISOString().slice(0, 10), body.woundLengthCm ?? null, body.woundWidthCm ?? null, body.woundDepthCm ?? null, body.granulationPct ?? null, body.epithelisationPct ?? null, body.sloughPct ?? null, body.exudateLevel ?? null, body.photoRef ?? null, recordedBy],
    );
    return rows[0] ?? null;
  }

  async getWoundTrend(db: any, courseId: string): Promise<any[]> {
    return db.query(
      `SELECT *, wound_area_cm2 FROM hbot_wound_progress WHERE course_id=$1 ORDER BY session_number ASC`,
      [courseId],
    );
  }

  async recordOutcome(db: any, id: string, body: any): Promise<any> {
    const rows = await db.query(
      `UPDATE hbot_courses SET outcome=$1, status=COALESCE($2, status), end_date=COALESCE(end_date, CURRENT_DATE)
       WHERE id=$3 RETURNING *`,
      [body.outcome, body.status ?? null, id],
    );
    return rows[0] ?? null;
  }
}
