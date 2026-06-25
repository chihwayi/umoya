import { Injectable } from '@nestjs/common';

@Injectable()
export class OccupationalMedicineService {

  async listEmployers(db: any, activeOnly = true): Promise<any[]> {
    const rows = await db.query(
      `SELECT id, name, industry_sector, nssa_number, contact_person, contact_email, contact_phone, is_active
       FROM oem_employers
       WHERE ($1 = FALSE OR is_active = TRUE)
       ORDER BY name`,
      [activeOnly],
    );
    return rows;
  }

  async createEmployer(db: any, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO oem_employers (name, industry_sector, nssa_number, registration_number, contact_person, contact_email, contact_phone, physical_address, contracted_services, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
       RETURNING *`,
      [body.name, body.industrySector, body.nssaNumber, body.registrationNumber, body.contactPerson, body.contactEmail, body.contactPhone, body.physicalAddress, JSON.stringify(body.contractedServices ?? []), body.notes],
    );
    return rows[0] ?? null;
  }

  async updateEmployer(db: any, id: string, body: any): Promise<any> {
    const rows = await db.query(
      `UPDATE oem_employers SET name=$1, industry_sector=$2, contact_person=$3, contact_email=$4, contact_phone=$5, is_active=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [body.name, body.industrySector, body.contactPerson, body.contactEmail, body.contactPhone, body.isActive ?? true, id],
    );
    return rows[0] ?? null;
  }

  async linkEmployee(db: any, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO oem_employee_links (patient_id, employer_id, job_title, department, hazard_classes, is_current)
       VALUES ($1,$2,$3,$4,$5::jsonb,TRUE)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [body.patientId, body.employerId, body.jobTitle, body.department, JSON.stringify(body.hazardClasses ?? [])],
    );
    return rows[0] ?? null;
  }

  async listEmployeesByEmployer(db: any, employerId: string): Promise<any[]> {
    return db.query(
      `SELECT el.id, el.employee_number, el.job_title, el.department, el.hazard_classes,
              p.first_name, p.last_name, p.date_of_birth, p.gender
       FROM oem_employee_links el
       JOIN patients p ON p.id = el.patient_id
       WHERE el.employer_id = $1 AND el.is_current = TRUE
       ORDER BY p.last_name, p.first_name`,
      [employerId],
    );
  }

  async getPatientEmployers(db: any, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT el.id, el.job_title, el.department, el.hazard_classes, el.is_current, el.start_date,
              e.name AS employer_name, e.industry_sector, e.nssa_number
       FROM oem_employee_links el
       JOIN oem_employers e ON e.id = el.employer_id
       WHERE el.patient_id = $1
       ORDER BY el.is_current DESC, el.start_date DESC`,
      [patientId],
    );
  }

  async createEncounter(db: any, clinicianId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO oem_encounters (patient_id, employer_id, encounter_type, clinician_id, job_title, job_demands,
         bp_systolic, bp_diastolic, pulse, bmi, spirometry_fev1, spirometry_fvc,
         substance_screen_result, restrictions, notes, findings)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
       RETURNING *`,
      [body.patientId, body.employerId, body.encounterType, clinicianId, body.jobTitle, body.jobDemands,
       body.bpSystolic, body.bpDiastolic, body.pulse, body.bmi, body.spirometryFev1, body.spirometryFvc,
       body.substanceScreenResult, body.restrictions, body.notes, JSON.stringify(body.findings ?? {})],
    );
    return rows[0] ?? null;
  }

  async getPatientEncounters(db: any, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT oe.*, e.name AS employer_name
       FROM oem_encounters oe
       JOIN oem_employers e ON e.id = oe.employer_id
       WHERE oe.patient_id = $1
       ORDER BY oe.encounter_date DESC`,
      [patientId],
    );
  }

  async getEmployerEncounters(db: any, employerId: string, encounterType?: string): Promise<any[]> {
    return db.query(
      `SELECT oe.id, oe.encounter_type, oe.encounter_date,
              p.first_name, p.last_name
       FROM oem_encounters oe
       JOIN patients p ON p.id = oe.patient_id
       WHERE oe.employer_id = $1 AND ($2::text IS NULL OR oe.encounter_type = $2)
       ORDER BY oe.encounter_date DESC`,
      [employerId, encounterType ?? null],
    );
  }

  async issueCertificate(db: any, issuedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO oem_certificates (oem_encounter_id, patient_id, employer_id, cert_type, fitness_category, restrictions_detail, valid_from, valid_until, issued_by)
       VALUES ($1,$2,$3,$4,$5,$6,CURRENT_DATE,$7,$8)
       RETURNING *`,
      [body.oemEncounterId, body.patientId, body.employerId, body.certType, body.fitnessCategory, body.restrictionsDetail, body.validUntil ?? null, issuedBy],
    );
    return rows[0] ?? null;
  }

  async getPatientCertificates(db: any, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT oc.*, e.name AS employer_name, u.first_name AS issuer_first, u.last_name AS issuer_last
       FROM oem_certificates oc
       JOIN oem_employers e ON e.id = oc.employer_id
       LEFT JOIN users u ON u.id = oc.issued_by
       WHERE oc.patient_id = $1
       ORDER BY oc.created_at DESC`,
      [patientId],
    );
  }

  async getDashboardSummary(db: any): Promise<any> {
    const [employers, encounters, certs] = await Promise.all([
      db.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_active) AS active FROM oem_employers`),
      db.query(`SELECT encounter_type, COUNT(*) AS cnt FROM oem_encounters WHERE encounter_date >= CURRENT_DATE - 30 GROUP BY encounter_type`),
      db.query(`SELECT fitness_category, COUNT(*) AS cnt FROM oem_certificates WHERE valid_until >= CURRENT_DATE OR valid_until IS NULL GROUP BY fitness_category`),
    ]);
    return {
      employers: employers[0],
      recentEncounters: encounters,
      activeCertificates: certs,
    };
  }
}
