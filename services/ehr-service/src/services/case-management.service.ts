import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class CaseManagementService {
  private readonly logger = new Logger(CaseManagementService.name);

  constructor() {}

  async createAssessment(
    assessmentData: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<any> {
    const result = await tenantDb.query(
      `INSERT INTO case_management_assessments 
      (admission_id, patient_id, assessment_type, medical_complexity, functional_status, 
        psychosocial_needs, home_health_needed, dme_needed, readmission_risk, case_manager_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        assessmentData.admissionId, assessmentData.patientId, assessmentData.assessmentType || 'initial',
        assessmentData.medicalComplexity, assessmentData.functionalStatus, assessmentData.psychosocialNeeds,
        assessmentData.homeHealthNeeded || false, assessmentData.dmeNeeded || false,
        assessmentData.readmissionRisk, userId
      ]
    );
    return result[0];
  }

  async createDischargePlan(
    planData: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<any> {
    const result = await tenantDb.query(
      `INSERT INTO discharge_plans 
      (admission_id, patient_id, target_discharge_date, discharge_disposition, discharge_instructions, 
        medication_reconciliation_complete, transportation_arranged, case_manager_id, plan_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        planData.admissionId, planData.patientId, planData.targetDischargeDate,
        planData.dischargeDisposition, planData.dischargeInstructions,
        planData.medicationReconciliationComplete || false,
        planData.transportationArranged || false, userId, 'planning'
      ]
    );
    return result[0];
  }

  async getDischargePlan(
    admissionId: string,
    tenantDb: DataSource,
  ): Promise<any> {
    const result = await tenantDb.query(
      `SELECT * FROM discharge_plans WHERE admission_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [admissionId]
    );
    return result[0];
  }

  async getPendingDischarges(
    tenantDb: DataSource,
  ): Promise<any[]> {
    return await tenantDb.query(
      `SELECT dp.*, p.first_name, p.last_name, a.admission_date, a.ward_name, a.bed_number
      FROM discharge_plans dp
      JOIN patients p ON dp.patient_id = p.id
      JOIN admissions a ON dp.admission_id = a.id
      WHERE dp.plan_status = 'ready' AND a.status = 'active'
      ORDER BY dp.target_discharge_date ASC`
    );
  }
}




