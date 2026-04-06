import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HipaaAuditService, HipaaAuditAction } from './hipaa-audit.service';

/**
 * PostVisitEscalationService — S108
 *
 * Owns all escalation and intra-visit alert READ/UPDATE operations.
 * Complex escalation creation logic (classifyEscalationSignals,
 * createEscalationEvent, routeEscalationToWorkflow) remains in
 * PostVisitService for now — those depend on ~15 shared private helpers
 * and will be migrated incrementally.
 *
 * Public API (consumed via PostVisitService delegation):
 *   listEscalations         — filtered list with summary counts
 *   resolveEscalation       — mark resolved/dismissed + workflow sync
 *   listIntraVisitAlerts    — paginated session alert list
 *   acknowledgeIntraVisitAlert — mark alert acknowledged
 *   resolveIntraVisitAlert  — mark alert confirmed/dismissed
 */
@Injectable()
export class PostVisitEscalationService {
  private readonly logger = new Logger(PostVisitEscalationService.name);

  constructor(
    @Optional() private readonly hipaaAuditService?: HipaaAuditService,
  ) {}

  // ── Schema guard ─────────────────────────────────────────────────────────────

  private async assertSchema(tenantDb: DataSource): Promise<void> {
    const [row] = await tenantDb
      .query(`SELECT to_regclass('post_visit_sessions') AS tbl`)
      .catch(() => [null]);
    if (!row?.tbl) {
      throw new Error(
        'post_visit_sessions table not found. Run provisioning scripts sprint48–sprint58 first.',
      );
    }
  }

  private async getSessionRow(tenantDb: DataSource, sessionId: string): Promise<any> {
    const rows = await tenantDb.query(
      `SELECT * FROM post_visit_sessions WHERE id = $1 LIMIT 1`,
      [sessionId],
    );
    if (!rows?.length) throw new NotFoundException('Post-visit session not found');
    return rows[0];
  }

  // ── Feature flags ────────────────────────────────────────────────────────────

  private isIntraVisitAlertsEnabled(): boolean {
    const v = process.env.POST_VISIT_INTRAVISIT_ALERTS_ENABLED;
    if (v === undefined || v === null) return true; // on by default
    return !['false', '0', 'off', 'no'].includes(v.toLowerCase());
  }

  private normalizeMetadata(metadata: any): Record<string, any> {
    if (!metadata) return {};
    if (typeof metadata === 'string') {
      try {
        return JSON.parse(metadata);
      } catch {
        return {};
      }
    }
    return typeof metadata === 'object' ? metadata : {};
  }

  private buildEscalationTrustSummary(row: any, metadata: Record<string, any>) {
    const classificationSource = String(row.classification_source || row.classificationSource || '').trim().toLowerCase();
    const triggerType = String(row.trigger_type || row.triggerType || '').trim().toLowerCase();
    const linkedPatientAiSessionId = metadata.patient_ai_session_id || null;
    const linkedPatientAiEscalationId = metadata.patient_ai_escalation_id || null;
    const linkedFollowupOrchestrationId = metadata.patient_followup_orchestration_id || null;

    let backingType = 'Companion workflow';
    let sourceLabel = 'Post-visit companion';

    if (linkedPatientAiSessionId || linkedPatientAiEscalationId) {
      backingType = 'Patient AI linked';
      sourceLabel = 'Post-visit companion + patient AI';
    } else if (classificationSource.startsWith('keyword') || triggerType === 'symptom_keyword') {
      backingType = 'Rule-backed safety logic';
      sourceLabel = 'Keyword escalation policy';
    } else if (classificationSource) {
      backingType = 'Governed classifier';
      sourceLabel = classificationSource.replace(/_/g, ' ');
    }

    const reviewState =
      row.status === 'resolved'
        ? 'Resolved by clinician'
        : row.status === 'dismissed'
          ? 'Dismissed by clinician'
          : row.status === 'acknowledged'
            ? 'Acknowledged and awaiting closure'
            : 'Open clinician review';

    return {
      sourceLabel,
      backingType,
      reviewState,
      classifierStage: row.classification_stage || row.classificationStage || 'v1',
      linkedPatientAiSessionId,
      linkedPatientAiEscalationId,
      linkedFollowupOrchestrationId,
    };
  }

  // ── Row mappers ──────────────────────────────────────────────────────────────

  private mapEscalationEvent(row: any) {
    const metadata = this.normalizeMetadata(row.metadata);
    return {
      id: row.id,
      sessionId: row.session_id,
      patientId: row.patient_id,
      threadId: row.thread_id || null,
      messageId: row.message_id || null,
      status: row.status,
      severity: row.severity,
      routeTarget: row.route_target,
      triggerType: row.trigger_type,
      triggerTerms: row.trigger_terms || [],
      signalText: row.signal_text || null,
      classificationConfidence:
        row.classification_confidence == null ? null : Number(row.classification_confidence),
      classificationTemporality: row.classification_temporality || null,
      classificationSource: row.classification_source || null,
      classificationReason: row.classification_reason || null,
      classificationStage: row.classification_stage || 'v1',
      detectedAt: row.detected_at,
      slaDueAt: row.sla_due_at || null,
      acknowledgedAt: row.acknowledged_at || null,
      acknowledgedBy: row.acknowledged_by || null,
      resolvedAt: row.resolved_at || null,
      resolvedBy: row.resolved_by || null,
      resolutionNote: row.resolution_note || null,
      workflowKey: row.workflow_key || null,
      metadata,
      trustSummary: this.buildEscalationTrustSummary(row, metadata),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapIntraVisitAlertEvent(row: any) {
    const acknowledgedAt = row.acknowledged_at || null;
    const slaDueAt = row.sla_due_at || null;
    return {
      id: row.id,
      sessionId: row.session_id,
      patientId: row.patient_id,
      status: row.status,
      alertType: row.alert_type,
      severity: row.severity,
      routeTarget: row.route_target || 'doctor',
      assignedRole: row.assigned_role || 'doctor',
      assignedUserId: row.assigned_user_id || null,
      assignedTeam: row.assigned_team || null,
      policyVersion: row.policy_version || 'c3.v1',
      routingRationale: row.routing_rationale || null,
      source: row.source || 'streamed_transcript',
      transcriptOffsetSeconds:
        row.transcript_offset_seconds == null ? null : Number(row.transcript_offset_seconds),
      signalText: row.signal_text || null,
      alertMessage: row.alert_message,
      suggestedAction: row.suggested_action || null,
      confidence: row.confidence == null ? null : Number(row.confidence),
      triggerTerms: Array.isArray(row.trigger_terms) ? row.trigger_terms : [],
      metadata: row.metadata || {},
      detectedAt: row.detected_at,
      slaDueAt,
      isAcknowledged: acknowledgedAt !== null,
      acknowledgedAt,
      acknowledgedBy: row.acknowledged_by || null,
      acknowledgmentNote: row.acknowledgment_note || null,
      resolvedAt: row.resolved_at || null,
      resolvedBy: row.resolved_by || null,
      resolutionNote: row.resolution_note || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ── Public methods ───────────────────────────────────────────────────────────

  async listEscalations(
    tenantDb: DataSource,
    filters: {
      status?: 'open' | 'acknowledged' | 'resolved' | 'dismissed';
      severity?: 'low' | 'moderate' | 'high' | 'critical';
      routeTarget?: 'emergency' | 'doctor' | 'nurse';
      triggerType?: string;
      temporality?: 'current' | 'historical' | 'unclear';
      minConfidence?: number;
      sessionId?: string;
      patientId?: string;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    await this.assertSchema(tenantDb);

    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters.status)      { conditions.push(`e.status = $${idx++}`); params.push(filters.status); }
    if (filters.severity)    { conditions.push(`e.severity = $${idx++}`); params.push(filters.severity); }
    if (filters.routeTarget) { conditions.push(`e.route_target = $${idx++}`); params.push(filters.routeTarget); }
    if (filters.triggerType) { conditions.push(`e.trigger_type = $${idx++}`); params.push(String(filters.triggerType)); }
    if (filters.temporality) { conditions.push(`e.classification_temporality = $${idx++}`); params.push(filters.temporality); }
    if (typeof filters.minConfidence === 'number' && Number.isFinite(filters.minConfidence)) {
      conditions.push(`COALESCE(e.classification_confidence, 0) >= $${idx++}`);
      params.push(Math.max(0, Math.min(1, Number(filters.minConfidence))));
    }
    if (filters.sessionId)  { conditions.push(`e.session_id = $${idx++}`); params.push(filters.sessionId); }
    if (filters.patientId)  { conditions.push(`e.patient_id = $${idx++}`); params.push(filters.patientId); }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit  = Math.min(Math.max(Number(filters.limit  || 50), 1), 200);
    const offset = Math.max(Number(filters.offset || 0), 0);

    const rows = await tenantDb.query(
      `SELECT e.*, p.first_name, p.last_name, p.patient_number
       FROM post_visit_escalation_events e
       LEFT JOIN patients p ON p.id = e.patient_id
       ${whereSql}
       ORDER BY e.detected_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset],
    );

    const [summary] = await tenantDb.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'open')::int AS open_count,
         COUNT(*) FILTER (WHERE severity IN ('high','critical') AND status IN ('open','acknowledged'))::int AS high_priority_open_count
       FROM post_visit_escalation_events e ${whereSql}`,
      params,
    );

    return {
      escalations: rows.map((row: any) => ({
        ...this.mapEscalationEvent(row),
        patient: {
          id: row.patient_id,
          firstName: row.first_name || null,
          lastName: row.last_name || null,
          patientNumber: row.patient_number || null,
        },
      })),
      summary: {
        total: Number(summary?.total || 0),
        openCount: Number(summary?.open_count || 0),
        highPriorityOpenCount: Number(summary?.high_priority_open_count || 0),
      },
      paging: { limit, offset },
    };
  }

  async resolveEscalation(
    tenantDb: DataSource,
    escalationId: string,
    payload: { status?: 'resolved' | 'dismissed'; resolutionNote?: string } = {},
    options: { actorUserId?: string | null } = {},
  ) {
    await this.assertSchema(tenantDb);
    if (!options.actorUserId) {
      throw new BadRequestException('Authenticated user is required to resolve escalation');
    }

    const [existing] = await tenantDb.query(
      `SELECT * FROM post_visit_escalation_events WHERE id = $1 LIMIT 1`,
      [escalationId],
    );
    if (!existing) throw new NotFoundException('Post-visit escalation not found');

    const targetStatus = payload.status || 'resolved';
    const [updated] = await tenantDb.query(
      `UPDATE post_visit_escalation_events
       SET status = $2,
           resolved_at = NOW(),
           resolved_by = $3,
           resolution_note = COALESCE($4, resolution_note),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [escalationId, targetStatus, options.actorUserId, payload.resolutionNote || null],
    );

    if (existing.workflow_key) {
      await tenantDb.query(
        `UPDATE nurse_cross_module_workflow_state
         SET status = 'completed', completed_by = $2, completed_at = NOW(),
             note = COALESCE($3, note), updated_at = NOW()
         WHERE workflow_key = $1`,
        [existing.workflow_key, options.actorUserId, payload.resolutionNote || null],
      ).catch((e: any) => {
        if (!String(e?.message || '').includes('nurse_cross_module_workflow_state')) throw e;
      });
    }

    return this.mapEscalationEvent(updated);
  }

  async listIntraVisitAlerts(
    tenantDb: DataSource,
    sessionId: string,
    filters: { status?: 'open' | 'confirmed' | 'dismissed'; limit?: number; offset?: number } = {},
  ) {
    await this.assertSchema(tenantDb);
    await this.getSessionRow(tenantDb, sessionId);

    const limit  = Math.min(Math.max(Number(filters.limit  || 30), 1), 200);
    const offset = Math.max(Number(filters.offset || 0), 0);

    if (!this.isIntraVisitAlertsEnabled()) {
      return {
        featureEnabled: false, sessionId, items: [],
        summary: { total: 0, openCount: 0, acknowledgedOpenCount: 0, overdueUnacknowledgedCount: 0, criticalOpenCount: 0, highOpenCount: 0, moderateOpenCount: 0 },
        paging: { limit, offset },
      };
    }

    const params: any[] = [sessionId];
    let whereSql = 'WHERE session_id = $1';
    if (filters.status && ['open', 'confirmed', 'dismissed'].includes(filters.status)) {
      params.push(filters.status);
      whereSql += ` AND status = $${params.length}`;
    }
    params.push(limit, offset);

    const rows = await tenantDb.query(
      `SELECT * FROM post_visit_intravisit_alert_events
       ${whereSql}
       ORDER BY detected_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const [s] = await tenantDb.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'open')::int AS open_count,
         COUNT(*) FILTER (WHERE status = 'open' AND acknowledged_at IS NOT NULL)::int AS acknowledged_open_count,
         COUNT(*) FILTER (WHERE status = 'open' AND acknowledged_at IS NULL AND sla_due_at IS NOT NULL AND sla_due_at < NOW())::int AS overdue_unacknowledged_count,
         COUNT(*) FILTER (WHERE status = 'open' AND severity = 'critical')::int AS critical_open_count,
         COUNT(*) FILTER (WHERE status = 'open' AND severity = 'high')::int AS high_open_count,
         COUNT(*) FILTER (WHERE status = 'open' AND severity = 'moderate')::int AS moderate_open_count
       FROM post_visit_intravisit_alert_events WHERE session_id = $1`,
      [sessionId],
    );

    return {
      featureEnabled: true,
      sessionId,
      items: rows.map((r: any) => this.mapIntraVisitAlertEvent(r)),
      summary: {
        total: Number(s?.total || 0),
        openCount: Number(s?.open_count || 0),
        acknowledgedOpenCount: Number(s?.acknowledged_open_count || 0),
        overdueUnacknowledgedCount: Number(s?.overdue_unacknowledged_count || 0),
        criticalOpenCount: Number(s?.critical_open_count || 0),
        highOpenCount: Number(s?.high_open_count || 0),
        moderateOpenCount: Number(s?.moderate_open_count || 0),
      },
      paging: { limit, offset },
    };
  }

  async acknowledgeIntraVisitAlert(
    tenantDb: DataSource,
    sessionId: string,
    alertId: string,
    payload: { note?: string } = {},
    options: { actorUserId?: string | null } = {},
  ) {
    await this.assertSchema(tenantDb);
    if (!options.actorUserId) {
      throw new BadRequestException('Authenticated user is required to acknowledge intra-visit alert');
    }
    await this.getSessionRow(tenantDb, sessionId);

    const [existing] = await tenantDb.query(
      `SELECT * FROM post_visit_intravisit_alert_events WHERE id = $1 AND session_id = $2 LIMIT 1`,
      [alertId, sessionId],
    );
    if (!existing) throw new NotFoundException('Intra-visit alert not found');
    if (String(existing.status || '').toLowerCase() !== 'open') {
      throw new BadRequestException('Only open intra-visit alerts can be acknowledged');
    }

    const [updated] = await tenantDb.query(
      `UPDATE post_visit_intravisit_alert_events
       SET acknowledged_at = COALESCE(acknowledged_at, NOW()),
           acknowledged_by = COALESCE(acknowledged_by, $3),
           acknowledgment_note = COALESCE($4, acknowledgment_note),
           updated_at = NOW()
       WHERE id = $1 AND session_id = $2
       RETURNING *`,
      [alertId, sessionId, options.actorUserId, payload.note || null],
    );

    this.hipaaAuditService?.logPhiModification(
      tenantDb, options.actorUserId, '', undefined,
      HipaaAuditAction.MEDICAL_RECORD_UPDATE, 'post_visit_intravisit_alert',
      alertId, existing.patient_id, undefined, undefined, undefined, undefined,
      sessionId, { action: 'acknowledge', sessionId },
    ).catch(() => {});

    return this.mapIntraVisitAlertEvent(updated);
  }

  async resolveIntraVisitAlert(
    tenantDb: DataSource,
    sessionId: string,
    alertId: string,
    payload: { status?: 'confirmed' | 'dismissed'; note?: string } = {},
    options: { actorUserId?: string | null } = {},
  ) {
    await this.assertSchema(tenantDb);
    if (!options.actorUserId) {
      throw new BadRequestException('Authenticated user is required to resolve intra-visit alert');
    }
    await this.getSessionRow(tenantDb, sessionId);

    const [existing] = await tenantDb.query(
      `SELECT * FROM post_visit_intravisit_alert_events WHERE id = $1 AND session_id = $2 LIMIT 1`,
      [alertId, sessionId],
    );
    if (!existing) throw new NotFoundException('Intra-visit alert not found');

    const targetStatus = payload.status === 'dismissed' ? 'dismissed' : 'confirmed';
    const [updated] = await tenantDb.query(
      `UPDATE post_visit_intravisit_alert_events
       SET status = $3,
           acknowledged_at = COALESCE(acknowledged_at, NOW()),
           acknowledged_by = COALESCE(acknowledged_by, $4),
           acknowledgment_note = COALESCE(acknowledgment_note, $5),
           resolved_at = NOW(),
           resolved_by = $4,
           resolution_note = COALESCE($5, resolution_note),
           updated_at = NOW()
       WHERE id = $1 AND session_id = $2
       RETURNING *`,
      [alertId, sessionId, targetStatus, options.actorUserId, payload.note || null],
    );

    this.hipaaAuditService?.logPhiModification(
      tenantDb, options.actorUserId, '', undefined,
      HipaaAuditAction.MEDICAL_RECORD_UPDATE, 'post_visit_intravisit_alert',
      alertId, existing.patient_id, undefined, undefined, undefined, undefined,
      sessionId, { action: 'resolve', status: targetStatus, sessionId },
    ).catch(() => {});

    return this.mapIntraVisitAlertEvent(updated);
  }
}
