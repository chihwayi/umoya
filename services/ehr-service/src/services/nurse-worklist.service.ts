import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HipaaAuditAction, HipaaAuditService } from './hipaa-audit.service';
import { HivService } from './hiv.service';

@Injectable()
export class NurseWorklistService {
  constructor(
    private readonly hipaaAuditService: HipaaAuditService,
    private readonly hivService: HivService,
  ) {}

  private getSeverityRank(severity?: string | null) {
    switch (String(severity || '').toLowerCase()) {
      case 'critical':
        return 4;
      case 'high':
        return 3;
      case 'medium':
        return 2;
      default:
        return 1;
    }
  }

  private getHoursSince(dateValue?: string | Date | null) {
    if (!dateValue) return null;
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return null;
    return Math.round(((Date.now() - parsed.getTime()) / (1000 * 60 * 60)) * 10) / 10;
  }

  private getMaternityTaskSlaHours(priority?: string | null) {
    switch (String(priority || '').toLowerCase()) {
      case 'critical':
        return 2;
      case 'high':
        return 8;
      case 'medium':
        return 24;
      default:
        return 48;
    }
  }

  private toPercent(numerator: number, denominator: number) {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
      return 0;
    }
    return Math.round((numerator / denominator) * 1000) / 10;
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

  private getWorkflowRank(status?: string | null) {
    switch (String(status || '').toLowerCase()) {
      case 'completed':
      case 'closed':
        return 3;
      case 'acknowledged':
      case 'actioned':
      case 'reviewed':
        return 2;
      default:
        return 1;
    }
  }

  private normalizeCrossModuleWorkflowStatus(status?: string | null): 'pending' | 'acknowledged' | 'completed' {
    if (String(status || '').toLowerCase() === 'acknowledged') {
      return 'acknowledged';
    }
    if (String(status || '').toLowerCase() === 'completed') {
      return 'completed';
    }
    return 'pending';
  }

  private normalizeText(value?: string | null) {
    const normalized = String(value || '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeModuleKey(value?: string | null) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
  }

  private isCoreGeneratedCrossModule(moduleKey: string) {
    return moduleKey === 'maternity' || moduleKey === 'hiv' || moduleKey === 'oncology' || moduleKey === 'nursing';
  }

  private isAccountsModule(moduleKey: string) {
    return (
      moduleKey === 'accounts' ||
      moduleKey === 'billing' ||
      moduleKey === 'claims' ||
      moduleKey === 'revenue_cycle'
    );
  }

  private normalizeWorkflowContextStatus(value?: string | null) {
    const normalized = this.normalizeText(value);
    if (!normalized) {
      return null;
    }
    return normalized.toLowerCase().replace(/[\s-]+/g, '_');
  }

  private readContextValue(context: Record<string, any>, keys: string[]) {
    for (const key of keys) {
      const value = this.normalizeText(context?.[key]);
      if (value) {
        return value;
      }
    }
    return null;
  }

  private extractAccountsSyncStatus(context: Record<string, any>) {
    return this.normalizeWorkflowContextStatus(
      this.readContextValue(context, [
        'accounts_sync_status',
        'accountsSyncStatus',
        'payment_status',
        'paymentStatus',
        'claim_status',
        'claimStatus',
        'preauth_status',
        'preauthStatus',
        'authorization_status',
        'authorizationStatus',
        'invoice_status',
        'invoiceStatus',
        'billing_status',
        'billingStatus',
        'financial_clearance_status',
        'financialClearanceStatus',
        'clearance_status',
        'clearanceStatus',
      ]),
    );
  }

  private isAccountsWorkflow(row: any, context: Record<string, any>, moduleKey: string) {
    if (this.isAccountsModule(moduleKey)) {
      return true;
    }

    const destinationService = this.normalizeModuleKey(row?.destination_service);
    if (
      destinationService === 'accounts' ||
      destinationService === 'billing' ||
      destinationService === 'claims' ||
      destinationService === 'revenue_cycle' ||
      destinationService === 'payment_clearance'
    ) {
      return true;
    }

    return Boolean(this.extractAccountsSyncStatus(context));
  }

  private extractTaskSpecialty(taskContext: any, fallback: string) {
    const recommendationItems = Array.isArray(taskContext?.recommendation_bundle?.items)
      ? taskContext.recommendation_bundle.items
      : [];

    for (const item of recommendationItems) {
      const specialty =
        item?.referral_payload?.specialty ||
        item?.specialty ||
        item?.destination_specialty;
      if (this.normalizeText(specialty)) {
        return String(specialty);
      }
    }

    return fallback;
  }

  private selectDestinationUser(
    users: any[],
    role: string,
    specialtyHint?: string | null,
    preferredUserId?: string | null,
  ) {
    if (preferredUserId) {
      const explicitUser = users.find((user) => user.id === preferredUserId);
      if (explicitUser) {
        return explicitUser;
      }
    }

    const normalizedRole = String(role || '').toLowerCase();
    const normalizedHint = String(specialtyHint || '').toLowerCase();

    return (
      users.find((user) => {
        if (String(user.role || '').toLowerCase() !== normalizedRole) {
          return false;
        }
        if (!normalizedHint) {
          return true;
        }
        return String(user.specialization || '').toLowerCase().includes(normalizedHint);
      }) ||
      users.find((user) => String(user.role || '').toLowerCase() === normalizedRole) ||
      null
    );
  }

  private selectDestinationFacility(facilities: any[], specialtyHint?: string | null) {
    const normalizedHint = String(specialtyHint || '').toLowerCase();
    if (!normalizedHint) {
      return null;
    }

    return (
      facilities.find((facility) =>
        (Array.isArray(facility.specialties) ? facility.specialties : []).some((specialty: string) =>
          String(specialty || '').toLowerCase().includes(normalizedHint),
        ),
      ) || null
    );
  }

  private buildDestination(
    users: any[],
    facilities: any[],
    route: {
      role: string;
      service: string;
      specialty?: string | null;
      preferredUserId?: string | null;
      preferredUserName?: string | null;
      preferredFacilityId?: string | null;
      preferredFacilityName?: string | null;
    },
  ) {
    const destinationUser = this.selectDestinationUser(
      users,
      route.role,
      route.specialty,
      route.preferredUserId,
    );
    const destinationFacility = route.preferredFacilityId
      ? facilities.find((facility) => facility.id === route.preferredFacilityId) || null
      : this.selectDestinationFacility(facilities, route.specialty);

    return {
      destination_role: route.role,
      destination_service: route.service,
      destination_specialty: route.specialty || null,
      destination_user_id: destinationUser?.id || route.preferredUserId || null,
      destination_user_name: destinationUser?.name || route.preferredUserName || null,
      destination_facility_id: destinationFacility?.id || route.preferredFacilityId || null,
      destination_facility_name: destinationFacility?.facility_name || route.preferredFacilityName || null,
    };
  }

  private mergeCrossModuleWorkflowState(item: Record<string, any>, workflowRowsByKey: Map<string, any>) {
    const workflowRow = workflowRowsByKey.get(item.id);
    if (!workflowRow) {
      return item;
    }

    const workflowContext = workflowRow.context || null;
    const recommendationBundle = this.applyRecommendationExecutionState(
      item.metadata?.recommendation_bundle || null,
      workflowContext,
    );

    return {
      ...item,
      workflow_status: workflowRow.status || item.workflow_status || 'pending',
      acknowledged_at: workflowRow.acknowledged_at || null,
      acknowledged_by_name: workflowRow.acknowledged_by_name || null,
      completed_at: workflowRow.completed_at || null,
      completed_by_name: workflowRow.completed_by_name || null,
      note: workflowRow.note || item.note || null,
      destination_role: workflowRow.destination_role || item.destination_role || null,
      destination_service: workflowRow.destination_service || item.destination_service || null,
      destination_specialty: workflowRow.destination_specialty || item.destination_specialty || null,
      destination_user_id: workflowRow.destination_user_id || item.destination_user_id || null,
      destination_user_name: workflowRow.destination_user_name || item.destination_user_name || null,
      destination_facility_id: workflowRow.destination_facility_id || item.destination_facility_id || null,
      destination_facility_name: workflowRow.destination_facility_name || item.destination_facility_name || null,
      metadata: {
        ...(item.metadata || {}),
        recommendation_bundle: recommendationBundle,
        guideline_citations: recommendationBundle?.citations || item.metadata?.guideline_citations || [],
        workflow_context: workflowRow.context || null,
      },
    };
  }

  private applyRecommendationExecutionState(bundle: any, workflowContext: any) {
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

  private buildRecommendationExecutionContext(
    existingContext: any,
    actionId: string,
    execution: any,
    contextPatch?: Record<string, any>,
  ) {
    const normalizedExisting =
      existingContext && typeof existingContext === 'object' && !Array.isArray(existingContext)
        ? existingContext
        : {};

    return {
      ...normalizedExisting,
      ...(contextPatch || {}),
      source: 'nurse_cross_module_queue',
      action_executions: {
        ...(normalizedExisting.action_executions || {}),
        [actionId]: execution,
      },
    };
  }

  private async persistRecommendationExecutionState(
    tenantDb: DataSource,
    user: { id: string; fullName?: string; firstName?: string; lastName?: string; email?: string; role?: string },
    payload: {
      itemId: string;
      module: string;
      itemType: string;
      sourceRecordId?: string | null;
      patientId?: string | null;
      enrollmentId?: string | null;
      destinationRole?: string | null;
      destinationService?: string | null;
      destinationSpecialty?: string | null;
      destinationUserId?: string | null;
      destinationFacilityId?: string | null;
      destinationFacilityName?: string | null;
      actionId: string;
      note?: string | null;
    },
    executionResult: any,
  ) {
    const existingRows = await this.safeQuery(
      tenantDb,
      `
      SELECT status, context, acknowledged_by, acknowledged_at
      FROM nurse_cross_module_workflow_state
      WHERE workflow_key = $1
      LIMIT 1
      `,
      [payload.itemId],
    );

    const existingRow = existingRows[0] || null;
    const nextStatus =
      String(existingRow?.status || '').toLowerCase() === 'completed' ? 'completed' : 'acknowledged';
    const existingContext = this.parseJsonObject(existingRow?.context) || {};
    const actorRole = this.normalizeText(user.role)?.toLowerCase() || 'nurse';
    const moduleKey = this.normalizeModuleKey(payload.module);
    const destinationServiceKey = this.normalizeModuleKey(payload.destinationService);
    const existingAccountsStatus = this.extractAccountsSyncStatus(existingContext);
    const accountsWorkflow =
      this.isAccountsModule(moduleKey) ||
      this.isAccountsModule(destinationServiceKey) ||
      Boolean(existingAccountsStatus);
    const mergedContext = this.buildRecommendationExecutionContext(existingContext, payload.actionId, {
      status: 'completed',
      executed_at: new Date().toISOString(),
      executed_by: user.id,
      executed_by_name: this.getUserDisplayName(user),
      result: executionResult,
      executed_by_role: actorRole,
    }, {
      doctor_sync_status: actorRole === 'doctor' ? 'doctor_actioned' : 'nurse_actioned',
      last_actor_role: actorRole,
      last_action_id: payload.actionId,
      last_action_at: new Date().toISOString(),
      accounts_sync_status: accountsWorkflow
        ? nextStatus === 'completed'
          ? 'completed'
          : actorRole === 'doctor'
            ? 'doctor_actioned'
            : 'nurse_actioned'
        : existingAccountsStatus,
    });

    await tenantDb.query(
      `
      INSERT INTO nurse_cross_module_workflow_state (
        workflow_key,
        module,
        item_type,
        source_record_id,
        enrollment_id,
        patient_id,
        status,
        destination_role,
        destination_service,
        destination_specialty,
        destination_user_id,
        destination_facility_id,
        destination_facility_name,
        acknowledged_by,
        acknowledged_at,
        completed_by,
        completed_at,
        note,
        context,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        $14, CASE WHEN $7 IN ('acknowledged', 'completed') THEN NOW() ELSE NULL END,
        CASE WHEN $7 = 'completed' THEN $14 ELSE NULL END,
        CASE WHEN $7 = 'completed' THEN NOW() ELSE NULL END,
        $15, $16::jsonb, NOW()
      )
      ON CONFLICT (workflow_key)
      DO UPDATE SET
        module = EXCLUDED.module,
        item_type = EXCLUDED.item_type,
        source_record_id = COALESCE(EXCLUDED.source_record_id, nurse_cross_module_workflow_state.source_record_id),
        enrollment_id = COALESCE(EXCLUDED.enrollment_id, nurse_cross_module_workflow_state.enrollment_id),
        patient_id = COALESCE(EXCLUDED.patient_id, nurse_cross_module_workflow_state.patient_id),
        status = CASE
          WHEN nurse_cross_module_workflow_state.status = 'completed' THEN nurse_cross_module_workflow_state.status
          ELSE EXCLUDED.status
        END,
        destination_role = COALESCE(EXCLUDED.destination_role, nurse_cross_module_workflow_state.destination_role),
        destination_service = COALESCE(EXCLUDED.destination_service, nurse_cross_module_workflow_state.destination_service),
        destination_specialty = COALESCE(EXCLUDED.destination_specialty, nurse_cross_module_workflow_state.destination_specialty),
        destination_user_id = COALESCE(EXCLUDED.destination_user_id, nurse_cross_module_workflow_state.destination_user_id),
        destination_facility_id = COALESCE(EXCLUDED.destination_facility_id, nurse_cross_module_workflow_state.destination_facility_id),
        destination_facility_name = COALESCE(EXCLUDED.destination_facility_name, nurse_cross_module_workflow_state.destination_facility_name),
        acknowledged_by = COALESCE(nurse_cross_module_workflow_state.acknowledged_by, EXCLUDED.acknowledged_by),
        acknowledged_at = COALESCE(nurse_cross_module_workflow_state.acknowledged_at, EXCLUDED.acknowledged_at),
        note = COALESCE(EXCLUDED.note, nurse_cross_module_workflow_state.note),
        context = EXCLUDED.context,
        updated_at = NOW()
      `,
      [
        payload.itemId,
        payload.module,
        payload.itemType,
        payload.sourceRecordId || null,
        payload.enrollmentId || null,
        payload.patientId || null,
        nextStatus,
        payload.destinationRole || null,
        payload.destinationService || null,
        payload.destinationSpecialty || null,
        payload.destinationUserId || null,
        payload.destinationFacilityId || null,
        payload.destinationFacilityName || null,
        user.id,
        payload.note || null,
        JSON.stringify(mergedContext),
      ],
    );
  }

  private buildHivMonitoringNote(actionId: string, actionTitle?: string | null) {
    if (actionId === 'repeat-vl-plan') {
      return 'Repeat viral load follow-up scheduled from nurse cross-module queue.';
    }
    return `${actionTitle || 'HIV follow-up action'} completed from nurse cross-module queue.`;
  }

  private extractRegimenRequestId(payload: { sourceRecordId?: string | null; itemId: string }) {
    if (this.normalizeText(payload.sourceRecordId)) {
      return String(payload.sourceRecordId);
    }
    const normalizedItemId = String(payload.itemId || '');
    if (normalizedItemId.startsWith('hiv-regimen:')) {
      return normalizedItemId.replace('hiv-regimen:', '').trim();
    }
    return null;
  }

  private async appendArvChangeApprovalNote(
    tenantDb: DataSource,
    requestId: string,
    note: string,
  ) {
    const rows = await tenantDb.query(
      `
      UPDATE hiv_arv_change_requests
      SET
        approval_notes = trim(
          BOTH
          FROM (
            COALESCE(approval_notes, '') ||
            CASE WHEN COALESCE(approval_notes, '') = '' THEN '' ELSE E'\n' END ||
            $1
          )
        ),
        updated_at = NOW()
      WHERE id = $2
      RETURNING id, enrollment_id, status, visit_recorded, requested_regimen_code, requested_regimen_name
      `,
      [note, requestId],
    );
    return rows[0] || null;
  }

  private async createHivAdherenceTrackingEntry(
    tenantDb: DataSource,
    payload: {
      enrollmentId: string;
      recordedBy: string;
      trackingDate: string;
      interventions: string[];
      notes: string;
    },
  ) {
    try {
      const rows = await tenantDb.query(
        `
        INSERT INTO hiv_adherence_tracking (
          enrollment_id,
          tracking_date,
          adherence_method,
          interventions_provided,
          notes,
          recorded_by
        )
        VALUES ($1, $2, 'self_report', $3, $4, $5)
        RETURNING id, tracking_date
        `,
        [
          payload.enrollmentId,
          payload.trackingDate,
          payload.interventions,
          payload.notes,
          payload.recordedBy,
        ],
      );
      return rows[0] || null;
    } catch (error) {
      if (!this.isMissingTableError(error)) {
        throw error;
      }
      return null;
    }
  }

  private async getExistingRecommendationExecution(
    tenantDb: DataSource,
    itemId: string,
    actionId: string,
  ) {
    const workflowRows = await this.safeQuery(
      tenantDb,
      `
      SELECT context
      FROM nurse_cross_module_workflow_state
      WHERE workflow_key = $1
      LIMIT 1
      `,
      [itemId],
    );
    const workflowContext = this.parseJsonObject(workflowRows[0]?.context) || {};
    return workflowContext?.action_executions?.[actionId] || null;
  }

  private async getEnrollmentPatientId(tenantDb: DataSource, enrollmentId: string) {
    const rows = await tenantDb.query(
      `
      SELECT patient_id
      FROM hiv_care_enrollments
      WHERE id = $1
      LIMIT 1
      `,
      [enrollmentId],
    );
    return rows[0]?.patient_id || null;
  }

  private extractOncologyCaseId(payload: {
    caseId?: string | null;
    sourceRecordId?: string | null;
    itemId: string;
    actionPayload?: any;
  }) {
    if (this.normalizeText(payload.caseId)) {
      return String(payload.caseId);
    }
    if (this.normalizeText(payload.actionPayload?.case_id)) {
      return String(payload.actionPayload.case_id);
    }
    const normalizedItemId = String(payload.itemId || '');
    if (normalizedItemId.startsWith('oncology-case:')) {
      return normalizedItemId.replace('oncology-case:', '').trim();
    }
    return null;
  }

  private async getOncologyCasePatientId(tenantDb: DataSource, caseId: string) {
    const rows = await this.safeQuery(
      tenantDb,
      `
      SELECT patient_id
      FROM oncology_cases
      WHERE id = $1
      LIMIT 1
      `,
      [caseId],
    );
    return rows[0]?.patient_id || null;
  }

  private async getOncologyInfusionContext(tenantDb: DataSource, sessionId: string) {
    const rows = await this.safeQuery(
      tenantDb,
      `
      SELECT
        ois.id,
        ois.notes,
        ois.status,
        ois.payment_status,
        ois.session_date,
        ois.cycle_number,
        ois.regimen_id,
        orr.regimen_name,
        orr.oncology_case_id as case_id,
        oc.patient_id
      FROM oncology_infusion_sessions ois
      INNER JOIN oncology_regimens orr ON orr.id = ois.regimen_id
      INNER JOIN oncology_cases oc ON oc.id = orr.oncology_case_id
      WHERE ois.id = $1
      LIMIT 1
      `,
      [sessionId],
    );
    return rows[0] || null;
  }

  private async getOncologyAdverseEventContext(tenantDb: DataSource, adverseEventId: string) {
    const rows = await this.safeQuery(
      tenantDb,
      `
      SELECT
        oae.id,
        oae.oncology_case_id as case_id,
        oae.regimen_id,
        oae.event_type,
        oae.grade,
        oae.notes,
        oae.action_taken,
        oae.outcome,
        oc.patient_id
      FROM oncology_adverse_events oae
      INNER JOIN oncology_cases oc ON oc.id = oae.oncology_case_id
      WHERE oae.id = $1
      LIMIT 1
      `,
      [adverseEventId],
    );
    return rows[0] || null;
  }

  private async appendOncologyInfusionSessionNote(
    tenantDb: DataSource,
    sessionId: string,
    marker: string,
    noteLine: string,
  ) {
    const session = await this.getOncologyInfusionContext(tenantDb, sessionId);
    if (!session) {
      throw new BadRequestException('Oncology infusion session not found for recommendation action');
    }

    const existingNotes = String(session.notes || '');
    if (existingNotes.includes(marker)) {
      return {
        reused: true,
        session,
      };
    }

    const nextNotes = existingNotes.length > 0 ? `${existingNotes}\n${noteLine}` : noteLine;
    const updatedRows = await tenantDb.query(
      `
      UPDATE oncology_infusion_sessions
      SET notes = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, status, payment_status, session_date, regimen_id
      `,
      [nextNotes, sessionId],
    );

    return {
      reused: false,
      session: {
        ...session,
        ...(updatedRows[0] || {}),
        notes: nextNotes,
      },
    };
  }

  private async appendOncologyAdverseEventFollowup(
    tenantDb: DataSource,
    adverseEventId: string,
    marker: string,
    noteLine: string,
  ) {
    const event = await this.getOncologyAdverseEventContext(tenantDb, adverseEventId);
    if (!event) {
      throw new BadRequestException('Oncology adverse event not found for recommendation action');
    }

    const existingNotes = String(event.notes || '');
    const existingActionTaken = String(event.action_taken || '');
    if (existingNotes.includes(marker) || existingActionTaken.includes(marker)) {
      return {
        reused: true,
        event,
      };
    }

    const nextNotes = existingNotes.length > 0 ? `${existingNotes}\n${noteLine}` : noteLine;
    const nextActionTaken = existingActionTaken.length > 0
      ? `${existingActionTaken}\n${marker} Nurse queue toxicity follow-up documented.`
      : `${marker} Nurse queue toxicity follow-up documented.`;

    const updatedRows = await tenantDb.query(
      `
      UPDATE oncology_adverse_events
      SET
        notes = $1,
        action_taken = $2,
        outcome = COALESCE(outcome, 'pending_oncologist_review'),
        updated_at = NOW()
      WHERE id = $3
      RETURNING id, oncology_case_id as case_id, regimen_id, event_type, grade, outcome
      `,
      [nextNotes, nextActionTaken, adverseEventId],
    );

    return {
      reused: false,
      event: {
        ...event,
        ...(updatedRows[0] || {}),
        notes: nextNotes,
        action_taken: nextActionTaken,
      },
    };
  }

  private async appendOncologyCaseCarePlanNote(
    tenantDb: DataSource,
    caseId: string,
    marker: string,
    noteLine: string,
  ) {
    const rows = await this.safeQuery(
      tenantDb,
      `
      SELECT id, patient_id, care_plan
      FROM oncology_cases
      WHERE id = $1
      LIMIT 1
      `,
      [caseId],
    );
    const caseRow = rows[0] || null;
    if (!caseRow) {
      throw new BadRequestException('Oncology case not found for recommendation action');
    }

    const existingPlan = String(caseRow.care_plan || '');
    if (existingPlan.includes(marker)) {
      return {
        reused: true,
        case: caseRow,
      };
    }

    const nextPlan = existingPlan.length > 0 ? `${existingPlan}\n${noteLine}` : noteLine;
    const updatedRows = await tenantDb.query(
      `
      UPDATE oncology_cases
      SET care_plan = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, patient_id, care_plan, status
      `,
      [nextPlan, caseId],
    );

    return {
      reused: false,
      case: updatedRows[0] || {
        ...caseRow,
        care_plan: nextPlan,
      },
    };
  }

  private extractCardiologyEncounterId(payload: {
    encounterId?: string | null;
    sourceRecordId?: string | null;
    itemId: string;
    actionPayload?: any;
  }) {
    if (this.normalizeText(payload.encounterId)) {
      return String(payload.encounterId);
    }
    if (this.normalizeText(payload.actionPayload?.encounter_id)) {
      return String(payload.actionPayload.encounter_id);
    }
    if (this.normalizeText(payload.sourceRecordId)) {
      return String(payload.sourceRecordId);
    }
    const normalizedItemId = String(payload.itemId || '');
    if (normalizedItemId.startsWith('cardiology-encounter:')) {
      return normalizedItemId.replace('cardiology-encounter:', '').trim();
    }
    return null;
  }

  private extractEdVisitId(payload: {
    visitId?: string | null;
    sourceRecordId?: string | null;
    itemId: string;
    actionPayload?: any;
  }) {
    if (this.normalizeText(payload.visitId)) {
      return String(payload.visitId);
    }
    if (this.normalizeText(payload.actionPayload?.visit_id)) {
      return String(payload.actionPayload.visit_id);
    }
    if (this.normalizeText(payload.sourceRecordId)) {
      return String(payload.sourceRecordId);
    }
    const normalizedItemId = String(payload.itemId || '');
    if (normalizedItemId.startsWith('ed-visit:')) {
      return normalizedItemId.replace('ed-visit:', '').trim();
    }
    return null;
  }

  private extractSepsisBundleId(payload: {
    bundleId?: string | null;
    sourceRecordId?: string | null;
    itemId: string;
    actionPayload?: any;
  }) {
    if (this.normalizeText(payload.bundleId)) {
      return String(payload.bundleId);
    }
    if (this.normalizeText(payload.actionPayload?.bundle_id)) {
      return String(payload.actionPayload.bundle_id);
    }
    if (this.normalizeText(payload.sourceRecordId)) {
      return String(payload.sourceRecordId);
    }
    const normalizedItemId = String(payload.itemId || '');
    if (normalizedItemId.startsWith('sepsis-bundle:')) {
      return normalizedItemId.replace('sepsis-bundle:', '').trim();
    }
    return null;
  }

  private extractBloodBankTransfusionId(payload: {
    transfusionId?: string | null;
    sourceRecordId?: string | null;
    itemId: string;
    actionPayload?: any;
  }) {
    if (this.normalizeText(payload.transfusionId)) {
      return String(payload.transfusionId);
    }
    if (this.normalizeText(payload.actionPayload?.transfusion_id)) {
      return String(payload.actionPayload.transfusion_id);
    }
    if (this.normalizeText(payload.sourceRecordId)) {
      return String(payload.sourceRecordId);
    }
    const normalizedItemId = String(payload.itemId || '');
    if (normalizedItemId.startsWith('blood-bank-transfusion:')) {
      return normalizedItemId.replace('blood-bank-transfusion:', '').trim();
    }
    return null;
  }

  private extractOphthalmologyEncounterId(payload: {
    encounterId?: string | null;
    sourceRecordId?: string | null;
    itemId: string;
    actionPayload?: any;
  }) {
    if (this.normalizeText(payload.encounterId)) {
      return String(payload.encounterId);
    }
    if (this.normalizeText(payload.actionPayload?.encounter_id)) {
      return String(payload.actionPayload.encounter_id);
    }
    if (this.normalizeText(payload.sourceRecordId)) {
      return String(payload.sourceRecordId);
    }
    const normalizedItemId = String(payload.itemId || '');
    if (normalizedItemId.startsWith('ophthalmology-encounter:')) {
      return normalizedItemId.replace('ophthalmology-encounter:', '').trim();
    }
    return null;
  }

  private extractTelemedicineConsultationId(payload: {
    consultationId?: string | null;
    sourceRecordId?: string | null;
    itemId: string;
    actionPayload?: any;
  }) {
    if (this.normalizeText(payload.consultationId)) {
      return String(payload.consultationId);
    }
    if (this.normalizeText(payload.actionPayload?.consultation_id)) {
      return String(payload.actionPayload.consultation_id);
    }
    if (this.normalizeText(payload.sourceRecordId)) {
      return String(payload.sourceRecordId);
    }
    const normalizedItemId = String(payload.itemId || '');
    if (normalizedItemId.startsWith('telemedicine-consultation:')) {
      return normalizedItemId.replace('telemedicine-consultation:', '').trim();
    }
    return null;
  }

  private extractLabCriticalAlertId(payload: {
    alertId?: string | null;
    sourceRecordId?: string | null;
    itemId: string;
    actionPayload?: any;
  }) {
    if (this.normalizeText(payload.alertId)) {
      return String(payload.alertId);
    }
    if (this.normalizeText(payload.actionPayload?.alert_id)) {
      return String(payload.actionPayload.alert_id);
    }
    if (this.normalizeText(payload.sourceRecordId)) {
      return String(payload.sourceRecordId);
    }
    const normalizedItemId = String(payload.itemId || '');
    if (normalizedItemId.startsWith('lab-critical-alert:')) {
      return normalizedItemId.replace('lab-critical-alert:', '').trim();
    }
    return null;
  }

  private extractPharmacyPrescriptionId(payload: {
    prescriptionId?: string | null;
    sourceRecordId?: string | null;
    itemId: string;
    actionPayload?: any;
  }) {
    if (this.normalizeText(payload.prescriptionId)) {
      return String(payload.prescriptionId);
    }
    if (this.normalizeText(payload.actionPayload?.prescription_id)) {
      return String(payload.actionPayload.prescription_id);
    }
    if (this.normalizeText(payload.sourceRecordId)) {
      return String(payload.sourceRecordId);
    }
    const normalizedItemId = String(payload.itemId || '');
    if (normalizedItemId.startsWith('pharmacy-prescription:')) {
      return normalizedItemId.replace('pharmacy-prescription:', '').trim();
    }
    return null;
  }

  private parseJsonArray(value: any) {
    if (Array.isArray(value)) {
      return value;
    }
    const parsed = this.parseJsonObject(value);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  }

  private async getCardiologyEncounterContext(tenantDb: DataSource, encounterId: string) {
    const rows = await this.safeQuery(
      tenantDb,
      `
      SELECT
        id,
        patient_id,
        encounter_date,
        encounter_type,
        visit_reason,
        risk_score,
        care_status,
        payment_status,
        diagnostic_tests,
        care_plan,
        follow_up_plan
      FROM cardiology_encounters
      WHERE id = $1
      LIMIT 1
      `,
      [encounterId],
    );
    return rows[0] || null;
  }

  private async appendCardiologyEncounterTextNote(
    tenantDb: DataSource,
    encounterId: string,
    field: 'care_plan' | 'follow_up_plan',
    marker: string,
    noteLine: string,
  ) {
    const encounter = await this.getCardiologyEncounterContext(tenantDb, encounterId);
    if (!encounter) {
      throw new BadRequestException('Cardiology encounter not found for recommendation action');
    }

    const existingValue = String(encounter[field] || '');
    if (existingValue.includes(marker)) {
      return {
        reused: true,
        encounter,
      };
    }

    const nextValue = existingValue.length > 0 ? `${existingValue}\n${noteLine}` : noteLine;
    const updatedRows = await tenantDb.query(
      `
      UPDATE cardiology_encounters
      SET ${field} = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING
        id,
        patient_id,
        encounter_date,
        encounter_type,
        visit_reason,
        risk_score,
        care_status,
        payment_status,
        diagnostic_tests,
        care_plan,
        follow_up_plan
      `,
      [nextValue, encounterId],
    );

    return {
      reused: false,
      encounter: {
        ...encounter,
        ...(updatedRows[0] || {}),
        [field]: nextValue,
      },
    };
  }

  private async appendCardiologyDiagnosticOrderSet(
    tenantDb: DataSource,
    encounterId: string,
    marker: string,
    actionId: string,
    suggestedTests: string[],
  ) {
    const encounter = await this.getCardiologyEncounterContext(tenantDb, encounterId);
    if (!encounter) {
      throw new BadRequestException('Cardiology encounter not found for recommendation action');
    }

    const existingTests = this.parseJsonArray(encounter.diagnostic_tests);
    const existingNames = new Set(
      existingTests
        .map((entry: any) =>
          String(entry?.name || entry?.test || entry?.title || '')
            .trim()
            .toLowerCase(),
        )
        .filter((value: string) => value.length > 0),
    );

    const uniqueSuggestedTests = Array.from(
      new Set(
        suggestedTests
          .map((value) => String(value || '').trim())
          .filter((value) => value.length > 0),
      ),
    );
    const testsToInsert = uniqueSuggestedTests.filter((testName) => !existingNames.has(testName.toLowerCase()));

    if (testsToInsert.length === 0) {
      return {
        reused: true,
        encounter: {
          ...encounter,
          diagnostic_tests: existingTests,
        },
        addedTests: [],
      };
    }

    const nowIso = new Date().toISOString();
    const addedEntries = testsToInsert.map((testName) => ({
      name: testName,
      status: 'recommended',
      source: 'nurse_cross_module_queue',
      bundle_action_id: actionId,
      marker,
      recommended_at: nowIso,
    }));
    const nextTests = [...existingTests, ...addedEntries];

    const updatedRows = await tenantDb.query(
      `
      UPDATE cardiology_encounters
      SET diagnostic_tests = $1::jsonb, updated_at = NOW()
      WHERE id = $2
      RETURNING
        id,
        patient_id,
        encounter_date,
        encounter_type,
        visit_reason,
        risk_score,
        care_status,
        payment_status,
        diagnostic_tests,
        care_plan,
        follow_up_plan
      `,
      [JSON.stringify(nextTests), encounterId],
    );

    return {
      reused: false,
      encounter: {
        ...encounter,
        ...(updatedRows[0] || {}),
        diagnostic_tests: nextTests,
      },
      addedTests: testsToInsert,
    };
  }

  private async getEdVisitContext(tenantDb: DataSource, visitId: string) {
    const rows = await this.safeQuery(
      tenantDb,
      `
      SELECT
        id,
        patient_id,
        ed_visit_number,
        arrival_date,
        chief_complaint,
        triage_level,
        triage_acuity,
        ed_status,
        disposition,
        notes,
        follow_up_instructions,
        quality_flags
      FROM ed_visits
      WHERE id = $1
      LIMIT 1
      `,
      [visitId],
    );
    return rows[0] || null;
  }

  private async appendEdVisitTextNote(
    tenantDb: DataSource,
    visitId: string,
    field: 'notes' | 'follow_up_instructions',
    marker: string,
    noteLine: string,
  ) {
    const visit = await this.getEdVisitContext(tenantDb, visitId);
    if (!visit) {
      throw new BadRequestException('ED visit not found for recommendation action');
    }

    const existingValue = String(visit[field] || '');
    if (existingValue.includes(marker)) {
      return {
        reused: true,
        visit,
      };
    }

    const nextValue = existingValue.length > 0 ? `${existingValue}\n${noteLine}` : noteLine;
    const updatedRows = await tenantDb.query(
      `
      UPDATE ed_visits
      SET ${field} = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING
        id,
        patient_id,
        ed_visit_number,
        arrival_date,
        chief_complaint,
        triage_level,
        triage_acuity,
        ed_status,
        disposition,
        notes,
        follow_up_instructions,
        quality_flags
      `,
      [nextValue, visitId],
    );

    return {
      reused: false,
      visit: {
        ...visit,
        ...(updatedRows[0] || {}),
        [field]: nextValue,
      },
    };
  }

  private async appendEdVisitOrderSetMarker(
    tenantDb: DataSource,
    visitId: string,
    marker: string,
    actionId: string,
    noteLine: string,
    suggestedOrders: string[],
  ) {
    const visit = await this.getEdVisitContext(tenantDb, visitId);
    if (!visit) {
      throw new BadRequestException('ED visit not found for recommendation action');
    }

    const existingNotes = String(visit.notes || '');
    const existingFlags = this.parseJsonArray(visit.quality_flags);
    const markerExistsInFlags = existingFlags.some((entry: any) => String(entry?.marker || '') === marker);
    if (existingNotes.includes(marker) || markerExistsInFlags) {
      return {
        reused: true,
        visit: {
          ...visit,
          quality_flags: existingFlags,
        },
        addedOrders: [],
      };
    }

    const normalizedOrders = Array.from(
      new Set(
        (Array.isArray(suggestedOrders) ? suggestedOrders : [])
          .map((value) => String(value || '').trim())
          .filter((value) => value.length > 0),
      ),
    );
    const nowIso = new Date().toISOString();
    const orderFlag = {
      marker,
      action_id: actionId,
      source: 'nurse_cross_module_queue',
      recorded_at: nowIso,
      suggested_orders: normalizedOrders,
    };
    const nextNotes = existingNotes.length > 0 ? `${existingNotes}\n${noteLine}` : noteLine;
    const nextFlags = [...existingFlags, orderFlag];

    const updatedRows = await tenantDb.query(
      `
      UPDATE ed_visits
      SET
        notes = $1,
        quality_flags = $2::jsonb,
        updated_at = NOW()
      WHERE id = $3
      RETURNING
        id,
        patient_id,
        ed_visit_number,
        arrival_date,
        chief_complaint,
        triage_level,
        triage_acuity,
        ed_status,
        disposition,
        notes,
        follow_up_instructions,
        quality_flags
      `,
      [nextNotes, JSON.stringify(nextFlags), visitId],
    );

    return {
      reused: false,
      visit: {
        ...visit,
        ...(updatedRows[0] || {}),
        notes: nextNotes,
        quality_flags: nextFlags,
      },
      addedOrders: normalizedOrders,
    };
  }

  private async getSepsisBundleContext(tenantDb: DataSource, bundleId: string) {
    const rows = await this.safeQuery(
      tenantDb,
      `
      SELECT
        sb.id,
        sb.patient_id,
        sb.admission_id,
        sb.sepsis_screening_id,
        sb.bundle_start_time,
        sb.three_hour_bundle_complete,
        sb.six_hour_bundle_complete,
        sb.overall_compliance,
        sb.repeat_lactate_measured,
        sb.lactate_value,
        sb.repeat_lactate_value,
        sb.notes,
        ss.qsofa_score,
        ss.sirs_score,
        ss.sepsis_suspected,
        ss.severe_sepsis,
        ss.septic_shock
      FROM sepsis_bundles sb
      LEFT JOIN sepsis_screenings ss ON ss.id = sb.sepsis_screening_id
      WHERE sb.id = $1
      LIMIT 1
      `,
      [bundleId],
    );
    return rows[0] || null;
  }

  private async appendSepsisBundleNote(
    tenantDb: DataSource,
    bundleId: string,
    marker: string,
    noteLine: string,
  ) {
    const bundle = await this.getSepsisBundleContext(tenantDb, bundleId);
    if (!bundle) {
      throw new BadRequestException('Sepsis bundle not found for recommendation action');
    }

    const existingNotes = String(bundle.notes || '');
    if (existingNotes.includes(marker)) {
      return {
        reused: true,
        bundle,
      };
    }

    const nextNotes = existingNotes.length > 0 ? `${existingNotes}\n${noteLine}` : noteLine;
    const updatedRows = await tenantDb.query(
      `
      UPDATE sepsis_bundles
      SET notes = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING
        id,
        patient_id,
        admission_id,
        sepsis_screening_id,
        bundle_start_time,
        three_hour_bundle_complete,
        six_hour_bundle_complete,
        overall_compliance,
        repeat_lactate_measured,
        lactate_value,
        repeat_lactate_value,
        notes
      `,
      [nextNotes, bundleId],
    );

    return {
      reused: false,
      bundle: {
        ...bundle,
        ...(updatedRows[0] || {}),
        notes: nextNotes,
      },
    };
  }

  private async getBloodBankTransfusionContext(tenantDb: DataSource, transfusionId: string) {
    const rows = await this.safeQuery(
      tenantDb,
      `
      SELECT
        bt.id,
        bt.patient_id,
        bt.admission_id,
        bt.inventory_id,
        bt.cross_match_id,
        bt.indication,
        bt.order_date,
        bt.start_time,
        bt.end_time,
        bt.transfusion_status,
        bt.transfusion_reaction,
        bt.reaction_type,
        bt.reaction_severity,
        bt.reaction_time,
        bt.reaction_management,
        bt.consent_obtained,
        bt.consent_obtained_by,
        bt.completion_notes,
        bt.notes,
        bt.administered_by,
        bt.monitored_by,
        bi.unit_number,
        bi.component_type,
        bi.blood_group,
        bi.rh_factor
      FROM blood_transfusions bt
      LEFT JOIN blood_inventory bi ON bi.id = bt.inventory_id
      WHERE bt.id = $1
      LIMIT 1
      `,
      [transfusionId],
    );
    return rows[0] || null;
  }

  private async appendBloodBankTransfusionNote(
    tenantDb: DataSource,
    transfusionId: string,
    marker: string,
    noteLine: string,
  ) {
    const transfusion = await this.getBloodBankTransfusionContext(tenantDb, transfusionId);
    if (!transfusion) {
      throw new BadRequestException('Blood transfusion record not found for recommendation action');
    }

    const existingNotes = String(transfusion.notes || '');
    if (existingNotes.includes(marker)) {
      return {
        reused: true,
        transfusion,
      };
    }

    const nextNotes = existingNotes.length > 0 ? `${existingNotes}\n${noteLine}` : noteLine;
    const updatedRows = await tenantDb.query(
      `
      UPDATE blood_transfusions
      SET notes = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING
        id,
        patient_id,
        admission_id,
        inventory_id,
        cross_match_id,
        indication,
        order_date,
        start_time,
        end_time,
        transfusion_status,
        transfusion_reaction,
        reaction_type,
        reaction_severity,
        reaction_time,
        reaction_management,
        consent_obtained,
        consent_obtained_by,
        completion_notes,
        notes,
        administered_by,
        monitored_by
      `,
      [nextNotes, transfusionId],
    );

    return {
      reused: false,
      transfusion: {
        ...transfusion,
        ...(updatedRows[0] || {}),
        notes: nextNotes,
      },
    };
  }

  private async getOphthalmologyEncounterContext(tenantDb: DataSource, encounterId: string) {
    const rows = await this.safeQuery(
      tenantDb,
      `
      SELECT
        oe.id,
        oe.patient_id,
        oe.encounter_date,
        oe.encounter_type,
        oe.chief_complaint,
        oe.assessment,
        oe.plan,
        oe.payment_status,
        oe.finance_transaction_id
      FROM ophthalmology_encounters oe
      WHERE oe.id = $1
      LIMIT 1
      `,
      [encounterId],
    );
    return rows[0] || null;
  }

  private async appendOphthalmologyEncounterTextNote(
    tenantDb: DataSource,
    encounterId: string,
    field: 'assessment' | 'plan',
    marker: string,
    noteLine: string,
  ) {
    const encounter = await this.getOphthalmologyEncounterContext(tenantDb, encounterId);
    if (!encounter) {
      throw new BadRequestException('Ophthalmology encounter not found for recommendation action');
    }

    const existingValue = String(encounter[field] || '');
    if (existingValue.includes(marker)) {
      return {
        reused: true,
        encounter,
      };
    }

    const nextValue = existingValue.length > 0 ? `${existingValue}\n${noteLine}` : noteLine;
    const updatedRows = await tenantDb.query(
      `
      UPDATE ophthalmology_encounters
      SET ${field} = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING
        id,
        patient_id,
        encounter_date,
        encounter_type,
        chief_complaint,
        assessment,
        plan,
        payment_status,
        finance_transaction_id
      `,
      [nextValue, encounterId],
    );

    return {
      reused: false,
      encounter: {
        ...encounter,
        ...(updatedRows[0] || {}),
        [field]: nextValue,
      },
    };
  }

  private async getTelemedicineConsultationContext(tenantDb: DataSource, consultationId: string) {
    const rows = await this.safeQuery(
      tenantDb,
      `
      SELECT
        tc.id,
        tc.patient_id,
        tc.doctor_id,
        tc.consultation_type,
        tc.status,
        tc.scheduled_start_time,
        tc.actual_start_time,
        tc.patient_consent,
        tc.consent_date,
        tc.patient_joined,
        tc.doctor_joined,
        tc.technical_issues,
        tc.notes
      FROM telemedicine_consultations tc
      WHERE tc.id = $1
      LIMIT 1
      `,
      [consultationId],
    );
    return rows[0] || null;
  }

  private async appendTelemedicineConsultationNote(
    tenantDb: DataSource,
    consultationId: string,
    marker: string,
    noteLine: string,
  ) {
    const consultation = await this.getTelemedicineConsultationContext(tenantDb, consultationId);
    if (!consultation) {
      throw new BadRequestException('Telemedicine consultation not found for recommendation action');
    }

    const existingNotes = String(consultation.notes || '');
    if (existingNotes.includes(marker)) {
      return {
        reused: true,
        consultation,
      };
    }

    const nextNotes = existingNotes.length > 0 ? `${existingNotes}\n${noteLine}` : noteLine;
    const updatedRows = await tenantDb.query(
      `
      UPDATE telemedicine_consultations
      SET notes = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING
        id,
        patient_id,
        doctor_id,
        consultation_type,
        status,
        scheduled_start_time,
        actual_start_time,
        patient_consent,
        consent_date,
        patient_joined,
        doctor_joined,
        technical_issues,
        notes
      `,
      [nextNotes, consultationId],
    );

    return {
      reused: false,
      consultation: {
        ...consultation,
        ...(updatedRows[0] || {}),
        notes: nextNotes,
      },
    };
  }

  private async getLabCriticalAlertContext(tenantDb: DataSource, alertId: string) {
    const rows = await this.safeQuery(
      tenantDb,
      `
      SELECT
        lca.id,
        lca.patient_id,
        lca.lab_order_id,
        lca.component_name,
        lca.result_value,
        lca.critical_range,
        lca.severity,
        lca.alert_status,
        lca.alerted_to,
        lca.escalated_to,
        lca.acknowledged_by,
        lca.acknowledgment_notes,
        lca.alerted_at,
        lca.acknowledged_at,
        lca.escalated_at
      FROM lab_critical_alerts lca
      WHERE lca.id = $1
      LIMIT 1
      `,
      [alertId],
    );
    return rows[0] || null;
  }

  private async appendLabCriticalAlertNote(
    tenantDb: DataSource,
    alertId: string,
    marker: string,
    noteLine: string,
    options?: {
      status?: 'pending' | 'acknowledged' | 'escalated';
      acknowledgedBy?: string | null;
      escalatedTo?: string | null;
    },
  ) {
    const alert = await this.getLabCriticalAlertContext(tenantDb, alertId);
    if (!alert) {
      throw new BadRequestException('Lab critical alert not found for recommendation action');
    }

    const existingNotes = String(alert.acknowledgment_notes || '');
    const targetStatus = this.normalizeText(options?.status)?.toLowerCase() || null;
    const statusAlreadyMet =
      targetStatus && String(alert.alert_status || '').toLowerCase() === targetStatus;

    if (existingNotes.includes(marker) && statusAlreadyMet) {
      return {
        reused: true,
        alert,
      };
    }

    const nextNotes = existingNotes.length > 0 ? `${existingNotes}\n${noteLine}` : noteLine;
    const nextStatus = targetStatus || String(alert.alert_status || '').toLowerCase() || 'pending';
    const acknowledgedBy = options?.acknowledgedBy || null;
    const escalatedTo = options?.escalatedTo || null;

    const updatedRows = await tenantDb.query(
      `
      UPDATE lab_critical_alerts
      SET
        acknowledgment_notes = $1,
        alert_status = $2,
        acknowledged_by = CASE WHEN $3::uuid IS NULL THEN acknowledged_by ELSE $3::uuid END,
        acknowledged_at = CASE
          WHEN $2 = 'acknowledged' AND acknowledged_at IS NULL THEN NOW()
          ELSE acknowledged_at
        END,
        escalated_to = CASE WHEN $4::uuid IS NULL THEN escalated_to ELSE $4::uuid END,
        escalated_at = CASE
          WHEN $2 = 'escalated' AND escalated_at IS NULL THEN NOW()
          ELSE escalated_at
        END
      WHERE id = $5
      RETURNING
        id,
        patient_id,
        lab_order_id,
        component_name,
        result_value,
        critical_range,
        severity,
        alert_status,
        alerted_to,
        escalated_to,
        acknowledged_by,
        acknowledgment_notes,
        alerted_at,
        acknowledged_at,
        escalated_at
      `,
      [nextNotes, nextStatus, acknowledgedBy, escalatedTo, alertId],
    );

    return {
      reused: false,
      alert: {
        ...alert,
        ...(updatedRows[0] || {}),
        acknowledgment_notes: nextNotes,
      },
    };
  }

  private async appendLabOrderWorkflowEvent(
    tenantDb: DataSource,
    labOrderId: string,
    marker: string,
    eventPayload: Record<string, any>,
  ) {
    const orderRows = await this.safeQuery(
      tenantDb,
      `
      SELECT
        id,
        patient_id,
        status,
        tests,
        priority,
        payment_status,
        workflow_events
      FROM lab_orders
      WHERE id = $1
      LIMIT 1
      `,
      [labOrderId],
    );
    const order = orderRows[0] || null;
    if (!order) {
      return {
        reused: true,
        order: null,
      };
    }

    const existingEvents = this.parseJsonArray(order.workflow_events);
    const markerExists = existingEvents.some((entry: any) => String(entry?.marker || '') === marker);
    if (markerExists) {
      return {
        reused: true,
        order: {
          ...order,
          workflow_events: existingEvents,
        },
      };
    }

    const nextEvents = [
      ...existingEvents,
      {
        marker,
        source: 'nurse_cross_module_queue',
        ...(eventPayload || {}),
      },
    ];

    try {
      const updatedRows = await tenantDb.query(
        `
        UPDATE lab_orders
        SET workflow_events = $1::jsonb, updated_at = NOW()
        WHERE id = $2
        RETURNING
          id,
          patient_id,
          status,
          tests,
          priority,
          payment_status,
          workflow_events
        `,
        [JSON.stringify(nextEvents), labOrderId],
      );

      return {
        reused: false,
        order: {
          ...order,
          ...(updatedRows[0] || {}),
          workflow_events: nextEvents,
        },
      };
    } catch (error: any) {
      if (error?.code === '42703') {
        return {
          reused: false,
          order,
          workflowEventFallback: true,
        };
      }
      throw error;
    }
  }

  private async getPharmacyPrescriptionContext(tenantDb: DataSource, prescriptionId: string) {
    const rows = await this.safeQuery(
      tenantDb,
      `
      SELECT
        p.id,
        p.patient_id,
        p.medication_name,
        p.dosage,
        p.frequency,
        p.quantity,
        p.status,
        p.instructions,
        p.created_at,
        COALESCE(stock.quantity_on_hand, 0)::int as stock_on_hand,
        COALESCE(stock.reorder_level, 0)::int as reorder_level,
        COALESCE(stock.inventory_match_count, 0)::int as inventory_match_count
      FROM prescriptions p
      LEFT JOIN LATERAL (
        SELECT
          SUM(pi.quantity_on_hand) as quantity_on_hand,
          MIN(pi.reorder_level) as reorder_level,
          COUNT(*) as inventory_match_count
        FROM pharmacy_inventory pi
        WHERE pi.status = 'active'
          AND (
            (p.medication_name IS NOT NULL AND (
              pi.name ILIKE '%' || p.medication_name || '%'
              OR pi.generic_name ILIKE '%' || p.medication_name || '%'
            ))
            OR (p.medication_name_snomed_code IS NOT NULL AND pi.snomed_code = p.medication_name_snomed_code)
          )
      ) stock ON TRUE
      WHERE p.id = $1
      LIMIT 1
      `,
      [prescriptionId],
    );
    return rows[0] || null;
  }

  private async appendPharmacyPrescriptionInstruction(
    tenantDb: DataSource,
    prescriptionId: string,
    marker: string,
    noteLine: string,
  ) {
    const prescription = await this.getPharmacyPrescriptionContext(tenantDb, prescriptionId);
    if (!prescription) {
      throw new BadRequestException('Prescription not found for pharmacy recommendation action');
    }

    const existingInstructions = String(prescription.instructions || '');
    if (existingInstructions.includes(marker)) {
      return {
        reused: true,
        prescription,
      };
    }

    const nextInstructions = existingInstructions.length > 0 ? `${existingInstructions}\n${noteLine}` : noteLine;
    const updatedRows = await tenantDb.query(
      `
      UPDATE prescriptions
      SET instructions = $1
      WHERE id = $2
      RETURNING id, patient_id, medication_name, dosage, frequency, quantity, status, instructions, created_at
      `,
      [nextInstructions, prescriptionId],
    );

    return {
      reused: false,
      prescription: {
        ...prescription,
        ...(updatedRows[0] || {}),
        instructions: nextInstructions,
      },
    };
  }

  private async createOrReuseHivReferral(
    tenantDb: DataSource,
    payload: {
      enrollmentId: string;
      referralType: 'P' | 'T' | 'H';
      referredBy: string;
      referredByName: string;
      referredToFacility?: string | null;
      referredToProvider?: string | null;
      referralReason: string;
      referralTypeDetails?: string | null;
      referralPriority?: 'urgent' | 'high' | 'normal' | 'low';
      referralDate?: string;
    },
  ) {
    const existingRows = await this.safeQuery(
      tenantDb,
      `
      SELECT id, referral_status, referral_type
      FROM hiv_referrals
      WHERE enrollment_id = $1
        AND referral_type = $2
        AND referral_status IN ('pending', 'in_progress')
      ORDER BY referral_date DESC, created_at DESC
      LIMIT 1
      `,
      [payload.enrollmentId, payload.referralType],
    );

    if (existingRows[0]?.id) {
      return {
        id: existingRows[0].id,
        referral_status: existingRows[0].referral_status,
        reused: true,
      };
    }

    const referral = await this.hivService.createReferral(
      {
        enrollmentId: payload.enrollmentId,
        referralDate: payload.referralDate || new Date().toISOString().split('T')[0],
        referralType: payload.referralType,
        referralTypeDetails: payload.referralTypeDetails || null,
        referredToFacility: payload.referredToFacility || null,
        referredToProvider: payload.referredToProvider || null,
        referralReason: payload.referralReason,
        referralPriority: payload.referralPriority || 'normal',
        referredBy: payload.referredBy,
        referredByName: payload.referredByName,
      },
      tenantDb,
    );

    return {
      ...referral,
      reused: false,
    };
  }

  private async upsertHivClinicalAlert(
    tenantDb: DataSource,
    payload: {
      enrollmentId: string;
      alertType:
        | 'treatment_failure'
        | 'high_vl'
        | 'declining_cd4'
        | 'eac_required'
        | 'ltfu_risk'
        | 'overdue_test'
        | 'adherence_concern'
        | 'side_effects'
        | 'regimen_change_needed'
        | 'pregnancy_risk';
      severity: 'low' | 'medium' | 'high' | 'critical';
      title: string;
      message: string;
      relatedData?: Record<string, any>;
    },
  ) {
    try {
      const existingRows = await tenantDb.query(
        `
        SELECT id
        FROM hiv_clinical_alerts
        WHERE enrollment_id = $1
          AND alert_type = $2
          AND is_resolved = false
        LIMIT 1
        `,
        [payload.enrollmentId, payload.alertType],
      );

      if (existingRows[0]?.id) {
        const updatedRows = await tenantDb.query(
          `
          UPDATE hiv_clinical_alerts
          SET
            severity = $1,
            title = $2,
            message = $3,
            related_data = $4::jsonb,
            updated_at = NOW()
          WHERE id = $5
          RETURNING id, alert_type, severity, is_resolved
          `,
          [
            payload.severity,
            payload.title,
            payload.message,
            JSON.stringify(payload.relatedData || {}),
            existingRows[0].id,
          ],
        );
        return {
          ...updatedRows[0],
          reused: true,
        };
      }

      const insertedRows = await tenantDb.query(
        `
        INSERT INTO hiv_clinical_alerts (
          enrollment_id, alert_type, severity, title, message, related_data, is_resolved
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, false)
        RETURNING id, alert_type, severity, is_resolved
        `,
        [
          payload.enrollmentId,
          payload.alertType,
          payload.severity,
          payload.title,
          payload.message,
          JSON.stringify(payload.relatedData || {}),
        ],
      );

      return {
        ...insertedRows[0],
        reused: false,
      };
    } catch (error) {
      if (!this.isMissingTableError(error)) {
        throw error;
      }
      return null;
    }
  }

  private async upsertHivMonitoringSchedule(
    tenantDb: DataSource,
    enrollmentId: string,
    testType: 'viral_load',
    nextScheduledDate: string,
    note: string,
  ) {
    const existingRows = await this.safeQuery(
      tenantDb,
      `
      SELECT id, last_test_date, last_test_result, monitoring_frequency_months
      FROM hiv_monitoring_schedules
      WHERE enrollment_id = $1 AND test_type = $2
      LIMIT 1
      `,
      [enrollmentId, testType],
    );

    if (existingRows[0]?.id) {
      const updated = await tenantDb.query(
        `
        UPDATE hiv_monitoring_schedules
        SET
          next_scheduled_date = $1,
          is_overdue = false,
          days_overdue = 0,
          alert_sent = false,
          alert_sent_date = NULL,
          notes = $2,
          updated_at = NOW()
        WHERE id = $3
        RETURNING *
        `,
        [nextScheduledDate, note, existingRows[0].id],
      );
      return updated[0];
    }

    const inserted = await tenantDb.query(
      `
      INSERT INTO hiv_monitoring_schedules (
        enrollment_id, test_type, next_scheduled_date, monitoring_frequency_months,
        is_overdue, days_overdue, notes
      )
      VALUES ($1, $2, $3, 3, false, 0, $4)
      RETURNING *
      `,
      [enrollmentId, testType, nextScheduledDate, note],
    );

    return inserted[0];
  }

  private computeAgeFromDob(dateOfBirth?: string | Date | null) {
    if (!dateOfBirth) {
      return null;
    }
    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) {
      return null;
    }
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age -= 1;
    }
    return age;
  }

  private normalizeCitationList(citations: Array<{ rule_id: string; source: string; citation: string } | null | undefined>) {
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

  private createGuidelineCitation(ruleId: string, citation: string, source = 'WHO HIV guidance') {
    return {
      rule_id: ruleId,
      source,
      citation,
    };
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

  private buildHivPathwayRecommendationBundle(params: {
    enrollment: any;
    pathway: any;
    latestVisit: any;
  }) {
    const { enrollment, pathway, latestVisit } = params;
    const status = String(pathway?.status || '');
    const age = this.computeAgeFromDob(enrollment?.date_of_birth);
    const pregnancyStatus = String(latestVisit?.pregnancy_lactating_status || '').trim().toUpperCase();
    const isPregnant = pregnancyStatus === 'P' || pregnancyStatus.includes('PREG');

    const items: Array<Record<string, any>> = [];
    const citations = this.normalizeCitationList([
      this.createGuidelineCitation(
        `vl-pathway.${status}`,
        status === 'failure_after_eac'
          ? 'WHO HIV viral load algorithm: persistent high VL after EAC needs clinician switch review.'
          : 'WHO HIV viral load algorithm: unsuppressed VL requires EAC, repeat viral load, and adherence follow-up.',
      ),
      pathway?.overdue
        ? this.createGuidelineCitation(
            'vl-pathway.overdue_vl',
            'WHO HIV monitoring schedule: overdue viral load should be collected at the next available contact.',
          )
        : null,
      isPregnant
        ? this.createGuidelineCitation(
            'vl-pathway.pmtct',
            'WHO PMTCT guidance: pregnant or breastfeeding clients need intensified adherence support and maternal follow-up.',
            'WHO PMTCT guidance',
          )
        : null,
      age !== null && age < 15
        ? this.createGuidelineCitation(
            'vl-pathway.pediatric',
            'WHO pediatric HIV guidance: children with unsuppressed VL need caregiver adherence review and pediatric regimen assessment.',
            'WHO pediatric HIV guidance',
          )
        : null,
    ]);

    if (status === 'high_vl_needs_eac' || status === 'high_vl' || status === 'high_vl_on_eac') {
      items.push({
        id: 'eac-followup',
        type: 'follow_up',
        title: status === 'high_vl_on_eac' ? 'Continue EAC session tracking' : 'Start or schedule EAC follow-up',
        urgency: 'urgent',
        rationale: 'Nurse-led adherence counseling and documentation is the first-line response to unsuppressed viral load.',
        citations: citations.filter((citation) => citation.rule_id.startsWith('vl-pathway')),
        action_payload: {
          status,
          next_step: status === 'high_vl_on_eac' ? 'continue_eac' : 'start_eac',
          suggested_note:
            status === 'high_vl_on_eac'
              ? 'Review completed EAC sessions, reinforce adherence barriers, and confirm repeat VL plan.'
              : 'Enroll patient into EAC, document adherence barriers, and prepare repeat VL scheduling.',
        },
      });
    }

    items.push({
      id: 'repeat-vl-plan',
      type: 'lab_followup',
      title: 'Prepare repeat viral load follow-up',
      urgency: pathway?.overdue ? 'urgent' : 'routine',
      rationale: 'The nurse queue should always carry the next viral-load collection plan alongside the current unsuppressed result.',
      citations: citations.filter((citation) => citation.rule_id === 'vl-pathway.overdue_vl' || citation.rule_id === `vl-pathway.${status}`),
      action_payload: {
        next_vl_date: pathway?.nextVlDate || null,
        overdue: Boolean(pathway?.overdue),
        last_vl_value: pathway?.lastVlValue ?? null,
      },
    });

    if (status === 'failure_after_eac') {
      items.push({
        id: 'doctor-switch-review',
        type: 'escalation',
        title: 'Escalate for regimen switch review',
        urgency: 'urgent',
        rationale: 'Persistent high viral load after EAC should move to clinician review without waiting for the nurse to reinterpret the algorithm.',
        citations: citations.filter((citation) => citation.rule_id === `vl-pathway.${status}`),
        action_payload: {
          doctor_sync_status: 'doctor_review_recommended',
        },
      });
    }

    if (isPregnant) {
      items.push({
        id: 'pmtct-linkage',
        type: 'pmtct_followup',
        title: 'Confirm PMTCT or ANC linkage',
        urgency: 'urgent',
        rationale: 'Pregnancy raises transmission risk and requires linkage visibility inside the nurse queue.',
        citations: citations.filter((citation) => citation.rule_id === 'vl-pathway.pmtct'),
        action_payload: {
          pregnancy_status: latestVisit?.pregnancy_lactating_status || null,
          suggested_note: 'Confirm ANC/PMTCT linkage, adherence review, and maternal follow-up plan.',
        },
      });
    }

    if (age !== null && age < 15) {
      items.push({
        id: 'pediatric-adherence',
        type: 'dose_review',
        title: 'Review pediatric dose and caregiver adherence',
        urgency: 'urgent',
        rationale: 'Pediatric unsuppressed viral load often needs caregiver counseling and weight-band dose verification.',
        citations: citations.filter((citation) => citation.rule_id === 'vl-pathway.pediatric'),
        action_payload: {
          age,
          current_regimen_code: enrollment?.current_regimen_code || null,
        },
      });
    }

    return {
      version: 1,
      generated_at: new Date().toISOString(),
      bundle_label: 'WHO HIV nurse follow-up bundle',
      summary: `${items.length} HIV nurse action${items.length === 1 ? '' : 's'} prepared from the viral-load pathway.`,
      actionable_count: items.length,
      pending_count: items.length,
      applied_count: 0,
      citations,
      items,
    };
  }

  private buildHivRegimenRecommendationBundle(params: {
    request: any;
    latestVisit: any;
  }) {
    const { request, latestVisit } = params;
    const safetySummary = this.parseJsonObject(request?.regimen_safety_summary);
    const age = this.computeAgeFromDob(request?.date_of_birth);
    const pregnancyStatus = String(latestVisit?.pregnancy_lactating_status || '').trim().toUpperCase();
    const isPregnant = pregnancyStatus === 'P' || pregnancyStatus.includes('PREG');
    const tbMeds = Array.isArray(safetySummary?.context?.tbMedications) ? safetySummary.context.tbMedications : [];
    const warnings = Array.isArray(safetySummary?.warnings) ? safetySummary.warnings : [];
    const guidelineReferences = Array.isArray(safetySummary?.guidelineReferences)
      ? safetySummary.guidelineReferences.map((reference: string, index: number) =>
          this.createGuidelineCitation(`regimen.${index + 1}`, reference, 'WHO HIV ART safety guidance'),
        )
      : [];

    const citations = this.normalizeCitationList([
      ...guidelineReferences,
      this.createGuidelineCitation(
        'regimen.switch',
        'WHO HIV treatment guidance: approved regimen switches still need nurse counseling, medication reconciliation, and follow-up documentation.',
      ),
      isPregnant
        ? this.createGuidelineCitation(
            'regimen.pmtct',
            'WHO PMTCT guidance: pregnancy status should be confirmed before executing regimen changes.',
            'WHO PMTCT guidance',
          )
        : null,
      age !== null && age < 15
        ? this.createGuidelineCitation(
            'regimen.pediatric',
            'WHO pediatric HIV dosing guidance: confirm weight-band dosing and caregiver instructions for regimen changes.',
            'WHO pediatric HIV guidance',
          )
        : null,
      tbMeds.length > 0
        ? this.createGuidelineCitation(
            'regimen.tb_interaction',
            'WHO HIV/TB co-treatment guidance: regimen switches with rifampicin or related TB therapy require interaction review.',
            'WHO HIV/TB co-treatment guidance',
          )
        : null,
    ]);

    const items: Array<Record<string, any>> = [
      {
        id: 'regimen-counseling',
        type: 'counseling',
        title: 'Counsel patient on approved regimen switch',
        urgency: 'urgent',
        rationale: 'Doctor approval alone is not enough; the nurse workflow should still ensure counseling and readiness before recording the visit.',
        citations: citations.filter((citation) => citation.rule_id === 'regimen.switch' || citation.rule_id.startsWith('regimen.')),
        action_payload: {
          current_regimen: request?.current_regimen_name || null,
          requested_regimen: request?.requested_regimen_name || null,
          change_reason: request?.change_reason_details || null,
        },
      },
      {
        id: 'visit-recording',
        type: 'visit_preparation',
        title: 'Prepare next HIV clinical visit recording',
        urgency: 'urgent',
        rationale: 'The nurse queue should make the next documentation step explicit so approved changes do not stall before visit capture.',
        citations: citations.filter((citation) => citation.rule_id === 'regimen.switch'),
        action_payload: {
          enrollment_id: request?.enrollment_id || null,
          requested_regimen_code: request?.requested_regimen_code || null,
        },
      },
    ];

    if (warnings.length > 0) {
      items.push({
        id: 'regimen-safety-warnings',
        type: 'safety_review',
        title: 'Review regimen safety warnings with clinician plan',
        urgency: 'urgent',
        rationale: 'Safety warnings should not be buried inside doctor approval metadata when the nurse is the one executing follow-through.',
        citations: guidelineReferences,
        action_payload: {
          warnings: warnings.map((warning: any) => ({
            message: warning?.message || null,
            recommendedAction: warning?.recommendedAction || null,
          })),
        },
      });
    }

    if (isPregnant) {
      items.push({
        id: 'pregnancy-safety-review',
        type: 'pmtct_followup',
        title: 'Confirm pregnancy or PMTCT regimen safety',
        urgency: 'urgent',
        rationale: 'Pregnancy should remain visible when the nurse is carrying the switch into the next contact.',
        citations: citations.filter((citation) => citation.rule_id === 'regimen.pmtct'),
        action_payload: {
          pregnancy_status: latestVisit?.pregnancy_lactating_status || null,
        },
      });
    }

    if (age !== null && age < 15) {
      items.push({
        id: 'pediatric-dose-check',
        type: 'dose_review',
        title: 'Confirm pediatric weight-band dosing',
        urgency: 'urgent',
        rationale: 'Regimen switch execution for children should explicitly trigger dose verification.',
        citations: citations.filter((citation) => citation.rule_id === 'regimen.pediatric'),
        action_payload: {
          age,
          requested_regimen_code: request?.requested_regimen_code || null,
        },
      });
    }

    if (tbMeds.length > 0) {
      items.push({
        id: 'tb-interaction-review',
        type: 'interaction_review',
        title: 'Check TB co-treatment interaction plan',
        urgency: 'urgent',
        rationale: 'Concurrent TB therapy changes the safe execution steps for HIV regimen switches.',
        citations: citations.filter((citation) => citation.rule_id === 'regimen.tb_interaction'),
        action_payload: {
          tb_medications: tbMeds,
        },
      });
    }

    return {
      version: 1,
      generated_at: new Date().toISOString(),
      bundle_label: 'WHO HIV regimen follow-through bundle',
      summary: `${items.length} nurse actions prepared for the approved regimen switch.`,
      actionable_count: items.length,
      pending_count: items.length,
      applied_count: 0,
      citations,
      items,
    };
  }

  private buildOncologyInfusionRecommendationBundle(params: {
    caseRow: any;
    regimen: any;
    session: any;
  }) {
    const { caseRow, regimen, session } = params;
    const hasActiveToxicitySignal = Number(caseRow?.active_grade3_plus || 0) > 0;
    const paymentPending = String(session?.payment_status || '').toLowerCase() === 'awaiting_payment';

    const citations = this.normalizeCitationList([
      this.createGuidelineCitation(
        'oncology.infusion_readiness',
        'WHO cancer treatment safety guidance: infusion sessions need a documented readiness review before administration.',
        'WHO oncology safety guidance',
      ),
      this.createGuidelineCitation(
        'oncology.prechemo_labs',
        'WHO oncology follow-up guidance: pre-chemo toxicity and laboratory gate checks should be documented before treatment.',
        'WHO oncology safety guidance',
      ),
      hasActiveToxicitySignal
        ? this.createGuidelineCitation(
            'oncology.toxicity_escalation',
            'WHO adverse-event guidance: unresolved Grade 3+ toxicity requires clinician escalation before continuing treatment.',
            'WHO oncology safety guidance',
          )
        : null,
    ]);

    const items: Array<Record<string, any>> = [
      {
        id: 'prepare-infusion-checklist',
        type: 'visit_preparation',
        title: 'Prepare infusion checklist',
        urgency: paymentPending ? 'high' : 'routine',
        rationale:
          'Queue-driven infusion readiness keeps nurse pre-treatment checks visible and traceable.',
        citations: citations.filter((citation) => citation.rule_id === 'oncology.infusion_readiness'),
        action_payload: {
          case_id: caseRow?.oncology_case_id || null,
          regimen_id: regimen?.id || null,
          session_id: session?.id || null,
          session_date: session?.session_date || null,
          cycle_number: session?.cycle_number ?? null,
        },
      },
      {
        id: 'confirm-prechemo-lab-gate',
        type: 'lab_followup',
        title: 'Confirm pre-chemo lab and toxicity gate',
        urgency: 'high',
        rationale:
          'Pre-chemo checks should be explicitly confirmed in the workflow before treatment proceeds.',
        citations: citations.filter((citation) => citation.rule_id === 'oncology.prechemo_labs'),
        action_payload: {
          case_id: caseRow?.oncology_case_id || null,
          regimen_id: regimen?.id || null,
          session_id: session?.id || null,
          payment_status: session?.payment_status || null,
        },
      },
    ];

    if (hasActiveToxicitySignal) {
      items.push({
        id: 'escalate-toxicity-risk-review',
        type: 'escalation',
        title: 'Escalate unresolved toxicity risk to oncologist',
        urgency: 'urgent',
        rationale:
          'Active Grade 3+ toxicity should trigger immediate clinician synchronization before infusion follow-through.',
        citations: citations.filter((citation) => citation.rule_id === 'oncology.toxicity_escalation'),
        action_payload: {
          case_id: caseRow?.oncology_case_id || null,
          regimen_id: regimen?.id || null,
          active_grade3_plus: Number(caseRow?.active_grade3_plus || 0),
          session_id: session?.id || null,
        },
      });
    }

    return {
      version: 1,
      generated_at: new Date().toISOString(),
      bundle_label: 'Oncology infusion readiness bundle',
      summary: `${items.length} oncology action${items.length === 1 ? '' : 's'} prepared for infusion follow-through.`,
      actionable_count: items.length,
      pending_count: items.length,
      applied_count: 0,
      citations,
      items,
    };
  }

  private buildOncologyToxicityRecommendationBundle(params: {
    caseRow: any;
    adverseEvent: any;
  }) {
    const { caseRow, adverseEvent } = params;
    const gradeLabel = this.normalizeText(adverseEvent?.grade) || 'unknown';

    const citations = this.normalizeCitationList([
      this.createGuidelineCitation(
        'oncology.toxicity_followup',
        'WHO oncology adverse-event guidance: clinically significant toxicities require nurse follow-up documentation and clinician handoff.',
        'WHO oncology safety guidance',
      ),
      this.createGuidelineCitation(
        'oncology.doctor_sync',
        'WHO multidisciplinary oncology care guidance: significant toxicity findings should be synchronized with the treating oncologist.',
        'WHO oncology safety guidance',
      ),
    ]);

    const items: Array<Record<string, any>> = [
      {
        id: 'acknowledge-toxicity-followup',
        type: 'safety_review',
        title: 'Document toxicity follow-up action',
        urgency: 'urgent',
        rationale:
          'Toxicity follow-up should be captured as a structured queue execution event, not just a narrative note.',
        citations: citations.filter((citation) => citation.rule_id === 'oncology.toxicity_followup'),
        action_payload: {
          case_id: caseRow?.oncology_case_id || null,
          adverse_event_id: adverseEvent?.id || null,
          regimen_id: adverseEvent?.regimen_id || null,
          grade: gradeLabel,
          event_type: adverseEvent?.event_type || null,
        },
      },
      {
        id: 'escalate-oncology-doctor-review',
        type: 'escalation',
        title: 'Sync toxicity escalation with oncologist',
        urgency: 'urgent',
        rationale:
          'Severe toxicity should be escalated with explicit doctor-sync metadata from the nurse queue.',
        citations: citations.filter((citation) => citation.rule_id === 'oncology.doctor_sync'),
        action_payload: {
          case_id: caseRow?.oncology_case_id || null,
          adverse_event_id: adverseEvent?.id || null,
          grade: gradeLabel,
          event_type: adverseEvent?.event_type || null,
        },
      },
    ];

    return {
      version: 1,
      generated_at: new Date().toISOString(),
      bundle_label: 'Oncology toxicity escalation bundle',
      summary: `${items.length} oncology toxicity action${items.length === 1 ? '' : 's'} queued for safety follow-through.`,
      actionable_count: items.length,
      pending_count: items.length,
      applied_count: 0,
      citations,
      items,
    };
  }

  private normalizeCardiologyRiskBand(riskScore?: string | null) {
    const normalized = String(riskScore || '').trim().toLowerCase();
    if (['critical', 'very_high', 'very-high', 'high_risk'].includes(normalized)) {
      return 'critical';
    }
    if (['high', 'elevated'].includes(normalized)) {
      return 'high';
    }
    if (['medium', 'moderate'].includes(normalized)) {
      return 'medium';
    }
    if (['low', 'stable'].includes(normalized)) {
      return 'low';
    }
    return 'medium';
  }

  private buildCardiologyProtocolRecommendationBundle(params: {
    encounter: any;
  }) {
    const { encounter } = params;
    const riskBand = this.normalizeCardiologyRiskBand(encounter?.risk_score);
    const paymentPending = String(encounter?.payment_status || '').toLowerCase() === 'awaiting_payment';

    const citations = this.normalizeCitationList([
      this.createGuidelineCitation(
        'cardiology.order_set',
        'WHO NCD cardiovascular care package: symptomatic or high-risk patients should have structured diagnostic work-up with ECG and indicated cardiac investigations.',
        'WHO NCD cardiovascular guidance',
      ),
      this.createGuidelineCitation(
        'cardiology.visit_prep',
        'WHO cardiovascular continuity-of-care guidance: encounter follow-up steps should be documented with explicit nurse and doctor handoff checkpoints.',
        'WHO NCD cardiovascular guidance',
      ),
      riskBand === 'critical' || riskBand === 'high'
        ? this.createGuidelineCitation(
            'cardiology.doctor_sync',
            'WHO cardiovascular risk management guidance: higher-risk findings need rapid clinician synchronization and escalation.',
            'WHO NCD cardiovascular guidance',
          )
        : null,
    ]);

    const defaultTests =
      riskBand === 'critical' || riskBand === 'high'
        ? ['ECG', 'Troponin', 'Echocardiogram']
        : ['ECG'];

    const items: Array<Record<string, any>> = [
      {
        id: 'prepare-cardiology-order-set',
        type: 'order_set',
        title: 'Prepare cardiology diagnostic order set',
        urgency: riskBand === 'critical' || riskBand === 'high' ? 'urgent' : 'high',
        rationale:
          'Queue-driven protocol bundles should generate structured diagnostic follow-through, not only passive visibility.',
        citations: citations.filter((citation) => citation.rule_id === 'cardiology.order_set'),
        action_payload: {
          encounter_id: encounter?.cardiology_encounter_id || encounter?.id || null,
          suggested_tests: defaultTests,
          risk_score: encounter?.risk_score || null,
        },
      },
      {
        id: 'complete-cardiology-visit-prep',
        type: 'visit_preparation',
        title: 'Complete cardiology visit-prep checkpoint',
        urgency: paymentPending ? 'high' : 'routine',
        rationale:
          'Visit-prep completion should be documented as an executable workflow event before consultation closure.',
        citations: citations.filter((citation) => citation.rule_id === 'cardiology.visit_prep'),
        action_payload: {
          encounter_id: encounter?.cardiology_encounter_id || encounter?.id || null,
          payment_status: encounter?.payment_status || null,
          care_status: encounter?.care_status || null,
        },
      },
    ];

    if (riskBand === 'critical' || riskBand === 'high') {
      items.push({
        id: 'escalate-cardiology-doctor-sync',
        type: 'escalation',
        title: 'Escalate cardiology findings to doctor sync',
        urgency: 'urgent',
        rationale:
          'Higher-risk cardiology states need explicit doctor synchronization to keep treatment decisions aligned.',
        citations: citations.filter((citation) => citation.rule_id === 'cardiology.doctor_sync'),
        action_payload: {
          encounter_id: encounter?.cardiology_encounter_id || encounter?.id || null,
          risk_score: encounter?.risk_score || null,
        },
      });
    }

    return {
      version: 1,
      generated_at: new Date().toISOString(),
      bundle_label: 'Cardiology protocol execution bundle',
      summary: `${items.length} cardiology protocol action${items.length === 1 ? '' : 's'} prepared for queue execution.`,
      actionable_count: items.length,
      pending_count: items.length,
      applied_count: 0,
      citations,
      items,
    };
  }

  private buildEdProtocolRecommendationBundle(params: {
    visit: any;
  }) {
    const { visit } = params;
    const triageLevel = Number(visit?.triage_level || 0);
    const triageAcuity = String(visit?.triage_acuity || '').trim().toLowerCase();
    const highAcuityFlags = Boolean(visit?.code_sepsis) || Boolean(visit?.code_stroke) || Boolean(visit?.code_stemi);
    const highAcuity =
      highAcuityFlags || triageLevel === 1 || triageLevel === 2 || triageAcuity === 'immediate' || triageAcuity === 'emergent';

    const citations = this.normalizeCitationList([
      this.createGuidelineCitation(
        'ed.order_set',
        'WHO emergency care guidance: high-acuity presentations should trigger structured diagnostic and treatment orders early in the encounter.',
        'WHO emergency care guidance',
      ),
      this.createGuidelineCitation(
        'ed.disposition_prep',
        'WHO emergency workflow guidance: disposition and follow-up instructions should be documented before ED closure.',
        'WHO emergency care guidance',
      ),
      highAcuity
        ? this.createGuidelineCitation(
            'ed.doctor_sync',
            'WHO emergency triage guidance: high-acuity findings should be synchronized rapidly with the responsible clinician.',
            'WHO emergency care guidance',
          )
        : null,
    ]);

    const suggestedOrders =
      triageLevel <= 2 || highAcuityFlags
        ? ['STAT clinician reassessment', 'ECG', 'CBC', 'CMP', 'Point-of-care lactate']
        : triageLevel === 3
          ? ['Focused diagnostic panel', 'Targeted imaging per chief complaint']
          : ['Focused reassessment plan'];

    const items: Array<Record<string, any>> = [
      {
        id: 'prepare-ed-order-set',
        type: 'order_set',
        title: 'Prepare ED protocol order set',
        urgency: highAcuity ? 'urgent' : 'high',
        rationale:
          'ED queue execution should generate structured order recommendations instead of only signaling visibility.',
        citations: citations.filter((citation) => citation.rule_id === 'ed.order_set'),
        action_payload: {
          visit_id: visit?.ed_visit_id || visit?.id || null,
          triage_level: triageLevel || null,
          triage_acuity: visit?.triage_acuity || null,
          suggested_orders: suggestedOrders,
        },
      },
      {
        id: 'complete-ed-disposition-prep',
        type: 'visit_preparation',
        title: 'Complete ED disposition prep checkpoint',
        urgency: visit?.ed_status === 'ready_for_discharge' ? 'high' : 'routine',
        rationale:
          'Disposition readiness should be tracked as an executable checkpoint from the queue.',
        citations: citations.filter((citation) => citation.rule_id === 'ed.disposition_prep'),
        action_payload: {
          visit_id: visit?.ed_visit_id || visit?.id || null,
          ed_status: visit?.ed_status || null,
          disposition: visit?.disposition || null,
        },
      },
    ];

    if (highAcuity) {
      items.push({
        id: 'escalate-ed-doctor-sync',
        type: 'escalation',
        title: 'Escalate ED case to doctor synchronization',
        urgency: 'urgent',
        rationale:
          'High-acuity ED states require explicit doctor synchronization and acknowledgement.',
        citations: citations.filter((citation) => citation.rule_id === 'ed.doctor_sync'),
        action_payload: {
          visit_id: visit?.ed_visit_id || visit?.id || null,
          triage_level: triageLevel || null,
          triage_acuity: visit?.triage_acuity || null,
          code_sepsis: Boolean(visit?.code_sepsis),
          code_stroke: Boolean(visit?.code_stroke),
          code_stemi: Boolean(visit?.code_stemi),
        },
      });
    }

    return {
      version: 1,
      generated_at: new Date().toISOString(),
      bundle_label: 'ED protocol execution bundle',
      summary: `${items.length} ED action${items.length === 1 ? '' : 's'} prepared for queue execution.`,
      actionable_count: items.length,
      pending_count: items.length,
      applied_count: 0,
      citations,
      items,
    };
  }

  private buildSepsisProtocolRecommendationBundle(params: {
    bundle: any;
  }) {
    const { bundle } = params;
    const severeSignal = Boolean(bundle?.severe_sepsis) || Boolean(bundle?.septic_shock);
    const threeHourComplete = Boolean(bundle?.three_hour_bundle_complete);
    const sixHourComplete = Boolean(bundle?.six_hour_bundle_complete);
    const overallCompliance = Boolean(bundle?.overall_compliance);
    const lactateValue = Number(bundle?.lactate_value || 0);
    const repeatLactateNeeded = !Boolean(bundle?.repeat_lactate_measured) || lactateValue >= 4;

    const citations = this.normalizeCitationList([
      this.createGuidelineCitation(
        'sepsis.three_hour_bundle',
        'WHO sepsis care guidance: early recognition should trigger rapid three-hour bundle workflow execution.',
        'WHO sepsis guidance',
      ),
      this.createGuidelineCitation(
        'sepsis.repeat_lactate',
        'WHO sepsis follow-up guidance: elevated lactate requires repeat measurement planning and documented follow-through.',
        'WHO sepsis guidance',
      ),
      severeSignal || !overallCompliance
        ? this.createGuidelineCitation(
            'sepsis.doctor_sync',
            'WHO sepsis escalation guidance: severe sepsis states and bundle non-compliance should be synchronized with physician leadership.',
            'WHO sepsis guidance',
          )
        : null,
    ]);

    const items: Array<Record<string, any>> = [
      {
        id: 'queue-sepsis-three-hour-bundle',
        type: 'order_set',
        title: 'Queue sepsis three-hour bundle actions',
        urgency: severeSignal || !threeHourComplete ? 'urgent' : 'high',
        rationale:
          'Sepsis queue bundles should produce concrete execution tasks for time-critical interventions.',
        citations: citations.filter((citation) => citation.rule_id === 'sepsis.three_hour_bundle'),
        action_payload: {
          bundle_id: bundle?.sepsis_bundle_id || bundle?.id || null,
          screening_id: bundle?.sepsis_screening_id || null,
          three_hour_bundle_complete: threeHourComplete,
          six_hour_bundle_complete: sixHourComplete,
          overall_compliance: overallCompliance,
        },
      },
      {
        id: 'confirm-repeat-lactate-plan',
        type: 'lab_followup',
        title: 'Confirm repeat lactate monitoring plan',
        urgency: repeatLactateNeeded ? 'urgent' : 'routine',
        rationale:
          'Repeat lactate planning should be documented as an explicit queue action for sepsis safety.',
        citations: citations.filter((citation) => citation.rule_id === 'sepsis.repeat_lactate'),
        action_payload: {
          bundle_id: bundle?.sepsis_bundle_id || bundle?.id || null,
          repeat_lactate_measured: Boolean(bundle?.repeat_lactate_measured),
          lactate_value: Number.isFinite(lactateValue) && lactateValue > 0 ? lactateValue : null,
          repeat_lactate_value:
            Number.isFinite(Number(bundle?.repeat_lactate_value || 0)) && Number(bundle?.repeat_lactate_value || 0) > 0
              ? Number(bundle?.repeat_lactate_value || 0)
              : null,
        },
      },
    ];

    if (severeSignal || !overallCompliance) {
      items.push({
        id: 'escalate-sepsis-doctor-sync',
        type: 'escalation',
        title: 'Escalate sepsis bundle to doctor synchronization',
        urgency: 'urgent',
        rationale:
          'High-risk sepsis states and non-compliant bundles need rapid physician synchronization.',
        citations: citations.filter((citation) => citation.rule_id === 'sepsis.doctor_sync'),
        action_payload: {
          bundle_id: bundle?.sepsis_bundle_id || bundle?.id || null,
          severe_sepsis: Boolean(bundle?.severe_sepsis),
          septic_shock: Boolean(bundle?.septic_shock),
          overall_compliance: overallCompliance,
        },
      });
    }

    return {
      version: 1,
      generated_at: new Date().toISOString(),
      bundle_label: 'Sepsis protocol execution bundle',
      summary: `${items.length} sepsis action${items.length === 1 ? '' : 's'} prepared for queue execution.`,
      actionable_count: items.length,
      pending_count: items.length,
      applied_count: 0,
      citations,
      items,
    };
  }

  private buildBloodBankTransfusionRecommendationBundle(params: {
    transfusion: any;
  }) {
    const { transfusion } = params;
    const status = String(transfusion?.transfusion_status || '').toLowerCase();
    const reaction = Boolean(transfusion?.transfusion_reaction);
    const consentObtained = Boolean(transfusion?.consent_obtained);

    const citations = this.normalizeCitationList([
      this.createGuidelineCitation(
        'blood_bank.consent_crossmatch',
        'WHO blood transfusion safety guidance: transfusion should proceed only after compatibility checks and documented informed consent.',
        'WHO blood transfusion safety guidance',
      ),
      this.createGuidelineCitation(
        'blood_bank.monitoring',
        'WHO transfusion standards: initiation and ongoing monitoring should be documented to detect early reactions.',
        'WHO blood transfusion safety guidance',
      ),
      this.createGuidelineCitation(
        'blood_bank.completion',
        'WHO transfusion quality guidance: completion checklist and post-transfusion documentation reduce preventable adverse events.',
        'WHO blood transfusion safety guidance',
      ),
      reaction
        ? this.createGuidelineCitation(
            'blood_bank.reaction_escalation',
            'WHO hemovigilance guidance: suspected transfusion reactions require immediate escalation and documented management.',
            'WHO hemovigilance guidance',
          )
        : null,
    ]);

    const items: Array<Record<string, any>> = [];

    if (!consentObtained || status === 'ordered') {
      items.push({
        id: 'confirm-crossmatch-consent',
        type: 'safety_review',
        title: 'Confirm compatibility checks and transfusion consent',
        urgency: reaction ? 'urgent' : 'high',
        rationale:
          'Compatibility and consent checkpoints must be captured as executable workflow events before or during transfusion.',
        citations: citations.filter((citation) => citation.rule_id === 'blood_bank.consent_crossmatch'),
        action_payload: {
          transfusion_id: transfusion?.transfusion_id || transfusion?.id || null,
          unit_number: transfusion?.unit_number || null,
          component_type: transfusion?.component_type || null,
        },
      });
    }

    if (status === 'ordered') {
      items.push({
        id: 'start-transfusion-monitoring',
        type: 'visit_preparation',
        title: 'Start transfusion monitoring workflow',
        urgency: 'urgent',
        rationale:
          'Ordered transfusions should be transitioned into monitored care through a one-click execution checkpoint.',
        citations: citations.filter((citation) => citation.rule_id === 'blood_bank.monitoring'),
        action_payload: {
          transfusion_id: transfusion?.transfusion_id || transfusion?.id || null,
          ordered_at: transfusion?.order_date || null,
          patient_blood_group: transfusion?.patient_blood_type || null,
        },
      });
    }

    if (status === 'in_progress') {
      items.push({
        id: 'complete-transfusion-checklist',
        type: 'workflow_completion',
        title: 'Complete transfusion safety checklist',
        urgency: reaction ? 'urgent' : 'high',
        rationale:
          'In-progress transfusions need explicit completion closure with safety documentation and handoff traceability.',
        citations: citations.filter((citation) => citation.rule_id === 'blood_bank.completion'),
        action_payload: {
          transfusion_id: transfusion?.transfusion_id || transfusion?.id || null,
          started_at: transfusion?.start_time || null,
        },
      });
    }

    if (reaction || status === 'in_progress') {
      items.push({
        id: 'document-transfusion-reaction-escalation',
        type: 'escalation',
        title: reaction ? 'Escalate active transfusion reaction' : 'Record reaction surveillance escalation',
        urgency: reaction ? 'urgent' : 'high',
        rationale:
          'Reaction surveillance and escalation should be operationalized directly from the queue for rapid clinician response.',
        citations: citations.filter((citation) => citation.rule_id === 'blood_bank.reaction_escalation'),
        action_payload: {
          transfusion_id: transfusion?.transfusion_id || transfusion?.id || null,
          reaction_type: transfusion?.reaction_type || null,
          reaction_severity: transfusion?.reaction_severity || null,
          reaction_detected: reaction,
        },
      });
    }

    return {
      version: 1,
      generated_at: new Date().toISOString(),
      bundle_label: 'Blood transfusion safety execution bundle',
      summary: `${items.length} blood-bank action${items.length === 1 ? '' : 's'} prepared for queue execution.`,
      actionable_count: items.length,
      pending_count: items.length,
      applied_count: 0,
      citations,
      items,
    };
  }

  private buildOphthalmologyProtocolRecommendationBundle(params: {
    encounter: any;
  }) {
    const { encounter } = params;
    const clinicalText = `${encounter?.chief_complaint || ''} ${encounter?.assessment || ''}`.toLowerCase();
    const acuteRiskSignal =
      clinicalText.includes('vision loss') ||
      clinicalText.includes('sudden') ||
      clinicalText.includes('retinal') ||
      clinicalText.includes('acute glaucoma') ||
      clinicalText.includes('trauma');
    const paymentPending = String(encounter?.payment_status || '').toLowerCase() === 'awaiting_payment';

    const citations = this.normalizeCitationList([
      this.createGuidelineCitation(
        'ophthalmology.order_set',
        'WHO eye care guidance: high-risk visual symptoms should trigger structured diagnostic pathways (visual acuity, pressure, retinal evaluation).',
        'WHO integrated people-centred eye care guidance',
      ),
      this.createGuidelineCitation(
        'ophthalmology.visit_prep',
        'WHO eye health continuity guidance: encounter readiness and follow-up plans should be documented before clinical closure.',
        'WHO integrated people-centred eye care guidance',
      ),
      acuteRiskSignal
        ? this.createGuidelineCitation(
            'ophthalmology.doctor_sync',
            'WHO urgent eye-care guidance: suspected sight-threatening findings need immediate clinician synchronization.',
            'WHO integrated people-centred eye care guidance',
          )
        : null,
    ]);

    const suggestedOrders = acuteRiskSignal
      ? ['Urgent visual acuity reassessment', 'Intraocular pressure check', 'Retinal/OCT review']
      : ['Visual acuity reassessment', 'Refraction review'];

    const items: Array<Record<string, any>> = [
      {
        id: 'prepare-ophthalmology-order-set',
        type: 'order_set',
        title: 'Prepare ophthalmology diagnostic order set',
        urgency: acuteRiskSignal ? 'urgent' : 'high',
        rationale:
          'Eye-care queue bundles should convert risk signals into executable diagnostic order checkpoints.',
        citations: citations.filter((citation) => citation.rule_id === 'ophthalmology.order_set'),
        action_payload: {
          encounter_id: encounter?.ophthalmology_encounter_id || encounter?.id || null,
          suggested_orders: suggestedOrders,
          payment_status: encounter?.payment_status || null,
        },
      },
      {
        id: 'complete-ophthalmology-visit-prep',
        type: 'visit_preparation',
        title: 'Complete ophthalmology visit-prep checkpoint',
        urgency: paymentPending ? 'high' : 'routine',
        rationale:
          'Visit-prep completion and handoff context should be captured as executable queue events.',
        citations: citations.filter((citation) => citation.rule_id === 'ophthalmology.visit_prep'),
        action_payload: {
          encounter_id: encounter?.ophthalmology_encounter_id || encounter?.id || null,
          encounter_type: encounter?.encounter_type || null,
          payment_status: encounter?.payment_status || null,
        },
      },
    ];

    if (acuteRiskSignal) {
      items.push({
        id: 'escalate-ophthalmology-doctor-sync',
        type: 'escalation',
        title: 'Escalate ophthalmology findings to doctor sync',
        urgency: 'urgent',
        rationale:
          'Potentially sight-threatening findings require explicit doctor synchronization from queue execution.',
        citations: citations.filter((citation) => citation.rule_id === 'ophthalmology.doctor_sync'),
        action_payload: {
          encounter_id: encounter?.ophthalmology_encounter_id || encounter?.id || null,
          chief_complaint: encounter?.chief_complaint || null,
          assessment: encounter?.assessment || null,
        },
      });
    }

    return {
      version: 1,
      generated_at: new Date().toISOString(),
      bundle_label: 'Ophthalmology protocol execution bundle',
      summary: `${items.length} ophthalmology action${items.length === 1 ? '' : 's'} prepared for queue execution.`,
      actionable_count: items.length,
      pending_count: items.length,
      applied_count: 0,
      citations,
      items,
    };
  }

  private buildTelemedicineRecommendationBundle(params: {
    consultation: any;
  }) {
    const { consultation } = params;
    const status = String(consultation?.status || '').toLowerCase();
    const consented = Boolean(consultation?.patient_consent);
    const technicalIssue = status === 'technical_issue' || this.normalizeText(consultation?.technical_issues) !== null;
    const requiresDoctorSync = technicalIssue || status === 'in_progress';

    const citations = this.normalizeCitationList([
      this.createGuidelineCitation(
        'telemedicine.consent',
        'WHO digital health guidance: telemedicine encounters require explicit informed consent and traceable consent state.',
        'WHO digital health guidance',
      ),
      this.createGuidelineCitation(
        'telemedicine.visit_prep',
        'WHO telehealth workflow guidance: pre-consult checks and documentation readiness should be completed before care decisions.',
        'WHO digital health guidance',
      ),
      requiresDoctorSync
        ? this.createGuidelineCitation(
            'telemedicine.doctor_sync',
            'WHO telehealth safety guidance: technical-risk or active consultations should trigger explicit clinician synchronization.',
            'WHO digital health guidance',
          )
        : null,
    ]);

    const items: Array<Record<string, any>> = [
      {
        id: 'confirm-telemedicine-consent',
        type: 'safety_review',
        title: 'Confirm telemedicine consent status',
        urgency: consented ? 'routine' : 'high',
        rationale:
          'Consent state should be captured as executable workflow evidence before consultation progression.',
        citations: citations.filter((citation) => citation.rule_id === 'telemedicine.consent'),
        action_payload: {
          consultation_id: consultation?.consultation_id || consultation?.id || null,
          patient_consent: consented,
        },
      },
      {
        id: 'complete-telemedicine-visit-prep',
        type: 'visit_preparation',
        title: 'Complete telemedicine visit-prep checkpoint',
        urgency: status === 'scheduled' || status === 'waiting' ? 'high' : 'routine',
        rationale:
          'Telemedicine readiness tasks should be one-click executable from the queue for doctor synchronization.',
        citations: citations.filter((citation) => citation.rule_id === 'telemedicine.visit_prep'),
        action_payload: {
          consultation_id: consultation?.consultation_id || consultation?.id || null,
          consultation_type: consultation?.consultation_type || null,
          status: consultation?.status || null,
        },
      },
    ];

    if (requiresDoctorSync) {
      items.push({
        id: 'escalate-telemedicine-doctor-sync',
        type: 'escalation',
        title: 'Escalate telemedicine consultation to doctor sync',
        urgency: 'urgent',
        rationale:
          'Technical risk and active consultation states need explicit doctor synchronization traceability.',
        citations: citations.filter((citation) => citation.rule_id === 'telemedicine.doctor_sync'),
        action_payload: {
          consultation_id: consultation?.consultation_id || consultation?.id || null,
          status: consultation?.status || null,
          technical_issues: consultation?.technical_issues || null,
        },
      });
    }

    return {
      version: 1,
      generated_at: new Date().toISOString(),
      bundle_label: 'Telemedicine protocol execution bundle',
      summary: `${items.length} telemedicine action${items.length === 1 ? '' : 's'} prepared for queue execution.`,
      actionable_count: items.length,
      pending_count: items.length,
      applied_count: 0,
      citations,
      items,
    };
  }

  private buildLabCriticalRecommendationBundle(params: {
    alert: any;
  }) {
    const { alert } = params;
    const severity = String(alert?.severity || '').toLowerCase();
    const panicSignal = severity === 'panic' || severity === 'critical';
    const status = String(alert?.alert_status || '').toLowerCase();

    const citations = this.normalizeCitationList([
      this.createGuidelineCitation(
        'lab.critical_ack',
        'WHO laboratory quality guidance: critical laboratory alerts require immediate acknowledgment and documented response.',
        'WHO laboratory quality management guidance',
      ),
      this.createGuidelineCitation(
        'lab.order_set',
        'WHO diagnostics stewardship guidance: critical lab results should trigger structured follow-up diagnostic actions.',
        'WHO laboratory quality management guidance',
      ),
      panicSignal
        ? this.createGuidelineCitation(
            'lab.doctor_sync',
            'WHO patient-safety guidance: panic/critical diagnostics should be escalated promptly for clinician synchronization.',
            'WHO patient safety guidance',
          )
        : null,
    ]);

    const items: Array<Record<string, any>> = [
      {
        id: 'acknowledge-critical-lab-alert',
        type: 'safety_review',
        title: 'Acknowledge critical lab alert',
        urgency: status === 'pending' ? 'urgent' : 'high',
        rationale:
          'Critical lab alert acknowledgment must be captured as a first-class executable queue action.',
        citations: citations.filter((citation) => citation.rule_id === 'lab.critical_ack'),
        action_payload: {
          alert_id: alert?.alert_id || alert?.id || null,
          lab_order_id: alert?.lab_order_id || null,
          component_name: alert?.component_name || null,
          severity: alert?.severity || null,
        },
      },
      {
        id: 'prepare-critical-lab-order-set',
        type: 'order_set',
        title: 'Prepare critical-lab follow-up order set',
        urgency: panicSignal ? 'urgent' : 'high',
        rationale:
          'Critical diagnostics should trigger executable follow-up order planning from queue context.',
        citations: citations.filter((citation) => citation.rule_id === 'lab.order_set'),
        action_payload: {
          alert_id: alert?.alert_id || alert?.id || null,
          lab_order_id: alert?.lab_order_id || null,
          result_value: alert?.result_value || null,
          critical_range: alert?.critical_range || null,
        },
      },
    ];

    if (panicSignal) {
      items.push({
        id: 'escalate-lab-doctor-sync',
        type: 'escalation',
        title: 'Escalate critical lab alert to doctor sync',
        urgency: 'urgent',
        rationale:
          'Panic or critical lab alerts require explicit clinician synchronization and escalation evidence.',
        citations: citations.filter((citation) => citation.rule_id === 'lab.doctor_sync'),
        action_payload: {
          alert_id: alert?.alert_id || alert?.id || null,
          severity: alert?.severity || null,
          alerted_to: alert?.alerted_to || null,
        },
      });
    }

    return {
      version: 1,
      generated_at: new Date().toISOString(),
      bundle_label: 'Critical lab safety execution bundle',
      summary: `${items.length} lab action${items.length === 1 ? '' : 's'} prepared for queue execution.`,
      actionable_count: items.length,
      pending_count: items.length,
      applied_count: 0,
      citations,
      items,
    };
  }

  private buildPharmacyRecommendationBundle(params: {
    prescription: any;
  }) {
    const { prescription } = params;
    const quantityNeeded = Number(prescription?.quantity || 0);
    const stockOnHand = Number(prescription?.stock_on_hand || 0);
    const lowStock = Number.isFinite(quantityNeeded) && quantityNeeded > 0 && stockOnHand < quantityNeeded;

    const citations = this.normalizeCitationList([
      this.createGuidelineCitation(
        'pharmacy.dispense_plan',
        'WHO medication safety guidance: dispensing readiness should include structured dose/stock checks before administration.',
        'WHO medication safety guidance',
      ),
      this.createGuidelineCitation(
        'pharmacy.counseling',
        'WHO medicines optimization guidance: counseling checkpoints should be documented for safe medication use.',
        'WHO medication safety guidance',
      ),
      lowStock
        ? this.createGuidelineCitation(
            'pharmacy.doctor_sync',
            'WHO patient safety guidance: medication stock constraints should be synchronized with clinicians for treatment alternatives.',
            'WHO patient safety guidance',
          )
        : null,
    ]);

    const items: Array<Record<string, any>> = [
      {
        id: 'prepare-pharmacy-dispense-plan',
        type: 'order_set',
        title: 'Prepare pharmacy dispense plan',
        urgency: lowStock ? 'urgent' : 'high',
        rationale:
          'Pharmacy queue automation should convert prescription state into executable dispense planning actions.',
        citations: citations.filter((citation) => citation.rule_id === 'pharmacy.dispense_plan'),
        action_payload: {
          prescription_id: prescription?.prescription_id || prescription?.id || null,
          medication_name: prescription?.medication_name || null,
          quantity: quantityNeeded || null,
          stock_on_hand: stockOnHand || 0,
        },
      },
      {
        id: 'complete-pharmacy-counseling-checkpoint',
        type: 'visit_preparation',
        title: 'Complete medication counseling checkpoint',
        urgency: 'routine',
        rationale:
          'Counseling completion should be a one-click operational workflow event, not only narrative documentation.',
        citations: citations.filter((citation) => citation.rule_id === 'pharmacy.counseling'),
        action_payload: {
          prescription_id: prescription?.prescription_id || prescription?.id || null,
          dosage: prescription?.dosage || null,
          frequency: prescription?.frequency || null,
        },
      },
    ];

    if (lowStock) {
      items.push({
        id: 'escalate-pharmacy-doctor-sync',
        type: 'escalation',
        title: 'Escalate stock-constrained prescription to doctor sync',
        urgency: 'urgent',
        rationale:
          'Low stock against active prescriptions requires immediate doctor synchronization for safe alternatives.',
        citations: citations.filter((citation) => citation.rule_id === 'pharmacy.doctor_sync'),
        action_payload: {
          prescription_id: prescription?.prescription_id || prescription?.id || null,
          medication_name: prescription?.medication_name || null,
          quantity: quantityNeeded || null,
          stock_on_hand: stockOnHand || 0,
        },
      });
    }

    return {
      version: 1,
      generated_at: new Date().toISOString(),
      bundle_label: 'Pharmacy dispensing safety bundle',
      summary: `${items.length} pharmacy action${items.length === 1 ? '' : 's'} prepared for queue execution.`,
      actionable_count: items.length,
      pending_count: items.length,
      applied_count: 0,
      citations,
      items,
    };
  }

  async getCrossModuleEscalationFeed(tenantDb: DataSource) {
    const [
      workflowRows,
      destinationUsers,
      referralFacilities,
      maternityTasks,
      hivEnrollments,
      approvedRegimenChanges,
      handoffRows,
      medicationRows,
      oncologyInfusionRows,
      oncologyAdverseEventRows,
      cardiologyEncounterRows,
      ophthalmologyEncounterRows,
      telemedicineConsultationRows,
      edVisitRows,
      sepsisBundleRows,
      bloodTransfusionRows,
      labCriticalAlertRows,
      pharmacyPrescriptionRows,
    ] = await Promise.all([
      this.safeQuery(
        tenantDb,
        `
        SELECT
          w.workflow_key,
          w.module,
          w.item_type,
          w.source_record_id,
          w.patient_id,
          w.enrollment_id,
          w.status,
          w.destination_role,
          w.destination_service,
          w.destination_specialty,
          w.destination_user_id,
          w.destination_facility_id,
          w.destination_facility_name,
          w.acknowledged_at,
          w.completed_at,
          w.created_at,
          w.updated_at,
          w.note,
          w.context,
          au.first_name || ' ' || au.last_name as acknowledged_by_name,
          cu.first_name || ' ' || cu.last_name as completed_by_name,
          du.first_name || ' ' || du.last_name as destination_user_name
        FROM nurse_cross_module_workflow_state w
        LEFT JOIN users au ON au.id = w.acknowledged_by
        LEFT JOIN users cu ON cu.id = w.completed_by
        LEFT JOIN users du ON du.id = w.destination_user_id
        `,
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT
          id,
          role,
          specialization,
          first_name || ' ' || last_name as name
        FROM users
        WHERE is_active = true
          AND role IN ('doctor', 'nurse', 'pharmacist', 'admin')
        ORDER BY
          CASE role
            WHEN 'doctor' THEN 1
            WHEN 'nurse' THEN 2
            WHEN 'pharmacist' THEN 3
            ELSE 4
          END,
          created_at ASC
        `,
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT id, facility_name, facility_type, specialties
        FROM referral_facilities
        WHERE is_active = true
        ORDER BY facility_name ASC
        `,
      ),
      tenantDb.query(
        `
        SELECT
          t.id,
          t.maternity_enrollment_id,
          t.patient_id,
          t.source_type,
          t.source_record_id,
          t.status,
          t.priority,
          t.title,
          t.summary,
          t.required_actions,
          t.task_context,
          t.note,
          t.last_event_at,
          t.created_at,
          t.assigned_to,
          ROUND(EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 3600.0, 1) as age_hours,
          CASE
            WHEN t.status = 'closed' THEN 'closed'
            WHEN EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 3600.0 >
              CASE t.priority
                WHEN 'critical' THEN 2
                WHEN 'high' THEN 8
                WHEN 'medium' THEN 24
                ELSE 48
              END THEN 'breached'
            WHEN EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 3600.0 >
              CASE t.priority
                WHEN 'critical' THEN 1.5
                WHEN 'high' THEN 6
                WHEN 'medium' THEN 18
                ELSE 36
              END THEN 'due_soon'
            ELSE 'within_sla'
          END as sla_status,
          p.first_name || ' ' || p.last_name as patient_name,
          p.patient_number,
          me.enrollment_number,
          au.first_name || ' ' || au.last_name as assigned_to_name
        FROM maternity_care_tasks t
        INNER JOIN patients p ON p.id = t.patient_id
        INNER JOIN maternity_enrollments me ON me.id = t.maternity_enrollment_id
        LEFT JOIN users au ON au.id = t.assigned_to
        WHERE t.status != 'closed'
        ORDER BY
          CASE t.priority
            WHEN 'critical' THEN 4
            WHEN 'high' THEN 3
            WHEN 'medium' THEN 2
            ELSE 1
          END DESC,
          t.last_event_at DESC,
          t.created_at DESC
        LIMIT 50
        `,
      ),
      this.hivService.getEnrollments({ status: 'active' }, tenantDb),
      tenantDb.query(
        `
        SELECT
          r.id,
          r.enrollment_id,
          r.request_date,
          r.approval_date,
          r.requested_regimen_code,
          r.current_regimen_name,
          r.requested_regimen_name,
          r.change_reason_details,
          r.clinical_justification,
          r.regimen_safety_summary,
          r.approved_by_name,
          e.patient_id,
          e.enrollment_number,
          p.date_of_birth,
          p.first_name || ' ' || p.last_name as patient_name,
          p.patient_number
        FROM hiv_arv_change_requests r
        INNER JOIN hiv_care_enrollments e ON e.id = r.enrollment_id
        INNER JOIN patients p ON p.id = e.patient_id
        WHERE r.status = 'approved'
          AND COALESCE(r.visit_recorded, false) = false
        ORDER BY r.approval_date DESC NULLS LAST, r.request_date DESC, r.created_at DESC
        LIMIT 50
        `,
      ).catch(() => []),
      this.safeQuery(
        tenantDb,
        `
        SELECT
          h.patient_id,
          h.status,
          h.finalized_at,
          h.reviewed_at,
          h.shared_at,
          h.updated_at,
          p.first_name || ' ' || p.last_name as patient_name,
          p.patient_number
        FROM nurse_handoff_workflow_state h
        INNER JOIN patients p ON p.id = h.patient_id
        WHERE h.status != 'shared'
        ORDER BY COALESCE(h.updated_at, h.finalized_at, h.reviewed_at, h.created_at) DESC
        LIMIT 25
        `,
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT
          mar.id,
          mar.patient_id,
          mar.medication_name,
          mar.dose,
          mar.unit,
          mar.route,
          mar.scheduled_time,
          mar.actual_administration_time,
          mar.administration_status,
          mar.refusal_reason,
          mar.omission_reason,
          mar.notes,
          p.first_name || ' ' || p.last_name as patient_name,
          p.patient_number
        FROM medication_administration_records mar
        INNER JOIN patients p ON p.id = mar.patient_id
        WHERE mar.administration_status IN ('pending', 'held', 'refused')
          AND mar.scheduled_time <= (NOW() - INTERVAL '30 minutes')
        ORDER BY mar.scheduled_time ASC
        LIMIT 50
        `,
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT
          ois.id as infusion_session_id,
          ois.regimen_id,
          ois.session_date,
          ois.status as session_status,
          ois.payment_status,
          ois.cycle_number,
          ois.notes as session_notes,
          orr.id as regimen_record_id,
          orr.regimen_name,
          orr.status as regimen_status,
          oc.id as oncology_case_id,
          oc.status as case_status,
          oc.primary_diagnosis,
          oc.overall_stage,
          p.id as patient_id,
          p.first_name || ' ' || p.last_name as patient_name,
          p.patient_number,
          u.first_name || ' ' || u.last_name as oncologist_name,
          COALESCE(event_stats.active_grade3_plus, 0) as active_grade3_plus
        FROM oncology_infusion_sessions ois
        INNER JOIN oncology_regimens orr ON orr.id = ois.regimen_id
        INNER JOIN oncology_cases oc ON oc.id = orr.oncology_case_id
        INNER JOIN patients p ON p.id = oc.patient_id
        LEFT JOIN users u ON u.id = oc.oncologist_id
        LEFT JOIN (
          SELECT
            oncology_case_id,
            SUM(
              CASE
                WHEN resolved_date IS NULL
                  AND COALESCE(NULLIF(regexp_replace(COALESCE(grade, ''), '[^0-9]', '', 'g'), ''), '0')::int >= 3
                THEN 1
                ELSE 0
              END
            ) as active_grade3_plus
          FROM oncology_adverse_events
          GROUP BY oncology_case_id
        ) event_stats ON event_stats.oncology_case_id = oc.id
        WHERE ois.status IN ('awaiting_payment', 'scheduled', 'in_progress')
          AND ois.session_date <= (NOW() + INTERVAL '48 hours')
        ORDER BY ois.session_date ASC
        LIMIT 50
        `,
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT
          oae.id as adverse_event_id,
          oae.oncology_case_id,
          oae.regimen_id,
          oae.event_date,
          oae.event_type,
          oae.grade,
          oae.notes,
          oae.action_taken,
          oae.outcome,
          oc.status as case_status,
          oc.primary_diagnosis,
          oc.overall_stage,
          orr.regimen_name,
          p.id as patient_id,
          p.first_name || ' ' || p.last_name as patient_name,
          p.patient_number
        FROM oncology_adverse_events oae
        INNER JOIN oncology_cases oc ON oc.id = oae.oncology_case_id
        INNER JOIN patients p ON p.id = oc.patient_id
        LEFT JOIN oncology_regimens orr ON orr.id = oae.regimen_id
        WHERE oae.resolved_date IS NULL
          AND COALESCE(NULLIF(regexp_replace(COALESCE(oae.grade, ''), '[^0-9]', '', 'g'), ''), '0')::int >= 3
        ORDER BY oae.event_date DESC
        LIMIT 50
        `,
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT
          ce.id as cardiology_encounter_id,
          ce.patient_id,
          ce.encounter_date,
          ce.encounter_type,
          ce.visit_reason,
          ce.risk_score,
          ce.care_status,
          ce.payment_status,
          ce.follow_up_plan,
          ce.care_plan,
          ce.diagnostic_tests,
          p.first_name || ' ' || p.last_name as patient_name,
          p.patient_number,
          doc.first_name || ' ' || doc.last_name as cardiologist_name
        FROM cardiology_encounters ce
        INNER JOIN patients p ON p.id = ce.patient_id
        LEFT JOIN users doc ON doc.id = ce.cardiologist_id
        WHERE COALESCE(ce.care_status, 'scheduled') NOT IN ('completed', 'cancelled')
          AND ce.encounter_date >= (NOW() - INTERVAL '60 days')
        ORDER BY ce.encounter_date DESC, ce.updated_at DESC
        LIMIT 50
        `,
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT
          oe.id as ophthalmology_encounter_id,
          oe.patient_id,
          oe.encounter_date,
          oe.encounter_type,
          oe.chief_complaint,
          oe.assessment,
          oe.plan,
          oe.payment_status,
          oe.finance_transaction_id,
          p.first_name || ' ' || p.last_name as patient_name,
          p.patient_number,
          doc.first_name || ' ' || doc.last_name as ophthalmologist_name
        FROM ophthalmology_encounters oe
        INNER JOIN patients p ON p.id = oe.patient_id
        LEFT JOIN users doc ON doc.id = oe.ophthalmologist_id
        WHERE oe.encounter_date >= (NOW() - INTERVAL '60 days')
          AND COALESCE(oe.payment_status, 'payment_confirmed') <> 'cancelled'
        ORDER BY oe.encounter_date DESC, oe.updated_at DESC
        LIMIT 50
        `,
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT
          tc.id as consultation_id,
          tc.patient_id,
          tc.doctor_id,
          tc.consultation_type,
          tc.status,
          tc.scheduled_start_time,
          tc.actual_start_time,
          tc.patient_consent,
          tc.consent_date,
          tc.patient_joined,
          tc.doctor_joined,
          tc.technical_issues,
          tc.notes,
          p.first_name || ' ' || p.last_name as patient_name,
          p.patient_number,
          doc.first_name || ' ' || doc.last_name as doctor_name
        FROM telemedicine_consultations tc
        INNER JOIN patients p ON p.id = tc.patient_id
        LEFT JOIN users doc ON doc.id = tc.doctor_id
        WHERE tc.status IN ('scheduled', 'waiting', 'in_progress', 'technical_issue')
          AND tc.scheduled_start_time >= (NOW() - INTERVAL '24 hours')
          AND tc.scheduled_start_time <= (NOW() + INTERVAL '72 hours')
        ORDER BY tc.scheduled_start_time ASC
        LIMIT 50
        `,
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT
          ev.id as ed_visit_id,
          ev.patient_id,
          ev.ed_visit_number,
          ev.arrival_date,
          ev.chief_complaint,
          ev.triage_level,
          ev.triage_acuity,
          ev.ed_status,
          ev.disposition,
          ev.follow_up_instructions,
          ev.notes,
          ev.quality_flags,
          ev.code_sepsis,
          ev.code_stroke,
          ev.code_stemi,
          p.first_name || ' ' || p.last_name as patient_name,
          p.patient_number,
          doc.first_name || ' ' || doc.last_name as attending_provider_name
        FROM ed_visits ev
        INNER JOIN patients p ON p.id = ev.patient_id
        LEFT JOIN users doc ON doc.id = ev.attending_provider
        WHERE COALESCE(ev.ed_status, 'waiting') NOT IN (
            'discharged',
            'admitted',
            'transferred',
            'deceased',
            'left_without_being_seen'
          )
          AND ev.arrival_date >= (NOW() - INTERVAL '14 days')
        ORDER BY ev.arrival_date DESC, ev.updated_at DESC
        LIMIT 50
        `,
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT
          sb.id as sepsis_bundle_id,
          sb.patient_id,
          sb.admission_id,
          sb.sepsis_screening_id,
          sb.bundle_start_time,
          sb.three_hour_bundle_complete,
          sb.six_hour_bundle_complete,
          sb.overall_compliance,
          sb.repeat_lactate_measured,
          sb.repeat_lactate_time,
          sb.lactate_value,
          sb.repeat_lactate_value,
          sb.notes,
          sb.updated_at,
          ss.qsofa_score,
          ss.sirs_score,
          ss.sepsis_suspected,
          ss.severe_sepsis,
          ss.septic_shock,
          ss.sepsis_alert_triggered,
          p.first_name || ' ' || p.last_name as patient_name,
          p.patient_number
        FROM sepsis_bundles sb
        INNER JOIN patients p ON p.id = sb.patient_id
        LEFT JOIN sepsis_screenings ss ON ss.id = sb.sepsis_screening_id
        WHERE sb.bundle_start_time >= (NOW() - INTERVAL '14 days')
          AND (
            COALESCE(sb.overall_compliance, false) = false
            OR COALESCE(sb.three_hour_bundle_complete, false) = false
            OR (
              (
                COALESCE(ss.severe_sepsis, false) = true
                OR COALESCE(ss.septic_shock, false) = true
              )
              AND COALESCE(sb.six_hour_bundle_complete, false) = false
            )
          )
        ORDER BY sb.bundle_start_time DESC, sb.updated_at DESC
        LIMIT 50
        `,
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT
          bt.id as transfusion_id,
          bt.patient_id,
          bt.admission_id,
          bt.inventory_id,
          bt.cross_match_id,
          bt.indication,
          bt.order_date,
          bt.start_time,
          bt.end_time,
          bt.transfusion_status,
          bt.transfusion_reaction,
          bt.reaction_type,
          bt.reaction_severity,
          bt.reaction_time,
          bt.reaction_management,
          bt.consent_obtained,
          bt.notes,
          bt.completion_notes,
          bt.updated_at,
          bi.unit_number,
          bi.component_type,
          bi.blood_group,
          bi.rh_factor,
          bi.expiry_date,
          p.first_name || ' ' || p.last_name as patient_name,
          p.patient_number,
          p.blood_type as patient_blood_type,
          ord.first_name || ' ' || ord.last_name as ordered_by_name,
          adm.first_name || ' ' || adm.last_name as administered_by_name
        FROM blood_transfusions bt
        INNER JOIN patients p ON p.id = bt.patient_id
        LEFT JOIN blood_inventory bi ON bi.id = bt.inventory_id
        LEFT JOIN users ord ON ord.id = bt.ordered_by
        LEFT JOIN users adm ON adm.id = bt.administered_by
        WHERE bt.transfusion_status IN ('ordered', 'in_progress')
          OR COALESCE(bt.transfusion_reaction, false) = true
        ORDER BY COALESCE(bt.start_time, bt.order_date, bt.created_at) DESC
        LIMIT 50
        `,
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT
          lca.id as alert_id,
          lca.patient_id,
          lca.lab_order_id,
          lca.component_name,
          lca.result_value,
          lca.critical_range,
          lca.severity,
          lca.alert_status,
          lca.alerted_to,
          lca.escalated_to,
          lca.alerted_at,
          lca.acknowledged_at,
          lca.created_at,
          p.first_name || ' ' || p.last_name as patient_name,
          p.patient_number,
          alert_user.first_name || ' ' || alert_user.last_name as alerted_to_name,
          esc_user.first_name || ' ' || esc_user.last_name as escalated_to_name,
          EXTRACT(EPOCH FROM (NOW() - COALESCE(lca.alerted_at, lca.created_at))) / 3600.0 as age_hours
        FROM lab_critical_alerts lca
        INNER JOIN patients p ON p.id = lca.patient_id
        LEFT JOIN users alert_user ON alert_user.id = lca.alerted_to
        LEFT JOIN users esc_user ON esc_user.id = lca.escalated_to
        WHERE lca.alert_status IN ('pending', 'acknowledged', 'escalated')
          AND lca.created_at >= (NOW() - INTERVAL '14 days')
        ORDER BY
          CASE lca.severity
            WHEN 'panic' THEN 3
            WHEN 'critical' THEN 2
            ELSE 1
          END DESC,
          COALESCE(lca.alerted_at, lca.created_at) ASC
        LIMIT 50
        `,
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT
          p.id as prescription_id,
          p.patient_id,
          p.doctor_id,
          p.medication_name,
          p.dosage,
          p.frequency,
          p.quantity,
          p.status,
          p.instructions,
          p.created_at,
          pt.first_name || ' ' || pt.last_name as patient_name,
          pt.patient_number,
          doc.first_name || ' ' || doc.last_name as prescriber_name,
          COALESCE(stock.quantity_on_hand, 0)::int as stock_on_hand,
          COALESCE(stock.reorder_level, 0)::int as reorder_level,
          COALESCE(stock.inventory_match_count, 0)::int as inventory_match_count
        FROM prescriptions p
        INNER JOIN patients pt ON pt.id = p.patient_id
        LEFT JOIN users doc ON doc.id = p.doctor_id
        LEFT JOIN LATERAL (
          SELECT
            SUM(pi.quantity_on_hand) as quantity_on_hand,
            MIN(pi.reorder_level) as reorder_level,
            COUNT(*) as inventory_match_count
          FROM pharmacy_inventory pi
          WHERE pi.status = 'active'
            AND (
              (p.medication_name IS NOT NULL AND (
                pi.name ILIKE '%' || p.medication_name || '%'
                OR pi.generic_name ILIKE '%' || p.medication_name || '%'
              ))
              OR (p.medication_name_snomed_code IS NOT NULL AND pi.snomed_code = p.medication_name_snomed_code)
            )
        ) stock ON TRUE
        WHERE p.status = 'active'
          AND NOT EXISTS (
            SELECT 1
            FROM pharmacy_dispensings pd
            WHERE pd.prescription_id = p.id
              AND pd.status IN ('pending', 'dispensed', 'partial')
          )
        ORDER BY p.created_at DESC
        LIMIT 50
        `,
      ),
    ]);

    const workflowRowsByKey = new Map<string, any>(
      (workflowRows || []).map((row: any) => [String(row.workflow_key), row] as [string, any]),
    );

    const maternityItems = (maternityTasks || []).map((task: any) => ({
      id: `maternity:${task.id}`,
      module: 'maternity',
      item_type: 'maternity_care_task',
      severity: task.priority || 'medium',
      workflow_status: task.status,
      module_status: task.status,
      doctor_sync_status:
        task.status === 'open'
          ? 'awaiting_doctor_review'
          : task.status === 'acknowledged'
            ? 'doctor_reviewing'
            : task.status === 'actioned'
              ? 'doctor_actioned'
              : 'closed',
      title: task.title || 'Maternity escalation task',
      summary: task.summary || 'Maternity escalation requires follow-up.',
      recommended_action:
        Array.isArray(task.required_actions) && task.required_actions.length > 0
          ? String(task.required_actions[0])
          : 'Review the maternity workflow and confirm doctor follow-through.',
      patient_id: task.patient_id,
      patient_name: task.patient_name,
      patient_number: task.patient_number,
      enrollment_id: task.maternity_enrollment_id,
      enrollment_number: task.enrollment_number,
      source_record_id: task.source_record_id,
      source_type: task.source_type,
      created_at: task.created_at,
      updated_at: task.last_event_at || task.created_at,
      age_hours: task.age_hours != null ? Number(task.age_hours) : this.getHoursSince(task.created_at),
      sla_status: task.sla_status || null,
      next_route: {
        section: 'maternity',
        tab: 'maternity',
        taskId: task.id,
        enrollmentId: task.maternity_enrollment_id,
        patientId: task.patient_id,
      },
      ...this.buildDestination(destinationUsers, referralFacilities, {
        role: 'doctor',
        service: 'maternity',
        specialty: this.extractTaskSpecialty(task.task_context, 'Obstetrics'),
        preferredUserId: task.assigned_to || null,
        preferredUserName: task.assigned_to_name || null,
      }),
      metadata: {
        task_context: task.task_context || null,
        note: task.note || null,
      },
    }));

    const hivEnrollmentRows = Array.isArray((hivEnrollments as any)?.enrollments)
      ? (hivEnrollments as any).enrollments
      : [];

    const hivPathwayCandidates = hivEnrollmentRows.filter((enrollment: any) => {
      const latestVl = Number(enrollment?.last_viral_load || 0);
      return Number.isFinite(latestVl) && latestVl >= 1000;
    });

    const hivRecommendationEnrollmentIds = Array.from(
      new Set<string>(
        [
          ...hivPathwayCandidates.map((enrollment: any) => String(enrollment.id)),
          ...(approvedRegimenChanges || []).map((request: any) => String(request.enrollment_id || '')),
        ].filter((value) => value.length > 0),
      ),
    );

    const latestHivVisits = hivRecommendationEnrollmentIds.length > 0
      ? await this.safeQuery(
          tenantDb,
          `
          SELECT DISTINCT ON (v.enrollment_id)
            v.enrollment_id,
            v.visit_date,
            v.pregnancy_lactating_status,
            v.tb_treatment_started,
            v.creatinine_result,
            v.alt_result,
            v.weight,
            v.arv_regimen_code
          FROM hiv_clinical_visits v
          WHERE v.enrollment_id = ANY($1)
          ORDER BY v.enrollment_id, v.visit_date DESC, v.created_at DESC
          `,
          [hivRecommendationEnrollmentIds],
        )
      : [];

    const latestHivVisitsByEnrollment = new Map<string, any>(
      (latestHivVisits || []).map((visit: any) => [String(visit.enrollment_id), visit] as [string, any]),
    );

    const hivPathways = await Promise.all(
      hivPathwayCandidates.map(async (enrollment: any) => {
        try {
          const pathway = await this.hivService.getVlPathway(enrollment.id, tenantDb);
          return { enrollment, pathway };
        } catch {
          return null;
        }
      }),
    );

    const hivPathwayItems = hivPathways
      .filter((entry): entry is { enrollment: any; pathway: any } => Boolean(entry?.pathway))
      .flatMap(({ enrollment, pathway }) => {
        const status = String(pathway.status || '');
        const actionable =
          status === 'high_vl_needs_eac' ||
          status === 'failure_after_eac' ||
          status === 'high_vl_on_eac' ||
          status === 'high_vl';

        if (!actionable) {
          return [];
        }

        const severity =
          status === 'failure_after_eac'
            ? 'critical'
            : status === 'high_vl_needs_eac' || status === 'high_vl'
              ? 'high'
              : 'medium';

        const title =
          status === 'failure_after_eac'
            ? 'Possible HIV treatment failure after EAC'
            : status === 'high_vl_needs_eac'
              ? 'High viral load requires EAC enrollment'
              : status === 'high_vl_on_eac'
                ? 'High viral load patient is active on EAC'
                : 'High viral load follow-up required';

        const summary =
          status === 'failure_after_eac'
            ? `Latest viral load remains elevated after EAC for ${enrollment.first_name} ${enrollment.last_name}.`
            : status === 'high_vl_needs_eac'
              ? `${enrollment.first_name} ${enrollment.last_name} has consecutive high viral loads and needs EAC follow-up.`
              : status === 'high_vl_on_eac'
                ? `${enrollment.first_name} ${enrollment.last_name} is already in EAC and needs continued nurse follow-up.`
                : `${enrollment.first_name} ${enrollment.last_name} has a high viral load that requires follow-up.`;

        const itemId = `hiv-pathway:${enrollment.id}:${status}:${pathway.lastVlDate || enrollment.last_viral_load_date || 'na'}`;
        const latestVisit = latestHivVisitsByEnrollment.get(String(enrollment.id)) || null;
        const recommendationBundle = this.buildHivPathwayRecommendationBundle({
          enrollment,
          pathway,
          latestVisit,
        });

        return [
          this.mergeCrossModuleWorkflowState(
            {
              id: itemId,
              module: 'hiv',
              item_type: 'hiv_vl_followup',
              source_record_id: enrollment.id,
              severity,
              workflow_status: 'pending',
              module_status: status,
              doctor_sync_status:
                status === 'failure_after_eac' ? 'doctor_review_recommended' : 'nurse_followup_required',
              title,
              summary,
              recommended_action:
                Array.isArray(pathway.actions) && pathway.actions.length > 0
                  ? pathway.actions.join(', ').replace(/_/g, ' ')
                  : 'Open the HIV workflow and continue WHO-aligned follow-up.',
              patient_id: enrollment.patient_id,
              patient_name: `${enrollment.first_name} ${enrollment.last_name}`,
              patient_number: enrollment.patient_number,
              enrollment_id: enrollment.id,
              enrollment_number: enrollment.enrollment_number,
              created_at: pathway.lastVlDate || enrollment.last_viral_load_date || enrollment.last_visit_date || null,
              updated_at: pathway.lastVlDate || enrollment.last_viral_load_date || enrollment.last_visit_date || null,
              age_hours: this.getHoursSince(
                pathway.lastVlDate || enrollment.last_viral_load_date || enrollment.last_visit_date || null,
              ),
              sla_status: pathway.overdue ? 'due_soon' : 'within_sla',
              next_route: {
                section: 'hiv',
                tab: 'hiv-patients',
                enrollmentId: enrollment.id,
                patientId: enrollment.patient_id,
              },
              ...this.buildDestination(destinationUsers, referralFacilities, {
                role: status === 'failure_after_eac' ? 'doctor' : 'nurse',
                service: 'hiv_clinic',
                specialty: 'HIV',
              }),
              metadata: {
                last_vl_value: pathway.lastVlValue ?? enrollment.last_viral_load ?? null,
                last_vl_date: pathway.lastVlDate ?? enrollment.last_viral_load_date ?? null,
                next_vl_date: pathway.nextVlDate ?? null,
                actions: pathway.actions || [],
                recommendation_bundle: recommendationBundle,
                guideline_citations: recommendationBundle.citations,
                latest_visit_context: latestVisit,
              },
            },
            workflowRowsByKey,
          ),
        ];
      });

    const hivRegimenItems = (approvedRegimenChanges || []).map((request: any) => {
      const latestVisit = latestHivVisitsByEnrollment.get(String(request.enrollment_id)) || null;
      const recommendationBundle = this.buildHivRegimenRecommendationBundle({
        request,
        latestVisit,
      });

      return this.mergeCrossModuleWorkflowState(
        {
          id: `hiv-regimen:${request.id}`,
          module: 'hiv',
          item_type: 'hiv_regimen_change',
          source_record_id: request.id,
          severity: 'high',
          workflow_status: 'pending',
          module_status: 'doctor_approved_pending_nurse_record',
          doctor_sync_status: 'doctor_approved',
          title: 'Doctor-approved HIV regimen change awaiting nurse follow-through',
          summary: `${request.patient_name} has an approved regimen change from ${request.current_regimen_name || 'current regimen'} to ${request.requested_regimen_name || 'new regimen'}.`,
          recommended_action:
            'Acknowledge the approved regimen change, counsel the patient, and record it during the next HIV clinical visit.',
          patient_id: request.patient_id,
          patient_name: request.patient_name,
          patient_number: request.patient_number,
          enrollment_id: request.enrollment_id,
          enrollment_number: request.enrollment_number,
          created_at: request.approval_date || request.request_date || null,
          updated_at: request.approval_date || request.request_date || null,
          age_hours: this.getHoursSince(request.approval_date || request.request_date || null),
          sla_status: null,
          next_route: {
            section: 'hiv',
            tab: 'hiv-patients',
            enrollmentId: request.enrollment_id,
            patientId: request.patient_id,
          },
          ...this.buildDestination(destinationUsers, referralFacilities, {
            role: 'nurse',
            service: 'hiv_clinic',
            specialty: 'HIV',
          }),
          metadata: {
            approved_by_name: request.approved_by_name || null,
            current_regimen_name: request.current_regimen_name || null,
            requested_regimen_name: request.requested_regimen_name || null,
            change_reason_details: request.change_reason_details || null,
            clinical_justification: request.clinical_justification || null,
            recommendation_bundle: recommendationBundle,
            guideline_citations: recommendationBundle.citations,
            latest_visit_context: latestVisit,
          },
        },
        workflowRowsByKey,
      );
    });

    const oncologyInfusionItems = (oncologyInfusionRows || []).map((row: any) => {
      const activeGrade3Plus = Number(row?.active_grade3_plus || 0);
      const ageHours = this.getHoursSince(row?.session_date);
      const paymentPending = String(row?.payment_status || '').toLowerCase() === 'awaiting_payment';
      const recommendationBundle = this.buildOncologyInfusionRecommendationBundle({
        caseRow: row,
        regimen: {
          id: row?.regimen_id,
          regimen_name: row?.regimen_name,
          status: row?.regimen_status,
        },
        session: {
          id: row?.infusion_session_id,
          session_date: row?.session_date,
          cycle_number: row?.cycle_number,
          status: row?.session_status,
          payment_status: row?.payment_status,
        },
      });

      return this.mergeCrossModuleWorkflowState(
        {
          id: `oncology-infusion:${row.infusion_session_id}`,
          module: 'oncology',
          item_type: 'oncology_infusion_followup',
          source_record_id: row.infusion_session_id,
          severity:
            activeGrade3Plus > 0
              ? 'critical'
              : paymentPending
                ? 'high'
                : 'medium',
          workflow_status: 'pending',
          module_status: row.session_status || 'scheduled',
          doctor_sync_status:
            activeGrade3Plus > 0
              ? 'oncologist_review_recommended'
              : 'nurse_readiness_required',
          title:
            paymentPending
              ? 'Oncology infusion session awaiting payment clearance'
              : 'Oncology infusion readiness follow-up',
          summary:
            `${row.patient_name} has ${row.regimen_name || 'an oncology regimen'} ` +
            `scheduled for ${new Date(row.session_date).toISOString().split('T')[0]}.`,
          recommended_action:
            paymentPending
              ? 'Resolve payment clearance, confirm readiness checks, and synchronize with oncology team before infusion.'
              : 'Confirm infusion checklist, pre-chemo lab gate, and complete oncology doctor synchronization where needed.',
          patient_id: row.patient_id,
          patient_name: row.patient_name,
          patient_number: row.patient_number,
          created_at: row.session_date,
          updated_at: row.session_date,
          age_hours: ageHours,
          sla_status:
            ageHours !== null && ageHours > 6
              ? 'breached'
              : ageHours !== null && ageHours > 0
                ? 'due_soon'
                : 'within_sla',
          next_route: {
            section: 'oncology',
            tab: 'oncology',
            patientId: row.patient_id,
          },
          ...this.buildDestination(destinationUsers, referralFacilities, {
            role: activeGrade3Plus > 0 ? 'doctor' : 'nurse',
            service: 'oncology_infusion',
            specialty: 'Oncology',
          }),
          metadata: {
            oncology_case_id: row.oncology_case_id,
            regimen_id: row.regimen_id,
            regimen_name: row.regimen_name,
            session_id: row.infusion_session_id,
            cycle_number: row.cycle_number,
            session_status: row.session_status,
            payment_status: row.payment_status,
            active_grade3_plus: activeGrade3Plus,
            recommendation_bundle: recommendationBundle,
            guideline_citations: recommendationBundle.citations,
          },
        },
        workflowRowsByKey,
      );
    });

    const oncologyToxicityItems = (oncologyAdverseEventRows || []).map((row: any) => {
      const gradeNumber = Number(
        String(row?.grade || '')
          .replace(/[^0-9]/g, '')
          .trim() || '0',
      );
      const recommendationBundle = this.buildOncologyToxicityRecommendationBundle({
        caseRow: row,
        adverseEvent: {
          id: row?.adverse_event_id,
          regimen_id: row?.regimen_id,
          event_type: row?.event_type,
          grade: row?.grade,
        },
      });

      return this.mergeCrossModuleWorkflowState(
        {
          id: `oncology-toxicity:${row.adverse_event_id}`,
          module: 'oncology',
          item_type: 'oncology_toxicity_followup',
          source_record_id: row.adverse_event_id,
          severity: gradeNumber >= 4 ? 'critical' : 'high',
          workflow_status: 'pending',
          module_status: row.grade || 'grade_3_plus',
          doctor_sync_status: 'oncologist_review_recommended',
          title: `Oncology toxicity follow-up required (${row.grade || 'Grade 3+'})`,
          summary:
            `${row.patient_name} has unresolved ${row.event_type || 'treatment toxicity'} ` +
            `${row.regimen_name ? `during ${row.regimen_name}` : ''}.`,
          recommended_action:
            'Document nurse toxicity follow-up and synchronize escalation with the treating oncologist.',
          patient_id: row.patient_id,
          patient_name: row.patient_name,
          patient_number: row.patient_number,
          created_at: row.event_date,
          updated_at: row.event_date,
          age_hours: this.getHoursSince(row.event_date),
          sla_status: gradeNumber >= 4 ? 'breached' : 'due_soon',
          next_route: {
            section: 'oncology',
            tab: 'oncology',
            patientId: row.patient_id,
          },
          ...this.buildDestination(destinationUsers, referralFacilities, {
            role: 'doctor',
            service: 'oncology_toxicity',
            specialty: 'Oncology',
          }),
          metadata: {
            oncology_case_id: row.oncology_case_id,
            adverse_event_id: row.adverse_event_id,
            regimen_id: row.regimen_id,
            regimen_name: row.regimen_name || null,
            event_type: row.event_type || null,
            grade: row.grade || null,
            recommendation_bundle: recommendationBundle,
            guideline_citations: recommendationBundle.citations,
          },
        },
        workflowRowsByKey,
      );
    });

    const cardiologyProtocolItems = (cardiologyEncounterRows || []).map((row: any) => {
      const riskBand = this.normalizeCardiologyRiskBand(row?.risk_score);
      const paymentPending = String(row?.payment_status || '').toLowerCase() === 'awaiting_payment';
      const ageHours = this.getHoursSince(row.encounter_date);
      const recommendationBundle = this.buildCardiologyProtocolRecommendationBundle({
        encounter: row,
      });

      return this.mergeCrossModuleWorkflowState(
        {
          id: `cardiology-encounter:${row.cardiology_encounter_id}`,
          module: 'cardiology',
          item_type: 'cardiology_protocol_followup',
          source_record_id: row.cardiology_encounter_id,
          severity:
            riskBand === 'critical'
              ? 'critical'
              : riskBand === 'high' || paymentPending
                ? 'high'
                : 'medium',
          workflow_status: 'pending',
          module_status: row.care_status || 'scheduled',
          doctor_sync_status:
            riskBand === 'critical' || riskBand === 'high'
              ? 'doctor_review_recommended'
              : 'nurse_followup_required',
          title:
            riskBand === 'critical' || riskBand === 'high'
              ? 'High-risk cardiology protocol follow-up'
              : 'Cardiology protocol follow-up pending',
          summary:
            `${row.patient_name} has a cardiology encounter on ` +
            `${new Date(row.encounter_date).toISOString().split('T')[0]} with ${row.risk_score || 'unclassified'} risk.`,
          recommended_action:
            riskBand === 'critical' || riskBand === 'high'
              ? 'Execute order-set and visit-prep actions, then escalate doctor sync for high-risk findings.'
              : 'Execute cardiology order-set and visit-prep checkpoints from the queue.',
          patient_id: row.patient_id,
          patient_name: row.patient_name,
          patient_number: row.patient_number,
          created_at: row.encounter_date,
          updated_at: row.encounter_date,
          age_hours: ageHours,
          sla_status:
            ageHours !== null && ageHours >= 48
              ? 'due_soon'
              : 'within_sla',
          next_route: {
            section: 'cardiology',
            tab: 'cardiology',
            patientId: row.patient_id,
          },
          ...this.buildDestination(destinationUsers, referralFacilities, {
            role: riskBand === 'critical' || riskBand === 'high' ? 'doctor' : 'nurse',
            service: 'cardiology_protocol',
            specialty: 'Cardiology',
          }),
          metadata: {
            encounter_id: row.cardiology_encounter_id,
            encounter_type: row.encounter_type || null,
            visit_reason: row.visit_reason || null,
            risk_score: row.risk_score || null,
            care_status: row.care_status || null,
            payment_status: row.payment_status || null,
            recommendation_bundle: recommendationBundle,
            guideline_citations: recommendationBundle.citations,
          },
        },
        workflowRowsByKey,
      );
    });

    const ophthalmologyProtocolItems = (ophthalmologyEncounterRows || []).map((row: any) => {
      const ageHours = this.getHoursSince(row.encounter_date);
      const clinicalText = `${row?.chief_complaint || ''} ${row?.assessment || ''}`.toLowerCase();
      const acuteRiskSignal =
        clinicalText.includes('vision loss') ||
        clinicalText.includes('sudden') ||
        clinicalText.includes('retinal') ||
        clinicalText.includes('acute glaucoma') ||
        clinicalText.includes('trauma');
      const paymentPending = String(row?.payment_status || '').toLowerCase() === 'awaiting_payment';
      const recommendationBundle = this.buildOphthalmologyProtocolRecommendationBundle({
        encounter: row,
      });

      return this.mergeCrossModuleWorkflowState(
        {
          id: `ophthalmology-encounter:${row.ophthalmology_encounter_id}`,
          module: 'ophthalmology',
          item_type: 'ophthalmology_protocol_followup',
          source_record_id: row.ophthalmology_encounter_id,
          severity: acuteRiskSignal ? 'critical' : paymentPending ? 'high' : 'medium',
          workflow_status: 'pending',
          module_status: row.encounter_type || 'follow_up',
          doctor_sync_status: acuteRiskSignal ? 'doctor_review_recommended' : 'nurse_followup_required',
          title: acuteRiskSignal
            ? 'Sight-risk ophthalmology protocol escalation'
            : 'Ophthalmology protocol follow-up pending',
          summary:
            `${row.patient_name} has an ophthalmology encounter on ` +
            `${new Date(row.encounter_date).toISOString().split('T')[0]}.`,
          recommended_action: acuteRiskSignal
            ? 'Execute ophthalmology order-set and escalate immediate doctor synchronization for sight-risk findings.'
            : 'Execute ophthalmology order-set and visit-prep checkpoints from the queue.',
          patient_id: row.patient_id,
          patient_name: row.patient_name,
          patient_number: row.patient_number,
          created_at: row.encounter_date,
          updated_at: row.encounter_date,
          age_hours: ageHours,
          sla_status:
            acuteRiskSignal
              ? 'due_soon'
              : ageHours !== null && ageHours >= 72
                ? 'due_soon'
                : 'within_sla',
          next_route: {
            section: 'ophthalmology',
            tab: 'ophthalmology',
            patientId: row.patient_id,
          },
          ...this.buildDestination(destinationUsers, referralFacilities, {
            role: acuteRiskSignal ? 'doctor' : 'nurse',
            service: 'ophthalmology_protocol',
            specialty: 'Ophthalmology',
          }),
          metadata: {
            encounter_id: row.ophthalmology_encounter_id,
            encounter_type: row.encounter_type || null,
            chief_complaint: row.chief_complaint || null,
            assessment: row.assessment || null,
            payment_status: row.payment_status || null,
            ophthalmologist_name: row.ophthalmologist_name || null,
            recommendation_bundle: recommendationBundle,
            guideline_citations: recommendationBundle.citations,
          },
        },
        workflowRowsByKey,
      );
    });

    const telemedicineProtocolItems = (telemedicineConsultationRows || []).map((row: any) => {
      const status = String(row?.status || '').toLowerCase();
      const consented = Boolean(row?.patient_consent);
      const technicalIssue = status === 'technical_issue' || this.normalizeText(row?.technical_issues) !== null;
      const requiresDoctorSync = technicalIssue || status === 'in_progress';
      const ageHours = this.getHoursSince(row?.scheduled_start_time || row?.actual_start_time || row?.created_at);
      const recommendationBundle = this.buildTelemedicineRecommendationBundle({
        consultation: row,
      });

      return this.mergeCrossModuleWorkflowState(
        {
          id: `telemedicine-consultation:${row.consultation_id}`,
          module: 'telemedicine',
          item_type: 'telemedicine_protocol_followup',
          source_record_id: row.consultation_id,
          severity: technicalIssue ? 'critical' : !consented ? 'high' : 'medium',
          workflow_status: 'pending',
          module_status: row.status || 'scheduled',
          doctor_sync_status: requiresDoctorSync ? 'doctor_review_recommended' : 'nurse_followup_required',
          title: technicalIssue
            ? 'Telemedicine technical-risk escalation'
            : !consented
              ? 'Telemedicine consent checkpoint pending'
              : 'Telemedicine protocol follow-up pending',
          summary:
            `${row.patient_name} has a ${row.consultation_type || 'telemedicine'} consultation ` +
            `${row.scheduled_start_time ? `scheduled for ${new Date(row.scheduled_start_time).toISOString().split('T')[0]}` : 'awaiting workflow follow-up'}.`,
          recommended_action: requiresDoctorSync
            ? 'Execute consent/visit-prep actions and escalate doctor synchronization for active or technical-risk consultation state.'
            : 'Execute telemedicine consent and visit-prep actions from the queue.',
          patient_id: row.patient_id,
          patient_name: row.patient_name,
          patient_number: row.patient_number,
          created_at: row.scheduled_start_time || row.actual_start_time || row.created_at,
          updated_at: row.actual_start_time || row.scheduled_start_time || row.created_at,
          age_hours: ageHours,
          sla_status:
            technicalIssue
              ? 'breached'
              : ageHours !== null && ageHours >= 12
                ? 'due_soon'
                : 'within_sla',
          next_route: {
            section: 'telemedicine',
            tab: 'telemedicine',
            patientId: row.patient_id,
          },
          ...this.buildDestination(destinationUsers, referralFacilities, {
            role: requiresDoctorSync ? 'doctor' : 'nurse',
            service: 'telemedicine_protocol',
            specialty: 'Telemedicine',
          }),
          metadata: {
            consultation_id: row.consultation_id,
            consultation_type: row.consultation_type || null,
            consultation_status: row.status || null,
            patient_consent: consented,
            technical_issues: row.technical_issues || null,
            doctor_name: row.doctor_name || null,
            recommendation_bundle: recommendationBundle,
            guideline_citations: recommendationBundle.citations,
          },
        },
        workflowRowsByKey,
      );
    });

    const labCriticalItems = (labCriticalAlertRows || []).map((row: any) => {
      const severityKey = String(row?.severity || '').toLowerCase();
      const statusKey = String(row?.alert_status || '').toLowerCase();
      const panicSignal = severityKey === 'panic';
      const criticalSignal = panicSignal || severityKey === 'critical';
      const requiresDoctorSync = panicSignal || statusKey === 'escalated';
      const recommendationBundle = this.buildLabCriticalRecommendationBundle({
        alert: row,
      });
      const ageHoursFromRow = Number(row?.age_hours);
      const ageHours = Number.isFinite(ageHoursFromRow)
        ? Math.round(ageHoursFromRow * 10) / 10
        : this.getHoursSince(row?.alerted_at || row?.created_at);

      return this.mergeCrossModuleWorkflowState(
        {
          id: `lab-critical-alert:${row.alert_id}`,
          module: 'lab',
          item_type: 'lab_critical_alert_followup',
          source_record_id: row.alert_id,
          severity: panicSignal ? 'critical' : criticalSignal ? 'high' : 'medium',
          workflow_status: 'pending',
          module_status: row.alert_status || 'pending',
          doctor_sync_status: requiresDoctorSync ? 'doctor_review_recommended' : 'nurse_followup_required',
          title: panicSignal
            ? 'Panic lab alert escalation required'
            : criticalSignal
              ? 'Critical lab alert follow-up required'
              : 'Abnormal lab alert follow-up pending',
          summary:
            `${row.patient_name} has ${row.component_name || 'critical lab'} result ` +
            `${row.result_value ? `${row.result_value}` : ''}${row.critical_range ? ` (critical range ${row.critical_range})` : ''}.`,
          recommended_action: requiresDoctorSync
            ? 'Acknowledge alert, prepare follow-up order set, and escalate immediate doctor synchronization.'
            : 'Acknowledge alert and prepare critical-lab follow-up order set from the queue.',
          patient_id: row.patient_id,
          patient_name: row.patient_name,
          patient_number: row.patient_number,
          created_at: row.alerted_at || row.created_at,
          updated_at: row.acknowledged_at || row.alerted_at || row.created_at,
          age_hours: ageHours,
          sla_status:
            panicSignal
              ? 'breached'
              : ageHours !== null && ageHours >= 2
                ? 'due_soon'
                : 'within_sla',
          next_route: {
            section: 'lab',
            tab: 'lab',
            patientId: row.patient_id,
          },
          ...this.buildDestination(destinationUsers, referralFacilities, {
            role: criticalSignal ? 'doctor' : 'nurse',
            service: 'critical_labs',
            specialty: 'Laboratory Medicine',
          }),
          metadata: {
            alert_id: row.alert_id,
            lab_order_id: row.lab_order_id || null,
            component_name: row.component_name || null,
            result_value: row.result_value || null,
            critical_range: row.critical_range || null,
            severity: row.severity || null,
            alert_status: row.alert_status || null,
            alerted_to: row.alerted_to || null,
            alerted_to_name: row.alerted_to_name || null,
            escalated_to: row.escalated_to || null,
            escalated_to_name: row.escalated_to_name || null,
            recommendation_bundle: recommendationBundle,
            guideline_citations: recommendationBundle.citations,
          },
        },
        workflowRowsByKey,
      );
    });

    const pharmacyProtocolItems = (pharmacyPrescriptionRows || []).map((row: any) => {
      const quantity = Number(row?.quantity || 0);
      const stockOnHand = Number(row?.stock_on_hand || 0);
      const lowStock = Number.isFinite(quantity) && quantity > 0 && stockOnHand < quantity;
      const ageHours = this.getHoursSince(row.created_at);
      const recommendationBundle = this.buildPharmacyRecommendationBundle({
        prescription: row,
      });

      return this.mergeCrossModuleWorkflowState(
        {
          id: `pharmacy-prescription:${row.prescription_id}`,
          module: 'pharmacy',
          item_type: 'pharmacy_protocol_followup',
          source_record_id: row.prescription_id,
          severity: lowStock ? 'high' : 'medium',
          workflow_status: 'pending',
          module_status: row.status || 'active',
          doctor_sync_status: lowStock ? 'doctor_review_recommended' : 'nurse_followup_required',
          title: lowStock
            ? 'Stock-constrained prescription follow-up'
            : 'Pharmacy dispensing follow-up pending',
          summary:
            `${row.patient_name} has active prescription ${row.medication_name || 'medication'} ` +
            `(${row.dosage || 'dose not set'}, ${row.frequency || 'frequency not set'}).`,
          recommended_action: lowStock
            ? 'Prepare dispense plan, complete counseling checkpoint, and escalate doctor sync for low-stock coverage.'
            : 'Prepare dispense plan and complete counseling checkpoint from the queue.',
          patient_id: row.patient_id,
          patient_name: row.patient_name,
          patient_number: row.patient_number,
          created_at: row.created_at,
          updated_at: row.created_at,
          age_hours: ageHours,
          sla_status: ageHours !== null && ageHours >= 24 ? 'due_soon' : 'within_sla',
          next_route: {
            section: 'pharmacy',
            tab: 'pharmacy',
            patientId: row.patient_id,
          },
          ...this.buildDestination(destinationUsers, referralFacilities, {
            role: lowStock ? 'doctor' : 'pharmacist',
            service: 'pharmacy_dispensing',
            specialty: 'Pharmacy',
          }),
          metadata: {
            prescription_id: row.prescription_id,
            medication_name: row.medication_name || null,
            dosage: row.dosage || null,
            frequency: row.frequency || null,
            quantity: quantity || null,
            stock_on_hand: stockOnHand,
            reorder_level: Number(row?.reorder_level || 0),
            inventory_match_count: Number(row?.inventory_match_count || 0),
            prescriber_name: row.prescriber_name || null,
            recommendation_bundle: recommendationBundle,
            guideline_citations: recommendationBundle.citations,
          },
        },
        workflowRowsByKey,
      );
    });

    const edProtocolItems = (edVisitRows || []).map((row: any) => {
      const triageLevel = Number(row?.triage_level || 0);
      const triageAcuity = String(row?.triage_acuity || '').trim().toLowerCase();
      const criticalSignal =
        triageLevel === 1 || Boolean(row?.code_sepsis) || Boolean(row?.code_stroke) || Boolean(row?.code_stemi);
      const highSignal =
        criticalSignal || triageLevel === 2 || triageAcuity === 'immediate' || triageAcuity === 'emergent';
      const recommendationBundle = this.buildEdProtocolRecommendationBundle({
        visit: row,
      });
      const ageHours = this.getHoursSince(row?.arrival_date);

      return this.mergeCrossModuleWorkflowState(
        {
          id: `ed-visit:${row.ed_visit_id}`,
          module: 'ed',
          item_type: 'ed_protocol_followup',
          source_record_id: row.ed_visit_id,
          severity: criticalSignal ? 'critical' : highSignal ? 'high' : 'medium',
          workflow_status: 'pending',
          module_status: row.ed_status || 'waiting',
          doctor_sync_status: highSignal ? 'doctor_review_recommended' : 'nurse_followup_required',
          title: highSignal ? 'ED high-acuity protocol follow-up' : 'ED protocol follow-up pending',
          summary:
            `${row.patient_name} has an ED visit (${row.ed_visit_number || row.ed_visit_id}) ` +
            `for ${row.chief_complaint || 'acute complaint'}.`,
          recommended_action: highSignal
            ? 'Execute ED order-set/disposition bundle actions and escalate doctor synchronization for acuity signals.'
            : 'Execute ED order-set and disposition prep actions from the queue.',
          patient_id: row.patient_id,
          patient_name: row.patient_name,
          patient_number: row.patient_number,
          created_at: row.arrival_date,
          updated_at: row.arrival_date,
          age_hours: ageHours,
          sla_status:
            ageHours !== null && ageHours >= 12 ? 'breached' : ageHours !== null && ageHours >= 6 ? 'due_soon' : 'within_sla',
          next_route: {
            section: 'ed',
            tab: 'ed',
            patientId: row.patient_id,
          },
          ...this.buildDestination(destinationUsers, referralFacilities, {
            role: highSignal ? 'doctor' : 'nurse',
            service: 'ed_protocol',
            specialty: 'Emergency Medicine',
          }),
          metadata: {
            ed_visit_id: row.ed_visit_id,
            ed_visit_number: row.ed_visit_number || null,
            triage_level: triageLevel || null,
            triage_acuity: row.triage_acuity || null,
            ed_status: row.ed_status || null,
            disposition: row.disposition || null,
            recommendation_bundle: recommendationBundle,
            guideline_citations: recommendationBundle.citations,
          },
        },
        workflowRowsByKey,
      );
    });

    const sepsisProtocolItems = (sepsisBundleRows || []).map((row: any) => {
      const severeSignal = Boolean(row?.severe_sepsis) || Boolean(row?.septic_shock);
      const threeHourComplete = Boolean(row?.three_hour_bundle_complete);
      const overallCompliance = Boolean(row?.overall_compliance);
      const recommendationBundle = this.buildSepsisProtocolRecommendationBundle({
        bundle: row,
      });
      const ageHours = this.getHoursSince(row?.bundle_start_time);

      return this.mergeCrossModuleWorkflowState(
        {
          id: `sepsis-bundle:${row.sepsis_bundle_id}`,
          module: 'sepsis',
          item_type: 'sepsis_bundle_followup',
          source_record_id: row.sepsis_bundle_id,
          severity: severeSignal ? 'critical' : !threeHourComplete || !overallCompliance ? 'high' : 'medium',
          workflow_status: 'pending',
          module_status: overallCompliance ? 'compliant' : 'non_compliant',
          doctor_sync_status: severeSignal || !overallCompliance ? 'doctor_review_recommended' : 'nurse_followup_required',
          title:
            severeSignal || !overallCompliance
              ? 'Sepsis protocol escalation follow-up'
              : 'Sepsis protocol follow-up pending',
          summary:
            `${row.patient_name} has an active sepsis bundle started on ` +
            `${new Date(row.bundle_start_time).toISOString().split('T')[0]}.`,
          recommended_action:
            severeSignal || !overallCompliance
              ? 'Execute three-hour/repeat-lactate actions and escalate doctor synchronization for unresolved sepsis risk.'
              : 'Execute sepsis bundle follow-up actions from the queue.',
          patient_id: row.patient_id,
          patient_name: row.patient_name,
          patient_number: row.patient_number,
          created_at: row.bundle_start_time,
          updated_at: row.updated_at || row.bundle_start_time,
          age_hours: ageHours,
          sla_status:
            ageHours !== null && ageHours >= 6 ? 'breached' : ageHours !== null && ageHours >= 3 ? 'due_soon' : 'within_sla',
          next_route: {
            section: 'sepsis',
            tab: 'sepsis',
            patientId: row.patient_id,
          },
          ...this.buildDestination(destinationUsers, referralFacilities, {
            role: severeSignal || !overallCompliance ? 'doctor' : 'nurse',
            service: 'sepsis_protocol',
            specialty: 'Critical Care',
          }),
          metadata: {
            sepsis_bundle_id: row.sepsis_bundle_id,
            sepsis_screening_id: row.sepsis_screening_id || null,
            qsofa_score: row.qsofa_score ?? null,
            sirs_score: row.sirs_score ?? null,
            severe_sepsis: Boolean(row?.severe_sepsis),
            septic_shock: Boolean(row?.septic_shock),
            three_hour_bundle_complete: threeHourComplete,
            six_hour_bundle_complete: Boolean(row?.six_hour_bundle_complete),
            overall_compliance: overallCompliance,
            recommendation_bundle: recommendationBundle,
            guideline_citations: recommendationBundle.citations,
          },
        },
        workflowRowsByKey,
      );
    });

    const bloodBankTransfusionItems = (bloodTransfusionRows || []).map((row: any) => {
      const transfusionStatus = String(row?.transfusion_status || '').toLowerCase();
      const reaction = Boolean(row?.transfusion_reaction);
      const consentObtained = Boolean(row?.consent_obtained);
      const ageHours = this.getHoursSince(row?.start_time || row?.order_date);
      const recommendationBundle = this.buildBloodBankTransfusionRecommendationBundle({
        transfusion: row,
      });

      return this.mergeCrossModuleWorkflowState(
        {
          id: `blood-bank-transfusion:${row.transfusion_id}`,
          module: 'blood_bank',
          item_type: 'blood_bank_transfusion_followup',
          source_record_id: row.transfusion_id,
          severity:
            reaction
              ? 'critical'
              : transfusionStatus === 'ordered'
                ? 'high'
                : 'medium',
          workflow_status: 'pending',
          module_status: row.transfusion_status || 'ordered',
          doctor_sync_status: reaction ? 'doctor_review_recommended' : 'nurse_followup_required',
          title: reaction
            ? 'Transfusion reaction escalation required'
            : transfusionStatus === 'ordered'
              ? 'Ordered transfusion awaiting safety initiation'
              : 'Active transfusion follow-up in progress',
          summary:
            `${row.patient_name} has transfusion ${row.transfusion_id}` +
            `${row.unit_number ? ` for unit ${row.unit_number}` : ''}` +
            `${row.component_type ? ` (${String(row.component_type).replace(/_/g, ' ')})` : ''}.`,
          recommended_action: reaction
            ? 'Escalate reaction management immediately and synchronize with attending doctor.'
            : transfusionStatus === 'ordered'
              ? 'Confirm compatibility/consent and transition transfusion into monitored in-progress state.'
              : 'Complete safety checklist and close transfusion workflow with documented outcomes.',
          patient_id: row.patient_id,
          patient_name: row.patient_name,
          patient_number: row.patient_number,
          created_at: row.order_date,
          updated_at: row.updated_at || row.start_time || row.order_date,
          age_hours: ageHours,
          sla_status:
            reaction
              ? 'breached'
              : ageHours !== null && ageHours >= 8
                ? 'due_soon'
                : 'within_sla',
          next_route: {
            section: 'blood-bank',
            tab: 'blood-bank',
            patientId: row.patient_id,
          },
          ...this.buildDestination(destinationUsers, referralFacilities, {
            role: reaction ? 'doctor' : 'nurse',
            service: 'blood_bank',
            specialty: 'Transfusion Medicine',
          }),
          metadata: {
            transfusion_id: row.transfusion_id,
            inventory_id: row.inventory_id || null,
            unit_number: row.unit_number || null,
            component_type: row.component_type || null,
            blood_group: row.blood_group || null,
            rh_factor: row.rh_factor || null,
            patient_blood_type: row.patient_blood_type || null,
            transfusion_status: row.transfusion_status || null,
            consent_obtained: consentObtained,
            transfusion_reaction: reaction,
            reaction_type: row.reaction_type || null,
            reaction_severity: row.reaction_severity || null,
            ordered_by_name: row.ordered_by_name || null,
            administered_by_name: row.administered_by_name || null,
            recommendation_bundle: recommendationBundle,
            guideline_citations: recommendationBundle.citations,
          },
        },
        workflowRowsByKey,
      );
    });

    const handoffItems = (handoffRows || []).map((row: any) => {
      const referenceTime = row.updated_at || row.reviewed_at || row.finalized_at || row.shared_at || null;
      const ageHours = this.getHoursSince(referenceTime);
      const severity =
        row.status === 'draft' && ageHours !== null && ageHours >= 6
          ? 'high'
          : row.status === 'reviewed'
            ? 'medium'
            : 'high';

      return this.mergeCrossModuleWorkflowState(
        {
          id: `handoff:${row.patient_id}:${referenceTime || row.status}`,
          module: 'nursing',
          item_type: 'nurse_handoff_risk',
          source_record_id: row.patient_id,
          severity,
          workflow_status: 'pending',
          module_status: row.status || 'draft',
          doctor_sync_status: 'nurse_handoff_pending',
          title: 'Shift handoff follow-through required',
          summary:
            row.status === 'draft'
              ? `${row.patient_name} has a draft handoff that has not been finalized for the next shift.`
              : row.status === 'finalized'
                ? `${row.patient_name} has a finalized handoff that is still awaiting reviewer confirmation or sharing.`
                : `${row.patient_name} has a reviewed handoff that still has not been shared to the next shift.`,
          recommended_action:
            row.status === 'draft'
              ? 'Finalize the handoff summary, confirm reviewer acknowledgement, and share it with the next shift.'
              : 'Complete the remaining handoff workflow steps so the next shift receives a closed-loop summary.',
          patient_id: row.patient_id,
          patient_name: row.patient_name,
          patient_number: row.patient_number,
          created_at: referenceTime,
          updated_at: referenceTime,
          age_hours: ageHours,
          sla_status: ageHours !== null && ageHours >= 6 ? 'due_soon' : 'within_sla',
          next_route: {
            section: 'main',
            tab: 'notes',
            patientId: row.patient_id,
          },
          ...this.buildDestination(destinationUsers, referralFacilities, {
            role: 'nurse',
            service: 'shift_handoff',
            specialty: 'Nursing',
          }),
          metadata: {
            handoff_status: row.status || 'draft',
          },
        },
        workflowRowsByKey,
      );
    });

    const medicationItems = (medicationRows || []).map((row: any) => {
      const ageHours = this.getHoursSince(row.scheduled_time);
      const isCriticalDelay = ageHours !== null && ageHours >= 4;
      return this.mergeCrossModuleWorkflowState(
        {
          id: `medication:${row.id}`,
          module: 'nursing',
          item_type: 'medication_administration_followup',
          source_record_id: row.id,
          severity:
            row.administration_status === 'refused' || row.administration_status === 'held' || isCriticalDelay
              ? 'high'
              : 'medium',
          workflow_status: 'pending',
          module_status: row.administration_status || 'pending',
          doctor_sync_status:
            row.administration_status === 'refused' || row.administration_status === 'held'
              ? 'doctor_review_recommended'
              : 'nurse_followup_required',
          title:
            row.administration_status === 'refused'
              ? 'Medication refusal follow-up required'
              : row.administration_status === 'held'
                ? 'Held medication requires follow-up'
                : 'Overdue medication administration follow-up required',
          summary: `${row.patient_name} has ${row.medication_name} ${row.dose} ${row.unit} requiring action.`,
          recommended_action:
            row.administration_status === 'refused'
              ? 'Document counseling, reassess safety concerns, and notify the prescriber about the refused dose.'
              : row.administration_status === 'held'
                ? 'Review the hold reason, confirm the next safe administration step, and notify the doctor if the hold persists.'
                : 'Administer the dose if still appropriate or document the omission with the correct reason.',
          patient_id: row.patient_id,
          patient_name: row.patient_name,
          patient_number: row.patient_number,
          created_at: row.scheduled_time,
          updated_at: row.actual_administration_time || row.scheduled_time,
          age_hours: ageHours,
          sla_status: isCriticalDelay ? 'breached' : 'due_soon',
          next_route: {
            section: 'main',
            tab: 'orders',
            patientId: row.patient_id,
          },
          ...this.buildDestination(destinationUsers, referralFacilities, {
            role: row.administration_status === 'pending' ? 'nurse' : 'doctor',
            service: 'medication_safety',
            specialty: row.administration_status === 'pending' ? 'Nursing' : 'Internal Medicine',
          }),
          metadata: {
            medication_name: row.medication_name,
            dose: row.dose,
            unit: row.unit,
            route: row.route,
            administration_status: row.administration_status,
            refusal_reason: row.refusal_reason || null,
            omission_reason: row.omission_reason || null,
            notes: row.notes || null,
            scheduled_time: row.scheduled_time,
          },
        },
        workflowRowsByKey,
      );
    });

    const generatedItems = [
      ...maternityItems,
      ...hivRegimenItems,
      ...hivPathwayItems,
      ...oncologyInfusionItems,
      ...oncologyToxicityItems,
      ...cardiologyProtocolItems,
      ...ophthalmologyProtocolItems,
      ...telemedicineProtocolItems,
      ...edProtocolItems,
      ...sepsisProtocolItems,
      ...bloodBankTransfusionItems,
      ...labCriticalItems,
      ...pharmacyProtocolItems,
      ...handoffItems,
      ...medicationItems,
    ];
    const generatedItemIds = new Set<string>(generatedItems.map((item) => String(item.id)));
    const workflowOnlyItems = (workflowRows || [])
      .filter((row: any) => {
        const workflowKey = this.normalizeText(row?.workflow_key);
        if (!workflowKey || generatedItemIds.has(workflowKey)) {
          return false;
        }

        const moduleKey = this.normalizeModuleKey(row?.module);
        if (!moduleKey || this.isCoreGeneratedCrossModule(moduleKey)) {
          return false;
        }

        const normalizedStatus = this.normalizeCrossModuleWorkflowStatus(row?.status);
        return normalizedStatus !== 'completed';
      })
      .map((row: any) => {
        const workflowKey = String(row.workflow_key);
        const moduleKey = this.normalizeModuleKey(row?.module) || 'unknown';
        const context = this.parseJsonObject(row?.context) || {};
        const normalizedStatus = this.normalizeCrossModuleWorkflowStatus(row?.status);
        const severityCandidate = this.normalizeWorkflowContextStatus(
          this.readContextValue(context, ['severity', 'priority', 'urgency']),
        );
        const severity =
          severityCandidate === 'critical' ||
          severityCandidate === 'high' ||
          severityCandidate === 'medium' ||
          severityCandidate === 'low'
            ? severityCandidate
            : normalizedStatus === 'pending'
              ? 'high'
              : 'medium';
        const doctorSyncStatus =
          this.normalizeWorkflowContextStatus(
            this.readContextValue(context, ['doctor_sync_status', 'doctorSyncStatus']),
          ) ||
          (String(row?.destination_role || '').toLowerCase() === 'doctor'
            ? 'doctor_review_recommended'
            : normalizedStatus === 'acknowledged'
              ? 'sync_in_progress'
              : 'sync_pending');
        const moduleStatus =
          this.readContextValue(context, ['module_status', 'moduleStatus']) || row?.status || null;
        const title =
          this.readContextValue(context, ['title', 'workflow_title', 'workflowTitle']) ||
          `${moduleKey.replace(/_/g, ' ')} synchronization follow-up`;
        const summary =
          this.readContextValue(context, ['summary', 'description']) ||
          `Cross-module workflow synchronization is pending for ${moduleKey.replace(/_/g, ' ')}.`;
        const recommendedAction =
          this.readContextValue(context, ['recommended_action', 'recommendedAction', 'next_step', 'nextStep']) ||
          'Open the linked module workflow and close the synchronization loop.';
        const itemType = this.normalizeText(row?.item_type) || `${moduleKey}_workflow_item`;
        const createdAt = row?.created_at || row?.updated_at || null;
        const updatedAt = row?.updated_at || row?.created_at || null;
        const ageHours = this.getHoursSince(updatedAt || createdAt);
        const accountsSyncStatus = this.isAccountsWorkflow(row, context, moduleKey)
          ? this.extractAccountsSyncStatus(context)
          : null;

        return this.mergeCrossModuleWorkflowState(
          {
            id: workflowKey,
            module: moduleKey,
            item_type: itemType,
            source_record_id: row?.source_record_id || null,
            severity,
            workflow_status: normalizedStatus,
            module_status: moduleStatus,
            doctor_sync_status: doctorSyncStatus,
            title,
            summary,
            recommended_action: recommendedAction,
            patient_id: row?.patient_id || this.readContextValue(context, ['patient_id', 'patientId']) || null,
            patient_name: this.readContextValue(context, ['patient_name', 'patientName']) || null,
            patient_number: this.readContextValue(context, ['patient_number', 'patientNumber']) || null,
            enrollment_id:
              row?.enrollment_id || this.readContextValue(context, ['enrollment_id', 'enrollmentId']) || null,
            enrollment_number: this.readContextValue(context, ['enrollment_number', 'enrollmentNumber']) || null,
            created_at: createdAt,
            updated_at: updatedAt,
            age_hours: ageHours,
            sla_status:
              ageHours !== null && ageHours >= 24 ? 'breached' : ageHours !== null && ageHours >= 12 ? 'due_soon' : null,
            next_route: {
              section: moduleKey === 'ed' || moduleKey === 'sepsis' ? 'main' : moduleKey,
              tab: moduleKey,
              patientId: row?.patient_id || this.readContextValue(context, ['patient_id', 'patientId']) || undefined,
              enrollmentId:
                row?.enrollment_id || this.readContextValue(context, ['enrollment_id', 'enrollmentId']) || undefined,
            },
            destination_role: row?.destination_role || null,
            destination_service: row?.destination_service || null,
            destination_specialty: row?.destination_specialty || null,
            destination_user_id: row?.destination_user_id || null,
            destination_user_name: row?.destination_user_name || null,
            destination_facility_id: row?.destination_facility_id || null,
            destination_facility_name: row?.destination_facility_name || null,
            metadata: {
              workflow_context: context,
              accounts_sync_status: accountsSyncStatus,
            },
          },
          workflowRowsByKey,
        );
      });

    const items = [
      ...generatedItems,
      ...workflowOnlyItems,
    ]
      .filter((item) => item.module === 'maternity' || item.workflow_status !== 'completed')
      .sort((a, b) => {
        const severityDiff = this.getSeverityRank(b.severity) - this.getSeverityRank(a.severity);
        if (severityDiff !== 0) {
          return severityDiff;
        }

        const workflowDiff = this.getWorkflowRank(a.workflow_status) - this.getWorkflowRank(b.workflow_status);
        if (workflowDiff !== 0) {
          return workflowDiff;
        }

        const firstDate = new Date(b.updated_at || b.created_at || 0).getTime();
        const secondDate = new Date(a.updated_at || a.created_at || 0).getTime();
        return firstDate - secondDate;
      });

    const moduleCount = (module: string) =>
      items.filter((item) => this.normalizeModuleKey(item.module) === module).length;
    const accountsCount = items.filter((item) =>
      this.isAccountsModule(this.normalizeModuleKey(item.module)),
    ).length;
    const specialtyCount = items.filter((item) =>
      ['cardiology', 'ophthalmology', 'ed', 'sepsis', 'blood_bank', 'telemedicine', 'lab', 'pharmacy'].includes(
        this.normalizeModuleKey(item.module),
      ),
    ).length;

    return {
      items,
      summary: {
        total: items.length,
        critical: items.filter((item) => item.severity === 'critical').length,
        high: items.filter((item) => item.severity === 'high').length,
        maternity: moduleCount('maternity'),
        hiv: moduleCount('hiv'),
        oncology: moduleCount('oncology'),
        nursing: moduleCount('nursing'),
        cardiology: moduleCount('cardiology'),
        ophthalmology: moduleCount('ophthalmology'),
        ed: moduleCount('ed'),
        sepsis: moduleCount('sepsis'),
        blood_bank: moduleCount('blood_bank'),
        telemedicine: moduleCount('telemedicine'),
        lab: moduleCount('lab'),
        pharmacy: moduleCount('pharmacy'),
        accounts: accountsCount,
        specialty: specialtyCount,
        handoff: items.filter((item) => item.item_type === 'nurse_handoff_risk').length,
        medication: items.filter((item) => item.item_type === 'medication_administration_followup').length,
      },
    };
  }

  async getOutcomeAnalytics(tenantDb: DataSource, options?: { days?: number }) {
    const requestedDays = Number(options?.days);
    const days = Number.isFinite(requestedDays)
      ? Math.min(Math.max(Math.round(requestedDays), 1), 365)
      : 30;
    const sinceDate = new Date();
    sinceDate.setHours(0, 0, 0, 0);
    sinceDate.setDate(sinceDate.getDate() - Math.max(days - 1, 0));
    const sinceIso = sinceDate.toISOString().split('T')[0];
    const untilIso = new Date().toISOString().split('T')[0];

    const [workflowRows, maternityRows] = await Promise.all([
      this.safeQuery(
        tenantDb,
        `
        SELECT workflow_key, module, status, context, created_at, updated_at, completed_at
        FROM nurse_cross_module_workflow_state
        WHERE created_at >= $1::date
        ORDER BY created_at DESC
        `,
        [sinceIso],
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT id, status, priority, last_event_at, created_at
        FROM maternity_care_tasks
        WHERE created_at >= $1::date
          AND status <> 'closed'
        ORDER BY created_at DESC
        `,
        [sinceIso],
      ),
    ]);

    const queueByStatus: Record<string, number> = {
      pending: 0,
      acknowledged: 0,
      completed: 0,
    };
    const queueByModule: Record<string, number> = {};
    let pendingAgeTotal = 0;
    let pendingAgeSamples = 0;
    let pendingOver24h = 0;

    const executedByAction: Record<string, number> = {};
    let executedActionsTotal = 0;
    let reusedOrIdempotentTotal = 0;
    let visitPrepDraftsCreated = 0;

    for (const row of workflowRows) {
      const normalizedStatus = String(row?.status || 'pending').toLowerCase();
      queueByStatus[normalizedStatus] = (queueByStatus[normalizedStatus] || 0) + 1;

      const normalizedModule = String(row?.module || 'unknown').toLowerCase();
      queueByModule[normalizedModule] = (queueByModule[normalizedModule] || 0) + 1;

      if (normalizedStatus !== 'completed') {
        const pendingAge = this.getHoursSince(row?.updated_at || row?.created_at);
        if (pendingAge !== null) {
          pendingAgeTotal += pendingAge;
          pendingAgeSamples += 1;
          if (pendingAge >= 24) {
            pendingOver24h += 1;
          }
        }
      }

      const context = this.parseJsonObject(row?.context) || {};
      const actionExecutions =
        context && typeof context === 'object' && context.action_executions
          ? context.action_executions
          : {};
      const executionEntries = Object.entries(actionExecutions);

      for (const [actionId, execution] of executionEntries) {
        const executionStatus = String((execution as any)?.status || '').toLowerCase();
        if (executionStatus !== 'completed') {
          continue;
        }

        executedActionsTotal += 1;
        executedByAction[actionId] = (executedByAction[actionId] || 0) + 1;

        const operation = String((execution as any)?.result?.operation || '').toLowerCase();
        if (operation === 'already_applied' || operation.includes('reused')) {
          reusedOrIdempotentTotal += 1;
        }
        if ((execution as any)?.result?.intakeDraftId) {
          visitPrepDraftsCreated += 1;
        }
      }
    }

    const maternityByPriority: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    let maternityDueSoon = 0;
    let maternityBreached = 0;
    let maternityAgeTotal = 0;
    let maternityAgeSamples = 0;
    let maternityOldestAgeHours = 0;

    for (const row of maternityRows) {
      const priority = String(row?.priority || 'high').toLowerCase();
      maternityByPriority[priority] = (maternityByPriority[priority] || 0) + 1;

      const ageHours = this.getHoursSince(row?.last_event_at || row?.created_at);
      if (ageHours === null) {
        continue;
      }

      maternityAgeTotal += ageHours;
      maternityAgeSamples += 1;
      maternityOldestAgeHours = Math.max(maternityOldestAgeHours, ageHours);

      const slaHours = this.getMaternityTaskSlaHours(priority);
      if (ageHours >= slaHours) {
        maternityBreached += 1;
      } else if (ageHours >= slaHours * 0.8) {
        maternityDueSoon += 1;
      }
    }

    const totalQueueItems = workflowRows.length;
    const completedQueueItems = queueByStatus.completed || 0;
    const acknowledgedQueueItems = queueByStatus.acknowledged || 0;
    const activeQueueItems = (queueByStatus.pending || 0) + acknowledgedQueueItems;

    return {
      generatedAt: new Date().toISOString(),
      window: {
        days,
        since: sinceIso,
        until: untilIso,
      },
      crossModuleQueue: {
        totalItems: totalQueueItems,
        activeItems: activeQueueItems,
        completedItems: completedQueueItems,
        byStatus: queueByStatus,
        byModule: queueByModule,
        completionRatePercent: this.toPercent(completedQueueItems, totalQueueItems),
        acknowledgementOrCompletionRatePercent: this.toPercent(
          acknowledgedQueueItems + completedQueueItems,
          totalQueueItems,
        ),
        pendingOlderThan24h: pendingOver24h,
        averageActiveAgeHours:
          pendingAgeSamples > 0 ? Math.round((pendingAgeTotal / pendingAgeSamples) * 10) / 10 : 0,
      },
      hivRecommendationExecution: {
        executedActionsTotal,
        executedByAction,
        reusedOrIdempotentTotal,
        visitPrepDraftsCreated,
        actionsPerQueueItem: this.toPercent(executedActionsTotal, totalQueueItems),
      },
      maternityEscalationSla: {
        unresolvedTasks: maternityRows.length,
        criticalUnresolved: maternityByPriority.critical || 0,
        byPriority: maternityByPriority,
        dueSoon: maternityDueSoon,
        breached: maternityBreached,
        averageOpenAgeHours:
          maternityAgeSamples > 0 ? Math.round((maternityAgeTotal / maternityAgeSamples) * 10) / 10 : 0,
        oldestOpenAgeHours: Math.round(maternityOldestAgeHours * 10) / 10,
      },
    };
  }

  async getDoctorOutcomeAnalytics(
    tenantDb: DataSource,
    options?: {
      days?: number;
      module?: string;
      status?: string;
      caseId?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const normalizeDateOnly = (value: string | null | undefined, fallback: Date, endOfDay = false) => {
      const normalizedValue = this.normalizeText(value);
      if (!normalizedValue) {
        return new Date(fallback.getTime());
      }

      const dateOnlyMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (dateOnlyMatch) {
        const year = Number(dateOnlyMatch[1]);
        const month = Number(dateOnlyMatch[2]) - 1;
        const day = Number(dateOnlyMatch[3]);
        return new Date(
          Date.UTC(year, month, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0),
        );
      }

      const parsed = new Date(normalizedValue);
      if (Number.isNaN(parsed.getTime())) {
        return new Date(fallback.getTime());
      }
      if (endOfDay) {
        parsed.setUTCHours(23, 59, 59, 999);
      } else {
        parsed.setUTCHours(0, 0, 0, 0);
      }
      return parsed;
    };

    const requestedDays = Number(options?.days);
    const days = Number.isFinite(requestedDays)
      ? Math.min(Math.max(Math.round(requestedDays), 1), 365)
      : 30;
    const fallbackSinceDate = new Date();
    fallbackSinceDate.setUTCHours(0, 0, 0, 0);
    fallbackSinceDate.setDate(fallbackSinceDate.getDate() - Math.max(days - 1, 0));
    const fallbackUntilDate = new Date();
    fallbackUntilDate.setUTCHours(23, 59, 59, 999);

    const sinceDate = normalizeDateOnly(options?.dateFrom, fallbackSinceDate, false);
    const untilDate = normalizeDateOnly(options?.dateTo, fallbackUntilDate, true);

    const sinceIso = sinceDate.toISOString().split('T')[0];
    const untilIso = untilDate.toISOString().split('T')[0];

    const whereClauses: string[] = [
      'created_at >= $1::date',
      'created_at <= $2::date + INTERVAL \'1 day\' - INTERVAL \'1 second\'',
      `(
        LOWER(COALESCE(destination_role, '')) = 'doctor'
        OR LOWER(COALESCE(module, '')) IN (
          'maternity',
          'hiv',
          'oncology',
          'nursing',
          'cardiology',
          'ophthalmology',
          'ed',
          'sepsis',
          'blood_bank',
          'telemedicine',
          'lab',
          'pharmacy',
          'accounts',
          'billing',
          'claims',
          'revenue_cycle'
        )
        OR LOWER(COALESCE(destination_service, '')) IN ('accounts', 'billing', 'claims', 'revenue_cycle', 'payment_clearance')
        OR LOWER(COALESCE(context->>'doctor_sync_status', '')) LIKE '%doctor%'
        OR LOWER(COALESCE(context->>'doctorSyncStatus', '')) LIKE '%doctor%'
      )`,
    ];
    const queryParams: any[] = [sinceIso, untilIso];

    const normalizedModuleFilter = this.normalizeText(options?.module)?.toLowerCase() || null;
    if (normalizedModuleFilter) {
      whereClauses.push(`LOWER(COALESCE(module, '')) = $${queryParams.length + 1}`);
      queryParams.push(normalizedModuleFilter);
    }

    const normalizedStatusFilter = this.normalizeText(options?.status)?.toLowerCase() || null;
    if (normalizedStatusFilter && normalizedStatusFilter !== 'all') {
      whereClauses.push(`LOWER(COALESCE(status, '')) = $${queryParams.length + 1}`);
      queryParams.push(normalizedStatusFilter);
    }

    const normalizedCaseIdFilter = this.normalizeText(options?.caseId) || null;
    if (normalizedCaseIdFilter) {
      whereClauses.push(
        `(
          source_record_id = $${queryParams.length + 1}
          OR COALESCE(context->>'case_id', '') = $${queryParams.length + 1}
          OR COALESCE(context->>'oncology_case_id', '') = $${queryParams.length + 1}
          OR workflow_key = $${queryParams.length + 2}
        )`,
      );
      queryParams.push(normalizedCaseIdFilter, `oncology-protocol:${normalizedCaseIdFilter}`);
    }

    const workflowRows = await this.safeQuery(
      tenantDb,
      `
      SELECT workflow_key, module, status, context, destination_role, source_record_id, created_at, updated_at, completed_at
      FROM nurse_cross_module_workflow_state
      WHERE ${whereClauses.join('\n        AND ')}
      ORDER BY created_at DESC
      `,
      queryParams,
    );

    const queueByStatus: Record<string, number> = {
      pending: 0,
      acknowledged: 0,
      completed: 0,
    };
    const queueByModule: Record<string, number> = {};
    const moduleStatusCounts: Record<
      string,
      { total: number; pending: number; acknowledged: number; completed: number }
    > = {};
    const accountsSyncByStatus: Record<string, number> = {};
    const accountsSyncByModule: Record<string, number> = {};
    let accountsSyncTotal = 0;
    let accountsPending = 0;
    let pendingOver24h = 0;

    const executedByAction: Record<string, number> = {};
    const executedByModule: Record<string, number> = {};
    let executedActionsTotal = 0;
    let reusedOrIdempotentTotal = 0;
    let overrideActionsTotal = 0;
    let executionLatencyTotalHours = 0;
    let executionLatencySamples = 0;
    const queueItemsWithExecutions = new Set<string>();

    for (const row of workflowRows) {
      const normalizedStatus = this.normalizeCrossModuleWorkflowStatus(row?.status);
      queueByStatus[normalizedStatus] = (queueByStatus[normalizedStatus] || 0) + 1;

      const normalizedModule = String(row?.module || 'unknown').toLowerCase();
      queueByModule[normalizedModule] = (queueByModule[normalizedModule] || 0) + 1;
      moduleStatusCounts[normalizedModule] = moduleStatusCounts[normalizedModule] || {
        total: 0,
        pending: 0,
        acknowledged: 0,
        completed: 0,
      };
      moduleStatusCounts[normalizedModule].total += 1;
      moduleStatusCounts[normalizedModule][normalizedStatus] += 1;

      if (normalizedStatus !== 'completed') {
        const pendingAge = this.getHoursSince(row?.updated_at || row?.created_at);
        if (pendingAge !== null && pendingAge >= 24) {
          pendingOver24h += 1;
        }
      }

      const context = this.parseJsonObject(row?.context) || {};
      const isAccountsWorkflow = this.isAccountsWorkflow(row, context, normalizedModule);
      if (isAccountsWorkflow) {
        const accountsStatus = this.extractAccountsSyncStatus(context) || normalizedStatus || 'pending';
        accountsSyncTotal += 1;
        accountsSyncByStatus[accountsStatus] = (accountsSyncByStatus[accountsStatus] || 0) + 1;
        accountsSyncByModule[normalizedModule] = (accountsSyncByModule[normalizedModule] || 0) + 1;
        if (normalizedStatus !== 'completed') {
          accountsPending += 1;
        }
      }

      const actionExecutions =
        context && typeof context === 'object' && context.action_executions
          ? context.action_executions
          : {};
      const executionEntries = Object.entries(actionExecutions);

      for (const [actionId, execution] of executionEntries) {
        const executionStatus = String((execution as any)?.status || '').toLowerCase();
        if (executionStatus !== 'completed') {
          continue;
        }

        executedActionsTotal += 1;
        executedByAction[actionId] = (executedByAction[actionId] || 0) + 1;
        executedByModule[normalizedModule] = (executedByModule[normalizedModule] || 0) + 1;
        queueItemsWithExecutions.add(String(row?.workflow_key || ''));

        const operation = String((execution as any)?.result?.operation || '').toLowerCase();
        if (operation === 'already_applied' || operation.includes('reused')) {
          reusedOrIdempotentTotal += 1;
        }

        const hasOverrideSignal =
          actionId.toLowerCase().includes('override') ||
          operation.includes('override') ||
          this.normalizeText((execution as any)?.result?.overrideReason) !== null ||
          this.normalizeText((execution as any)?.result?.override_reason) !== null;
        if (hasOverrideSignal) {
          overrideActionsTotal += 1;
        }

        const executedAt = new Date(String((execution as any)?.executed_at || ''));
        const createdAt = new Date(String(row?.created_at || ''));
        if (!Number.isNaN(executedAt.getTime()) && !Number.isNaN(createdAt.getTime())) {
          const diffMs = executedAt.getTime() - createdAt.getTime();
          if (diffMs >= 0) {
            executionLatencyTotalHours += diffMs / (1000 * 60 * 60);
            executionLatencySamples += 1;
          }
        }
      }
    }

    const totalItems = workflowRows.length;
    const completedItems = queueByStatus.completed || 0;
    const acknowledgedItems = queueByStatus.acknowledged || 0;
    const pendingItems = queueByStatus.pending || 0;
    const moduleDrilldown = Object.entries(moduleStatusCounts)
      .map(([module, counts]) => ({
        module,
        totalItems: counts.total,
        pendingItems: counts.pending,
        acknowledgedItems: counts.acknowledged,
        completedItems: counts.completed,
        completionRatePercent: this.toPercent(counts.completed, counts.total),
        executedActionsTotal: executedByModule[module] || 0,
      }))
      .sort((a, b) => {
        if (b.totalItems !== a.totalItems) {
          return b.totalItems - a.totalItems;
        }
        return b.executedActionsTotal - a.executedActionsTotal;
      });
    const topActions = Object.entries(executedByAction)
      .map(([actionId, count]) => ({ actionId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      generatedAt: new Date().toISOString(),
      window: {
        days,
        since: sinceIso,
        until: untilIso,
      },
      filters: {
        module: normalizedModuleFilter,
        status: normalizedStatusFilter && normalizedStatusFilter !== 'all' ? normalizedStatusFilter : null,
        caseId: normalizedCaseIdFilter,
        dateFrom: sinceIso,
        dateTo: untilIso,
      },
      doctorQueue: {
        totalItems,
        pendingItems,
        acknowledgedItems,
        completedItems,
        byStatus: queueByStatus,
        byModule: queueByModule,
        moduleDrilldown,
        completionRatePercent: this.toPercent(completedItems, totalItems),
        pendingOlderThan24h: pendingOver24h,
      },
      accountsSync: {
        totalItems: accountsSyncTotal,
        pendingItems: accountsPending,
        byStatus: accountsSyncByStatus,
        byModule: accountsSyncByModule,
      },
      recommendationExecution: {
        executedActionsTotal,
        reusedOrIdempotentTotal,
        executedByAction,
        executedByModule,
        topActions,
      },
      cdssAdoption: {
        queueItemsWithExecutions: queueItemsWithExecutions.size,
        executionCoveragePercent: this.toPercent(queueItemsWithExecutions.size, totalItems),
        actionsPerQueueItemPercent: this.toPercent(executedActionsTotal, totalItems),
        overrideActionsTotal,
        averageTimeToExecutionHours:
          executionLatencySamples > 0 ? Math.round((executionLatencyTotalHours / executionLatencySamples) * 10) / 10 : 0,
      },
    };
  }

  async executeHivRecommendationAction(
    tenantDb: DataSource,
    user: { id: string; fullName?: string; firstName?: string; lastName?: string; email?: string; role?: string },
    payload: {
      itemId: string;
      itemType: string;
      sourceRecordId?: string | null;
      patientId?: string | null;
      enrollmentId?: string | null;
      actionId: string;
      actionType?: string | null;
      actionTitle?: string | null;
      actionPayload?: any;
      destinationRole?: string | null;
      destinationService?: string | null;
      destinationSpecialty?: string | null;
      destinationUserId?: string | null;
      destinationUserName?: string | null;
      destinationFacilityId?: string | null;
      destinationFacilityName?: string | null;
    },
    requestMeta?: { ipAddress?: string; userAgent?: string; sessionId?: string },
  ) {
    if (!this.normalizeText(payload?.itemId) || !this.normalizeText(payload?.actionId)) {
      throw new BadRequestException('itemId and actionId are required');
    }
    if (!this.normalizeText(payload?.enrollmentId)) {
      throw new BadRequestException('enrollmentId is required for HIV recommendation actions');
    }

    const enrollmentId = String(payload.enrollmentId);
    const actionId = String(payload.actionId);
    const actionPayload =
      payload?.actionPayload && typeof payload.actionPayload === 'object' ? payload.actionPayload : {};
    const resolvedPatientId =
      this.normalizeText(payload.patientId) || (await this.getEnrollmentPatientId(tenantDb, enrollmentId));
    const existingExecution = await this.getExistingRecommendationExecution(
      tenantDb,
      payload.itemId,
      actionId,
    );
    if (String(existingExecution?.status || '').toLowerCase() === 'completed') {
      return {
        ok: true,
        itemId: payload.itemId,
        actionId,
        idempotent: true,
        result: existingExecution?.result || { status: 'completed', operation: 'already_applied' },
      };
    }
    if (String(existingExecution?.status || '').toLowerCase() === 'in_progress') {
      throw new BadRequestException(`Action "${actionId}" is already in progress`);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString().split('T')[0];

    let result: any;

    if (actionId === 'eac-followup') {
      const existingSessions = await this.safeQuery(
        tenantDb,
        `
        SELECT id, session_number, session_date
        FROM hiv_eac_sessions
        WHERE enrollment_id = $1
          AND session_date = $2
          AND counselor_id = $3
          AND session_notes ILIKE '%nurse cross-module HIV recommendation bundle%'
        ORDER BY session_number DESC, session_date DESC
        LIMIT 1
        `,
        [enrollmentId, todayIso, user.id],
      );
      if (existingSessions[0]?.id) {
        result = {
          status: 'completed',
          operation: 'eac_session_reused',
          sessionId: existingSessions[0].id,
          sessionNumber: existingSessions[0].session_number,
          sessionDate: existingSessions[0].session_date,
        };
      } else {
        const latestSessions = await this.safeQuery(
          tenantDb,
          `
          SELECT session_number
          FROM hiv_eac_sessions
          WHERE enrollment_id = $1
          ORDER BY session_number DESC, session_date DESC
          LIMIT 1
          `,
          [enrollmentId],
        );
        const latestSessionNumber = Number(latestSessions[0]?.session_number || 0);
        const nextSessionNumber = latestSessionNumber + 1;
        const nextSessionDate = new Date(today);
        nextSessionDate.setDate(nextSessionDate.getDate() + 30);

        const createdSession = await this.hivService.createEacSession(
          {
            enrollmentId,
            sessionNumber: nextSessionNumber,
            sessionDate: todayIso,
            counselorId: user.id,
            counselorName: this.getUserDisplayName(user),
            adherenceBarriers: [],
            interventionsProvided: ['Nurse queue initiated EAC'],
            adherenceAssessmentMethod: 'nurse_queue',
            followUpActions: ['Schedule repeat viral load after EAC'],
            sessionOutcome: 'Completed',
            eacProgramStatus: 'Active',
            nextSessionDate: nextSessionDate.toISOString().split('T')[0],
            sessionNotes: 'EAC started from nurse cross-module HIV recommendation bundle.',
          },
          tenantDb,
        );

        result = {
          status: 'completed',
          operation: 'eac_session_created',
          sessionId: createdSession?.id || null,
          sessionNumber: createdSession?.session_number || nextSessionNumber,
          sessionDate: createdSession?.session_date || todayIso,
        };
      }
    } else if (actionId === 'repeat-vl-plan') {
      let nextVlDate = this.normalizeText(actionPayload?.next_vl_date);
      if (!nextVlDate) {
        const pathway = await this.hivService.getVlPathway(enrollmentId, tenantDb);
        nextVlDate = pathway?.nextVlDate || null;
      }
      if (!nextVlDate) {
        throw new BadRequestException('No next viral load date is available for this enrollment');
      }

      const schedule = await this.upsertHivMonitoringSchedule(
        tenantDb,
        enrollmentId,
        'viral_load',
        nextVlDate,
        this.buildHivMonitoringNote(actionId, payload.actionTitle),
      );

      result = {
        status: 'completed',
        operation: 'vl_monitoring_scheduled',
        scheduleId: schedule?.id || null,
        nextScheduledDate: schedule?.next_scheduled_date || nextVlDate,
      };
    } else if (actionId === 'regimen-counseling') {
      const regimenRequestId = this.extractRegimenRequestId({
        sourceRecordId: payload.sourceRecordId,
        itemId: payload.itemId,
      });
      if (!regimenRequestId) {
        throw new BadRequestException('Regimen counseling action requires a regimen change request context');
      }

      const currentRegimen = this.normalizeText(actionPayload?.current_regimen) || 'current regimen';
      const requestedRegimen = this.normalizeText(actionPayload?.requested_regimen) || 'requested regimen';
      const counselingNote =
        `Nurse counseling completed from cross-module queue for regimen transition ${currentRegimen} -> ${requestedRegimen} on ${todayIso}.`;

      const updatedRequest = await this.appendArvChangeApprovalNote(tenantDb, regimenRequestId, counselingNote);
      if (!updatedRequest) {
        throw new BadRequestException('Regimen change request not found for counseling action');
      }

      const adherenceEntry = await this.createHivAdherenceTrackingEntry(tenantDb, {
        enrollmentId,
        recordedBy: user.id,
        trackingDate: todayIso,
        interventions: ['Regimen switch counseling completed'],
        notes: counselingNote,
      });

      await this.hivService.logAuditAction(
        'regimen_counseling_completed',
        'Nurse completed regimen counseling from HIV recommendation bundle',
        enrollmentId,
        null,
        {
          requestId: regimenRequestId,
          currentRegimen,
          requestedRegimen,
          trackingId: adherenceEntry?.id || null,
        },
        user.id,
        this.getUserDisplayName(user),
        tenantDb,
      );

      result = {
        status: 'completed',
        operation: 'regimen_counseling_completed',
        requestId: regimenRequestId,
        adherenceTrackingId: adherenceEntry?.id || null,
      };
    } else if (actionId === 'visit-recording') {
      let regimenRequestId = this.extractRegimenRequestId({
        sourceRecordId: payload.sourceRecordId,
        itemId: payload.itemId,
      });

      if (!regimenRequestId) {
        const pendingRows = await tenantDb.query(
          `
          SELECT id
          FROM hiv_arv_change_requests
          WHERE enrollment_id = $1
            AND status = 'approved'
            AND COALESCE(visit_recorded, false) = false
          ORDER BY approval_date DESC NULLS LAST, request_date DESC, created_at DESC
          LIMIT 1
          `,
          [enrollmentId],
        );
        regimenRequestId = pendingRows[0]?.id || null;
      }

      if (!regimenRequestId) {
        throw new BadRequestException('No approved pending regimen change request found for visit preparation');
      }

      const requestRows = await tenantDb.query(
        `
        SELECT id, visit_recorded, requested_regimen_code, requested_regimen_name
        FROM hiv_arv_change_requests
        WHERE id = $1
        LIMIT 1
        `,
        [regimenRequestId],
      );
      const request = requestRows[0] || null;
      if (!request) {
        throw new BadRequestException('Regimen change request not found for visit preparation');
      }

      if (Boolean(request.visit_recorded)) {
        result = {
          status: 'completed',
          operation: 'visit_already_recorded',
          requestId: regimenRequestId,
        };
      } else {
        if (!resolvedPatientId) {
          throw new BadRequestException('Patient context is required to prepare HIV visit recording');
        }
        const prepNote =
          `Nurse confirmed visit-prep completion from cross-module queue on ${todayIso} for requested regimen ${request.requested_regimen_name || request.requested_regimen_code || 'N/A'}.`;

        await this.appendArvChangeApprovalNote(tenantDb, regimenRequestId, prepNote);
        const intakeDraft = await this.hivService.saveNurseIntake(
          {
            patientId: resolvedPatientId,
            intakeDate: todayIso,
            regimen: request.requested_regimen_name || request.requested_regimen_code || null,
            form: {
              source: 'nurse_cross_module_queue',
              bundleActionId: actionId,
              enrollmentId,
              regimenRequestId,
              requestedRegimenCode: request.requested_regimen_code || null,
              requestedRegimenName: request.requested_regimen_name || null,
              prepStatus: 'ready_for_clinical_visit_recording',
              preparedBy: this.getUserDisplayName(user),
              preparedAt: new Date().toISOString(),
            },
            vitals: {},
          },
          tenantDb,
          user.id,
        );
        await this.hivService.logAuditAction(
          'regimen_visit_preparation_completed',
          'Nurse marked regimen change visit preparation as complete from HIV recommendation bundle',
          enrollmentId,
          null,
          {
            requestId: regimenRequestId,
            requestedRegimenCode: request.requested_regimen_code || null,
            intakeDraftId: intakeDraft?.id || null,
          },
          user.id,
          this.getUserDisplayName(user),
          tenantDb,
        );

        result = {
          status: 'completed',
          operation: 'visit_preparation_completed',
          requestId: regimenRequestId,
          requestedRegimenCode: request.requested_regimen_code || null,
          intakeDraftId: intakeDraft?.id || null,
        };
      }
    } else if (actionId === 'regimen-safety-warnings') {
      let regimenRequestId = this.extractRegimenRequestId({
        sourceRecordId: payload.sourceRecordId,
        itemId: payload.itemId,
      });

      if (!regimenRequestId) {
        const pendingRows = await tenantDb.query(
          `
          SELECT id
          FROM hiv_arv_change_requests
          WHERE enrollment_id = $1
            AND status = 'approved'
          ORDER BY approval_date DESC NULLS LAST, request_date DESC, created_at DESC
          LIMIT 1
          `,
          [enrollmentId],
        );
        regimenRequestId = pendingRows[0]?.id || null;
      }

      if (!regimenRequestId) {
        throw new BadRequestException('No approved regimen change request found for safety review');
      }

      const warningItems = Array.isArray(actionPayload?.warnings)
        ? actionPayload.warnings
            .map((warning: any) => ({
              message: this.normalizeText(warning?.message),
              recommendedAction: this.normalizeText(warning?.recommendedAction),
            }))
            .filter((warning: any) => warning.message || warning.recommendedAction)
        : [];
      const warningSummary =
        warningItems.length > 0
          ? warningItems
              .map((warning: any, index: number) =>
                `${index + 1}. ${warning.message || 'Safety warning'}${warning.recommendedAction ? ` (recommended: ${warning.recommendedAction})` : ''}`,
              )
              .join(' | ')
          : 'No structured warning payload supplied by bundle.';
      const reviewNote = `Nurse safety warning review completed from cross-module queue on ${todayIso}. ${warningSummary}`;

      const updatedRequest = await this.appendArvChangeApprovalNote(tenantDb, regimenRequestId, reviewNote);
      if (!updatedRequest) {
        throw new BadRequestException('Regimen change request not found for safety warning review');
      }

      const alert = await this.upsertHivClinicalAlert(tenantDb, {
        enrollmentId,
        alertType: 'regimen_change_needed',
        severity: 'high',
        title: 'Regimen safety warning requires clinician confirmation',
        message:
          warningItems[0]?.message ||
          'Nurse queue identified regimen safety warnings that require clinician confirmation.',
        relatedData: {
          source: 'nurse_cross_module_queue',
          actionId,
          regimenRequestId,
          warningCount: warningItems.length,
          warnings: warningItems,
        },
      });

      await this.hivService.logAuditAction(
        'regimen_safety_warning_reviewed',
        'Nurse reviewed regimen safety warnings from HIV recommendation bundle',
        enrollmentId,
        null,
        {
          requestId: regimenRequestId,
          warningCount: warningItems.length,
          alertId: alert?.id || null,
          alertReused: alert?.reused ?? null,
        },
        user.id,
        this.getUserDisplayName(user),
        tenantDb,
      );

      result = {
        status: 'completed',
        operation: 'regimen_safety_warning_reviewed',
        requestId: regimenRequestId,
        warningCount: warningItems.length,
        alertId: alert?.id || null,
        alertReused: alert?.reused ?? null,
      };
    } else if (actionId === 'tb-interaction-review') {
      const tbMedications = Array.isArray(actionPayload?.tb_medications)
        ? actionPayload.tb_medications.filter((value: any) => this.normalizeText(value))
        : [];
      const referral = await this.createOrReuseHivReferral(tenantDb, {
        enrollmentId,
        referralType: 'T',
        referredBy: user.id,
        referredByName: this.getUserDisplayName(user),
        referredToFacility: payload.destinationFacilityName || 'TB/HIV clinic',
        referredToProvider: payload.destinationUserName || null,
        referralReason:
          'Nurse queue flagged HIV/TB regimen interaction review before regimen switch execution.',
        referralTypeDetails:
          tbMedications.length > 0
            ? `TB medications requiring review: ${tbMedications.join(', ')}`
            : 'TB interaction review from HIV recommendation bundle',
        referralPriority: 'high',
      });

      const alert = await this.upsertHivClinicalAlert(tenantDb, {
        enrollmentId,
        alertType: 'regimen_change_needed',
        severity: 'high',
        title: 'TB co-treatment interaction review pending',
        message:
          tbMedications.length > 0
            ? `TB co-treatment medications (${tbMedications.join(', ')}) require interaction review.`
            : 'TB co-treatment interaction review is required before final regimen execution.',
        relatedData: {
          source: 'nurse_cross_module_queue',
          actionId,
          referralId: referral?.id || null,
          tbMedications,
        },
      });

      await this.hivService.logAuditAction(
        'tb_interaction_review_escalated',
        'Nurse escalated HIV/TB interaction review from HIV recommendation bundle',
        enrollmentId,
        null,
        {
          referralId: referral?.id || null,
          referralReused: referral?.reused ?? false,
          alertId: alert?.id || null,
          alertReused: alert?.reused ?? null,
          tbMedications,
        },
        user.id,
        this.getUserDisplayName(user),
        tenantDb,
      );

      result = {
        status: 'completed',
        operation: referral?.reused ? 'tb_interaction_referral_reused' : 'tb_interaction_referral_created',
        referralId: referral?.id || null,
        referralStatus: referral?.referral_status || 'pending',
        referralReused: referral?.reused ?? false,
        alertId: alert?.id || null,
        alertReused: alert?.reused ?? null,
      };
    } else if (actionId === 'doctor-switch-review') {
      const referral = await this.createOrReuseHivReferral(tenantDb, {
        enrollmentId,
        referralType: 'H',
        referredBy: user.id,
        referredByName: this.getUserDisplayName(user),
        referredToFacility: payload.destinationFacilityName || 'HIV specialist clinic',
        referredToProvider: payload.destinationUserName || null,
        referralReason:
          'Nurse queue escalated persistent high viral load for clinician regimen-switch decision review.',
        referralTypeDetails: 'Post-EAC treatment-failure clinician review from HIV recommendation bundle',
        referralPriority: 'urgent',
      });

      const alert = await this.upsertHivClinicalAlert(tenantDb, {
        enrollmentId,
        alertType: 'treatment_failure',
        severity: 'critical',
        title: 'Treatment failure escalation awaiting doctor switch review',
        message:
          'Persistent high viral load after EAC has been escalated for urgent clinician regimen-switch review.',
        relatedData: {
          source: 'nurse_cross_module_queue',
          actionId,
          referralId: referral?.id || null,
        },
      });

      await this.hivService.logAuditAction(
        'doctor_switch_review_escalated',
        'Nurse escalated post-EAC regimen switch review from HIV recommendation bundle',
        enrollmentId,
        null,
        {
          referralId: referral?.id || null,
          referralReused: referral?.reused ?? false,
          alertId: alert?.id || null,
          alertReused: alert?.reused ?? null,
        },
        user.id,
        this.getUserDisplayName(user),
        tenantDb,
      );

      result = {
        status: 'completed',
        operation: referral?.reused ? 'doctor_switch_referral_reused' : 'doctor_switch_referral_created',
        referralId: referral?.id || null,
        referralStatus: referral?.referral_status || 'pending',
        referralReused: referral?.reused ?? false,
        alertId: alert?.id || null,
        alertReused: alert?.reused ?? null,
      };
    } else if (actionId === 'pediatric-dose-check' || actionId === 'pediatric-adherence') {
      const age = actionPayload?.age ?? null;
      const regimenCode =
        this.normalizeText(actionPayload?.requested_regimen_code) ||
        this.normalizeText(actionPayload?.current_regimen_code) ||
        null;
      const reviewNote =
        `Pediatric dose review acknowledged from cross-module queue on ${todayIso}` +
        `${age != null ? ` (age ${age})` : ''}` +
        `${regimenCode ? ` for regimen ${regimenCode}` : ''}.`;

      const adherenceEntry = await this.createHivAdherenceTrackingEntry(tenantDb, {
        enrollmentId,
        recordedBy: user.id,
        trackingDate: todayIso,
        interventions: ['Pediatric dose and caregiver adherence review completed'],
        notes: reviewNote,
      });

      await this.hivService.logAuditAction(
        'pediatric_dose_review_acknowledged',
        'Nurse acknowledged pediatric dose review from HIV recommendation bundle',
        enrollmentId,
        null,
        {
          age,
          regimenCode,
          trackingId: adherenceEntry?.id || null,
          actionId,
        },
        user.id,
        this.getUserDisplayName(user),
        tenantDb,
      );

      result = {
        status: 'completed',
        operation: 'pediatric_dose_review_acknowledged',
        adherenceTrackingId: adherenceEntry?.id || null,
        age,
        regimenCode,
      };
    } else if (actionId === 'pmtct-linkage' || payload?.actionType === 'pmtct_followup') {
      const referral = await this.createOrReuseHivReferral(tenantDb, {
        enrollmentId,
        referralType: 'P',
        referredBy: user.id,
        referredByName: this.getUserDisplayName(user),
        referredToFacility: payload.destinationFacilityName || 'ANC / PMTCT clinic',
        referredToProvider: payload.destinationUserName || null,
        referralReason:
          'Pregnancy-linked HIV follow-up requires PMTCT/ANC linkage confirmation from the nurse queue.',
        referralTypeDetails: 'PMTCT / ANC linkage from nurse HIV queue',
        referralPriority: 'urgent',
      });

      result = {
        status: 'completed',
        operation: referral?.reused ? 'existing_pmtct_referral_reused' : 'pmtct_referral_created',
        referralId: referral?.id || null,
        referralStatus: referral?.referral_status || 'pending',
        referralReused: referral?.reused ?? false,
      };
    } else {
      throw new BadRequestException(`Unsupported HIV recommendation action "${actionId}"`);
    }

    await this.persistRecommendationExecutionState(
      tenantDb,
      user,
      {
        itemId: payload.itemId,
        module: 'hiv',
        itemType: payload.itemType,
        sourceRecordId: payload.sourceRecordId || null,
        patientId: resolvedPatientId || null,
        enrollmentId,
        destinationRole: payload.destinationRole || null,
        destinationService: payload.destinationService || null,
        destinationSpecialty: payload.destinationSpecialty || null,
        destinationUserId: payload.destinationUserId || null,
        destinationFacilityId: payload.destinationFacilityId || null,
        destinationFacilityName: payload.destinationFacilityName || null,
        actionId,
        note: `${payload.actionTitle || actionId} executed from nurse cross-module escalation queue.`,
      },
      result,
    );

    await this.hipaaAuditService.logAuditEvent(tenantDb, {
      userId: user.id,
      userName: this.getUserDisplayName(user),
      userRole: user.role || 'nurse',
      action: HipaaAuditAction.NURSE_CROSS_MODULE_ACKNOWLEDGE,
      resourceType: 'nurse_cross_module_recommendation_action',
      resourceId: payload.itemId,
      patientId: resolvedPatientId || undefined,
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
      sessionId: requestMeta?.sessionId,
      outcome: 'success',
      metadata: {
        module: 'hiv',
        itemType: payload.itemType,
        actionId,
        actionTitle: payload.actionTitle || null,
        enrollmentId,
        result,
      },
      riskLevel: 'medium',
      timestamp: new Date(),
    });

    return {
      ok: true,
      itemId: payload.itemId,
      actionId,
      result,
    };
  }

  async executeOncologyRecommendationAction(
    tenantDb: DataSource,
    user: { id: string; fullName?: string; firstName?: string; lastName?: string; email?: string; role?: string },
    payload: {
      itemId: string;
      itemType: string;
      sourceRecordId?: string | null;
      patientId?: string | null;
      caseId?: string | null;
      actionId: string;
      actionType?: string | null;
      actionTitle?: string | null;
      actionPayload?: any;
      destinationRole?: string | null;
      destinationService?: string | null;
      destinationSpecialty?: string | null;
      destinationUserId?: string | null;
      destinationUserName?: string | null;
      destinationFacilityId?: string | null;
      destinationFacilityName?: string | null;
    },
    requestMeta?: { ipAddress?: string; userAgent?: string; sessionId?: string },
  ) {
    if (!this.normalizeText(payload?.itemId) || !this.normalizeText(payload?.actionId)) {
      throw new BadRequestException('itemId and actionId are required');
    }

    const actionId = String(payload.actionId);
    const actionPayload =
      payload?.actionPayload && typeof payload.actionPayload === 'object' ? payload.actionPayload : {};
    let resolvedCaseId = this.extractOncologyCaseId({
      caseId: payload.caseId,
      sourceRecordId: payload.sourceRecordId,
      itemId: payload.itemId,
      actionPayload,
    });
    let resolvedPatientId = this.normalizeText(payload.patientId);
    const existingExecution = await this.getExistingRecommendationExecution(
      tenantDb,
      payload.itemId,
      actionId,
    );
    if (String(existingExecution?.status || '').toLowerCase() === 'completed') {
      return {
        ok: true,
        itemId: payload.itemId,
        actionId,
        idempotent: true,
        result: existingExecution?.result || { status: 'completed', operation: 'already_applied' },
      };
    }
    if (String(existingExecution?.status || '').toLowerCase() === 'in_progress') {
      throw new BadRequestException(`Action "${actionId}" is already in progress`);
    }

    const timestampIso = new Date().toISOString();
    const resultMarker = `[nurse_queue_action:${actionId}]`;
    let result: any;

    if (actionId === 'prepare-infusion-checklist' || actionId === 'confirm-prechemo-lab-gate') {
      const sessionId =
        this.normalizeText(actionPayload?.session_id) ||
        (payload.itemType === 'oncology_infusion_followup' ? this.normalizeText(payload.sourceRecordId) : null);
      if (!sessionId) {
        throw new BadRequestException('session_id context is required for oncology infusion actions');
      }

      const noteLine = `${resultMarker} ${payload.actionTitle || actionId} completed by ${this.getUserDisplayName(user)} at ${timestampIso}.`;
      const sessionUpdate = await this.appendOncologyInfusionSessionNote(
        tenantDb,
        sessionId,
        resultMarker,
        noteLine,
      );

      resolvedCaseId = resolvedCaseId || this.normalizeText(sessionUpdate.session?.case_id);
      resolvedPatientId = resolvedPatientId || this.normalizeText(sessionUpdate.session?.patient_id);
      if (!resolvedPatientId && resolvedCaseId) {
        resolvedPatientId = await this.getOncologyCasePatientId(tenantDb, resolvedCaseId);
      }

      const paymentStatus = String(sessionUpdate.session?.payment_status || '').toLowerCase();
      const operation = actionId === 'prepare-infusion-checklist'
        ? sessionUpdate.reused
          ? 'infusion_checklist_note_reused'
          : 'infusion_checklist_documented'
        : sessionUpdate.reused
          ? 'prechemo_lab_gate_note_reused'
          : paymentStatus === 'awaiting_payment'
            ? 'prechemo_lab_gate_documented_payment_pending'
            : 'prechemo_lab_gate_documented';

      result = {
        status: 'completed',
        operation,
        sessionId: sessionId,
        regimenId: sessionUpdate.session?.regimen_id || null,
        caseId: resolvedCaseId || null,
        paymentStatus: sessionUpdate.session?.payment_status || null,
        noteReused: sessionUpdate.reused,
      };
    } else if (actionId === 'acknowledge-toxicity-followup') {
      const adverseEventId =
        this.normalizeText(actionPayload?.adverse_event_id) ||
        (payload.itemType === 'oncology_toxicity_followup' ? this.normalizeText(payload.sourceRecordId) : null);
      if (!adverseEventId) {
        throw new BadRequestException('adverse_event_id context is required for oncology toxicity actions');
      }

      const noteLine = `${resultMarker} ${payload.actionTitle || actionId} completed by ${this.getUserDisplayName(user)} at ${timestampIso}.`;
      const eventUpdate = await this.appendOncologyAdverseEventFollowup(
        tenantDb,
        adverseEventId,
        resultMarker,
        noteLine,
      );

      resolvedCaseId = resolvedCaseId || this.normalizeText(eventUpdate.event?.case_id);
      resolvedPatientId = resolvedPatientId || this.normalizeText(eventUpdate.event?.patient_id);
      if (!resolvedPatientId && resolvedCaseId) {
        resolvedPatientId = await this.getOncologyCasePatientId(tenantDb, resolvedCaseId);
      }

      result = {
        status: 'completed',
        operation: eventUpdate.reused
          ? 'toxicity_followup_reused'
          : 'toxicity_followup_documented',
        adverseEventId,
        caseId: resolvedCaseId || null,
        regimenId: eventUpdate.event?.regimen_id || null,
        noteReused: eventUpdate.reused,
      };
    } else if (
      actionId === 'escalate-oncology-doctor-review' ||
      actionId === 'escalate-toxicity-risk-review'
    ) {
      if (!resolvedCaseId) {
        const adverseEventId = this.normalizeText(actionPayload?.adverse_event_id);
        if (adverseEventId) {
          const adverseContext = await this.getOncologyAdverseEventContext(tenantDb, adverseEventId);
          resolvedCaseId = this.normalizeText(adverseContext?.case_id);
          resolvedPatientId = resolvedPatientId || this.normalizeText(adverseContext?.patient_id);
        }
      }
      if (!resolvedCaseId) {
        const sessionId = this.normalizeText(actionPayload?.session_id);
        if (sessionId) {
          const infusionContext = await this.getOncologyInfusionContext(tenantDb, sessionId);
          resolvedCaseId = this.normalizeText(infusionContext?.case_id);
          resolvedPatientId = resolvedPatientId || this.normalizeText(infusionContext?.patient_id);
        }
      }
      if (!resolvedCaseId) {
        throw new BadRequestException('caseId context is required for oncology escalation actions');
      }

      const caseNote = `${resultMarker} Oncology doctor synchronization requested by ${this.getUserDisplayName(user)} at ${timestampIso}.`;
      const caseUpdate = await this.appendOncologyCaseCarePlanNote(
        tenantDb,
        resolvedCaseId,
        resultMarker,
        caseNote,
      );
      resolvedPatientId = resolvedPatientId || this.normalizeText(caseUpdate.case?.patient_id);
      if (!resolvedPatientId) {
        resolvedPatientId = await this.getOncologyCasePatientId(tenantDb, resolvedCaseId);
      }

      result = {
        status: 'completed',
        operation: caseUpdate.reused
          ? 'oncology_doctor_sync_note_reused'
          : 'oncology_doctor_sync_documented',
        caseId: resolvedCaseId,
        noteReused: caseUpdate.reused,
      };
    } else {
      throw new BadRequestException(`Unsupported oncology recommendation action "${actionId}"`);
    }

    await this.persistRecommendationExecutionState(
      tenantDb,
      user,
      {
        itemId: payload.itemId,
        module: 'oncology',
        itemType: payload.itemType,
        sourceRecordId: payload.sourceRecordId || null,
        patientId: resolvedPatientId || null,
        enrollmentId: null,
        destinationRole: payload.destinationRole || null,
        destinationService: payload.destinationService || null,
        destinationSpecialty: payload.destinationSpecialty || null,
        destinationUserId: payload.destinationUserId || null,
        destinationFacilityId: payload.destinationFacilityId || null,
        destinationFacilityName: payload.destinationFacilityName || null,
        actionId,
        note: `${payload.actionTitle || actionId} executed from nurse cross-module escalation queue.`,
      },
      result,
    );

    await this.hipaaAuditService.logAuditEvent(tenantDb, {
      userId: user.id,
      userName: this.getUserDisplayName(user),
      userRole: user.role || 'nurse',
      action: HipaaAuditAction.NURSE_CROSS_MODULE_ACKNOWLEDGE,
      resourceType: 'nurse_cross_module_recommendation_action',
      resourceId: payload.itemId,
      patientId: resolvedPatientId || undefined,
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
      sessionId: requestMeta?.sessionId,
      outcome: 'success',
      metadata: {
        module: 'oncology',
        itemType: payload.itemType,
        actionId,
        actionTitle: payload.actionTitle || null,
        caseId: resolvedCaseId || null,
        result,
      },
      riskLevel: 'medium',
      timestamp: new Date(),
    });

    return {
      ok: true,
      itemId: payload.itemId,
      actionId,
      result,
    };
  }

  async executeCardiologyRecommendationAction(
    tenantDb: DataSource,
    user: { id: string; fullName?: string; firstName?: string; lastName?: string; email?: string; role?: string },
    payload: {
      itemId: string;
      itemType: string;
      sourceRecordId?: string | null;
      patientId?: string | null;
      encounterId?: string | null;
      actionId: string;
      actionType?: string | null;
      actionTitle?: string | null;
      actionPayload?: any;
      destinationRole?: string | null;
      destinationService?: string | null;
      destinationSpecialty?: string | null;
      destinationUserId?: string | null;
      destinationUserName?: string | null;
      destinationFacilityId?: string | null;
      destinationFacilityName?: string | null;
    },
    requestMeta?: { ipAddress?: string; userAgent?: string; sessionId?: string },
  ) {
    if (!this.normalizeText(payload?.itemId) || !this.normalizeText(payload?.actionId)) {
      throw new BadRequestException('itemId and actionId are required');
    }

    const actionId = String(payload.actionId);
    const actionPayload =
      payload?.actionPayload && typeof payload.actionPayload === 'object' ? payload.actionPayload : {};
    const resolvedEncounterId = this.extractCardiologyEncounterId({
      encounterId: payload.encounterId,
      sourceRecordId: payload.sourceRecordId,
      itemId: payload.itemId,
      actionPayload,
    });
    if (!resolvedEncounterId) {
      throw new BadRequestException('encounterId context is required for cardiology recommendation actions');
    }

    const existingExecution = await this.getExistingRecommendationExecution(
      tenantDb,
      payload.itemId,
      actionId,
    );
    if (String(existingExecution?.status || '').toLowerCase() === 'completed') {
      return {
        ok: true,
        itemId: payload.itemId,
        actionId,
        idempotent: true,
        result: existingExecution?.result || { status: 'completed', operation: 'already_applied' },
      };
    }
    if (String(existingExecution?.status || '').toLowerCase() === 'in_progress') {
      throw new BadRequestException(`Action "${actionId}" is already in progress`);
    }

    const timestampIso = new Date().toISOString();
    const resultMarker = `[nurse_queue_action:${actionId}]`;
    let result: any;

    if (actionId === 'prepare-cardiology-order-set') {
      const suggestedTests = Array.isArray(actionPayload?.suggested_tests)
        ? actionPayload.suggested_tests
            .map((value: any) => this.normalizeText(value))
            .filter((value: string | null): value is string => Boolean(value))
        : ['ECG', 'Troponin', 'Echocardiogram'];
      const update = await this.appendCardiologyDiagnosticOrderSet(
        tenantDb,
        resolvedEncounterId,
        resultMarker,
        actionId,
        suggestedTests,
      );
      const encounterPatientId = this.normalizeText(update.encounter?.patient_id);

      result = {
        status: 'completed',
        operation: update.reused ? 'cardiology_order_set_reused' : 'cardiology_order_set_prepared',
        encounterId: resolvedEncounterId,
        patientId: encounterPatientId,
        addedTests: update.addedTests,
        totalSuggestedTests: suggestedTests.length,
        noteReused: update.reused,
      };
    } else if (actionId === 'complete-cardiology-visit-prep') {
      const noteLine =
        `${resultMarker} ${payload.actionTitle || actionId} completed by ` +
        `${this.getUserDisplayName(user)} at ${timestampIso}.`;
      const update = await this.appendCardiologyEncounterTextNote(
        tenantDb,
        resolvedEncounterId,
        'follow_up_plan',
        resultMarker,
        noteLine,
      );
      const encounterPatientId = this.normalizeText(update.encounter?.patient_id);

      result = {
        status: 'completed',
        operation: update.reused ? 'cardiology_visit_prep_reused' : 'cardiology_visit_prep_completed',
        encounterId: resolvedEncounterId,
        patientId: encounterPatientId,
        noteReused: update.reused,
      };
    } else if (actionId === 'escalate-cardiology-doctor-sync') {
      const noteLine =
        `${resultMarker} Cardiology doctor synchronization requested by ` +
        `${this.getUserDisplayName(user)} at ${timestampIso}.`;
      const update = await this.appendCardiologyEncounterTextNote(
        tenantDb,
        resolvedEncounterId,
        'care_plan',
        resultMarker,
        noteLine,
      );
      const encounterPatientId = this.normalizeText(update.encounter?.patient_id);

      result = {
        status: 'completed',
        operation: update.reused
          ? 'cardiology_doctor_sync_reused'
          : 'cardiology_doctor_sync_documented',
        encounterId: resolvedEncounterId,
        patientId: encounterPatientId,
        noteReused: update.reused,
      };
    } else {
      throw new BadRequestException(`Unsupported cardiology recommendation action "${actionId}"`);
    }

    const resolvedPatientId = this.normalizeText(payload.patientId) || this.normalizeText(result?.patientId);

    await this.persistRecommendationExecutionState(
      tenantDb,
      user,
      {
        itemId: payload.itemId,
        module: 'cardiology',
        itemType: payload.itemType,
        sourceRecordId: payload.sourceRecordId || resolvedEncounterId || null,
        patientId: resolvedPatientId || null,
        enrollmentId: null,
        destinationRole: payload.destinationRole || null,
        destinationService: payload.destinationService || null,
        destinationSpecialty: payload.destinationSpecialty || null,
        destinationUserId: payload.destinationUserId || null,
        destinationFacilityId: payload.destinationFacilityId || null,
        destinationFacilityName: payload.destinationFacilityName || null,
        actionId,
        note: `${payload.actionTitle || actionId} executed from nurse cross-module escalation queue.`,
      },
      result,
    );

    await this.hipaaAuditService.logAuditEvent(tenantDb, {
      userId: user.id,
      userName: this.getUserDisplayName(user),
      userRole: user.role || 'nurse',
      action: HipaaAuditAction.NURSE_CROSS_MODULE_ACKNOWLEDGE,
      resourceType: 'nurse_cross_module_recommendation_action',
      resourceId: payload.itemId,
      patientId: resolvedPatientId || undefined,
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
      sessionId: requestMeta?.sessionId,
      outcome: 'success',
      metadata: {
        module: 'cardiology',
        itemType: payload.itemType,
        actionId,
        actionTitle: payload.actionTitle || null,
        encounterId: resolvedEncounterId,
        result,
      },
      riskLevel: 'medium',
      timestamp: new Date(),
    });

    return {
      ok: true,
      itemId: payload.itemId,
      actionId,
      result,
    };
  }

  async executeEdRecommendationAction(
    tenantDb: DataSource,
    user: { id: string; fullName?: string; firstName?: string; lastName?: string; email?: string; role?: string },
    payload: {
      itemId: string;
      itemType: string;
      sourceRecordId?: string | null;
      patientId?: string | null;
      visitId?: string | null;
      actionId: string;
      actionType?: string | null;
      actionTitle?: string | null;
      actionPayload?: any;
      destinationRole?: string | null;
      destinationService?: string | null;
      destinationSpecialty?: string | null;
      destinationUserId?: string | null;
      destinationUserName?: string | null;
      destinationFacilityId?: string | null;
      destinationFacilityName?: string | null;
    },
    requestMeta?: { ipAddress?: string; userAgent?: string; sessionId?: string },
  ) {
    if (!this.normalizeText(payload?.itemId) || !this.normalizeText(payload?.actionId)) {
      throw new BadRequestException('itemId and actionId are required');
    }

    const actionId = String(payload.actionId);
    const actionPayload =
      payload?.actionPayload && typeof payload.actionPayload === 'object' ? payload.actionPayload : {};
    const resolvedVisitId = this.extractEdVisitId({
      visitId: payload.visitId,
      sourceRecordId: payload.sourceRecordId,
      itemId: payload.itemId,
      actionPayload,
    });
    if (!resolvedVisitId) {
      throw new BadRequestException('visitId context is required for ED recommendation actions');
    }

    const existingExecution = await this.getExistingRecommendationExecution(tenantDb, payload.itemId, actionId);
    if (String(existingExecution?.status || '').toLowerCase() === 'completed') {
      return {
        ok: true,
        itemId: payload.itemId,
        actionId,
        idempotent: true,
        result: existingExecution?.result || { status: 'completed', operation: 'already_applied' },
      };
    }
    if (String(existingExecution?.status || '').toLowerCase() === 'in_progress') {
      throw new BadRequestException(`Action "${actionId}" is already in progress`);
    }

    const timestampIso = new Date().toISOString();
    const resultMarker = `[nurse_queue_action:${actionId}]`;
    let result: any;

    if (actionId === 'prepare-ed-order-set') {
      const suggestedOrders = Array.isArray(actionPayload?.suggested_orders)
        ? actionPayload.suggested_orders
            .map((value: any) => this.normalizeText(value))
            .filter((value: string | null): value is string => Boolean(value))
        : ['STAT clinician reassessment', 'ECG', 'CBC', 'CMP', 'Point-of-care lactate'];

      const noteLine =
        `${resultMarker} ${payload.actionTitle || actionId} executed by ` +
        `${this.getUserDisplayName(user)} at ${timestampIso}.`;
      const update = await this.appendEdVisitOrderSetMarker(
        tenantDb,
        resolvedVisitId,
        resultMarker,
        actionId,
        noteLine,
        suggestedOrders,
      );
      const visitPatientId = this.normalizeText(update.visit?.patient_id);

      result = {
        status: 'completed',
        operation: update.reused ? 'ed_order_set_reused' : 'ed_order_set_prepared',
        visitId: resolvedVisitId,
        patientId: visitPatientId,
        addedOrders: update.addedOrders || [],
        noteReused: update.reused,
      };
    } else if (actionId === 'complete-ed-disposition-prep') {
      const noteLine =
        `${resultMarker} ${payload.actionTitle || actionId} completed by ` +
        `${this.getUserDisplayName(user)} at ${timestampIso}.`;
      const update = await this.appendEdVisitTextNote(
        tenantDb,
        resolvedVisitId,
        'follow_up_instructions',
        resultMarker,
        noteLine,
      );
      const visitPatientId = this.normalizeText(update.visit?.patient_id);

      result = {
        status: 'completed',
        operation: update.reused ? 'ed_disposition_prep_reused' : 'ed_disposition_prep_completed',
        visitId: resolvedVisitId,
        patientId: visitPatientId,
        noteReused: update.reused,
      };
    } else if (actionId === 'escalate-ed-doctor-sync') {
      const noteLine =
        `${resultMarker} ED doctor synchronization requested by ` +
        `${this.getUserDisplayName(user)} at ${timestampIso}.`;
      const update = await this.appendEdVisitTextNote(
        tenantDb,
        resolvedVisitId,
        'notes',
        resultMarker,
        noteLine,
      );
      const visitPatientId = this.normalizeText(update.visit?.patient_id);

      result = {
        status: 'completed',
        operation: update.reused ? 'ed_doctor_sync_reused' : 'ed_doctor_sync_documented',
        visitId: resolvedVisitId,
        patientId: visitPatientId,
        noteReused: update.reused,
      };
    } else {
      throw new BadRequestException(`Unsupported ED recommendation action "${actionId}"`);
    }

    const resolvedPatientId = this.normalizeText(payload.patientId) || this.normalizeText(result?.patientId);

    await this.persistRecommendationExecutionState(
      tenantDb,
      user,
      {
        itemId: payload.itemId,
        module: 'ed',
        itemType: payload.itemType,
        sourceRecordId: payload.sourceRecordId || resolvedVisitId || null,
        patientId: resolvedPatientId || null,
        enrollmentId: null,
        destinationRole: payload.destinationRole || null,
        destinationService: payload.destinationService || null,
        destinationSpecialty: payload.destinationSpecialty || null,
        destinationUserId: payload.destinationUserId || null,
        destinationFacilityId: payload.destinationFacilityId || null,
        destinationFacilityName: payload.destinationFacilityName || null,
        actionId,
        note: `${payload.actionTitle || actionId} executed from nurse cross-module escalation queue.`,
      },
      result,
    );

    await this.hipaaAuditService.logAuditEvent(tenantDb, {
      userId: user.id,
      userName: this.getUserDisplayName(user),
      userRole: user.role || 'nurse',
      action: HipaaAuditAction.NURSE_CROSS_MODULE_ACKNOWLEDGE,
      resourceType: 'nurse_cross_module_recommendation_action',
      resourceId: payload.itemId,
      patientId: resolvedPatientId || undefined,
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
      sessionId: requestMeta?.sessionId,
      outcome: 'success',
      metadata: {
        module: 'ed',
        itemType: payload.itemType,
        actionId,
        actionTitle: payload.actionTitle || null,
        visitId: resolvedVisitId,
        result,
      },
      riskLevel: 'medium',
      timestamp: new Date(),
    });

    return {
      ok: true,
      itemId: payload.itemId,
      actionId,
      result,
    };
  }

  async executeSepsisRecommendationAction(
    tenantDb: DataSource,
    user: { id: string; fullName?: string; firstName?: string; lastName?: string; email?: string; role?: string },
    payload: {
      itemId: string;
      itemType: string;
      sourceRecordId?: string | null;
      patientId?: string | null;
      bundleId?: string | null;
      actionId: string;
      actionType?: string | null;
      actionTitle?: string | null;
      actionPayload?: any;
      destinationRole?: string | null;
      destinationService?: string | null;
      destinationSpecialty?: string | null;
      destinationUserId?: string | null;
      destinationUserName?: string | null;
      destinationFacilityId?: string | null;
      destinationFacilityName?: string | null;
    },
    requestMeta?: { ipAddress?: string; userAgent?: string; sessionId?: string },
  ) {
    if (!this.normalizeText(payload?.itemId) || !this.normalizeText(payload?.actionId)) {
      throw new BadRequestException('itemId and actionId are required');
    }

    const actionId = String(payload.actionId);
    const actionPayload =
      payload?.actionPayload && typeof payload.actionPayload === 'object' ? payload.actionPayload : {};
    const resolvedBundleId = this.extractSepsisBundleId({
      bundleId: payload.bundleId,
      sourceRecordId: payload.sourceRecordId,
      itemId: payload.itemId,
      actionPayload,
    });
    if (!resolvedBundleId) {
      throw new BadRequestException('bundleId context is required for sepsis recommendation actions');
    }

    const existingExecution = await this.getExistingRecommendationExecution(tenantDb, payload.itemId, actionId);
    if (String(existingExecution?.status || '').toLowerCase() === 'completed') {
      return {
        ok: true,
        itemId: payload.itemId,
        actionId,
        idempotent: true,
        result: existingExecution?.result || { status: 'completed', operation: 'already_applied' },
      };
    }
    if (String(existingExecution?.status || '').toLowerCase() === 'in_progress') {
      throw new BadRequestException(`Action "${actionId}" is already in progress`);
    }

    const timestampIso = new Date().toISOString();
    const resultMarker = `[nurse_queue_action:${actionId}]`;
    let result: any;

    if (actionId === 'queue-sepsis-three-hour-bundle') {
      const noteLine =
        `${resultMarker} ${payload.actionTitle || actionId} queued by ` +
        `${this.getUserDisplayName(user)} at ${timestampIso}.`;
      const update = await this.appendSepsisBundleNote(tenantDb, resolvedBundleId, resultMarker, noteLine);
      const bundlePatientId = this.normalizeText(update.bundle?.patient_id);

      result = {
        status: 'completed',
        operation: update.reused ? 'sepsis_three_hour_bundle_reused' : 'sepsis_three_hour_bundle_queued',
        bundleId: resolvedBundleId,
        patientId: bundlePatientId,
        noteReused: update.reused,
      };
    } else if (actionId === 'confirm-repeat-lactate-plan') {
      const noteLine =
        `${resultMarker} ${payload.actionTitle || actionId} confirmed by ` +
        `${this.getUserDisplayName(user)} at ${timestampIso}.`;
      const update = await this.appendSepsisBundleNote(tenantDb, resolvedBundleId, resultMarker, noteLine);
      const bundlePatientId = this.normalizeText(update.bundle?.patient_id);

      result = {
        status: 'completed',
        operation: update.reused ? 'sepsis_repeat_lactate_plan_reused' : 'sepsis_repeat_lactate_plan_confirmed',
        bundleId: resolvedBundleId,
        patientId: bundlePatientId,
        noteReused: update.reused,
      };
    } else if (actionId === 'escalate-sepsis-doctor-sync') {
      const noteLine =
        `${resultMarker} Sepsis doctor synchronization requested by ` +
        `${this.getUserDisplayName(user)} at ${timestampIso}.`;
      const update = await this.appendSepsisBundleNote(tenantDb, resolvedBundleId, resultMarker, noteLine);
      const bundlePatientId = this.normalizeText(update.bundle?.patient_id);

      result = {
        status: 'completed',
        operation: update.reused ? 'sepsis_doctor_sync_reused' : 'sepsis_doctor_sync_documented',
        bundleId: resolvedBundleId,
        patientId: bundlePatientId,
        noteReused: update.reused,
      };
    } else {
      throw new BadRequestException(`Unsupported sepsis recommendation action "${actionId}"`);
    }

    const resolvedPatientId = this.normalizeText(payload.patientId) || this.normalizeText(result?.patientId);

    await this.persistRecommendationExecutionState(
      tenantDb,
      user,
      {
        itemId: payload.itemId,
        module: 'sepsis',
        itemType: payload.itemType,
        sourceRecordId: payload.sourceRecordId || resolvedBundleId || null,
        patientId: resolvedPatientId || null,
        enrollmentId: null,
        destinationRole: payload.destinationRole || null,
        destinationService: payload.destinationService || null,
        destinationSpecialty: payload.destinationSpecialty || null,
        destinationUserId: payload.destinationUserId || null,
        destinationFacilityId: payload.destinationFacilityId || null,
        destinationFacilityName: payload.destinationFacilityName || null,
        actionId,
        note: `${payload.actionTitle || actionId} executed from nurse cross-module escalation queue.`,
      },
      result,
    );

    await this.hipaaAuditService.logAuditEvent(tenantDb, {
      userId: user.id,
      userName: this.getUserDisplayName(user),
      userRole: user.role || 'nurse',
      action: HipaaAuditAction.NURSE_CROSS_MODULE_ACKNOWLEDGE,
      resourceType: 'nurse_cross_module_recommendation_action',
      resourceId: payload.itemId,
      patientId: resolvedPatientId || undefined,
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
      sessionId: requestMeta?.sessionId,
      outcome: 'success',
      metadata: {
        module: 'sepsis',
        itemType: payload.itemType,
        actionId,
        actionTitle: payload.actionTitle || null,
        bundleId: resolvedBundleId,
        result,
      },
      riskLevel: 'medium',
      timestamp: new Date(),
    });

    return {
      ok: true,
      itemId: payload.itemId,
      actionId,
      result,
    };
  }

  async executeBloodBankRecommendationAction(
    tenantDb: DataSource,
    user: { id: string; fullName?: string; firstName?: string; lastName?: string; email?: string; role?: string },
    payload: {
      itemId: string;
      itemType: string;
      sourceRecordId?: string | null;
      patientId?: string | null;
      transfusionId?: string | null;
      actionId: string;
      actionType?: string | null;
      actionTitle?: string | null;
      actionPayload?: any;
      destinationRole?: string | null;
      destinationService?: string | null;
      destinationSpecialty?: string | null;
      destinationUserId?: string | null;
      destinationUserName?: string | null;
      destinationFacilityId?: string | null;
      destinationFacilityName?: string | null;
    },
    requestMeta?: { ipAddress?: string; userAgent?: string; sessionId?: string },
  ) {
    if (!this.normalizeText(payload?.itemId) || !this.normalizeText(payload?.actionId)) {
      throw new BadRequestException('itemId and actionId are required');
    }

    const actionId = String(payload.actionId);
    const actionPayload =
      payload?.actionPayload && typeof payload.actionPayload === 'object' ? payload.actionPayload : {};
    const resolvedTransfusionId = this.extractBloodBankTransfusionId({
      transfusionId: payload.transfusionId,
      sourceRecordId: payload.sourceRecordId,
      itemId: payload.itemId,
      actionPayload,
    });
    if (!resolvedTransfusionId) {
      throw new BadRequestException('transfusionId context is required for blood-bank recommendation actions');
    }

    const existingExecution = await this.getExistingRecommendationExecution(tenantDb, payload.itemId, actionId);
    if (String(existingExecution?.status || '').toLowerCase() === 'completed') {
      return {
        ok: true,
        itemId: payload.itemId,
        actionId,
        idempotent: true,
        result: existingExecution?.result || { status: 'completed', operation: 'already_applied' },
      };
    }
    if (String(existingExecution?.status || '').toLowerCase() === 'in_progress') {
      throw new BadRequestException(`Action "${actionId}" is already in progress`);
    }

    const timestampIso = new Date().toISOString();
    const resultMarker = `[nurse_queue_action:${actionId}]`;
    const actorName = this.getUserDisplayName(user);
    let result: any;

    if (actionId === 'confirm-crossmatch-consent') {
      const noteLine =
        `${resultMarker} Compatibility and consent checkpoint confirmed by ` +
        `${actorName} at ${timestampIso}.`;
      const update = await this.appendBloodBankTransfusionNote(
        tenantDb,
        resolvedTransfusionId,
        resultMarker,
        noteLine,
      );

      let consentUpdated = false;
      if (!Boolean(update.transfusion?.consent_obtained)) {
        await tenantDb.query(
          `
          UPDATE blood_transfusions
          SET
            consent_obtained = true,
            consent_obtained_by = COALESCE(consent_obtained_by, $2),
            updated_at = NOW()
          WHERE id = $1
          `,
          [resolvedTransfusionId, user.id],
        );
        consentUpdated = true;
      }

      result = {
        status: 'completed',
        operation: consentUpdated ? 'transfusion_consent_confirmed' : 'transfusion_consent_already_confirmed',
        transfusionId: resolvedTransfusionId,
        patientId: update.transfusion?.patient_id || null,
        noteReused: update.reused,
      };
    } else if (actionId === 'start-transfusion-monitoring') {
      const noteLine =
        `${resultMarker} Transfusion monitoring initiated by ${actorName} at ${timestampIso}.`;
      const update = await this.appendBloodBankTransfusionNote(
        tenantDb,
        resolvedTransfusionId,
        resultMarker,
        noteLine,
      );
      const status = String(update.transfusion?.transfusion_status || '').toLowerCase();

      let statusUpdated = false;
      if (status === 'ordered') {
        await tenantDb.query(
          `
          UPDATE blood_transfusions
          SET
            transfusion_status = 'in_progress',
            start_time = COALESCE(start_time, NOW()),
            administered_by = COALESCE(administered_by, $2),
            monitored_by = COALESCE(monitored_by, $2),
            updated_at = NOW()
          WHERE id = $1
          `,
          [resolvedTransfusionId, user.id],
        );
        statusUpdated = true;
      }

      result = {
        status: 'completed',
        operation: statusUpdated ? 'transfusion_monitoring_started' : 'transfusion_monitoring_already_started',
        transfusionId: resolvedTransfusionId,
        patientId: update.transfusion?.patient_id || null,
        noteReused: update.reused,
      };
    } else if (actionId === 'complete-transfusion-checklist') {
      const noteLine =
        `${resultMarker} Transfusion completion checklist documented by ${actorName} at ${timestampIso}.`;
      const update = await this.appendBloodBankTransfusionNote(
        tenantDb,
        resolvedTransfusionId,
        resultMarker,
        noteLine,
      );
      const status = String(update.transfusion?.transfusion_status || '').toLowerCase();

      let completionUpdated = false;
      if (status !== 'completed') {
        await tenantDb.query(
          `
          UPDATE blood_transfusions
          SET
            transfusion_status = 'completed',
            end_time = COALESCE(end_time, NOW()),
            completion_notes = trim(
              BOTH
              FROM (
                COALESCE(completion_notes, '') ||
                CASE WHEN COALESCE(completion_notes, '') = '' THEN '' ELSE E'\n' END ||
                $2
              )
            ),
            updated_at = NOW()
          WHERE id = $1
          `,
          [resolvedTransfusionId, noteLine],
        );
        completionUpdated = true;
      }

      result = {
        status: 'completed',
        operation: completionUpdated ? 'transfusion_completion_documented' : 'transfusion_completion_already_documented',
        transfusionId: resolvedTransfusionId,
        patientId: update.transfusion?.patient_id || null,
        noteReused: update.reused,
      };
    } else if (actionId === 'document-transfusion-reaction-escalation') {
      const noteLine =
        `${resultMarker} Reaction escalation logged by ${actorName} at ${timestampIso}.`;
      const update = await this.appendBloodBankTransfusionNote(
        tenantDb,
        resolvedTransfusionId,
        resultMarker,
        noteLine,
      );
      const reactionType = this.normalizeText(actionPayload?.reaction_type) || update.transfusion?.reaction_type || 'Suspected reaction';
      const reactionSeverity =
        this.normalizeText(actionPayload?.reaction_severity) || update.transfusion?.reaction_severity || 'high';
      const reactionManagement =
        this.normalizeText(actionPayload?.reaction_management) ||
        `Escalated from nurse queue by ${actorName}. Immediate clinician review requested.`;

      await tenantDb.query(
        `
        UPDATE blood_transfusions
        SET
          transfusion_reaction = true,
          reaction_type = COALESCE(reaction_type, $2),
          reaction_severity = COALESCE(reaction_severity, $3),
          reaction_time = COALESCE(reaction_time, NOW()),
          reaction_management = trim(
            BOTH
            FROM (
              COALESCE(reaction_management, '') ||
              CASE WHEN COALESCE(reaction_management, '') = '' THEN '' ELSE E'\n' END ||
              $4
            )
          ),
          monitored_by = COALESCE(monitored_by, $5),
          updated_at = NOW()
        WHERE id = $1
        `,
        [resolvedTransfusionId, reactionType, reactionSeverity, reactionManagement, user.id],
      );

      result = {
        status: 'completed',
        operation: 'transfusion_reaction_escalated',
        transfusionId: resolvedTransfusionId,
        patientId: update.transfusion?.patient_id || null,
        reactionType,
        reactionSeverity,
        noteReused: update.reused,
      };
    } else {
      throw new BadRequestException(`Unsupported blood-bank recommendation action "${actionId}"`);
    }

    const resolvedPatientId = this.normalizeText(payload.patientId) || this.normalizeText(result?.patientId);

    await this.persistRecommendationExecutionState(
      tenantDb,
      user,
      {
        itemId: payload.itemId,
        module: 'blood_bank',
        itemType: payload.itemType,
        sourceRecordId: payload.sourceRecordId || resolvedTransfusionId || null,
        patientId: resolvedPatientId || null,
        enrollmentId: null,
        destinationRole: payload.destinationRole || null,
        destinationService: payload.destinationService || 'blood_bank',
        destinationSpecialty: payload.destinationSpecialty || null,
        destinationUserId: payload.destinationUserId || null,
        destinationFacilityId: payload.destinationFacilityId || null,
        destinationFacilityName: payload.destinationFacilityName || null,
        actionId,
        note: `${payload.actionTitle || actionId} executed from nurse cross-module escalation queue.`,
      },
      result,
    );

    await this.hipaaAuditService.logAuditEvent(tenantDb, {
      userId: user.id,
      userName: this.getUserDisplayName(user),
      userRole: user.role || 'nurse',
      action: HipaaAuditAction.NURSE_CROSS_MODULE_ACKNOWLEDGE,
      resourceType: 'nurse_cross_module_recommendation_action',
      resourceId: payload.itemId,
      patientId: resolvedPatientId || undefined,
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
      sessionId: requestMeta?.sessionId,
      outcome: 'success',
      metadata: {
        module: 'blood_bank',
        itemType: payload.itemType,
        actionId,
        actionTitle: payload.actionTitle || null,
        transfusionId: resolvedTransfusionId,
        result,
      },
      riskLevel: 'medium',
      timestamp: new Date(),
    });

    return {
      ok: true,
      itemId: payload.itemId,
      actionId,
      result,
    };
  }

  async executeOphthalmologyRecommendationAction(
    tenantDb: DataSource,
    user: { id: string; fullName?: string; firstName?: string; lastName?: string; email?: string; role?: string },
    payload: {
      itemId: string;
      itemType: string;
      sourceRecordId?: string | null;
      patientId?: string | null;
      encounterId?: string | null;
      actionId: string;
      actionType?: string | null;
      actionTitle?: string | null;
      actionPayload?: any;
      destinationRole?: string | null;
      destinationService?: string | null;
      destinationSpecialty?: string | null;
      destinationUserId?: string | null;
      destinationUserName?: string | null;
      destinationFacilityId?: string | null;
      destinationFacilityName?: string | null;
    },
    requestMeta?: { ipAddress?: string; userAgent?: string; sessionId?: string },
  ) {
    if (!this.normalizeText(payload?.itemId) || !this.normalizeText(payload?.actionId)) {
      throw new BadRequestException('itemId and actionId are required');
    }

    const actionId = String(payload.actionId);
    const actionPayload =
      payload?.actionPayload && typeof payload.actionPayload === 'object' ? payload.actionPayload : {};
    const resolvedEncounterId = this.extractOphthalmologyEncounterId({
      encounterId: payload.encounterId,
      sourceRecordId: payload.sourceRecordId,
      itemId: payload.itemId,
      actionPayload,
    });
    if (!resolvedEncounterId) {
      throw new BadRequestException('encounterId context is required for ophthalmology recommendation actions');
    }

    const existingExecution = await this.getExistingRecommendationExecution(tenantDb, payload.itemId, actionId);
    if (String(existingExecution?.status || '').toLowerCase() === 'completed') {
      return {
        ok: true,
        itemId: payload.itemId,
        actionId,
        idempotent: true,
        result: existingExecution?.result || { status: 'completed', operation: 'already_applied' },
      };
    }
    if (String(existingExecution?.status || '').toLowerCase() === 'in_progress') {
      throw new BadRequestException(`Action "${actionId}" is already in progress`);
    }

    const timestampIso = new Date().toISOString();
    const resultMarker = `[nurse_queue_action:${actionId}]`;
    const actorName = this.getUserDisplayName(user);
    let result: any;

    if (actionId === 'prepare-ophthalmology-order-set') {
      const suggestedOrders = Array.isArray(actionPayload?.suggested_orders)
        ? actionPayload.suggested_orders
            .map((value: any) => this.normalizeText(value))
            .filter((value: string | null): value is string => Boolean(value))
        : ['Visual acuity reassessment', 'Intraocular pressure check', 'Retinal/OCT review'];
      const noteLine =
        `${resultMarker} ${payload.actionTitle || actionId} executed by ${actorName} ` +
        `at ${timestampIso}. Suggested orders: ${suggestedOrders.join(', ')}.`;
      const update = await this.appendOphthalmologyEncounterTextNote(
        tenantDb,
        resolvedEncounterId,
        'assessment',
        resultMarker,
        noteLine,
      );

      result = {
        status: 'completed',
        operation: update.reused ? 'ophthalmology_order_set_reused' : 'ophthalmology_order_set_prepared',
        encounterId: resolvedEncounterId,
        patientId: update.encounter?.patient_id || null,
        suggestedOrders,
        noteReused: update.reused,
      };
    } else if (actionId === 'complete-ophthalmology-visit-prep') {
      const noteLine =
        `${resultMarker} ${payload.actionTitle || actionId} completed by ` +
        `${actorName} at ${timestampIso}.`;
      const update = await this.appendOphthalmologyEncounterTextNote(
        tenantDb,
        resolvedEncounterId,
        'plan',
        resultMarker,
        noteLine,
      );

      result = {
        status: 'completed',
        operation: update.reused ? 'ophthalmology_visit_prep_reused' : 'ophthalmology_visit_prep_completed',
        encounterId: resolvedEncounterId,
        patientId: update.encounter?.patient_id || null,
        noteReused: update.reused,
      };
    } else if (actionId === 'escalate-ophthalmology-doctor-sync') {
      const noteLine =
        `${resultMarker} Ophthalmology doctor synchronization requested by ` +
        `${actorName} at ${timestampIso}.`;
      const update = await this.appendOphthalmologyEncounterTextNote(
        tenantDb,
        resolvedEncounterId,
        'plan',
        resultMarker,
        noteLine,
      );

      result = {
        status: 'completed',
        operation: update.reused ? 'ophthalmology_doctor_sync_reused' : 'ophthalmology_doctor_sync_documented',
        encounterId: resolvedEncounterId,
        patientId: update.encounter?.patient_id || null,
        noteReused: update.reused,
      };
    } else {
      throw new BadRequestException(`Unsupported ophthalmology recommendation action "${actionId}"`);
    }

    const resolvedPatientId = this.normalizeText(payload.patientId) || this.normalizeText(result?.patientId);

    await this.persistRecommendationExecutionState(
      tenantDb,
      user,
      {
        itemId: payload.itemId,
        module: 'ophthalmology',
        itemType: payload.itemType,
        sourceRecordId: payload.sourceRecordId || resolvedEncounterId || null,
        patientId: resolvedPatientId || null,
        enrollmentId: null,
        destinationRole: payload.destinationRole || null,
        destinationService: payload.destinationService || null,
        destinationSpecialty: payload.destinationSpecialty || null,
        destinationUserId: payload.destinationUserId || null,
        destinationFacilityId: payload.destinationFacilityId || null,
        destinationFacilityName: payload.destinationFacilityName || null,
        actionId,
        note: `${payload.actionTitle || actionId} executed from nurse cross-module escalation queue.`,
      },
      result,
    );

    await this.hipaaAuditService.logAuditEvent(tenantDb, {
      userId: user.id,
      userName: this.getUserDisplayName(user),
      userRole: user.role || 'nurse',
      action: HipaaAuditAction.NURSE_CROSS_MODULE_ACKNOWLEDGE,
      resourceType: 'nurse_cross_module_recommendation_action',
      resourceId: payload.itemId,
      patientId: resolvedPatientId || undefined,
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
      sessionId: requestMeta?.sessionId,
      outcome: 'success',
      metadata: {
        module: 'ophthalmology',
        itemType: payload.itemType,
        actionId,
        actionTitle: payload.actionTitle || null,
        encounterId: resolvedEncounterId,
        result,
      },
      riskLevel: 'medium',
      timestamp: new Date(),
    });

    return {
      ok: true,
      itemId: payload.itemId,
      actionId,
      result,
    };
  }

  async executeTelemedicineRecommendationAction(
    tenantDb: DataSource,
    user: { id: string; fullName?: string; firstName?: string; lastName?: string; email?: string; role?: string },
    payload: {
      itemId: string;
      itemType: string;
      sourceRecordId?: string | null;
      patientId?: string | null;
      consultationId?: string | null;
      actionId: string;
      actionType?: string | null;
      actionTitle?: string | null;
      actionPayload?: any;
      destinationRole?: string | null;
      destinationService?: string | null;
      destinationSpecialty?: string | null;
      destinationUserId?: string | null;
      destinationUserName?: string | null;
      destinationFacilityId?: string | null;
      destinationFacilityName?: string | null;
    },
    requestMeta?: { ipAddress?: string; userAgent?: string; sessionId?: string },
  ) {
    if (!this.normalizeText(payload?.itemId) || !this.normalizeText(payload?.actionId)) {
      throw new BadRequestException('itemId and actionId are required');
    }

    const actionId = String(payload.actionId);
    const actionPayload =
      payload?.actionPayload && typeof payload.actionPayload === 'object' ? payload.actionPayload : {};
    const resolvedConsultationId = this.extractTelemedicineConsultationId({
      consultationId: payload.consultationId,
      sourceRecordId: payload.sourceRecordId,
      itemId: payload.itemId,
      actionPayload,
    });
    if (!resolvedConsultationId) {
      throw new BadRequestException('consultationId context is required for telemedicine recommendation actions');
    }

    const existingExecution = await this.getExistingRecommendationExecution(tenantDb, payload.itemId, actionId);
    if (String(existingExecution?.status || '').toLowerCase() === 'completed') {
      return {
        ok: true,
        itemId: payload.itemId,
        actionId,
        idempotent: true,
        result: existingExecution?.result || { status: 'completed', operation: 'already_applied' },
      };
    }
    if (String(existingExecution?.status || '').toLowerCase() === 'in_progress') {
      throw new BadRequestException(`Action "${actionId}" is already in progress`);
    }

    const timestampIso = new Date().toISOString();
    const resultMarker = `[nurse_queue_action:${actionId}]`;
    const actorName = this.getUserDisplayName(user);
    let result: any;

    if (actionId === 'confirm-telemedicine-consent') {
      const noteLine =
        `${resultMarker} Telemedicine consent checkpoint confirmed by ` +
        `${actorName} at ${timestampIso}.`;
      const update = await this.appendTelemedicineConsultationNote(
        tenantDb,
        resolvedConsultationId,
        resultMarker,
        noteLine,
      );

      let consentUpdated = false;
      if (!Boolean(update.consultation?.patient_consent)) {
        await tenantDb.query(
          `
          UPDATE telemedicine_consultations
          SET
            patient_consent = true,
            consent_date = COALESCE(consent_date, NOW()),
            updated_at = NOW()
          WHERE id = $1
          `,
          [resolvedConsultationId],
        );
        consentUpdated = true;
      }

      result = {
        status: 'completed',
        operation: consentUpdated ? 'telemedicine_consent_confirmed' : 'telemedicine_consent_already_confirmed',
        consultationId: resolvedConsultationId,
        patientId: update.consultation?.patient_id || null,
        noteReused: update.reused,
      };
    } else if (actionId === 'complete-telemedicine-visit-prep') {
      const noteLine =
        `${resultMarker} ${payload.actionTitle || actionId} completed by ` +
        `${actorName} at ${timestampIso}.`;
      const update = await this.appendTelemedicineConsultationNote(
        tenantDb,
        resolvedConsultationId,
        resultMarker,
        noteLine,
      );

      result = {
        status: 'completed',
        operation: update.reused ? 'telemedicine_visit_prep_reused' : 'telemedicine_visit_prep_completed',
        consultationId: resolvedConsultationId,
        patientId: update.consultation?.patient_id || null,
        noteReused: update.reused,
      };
    } else if (actionId === 'escalate-telemedicine-doctor-sync') {
      const noteLine =
        `${resultMarker} Telemedicine doctor synchronization requested by ` +
        `${actorName} at ${timestampIso}.`;
      const update = await this.appendTelemedicineConsultationNote(
        tenantDb,
        resolvedConsultationId,
        resultMarker,
        noteLine,
      );

      result = {
        status: 'completed',
        operation: update.reused ? 'telemedicine_doctor_sync_reused' : 'telemedicine_doctor_sync_documented',
        consultationId: resolvedConsultationId,
        patientId: update.consultation?.patient_id || null,
        noteReused: update.reused,
      };
    } else {
      throw new BadRequestException(`Unsupported telemedicine recommendation action "${actionId}"`);
    }

    const resolvedPatientId = this.normalizeText(payload.patientId) || this.normalizeText(result?.patientId);

    await this.persistRecommendationExecutionState(
      tenantDb,
      user,
      {
        itemId: payload.itemId,
        module: 'telemedicine',
        itemType: payload.itemType,
        sourceRecordId: payload.sourceRecordId || resolvedConsultationId || null,
        patientId: resolvedPatientId || null,
        enrollmentId: null,
        destinationRole: payload.destinationRole || null,
        destinationService: payload.destinationService || null,
        destinationSpecialty: payload.destinationSpecialty || null,
        destinationUserId: payload.destinationUserId || null,
        destinationFacilityId: payload.destinationFacilityId || null,
        destinationFacilityName: payload.destinationFacilityName || null,
        actionId,
        note: `${payload.actionTitle || actionId} executed from nurse cross-module escalation queue.`,
      },
      result,
    );

    await this.hipaaAuditService.logAuditEvent(tenantDb, {
      userId: user.id,
      userName: this.getUserDisplayName(user),
      userRole: user.role || 'nurse',
      action: HipaaAuditAction.NURSE_CROSS_MODULE_ACKNOWLEDGE,
      resourceType: 'nurse_cross_module_recommendation_action',
      resourceId: payload.itemId,
      patientId: resolvedPatientId || undefined,
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
      sessionId: requestMeta?.sessionId,
      outcome: 'success',
      metadata: {
        module: 'telemedicine',
        itemType: payload.itemType,
        actionId,
        actionTitle: payload.actionTitle || null,
        consultationId: resolvedConsultationId,
        result,
      },
      riskLevel: 'medium',
      timestamp: new Date(),
    });

    return {
      ok: true,
      itemId: payload.itemId,
      actionId,
      result,
    };
  }

  async executeLabRecommendationAction(
    tenantDb: DataSource,
    user: { id: string; fullName?: string; firstName?: string; lastName?: string; email?: string; role?: string },
    payload: {
      itemId: string;
      itemType: string;
      sourceRecordId?: string | null;
      patientId?: string | null;
      alertId?: string | null;
      actionId: string;
      actionType?: string | null;
      actionTitle?: string | null;
      actionPayload?: any;
      destinationRole?: string | null;
      destinationService?: string | null;
      destinationSpecialty?: string | null;
      destinationUserId?: string | null;
      destinationUserName?: string | null;
      destinationFacilityId?: string | null;
      destinationFacilityName?: string | null;
    },
    requestMeta?: { ipAddress?: string; userAgent?: string; sessionId?: string },
  ) {
    if (!this.normalizeText(payload?.itemId) || !this.normalizeText(payload?.actionId)) {
      throw new BadRequestException('itemId and actionId are required');
    }

    const actionId = String(payload.actionId);
    const actionPayload =
      payload?.actionPayload && typeof payload.actionPayload === 'object' ? payload.actionPayload : {};
    const resolvedAlertId = this.extractLabCriticalAlertId({
      alertId: payload.alertId,
      sourceRecordId: payload.sourceRecordId,
      itemId: payload.itemId,
      actionPayload,
    });
    if (!resolvedAlertId) {
      throw new BadRequestException('alertId context is required for lab recommendation actions');
    }

    const existingExecution = await this.getExistingRecommendationExecution(tenantDb, payload.itemId, actionId);
    if (String(existingExecution?.status || '').toLowerCase() === 'completed') {
      return {
        ok: true,
        itemId: payload.itemId,
        actionId,
        idempotent: true,
        result: existingExecution?.result || { status: 'completed', operation: 'already_applied' },
      };
    }
    if (String(existingExecution?.status || '').toLowerCase() === 'in_progress') {
      throw new BadRequestException(`Action "${actionId}" is already in progress`);
    }

    const timestampIso = new Date().toISOString();
    const resultMarker = `[nurse_queue_action:${actionId}]`;
    const actorName = this.getUserDisplayName(user);
    let result: any;

    if (actionId === 'acknowledge-critical-lab-alert') {
      const noteLine =
        `${resultMarker} Critical lab alert acknowledged by ` +
        `${actorName} at ${timestampIso}.`;
      const update = await this.appendLabCriticalAlertNote(
        tenantDb,
        resolvedAlertId,
        resultMarker,
        noteLine,
        {
          status: 'acknowledged',
          acknowledgedBy: user.id,
        },
      );

      const labOrderId = this.normalizeText(update.alert?.lab_order_id);
      let orderUpdate: { reused: boolean; workflowEventFallback?: boolean } | null = null;
      if (labOrderId) {
        orderUpdate = await this.appendLabOrderWorkflowEvent(
          tenantDb,
          labOrderId,
          resultMarker,
          {
            action_id: actionId,
            action_title: payload.actionTitle || actionId,
            event_type: 'critical_alert_acknowledged',
            executed_by: actorName,
            executed_at: timestampIso,
          },
        );
      }

      result = {
        status: 'completed',
        operation:
          update.reused && (orderUpdate?.reused ?? true)
            ? 'lab_alert_acknowledgement_reused'
            : 'lab_alert_acknowledged',
        alertId: resolvedAlertId,
        patientId: update.alert?.patient_id || null,
        labOrderId: labOrderId || null,
        noteReused: update.reused,
        workflowEventFallback: Boolean(orderUpdate?.workflowEventFallback),
      };
    } else if (actionId === 'prepare-critical-lab-order-set') {
      const suggestedOrders = Array.isArray(actionPayload?.suggested_orders)
        ? actionPayload.suggested_orders
            .map((value: any) => this.normalizeText(value))
            .filter((value: string | null): value is string => Boolean(value))
        : ['Repeat critical panel', 'Clinician reassessment', 'Document urgent result communication'];
      const noteLine =
        `${resultMarker} ${payload.actionTitle || actionId} executed by ${actorName} ` +
        `at ${timestampIso}. Suggested follow-up: ${suggestedOrders.join(', ')}.`;
      const update = await this.appendLabCriticalAlertNote(
        tenantDb,
        resolvedAlertId,
        resultMarker,
        noteLine,
        {
          status: 'acknowledged',
          acknowledgedBy: user.id,
        },
      );

      const labOrderId = this.normalizeText(update.alert?.lab_order_id);
      let orderUpdate: { reused: boolean; workflowEventFallback?: boolean } | null = null;
      if (labOrderId) {
        orderUpdate = await this.appendLabOrderWorkflowEvent(
          tenantDb,
          labOrderId,
          resultMarker,
          {
            action_id: actionId,
            action_title: payload.actionTitle || actionId,
            event_type: 'critical_order_set_prepared',
            executed_by: actorName,
            executed_at: timestampIso,
            suggested_orders: suggestedOrders,
          },
        );
      }

      result = {
        status: 'completed',
        operation:
          labOrderId && orderUpdate?.reused && update.reused
            ? 'lab_order_set_reused'
            : labOrderId
              ? 'lab_order_set_prepared'
              : 'lab_order_set_documented_without_order',
        alertId: resolvedAlertId,
        patientId: update.alert?.patient_id || null,
        labOrderId: labOrderId || null,
        suggestedOrders,
        noteReused: update.reused,
        workflowEventFallback: Boolean(orderUpdate?.workflowEventFallback),
      };
    } else if (actionId === 'escalate-lab-doctor-sync') {
      const escalatedTo =
        this.normalizeText(payload.destinationUserId) ||
        this.normalizeText(actionPayload?.escalated_to) ||
        null;
      const noteLine =
        `${resultMarker} Critical lab escalation to doctor sync requested by ` +
        `${actorName} at ${timestampIso}.`;
      const update = await this.appendLabCriticalAlertNote(
        tenantDb,
        resolvedAlertId,
        resultMarker,
        noteLine,
        {
          status: 'escalated',
          acknowledgedBy: user.id,
          escalatedTo,
        },
      );

      const labOrderId = this.normalizeText(update.alert?.lab_order_id);
      let orderUpdate: { reused: boolean; workflowEventFallback?: boolean } | null = null;
      if (labOrderId) {
        orderUpdate = await this.appendLabOrderWorkflowEvent(
          tenantDb,
          labOrderId,
          resultMarker,
          {
            action_id: actionId,
            action_title: payload.actionTitle || actionId,
            event_type: 'critical_alert_escalated',
            executed_by: actorName,
            executed_at: timestampIso,
            escalated_to: escalatedTo,
          },
        );
      }

      result = {
        status: 'completed',
        operation: update.reused ? 'lab_doctor_sync_reused' : 'lab_doctor_sync_documented',
        alertId: resolvedAlertId,
        patientId: update.alert?.patient_id || null,
        labOrderId: labOrderId || null,
        escalatedTo: escalatedTo || null,
        noteReused: update.reused,
        workflowEventFallback: Boolean(orderUpdate?.workflowEventFallback),
      };
    } else {
      throw new BadRequestException(`Unsupported lab recommendation action "${actionId}"`);
    }

    const resolvedPatientId = this.normalizeText(payload.patientId) || this.normalizeText(result?.patientId);

    await this.persistRecommendationExecutionState(
      tenantDb,
      user,
      {
        itemId: payload.itemId,
        module: 'lab',
        itemType: payload.itemType,
        sourceRecordId: payload.sourceRecordId || resolvedAlertId || null,
        patientId: resolvedPatientId || null,
        enrollmentId: null,
        destinationRole: payload.destinationRole || null,
        destinationService: payload.destinationService || null,
        destinationSpecialty: payload.destinationSpecialty || null,
        destinationUserId: payload.destinationUserId || null,
        destinationFacilityId: payload.destinationFacilityId || null,
        destinationFacilityName: payload.destinationFacilityName || null,
        actionId,
        note: `${payload.actionTitle || actionId} executed from nurse cross-module escalation queue.`,
      },
      result,
    );

    await this.hipaaAuditService.logAuditEvent(tenantDb, {
      userId: user.id,
      userName: this.getUserDisplayName(user),
      userRole: user.role || 'nurse',
      action: HipaaAuditAction.NURSE_CROSS_MODULE_ACKNOWLEDGE,
      resourceType: 'nurse_cross_module_recommendation_action',
      resourceId: payload.itemId,
      patientId: resolvedPatientId || undefined,
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
      sessionId: requestMeta?.sessionId,
      outcome: 'success',
      metadata: {
        module: 'lab',
        itemType: payload.itemType,
        actionId,
        actionTitle: payload.actionTitle || null,
        alertId: resolvedAlertId,
        result,
      },
      riskLevel: 'medium',
      timestamp: new Date(),
    });

    return {
      ok: true,
      itemId: payload.itemId,
      actionId,
      result,
    };
  }

  async executePharmacyRecommendationAction(
    tenantDb: DataSource,
    user: { id: string; fullName?: string; firstName?: string; lastName?: string; email?: string; role?: string },
    payload: {
      itemId: string;
      itemType: string;
      sourceRecordId?: string | null;
      patientId?: string | null;
      prescriptionId?: string | null;
      actionId: string;
      actionType?: string | null;
      actionTitle?: string | null;
      actionPayload?: any;
      destinationRole?: string | null;
      destinationService?: string | null;
      destinationSpecialty?: string | null;
      destinationUserId?: string | null;
      destinationUserName?: string | null;
      destinationFacilityId?: string | null;
      destinationFacilityName?: string | null;
    },
    requestMeta?: { ipAddress?: string; userAgent?: string; sessionId?: string },
  ) {
    if (!this.normalizeText(payload?.itemId) || !this.normalizeText(payload?.actionId)) {
      throw new BadRequestException('itemId and actionId are required');
    }

    const actionId = String(payload.actionId);
    const actionPayload =
      payload?.actionPayload && typeof payload.actionPayload === 'object' ? payload.actionPayload : {};
    const resolvedPrescriptionId = this.extractPharmacyPrescriptionId({
      prescriptionId: payload.prescriptionId,
      sourceRecordId: payload.sourceRecordId,
      itemId: payload.itemId,
      actionPayload,
    });
    if (!resolvedPrescriptionId) {
      throw new BadRequestException('prescriptionId context is required for pharmacy recommendation actions');
    }

    const existingExecution = await this.getExistingRecommendationExecution(tenantDb, payload.itemId, actionId);
    if (String(existingExecution?.status || '').toLowerCase() === 'completed') {
      return {
        ok: true,
        itemId: payload.itemId,
        actionId,
        idempotent: true,
        result: existingExecution?.result || { status: 'completed', operation: 'already_applied' },
      };
    }
    if (String(existingExecution?.status || '').toLowerCase() === 'in_progress') {
      throw new BadRequestException(`Action "${actionId}" is already in progress`);
    }

    const timestampIso = new Date().toISOString();
    const resultMarker = `[nurse_queue_action:${actionId}]`;
    const actorName = this.getUserDisplayName(user);
    let result: any;

    if (actionId === 'prepare-pharmacy-dispense-plan') {
      const quantity = this.normalizeText(String(actionPayload?.quantity ?? ''));
      const stockOnHand = this.normalizeText(String(actionPayload?.stock_on_hand ?? ''));
      const noteLine =
        `${resultMarker} ${payload.actionTitle || actionId} executed by ${actorName} at ${timestampIso}.` +
        `${quantity ? ` Quantity: ${quantity}.` : ''}` +
        `${stockOnHand ? ` Stock on hand: ${stockOnHand}.` : ''}`;
      const update = await this.appendPharmacyPrescriptionInstruction(
        tenantDb,
        resolvedPrescriptionId,
        resultMarker,
        noteLine,
      );

      result = {
        status: 'completed',
        operation: update.reused ? 'pharmacy_dispense_plan_reused' : 'pharmacy_dispense_plan_prepared',
        prescriptionId: resolvedPrescriptionId,
        patientId: update.prescription?.patient_id || null,
        noteReused: update.reused,
      };
    } else if (actionId === 'complete-pharmacy-counseling-checkpoint') {
      const noteLine =
        `${resultMarker} ${payload.actionTitle || actionId} completed by ` +
        `${actorName} at ${timestampIso}.`;
      const update = await this.appendPharmacyPrescriptionInstruction(
        tenantDb,
        resolvedPrescriptionId,
        resultMarker,
        noteLine,
      );

      result = {
        status: 'completed',
        operation: update.reused
          ? 'pharmacy_counseling_checkpoint_reused'
          : 'pharmacy_counseling_checkpoint_completed',
        prescriptionId: resolvedPrescriptionId,
        patientId: update.prescription?.patient_id || null,
        noteReused: update.reused,
      };
    } else if (actionId === 'escalate-pharmacy-doctor-sync') {
      const noteLine =
        `${resultMarker} Pharmacy doctor synchronization requested by ` +
        `${actorName} at ${timestampIso}.`;
      const update = await this.appendPharmacyPrescriptionInstruction(
        tenantDb,
        resolvedPrescriptionId,
        resultMarker,
        noteLine,
      );

      result = {
        status: 'completed',
        operation: update.reused ? 'pharmacy_doctor_sync_reused' : 'pharmacy_doctor_sync_documented',
        prescriptionId: resolvedPrescriptionId,
        patientId: update.prescription?.patient_id || null,
        noteReused: update.reused,
      };
    } else {
      throw new BadRequestException(`Unsupported pharmacy recommendation action "${actionId}"`);
    }

    const resolvedPatientId = this.normalizeText(payload.patientId) || this.normalizeText(result?.patientId);

    await this.persistRecommendationExecutionState(
      tenantDb,
      user,
      {
        itemId: payload.itemId,
        module: 'pharmacy',
        itemType: payload.itemType,
        sourceRecordId: payload.sourceRecordId || resolvedPrescriptionId || null,
        patientId: resolvedPatientId || null,
        enrollmentId: null,
        destinationRole: payload.destinationRole || null,
        destinationService: payload.destinationService || null,
        destinationSpecialty: payload.destinationSpecialty || null,
        destinationUserId: payload.destinationUserId || null,
        destinationFacilityId: payload.destinationFacilityId || null,
        destinationFacilityName: payload.destinationFacilityName || null,
        actionId,
        note: `${payload.actionTitle || actionId} executed from nurse cross-module escalation queue.`,
      },
      result,
    );

    await this.hipaaAuditService.logAuditEvent(tenantDb, {
      userId: user.id,
      userName: this.getUserDisplayName(user),
      userRole: user.role || 'nurse',
      action: HipaaAuditAction.NURSE_CROSS_MODULE_ACKNOWLEDGE,
      resourceType: 'nurse_cross_module_recommendation_action',
      resourceId: payload.itemId,
      patientId: resolvedPatientId || undefined,
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
      sessionId: requestMeta?.sessionId,
      outcome: 'success',
      metadata: {
        module: 'pharmacy',
        itemType: payload.itemType,
        actionId,
        actionTitle: payload.actionTitle || null,
        prescriptionId: resolvedPrescriptionId,
        result,
      },
      riskLevel: 'medium',
      timestamp: new Date(),
    });

    return {
      ok: true,
      itemId: payload.itemId,
      actionId,
      result,
    };
  }

  async updateCrossModuleWorkflowState(
    tenantDb: DataSource,
    user: { id: string; fullName?: string; firstName?: string; lastName?: string; email?: string; role?: string },
    payload: {
      itemId: string;
      module: string;
      itemType: string;
      sourceRecordId?: string | null;
      patientId?: string | null;
      enrollmentId?: string | null;
      status: 'acknowledged' | 'completed';
      note?: string;
      context?: any;
      destinationRole?: string | null;
      destinationService?: string | null;
      destinationSpecialty?: string | null;
      destinationUserId?: string | null;
      destinationFacilityId?: string | null;
      destinationFacilityName?: string | null;
    },
    requestMeta?: { ipAddress?: string; userAgent?: string; sessionId?: string },
  ) {
    const status = this.normalizeCrossModuleWorkflowStatus(payload?.status);
    if (status === 'pending') {
      throw new BadRequestException('status must be acknowledged or completed');
    }
    if (payload?.module === 'maternity') {
      throw new BadRequestException('Maternity tasks use the maternity task workflow endpoint');
    }
    if (!this.normalizeText(payload?.itemId) || !this.normalizeText(payload?.module) || !this.normalizeText(payload?.itemType)) {
      throw new BadRequestException('itemId, module, and itemType are required');
    }

    const mergedContext = {
      ...(payload?.context || {}),
      source: 'nurse_cross_module_queue',
      status,
    };

    try {
      await tenantDb.query(
        `
        INSERT INTO nurse_cross_module_workflow_state (
          workflow_key,
          module,
          item_type,
          source_record_id,
          enrollment_id,
          patient_id,
          status,
          destination_role,
          destination_service,
          destination_specialty,
          destination_user_id,
          destination_facility_id,
          destination_facility_name,
          acknowledged_by,
          acknowledged_at,
          completed_by,
          completed_at,
          note,
          context,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          $14, CASE WHEN $7 = 'acknowledged' THEN NOW() ELSE NULL END,
          $15, CASE WHEN $7 = 'completed' THEN NOW() ELSE NULL END,
          $16, $17::jsonb, NOW()
        )
        ON CONFLICT (workflow_key)
        DO UPDATE SET
          module = EXCLUDED.module,
          item_type = EXCLUDED.item_type,
          source_record_id = COALESCE(EXCLUDED.source_record_id, nurse_cross_module_workflow_state.source_record_id),
          enrollment_id = COALESCE(EXCLUDED.enrollment_id, nurse_cross_module_workflow_state.enrollment_id),
          patient_id = COALESCE(EXCLUDED.patient_id, nurse_cross_module_workflow_state.patient_id),
          status = EXCLUDED.status,
          destination_role = COALESCE(EXCLUDED.destination_role, nurse_cross_module_workflow_state.destination_role),
          destination_service = COALESCE(EXCLUDED.destination_service, nurse_cross_module_workflow_state.destination_service),
          destination_specialty = COALESCE(EXCLUDED.destination_specialty, nurse_cross_module_workflow_state.destination_specialty),
          destination_user_id = COALESCE(EXCLUDED.destination_user_id, nurse_cross_module_workflow_state.destination_user_id),
          destination_facility_id = COALESCE(EXCLUDED.destination_facility_id, nurse_cross_module_workflow_state.destination_facility_id),
          destination_facility_name = COALESCE(EXCLUDED.destination_facility_name, nurse_cross_module_workflow_state.destination_facility_name),
          acknowledged_by = CASE
            WHEN EXCLUDED.status = 'acknowledged' THEN EXCLUDED.acknowledged_by
            ELSE nurse_cross_module_workflow_state.acknowledged_by
          END,
          acknowledged_at = CASE
            WHEN EXCLUDED.status = 'acknowledged' THEN NOW()
            ELSE nurse_cross_module_workflow_state.acknowledged_at
          END,
          completed_by = CASE
            WHEN EXCLUDED.status = 'completed' THEN EXCLUDED.completed_by
            ELSE nurse_cross_module_workflow_state.completed_by
          END,
          completed_at = CASE
            WHEN EXCLUDED.status = 'completed' THEN NOW()
            ELSE nurse_cross_module_workflow_state.completed_at
          END,
          note = EXCLUDED.note,
          context = EXCLUDED.context,
          updated_at = NOW()
        `,
        [
          payload.itemId,
          payload.module,
          payload.itemType,
          payload.sourceRecordId || null,
          payload.enrollmentId || null,
          payload.patientId || null,
          status,
          payload.destinationRole || null,
          payload.destinationService || null,
          payload.destinationSpecialty || null,
          payload.destinationUserId || null,
          payload.destinationFacilityId || null,
          payload.destinationFacilityName || null,
          status === 'acknowledged' ? user.id : null,
          status === 'completed' ? user.id : null,
          payload.note || null,
          JSON.stringify(mergedContext),
        ],
      );
    } catch (error) {
      if (!this.isMissingTableError(error)) {
        throw error;
      }
    }

    await this.hipaaAuditService.logAuditEvent(tenantDb, {
      userId: user.id,
      userName: this.getUserDisplayName(user),
      userRole: user.role || 'nurse',
      action:
        status === 'completed'
          ? HipaaAuditAction.NURSE_CROSS_MODULE_COMPLETE
          : HipaaAuditAction.NURSE_CROSS_MODULE_ACKNOWLEDGE,
      resourceType: 'nurse_cross_module_workflow',
      resourceId: payload.itemId,
      patientId: payload.patientId || undefined,
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
      sessionId: requestMeta?.sessionId,
      outcome: 'success',
      metadata: {
        module: payload.module,
        itemType: payload.itemType,
        sourceRecordId: payload.sourceRecordId || null,
        enrollmentId: payload.enrollmentId || null,
        status,
        note: payload.note || null,
        context: mergedContext,
      },
      riskLevel: status === 'completed' ? 'medium' : 'low',
      timestamp: new Date(),
    });

    return {
      ok: true,
      itemId: payload.itemId,
      status,
    };
  }

  private isMissingTableError(error: any): boolean {
    return error?.code === '42P01' || String(error?.message || '').toLowerCase().includes('does not exist');
  }

  private getUserDisplayName(user: {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  }) {
    return (
      user.fullName ||
      [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      user.email ||
      'Unknown'
    );
  }

  async getState(tenantDb: DataSource, userId: string) {
    try {
      const [taskRows, alertRows] = await Promise.all([
        tenantDb.query(
          `
          SELECT task_id
          FROM nurse_copilot_task_events
          WHERE user_id = $1 AND status = 'completed'
          ORDER BY completed_at DESC
          `,
          [userId],
        ),
        tenantDb.query(
          `
          SELECT alert_id
          FROM nurse_copilot_alert_events
          WHERE user_id = $1 AND status = 'acknowledged'
          ORDER BY acknowledged_at DESC
          `,
          [userId],
        ),
      ]);

      return {
        completedTaskIds: Array.from(new Set(taskRows.map((row: any) => String(row.task_id)))),
        acknowledgedAlertIds: Array.from(new Set(alertRows.map((row: any) => String(row.alert_id)))),
      };
    } catch (error) {
      if (!this.isMissingTableError(error)) {
        throw error;
      }
    }

    const rows = await tenantDb.query(
      `
      SELECT action, metadata, created_at
      FROM hipaa_audit_logs
      WHERE user_id = $1
        AND action IN ($2, $3)
      ORDER BY created_at DESC
      LIMIT 5000
      `,
      [
        userId,
        HipaaAuditAction.NURSE_TASK_COMPLETE,
        HipaaAuditAction.NURSE_ALERT_ACKNOWLEDGE,
      ],
    );

    const completedTaskIds = new Set<string>();
    const acknowledgedAlertIds = new Set<string>();

    for (const row of rows) {
      const metadata = row?.metadata || {};
      if (row.action === HipaaAuditAction.NURSE_TASK_COMPLETE && metadata?.taskId) {
        completedTaskIds.add(String(metadata.taskId));
      }
      if (row.action === HipaaAuditAction.NURSE_ALERT_ACKNOWLEDGE && metadata?.alertId) {
        acknowledgedAlertIds.add(String(metadata.alertId));
      }
    }

    return {
      completedTaskIds: Array.from(completedTaskIds),
      acknowledgedAlertIds: Array.from(acknowledgedAlertIds),
    };
  }

  async completeTask(
    tenantDb: DataSource,
    user: { id: string; fullName?: string; firstName?: string; lastName?: string; email?: string; role?: string },
    taskId: string,
    payload?: { action?: 'accept' | 'override'; reason?: string; patientId?: string; context?: any },
    requestMeta?: { ipAddress?: string; userAgent?: string; sessionId?: string },
  ) {
    const normalizedAction = payload?.action === 'override' ? 'override' : 'accept';
    if (normalizedAction === 'override' && !payload?.reason?.trim()) {
      throw new BadRequestException('reason is required when task action is override');
    }

    const mergedContext = {
      ...(payload?.context || {}),
      action: normalizedAction,
    };

    try {
      await tenantDb.query(
        `
        INSERT INTO nurse_copilot_task_events (
          user_id, task_id, patient_id, status, reason, context, completed_at, updated_at
        )
        VALUES ($1, $2, $3, 'completed', $4, $5::jsonb, NOW(), NOW())
        ON CONFLICT (user_id, task_id)
        DO UPDATE SET
          patient_id = COALESCE(EXCLUDED.patient_id, nurse_copilot_task_events.patient_id),
          status = 'completed',
          reason = EXCLUDED.reason,
          context = EXCLUDED.context,
          completed_at = NOW(),
          updated_at = NOW()
        `,
        [user.id, taskId, payload?.patientId || null, payload?.reason || null, JSON.stringify(mergedContext)],
      );
    } catch (error) {
      if (!this.isMissingTableError(error)) {
        throw error;
      }
    }

    await this.hipaaAuditService.logAuditEvent(tenantDb, {
      userId: user.id,
      userName: this.getUserDisplayName(user),
      userRole: user.role || 'nurse',
      action: HipaaAuditAction.NURSE_TASK_COMPLETE,
      resourceType: 'nurse_task',
      resourceId: taskId,
      patientId: payload?.patientId || undefined,
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
      sessionId: requestMeta?.sessionId,
      outcome: 'success',
      metadata: {
        taskId,
        action: normalizedAction,
        reason: payload?.reason || null,
        context: mergedContext,
      },
      riskLevel: 'medium',
      timestamp: new Date(),
    });

    return { ok: true, taskId };
  }

  async acknowledgeAlert(
    tenantDb: DataSource,
    user: { id: string; fullName?: string; firstName?: string; lastName?: string; email?: string; role?: string },
    alertId: string,
    payload?: { action?: 'accept' | 'override'; reason?: string; patientId?: string; context?: any },
    requestMeta?: { ipAddress?: string; userAgent?: string; sessionId?: string },
  ) {
    const normalizedAction = payload?.action === 'override' ? 'override' : 'accept';
    if (normalizedAction === 'override' && !payload?.reason?.trim()) {
      throw new BadRequestException('reason is required when alert action is override');
    }

    const mergedContext = {
      ...(payload?.context || {}),
      action: normalizedAction,
    };

    try {
      await tenantDb.query(
        `
        INSERT INTO nurse_copilot_alert_events (
          user_id, alert_id, patient_id, status, reason, context, acknowledged_at, updated_at
        )
        VALUES ($1, $2, $3, 'acknowledged', $4, $5::jsonb, NOW(), NOW())
        ON CONFLICT (user_id, alert_id)
        DO UPDATE SET
          patient_id = COALESCE(EXCLUDED.patient_id, nurse_copilot_alert_events.patient_id),
          status = 'acknowledged',
          reason = EXCLUDED.reason,
          context = EXCLUDED.context,
          acknowledged_at = NOW(),
          updated_at = NOW()
        `,
        [user.id, alertId, payload?.patientId || null, payload?.reason || null, JSON.stringify(mergedContext)],
      );
    } catch (error) {
      if (!this.isMissingTableError(error)) {
        throw error;
      }
    }

    await this.hipaaAuditService.logAuditEvent(tenantDb, {
      userId: user.id,
      userName: this.getUserDisplayName(user),
      userRole: user.role || 'nurse',
      action: HipaaAuditAction.NURSE_ALERT_ACKNOWLEDGE,
      resourceType: 'nurse_alert',
      resourceId: alertId,
      patientId: payload?.patientId || undefined,
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
      sessionId: requestMeta?.sessionId,
      outcome: 'success',
      metadata: {
        alertId,
        action: normalizedAction,
        reason: payload?.reason || null,
        context: mergedContext,
      },
      riskLevel: 'medium',
      timestamp: new Date(),
    });

    return { ok: true, alertId };
  }

  async getHandoffState(tenantDb: DataSource, patientId: string) {
    try {
      const rows = await tenantDb.query(
        `
        SELECT
          patient_id,
          status,
          finalized_at,
          reviewed_at,
          shared_at,
          finalize_context,
          review_context,
          share_context,
          fu.first_name AS finalized_by_first_name,
          fu.last_name AS finalized_by_last_name,
          ru.first_name AS reviewed_by_first_name,
          ru.last_name AS reviewed_by_last_name,
          su.first_name AS shared_by_first_name,
          su.last_name AS shared_by_last_name
        FROM nurse_handoff_workflow_state h
        LEFT JOIN users fu ON fu.id = h.finalized_by
        LEFT JOIN users ru ON ru.id = h.reviewed_by
        LEFT JOIN users su ON su.id = h.shared_by
        WHERE h.patient_id = $1
        LIMIT 1
        `,
        [patientId],
      );

      const row = rows?.[0];
      if (row) {
        const finalizedBy = [row.finalized_by_first_name, row.finalized_by_last_name].filter(Boolean).join(' ') || null;
        const reviewedBy = [row.reviewed_by_first_name, row.reviewed_by_last_name].filter(Boolean).join(' ') || null;
        const sharedBy = [row.shared_by_first_name, row.shared_by_last_name].filter(Boolean).join(' ') || null;

        return {
          patientId,
          status: row.status || 'draft',
          finalized: !!row.finalized_at,
          finalizedAt: row.finalized_at || null,
          finalizedBy,
          reviewed: !!row.reviewed_at,
          reviewedAt: row.reviewed_at || null,
          reviewedBy,
          shared: !!row.shared_at,
          sharedAt: row.shared_at || null,
          sharedBy,
          shareContext: row.share_context || null,
          reviewContext: row.review_context || null,
        };
      }

      return {
        patientId,
        status: 'draft',
        finalized: false,
        finalizedAt: null,
        finalizedBy: null,
        reviewed: false,
        reviewedAt: null,
        reviewedBy: null,
        shared: false,
        sharedAt: null,
        sharedBy: null,
        shareContext: null,
        reviewContext: null,
      };
    } catch (error) {
      if (!this.isMissingTableError(error)) {
        throw error;
      }
    }

    const rows = await tenantDb.query(
      `
      SELECT action, metadata, created_at, user_id, user_name
      FROM hipaa_audit_logs
      WHERE patient_id = $1
        AND action IN ($2, $3, $4)
      ORDER BY created_at DESC
      LIMIT 500
      `,
      [
        patientId,
        HipaaAuditAction.NURSE_HANDOFF_FINALIZE,
        HipaaAuditAction.NURSE_HANDOFF_REVIEW_CONFIRM,
        HipaaAuditAction.NURSE_HANDOFF_SHARE,
      ],
    );

    const latestFinalize = rows.find((row: any) => row.action === HipaaAuditAction.NURSE_HANDOFF_FINALIZE);
    const latestReview = rows.find((row: any) => row.action === HipaaAuditAction.NURSE_HANDOFF_REVIEW_CONFIRM);
    const latestShare = rows.find((row: any) => row.action === HipaaAuditAction.NURSE_HANDOFF_SHARE);

    return {
      patientId,
      status: latestShare ? 'shared' : latestFinalize ? 'finalized' : 'draft',
      finalized: !!latestFinalize,
      finalizedAt: latestFinalize?.created_at || null,
      finalizedBy: latestFinalize?.user_name || null,
      reviewed: !!latestReview,
      reviewedAt: latestReview?.created_at || null,
      reviewedBy: latestReview?.user_name || null,
      shared: !!latestShare,
      sharedAt: latestShare?.created_at || null,
      sharedBy: latestShare?.user_name || null,
      shareContext: latestShare?.metadata?.context || null,
      reviewContext: latestReview?.metadata?.context || null,
    };
  }

  async finalizeHandoff(
    tenantDb: DataSource,
    user: { id: string; fullName?: string; firstName?: string; lastName?: string; email?: string; role?: string },
    patientId: string,
    payload?: { summary?: string; context?: any; reason?: string },
    requestMeta?: { ipAddress?: string; userAgent?: string; sessionId?: string },
  ) {
    try {
      await tenantDb.query(
        `
        INSERT INTO nurse_handoff_workflow_state (
          patient_id, status, finalized_by, finalized_at, finalized_summary_preview, finalize_reason, finalize_context, updated_at
        )
        VALUES ($1, 'finalized', $2, NOW(), $3, $4, $5::jsonb, NOW())
        ON CONFLICT (patient_id)
        DO UPDATE SET
          status = CASE
            WHEN nurse_handoff_workflow_state.shared_at IS NOT NULL THEN 'shared'
            ELSE 'finalized'
          END,
          finalized_by = EXCLUDED.finalized_by,
          finalized_at = NOW(),
          finalized_summary_preview = EXCLUDED.finalized_summary_preview,
          finalize_reason = EXCLUDED.finalize_reason,
          finalize_context = EXCLUDED.finalize_context,
          updated_at = NOW()
        `,
        [
          patientId,
          user.id,
          payload?.summary ? String(payload.summary).slice(0, 300) : null,
          payload?.reason || null,
          JSON.stringify(payload?.context || null),
        ],
      );
    } catch (error) {
      if (!this.isMissingTableError(error)) {
        throw error;
      }
    }

    await this.hipaaAuditService.logAuditEvent(tenantDb, {
      userId: user.id,
      userName: this.getUserDisplayName(user),
      userRole: user.role || 'nurse',
      action: HipaaAuditAction.NURSE_HANDOFF_FINALIZE,
      resourceType: 'nurse_handoff',
      resourceId: patientId,
      patientId,
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
      sessionId: requestMeta?.sessionId,
      outcome: 'success',
      metadata: {
        reason: payload?.reason || null,
        summaryPreview: payload?.summary ? String(payload.summary).slice(0, 300) : null,
        context: payload?.context || null,
      },
      riskLevel: 'medium',
      timestamp: new Date(),
    });

    return { ok: true, patientId, status: 'finalized' };
  }

  async confirmHandoffReview(
    tenantDb: DataSource,
    user: { id: string; fullName?: string; firstName?: string; lastName?: string; email?: string; role?: string },
    patientId: string,
    payload?: { reviewerName?: string; reviewerRole?: string; context?: any; reason?: string },
    requestMeta?: { ipAddress?: string; userAgent?: string; sessionId?: string },
  ) {
    try {
      await tenantDb.query(
        `
        INSERT INTO nurse_handoff_workflow_state (
          patient_id, status, reviewed_by, reviewed_at, reviewer_name, reviewer_role, review_reason, review_context, updated_at
        )
        VALUES ($1, 'reviewed', $2, NOW(), $3, $4, $5, $6::jsonb, NOW())
        ON CONFLICT (patient_id)
        DO UPDATE SET
          status = CASE
            WHEN nurse_handoff_workflow_state.shared_at IS NOT NULL THEN 'shared'
            ELSE 'reviewed'
          END,
          reviewed_by = EXCLUDED.reviewed_by,
          reviewed_at = NOW(),
          reviewer_name = EXCLUDED.reviewer_name,
          reviewer_role = EXCLUDED.reviewer_role,
          review_reason = EXCLUDED.review_reason,
          review_context = EXCLUDED.review_context,
          updated_at = NOW()
        `,
        [
          patientId,
          user.id,
          payload?.reviewerName || this.getUserDisplayName(user),
          payload?.reviewerRole || user.role || 'nurse',
          payload?.reason || null,
          JSON.stringify(payload?.context || null),
        ],
      );
    } catch (error) {
      if (!this.isMissingTableError(error)) {
        throw error;
      }
    }

    await this.hipaaAuditService.logAuditEvent(tenantDb, {
      userId: user.id,
      userName: this.getUserDisplayName(user),
      userRole: user.role || 'nurse',
      action: HipaaAuditAction.NURSE_HANDOFF_REVIEW_CONFIRM,
      resourceType: 'nurse_handoff',
      resourceId: patientId,
      patientId,
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
      sessionId: requestMeta?.sessionId,
      outcome: 'success',
      metadata: {
        reviewerName: payload?.reviewerName || this.getUserDisplayName(user),
        reviewerRole: payload?.reviewerRole || user.role || 'nurse',
        reason: payload?.reason || null,
        context: payload?.context || null,
      },
      riskLevel: 'medium',
      timestamp: new Date(),
    });

    return { ok: true, patientId, status: 'reviewed' };
  }

  async shareHandoff(
    tenantDb: DataSource,
    user: { id: string; fullName?: string; firstName?: string; lastName?: string; email?: string; role?: string },
    patientId: string,
    payload?: { channel?: string; recipient?: string; context?: any; reason?: string },
    requestMeta?: { ipAddress?: string; userAgent?: string; sessionId?: string },
  ) {
    try {
      await tenantDb.query(
        `
        INSERT INTO nurse_handoff_workflow_state (
          patient_id, status, shared_by, shared_at, share_channel, share_recipient, share_reason, share_context, updated_at
        )
        VALUES ($1, 'shared', $2, NOW(), $3, $4, $5, $6::jsonb, NOW())
        ON CONFLICT (patient_id)
        DO UPDATE SET
          status = 'shared',
          shared_by = EXCLUDED.shared_by,
          shared_at = NOW(),
          share_channel = EXCLUDED.share_channel,
          share_recipient = EXCLUDED.share_recipient,
          share_reason = EXCLUDED.share_reason,
          share_context = EXCLUDED.share_context,
          updated_at = NOW()
        `,
        [
          patientId,
          user.id,
          payload?.channel || 'in_app',
          payload?.recipient || 'next_shift',
          payload?.reason || null,
          JSON.stringify(payload?.context || null),
        ],
      );
    } catch (error) {
      if (!this.isMissingTableError(error)) {
        throw error;
      }
    }

    await this.hipaaAuditService.logAuditEvent(tenantDb, {
      userId: user.id,
      userName: this.getUserDisplayName(user),
      userRole: user.role || 'nurse',
      action: HipaaAuditAction.NURSE_HANDOFF_SHARE,
      resourceType: 'nurse_handoff',
      resourceId: patientId,
      patientId,
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
      sessionId: requestMeta?.sessionId,
      outcome: 'success',
      metadata: {
        channel: payload?.channel || 'in_app',
        recipient: payload?.recipient || 'next_shift',
        reason: payload?.reason || null,
        context: payload?.context || null,
      },
      riskLevel: 'medium',
      timestamp: new Date(),
    });

    return { ok: true, patientId, status: 'shared' };
  }
}
