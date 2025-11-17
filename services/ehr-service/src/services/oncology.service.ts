import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FinanceService } from './finance.service';
import { PAYMENT_STATUS } from '../constants/payment-status';
import { TerminologyService } from './terminology.service';

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
    let paymentStatus: PAYMENT_STATUS = PAYMENT_STATUS.PAYMENT_CONFIRMED;
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
}
