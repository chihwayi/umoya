import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class SepsisService {
  private readonly logger = new Logger(SepsisService.name);

  constructor() {}

  async screenForSepsis(
    screeningData: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<any> {
    // Calculate scores
    const qsofaScore = (screeningData.qsofaAlteredMentalStatus ? 1 : 0) + 
                      (screeningData.qsofaSystolicBpLow ? 1 : 0) + 
                      (screeningData.qsofaRespiratoryRateHigh ? 1 : 0);
    
    const sirsScore = (screeningData.sirsTempAbnormal ? 1 : 0) + 
                     (screeningData.sirsHeartRateHigh ? 1 : 0) + 
                     (screeningData.sirsRespiratoryRateHigh ? 1 : 0) + 
                     (screeningData.sirsWbcAbnormal ? 1 : 0);
    
    const sepsisSuspected = qsofaScore >= 2 || (sirsScore >= 2 && screeningData.lactate > 2);

    const result = await tenantDb.query(
      `INSERT INTO sepsis_screenings (patient_id, admission_id, screening_location,
        qsofa_altered_mental_status, qsofa_systolic_bp_low, qsofa_respiratory_rate_high, qsofa_score,
        sirs_temp_abnormal, sirs_heart_rate_high, sirs_respiratory_rate_high, sirs_wbc_abnormal, sirs_score,
        temperature, heart_rate, respiratory_rate, systolic_bp, oxygen_saturation, wbc_count, lactate,
        sepsis_suspected, sepsis_alert_triggered, screened_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22) RETURNING *`,
      [screeningData.patientId, screeningData.admissionId, screeningData.screeningLocation,
       screeningData.qsofaAlteredMentalStatus, screeningData.qsofaSystolicBpLow, screeningData.qsofaRespiratoryRateHigh, qsofaScore,
       screeningData.sirsTempAbnormal, screeningData.sirsHeartRateHigh, screeningData.sirsRespiratoryRateHigh, screeningData.sirsWbcAbnormal, sirsScore,
       screeningData.temperature, screeningData.heartRate, screeningData.respiratoryRate, 
       screeningData.systolicBp, screeningData.oxygenSaturation, screeningData.wbcCount, screeningData.lactate,
       sepsisSuspected, sepsisSuspected, userId]
    );

    return result[0];
  }

  async initiateSepsisBundle(
    bundleData: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<any> {
    const result = await tenantDb.query(
      `INSERT INTO sepsis_bundles (patient_id, admission_id, sepsis_screening_id, bundle_start_time, managed_by)
      VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [bundleData.patientId, bundleData.admissionId, bundleData.sepsisScreeningId, new Date(), userId]
    );
    return result[0];
  }

  async updateBundleElement(
    bundleId: string,
    element: string,
    value: any,
    tenantDb: DataSource,
  ): Promise<any> {
    const result = await tenantDb.query(
      `UPDATE sepsis_bundles SET ${element} = $1, ${element.replace('_given', '_time').replace('_measured', '_time')} = NOW() WHERE id = $2 RETURNING *`,
      [value, bundleId]
    );
    return result[0];
  }

  async getSepsisAlerts(
    tenantDb: DataSource,
  ): Promise<any[]> {
    return await tenantDb.query(
      `SELECT s.*, p.first_name, p.last_name, a.current_ward as ward_name, b.bed_number
      FROM sepsis_screenings s
      JOIN patients p ON s.patient_id = p.id
      LEFT JOIN admissions a ON s.admission_id = a.id
      LEFT JOIN beds b ON a.current_bed_id = b.id
      WHERE s.sepsis_suspected = true AND s.screening_datetime > NOW() - INTERVAL '24 hours'
      ORDER BY s.screening_datetime DESC`
    );
  }

  async getBundleCompliance(
    startDate: Date,
    endDate: Date,
    tenantDb: DataSource,
  ): Promise<any> {
    const result = await tenantDb.query(
      `SELECT 
        COUNT(*) as total_bundles,
        SUM(CASE WHEN three_hour_bundle_complete THEN 1 ELSE 0 END) as three_hour_compliant,
        SUM(CASE WHEN overall_compliance THEN 1 ELSE 0 END) as overall_compliant
      FROM sepsis_bundles
      WHERE bundle_start_time >= $1 AND bundle_start_time <= $2`,
      [startDate, endDate]
    );
    return result[0];
  }
}



