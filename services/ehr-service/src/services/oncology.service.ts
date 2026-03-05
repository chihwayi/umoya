import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FinanceService } from './finance.service';
import { PAYMENT_STATUS, PaymentStatus } from '../constants/payment-status';
import { TerminologyService } from './terminology.service';
import {
  CreateOncologyImagingFindingDto,
  CreateOncologyPathologyDto,
  CreateResponseAssessmentDto,
  UpdateOncologyBiomarkersDto,
  CalculateAssessmentRecistDto,
  RECIST_RESPONSES,
  CreateSurvivorshipPlanDto,
  UpdateSurvivorshipPlanDto,
  EnrollClinicalTrialDto,
  UpdateClinicalTrialStatusDto,
  RecordTrialComplianceDto,
  RecordPatientReportedOutcomeDto,
  ProHistoryQueryDto,
  RecordGenomicDataDto,
  RecordFinancialToxicityDto,
  OncologyAnalyticsQueryDto,
  OncologyAlertCheckDto,
} from '../dto/oncology.dto';

interface CaseFilter {
  status?: string;
  patientId?: string;
  oncologistId?: string;
}

interface StoredConceptSummary {
  conceptId: string;
  term: string;
  moduleId?: string;
  definitionStatus?: string;
}

@Injectable()
export class OncologyService {
  private readonly logger = new Logger(OncologyService.name);

  constructor(
    private readonly financeService: FinanceService,
    private readonly terminologyService: TerminologyService,
  ) {}

  private extractConceptId(candidate: any): string | null {
    if (!candidate) {
      return null;
    }
    if (typeof candidate === 'string') {
      return candidate.trim();
    }
    return (
      candidate?.conceptId ??
      candidate?.snomedConceptId ??
      candidate?.snomedCode ??
      candidate?.code ??
      null
    );
  }

  private async resolveConcept(
    tenantDb: DataSource,
    raw: any,
  ): Promise<StoredConceptSummary | null> {
    if (raw === undefined || raw === null) {
      return null;
    }

    const conceptIdCandidate = this.extractConceptId(raw);
    if (!conceptIdCandidate) {
      return null;
    }

    const conceptId = String(conceptIdCandidate).trim();
    let validated:
      | {
          conceptId: string;
          preferredTerm?: string;
          term?: string;
          moduleId?: string;
          definitionStatus?: string;
        }
      | null = null;

    if (/^\d+$/.test(conceptId)) {
      try {
        validated = await this.terminologyService.validateConcept(tenantDb, conceptId);
      } catch (error: any) {
        this.logger.warn(
          `SNOMED validation failed for oncology concept "${conceptId}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    } else {
      this.logger.warn(`Received non-numeric SNOMED concept "${conceptId}" for oncology payload.`);
      return null;
    }

    const rawTerm =
      (typeof raw === 'object' && (raw.preferredTerm || raw.term || raw.fullySpecifiedName)) || null;
    const term = rawTerm ?? validated?.preferredTerm ?? validated?.term ?? null;

    if (!term && !validated) {
      return null;
    }

    return {
      conceptId: validated?.conceptId ?? conceptId,
      term: term ?? '',
      moduleId: validated?.moduleId ?? raw?.moduleId,
      definitionStatus: validated?.definitionStatus ?? raw?.definitionStatus,
    };
  }

  private appendCaseAnalyticsFilters(
    filters: OncologyAnalyticsQueryDto | undefined,
    params: any[],
    alias = 'oc',
  ): string[] {
    if (!filters) {
      return [];
    }
    const clauses: string[] = [];
    if (filters.cancerType) {
      params.push(`%${filters.cancerType.toLowerCase()}%`);
      clauses.push(`LOWER(${alias}.primary_diagnosis) LIKE $${params.length}`);
    }
    if (filters.stage) {
      params.push(filters.stage.toLowerCase());
      clauses.push(`LOWER(${alias}.overall_stage) = $${params.length}`);
    }
    if (filters.oncologistId) {
      params.push(filters.oncologistId);
      clauses.push(`${alias}.oncologist_id = $${params.length}`);
    }
    if (filters.biomarker) {
      params.push(`%${filters.biomarker.toLowerCase()}%`);
      clauses.push(
        `EXISTS (
          SELECT 1
          FROM oncology_pathology op
          WHERE op.oncology_case_id = ${alias}.id
            AND LOWER(COALESCE(op.biomarkers::text, '') || ' ' || COALESCE(op.genomic_data::text, ''))
              LIKE $${params.length}
        )`,
      );
    }
    return clauses;
  }

  private appendDateRangeFilters(
    column: string,
    filters: OncologyAnalyticsQueryDto | undefined,
    params: any[],
  ): string[] {
    if (!filters) {
      return [];
    }
    const clauses: string[] = [];
    if (filters.startDate) {
      params.push(filters.startDate);
      clauses.push(`${column} >= $${params.length}::date`);
    }
    if (filters.endDate) {
      params.push(filters.endDate);
      clauses.push(`${column} <= $${params.length}::date`);
    }
    return clauses;
  }

  async listCases(tenantDb: DataSource, filters: CaseFilter = {}) {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.status) {
      conditions.push(`oc.status = $${params.length + 1}`);
      params.push(filters.status);
    }

    if (filters.patientId) {
      conditions.push(`oc.patient_id = $${params.length + 1}`);
      params.push(filters.patientId);
    }

    if (filters.oncologistId) {
      conditions.push(`oc.oncologist_id = $${params.length + 1}`);
      params.push(filters.oncologistId);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT
        oc.*,
        p.first_name || ' ' || p.last_name AS patient_name,
        p.patient_number,
        p.date_of_birth,
        p.gender,
        p.phone,
        u.first_name || ' ' || u.last_name AS oncologist_name,
        COALESCE(r.active_regimens, 0) AS active_regimens,
        COALESCE(a.active_adverse_events, 0) AS active_adverse_events
      FROM oncology_cases oc
      INNER JOIN patients p ON p.id = oc.patient_id
      LEFT JOIN users u ON u.id = oc.oncologist_id
      LEFT JOIN (
        SELECT oncology_case_id, COUNT(*) AS active_regimens
        FROM oncology_regimens
        WHERE status IN ('planned', 'active')
        GROUP BY oncology_case_id
      ) r ON r.oncology_case_id = oc.id
      LEFT JOIN (
        SELECT oncology_case_id, COUNT(*) AS active_adverse_events
        FROM oncology_adverse_events
        WHERE resolved_date IS NULL
        GROUP BY oncology_case_id
      ) a ON a.oncology_case_id = oc.id
      ${whereClause}
      ORDER BY oc.updated_at DESC, oc.created_at DESC
    `;

    const cases = await tenantDb.query(query, params);
    return { cases, total: cases.length };
  }

  async getCaseDetail(tenantDb: DataSource, caseId: string) {
    const [caseRow] = await tenantDb.query(
      `
      SELECT
        oc.*,
        p.first_name || ' ' || p.last_name AS patient_name,
        p.patient_number,
        p.date_of_birth,
        p.gender,
        p.phone,
        u.first_name || ' ' || u.last_name AS oncologist_name
      FROM oncology_cases oc
      INNER JOIN patients p ON p.id = oc.patient_id
      LEFT JOIN users u ON u.id = oc.oncologist_id
      WHERE oc.id = $1
      `,
      [caseId],
    );

    if (!caseRow) {
      throw new NotFoundException(`Oncology case ${caseId} not found`);
    }

    const stagingEntries = await tenantDb.query(
      `
      SELECT ose.*, rec.first_name || ' ' || rec.last_name AS recorded_by_name
      FROM oncology_staging_entries ose
      LEFT JOIN users rec ON rec.id = ose.recorded_by
      WHERE ose.oncology_case_id = $1
      ORDER BY ose.stage_date DESC, ose.created_at DESC
      `,
      [caseId],
    );

    const regimens = await tenantDb.query(
      `
      SELECT
        orr.*,
        COUNT(DISTINCT ois.id) FILTER (WHERE ois.status IN ('scheduled','in_progress')) AS upcoming_sessions,
        COUNT(DISTINCT ois.id) FILTER (WHERE ois.status = 'completed') AS completed_sessions
      FROM oncology_regimens orr
      LEFT JOIN oncology_infusion_sessions ois ON ois.regimen_id = orr.id
      WHERE orr.oncology_case_id = $1
      GROUP BY orr.id
      ORDER BY orr.start_date DESC NULLS LAST, orr.created_at DESC
      `,
      [caseId],
    );

    const infusionSessions = await tenantDb.query(
      `
      SELECT
        ois.*,
        admin.first_name || ' ' || admin.last_name AS administered_by_name,
        orr.regimen_name
      FROM oncology_infusion_sessions ois
      LEFT JOIN oncology_regimens orr ON orr.id = ois.regimen_id
      LEFT JOIN users admin ON admin.id = ois.administered_by
      WHERE orr.oncology_case_id = $1
      ORDER BY ois.session_date DESC
      `,
      [caseId],
    );

    const adverseEvents = await tenantDb.query(
      `
      SELECT
        oae.*,
        rep.first_name || ' ' || rep.last_name AS reported_by_name,
        orr.regimen_name
      FROM oncology_adverse_events oae
      LEFT JOIN oncology_regimens orr ON orr.id = oae.regimen_id
      LEFT JOIN users rep ON rep.id = oae.reported_by
      WHERE oae.oncology_case_id = $1
      ORDER BY oae.event_date DESC
      `,
      [caseId],
    );

    const tumorBoardRecommendations = await tenantDb.query(
      `
      SELECT
        tbr.*,
        tbm.meeting_date,
        tbm.location,
        fac.first_name || ' ' || fac.last_name AS facilitator_name
      FROM tumor_board_recommendations tbr
      INNER JOIN tumor_board_meetings tbm ON tbm.id = tbr.meeting_id
      LEFT JOIN users fac ON fac.id = tbm.facilitator
      WHERE tbr.oncology_case_id = $1
      ORDER BY tbm.meeting_date DESC
      `,
      [caseId],
    );

    return {
      case: caseRow,
      stagingEntries,
      regimens,
      infusionSessions,
      adverseEvents,
      tumorBoardRecommendations,
    };
  }

  async createCase(tenantDb: DataSource, payload: any, userId?: string) {
    const {
      patient_id,
      primary_diagnosis,
      primary_diagnosis_concept,
      primaryDiagnosisConcept,
      staging_system,
      overall_stage,
      stage_at_diagnosis,
      diagnosis_date,
      primary_site,
      histology,
      oncologist_id,
      status,
      care_plan,
    } = payload;

    const resolvedPrimaryConcept =
      (primary_diagnosis_concept === null || primaryDiagnosisConcept === null)
        ? null
        : await this.resolveConcept(
            tenantDb,
            primary_diagnosis_concept ?? primaryDiagnosisConcept,
          );
    const primaryDiagnosisValue = primary_diagnosis ?? resolvedPrimaryConcept?.term ?? null;

    if (!patient_id || !primaryDiagnosisValue) {
      throw new BadRequestException('patient_id and primary_diagnosis are required');
    }

    const [createdCase] = await tenantDb.query(
      `
      INSERT INTO oncology_cases (
        patient_id,
        primary_diagnosis,
        primary_diagnosis_snomed_code,
        primary_diagnosis_snomed_term,
        primary_diagnosis_snomed_module_id,
        primary_diagnosis_snomed_definition_status,
        staging_system,
        overall_stage,
        stage_at_diagnosis,
        diagnosis_date,
        primary_site,
        histology,
        oncologist_id,
        status,
        care_plan,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        COALESCE($14,'active'),
        $15,
        NOW(),
        NOW()
      )
      RETURNING *
      `,
      [
        patient_id,
        primaryDiagnosisValue,
        resolvedPrimaryConcept?.conceptId ?? null,
        resolvedPrimaryConcept?.term ?? null,
        resolvedPrimaryConcept?.moduleId ?? null,
        resolvedPrimaryConcept?.definitionStatus ?? null,
        staging_system,
        overall_stage,
        stage_at_diagnosis,
        diagnosis_date,
        primary_site,
        histology,
        oncologist_id,
        status,
        care_plan,
      ],
    );

    this.logger.log(`Created oncology case ${createdCase.id} for patient ${patient_id} by ${userId}`);
    return createdCase;
  }

  async updateCase(tenantDb: DataSource, caseId: string, payload: any) {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Payload required');
    }

    const updates: string[] = [];
    const params: any[] = [];

    const textFields: string[] = [
      'primary_diagnosis',
      'staging_system',
      'overall_stage',
      'stage_at_diagnosis',
      'primary_site',
      'histology',
      'status',
      'care_plan',
    ];

    textFields.forEach((field) => {
      if (payload[field] !== undefined) {
        updates.push(`${field} = $${params.length + 1}::text`);
        params.push(payload[field]);
      }
    });

    if (payload.diagnosis_date !== undefined) {
      updates.push(`diagnosis_date = $${params.length + 1}::date`);
      params.push(payload.diagnosis_date);
    }

    if (payload.oncologist_id !== undefined) {
      const normalized =
        typeof payload.oncologist_id === 'string' && payload.oncologist_id.trim().length > 0
          ? payload.oncologist_id.trim()
          : null;
      updates.push(`oncologist_id = $${params.length + 1}::uuid`);
      params.push(normalized);
    }

    if ('primary_diagnosis_concept' in payload || 'primaryDiagnosisConcept' in payload) {
      const resolvedConcept =
        payload.primary_diagnosis_concept === null || payload.primaryDiagnosisConcept === null
          ? null
          : await this.resolveConcept(
              tenantDb,
              payload.primary_diagnosis_concept ?? payload.primaryDiagnosisConcept,
            );
      updates.push(`primary_diagnosis_snomed_code = $${params.length + 1}`);
      params.push(resolvedConcept?.conceptId ?? null);
      updates.push(`primary_diagnosis_snomed_term = $${params.length + 1}`);
      params.push(resolvedConcept?.term ?? null);
      updates.push(`primary_diagnosis_snomed_module_id = $${params.length + 1}`);
      params.push(resolvedConcept?.moduleId ?? null);
      updates.push(`primary_diagnosis_snomed_definition_status = $${params.length + 1}`);
      params.push(resolvedConcept?.definitionStatus ?? null);

      if (
        resolvedConcept?.term &&
        (payload.primary_diagnosis === undefined || payload.primary_diagnosis === null)
      ) {
        updates.push(`primary_diagnosis = $${params.length + 1}::text`);
        params.push(resolvedConcept.term);
      }
    }

    if (!updates.length) {
      throw new BadRequestException('No fields provided for update');
    }

    updates.push(`updated_at = NOW()`);
    const query = `
      UPDATE oncology_cases
      SET ${updates.join(', ')}
      WHERE id = $${params.length + 1}
      RETURNING *
    `;
    params.push(caseId);

    const result = await tenantDb.query(query, params);

    if (!result.length) {
      throw new NotFoundException(`Oncology case ${caseId} not found`);
    }

    this.logger.log(`Updated oncology case ${caseId}`);
    return result[0];
  }

  async addStagingEntry(tenantDb: DataSource, caseId: string, payload: any, userId?: string) {
    const { staging_system, t_stage, n_stage, m_stage, overall_stage, stage_date, performance_status, notes } = payload;

    if (!staging_system || !stage_date) {
      throw new BadRequestException('staging_system and stage_date are required');
    }

    const [entry] = await tenantDb.query(
      `
      INSERT INTO oncology_staging_entries (
        oncology_case_id,
        staging_system,
        t_stage,
        n_stage,
        m_stage,
        overall_stage,
        stage_date,
        performance_status,
        notes,
        recorded_by,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
      RETURNING *
      `,
      [caseId, staging_system, t_stage, n_stage, m_stage, overall_stage, stage_date, performance_status, notes, userId],
    );

    this.logger.log(`Recorded staging entry ${entry.id} for case ${caseId}`);
    return entry;
  }

  async listStagingEntries(tenantDb: DataSource, caseId: string) {
    const rows = await tenantDb.query(
      `
      SELECT ose.*, u.first_name || ' ' || u.last_name AS recorded_by_name
      FROM oncology_staging_entries ose
      LEFT JOIN users u ON u.id = ose.recorded_by
      WHERE oncology_case_id = $1
      ORDER BY stage_date DESC, created_at DESC
      `,
      [caseId],
    );

    return { entries: rows, total: rows.length };
  }

  async createRegimen(tenantDb: DataSource, caseId: string, payload: any) {
    const {
      regimen_name,
      regimen_concept,
      regimenConcept,
      line_of_therapy,
      intent,
      cycles_planned,
      start_date,
      end_date,
      status,
      regimen_details,
    } = payload;

    const resolvedRegimenConcept =
      (regimen_concept === null || regimenConcept === null)
        ? null
        : await this.resolveConcept(tenantDb, regimen_concept ?? regimenConcept);
    const regimenNameValue = regimen_name ?? resolvedRegimenConcept?.term ?? null;

    if (!regimenNameValue) {
      throw new BadRequestException('regimen_name is required');
    }

    const [regimen] = await tenantDb.query(
      `
      INSERT INTO oncology_regimens (
        oncology_case_id,
        regimen_name,
        regimen_snomed_code,
        regimen_snomed_term,
        regimen_snomed_module_id,
        regimen_snomed_definition_status,
        line_of_therapy,
        intent,
        cycles_planned,
        start_date,
        end_date,
        status,
        regimen_details,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        COALESCE($12,'planned'),
        COALESCE($13,'{}'::jsonb),
        NOW(),
        NOW()
      )
      RETURNING *
      `,
      [
        caseId,
        regimenNameValue,
        resolvedRegimenConcept?.conceptId ?? null,
        resolvedRegimenConcept?.term ?? null,
        resolvedRegimenConcept?.moduleId ?? null,
        resolvedRegimenConcept?.definitionStatus ?? null,
        line_of_therapy,
        intent,
        cycles_planned,
        start_date,
        end_date,
        status,
        regimen_details,
      ],
    );

    this.logger.log(`Created regimen ${regimen.id} for oncology case ${caseId}`);
    return regimen;
  }

  async updateRegimen(tenantDb: DataSource, regimenId: string, payload: any) {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Payload required');
    }

    const updates: string[] = [];
    const params: any[] = [];

    const textFields = ['regimen_name', 'line_of_therapy', 'intent', 'status'];
    textFields.forEach((field) => {
      if (payload[field] !== undefined) {
        updates.push(`${field} = $${params.length + 1}::text`);
        params.push(payload[field]);
      }
    });

    if (payload.cycles_planned !== undefined) {
      updates.push(`cycles_planned = $${params.length + 1}::int`);
      params.push(payload.cycles_planned);
    }

    if (payload.start_date !== undefined) {
      updates.push(`start_date = $${params.length + 1}::date`);
      params.push(payload.start_date);
    }

    if (payload.end_date !== undefined) {
      updates.push(`end_date = $${params.length + 1}::date`);
      params.push(payload.end_date);
    }

    if (payload.regimen_details !== undefined) {
      updates.push(`regimen_details = $${params.length + 1}::jsonb`);
      params.push(JSON.stringify(payload.regimen_details ?? {}));
    }

    if ('regimen_concept' in payload || 'regimenConcept' in payload) {
      const resolvedConcept =
        payload.regimen_concept === null || payload.regimenConcept === null
          ? null
          : await this.resolveConcept(tenantDb, payload.regimen_concept ?? payload.regimenConcept);
      updates.push(`regimen_snomed_code = $${params.length + 1}`);
      params.push(resolvedConcept?.conceptId ?? null);
      updates.push(`regimen_snomed_term = $${params.length + 1}`);
      params.push(resolvedConcept?.term ?? null);
      updates.push(`regimen_snomed_module_id = $${params.length + 1}`);
      params.push(resolvedConcept?.moduleId ?? null);
      updates.push(`regimen_snomed_definition_status = $${params.length + 1}`);
      params.push(resolvedConcept?.definitionStatus ?? null);

      if (
        resolvedConcept?.term &&
        (payload.regimen_name === undefined || payload.regimen_name === null)
      ) {
        updates.push(`regimen_name = $${params.length + 1}::text`);
        params.push(resolvedConcept.term);
      }
    }

    if (!updates.length) {
      throw new BadRequestException('No fields provided for update');
    }

    updates.push('updated_at = NOW()');
    const query = `
      UPDATE oncology_regimens
      SET ${updates.join(', ')}
      WHERE id = $${params.length + 1}
      RETURNING *
    `;
    params.push(regimenId);

    const result = await tenantDb.query(query, params);

    if (!result.length) {
      throw new NotFoundException(`Oncology regimen ${regimenId} not found`);
    }

    this.logger.log(`Updated oncology regimen ${regimenId}`);
    return result[0];
  }

  async listRegimens(tenantDb: DataSource, caseId: string) {
    const rows = await tenantDb.query(
      `
      SELECT
        orr.*,
        COUNT(DISTINCT ois.id) FILTER (WHERE ois.status IN ('scheduled','in_progress')) AS upcoming_sessions,
        COUNT(DISTINCT ois.id) FILTER (WHERE ois.status = 'completed') AS completed_sessions
      FROM oncology_regimens orr
      LEFT JOIN oncology_infusion_sessions ois ON ois.regimen_id = orr.id
      WHERE orr.oncology_case_id = $1
      GROUP BY orr.id
      ORDER BY orr.start_date DESC NULLS LAST, orr.created_at DESC
      `,
      [caseId],
    );

    return { regimens: rows, total: rows.length };
  }

  async createInfusionSession(tenantDb: DataSource, regimenId: string, payload: any, userId?: string) {
    const {
      cycle_number,
      session_date,
      location,
      vitals,
      drugs_administered,
      premedications,
      toxicities,
      status,
      notes,
      fee_amount,
      feeAmount,
    } = payload;

    if (!session_date) {
      throw new BadRequestException('session_date is required');
    }

    const [regimen] = await tenantDb.query(
      `
      SELECT orr.id, orr.regimen_name, oc.patient_id
      FROM oncology_regimens orr
      INNER JOIN oncology_cases oc ON oc.id = orr.oncology_case_id
      WHERE orr.id = $1
      `,
      [regimenId],
    );

    if (!regimen) {
      throw new NotFoundException(`Oncology regimen ${regimenId} not found`);
    }

    const rawFee =
      fee_amount ??
      feeAmount ??
      payload.estimated_fee ??
      payload.estimatedFee ??
      payload.cost ??
      null;
    const parsedFee = rawFee !== null && rawFee !== undefined ? Number(rawFee) : Number.NaN;
    const defaultFee =
      process.env.DEFAULT_ONCO_INFUSION_FEE !== undefined
        ? Number(process.env.DEFAULT_ONCO_INFUSION_FEE)
        : 0;
    const feeAmountNumber = Number.isFinite(parsedFee) ? parsedFee : defaultFee;
    const feeAmountValue = Number.isFinite(feeAmountNumber) && feeAmountNumber > 0 ? feeAmountNumber : 0;

    let financeTransactionId: string | null = null;
    let paymentStatus: PaymentStatus = PAYMENT_STATUS.PAYMENT_CONFIRMED;
    const requestedStatus: string = status || 'scheduled';
    let effectiveStatus: string = requestedStatus;

    if (feeAmountValue > 0) {
      const transaction = await this.financeService.createTransaction(
        tenantDb,
        {
          sourceModule: 'oncology_infusion_sessions',
          patientId: regimen.patient_id,
          amount: feeAmountValue,
          currency: 'USD',
          notes: `Oncology infusion${cycle_number ? ` (cycle ${cycle_number})` : ''} - ${regimen.regimen_name ?? 'Therapy'}`,
          payerType: 'self',
          lineItems: [
            {
              description: `Infusion session${cycle_number ? ` cycle ${cycle_number}` : ''}`,
              billingCode: 'ONCO_INFUSION',
              unitPrice: feeAmountValue,
              quantity: 1,
            },
          ],
        },
        userId,
      );
      financeTransactionId = transaction.id;
      paymentStatus = PAYMENT_STATUS.AWAITING_PAYMENT;
      effectiveStatus = 'awaiting_payment';
    }

    if (!['awaiting_payment', 'scheduled', 'in_progress', 'completed', 'cancelled'].includes(effectiveStatus)) {
      throw new BadRequestException(`Invalid infusion session status: ${effectiveStatus}`);
    }

    const [session] = await tenantDb.query(
      `
      INSERT INTO oncology_infusion_sessions (
        regimen_id,
        cycle_number,
        session_date,
        location,
        administered_by,
        vitals,
        drugs_administered,
        premedications,
        toxicities,
        status,
        notes,
        fee_amount,
        finance_transaction_id,
        payment_status,
        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,
        COALESCE($6,'{}'::jsonb),
        COALESCE($7,'[]'::jsonb),
        COALESCE($8,'[]'::jsonb),
        COALESCE($9,'[]'::jsonb),
        $10,
        $11,
        $12,
        $13,
        $14,
        NOW(),
        NOW()
      )
      RETURNING *
      `,
      [
        regimenId,
        cycle_number,
        session_date,
        location,
        userId,
        vitals,
        drugs_administered,
        premedications,
        toxicities,
        effectiveStatus,
        notes,
        feeAmountValue > 0 ? feeAmountValue : null,
        financeTransactionId,
        paymentStatus,
      ],
    );

    if (financeTransactionId) {
      await tenantDb.query(
        `
        UPDATE financial_transactions
        SET source_reference_id = $1
        WHERE id = $2
      `,
        [session.id, financeTransactionId],
      );
    }

    this.logger.log(
      `Created infusion session ${session.id} for regimen ${regimenId} (${paymentStatus})`,
    );
    return session;
  }

  async updateInfusionSession(tenantDb: DataSource, sessionId: string, payload: any) {
    const fields = Object.keys(payload).filter((key) => payload[key] !== undefined);
    if (!fields.length) {
      throw new BadRequestException('No fields provided for update');
    }

    if (payload.status && ['in_progress', 'completed'].includes(payload.status)) {
      await this.ensureInfusionPaymentCleared(tenantDb, sessionId);
    }

    const setClause = fields.map((field, idx) => `${field} = $${idx + 1}`).join(', ') + ', updated_at = NOW()';
    const values = fields.map((field) => payload[field]);
    values.push(sessionId);

    const result = await tenantDb.query(
      `UPDATE oncology_infusion_sessions SET ${setClause} WHERE id = $${values.length} RETURNING *`,
      values,
    );

    if (!result.length) {
      throw new NotFoundException(`Infusion session ${sessionId} not found`);
    }

    this.logger.log(`Updated infusion session ${sessionId}`);
    return result[0];
  }

  async listInfusionSessions(tenantDb: DataSource, regimenId: string) {
    const rows = await tenantDb.query(
      `
      SELECT
        ois.*,
        admin.first_name || ' ' || admin.last_name AS administered_by_name
      FROM oncology_infusion_sessions ois
      LEFT JOIN users admin ON admin.id = ois.administered_by
      WHERE regimen_id = $1
      ORDER BY session_date DESC
      `,
      [regimenId],
    );

    return { sessions: rows, total: rows.length };
  }

  async recordAdverseEvent(tenantDb: DataSource, caseId: string, payload: any, userId?: string) {
    const {
      regimen_id,
      event_date,
      event_type,
      event_concept,
      eventConcept,
      grade,
      related_to,
      action_taken,
      outcome,
      resolved_date,
      notes,
    } = payload;

    const resolvedEventConcept =
      (event_concept === null || eventConcept === null)
        ? null
        : await this.resolveConcept(tenantDb, event_concept ?? eventConcept);
    const eventTypeValue = event_type ?? resolvedEventConcept?.term ?? null;

    if (!event_date || !eventTypeValue) {
      throw new BadRequestException('event_date and event_type are required');
    }

    const [event] = await tenantDb.query(
      `
      INSERT INTO oncology_adverse_events (
        oncology_case_id,
        regimen_id,
        event_date,
        event_type,
        event_snomed_code,
        event_snomed_term,
        event_snomed_module_id,
        event_snomed_definition_status,
        grade,
        related_to,
        action_taken,
        outcome,
        resolved_date,
        notes,
        reported_by,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        NOW(),
        NOW()
      )
      RETURNING *
      `,
      [
        caseId,
        regimen_id,
        event_date,
        eventTypeValue,
        resolvedEventConcept?.conceptId ?? null,
        resolvedEventConcept?.term ?? null,
        resolvedEventConcept?.moduleId ?? null,
        resolvedEventConcept?.definitionStatus ?? null,
        grade,
        related_to,
        action_taken,
        outcome,
        resolved_date,
        notes,
        userId,
      ],
    );

    this.logger.log(`Recorded adverse event ${event.id} for oncology case ${caseId}`);
    return event;
  }

  async listAdverseEvents(tenantDb: DataSource, caseId: string) {
    const rows = await tenantDb.query(
      `
      SELECT
        oae.*,
        orr.regimen_name,
        rep.first_name || ' ' || rep.last_name AS reported_by_name
      FROM oncology_adverse_events oae
      LEFT JOIN oncology_regimens orr ON orr.id = oae.regimen_id
      LEFT JOIN users rep ON rep.id = oae.reported_by
      WHERE oae.oncology_case_id = $1
      ORDER BY oae.event_date DESC
      `,
      [caseId],
    );

    return { adverseEvents: rows, total: rows.length };
  }

  async createTumorBoardMeeting(tenantDb: DataSource, payload: any) {
    const { meeting_date, facilitator, location, agenda } = payload;

    if (!meeting_date) {
      throw new BadRequestException('meeting_date is required');
    }

    const [meeting] = await tenantDb.query(
      `
      INSERT INTO tumor_board_meetings (
        meeting_date,
        facilitator,
        location,
        agenda,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,NOW(),NOW())
      RETURNING *
      `,
      [meeting_date, facilitator, location, agenda],
    );

    this.logger.log(`Created tumor board meeting ${meeting.id}`);
    return meeting;
  }

  async listTumorBoardMeetings(tenantDb: DataSource) {
    const rows = await tenantDb.query(
      `
      SELECT
        tbm.*,
        fac.first_name || ' ' || fac.last_name AS facilitator_name,
        COUNT(DISTINCT tbr.id) AS recommendation_count
      FROM tumor_board_meetings tbm
      LEFT JOIN users fac ON fac.id = tbm.facilitator
      LEFT JOIN tumor_board_recommendations tbr ON tbr.meeting_id = tbm.id
      GROUP BY tbm.id, fac.first_name, fac.last_name
      ORDER BY tbm.meeting_date DESC
      `,
    );

    return { meetings: rows, total: rows.length };
  }

  async addTumorBoardRecommendation(tenantDb: DataSource, meetingId: string, payload: any) {
    const { oncology_case_id, recommendation, follow_up_actions, responsible_team, due_date, status } = payload;

    if (!oncology_case_id || !recommendation) {
      throw new BadRequestException('oncology_case_id and recommendation are required');
    }

    const [rec] = await tenantDb.query(
      `
      INSERT INTO tumor_board_recommendations (
        meeting_id,
        oncology_case_id,
        recommendation,
        follow_up_actions,
        responsible_team,
        due_date,
        status,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,'pending'),NOW(),NOW())
      RETURNING *
      `,
      [meetingId, oncology_case_id, recommendation, follow_up_actions, responsible_team, due_date, status],
    );

    this.logger.log(`Added tumor board recommendation ${rec.id} for case ${oncology_case_id}`);
    return rec;
  }

  async updateTumorBoardRecommendation(tenantDb: DataSource, recommendationId: string, payload: any) {
    const fields = Object.keys(payload).filter((key) => payload[key] !== undefined);
    if (!fields.length) {
      throw new BadRequestException('No fields provided for update');
    }

    const setClause = fields.map((field, idx) => `${field} = $${idx + 1}`).join(', ') + ', updated_at = NOW()';
    const values = fields.map((field) => payload[field]);
    values.push(recommendationId);

    const result = await tenantDb.query(
      `UPDATE tumor_board_recommendations SET ${setClause} WHERE id = $${values.length} RETURNING *`,
      values,
    );

    if (!result.length) {
      throw new NotFoundException(`Tumor board recommendation ${recommendationId} not found`);
    }

    this.logger.log(`Updated tumor board recommendation ${recommendationId}`);
    return result[0];
  }

  private async ensureInfusionPaymentCleared(tenantDb: DataSource, sessionId: string) {
    const [session] = await tenantDb.query(
      `
      SELECT payment_status
      FROM oncology_infusion_sessions
      WHERE id = $1
      `,
      [sessionId],
    );

    if (!session) {
      throw new NotFoundException(`Infusion session ${sessionId} not found`);
    }

    if (session.payment_status === PAYMENT_STATUS.AWAITING_PAYMENT) {
      throw new BadRequestException(
        'Payment confirmation required before updating this infusion session',
      );
    }
  }

  async getDashboardSummary(tenantDb: DataSource) {
    const [caseTotals] = await tenantDb.query(
      `
      SELECT
        COUNT(*) AS total_cases,
        COUNT(*) FILTER (WHERE status = 'active') AS active_cases,
        COUNT(*) FILTER (WHERE status = 'in_remission') AS in_remission,
        COUNT(*) FILTER (WHERE status = 'follow_up') AS follow_up_cases,
        COUNT(*) FILTER (WHERE status = 'deceased') AS deceased_cases
      FROM oncology_cases
      `,
    );

    const statusBreakdown = await tenantDb.query(
      `
      SELECT status, COUNT(*) AS count
      FROM oncology_cases
      GROUP BY status
      `,
    );

    const upcomingInfusions = await tenantDb.query(
      `
      SELECT
        ois.id,
        ois.session_date,
        ois.cycle_number,
        ois.status,
        orr.regimen_name,
        oc.primary_diagnosis,
        p.first_name || ' ' || p.last_name AS patient_name
      FROM oncology_infusion_sessions ois
      INNER JOIN oncology_regimens orr ON orr.id = ois.regimen_id
      INNER JOIN oncology_cases oc ON oc.id = orr.oncology_case_id
      INNER JOIN patients p ON p.id = oc.patient_id
      WHERE ois.session_date >= NOW() AND ois.session_date <= NOW() + INTERVAL '14 days'
      ORDER BY ois.session_date ASC
      LIMIT 20
      `,
    );

    const adverseEventSummary = await tenantDb.query(
      `
      SELECT
        event_type,
        grade,
        COUNT(*) AS count
      FROM oncology_adverse_events
      WHERE event_date >= NOW() - INTERVAL '90 days'
      GROUP BY event_type, grade
      ORDER BY count DESC
      LIMIT 20
      `,
    );

    const [financeSummary] = await tenantDb.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE payment_status = 'awaiting_payment') AS awaiting_payment_sessions,
        COUNT(*) FILTER (WHERE payment_status = 'payment_confirmed') AS cleared_sessions,
        COUNT(*) AS total_sessions
      FROM oncology_infusion_sessions
      `,
    );

    const diagnosisDistribution = await tenantDb.query(
      `
      SELECT
        primary_diagnosis_snomed_code AS concept_id,
        COALESCE(primary_diagnosis_snomed_term, primary_diagnosis) AS term,
        COUNT(*)::int AS count
      FROM oncology_cases
      WHERE primary_diagnosis_snomed_code IS NOT NULL
      GROUP BY primary_diagnosis_snomed_code, COALESCE(primary_diagnosis_snomed_term, primary_diagnosis)
      ORDER BY count DESC
      LIMIT 10
      `,
    );

    const regimenMix = await tenantDb.query(
      `
      SELECT
        regimen_snomed_code AS concept_id,
        COALESCE(regimen_snomed_term, regimen_name) AS term,
        COUNT(*)::int AS count
      FROM oncology_regimens
      WHERE regimen_snomed_code IS NOT NULL
      GROUP BY regimen_snomed_code, COALESCE(regimen_snomed_term, regimen_name)
      ORDER BY count DESC
      LIMIT 10
      `,
    );

    const snomedAdverseEvents = await tenantDb.query(
      `
      SELECT
        event_snomed_code AS concept_id,
        COALESCE(event_snomed_term, event_type) AS term,
        grade,
        COUNT(*)::int AS count
      FROM oncology_adverse_events
      WHERE event_snomed_code IS NOT NULL
        AND event_date >= NOW() - INTERVAL '180 days'
      GROUP BY event_snomed_code, COALESCE(event_snomed_term, event_type), grade
      ORDER BY count DESC
      LIMIT 20
      `,
    );

    return {
      caseTotals,
      statusBreakdown,
      upcomingInfusions,
      adverseEventSummary,
      financeSummary,
      diagnosisDistribution,
      regimenMix,
      snomedAdverseEvents,
    };
  }

  async recordImagingFinding(
    tenantDb: DataSource,
    caseId: string,
    payload: CreateOncologyImagingFindingDto,
    userId?: string,
  ) {
    if (!payload.imagingDate || !payload.imagingType) {
      throw new BadRequestException('imagingDate and imagingType are required');
    }

    const [created] = await tenantDb.query(
      `
        INSERT INTO oncology_imaging_findings (
          oncology_case_id,
          imaging_study_id,
          imaging_date,
          imaging_type,
          modality,
          findings,
          tumor_size_cm,
          tumor_location,
          lymph_nodes_involved,
          metastatic_sites,
          recist_response,
          recist_criteria_met,
          radiologist_id,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3::date,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          NOW(),
          NOW()
        )
        RETURNING *
      `,
      [
        caseId,
        payload.imagingStudyId ?? null,
        payload.imagingDate,
        payload.imagingType,
        payload.modality ?? null,
        payload.findings ?? null,
        payload.tumorSizeCm ?? null,
        payload.tumorLocation ?? null,
        typeof payload.lymphNodesInvolved === 'number' ? payload.lymphNodesInvolved : null,
        payload.metastaticSites && payload.metastaticSites.length ? payload.metastaticSites : null,
        payload.recistResponse ?? null,
        typeof payload.recistCriteriaMet === 'boolean' ? payload.recistCriteriaMet : null,
        payload.radiologistId ?? userId ?? null,
      ],
    );

    this.logger.log(`Recorded imaging finding ${created.id} for oncology case ${caseId}`);
    return created;
  }

  async getImagingFindings(tenantDb: DataSource, caseId: string) {
    const rows = await tenantDb.query(
      `
        SELECT
          oif.*,
          i.study_type,
          i.modality AS imaging_study_modality,
          i.findings AS imaging_study_findings,
          (rad.first_name || ' ' || rad.last_name) AS radiologist_name
        FROM oncology_imaging_findings oif
        LEFT JOIN imaging_studies i ON i.id = oif.imaging_study_id
        LEFT JOIN users rad ON rad.id = oif.radiologist_id
        WHERE oif.oncology_case_id = $1
        ORDER BY oif.imaging_date DESC, oif.created_at DESC
      `,
      [caseId],
    );

    return { findings: rows };
  }

  async getImagingTimeline(tenantDb: DataSource, caseId: string) {
    const rows = await tenantDb.query(
      `
        SELECT id, imaging_date, tumor_size_cm, recist_response, recist_criteria_met
        FROM oncology_imaging_findings
        WHERE oncology_case_id = $1
        ORDER BY imaging_date ASC, created_at ASC
      `,
      [caseId],
    );

    return rows.map((row: any) => ({
      id: row.id,
      date: row.imaging_date,
      tumorSizeCm: row.tumor_size_cm,
      recistResponse: row.recist_response,
      recistCriteriaMet: row.recist_criteria_met,
    }));
  }

  async calculateRecistResponse(tenantDb: DataSource, findingId: string) {
    const [finding] = await tenantDb.query(`SELECT * FROM oncology_imaging_findings WHERE id = $1`, [findingId]);
    if (!finding) {
      throw new NotFoundException(`Imaging finding ${findingId} not found`);
    }

    if (finding.tumor_size_cm === null || finding.tumor_size_cm === undefined) {
      await tenantDb.query(
        `UPDATE oncology_imaging_findings SET recist_response = 'NE', recist_criteria_met = false, updated_at = NOW() WHERE id = $1`,
        [findingId],
      );
      return { findingId, recistResponse: 'NE', percentChange: null };
    }

    const [baseline] = await tenantDb.query(
      `
        SELECT tumor_size_cm
        FROM oncology_imaging_findings
        WHERE oncology_case_id = $1
          AND tumor_size_cm IS NOT NULL
        ORDER BY imaging_date ASC, created_at ASC
        LIMIT 1
      `,
      [finding.oncology_case_id],
    );

    if (!baseline || !baseline.tumor_size_cm || Number(baseline.tumor_size_cm) === 0) {
      await tenantDb.query(
        `UPDATE oncology_imaging_findings SET recist_response = 'NE', recist_criteria_met = false, updated_at = NOW() WHERE id = $1`,
        [findingId],
      );
      return { findingId, recistResponse: 'NE', percentChange: null };
    }

    const baselineSize = Number(baseline.tumor_size_cm);
    const currentSize = Number(finding.tumor_size_cm);
    const percentChange = ((currentSize - baselineSize) / baselineSize) * 100;

    let recist: 'CR' | 'PR' | 'SD' | 'PD' | 'NE' = 'SD';
    if (currentSize <= 0.1) {
      recist = 'CR';
    } else if (percentChange <= -30) {
      recist = 'PR';
    } else if (percentChange >= 20) {
      recist = 'PD';
    }

    const { rows } = await tenantDb.query(
      `UPDATE oncology_imaging_findings SET recist_response = $1, recist_criteria_met = true, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [recist, findingId],
    );

    return {
      finding: rows[0],
      percentChange: Number(percentChange.toFixed(2)),
    };
  }

  async recordPathology(
    tenantDb: DataSource,
    caseId: string,
    payload: CreateOncologyPathologyDto,
    userId?: string,
  ) {
    if (!payload.specimenDate) {
      throw new BadRequestException('specimenDate is required');
    }

    const [created] = await tenantDb.query(
      `
        INSERT INTO oncology_pathology (
          oncology_case_id,
          pathology_report_id,
          specimen_date,
          specimen_type,
          histology_type,
          histology_snomed_code,
          histology_snomed_term,
          grade,
          stage_t,
          stage_n,
          stage_m,
          biomarkers,
          genetic_testing,
          genomic_data,
          notes,
          pathologist_id,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3::date,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          COALESCE($12::jsonb,'{}'::jsonb),
          COALESCE($13::jsonb,'{}'::jsonb),
          COALESCE($14::jsonb,'{}'::jsonb),
          $15,
          $16,
          NOW(),
          NOW()
        )
        RETURNING *
      `,
      [
        caseId,
        payload.pathologyReportId ?? null,
        payload.specimenDate,
        payload.specimenType ?? null,
        payload.histologyType ?? null,
        payload.histologySnomedCode ?? null,
        payload.histologySnomedTerm ?? null,
        payload.grade ?? null,
        payload.stageT ?? null,
        payload.stageN ?? null,
        payload.stageM ?? null,
        payload.biomarkers ? JSON.stringify(payload.biomarkers) : null,
        payload.geneticTesting ? JSON.stringify(payload.geneticTesting) : null,
        payload.genomicData ? JSON.stringify(payload.genomicData) : null,
        payload.notes ?? null,
        payload.pathologistId ?? userId ?? null,
      ],
    );

    this.logger.log(`Recorded pathology ${created.id} for oncology case ${caseId}`);
    return created;
  }

  async getPathology(tenantDb: DataSource, caseId: string) {
    const [current] = await tenantDb.query(
      `
        SELECT
          op.*,
          (u.first_name || ' ' || u.last_name) AS pathologist_name
        FROM oncology_pathology op
        LEFT JOIN users u ON u.id = op.pathologist_id
        WHERE op.oncology_case_id = $1
        ORDER BY op.specimen_date DESC NULLS LAST, op.created_at DESC
        LIMIT 1
      `,
      [caseId],
    );

    return current || null;
  }

  async updatePathologyBiomarkers(
    tenantDb: DataSource,
    pathologyId: string,
    payload: UpdateOncologyBiomarkersDto,
  ) {
    if (!payload.biomarkers && !payload.geneticTesting && !payload.genomicData) {
      throw new BadRequestException('At least one payload field is required');
    }

    const [updated] = await tenantDb.query(
      `
        UPDATE oncology_pathology
        SET
          biomarkers = CASE WHEN $2::jsonb IS NULL THEN biomarkers ELSE COALESCE(biomarkers,'{}'::jsonb) || $2::jsonb END,
          genetic_testing = CASE WHEN $3::jsonb IS NULL THEN genetic_testing ELSE COALESCE(genetic_testing,'{}'::jsonb) || $3::jsonb END,
          genomic_data = CASE WHEN $4::jsonb IS NULL THEN genomic_data ELSE COALESCE(genomic_data,'{}'::jsonb) || $4::jsonb END,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        pathologyId,
        payload.biomarkers ? JSON.stringify(payload.biomarkers) : null,
        payload.geneticTesting ? JSON.stringify(payload.geneticTesting) : null,
        payload.genomicData ? JSON.stringify(payload.genomicData) : null,
      ],
    );

    if (!updated) {
      throw new NotFoundException(`Pathology record ${pathologyId} not found`);
    }

    return updated;
  }

  async getBiomarkerSummary(tenantDb: DataSource, caseId: string) {
    const rows = await tenantDb.query(
      `
        SELECT
          op.*,
          (u.first_name || ' ' || u.last_name) AS pathologist_name
        FROM oncology_pathology op
        LEFT JOIN users u ON u.id = op.pathologist_id
        WHERE op.oncology_case_id = $1
        ORDER BY op.specimen_date DESC NULLS LAST, op.created_at DESC
      `,
      [caseId],
    );

    if (!rows.length) {
      return { latest: null, history: [] };
    }

    return {
      latest: rows[0],
      history: rows,
    };
  }

  async recordResponseAssessment(
    tenantDb: DataSource,
    caseId: string,
    dto: CreateResponseAssessmentDto,
    userId?: string,
  ) {
    if (!dto.assessmentDate) {
      throw new BadRequestException('assessmentDate is required');
    }

    if (dto.regimenId) {
      const [regimenCheck] = await tenantDb.query(
        `SELECT id FROM oncology_regimens WHERE id = $1 AND oncology_case_id = $2`,
        [dto.regimenId, caseId],
      );
      if (!regimenCheck) {
        throw new BadRequestException('Regimen does not belong to this case');
      }
    }

    const [created] = await tenantDb.query(
      `
        INSERT INTO oncology_response_assessments (
          oncology_case_id,
          regimen_id,
          assessment_date,
          assessment_type,
          recist_response,
          best_overall_response,
          target_lesions_count,
          target_lesions_size_cm,
          non_target_lesions_status,
          new_lesions,
          assessed_by,
          notes,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3::date,
          $4,
          $5,
          COALESCE($6, $5),
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          NOW(),
          NOW()
        )
        RETURNING *
      `,
      [
        caseId,
        dto.regimenId ?? null,
        dto.assessmentDate,
        dto.assessmentType,
        dto.recistResponse ?? null,
        dto.bestOverallResponse ?? null,
        dto.targetLesionsCount ?? null,
        dto.targetLesionsSizeCm ?? null,
        dto.nonTargetLesionsStatus ?? null,
        typeof dto.newLesions === 'boolean' ? dto.newLesions : null,
        userId ?? null,
        dto.notes ?? null,
      ],
    );

    return created;
  }

  async getResponseHistory(tenantDb: DataSource, caseId: string) {
    return tenantDb.query(
      `
        SELECT
          ora.*,
          (u.first_name || ' ' || u.last_name) AS assessed_by_name,
          reg.regimen_name
        FROM oncology_response_assessments ora
        LEFT JOIN users u ON u.id = ora.assessed_by
        LEFT JOIN oncology_regimens reg ON reg.id = ora.regimen_id
        WHERE ora.oncology_case_id = $1
        ORDER BY ora.assessment_date DESC, ora.created_at DESC
      `,
      [caseId],
    );
  }

  async calculateResponseAssessmentRecist(
    tenantDb: DataSource,
    caseId: string,
    assessmentId: string,
    dto: CalculateAssessmentRecistDto,
  ) {
    const [current] = await tenantDb.query(
      `SELECT * FROM oncology_response_assessments WHERE id = $1 AND oncology_case_id = $2`,
      [assessmentId, caseId],
    );
    if (!current) {
      throw new NotFoundException(`Response assessment ${assessmentId} not found`);
    }

    const baselineId = dto.baselineAssessmentId;
    const [baseline] = baselineId
      ? await tenantDb.query(
          `SELECT * FROM oncology_response_assessments WHERE id = $1 AND oncology_case_id = $2`,
          [baselineId, caseId],
        )
      : await tenantDb.query(
          `
            SELECT *
            FROM oncology_response_assessments
            WHERE oncology_case_id = $1
            ORDER BY assessment_date ASC, created_at ASC
            LIMIT 1
          `,
          [caseId],
        );

    if (!baseline || baseline.id === current.id) {
      return {
        assessmentId: current.id,
        baselineAssessmentId: baseline?.id ?? null,
        percentChange: null,
        recistResponse: 'NE',
      };
    }

    if (
      current.target_lesions_size_cm === null ||
      current.target_lesions_size_cm === undefined ||
      !baseline.target_lesions_size_cm
    ) {
      return {
        assessmentId: current.id,
        baselineAssessmentId: baseline.id,
        percentChange: null,
        recistResponse: 'NE',
      };
    }

    const baselineSize = Number(baseline.target_lesions_size_cm);
    const currentSize = Number(current.target_lesions_size_cm);
    if (!Number.isFinite(baselineSize) || baselineSize === 0) {
      return {
        assessmentId: current.id,
        baselineAssessmentId: baseline.id,
        percentChange: null,
        recistResponse: 'NE',
      };
    }

    const percentChange = ((currentSize - baselineSize) / baselineSize) * 100;
    let recist: (typeof RECIST_RESPONSES)[number] = 'SD';
    if (current.new_lesions) {
      recist = 'PD';
    } else if (current.target_lesions_count === 0 || currentSize <= 0.1) {
      recist = 'CR';
    } else if (percentChange <= -30) {
      recist = 'PR';
    } else if (percentChange >= 20) {
      recist = 'PD';
    }

    const [updated] = await tenantDb.query(
      `
        UPDATE oncology_response_assessments
        SET recist_response = $1,
            best_overall_response = CASE
              WHEN best_overall_response IS NULL THEN $1
              ELSE best_overall_response
            END,
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `,
      [recist, assessmentId],
    );

    return {
      assessment: updated,
      percentChange: Number(percentChange.toFixed(2)),
      baselineAssessmentId: baseline.id,
    };
  }

  async getBestOverallResponse(tenantDb: DataSource, caseId: string) {
    const [latest] = await tenantDb.query(
      `
        SELECT recist_response, assessment_date, best_overall_response
        FROM oncology_response_assessments
        WHERE oncology_case_id = $1
        ORDER BY assessment_date DESC, created_at DESC
        LIMIT 1
      `,
      [caseId],
    );

    const distribution = await tenantDb.query(
      `
        SELECT
          recist_response,
          COUNT(*)::int AS count
        FROM oncology_response_assessments
        WHERE oncology_case_id = $1
        GROUP BY recist_response
      `,
      [caseId],
    );

    const progression = await tenantDb.query(
      `
        SELECT assessment_date
        FROM oncology_response_assessments
        WHERE oncology_case_id = $1
          AND (recist_response = 'PD' OR new_lesions = true)
        ORDER BY assessment_date ASC
        LIMIT 1
      `,
      [caseId],
    );

    return {
      latest,
      distribution,
      firstProgressionDate: progression[0]?.assessment_date ?? null,
    };
  }

  async getSurvivalMetrics(tenantDb: DataSource, caseId: string) {
    const [caseRow] = await tenantDb.query(
      `
        SELECT diagnosis_date, status, updated_at
        FROM oncology_cases
        WHERE id = $1
      `,
      [caseId],
    );

    const [baseline] = await tenantDb.query(
      `
        SELECT assessment_date
        FROM oncology_response_assessments
        WHERE oncology_case_id = $1
        ORDER BY assessment_date ASC, created_at ASC
        LIMIT 1
      `,
      [caseId],
    );

    const [progression] = await tenantDb.query(
      `
        SELECT assessment_date
        FROM oncology_response_assessments
        WHERE oncology_case_id = $1
          AND (recist_response = 'PD' OR new_lesions = true)
        ORDER BY assessment_date ASC
        LIMIT 1
      `,
      [caseId],
    );

    const now = new Date();
    const baselineDate = baseline?.assessment_date ? new Date(baseline.assessment_date) : caseRow?.diagnosis_date ? new Date(caseRow.diagnosis_date) : null;

    const progressionDate = progression?.assessment_date ? new Date(progression.assessment_date) : null;

    const pfsDays =
      baselineDate && progressionDate
        ? Math.max(0, Math.round((progressionDate.getTime() - baselineDate.getTime()) / (1000 * 60 * 60 * 24)))
        : baselineDate
        ? Math.max(0, Math.round((now.getTime() - baselineDate.getTime()) / (1000 * 60 * 60 * 24)))
        : null;

    const deathDate =
      caseRow?.status === 'deceased' && caseRow.updated_at ? new Date(caseRow.updated_at) : null;
    const diagnosisDate = caseRow?.diagnosis_date ? new Date(caseRow.diagnosis_date) : baselineDate;

    const osDays =
      diagnosisDate && deathDate
        ? Math.max(0, Math.round((deathDate.getTime() - diagnosisDate.getTime()) / (1000 * 60 * 60 * 24)))
        : diagnosisDate
        ? Math.max(0, Math.round((now.getTime() - diagnosisDate.getTime()) / (1000 * 60 * 60 * 24)))
        : null;

    return {
      diagnosisDate: caseRow?.diagnosis_date ?? null,
      baselineAssessmentDate: baseline?.assessment_date ?? null,
      progressionDate: progression?.assessment_date ?? null,
      status: caseRow?.status ?? null,
      progressionFreeSurvivalDays: pfsDays,
      overallSurvivalDays: osDays,
      isProgressed: Boolean(progressionDate),
      isDeceased: caseRow?.status === 'deceased',
    };
  }

  private serializeJson(value?: Record<string, any> | null) {
    return value ? JSON.stringify(value) : null;
  }

  private serializeStringArray(value?: string[] | null) {
    return value && value.length ? value : null;
  }

  private parseJsonObject(value: any) {
    if (!value) {
      return null;
    }
    if (typeof value === 'object') {
      return value;
    }
    try {
      return JSON.parse(String(value));
    } catch {
      return null;
    }
  }

  private isMissingTableError(error: any): boolean {
    return ['42P01', '42703'].includes(error?.code);
  }

  private getUserDisplayName(user: {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    id?: string;
  }) {
    const fullName = String(user.fullName || '').trim();
    if (fullName) {
      return fullName;
    }
    const composed = `${String(user.firstName || '').trim()} ${String(user.lastName || '').trim()}`.trim();
    if (composed) {
      return composed;
    }
    return String(user.email || user.id || 'Clinician');
  }

  private buildProtocolCitation(ruleId: string, citation: string, source = 'ASCO/NCCN oncology protocol') {
    return {
      rule_id: ruleId,
      source,
      citation,
    };
  }

  private normalizeProtocolCitations(citations: Array<{ rule_id: string; source: string; citation: string } | null | undefined>) {
    const deduped = new Map<string, { rule_id: string; source: string; citation: string }>();
    for (const citation of citations) {
      if (!citation?.citation) {
        continue;
      }
      const key = `${citation.rule_id}:${citation.citation}`;
      if (!deduped.has(key)) {
        deduped.set(key, citation);
      }
    }
    return Array.from(deduped.values());
  }

  private async safeQuery(tenantDb: DataSource, sql: string, params: any[] = []) {
    try {
      return await tenantDb.query(sql, params);
    } catch (error) {
      if (!this.isMissingTableError(error)) {
        throw error;
      }
      return [];
    }
  }

  private async getOncologyProtocolWorkflowContext(tenantDb: DataSource, caseId: string) {
    const workflowKey = `oncology-protocol:${caseId}`;
    const rows = await this.safeQuery(
      tenantDb,
      `
      SELECT status, context
      FROM nurse_cross_module_workflow_state
      WHERE workflow_key = $1
      LIMIT 1
      `,
      [workflowKey],
    );
    const row = rows[0] || null;
    return {
      workflowKey,
      status: String(row?.status || 'pending').toLowerCase(),
      context: this.parseJsonObject(row?.context) || {},
    };
  }

  private applyOncologyProtocolExecutionState(bundle: any, workflowContext: any) {
    if (!bundle || typeof bundle !== 'object') {
      return bundle;
    }

    const actionExecutions =
      workflowContext && typeof workflowContext === 'object' && workflowContext.action_executions
        ? workflowContext.action_executions
        : {};

    const items = Array.isArray(bundle.items)
      ? bundle.items.map((item: any) => {
          const execution = item?.id ? actionExecutions?.[item.id] : null;
          if (!execution) {
            return item;
          }
          return {
            ...item,
            execution_status: execution.status || 'completed',
            executed_at: execution.executed_at || null,
            executed_by_name: execution.executed_by_name || null,
            execution_result: execution.result || null,
          };
        })
      : [];

    const appliedCount = items.filter((item: any) => item?.execution_status === 'completed').length;

    return {
      ...bundle,
      items,
      actionable_count: items.length,
      pending_count: Math.max(items.length - appliedCount, 0),
      applied_count: appliedCount,
    };
  }

  private async persistOncologyProtocolExecution(
    tenantDb: DataSource,
    caseId: string,
    user: {
      id: string;
      fullName?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
    },
    actionId: string,
    executionResult: any,
  ) {
    const { workflowKey, context } = await this.getOncologyProtocolWorkflowContext(tenantDb, caseId);
    const mergedContext = {
      ...(context && typeof context === 'object' ? context : {}),
      source: 'oncology_protocol_bundle',
      action_executions: {
        ...((context && typeof context === 'object' ? context.action_executions : {}) || {}),
        [actionId]: {
          status: 'completed',
          executed_at: new Date().toISOString(),
          executed_by: user.id,
          executed_by_name: this.getUserDisplayName(user),
          result: executionResult,
        },
      },
    };

    try {
      await tenantDb.query(
        `
        INSERT INTO nurse_cross_module_workflow_state (
          workflow_key,
          module,
          item_type,
          source_record_id,
          status,
          destination_role,
          destination_service,
          destination_specialty,
          destination_user_id,
          acknowledged_by,
          acknowledged_at,
          note,
          context,
          updated_at
        )
        VALUES (
          $1, 'oncology', 'oncology_protocol_bundle', $2, 'acknowledged',
          'doctor', 'oncology', 'Oncology', $3, $3, NOW(), $4, $5::jsonb, NOW()
        )
        ON CONFLICT (workflow_key)
        DO UPDATE SET
          module = 'oncology',
          item_type = 'oncology_protocol_bundle',
          source_record_id = EXCLUDED.source_record_id,
          status = CASE
            WHEN nurse_cross_module_workflow_state.status = 'completed' THEN nurse_cross_module_workflow_state.status
            ELSE 'acknowledged'
          END,
          destination_role = COALESCE(nurse_cross_module_workflow_state.destination_role, 'doctor'),
          destination_service = COALESCE(nurse_cross_module_workflow_state.destination_service, 'oncology'),
          destination_specialty = COALESCE(nurse_cross_module_workflow_state.destination_specialty, 'Oncology'),
          destination_user_id = COALESCE(EXCLUDED.destination_user_id, nurse_cross_module_workflow_state.destination_user_id),
          acknowledged_by = COALESCE(nurse_cross_module_workflow_state.acknowledged_by, EXCLUDED.acknowledged_by),
          acknowledged_at = COALESCE(nurse_cross_module_workflow_state.acknowledged_at, EXCLUDED.acknowledged_at),
          note = EXCLUDED.note,
          context = EXCLUDED.context,
          updated_at = NOW()
        `,
        [
          workflowKey,
          caseId,
          user.id,
          `Executed oncology protocol action: ${actionId}`,
          JSON.stringify(mergedContext),
        ],
      );
    } catch (error) {
      if (!this.isMissingTableError(error)) {
        throw error;
      }
    }
  }

  private appendCasePlanNote(existingPlan: string | null | undefined, marker: string, noteLine: string) {
    const normalizedExisting = String(existingPlan || '');
    if (normalizedExisting.includes(marker)) {
      return { reused: true, nextPlan: normalizedExisting };
    }
    const nextPlan = normalizedExisting.length > 0 ? `${normalizedExisting}\n${noteLine}` : noteLine;
    return { reused: false, nextPlan };
  }

  async createSurvivorshipPlan(
    tenantDb: DataSource,
    caseId: string,
    dto: CreateSurvivorshipPlanDto,
    userId?: string,
  ) {
    const [existing] = await tenantDb.query(
      `SELECT id FROM oncology_survivorship_plans WHERE oncology_case_id = $1 LIMIT 1`,
      [caseId],
    );

    if (existing) {
      return this.updateSurvivorshipPlan(tenantDb, existing.id, dto);
    }

    const [plan] = await tenantDb.query(
      `
        INSERT INTO oncology_survivorship_plans (
          oncology_case_id,
          treatment_completion_date,
          follow_up_schedule,
          surveillance_imaging_schedule,
          long_term_side_effects,
          recurrence_risk,
          lifestyle_recommendations,
          created_by,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2::date,
          COALESCE($3::jsonb, '{}'::jsonb),
          COALESCE($4::jsonb, '{}'::jsonb),
          $5,
          $6,
          $7,
          $8,
          NOW(),
          NOW()
        )
        RETURNING *
      `,
      [
        caseId,
        dto.treatmentCompletionDate ?? null,
        this.serializeJson(dto.followUpSchedule),
        this.serializeJson(dto.surveillanceImagingSchedule),
        this.serializeStringArray(dto.longTermSideEffects),
        dto.recurrenceRisk ?? null,
        dto.lifestyleRecommendations ?? null,
        userId ?? null,
      ],
    );

    return plan;
  }

  async getSurvivorshipPlan(tenantDb: DataSource, caseId: string) {
    const [plan] = await tenantDb.query(
      `
        SELECT
          osp.*,
          (u.first_name || ' ' || u.last_name) AS created_by_name
        FROM oncology_survivorship_plans osp
        LEFT JOIN users u ON u.id = osp.created_by
        WHERE osp.oncology_case_id = $1
        ORDER BY osp.created_at DESC
        LIMIT 1
      `,
      [caseId],
    );

    return plan ?? null;
  }

  async updateSurvivorshipPlan(
    tenantDb: DataSource,
    planId: string,
    dto: UpdateSurvivorshipPlanDto,
  ) {
    const updates: string[] = [];
    const params: any[] = [];

    if (dto.treatmentCompletionDate !== undefined) {
      updates.push(`treatment_completion_date = $${params.length + 1}::date`);
      params.push(dto.treatmentCompletionDate ?? null);
    }
    if (dto.followUpSchedule !== undefined) {
      updates.push(`follow_up_schedule = COALESCE($${params.length + 1}::jsonb, '{}'::jsonb)`);
      params.push(this.serializeJson(dto.followUpSchedule));
    }
    if (dto.surveillanceImagingSchedule !== undefined) {
      updates.push(`surveillance_imaging_schedule = COALESCE($${params.length + 1}::jsonb, '{}'::jsonb)`);
      params.push(this.serializeJson(dto.surveillanceImagingSchedule));
    }
    if (dto.longTermSideEffects !== undefined) {
      updates.push(`long_term_side_effects = $${params.length + 1}`);
      params.push(this.serializeStringArray(dto.longTermSideEffects));
    }
    if (dto.recurrenceRisk !== undefined) {
      updates.push(`recurrence_risk = $${params.length + 1}`);
      params.push(dto.recurrenceRisk ?? null);
    }
    if (dto.lifestyleRecommendations !== undefined) {
      updates.push(`lifestyle_recommendations = $${params.length + 1}`);
      params.push(dto.lifestyleRecommendations ?? null);
    }

    if (!updates.length) {
      throw new BadRequestException('No fields to update');
    }

    updates.push(`updated_at = NOW()`);

    const [updated] = await tenantDb.query(
      `
        UPDATE oncology_survivorship_plans
        SET ${updates.join(', ')}
        WHERE id = $${params.length + 1}
        RETURNING *
      `,
      [...params, planId],
    );

    if (!updated) {
      throw new NotFoundException(`Survivorship plan ${planId} not found`);
    }

    return updated;
  }

  private addMonthsToDate(date: Date, months: number) {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  private monthsBetween(start: Date, end: Date) {
    const millisecondsPerMonth = 1000 * 60 * 60 * 24 * 30.4375;
    return Number(((end.getTime() - start.getTime()) / millisecondsPerMonth).toFixed(2));
  }

  private median(values: number[]) {
    if (!values.length) {
      return null;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));
    }
    return Number(sorted[mid].toFixed(2));
  }

  async getUpcomingFollowUps(tenantDb: DataSource, caseId: string) {
    const plan = await this.getSurvivorshipPlan(tenantDb, caseId);
    if (!plan) {
      return [];
    }

    const visits: any[] = plan.follow_up_schedule?.visits ?? [];
    const startDate = plan.treatment_completion_date ? new Date(plan.treatment_completion_date) : new Date();
    const now = new Date();
    const horizon = this.addMonthsToDate(now, 6);

    const events: Array<{
      dueDate: string;
      intervalMonths: number;
      tests?: string[];
      imaging?: string[];
    }> = [];

    visits.forEach((visit) => {
      const interval = Number(visit.interval_months ?? 3);
      const duration = Number(visit.duration_months ?? 24);
      const iterations = Math.max(1, Math.floor(duration / interval));

      for (let i = 0; i < iterations; i++) {
        const due = this.addMonthsToDate(startDate, interval * (i + 1));
        if (due >= now && due <= horizon) {
          events.push({
            dueDate: due.toISOString(),
            intervalMonths: interval,
            tests: visit.tests ?? visit.tests ?? [],
            imaging: visit.imaging ?? visit.imaging ?? [],
          });
        }
      }
    });

    return events
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 10);
  }

  async generateSurvivorshipReport(tenantDb: DataSource, caseId: string) {
    const plan = await this.getSurvivorshipPlan(tenantDb, caseId);
    if (!plan) {
      throw new NotFoundException(`Survivorship plan not found for case ${caseId}`);
    }

    const upcoming = await this.getUpcomingFollowUps(tenantDb, caseId);
    const responseSummary = await this.getBestOverallResponse(tenantDb, caseId);
    const survivalMetrics = await this.getSurvivalMetrics(tenantDb, caseId);

    return {
      plan,
      upcomingFollowUps: upcoming,
      responseSummary,
      survivalMetrics,
    };
  }

  async enrollInTrial(
    tenantDb: DataSource,
    caseId: string,
    dto: EnrollClinicalTrialDto,
    userId?: string,
  ) {
    const [trial] = await tenantDb.query(
      `
        INSERT INTO oncology_clinical_trials (
          oncology_case_id,
          trial_name,
          trial_id,
          trial_phase,
          enrollment_date,
          enrollment_status,
          protocol_compliance_percentage,
          trial_endpoints,
          notes,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5::date,
          COALESCE($6,'screening'),
          $7,
          COALESCE($8::jsonb,'{}'::jsonb),
          $9,
          NOW(),
          NOW()
        )
        RETURNING *
      `,
      [
        caseId,
        dto.trialName,
        dto.trialId ?? null,
        dto.trialPhase ?? null,
        dto.enrollmentDate ?? null,
        dto.enrollmentStatus ?? 'screening',
        dto.protocolCompliancePercentage ?? null,
        dto.trialEndpoints ? JSON.stringify(dto.trialEndpoints) : null,
        dto.notes ?? null,
      ],
    );

    this.logger.log(`Enrolled case ${caseId} into trial ${trial.trial_name} by ${userId ?? 'system'}`);
    return trial;
  }

  async getTrialHistory(tenantDb: DataSource, caseId: string) {
    return tenantDb.query(
      `
        SELECT *
        FROM oncology_clinical_trials
        WHERE oncology_case_id = $1
        ORDER BY enrollment_date DESC NULLS LAST, created_at DESC
      `,
      [caseId],
    );
  }

  async updateTrialStatus(
    tenantDb: DataSource,
    trialId: string,
    dto: UpdateClinicalTrialStatusDto,
  ) {
    const [updated] = await tenantDb.query(
      `
        UPDATE oncology_clinical_trials
        SET enrollment_status = $2,
            protocol_compliance_percentage = COALESCE($3, protocol_compliance_percentage),
            trial_endpoints = COALESCE($4::jsonb, trial_endpoints),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        trialId,
        dto.enrollmentStatus,
        dto.protocolCompliancePercentage ?? null,
        dto.trialEndpoints ? JSON.stringify(dto.trialEndpoints) : null,
      ],
    );

    if (!updated) {
      throw new NotFoundException(`Clinical trial ${trialId} not found`);
    }
    return updated;
  }

  async trackTrialCompliance(
    tenantDb: DataSource,
    trialId: string,
    dto: RecordTrialComplianceDto,
  ) {
    return this.updateTrialStatus(tenantDb, trialId, {
      enrollmentStatus: 'on_treatment',
      protocolCompliancePercentage: dto.protocolCompliancePercentage,
      trialEndpoints: dto.trialEndpoints,
    });
  }

  async getTrialEndpoints(tenantDb: DataSource, trialId: string) {
    const [trial] = await tenantDb.query(
      `SELECT trial_endpoints FROM oncology_clinical_trials WHERE id = $1`,
      [trialId],
    );
    if (!trial) {
      throw new NotFoundException(`Clinical trial ${trialId} not found`);
    }
    return trial.trial_endpoints ?? {};
  }

  async recordPatientReportedOutcome(
    tenantDb: DataSource,
    caseId: string,
    dto: RecordPatientReportedOutcomeDto,
  ) {
    const [record] = await tenantDb.query(
      `
        INSERT INTO oncology_patient_reported_outcomes (
          oncology_case_id,
          assessment_date,
          assessment_type,
          assessment_data,
          total_score,
          domain_scores,
          completed_by_patient,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2::date,
          $3,
          $4::jsonb,
          $5,
          COALESCE($6::jsonb, '{}'::jsonb),
          COALESCE($7, true),
          NOW(),
          NOW()
        )
        RETURNING *
      `,
      [
        caseId,
        dto.assessmentDate,
        dto.assessmentType,
        JSON.stringify(dto.assessmentData),
        dto.totalScore ?? null,
        dto.domainScores ? JSON.stringify(dto.domainScores) : null,
        dto.completedByPatient ?? true,
      ],
    );

    return record;
  }

  async getProHistory(tenantDb: DataSource, caseId: string, query: ProHistoryQueryDto) {
    const params: any[] = [caseId];
    const conditions: string[] = ['oncology_case_id = $1'];
    if (query.assessmentType) {
      conditions.push(`assessment_type = $2`);
      params.push(query.assessmentType);
    }

    return tenantDb.query(
      `
        SELECT *
        FROM oncology_patient_reported_outcomes
        WHERE ${conditions.join(' AND ')}
        ORDER BY assessment_date DESC, created_at DESC
      `,
      params,
    );
  }

  async getProTrends(tenantDb: DataSource, caseId: string) {
    return tenantDb.query(
      `
        SELECT
          assessment_type,
          assessment_date,
          total_score,
          domain_scores
        FROM oncology_patient_reported_outcomes
        WHERE oncology_case_id = $1
        ORDER BY assessment_date ASC, created_at ASC
      `,
      [caseId],
    );
  }

  async calculateProScore(tenantDb: DataSource, proId: string) {
    const [record] = await tenantDb.query(
      `SELECT * FROM oncology_patient_reported_outcomes WHERE id = $1`,
      [proId],
    );
    if (!record) {
      throw new NotFoundException(`PRO record ${proId} not found`);
    }
    if (record.total_score !== null && record.total_score !== undefined) {
      return record;
    }

    const data = record.assessment_data ?? {};
    const numericValues = Object.values(data)
      .map((value: any) => Number(value))
      .filter((value) => Number.isFinite(value));
    const totalScore = numericValues.length
      ? Number((numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length).toFixed(2))
      : null;

    const [updated] = await tenantDb.query(
      `UPDATE oncology_patient_reported_outcomes SET total_score = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [proId, totalScore],
    );
    return updated;
  }

  async recordGenomicData(
    tenantDb: DataSource,
    caseId: string,
    dto: RecordGenomicDataDto,
  ) {
    const [pathology] = await tenantDb.query(
      `SELECT id FROM oncology_pathology WHERE id = $1 AND oncology_case_id = $2`,
      [dto.pathologyId, caseId],
    );
    if (!pathology) {
      throw new BadRequestException('Pathology record does not belong to this case');
    }

    const [updated] = await tenantDb.query(
      `
        UPDATE oncology_pathology
        SET genomic_data = COALESCE(genomic_data, '{}'::jsonb) || $2::jsonb,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [dto.pathologyId, JSON.stringify(dto.genomicData)],
    );

    return updated;
  }

  async getGenomicSummary(tenantDb: DataSource, caseId: string) {
    const rows = await tenantDb.query(
      `
        SELECT
          id,
          specimen_date,
          histology_type,
          biomarkers,
          genetic_testing,
          genomic_data
        FROM oncology_pathology
        WHERE oncology_case_id = $1 AND (genomic_data IS NOT NULL AND genomic_data <> '{}'::jsonb)
        ORDER BY specimen_date DESC NULLS LAST, created_at DESC
      `,
      [caseId],
    );
    return rows;
  }

  private targetedTherapyLibrary = [
    { biomarker: 'HER2', therapy: 'Trastuzumab / Pertuzumab', cancerTypes: ['breast', 'gastric'] },
    { biomarker: 'EGFR', therapy: 'Osimertinib', cancerTypes: ['nsclc'] },
    { biomarker: 'ALK', therapy: 'Alectinib', cancerTypes: ['nsclc'] },
    { biomarker: 'BRAF', therapy: 'Dabrafenib + Trametinib', cancerTypes: ['melanoma', 'thyroid'] },
    { biomarker: 'PD-L1', therapy: 'Pembrolizumab', cancerTypes: ['nsclc', 'gastric', 'cervical'] },
  ];

  async matchTargetedTherapies(tenantDb: DataSource, caseId: string) {
    const genomicRecords = await this.getGenomicSummary(tenantDb, caseId);
    if (!genomicRecords.length) {
      return [];
    }

    const recommendations: Array<{ biomarker: string; therapy: string; rationale: string }> = [];
    genomicRecords.forEach((record) => {
      const genomicData = record.genomic_data || {};
      Object.entries(genomicData).forEach(([key, value]) => {
        if (!value) return;
        const normalizedKey = key.toString().toUpperCase();
        const match = this.targetedTherapyLibrary.find((entry) => normalizedKey.includes(entry.biomarker.toUpperCase()));
        if (match) {
          recommendations.push({
            biomarker: key,
            therapy: match.therapy,
            rationale: `Detected ${key} with value ${String(value)}. Evidence supports ${match.therapy}.`,
          });
        }
      });
    });

    return recommendations;
  }

  async getResponseRates(tenantDb: DataSource, filters: OncologyAnalyticsQueryDto = {}) {
    const params: any[] = [];
    const clauses: string[] = [];
    clauses.push(...this.appendDateRangeFilters('ora.assessment_date', filters, params));
    clauses.push(...this.appendCaseAnalyticsFilters(filters, params));
    const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const distribution = await tenantDb.query(
      `
        SELECT
          ora.recist_response,
          COUNT(*)::int AS count,
          COUNT(*) FILTER (WHERE ora.new_lesions IS TRUE)::int AS with_new_lesions
        FROM oncology_response_assessments ora
        INNER JOIN oncology_cases oc ON oc.id = ora.oncology_case_id
        ${whereClause}
        GROUP BY ora.recist_response
      `,
      params,
    );

    const bestResponses = await tenantDb.query(
      `
        SELECT
          COALESCE(NULLIF(ora.best_overall_response, ''), 'Not captured') AS best_overall_response,
          COUNT(*)::int AS count
        FROM oncology_response_assessments ora
        INNER JOIN oncology_cases oc ON oc.id = ora.oncology_case_id
        ${whereClause}
        GROUP BY best_overall_response
      `,
      params,
    );

    const total = distribution.reduce((sum, row) => sum + Number(row.count), 0);
    const objective =
      distribution
        .filter((row) => ['CR', 'PR'].includes(row.recist_response))
        .reduce((sum, row) => sum + Number(row.count), 0) ?? 0;
    const diseaseControl =
      distribution
        .filter((row) => ['CR', 'PR', 'SD'].includes(row.recist_response))
        .reduce((sum, row) => sum + Number(row.count), 0) ?? 0;
    const newLesions =
      distribution.reduce((sum, row) => sum + Number(row.with_new_lesions ?? 0), 0) ?? 0;

    return {
      totalAssessments: total,
      overallResponseRate: total ? Number(((objective / total) * 100).toFixed(1)) : 0,
      diseaseControlRate: total ? Number(((diseaseControl / total) * 100).toFixed(1)) : 0,
      newLesionRate: total ? Number(((newLesions / total) * 100).toFixed(1)) : 0,
      responseDistribution: distribution,
      bestOverallResponseDistribution: bestResponses,
    };
  }

  async getSurvivalAnalytics(tenantDb: DataSource, filters: OncologyAnalyticsQueryDto = {}) {
    const params: any[] = [];
    const clauses = this.appendCaseAnalyticsFilters(filters, params);
    const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await tenantDb.query(
      `
        SELECT
          oc.id,
          oc.diagnosis_date,
          oc.status,
          oc.updated_at,
          MAX(ora.assessment_date) FILTER (WHERE ora.recist_response = 'PD') AS progression_date,
          MAX(ora.assessment_date) AS last_assessment_date
        FROM oncology_cases oc
        LEFT JOIN oncology_response_assessments ora ON ora.oncology_case_id = oc.id
        ${whereClause}
        GROUP BY oc.id
      `,
      params,
    );

    const now = new Date();
    const pfsDurations: number[] = [];
    const osDurations: number[] = [];
    let casesWithStart = 0;

    rows.forEach((row) => {
      if (!row.diagnosis_date) {
        return;
      }
      const diagnosisDate = new Date(row.diagnosis_date);
      casesWithStart += 1;

      const progressionDate = row.progression_date ? new Date(row.progression_date) : null;
      const lastAssessment = row.last_assessment_date ? new Date(row.last_assessment_date) : null;
      const pfsEnd = progressionDate ?? lastAssessment ?? now;
      pfsDurations.push(this.monthsBetween(diagnosisDate, pfsEnd));

      const survivalEnd =
        row.status === 'deceased'
          ? new Date(row.updated_at ?? pfsEnd)
          : now;
      osDurations.push(this.monthsBetween(diagnosisDate, survivalEnd));
    });

    const medianPfs = this.median(pfsDurations);
    const medianOs = this.median(osDurations);

    const survivalRates = {
      oneYear:
        casesWithStart === 0
          ? 0
          : Number(
              (
                (osDurations.filter((duration) => duration >= 12).length / casesWithStart) *
                100
              ).toFixed(1),
            ),
      twoYear:
        casesWithStart === 0
          ? 0
          : Number(
              (
                (osDurations.filter((duration) => duration >= 24).length / casesWithStart) *
                100
              ).toFixed(1),
            ),
      fiveYear:
        casesWithStart === 0
          ? 0
          : Number(
              (
                (osDurations.filter((duration) => duration >= 60).length / casesWithStart) *
                100
              ).toFixed(1),
            ),
    };

    return {
      caseCount: rows.length,
      withDiagnosisDate: casesWithStart,
      medianPfsMonths: medianPfs,
      medianOsMonths: medianOs,
      survivalRates,
      pfsDurations,
      osDurations,
    };
  }

  async getBiomarkerAnalytics(tenantDb: DataSource, filters: OncologyAnalyticsQueryDto = {}) {
    const params: any[] = [];
    const clauses = this.appendCaseAnalyticsFilters(filters, params, 'oc');
    const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const rows = await tenantDb.query(
      `
        SELECT
          op.oncology_case_id,
          op.biomarkers,
          op.genetic_testing,
          op.genomic_data,
          oc.primary_diagnosis,
          oc.overall_stage
        FROM oncology_pathology op
        INNER JOIN oncology_cases oc ON oc.id = op.oncology_case_id
        ${whereClause}
      `,
      params,
    );

    const biomarkerCounts: Record<string, number> = {};
    const genomicHighlights: Record<string, number> = {};

    rows.forEach((row) => {
      const biomarkers = row.biomarkers ?? {};
      Object.keys(biomarkers).forEach((key) => {
        if (!key) return;
        const normalized = key.toUpperCase();
        biomarkerCounts[normalized] = (biomarkerCounts[normalized] || 0) + 1;
      });

      const genomics = row.genomic_data ?? {};
      Object.keys(genomics).forEach((key) => {
        if (!key) return;
        const normalized = key.toUpperCase();
        genomicHighlights[normalized] = (genomicHighlights[normalized] || 0) + 1;
      });
    });

    const topBiomarkers = Object.entries(biomarkerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([marker, count]) => ({ marker, count }));

    const genomicSignals = Object.entries(genomicHighlights)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([marker, count]) => ({ marker, count }));

    return {
      caseCount: rows.length,
      topBiomarkers,
      genomicSignals,
    };
  }

  async getTrialAnalytics(tenantDb: DataSource, filters: OncologyAnalyticsQueryDto = {}) {
    const params: any[] = [];
    const clauses = this.appendCaseAnalyticsFilters(filters, params, 'oc');
    const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const trials = await tenantDb.query(
      `
        SELECT
          oct.*,
          oc.primary_diagnosis
        FROM oncology_clinical_trials oct
        INNER JOIN oncology_cases oc ON oc.id = oct.oncology_case_id
        ${whereClause}
      `,
      params,
    );

    const statusBreakdown: Record<string, number> = {};
    let totalCompliance = 0;
    let complianceCount = 0;
    const enrollmentTrend: Record<string, number> = {};

    trials.forEach((trial) => {
      const status = trial.enrollment_status || 'screening';
      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
      if (trial.protocol_compliance_percentage !== null && trial.protocol_compliance_percentage !== undefined) {
        totalCompliance += Number(trial.protocol_compliance_percentage);
        complianceCount += 1;
      }

      if (trial.enrollment_date) {
        const monthKey = trial.enrollment_date.slice(0, 7);
        enrollmentTrend[monthKey] = (enrollmentTrend[monthKey] || 0) + 1;
      }
    });

    const trendPoints = Object.entries(enrollmentTrend)
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map(([month, count]) => ({ month, count }));

    return {
      trialCount: trials.length,
      statusBreakdown,
      averageCompliance: complianceCount ? Number((totalCompliance / complianceCount).toFixed(1)) : null,
      enrollmentTrend: trendPoints,
    };
  }

  async trackFinancialToxicity(
    tenantDb: DataSource,
    caseId: string,
    dto: RecordFinancialToxicityDto,
  ) {
    const [record] = await tenantDb.query(
      `
        INSERT INTO oncology_financial_toxicity (
          oncology_case_id,
          assessment_date,
          total_cost_to_date,
          insurance_coverage_total,
          out_of_pocket_total,
          financial_assistance_total,
          financial_stress_score,
          notes,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2::date,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          NOW(),
          NOW()
        )
        RETURNING *
      `,
      [
        caseId,
        dto.assessmentDate,
        dto.totalCostToDate ?? null,
        dto.insuranceCoverageTotal ?? null,
        dto.outOfPocketTotal ?? null,
        dto.financialAssistanceTotal ?? null,
        dto.financialStressScore ?? null,
        dto.notes ?? null,
      ],
    );
    return record;
  }

  async getFinancialSummary(tenantDb: DataSource, caseId: string) {
    const [latest] = await tenantDb.query(
      `
        SELECT *
        FROM oncology_financial_toxicity
        WHERE oncology_case_id = $1
        ORDER BY assessment_date DESC NULLS LAST, created_at DESC
        LIMIT 1
      `,
      [caseId],
    );

    const history = await tenantDb.query(
      `
        SELECT
          assessment_date,
          total_cost_to_date,
          out_of_pocket_total,
          financial_stress_score
        FROM oncology_financial_toxicity
        WHERE oncology_case_id = $1
        ORDER BY assessment_date ASC NULLS LAST
      `,
      [caseId],
    );

    const [infusionStats] = await tenantDb.query(
      `
        SELECT
          COUNT(*)::int AS total_sessions,
          COUNT(*) FILTER (WHERE out_of_pocket_cost IS NOT NULL)::int AS sessions_with_cost,
          COALESCE(SUM(out_of_pocket_cost), 0)::numeric AS out_of_pocket_sum,
          AVG(insurance_coverage_percentage)::numeric AS average_coverage_percentage
        FROM oncology_infusion_sessions
        WHERE regimen_id IN (
          SELECT id FROM oncology_regimens WHERE oncology_case_id = $1
        )
      `,
      [caseId],
    );

    return {
      latestAssessment: latest ?? null,
      history,
      infusionStats: infusionStats ?? {},
      stressFlag: latest?.financial_stress_score ? latest.financial_stress_score >= 7 : false,
    };
  }

  async getFinancialAssistancePrograms(tenantDb: DataSource, caseId: string) {
    const programs = await tenantDb.query(
      `
        SELECT DISTINCT financial_assistance_program
        FROM oncology_infusion_sessions
        WHERE regimen_id IN (
          SELECT id FROM oncology_regimens WHERE oncology_case_id = $1
        )
          AND financial_assistance_program IS NOT NULL
      `,
      [caseId],
    );

    const suggestedPrograms = [
      {
        program: 'CancerCare Co-Pay Assistance',
        description: 'Covers co-payments for select IV and oral therapies.',
        contact: 'https://www.cancercare.org/financial',
      },
      {
        program: 'PAN Foundation Oncology Fund',
        description: 'Helps patients afford out-of-pocket costs for oncology regimens.',
        contact: 'https://panfoundation.org/',
      },
      {
        program: 'Manufacturer Patient Assistance',
        description: 'Drug-specific programs for targeted therapies and immunotherapies.',
        contact: 'Coordinate with pharmacy benefits team',
      },
    ];

    return {
      activePrograms: programs.map((row) => row.financial_assistance_program),
      suggestedPrograms,
    };
  }

  async generateTreatmentRecommendations(tenantDb: DataSource, caseId: string) {
    const [caseRow] = await tenantDb.query(`SELECT * FROM oncology_cases WHERE id = $1`, [caseId]);
    if (!caseRow) {
      throw new NotFoundException(`Oncology case ${caseId} not found`);
    }

    const [latestResponse] = await tenantDb.query(
      `
        SELECT *
        FROM oncology_response_assessments
        WHERE oncology_case_id = $1
        ORDER BY assessment_date DESC NULLS LAST, created_at DESC
        LIMIT 1
      `,
      [caseId],
    );

    const [pathology] = await tenantDb.query(
      `
        SELECT biomarkers, genomic_data, genetic_testing
        FROM oncology_pathology
        WHERE oncology_case_id = $1
        ORDER BY specimen_date DESC NULLS LAST, created_at DESC
        LIMIT 1
      `,
      [caseId],
    );

    const recommendations: Array<{ title: string; rationale: string; severity: 'info' | 'warning' | 'critical' }> = [];

    if (!latestResponse) {
      recommendations.push({
        title: 'Document baseline response assessment',
        rationale: 'No RECIST assessment recorded. Capture baseline measurements before therapy escalation.',
        severity: 'warning',
      });
    } else if (['SD', 'PD', 'NE'].includes(latestResponse.recist_response)) {
      recommendations.push({
        title: 'Evaluate alternative regimen',
        rationale: `Latest RECIST response is ${latestResponse.recist_response}. Consider switching therapy or escalating imaging frequency.`,
        severity: latestResponse.recist_response === 'PD' ? 'critical' : 'warning',
      });
    }

    const biomarkers = pathology?.biomarkers ?? {};
    const genomicData = pathology?.genomic_data ?? {};
    const biomarkerKeys = [
      ...Object.keys(biomarkers),
      ...Object.keys(genomicData),
    ].map((key) => key.toUpperCase());

    if (biomarkerKeys.some((key) => key.includes('HER2'))) {
      recommendations.push({
        title: 'HER2-targeted therapy',
        rationale: 'Detected HER2 biomarker. Consider trastuzumab±pertuzumab if patient not already on HER2 regimen.',
        severity: 'info',
      });
    }
    if (biomarkerKeys.some((key) => key.includes('PD-L1'))) {
      recommendations.push({
        title: 'Immunotherapy consideration',
        rationale: 'PD-L1 expression detected. Evaluate eligibility for checkpoint inhibitors.',
        severity: 'info',
      });
    }

    if (!caseRow.care_plan) {
      recommendations.push({
        title: 'Document personalized care plan',
        rationale: 'No narrative care plan captured for this case. Update care plan to reflect goals and survivorship considerations.',
        severity: 'warning',
      });
    }

    return {
      case: { id: caseRow.id, primary_diagnosis: caseRow.primary_diagnosis, status: caseRow.status },
      recommendations,
    };
  }

  async checkResponseStatus(tenantDb: DataSource, caseId: string) {
    const assessments = await this.getResponseHistory(tenantDb, caseId);
    if (!assessments.length) {
      return { latestAssessment: null, alerts: [] };
    }

    const latest = assessments[0];
    const alerts: Array<{ message: string; severity: 'info' | 'warning' | 'critical' }> = [];
    if (latest.recist_response === 'PD') {
      alerts.push({
        message: 'Progressive disease detected on latest assessment.',
        severity: 'critical',
      });
    } else if (latest.recist_response === 'SD') {
      alerts.push({
        message: 'Stable disease persists. Evaluate need for regimen modification.',
        severity: 'warning',
      });
    }
    if (latest.new_lesions) {
      alerts.push({
        message: 'New lesions identified. Schedule confirmatory imaging.',
        severity: 'critical',
      });
    }
    return { latestAssessment: latest, alerts };
  }

  async generateSurveillanceReminders(tenantDb: DataSource, caseId: string) {
    const plan = await this.getSurvivorshipPlan(tenantDb, caseId);
    if (!plan) {
      return { upcoming: [], overdue: [] };
    }

    const now = new Date();
    const startDate = plan.treatment_completion_date ? new Date(plan.treatment_completion_date) : new Date();
    const visits: any[] = plan.follow_up_schedule?.visits ?? [];
    const overdue: Array<{ dueDate: string; tests?: string[]; imaging?: string[] }> = [];

    visits.forEach((visit) => {
      const interval = Number(visit.interval_months ?? 3);
      const duration = Number(visit.duration_months ?? 24);
      const iterations = Math.max(1, Math.floor(duration / interval));
      for (let i = 0; i < iterations; i++) {
        const due = this.addMonthsToDate(startDate, interval * (i + 1));
        if (due < now) {
          overdue.push({
            dueDate: due.toISOString(),
            tests: visit.tests ?? [],
            imaging: visit.imaging ?? [],
          });
        }
      }
    });

    const upcoming = await this.getUpcomingFollowUps(tenantDb, caseId);
    return {
      upcoming,
      overdue: overdue.sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()).slice(0, 5),
    };
  }

  async checkToxicityAlerts(tenantDb: DataSource, caseId: string) {
    const events = await tenantDb.query(
      `
        SELECT *
        FROM oncology_adverse_events
        WHERE oncology_case_id = $1
          AND (grade IS NULL OR grade::int >= 3)
          AND (resolved_date IS NULL OR resolved_date >= NOW() - INTERVAL '30 days')
        ORDER BY event_date DESC NULLS LAST
      `,
      [caseId],
    );

    return events.map((event) => ({
      event,
      severity: event.grade && Number(event.grade) >= 4 ? 'critical' : 'warning',
      message: `${event.event_type ?? 'Adverse event'} reported on ${event.event_date ?? 'recently'}`,
    }));
  }

  async getProtocolAutomationBundle(tenantDb: DataSource, caseId: string) {
    const [caseRow] = await tenantDb.query(
      `
      SELECT id, status, primary_diagnosis, care_plan
      FROM oncology_cases
      WHERE id = $1
      LIMIT 1
      `,
      [caseId],
    );
    if (!caseRow) {
      throw new NotFoundException(`Oncology case ${caseId} not found`);
    }

    const [latestResponse, upcomingInfusion, latestGrade3Event] = await Promise.all([
      tenantDb.query(
        `
        SELECT id, recist_response, new_lesions, assessment_date
        FROM oncology_response_assessments
        WHERE oncology_case_id = $1
        ORDER BY assessment_date DESC NULLS LAST, created_at DESC
        LIMIT 1
        `,
        [caseId],
      ).then((rows) => rows[0] || null),
      tenantDb.query(
        `
        SELECT ois.id, ois.session_date, ois.status, ois.regimen_id, ois.notes, orr.regimen_name
        FROM oncology_infusion_sessions ois
        INNER JOIN oncology_regimens orr ON orr.id = ois.regimen_id
        WHERE orr.oncology_case_id = $1
          AND ois.status IN ('scheduled', 'in_progress')
        ORDER BY ois.session_date ASC NULLS LAST, ois.created_at ASC
        LIMIT 1
        `,
        [caseId],
      ).then((rows) => rows[0] || null),
      tenantDb.query(
        `
        SELECT id, event_type, grade, event_date, notes, action_taken
        FROM oncology_adverse_events
        WHERE oncology_case_id = $1
          AND resolved_date IS NULL
          AND grade IS NOT NULL
          AND grade::int >= 3
        ORDER BY event_date DESC NULLS LAST, created_at DESC
        LIMIT 1
        `,
        [caseId],
      ).then((rows) => rows[0] || null),
    ]);

    const [surveillance, financialSummary] = await Promise.all([
      this.generateSurveillanceReminders(tenantDb, caseId),
      this.getFinancialSummary(tenantDb, caseId).catch(() => null),
    ]);
    const overdueFollowUps = Array.isArray(surveillance?.overdue) ? surveillance.overdue : [];

    const items: Array<Record<string, any>> = [];
    const citations: Array<{ rule_id: string; source: string; citation: string }> = [];

    if (upcomingInfusion?.id) {
      items.push({
        id: 'queue-prechemo-labs',
        type: 'order_set',
        title: 'Queue pre-chemo CBC/CMP order set',
        priority: String(upcomingInfusion.status || '').toLowerCase() === 'in_progress' ? 'high' : 'medium',
        rationale: `Infusion session ${upcomingInfusion.id} (${upcomingInfusion.regimen_name || 'regimen'}) is pending. Protocol requires pre-chemo lab gate confirmation.`,
        action_payload: {
          case_id: caseId,
          infusion_session_id: upcomingInfusion.id,
          regimen_id: upcomingInfusion.regimen_id || null,
          order_set: ['CBC', 'CMP', 'LFT', 'Creatinine'],
        },
        guideline_citations: this.normalizeProtocolCitations([
          this.buildProtocolCitation(
            'oncology.infusion.prechemo_lab_gate',
            'Systemic therapy safety protocols require baseline CBC/CMP and organ-function review before infusion.',
          ),
        ]),
      });
      citations.push(
        this.buildProtocolCitation(
          'oncology.infusion.prechemo_lab_gate',
          'Systemic therapy safety protocols require baseline CBC/CMP and organ-function review before infusion.',
        ),
      );
    }

    if (latestGrade3Event?.id) {
      const grade = Number(latestGrade3Event.grade || 3);
      items.push({
        id: 'document-dose-adjustment-review',
        type: 'protocol_checkpoint',
        title: 'Document dose-adjustment toxicity review',
        priority: grade >= 4 ? 'critical' : 'high',
        rationale: `Unresolved grade ${grade} toxicity (${latestGrade3Event.event_type || 'adverse event'}) requires documented dose/rechallenge decision.`,
        action_payload: {
          case_id: caseId,
          adverse_event_id: latestGrade3Event.id,
          grade,
        },
        guideline_citations: this.normalizeProtocolCitations([
          this.buildProtocolCitation(
            'oncology.toxicity.grade3plus',
            'Grade 3+ treatment-related toxicity requires physician dose-adjustment or hold decision before next cycle.',
          ),
        ]),
      });
      citations.push(
        this.buildProtocolCitation(
          'oncology.toxicity.grade3plus',
          'Grade 3+ treatment-related toxicity requires physician dose-adjustment or hold decision before next cycle.',
        ),
      );
    }

    if (latestResponse && (latestResponse.recist_response === 'PD' || latestResponse.new_lesions)) {
      items.push({
        id: 'route-tumor-board-review',
        type: 'escalation',
        title: 'Route case for tumor-board review',
        priority: 'critical',
        rationale:
          latestResponse.recist_response === 'PD'
            ? 'Latest RECIST indicates progression; multidisciplinary review is recommended.'
            : 'New lesions were flagged; multidisciplinary review is recommended.',
        action_payload: {
          case_id: caseId,
          response_assessment_id: latestResponse.id,
          recist_response: latestResponse.recist_response,
          new_lesions: Boolean(latestResponse.new_lesions),
        },
        guideline_citations: this.normalizeProtocolCitations([
          this.buildProtocolCitation(
            'oncology.response.progression',
            'Progressive disease or new lesions should trigger multidisciplinary reassessment and treatment-plan adjustment.',
          ),
        ]),
      });
      citations.push(
        this.buildProtocolCitation(
          'oncology.response.progression',
          'Progressive disease or new lesions should trigger multidisciplinary reassessment and treatment-plan adjustment.',
        ),
      );
    }

    if (overdueFollowUps.length > 0) {
      items.push({
        id: 'schedule-overdue-surveillance',
        type: 'follow_up',
        title: 'Schedule overdue surveillance follow-up',
        priority: 'high',
        rationale: `${overdueFollowUps.length} surveillance visit(s) are overdue and should be scheduled before next cycle.`,
        action_payload: {
          case_id: caseId,
          overdue_count: overdueFollowUps.length,
          earliest_due_date: overdueFollowUps[0]?.dueDate || null,
          suggested_tests: Array.isArray(overdueFollowUps[0]?.tests) ? overdueFollowUps[0].tests : [],
        },
        guideline_citations: this.normalizeProtocolCitations([
          this.buildProtocolCitation(
            'oncology.surveillance.overdue',
            'Overdue post-treatment surveillance should be booked promptly to reduce delayed progression detection.',
          ),
        ]),
      });
      citations.push(
        this.buildProtocolCitation(
          'oncology.surveillance.overdue',
          'Overdue post-treatment surveillance should be booked promptly to reduce delayed progression detection.',
        ),
      );
    }

    if (financialSummary?.stressFlag) {
      items.push({
        id: 'initiate-financial-navigation',
        type: 'supportive_care',
        title: 'Initiate financial navigation referral',
        priority: 'medium',
        rationale: 'Financial toxicity screening indicates elevated stress; prompt navigation support is recommended.',
        action_payload: {
          case_id: caseId,
          stress_flag: true,
        },
        guideline_citations: this.normalizeProtocolCitations([
          this.buildProtocolCitation(
            'oncology.financial.toxicity',
            'High financial-toxicity burden warrants documented referral to navigation or assistance pathways.',
          ),
        ]),
      });
      citations.push(
        this.buildProtocolCitation(
          'oncology.financial.toxicity',
          'High financial-toxicity burden warrants documented referral to navigation or assistance pathways.',
        ),
      );
    }

    const { context: workflowContext } = await this.getOncologyProtocolWorkflowContext(tenantDb, caseId);
    const bundle = this.applyOncologyProtocolExecutionState(
      {
        bundle_key: `oncology-protocol:${caseId}`,
        bundle_label: 'Oncology Protocol Automation Bundle',
        summary:
          items.length > 0
            ? 'Actionable protocol tasks generated from infusion, toxicity, response, surveillance, and financial-toxicity signals.'
            : 'No actionable protocol automation tasks are currently pending.',
        items,
        citations: this.normalizeProtocolCitations(citations),
      },
      workflowContext,
    );

    return {
      generatedAt: new Date().toISOString(),
      case: {
        id: caseRow.id,
        status: caseRow.status,
        primaryDiagnosis: caseRow.primary_diagnosis,
      },
      protocolBundle: bundle,
    };
  }

  async executeProtocolBundleAction(
    tenantDb: DataSource,
    caseId: string,
    actionId: string,
    user: {
      id: string;
      fullName?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
    },
    payload?: {
      actionPayload?: any;
      note?: string | null;
    },
  ) {
    if (!caseId || !actionId) {
      throw new BadRequestException('caseId and actionId are required');
    }

    const [caseRow] = await tenantDb.query(
      `
      SELECT id, patient_id, care_plan
      FROM oncology_cases
      WHERE id = $1
      LIMIT 1
      `,
      [caseId],
    );
    if (!caseRow) {
      throw new NotFoundException(`Oncology case ${caseId} not found`);
    }

    const actionPayload =
      payload?.actionPayload && typeof payload.actionPayload === 'object' ? payload.actionPayload : {};

    const { context } = await this.getOncologyProtocolWorkflowContext(tenantDb, caseId);
    const existingExecution = context?.action_executions?.[actionId] || null;
    if (String(existingExecution?.status || '').toLowerCase() === 'completed') {
      return {
        ok: true,
        caseId,
        actionId,
        idempotent: true,
        result: existingExecution?.result || { operation: 'already_applied', status: 'completed' },
      };
    }

    const timestampIso = new Date().toISOString();
    const userName = this.getUserDisplayName(user);
    const additionalNote = String(payload?.note || '').trim();
    const suffixNote = additionalNote ? ` Note: ${additionalNote}` : '';
    let result: any;

    if (actionId === 'queue-prechemo-labs') {
      const infusionSessionId =
        actionPayload.infusion_session_id ||
        (
          await tenantDb.query(
            `
            SELECT ois.id
            FROM oncology_infusion_sessions ois
            INNER JOIN oncology_regimens orr ON orr.id = ois.regimen_id
            WHERE orr.oncology_case_id = $1
              AND ois.status IN ('scheduled', 'in_progress')
            ORDER BY ois.session_date ASC NULLS LAST, ois.created_at ASC
            LIMIT 1
            `,
            [caseId],
          )
        )[0]?.id;

      if (!infusionSessionId) {
        throw new BadRequestException('No active infusion session available for pre-chemo lab queueing');
      }

      const marker = '[protocol:queue-prechemo-labs]';
      const noteLine = `${marker} Pre-chemo lab order set queued by ${userName} at ${timestampIso}. CBC/CMP/LFT/Creatinine gate required.${suffixNote}`;
      const [sessionRow] = await tenantDb.query(
        `
        SELECT id, notes
        FROM oncology_infusion_sessions
        WHERE id = $1
        LIMIT 1
        `,
        [infusionSessionId],
      );
      if (!sessionRow) {
        throw new NotFoundException(`Infusion session ${infusionSessionId} not found`);
      }
      const existingNotes = String(sessionRow.notes || '');
      if (existingNotes.includes(marker)) {
        const existingAutomationRows = await this.safeQuery(
          tenantDb,
          `
          SELECT id, order_number, status
          FROM lab_orders
          WHERE patient_id = $1
            AND COALESCE(processing_context->>'oncology_protocol_action', '') = 'queue-prechemo-labs'
            AND COALESCE(processing_context->>'case_id', '') = $2
            AND COALESCE(processing_context->>'infusion_session_id', '') = $3
            AND status <> 'cancelled'
          ORDER BY created_at DESC
          `,
          [caseRow.patient_id, caseId, infusionSessionId],
        );
        result = {
          operation: 'already_applied',
          status: 'completed',
          infusionSessionId,
          existingLabOrderIds: existingAutomationRows.map((row: any) => row.id),
        };
      } else {
        const automationTests = [
          { code: 'CBC', name: 'Complete Blood Count', category: 'hematology' },
          { code: 'CMP', name: 'Comprehensive Metabolic Panel', category: 'chemistry' },
          { code: 'LFT', name: 'Liver Function Panel', category: 'chemistry' },
          { code: 'CREAT', name: 'Serum Creatinine', category: 'chemistry' },
        ];
        let createdLabOrders: Array<{ id: string; order_number: string; status: string }> = [];
        let reusedLabOrders: Array<{ id: string; order_number: string; status: string }> = [];

        if (caseRow.patient_id) {
          reusedLabOrders = await this.safeQuery(
            tenantDb,
            `
            SELECT id, order_number, status
            FROM lab_orders
            WHERE patient_id = $1
              AND COALESCE(processing_context->>'oncology_protocol_action', '') = 'queue-prechemo-labs'
              AND COALESCE(processing_context->>'case_id', '') = $2
              AND COALESCE(processing_context->>'infusion_session_id', '') = $3
              AND status <> 'cancelled'
            ORDER BY created_at DESC
            `,
            [caseRow.patient_id, caseId, infusionSessionId],
          );

          if (reusedLabOrders.length === 0) {
            for (let index = 0; index < automationTests.length; index += 1) {
              const test = automationTests[index];
              const orderNumber = `ONCLAB-${Date.now()}-${String(index + 1).padStart(2, '0')}`;
              const insertRows = await this.safeQuery(
                tenantDb,
                `
                INSERT INTO lab_orders (
                  order_number,
                  patient_id,
                  ordering_provider_id,
                  ordering_provider,
                  tests,
                  priority,
                  status,
                  clinical_info,
                  special_instructions,
                  processing_context,
                  payment_status,
                  created_at,
                  updated_at
                )
                VALUES (
                  $1,
                  $2,
                  $3,
                  $3,
                  $4::jsonb,
                  'urgent',
                  'ordered',
                  $5,
                  $6,
                  $7::jsonb,
                  'payment_confirmed',
                  NOW(),
                  NOW()
                )
                RETURNING id, order_number, status
                `,
                [
                  orderNumber,
                  caseRow.patient_id,
                  user.id,
                  JSON.stringify([
                    {
                      testCode: test.code,
                      testName: test.name,
                      category: test.category,
                    },
                  ]),
                  'Pre-chemo safety gate from oncology protocol bundle',
                  `Infusion session ${infusionSessionId} safety check`,
                  JSON.stringify({
                    source: 'oncology_protocol_bundle',
                    oncology_protocol_action: 'queue-prechemo-labs',
                    case_id: caseId,
                    infusion_session_id: infusionSessionId,
                    test_code: test.code,
                    created_by: user.id,
                    created_by_name: userName,
                  }),
                ],
              );
              if (insertRows[0]) {
                createdLabOrders.push(insertRows[0]);
              }
            }
          }
        }

        const nextNotes = existingNotes.length > 0 ? `${existingNotes}\n${noteLine}` : noteLine;
        await tenantDb.query(
          `
          UPDATE oncology_infusion_sessions
          SET notes = $1, updated_at = NOW()
          WHERE id = $2
          `,
          [nextNotes, infusionSessionId],
        );
        const createdCount = createdLabOrders.length;
        const reusedCount = reusedLabOrders.length;
        const operation =
          createdCount > 0
            ? 'prechemo_lab_orders_created'
            : reusedCount > 0
              ? 'prechemo_lab_orders_reused'
              : 'prechemo_order_set_documented';
        result = {
          operation,
          status: 'completed',
          infusionSessionId,
          createdLabOrderIds: createdLabOrders.map((order) => order.id),
          reusedLabOrderIds: reusedLabOrders.map((order) => order.id),
          createdLabOrderCount: createdCount,
          reusedLabOrderCount: reusedCount,
        };
      }
    } else if (actionId === 'document-dose-adjustment-review') {
      const adverseEventId =
        actionPayload.adverse_event_id ||
        (
          await tenantDb.query(
            `
            SELECT id
            FROM oncology_adverse_events
            WHERE oncology_case_id = $1
              AND resolved_date IS NULL
              AND grade IS NOT NULL
              AND grade::int >= 3
            ORDER BY event_date DESC NULLS LAST, created_at DESC
            LIMIT 1
            `,
            [caseId],
          )
        )[0]?.id;

      if (!adverseEventId) {
        throw new BadRequestException('No unresolved grade 3+ adverse event found for dose-adjustment review');
      }

      const marker = '[protocol:document-dose-adjustment-review]';
      const [eventRow] = await tenantDb.query(
        `
        SELECT id, notes, action_taken
        FROM oncology_adverse_events
        WHERE id = $1
        LIMIT 1
        `,
        [adverseEventId],
      );
      if (!eventRow) {
        throw new NotFoundException(`Adverse event ${adverseEventId} not found`);
      }
      const existingActionTaken = String(eventRow.action_taken || '');
      if (existingActionTaken.includes(marker)) {
        result = {
          operation: 'already_applied',
          status: 'completed',
          adverseEventId,
        };
      } else {
        const noteLine = `${marker} Dose-adjustment/rechallenge decision documented by ${userName} at ${timestampIso}.${suffixNote}`;
        const nextNotes = String(eventRow.notes || '').length > 0 ? `${String(eventRow.notes || '')}\n${noteLine}` : noteLine;
        const nextActionTaken =
          existingActionTaken.length > 0
            ? `${existingActionTaken}\n${marker} Physician review completed.`
            : `${marker} Physician review completed.`;
        await tenantDb.query(
          `
          UPDATE oncology_adverse_events
          SET notes = $1, action_taken = $2, outcome = COALESCE(outcome, 'dose_adjustment_reviewed'), updated_at = NOW()
          WHERE id = $3
          `,
          [nextNotes, nextActionTaken, adverseEventId],
        );
        result = {
          operation: 'toxicity_dose_adjustment_documented',
          status: 'completed',
          adverseEventId,
        };
      }
    } else if (actionId === 'route-tumor-board-review') {
      const marker = '[protocol:route-tumor-board-review]';
      const noteLine = `${marker} Tumor-board review routed by ${userName} at ${timestampIso}.${suffixNote}`;
      const { reused, nextPlan } = this.appendCasePlanNote(caseRow.care_plan, marker, noteLine);
      if (!reused) {
        await tenantDb.query(
          `
          UPDATE oncology_cases
          SET care_plan = $1, updated_at = NOW()
          WHERE id = $2
          `,
          [nextPlan, caseId],
        );
      }
      result = {
        operation: reused ? 'already_applied' : 'tumor_board_review_routed',
        status: 'completed',
      };
    } else if (actionId === 'schedule-overdue-surveillance') {
      const [planRow] = await tenantDb.query(
        `
        SELECT id, follow_up_schedule
        FROM oncology_survivorship_plans
        WHERE oncology_case_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [caseId],
      );
      if (planRow?.id) {
        const existingSchedule = this.parseJsonObject(planRow.follow_up_schedule) || {};
        const manualFollowups = Array.isArray(existingSchedule.manual_followups)
          ? existingSchedule.manual_followups
          : [];
        const marker = '[protocol:schedule-overdue-surveillance]';
        const alreadyExists = manualFollowups.some((entry: any) => String(entry?.marker || '') === marker);
        if (alreadyExists) {
          result = {
            operation: 'already_applied',
            status: 'completed',
            planId: planRow.id,
          };
        } else {
          const nextSchedule = {
            ...existingSchedule,
            manual_followups: [
              ...manualFollowups,
              {
                marker,
                due_date: new Date().toISOString().split('T')[0],
                created_at: timestampIso,
                created_by_name: userName,
                source: 'oncology_protocol_bundle',
                tests: Array.isArray(actionPayload.suggested_tests) ? actionPayload.suggested_tests : [],
                note: additionalNote || null,
              },
            ],
          };
          await tenantDb.query(
            `
            UPDATE oncology_survivorship_plans
            SET follow_up_schedule = $1::jsonb, updated_at = NOW()
            WHERE id = $2
            `,
            [JSON.stringify(nextSchedule), planRow.id],
          );
          result = {
            operation: 'surveillance_followup_scheduled',
            status: 'completed',
            planId: planRow.id,
          };
        }
      } else {
        const marker = '[protocol:schedule-overdue-surveillance]';
        const noteLine = `${marker} Overdue surveillance follow-up scheduled by ${userName} at ${timestampIso}.${suffixNote}`;
        const { reused, nextPlan } = this.appendCasePlanNote(caseRow.care_plan, marker, noteLine);
        if (!reused) {
          await tenantDb.query(
            `
            UPDATE oncology_cases
            SET care_plan = $1, updated_at = NOW()
            WHERE id = $2
            `,
            [nextPlan, caseId],
          );
        }
        result = {
          operation: reused ? 'already_applied' : 'surveillance_followup_documented',
          status: 'completed',
        };
      }
    } else if (actionId === 'initiate-financial-navigation') {
      const marker = '[protocol:initiate-financial-navigation]';
      const [sessionRow] = await tenantDb.query(
        `
        SELECT ois.id, ois.notes, ois.financial_assistance_program
        FROM oncology_infusion_sessions ois
        INNER JOIN oncology_regimens orr ON orr.id = ois.regimen_id
        WHERE orr.oncology_case_id = $1
        ORDER BY ois.session_date DESC NULLS LAST, ois.created_at DESC
        LIMIT 1
        `,
        [caseId],
      );

      if (sessionRow?.id) {
        const existingNotes = String(sessionRow.notes || '');
        if (existingNotes.includes(marker)) {
          result = {
            operation: 'already_applied',
            status: 'completed',
            infusionSessionId: sessionRow.id,
          };
        } else {
          const noteLine = `${marker} Financial navigation referral initiated by ${userName} at ${timestampIso}.${suffixNote}`;
          const nextNotes = existingNotes.length > 0 ? `${existingNotes}\n${noteLine}` : noteLine;
          await tenantDb.query(
            `
            UPDATE oncology_infusion_sessions
            SET
              notes = $1,
              financial_assistance_program = COALESCE(financial_assistance_program, 'Pending financial navigation referral'),
              updated_at = NOW()
            WHERE id = $2
            `,
            [nextNotes, sessionRow.id],
          );
          result = {
            operation: 'financial_navigation_initiated',
            status: 'completed',
            infusionSessionId: sessionRow.id,
          };
        }
      } else {
        const noteLine = `${marker} Financial navigation referral initiated by ${userName} at ${timestampIso}.${suffixNote}`;
        const { reused, nextPlan } = this.appendCasePlanNote(caseRow.care_plan, marker, noteLine);
        if (!reused) {
          await tenantDb.query(
            `
            UPDATE oncology_cases
            SET care_plan = $1, updated_at = NOW()
            WHERE id = $2
            `,
            [nextPlan, caseId],
          );
        }
        result = {
          operation: reused ? 'already_applied' : 'financial_navigation_documented',
          status: 'completed',
        };
      }
    } else {
      throw new BadRequestException(`Unsupported oncology protocol action: ${actionId}`);
    }

    await this.persistOncologyProtocolExecution(tenantDb, caseId, user, actionId, result);

    return {
      ok: true,
      caseId,
      actionId,
      result,
    };
  }

  async checkCaseAlerts(
    tenantDb: DataSource,
    caseId: string,
    dto: OncologyAlertCheckDto = {},
  ) {
    const [responseStatus, surveillance, toxicityAlerts, recommendations] = await Promise.all([
      this.checkResponseStatus(tenantDb, caseId),
      dto.includeSurveillance === false ? Promise.resolve({ upcoming: [], overdue: [] }) : this.generateSurveillanceReminders(tenantDb, caseId),
      dto.includeToxicity === false ? Promise.resolve([]) : this.checkToxicityAlerts(tenantDb, caseId),
      dto.includeRecommendations === false ? Promise.resolve(null) : this.generateTreatmentRecommendations(tenantDb, caseId),
    ]);

    return {
      responseStatus,
      surveillance,
      toxicityAlerts,
      recommendations,
    };
  }
}
