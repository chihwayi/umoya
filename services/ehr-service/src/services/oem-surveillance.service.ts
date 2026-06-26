import { Injectable } from '@nestjs/common';

@Injectable()
export class OemSurveillanceService {

  async createHazardProfile(db: any, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO oem_hazard_profiles (employer_id, job_title, hazard_type, agent_name, exposure_limit, monitoring_interval_months, surveillance_tests)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING *`,
      [body.employerId, body.jobTitle, body.hazardType, body.agentName, body.exposureLimit ?? null, body.monitoringIntervalMonths ?? 12, JSON.stringify(body.surveillanceTests ?? [])],
    );
    return rows[0] ?? null;
  }

  async getHazardProfiles(db: any, employerId: string): Promise<any[]> {
    return db.query(`SELECT * FROM oem_hazard_profiles WHERE employer_id=$1 ORDER BY job_title`, [employerId]);
  }

  async recordExposure(db: any, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO oem_exposure_records (encounter_id, employee_id, employer_id, hazard_type, agent_name, exposure_route, duration_years, twa_value, twa_unit, oel_value, oel_unit, ppe_used, ppe_details)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *, exceeds_oel`,
      [body.encounterId, body.employeeId, body.employerId, body.hazardType, body.agentName, body.exposureRoute ?? null, body.durationYears ?? null, body.twaValue ?? null, body.twaUnit ?? null, body.oelValue ?? null, body.oelUnit ?? null, body.ppeUsed ?? false, body.ppeDetails ?? null],
    );
    const result = rows[0];
    const alert = result?.exceeds_oel
      ? `⚠ OVEREXPOSURE: ${result.agent_name} TWA (${result.twa_value} ${result.twa_unit}) exceeds OEL (${result.oel_value} ${result.oel_unit}). Immediate engineering control review required.`
      : null;
    return { ...result, cdss_alert: alert };
  }

  async getExposureRecords(db: any, encounterId: string): Promise<any[]> {
    return db.query(`SELECT * FROM oem_exposure_records WHERE encounter_id=$1 ORDER BY recorded_at`, [encounterId]);
  }

  async recordBioMonitoring(db: any, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO oem_biological_monitoring (encounter_id, patient_id, test_type, result_value, result_unit, biological_exposure_index_value, bei_unit, lab_ref, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *, exceeds_bei`,
      [body.encounterId ?? null, body.patientId, body.testType, body.resultValue ?? null, body.resultUnit ?? null, body.beiValue ?? null, body.beiUnit ?? null, body.labRef ?? null, body.notes ?? null],
    );
    const result = rows[0];
    return {
      ...result,
      cdss_alert: result?.exceeds_bei
        ? `⚠ BEI EXCEEDED: ${result.test_type} result (${result.result_value} ${result.result_unit}) exceeds biological exposure index (${result.biological_exposure_index_value} ${result.bei_unit}). Reduce exposure, review job controls.`
        : null,
    };
  }

  async getBioMonitoring(db: any, patientId: string): Promise<any[]> {
    return db.query(`SELECT * FROM oem_biological_monitoring WHERE patient_id=$1 ORDER BY collected_at DESC`, [patientId]);
  }

  async scheduleSurveillance(db: any, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO oem_surveillance_schedule (patient_id, employer_id, hazard_profile_id, surveillance_type, due_date)
       VALUES ($1,$2,$3,$4,$5::date) RETURNING *`,
      [body.patientId, body.employerId, body.hazardProfileId ?? null, body.surveillanceType, body.dueDate],
    );
    return rows[0] ?? null;
  }

  async getOverdueSurveillance(db: any): Promise<any[]> {
    return db.query(
      `SELECT oss.*,
              p.first_name, p.last_name,
              e.name AS company_name,
              (CURRENT_DATE - oss.due_date)::INT AS days_overdue
       FROM oem_surveillance_schedule oss
       JOIN patients p ON p.id = oss.patient_id
       JOIN oem_employers e ON e.id = oss.employer_id
       WHERE oss.completed_date IS NULL AND oss.due_date < CURRENT_DATE
       ORDER BY oss.due_date ASC`,
    );
  }

  async markSurveillanceComplete(db: any, id: string): Promise<any> {
    const rows = await db.query(
      `UPDATE oem_surveillance_schedule SET completed_date=CURRENT_DATE WHERE id=$1 RETURNING *`,
      [id],
    );
    return rows[0] ?? null;
  }

  async createRtwPlan(db: any, clinicianId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO oem_rtw_plans (patient_id, employer_id, encounter_id, injury_illness, restrictions, graded_schedule, target_rtw_date, notes, clinician_id)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::date,$8,$9) RETURNING *`,
      [body.patientId, body.employerId, body.encounterId ?? null, body.injuryIllness, JSON.stringify(body.restrictions ?? []), JSON.stringify(body.gradedSchedule ?? []), body.targetRtwDate ?? null, body.notes ?? null, clinicianId],
    );
    return rows[0] ?? null;
  }

  async getPatientRtwPlans(db: any, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT rp.*, e.name AS company_name
       FROM oem_rtw_plans rp
       JOIN oem_employers e ON e.id = rp.employer_id
       WHERE rp.patient_id=$1 ORDER BY rp.plan_date DESC`,
      [patientId],
    );
  }

  async employerSignRtw(db: any, id: string): Promise<any> {
    const rows = await db.query(
      `UPDATE oem_rtw_plans SET employer_signed=TRUE, employer_signed_at=NOW() WHERE id=$1 RETURNING *`,
      [id],
    );
    return rows[0] ?? null;
  }

  async updateRtwStatus(db: any, id: string, status: string): Promise<any> {
    const rows = await db.query(
      `UPDATE oem_rtw_plans SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [status, id],
    );
    return rows[0] ?? null;
  }
}
