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

  private buildRecommendationExecutionContext(existingContext: any, actionId: string, execution: any) {
    const normalizedExisting =
      existingContext && typeof existingContext === 'object' && !Array.isArray(existingContext)
        ? existingContext
        : {};

    return {
      ...normalizedExisting,
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
    const mergedContext = this.buildRecommendationExecutionContext(existingRow?.context, payload.actionId, {
      status: 'completed',
      executed_at: new Date().toISOString(),
      executed_by: user.id,
      executed_by_name: this.getUserDisplayName(user),
      result: executionResult,
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
    ] = await Promise.all([
      this.safeQuery(
        tenantDb,
        `
        SELECT
          w.workflow_key,
          w.status,
          w.destination_role,
          w.destination_service,
          w.destination_specialty,
          w.destination_user_id,
          w.destination_facility_id,
          w.destination_facility_name,
          w.acknowledged_at,
          w.completed_at,
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

    const items = [...maternityItems, ...hivRegimenItems, ...hivPathwayItems, ...handoffItems, ...medicationItems]
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

    return {
      items,
      summary: {
        total: items.length,
        critical: items.filter((item) => item.severity === 'critical').length,
        high: items.filter((item) => item.severity === 'high').length,
        maternity: items.filter((item) => item.module === 'maternity').length,
        hiv: items.filter((item) => item.module === 'hiv').length,
        nursing: items.filter((item) => item.module === 'nursing').length,
        handoff: items.filter((item) => item.item_type === 'nurse_handoff_risk').length,
        medication: items.filter((item) => item.item_type === 'medication_administration_followup').length,
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString().split('T')[0];

    let result: any;

    if (actionId === 'eac-followup') {
      const existingSessions = await this.safeQuery(
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
      const latestSessionNumber = Number(existingSessions[0]?.session_number || 0);
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
        const prepNote =
          `Nurse confirmed visit-prep completion from cross-module queue on ${todayIso} for requested regimen ${request.requested_regimen_name || request.requested_regimen_code || 'N/A'}.`;

        await this.appendArvChangeApprovalNote(tenantDb, regimenRequestId, prepNote);
        await this.hivService.logAuditAction(
          'regimen_visit_preparation_completed',
          'Nurse marked regimen change visit preparation as complete from HIV recommendation bundle',
          enrollmentId,
          null,
          {
            requestId: regimenRequestId,
            requestedRegimenCode: request.requested_regimen_code || null,
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
        };
      }
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
      const existingReferral = await this.safeQuery(
        tenantDb,
        `
        SELECT id, referral_status
        FROM hiv_referrals
        WHERE enrollment_id = $1
          AND referral_type = 'P'
          AND referral_status IN ('pending', 'in_progress')
        ORDER BY referral_date DESC, created_at DESC
        LIMIT 1
        `,
        [enrollmentId],
      );

      if (existingReferral[0]?.id) {
        result = {
          status: 'completed',
          operation: 'existing_pmtct_referral_reused',
          referralId: existingReferral[0].id,
          referralStatus: existingReferral[0].referral_status,
        };
      } else {
        const referral = await this.hivService.createReferral(
          {
            enrollmentId,
            referralDate: todayIso,
            referralType: 'P',
            referralTypeDetails: 'PMTCT / ANC linkage from nurse HIV queue',
            referredToFacility: payload.destinationFacilityName || 'ANC / PMTCT clinic',
            referredToProvider: payload.destinationUserName || null,
            referralReason:
              'Pregnancy-linked HIV follow-up requires PMTCT/ANC linkage confirmation from the nurse queue.',
            referralPriority: 'urgent',
            referredBy: user.id,
            referredByName: this.getUserDisplayName(user),
          },
          tenantDb,
        );

        result = {
          status: 'completed',
          operation: 'pmtct_referral_created',
          referralId: referral?.id || null,
          referralStatus: referral?.referral_status || 'pending',
        };
      }
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
        patientId: payload.patientId || null,
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
      patientId: payload.patientId || undefined,
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
