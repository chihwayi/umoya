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

  async getPhysicianWorklist(
    physicianId: string,
    tenantDb: DataSource,
    options?: {
      includeAnswered?: boolean;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
      focus?: string;
    },
  ): Promise<any> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(physicianId)) {
      return {
        summary: {
          total: 0,
          overdue: 0,
          dueSoon: 0,
          highRisk: 0,
          avgAgeHours: 0,
          responseRatePercent: 0,
        },
        items: [],
      };
    }

    const includeAnswered = Boolean(options?.includeAnswered);
    const focus = String(options?.focus || 'all').toLowerCase();
    const limit = Number.isFinite(Number(options?.limit)) ? Number(options?.limit) : 50;
    const startDate = options?.startDate || new Date(new Date().setDate(new Date().getDate() - 30));
    const endDate = options?.endDate || new Date();

    const rows = await tenantDb.query(
      `
      SELECT
        q.*,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        p.patient_number,
        a.current_ward,
        a.admission_date
      FROM physician_queries q
      JOIN patients p ON q.patient_id = p.id
      LEFT JOIN admissions a ON a.id = q.admission_id
      WHERE q.physician_id = $1
        AND q.query_date >= $2
        AND q.query_date <= $3
        AND (
          $4::boolean = true
          OR q.query_status IN ('sent', 'draft')
        )
      ORDER BY
        CASE q.priority
          WHEN 'stat' THEN 0
          WHEN 'urgent' THEN 1
          ELSE 2
        END,
        q.query_date ASC
      LIMIT $5
      `,
      [physicianId, startDate, endDate, includeAnswered, limit],
    );

    const normalizedItems = (rows || []).map((row: any) => this.hydrateQueryWorklistRow(row));
    const items = normalizedItems.filter((item: any) => {
      if (focus === 'open') return String(item?.query_status || '').toLowerCase() !== 'answered';
      if (focus === 'answered') return String(item?.query_status || '').toLowerCase() === 'answered';
      if (focus === 'overdue') return String(item?.sla_status || '').toLowerCase() === 'overdue';
      if (focus === 'warning') return String(item?.sla_status || '').toLowerCase() === 'warning';
      if (focus === 'high') return String(item?.risk_level || '').toLowerCase() === 'high';
      if (focus === 'documentation') return Number(item?.documentation_gap_count || 0) > 0;
      return true;
    });
    const unanswered = items.filter((item: any) => item.query_status !== 'answered');
    const answered = items.filter((item: any) => item.query_status === 'answered');

    const summary = {
      total: items.length,
      open: unanswered.length,
      answered: answered.length,
      overdue: unanswered.filter((item: any) => item.sla_status === 'overdue').length,
      dueSoon: unanswered.filter((item: any) => item.sla_status === 'warning').length,
      highRisk: unanswered.filter((item: any) => item.risk_level === 'high').length,
      avgAgeHours:
        unanswered.length > 0
          ? Number(
              (
                unanswered.reduce((acc: number, item: any) => acc + Number(item.age_hours || 0), 0) /
                unanswered.length
              ).toFixed(1),
            )
          : 0,
      responseRatePercent:
        items.length > 0
          ? Number(((answered.length / items.length) * 100).toFixed(1))
          : 0,
      byPriority: {
        stat: unanswered.filter((item: any) => item.priority === 'stat').length,
        urgent: unanswered.filter((item: any) => item.priority === 'urgent').length,
        routine: unanswered.filter((item: any) => item.priority !== 'stat' && item.priority !== 'urgent').length,
      },
      missingClinicalIndicators: unanswered.filter((item: any) => item.missing_clinical_indicators).length,
      missingPotentialDrgContext: unanswered.filter((item: any) => item.missing_potential_drg_change).length,
      missingFinancialImpact: unanswered.filter((item: any) => item.missing_financial_impact).length,
      documentationGaps: items.filter((item: any) => Number(item.documentation_gap_count || 0) > 0).length,
      answeredMissingResponseNarrative: answered.filter((item: any) => item.answered_missing_response_narrative).length,
      cdssCoveragePercent:
        items.length > 0
          ? Number(((items.filter((item: any) => Number(item.documentation_gap_count || 0) === 0).length / items.length) * 100).toFixed(1))
          : 100,
    };

    return { summary, items };
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

  async getPhysicianOperationalBrief(
    physicianId: string,
    tenantDb: DataSource,
    options?: {
      includeAnswered?: boolean;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<any> {
    const worklist = await this.getPhysicianWorklist(physicianId, tenantDb, {
      includeAnswered: Boolean(options?.includeAnswered),
      limit: Number.isFinite(Number(options?.limit)) ? Number(options?.limit) : 80,
      startDate: options?.startDate,
      endDate: options?.endDate,
    });

    const items = Array.isArray(worklist?.items) ? worklist.items : [];
    const openItems = items.filter((item: any) => String(item?.query_status || '').toLowerCase() !== 'answered');

    const highPriorityQueue = [...openItems]
      .sort((a: any, b: any) => {
        const riskRank = { high: 0, moderate: 1, low: 2 } as const;
        const byRisk =
          (riskRank[String(a?.risk_level || 'low').toLowerCase() as keyof typeof riskRank] ?? 3) -
          (riskRank[String(b?.risk_level || 'low').toLowerCase() as keyof typeof riskRank] ?? 3);
        if (byRisk !== 0) return byRisk;
        return Number(b?.age_hours || 0) - Number(a?.age_hours || 0);
      })
      .slice(0, 8)
      .map((item: any) => ({
        id: item.id,
        patientId: item.patient_id,
        patientName: `${item.patient_first_name || ''} ${item.patient_last_name || ''}`.trim() || 'Unknown patient',
        patientNumber: item.patient_number || null,
        priority: item.priority || 'routine',
        slaStatus: item.sla_status || 'on_track',
        riskLevel: item.risk_level || 'low',
        ageHours: Number(item.age_hours || 0),
        financialImpactValue: Number(item.financial_impact_value || 0),
        potentialDrgChange: item.potential_drg_change || null,
        cdssFlags: Array.isArray(item.cdss_flags) ? item.cdss_flags.slice(0, 4) : [],
        recommendedActions: Array.isArray(item.recommended_actions)
          ? item.recommended_actions.slice(0, 3)
          : [],
      }));

    const financialAtRisk = openItems.reduce(
      (sum: number, item: any) => sum + Number(item?.financial_impact_value || 0),
      0,
    );

    const recommendations = new Set<string>();
    if (Number(worklist?.summary?.overdue || 0) > 0) {
      recommendations.add('Address overdue CDI queries first to prevent coding and reimbursement leakage.');
    }
    if (Number(worklist?.summary?.highRisk || 0) > 0) {
      recommendations.add('Prioritize high-risk CDI queries with significant financial or DRG impact.');
    }
    if ((worklist?.summary?.byPriority?.stat || 0) > 0) {
      recommendations.add('Resolve stat-priority CDI queries immediately before routine work.');
    }
    if (Number(worklist?.summary?.missingClinicalIndicators || 0) > 0) {
      recommendations.add('Strengthen CDI responses with objective clinical indicators and supporting evidence.');
    }
    if (Number(worklist?.summary?.documentationGaps || 0) > 0) {
      recommendations.add('Close CDI documentation gaps (query specificity, DRG context, and response completeness).');
    }
    if (Number(worklist?.summary?.cdssCoveragePercent || 100) < 85) {
      recommendations.add('Run physician-CDI huddle to improve query documentation quality and CDSS compliance coverage.');
    }
    if (financialAtRisk > 0) {
      recommendations.add(`Current open CDI queue represents approximately $${financialAtRisk.toFixed(2)} at-risk impact.`);
    }
    for (const item of highPriorityQueue) {
      for (const action of item.recommendedActions || []) {
        if (String(action || '').trim()) {
          recommendations.add(String(action).trim());
        }
      }
      if (recommendations.size >= 8) break;
    }
    if (!recommendations.size) {
      recommendations.add('Maintain diagnosis specificity and timely query turnaround to preserve CDI quality.');
    }

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        total: Number(worklist?.summary?.total || 0),
        open: Number(worklist?.summary?.open || 0),
        overdue: Number(worklist?.summary?.overdue || 0),
        dueSoon: Number(worklist?.summary?.dueSoon || 0),
        highRisk: Number(worklist?.summary?.highRisk || 0),
        responseRatePercent: Number(worklist?.summary?.responseRatePercent || 0),
        stat: Number(worklist?.summary?.byPriority?.stat || 0),
        urgent: Number(worklist?.summary?.byPriority?.urgent || 0),
        missingClinicalIndicators: Number(worklist?.summary?.missingClinicalIndicators || 0),
        missingPotentialDrgContext: Number(worklist?.summary?.missingPotentialDrgContext || 0),
        missingFinancialImpact: Number(worklist?.summary?.missingFinancialImpact || 0),
        documentationGaps: Number(worklist?.summary?.documentationGaps || 0),
        answeredMissingResponseNarrative: Number(worklist?.summary?.answeredMissingResponseNarrative || 0),
        cdssCoveragePercent: Number(worklist?.summary?.cdssCoveragePercent || 100),
        financialAtRisk: Number(financialAtRisk.toFixed(2)),
      },
      highPriorityQueue,
      recommendations: Array.from(recommendations).slice(0, 8),
    };
  }

  private hydrateQueryWorklistRow(row: any): any {
    const queryDate = row?.query_date ? new Date(row.query_date) : null;
    const ageHours = queryDate
      ? Math.max(0, Math.floor((Date.now() - queryDate.getTime()) / (1000 * 60 * 60)))
      : 0;

    const priority = String(row?.priority || 'routine').toLowerCase();
    const financialImpact = Number(row?.financial_impact || 0);
    const normalizedImpact = Number.isFinite(financialImpact) ? financialImpact : 0;

    const slaThresholdHours = priority === 'stat' ? 2 : priority === 'urgent' ? 8 : 24;
    const slaWarningHours = Math.floor(slaThresholdHours * 0.75);
    const isAnswered = String(row?.query_status || '').toLowerCase() === 'answered';
    const queryTextLength = String(row?.query_text || '').trim().length;
    const responseTextLength = String(row?.response_text || '').trim().length;
    const missingClinicalIndicators = !String(row?.clinical_indicators || '').trim();
    const missingPotentialDrgChange = !String(row?.potential_drg_change || '').trim();
    const missingFinancialImpact = normalizedImpact <= 0;
    const missingQueryType = !String(row?.query_type || '').trim();
    const genericQueryText = queryTextLength > 0 && queryTextLength < 30;
    const answeredMissingResponseNarrative = isAnswered && responseTextLength < 15;
    const answeredMissingResponseAction = isAnswered && !String(row?.response_action || '').trim();
    const missingDocumentationOutcome =
      isAnswered && (row?.documentation_improved === null || row?.documentation_improved === undefined);
    const missingWardContext = !String(row?.current_ward || '').trim();

    const cdssFlags: string[] = [];
    if (missingQueryType) cdssFlags.push('Query type missing');
    if (genericQueryText) cdssFlags.push('Query text too generic');
    if (!isAnswered && missingClinicalIndicators) cdssFlags.push('Clinical indicators missing');
    if (!isAnswered && missingPotentialDrgChange) cdssFlags.push('Potential DRG change missing');
    if (!isAnswered && missingFinancialImpact) cdssFlags.push('Financial impact not estimated');
    if (!isAnswered && missingWardContext) cdssFlags.push('Ward/admission context missing');
    if (answeredMissingResponseNarrative) cdssFlags.push('Answered query lacks response narrative');
    if (answeredMissingResponseAction) cdssFlags.push('Answered query missing response action');
    if (missingDocumentationOutcome) cdssFlags.push('Answered query missing documentation outcome');
    const documentationGapCount = cdssFlags.length;

    let slaStatus: 'on_track' | 'warning' | 'overdue' = 'on_track';
    if (!isAnswered && ageHours >= slaThresholdHours) {
      slaStatus = 'overdue';
    } else if (!isAnswered && ageHours >= slaWarningHours) {
      slaStatus = 'warning';
    }

    const priorityScore = priority === 'stat' ? 3 : priority === 'urgent' ? 2 : 1;
    const impactScore = normalizedImpact >= 2000 ? 3 : normalizedImpact >= 500 ? 2 : normalizedImpact > 0 ? 1 : 0;
    const ageScore = ageHours >= 24 ? 2 : ageHours >= 8 ? 1 : 0;
    const documentationScore = !isAnswered ? Math.min(2, documentationGapCount) : 0;
    const riskScore = priorityScore + impactScore + ageScore + documentationScore;

    let riskLevel: 'high' | 'moderate' | 'low' = 'low';
    if (!isAnswered && (riskScore >= 6 || slaStatus === 'overdue')) {
      riskLevel = 'high';
    } else if (!isAnswered && (riskScore >= 4 || slaStatus === 'warning')) {
      riskLevel = 'moderate';
    }

    const recommendedActions: string[] = [];
    if (!isAnswered && slaStatus === 'overdue') {
      recommendedActions.push('Respond now: CDI query SLA is overdue.');
    } else if (!isAnswered && slaStatus === 'warning') {
      recommendedActions.push('Respond soon: CDI query is approaching SLA breach.');
    }
    if (!row?.clinical_indicators) {
      recommendedActions.push('Review chart/labs to add objective clinical indicators in response.');
    }
    if (!isAnswered && missingPotentialDrgChange) {
      recommendedActions.push('Document likely DRG impact trajectory to prioritize CDI closure.');
    }
    if (!isAnswered && missingFinancialImpact) {
      recommendedActions.push('Estimate financial impact to support CDI prioritization.');
    }
    if (!isAnswered && missingQueryType) {
      recommendedActions.push('Assign clear CDI query type for coding specificity.');
    }
    if (!isAnswered && genericQueryText) {
      recommendedActions.push('Expand CDI query text with diagnosis-specific clinical context.');
    }
    if (isAnswered && answeredMissingResponseNarrative) {
      recommendedActions.push('Expand physician response narrative for audit-ready specificity.');
    }
    if (isAnswered && answeredMissingResponseAction) {
      recommendedActions.push('Select response action to complete CDI closure metadata.');
    }
    if (row?.potential_drg_change) {
      recommendedActions.push('Confirm if documentation supports potential DRG reassignment.');
    }
    if (normalizedImpact > 0) {
      recommendedActions.push(`Potential revenue impact: $${normalizedImpact.toFixed(2)} if unresolved.`);
    }
    if (recommendedActions.length === 0) {
      recommendedActions.push('Maintain complete diagnosis specificity and present-on-admission clarity.');
    }

    return {
      ...row,
      age_hours: ageHours,
      sla_threshold_hours: slaThresholdHours,
      sla_status: isAnswered ? 'resolved' : slaStatus,
      risk_level: riskLevel,
      risk_score: riskScore,
      financial_impact_value: normalizedImpact,
      missing_clinical_indicators: missingClinicalIndicators,
      missing_potential_drg_change: missingPotentialDrgChange,
      missing_financial_impact: missingFinancialImpact,
      missing_query_type: missingQueryType,
      generic_query_text: genericQueryText,
      answered_missing_response_narrative: answeredMissingResponseNarrative,
      answered_missing_response_action: answeredMissingResponseAction,
      missing_documentation_outcome: missingDocumentationOutcome,
      missing_ward_context: missingWardContext,
      documentation_gap_count: documentationGapCount,
      cdss_flags: cdssFlags,
      recommended_actions: recommendedActions,
    };
  }
}
