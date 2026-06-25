import { Injectable } from '@nestjs/common';

@Injectable()
export class ImmunisationService {

  async getCatalog(db: any): Promise<any[]> {
    return db.query(`SELECT * FROM vaccine_catalog WHERE is_active ORDER BY min_age_weeks, antigen_code`);
  }

  async recordVaccination(db: any, administeredBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO vaccination_records (patient_id, antigen_code, dose_number, lot_number, expiry_date, site_given, administered_by, notes)
       VALUES ($1,$2,$3,$4,$5::date,$6,$7,$8)
       ON CONFLICT (patient_id, antigen_code, dose_number) DO NOTHING
       RETURNING *`,
      [body.patientId, body.antigenCode, body.doseNumber ?? 1,
       body.lotNumber ?? null, body.expiryDate ?? null,
       body.siteGiven ?? null, administeredBy, body.notes ?? null],
    );
    return rows[0] ?? { conflict: 'Dose already recorded for this patient and antigen.' };
  }

  async getPatientVaccinationRecord(db: any, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT vr.*, vc.antigen_name, vc.route, vc.is_live_vaccine
       FROM vaccination_records vr
       JOIN vaccine_catalog vc ON vc.antigen_code = vr.antigen_code
       WHERE vr.patient_id = $1
       ORDER BY vr.given_at ASC`,
      [patientId],
    );
  }

  async getVaccinationSchedule(db: any, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT vc.antigen_code, vc.antigen_name, vc.doses_required, vc.min_age_weeks, vc.schedule_contacts,
              COALESCE(done.doses_given, 0) AS doses_given,
              vc.doses_required - COALESCE(done.doses_given, 0) AS doses_remaining
       FROM vaccine_catalog vc
       LEFT JOIN (
         SELECT antigen_code, COUNT(*) AS doses_given
         FROM vaccination_records WHERE patient_id=$1 GROUP BY antigen_code
       ) done ON done.antigen_code = vc.antigen_code
       WHERE vc.is_active
       ORDER BY vc.min_age_weeks`,
      [patientId],
    );
  }

  async logColdChain(db: any, recordedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO cold_chain_logs (fridge_id, temp_celsius, recorded_by, notes)
       VALUES ($1,$2,$3,$4) RETURNING *, is_excursion, excursion_type`,
      [body.fridgeId, body.tempCelsius, recordedBy, body.notes ?? null],
    );
    const result = rows[0] ?? null;
    return {
      ...result,
      alert: result?.is_excursion
        ? `COLD CHAIN EXCURSION: ${result.excursion_type === 'heat_excursion'
            ? 'Temperature too HIGH — check fridge immediately and quarantine affected vaccines.'
            : 'FREEZE RISK — live vaccines (OPV, MR, BCG, YF) may be damaged. Perform shake test before use.'}`
        : null,
    };
  }

  async getColdChainExcursions(db: any): Promise<any[]> {
    return db.query(
      `SELECT * FROM cold_chain_logs WHERE is_excursion = TRUE ORDER BY recorded_at DESC LIMIT 50`,
    );
  }

  async reportAefi(db: any, reportedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO aefi_reports (patient_id, vaccination_id, antigen_code, onset_date, classification, aefi_type, description, outcome, reported_by)
       VALUES ($1,$2,$3,$4::date,$5,$6,$7,$8,$9) RETURNING *`,
      [body.patientId, body.vaccinationId ?? null, body.antigenCode, body.onsetDate,
       body.classification, body.aefiType, body.description, body.outcome ?? null, reportedBy],
    );
    return rows[0] ?? null;
  }

  async getCoverage(db: any): Promise<any[]> {
    return db.query(`SELECT * FROM epi_coverage_summary LIMIT 100`);
  }

  async getDefaulters(db: any, daysOverdue: number): Promise<any[]> {
    return db.query(
      `SELECT DISTINCT p.id, p.first_name, p.last_name, p.phone,
              latest_vacc.given_at AS last_vaccination, latest_vacc.antigen_code AS last_antigen
       FROM patients p
       JOIN vaccination_records vr ON vr.patient_id = p.id
       LEFT JOIN LATERAL (
         SELECT given_at, antigen_code FROM vaccination_records
         WHERE patient_id = p.id ORDER BY given_at DESC LIMIT 1
       ) latest_vacc ON TRUE
       WHERE latest_vacc.given_at < CURRENT_DATE - ($1 || ' days')::interval
         AND NOT EXISTS (
           SELECT 1 FROM vaccination_records vr2
           WHERE vr2.patient_id = p.id
             AND vr2.given_at >= CURRENT_DATE - ($1 || ' days')::interval
         )
       ORDER BY latest_vacc.given_at ASC
       LIMIT 200`,
      [daysOverdue],
    );
  }
}
