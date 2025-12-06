import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class CdiService {
  private readonly logger = new Logger(CdiService.name);

  constructor() {}

  async createCdiReview(
    reviewData: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<any> {
    const result = await tenantDb.query(
      `INSERT INTO cdi_reviews (admission_id, patient_id, review_type, current_drg, potential_drg, 
        current_drg_weight, potential_drg_weight, potential_impact, severity_of_illness, 
        risk_of_mortality, query_needed, query_reason, reviewed_by, review_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [
        reviewData.admissionId, reviewData.patientId, reviewData.reviewType || 'concurrent',
        reviewData.currentDrg, reviewData.potentialDrg, reviewData.currentDrgWeight,
        reviewData.potentialDrgWeight, reviewData.potentialImpact, reviewData.severityOfIllness,
        reviewData.riskOfMortality, reviewData.queryNeeded || false, reviewData.queryReason,
        userId, 'in_progress'
      ]
    );
    return result[0];
  }

  async sendPhysicianQuery(
    queryData: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<any> {
    const queryNumber = `CDI-${Date.now()}`;
    
    const result = await tenantDb.query(
      `INSERT INTO physician_queries (query_number, admission_id, patient_id, cdi_review_id, 
        query_type, query_text, clinical_indicators, physician_id, priority, potential_drg_change, 
        financial_impact, created_by, query_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        queryNumber, queryData.admissionId, queryData.patientId, queryData.cdiReviewId,
        queryData.queryType, queryData.queryText, queryData.clinicalIndicators,
        queryData.physicianId, queryData.priority || 'routine', queryData.potentialDrgChange,
        queryData.financialImpact, userId, 'sent'
      ]
    );
    return result[0];
  }

  async getOpenQueries(
    physicianId: string,
    tenantDb: DataSource,
  ): Promise<any[]> {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(physicianId)) {
      // If not a valid UUID, return empty array instead of error
      return [];
    }
    
    return await tenantDb.query(
      `SELECT q.*, p.first_name as patient_first_name, p.last_name as patient_last_name
      FROM physician_queries q
      JOIN patients p ON q.patient_id = p.id
      WHERE q.physician_id = $1 AND q.query_status IN ('sent', 'draft')
      ORDER BY q.priority DESC, q.query_date ASC`,
      [physicianId]
    );
  }

  async answerQuery(
    queryId: string,
    responseData: any,
    tenantDb: DataSource,
  ): Promise<any> {
    const result = await tenantDb.query(
      `UPDATE physician_queries 
      SET response_text = $1, response_date = CURRENT_DATE, response_action = $2, 
          query_status = 'answered', documentation_improved = $3, drg_changed = $4
      WHERE id = $5 RETURNING *`,
      [
        responseData.responseText, responseData.responseAction,
        responseData.documentationImproved || false, responseData.drgChanged || false,
        queryId
      ]
    );
    return result[0];
  }

  async getCdiMetrics(
    startDate: Date,
    endDate: Date,
    tenantDb: DataSource,
  ): Promise<any> {
    const queries = await tenantDb.query(
      `SELECT COUNT(*) as total_queries, 
        SUM(CASE WHEN query_status = 'answered' THEN 1 ELSE 0 END) as answered_queries,
        SUM(CASE WHEN documentation_improved = true THEN 1 ELSE 0 END) as improved_documentation,
        SUM(CASE WHEN drg_changed = true THEN 1 ELSE 0 END) as drg_changes,
        SUM(financial_impact) as total_impact
      FROM physician_queries
      WHERE query_date >= $1 AND query_date <= $2`,
      [startDate, endDate]
    );

    return queries[0];
  }
}



