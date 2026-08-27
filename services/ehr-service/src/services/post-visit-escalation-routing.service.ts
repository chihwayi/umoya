import { Injectable, Logger, Optional } from '@nestjs/common';
import { AlertDeliveryService, AlertPayload } from './alert-delivery.service';
import { TenantService } from './tenant.service';

export interface EscalationSignal {
  escalationLevel: 'low' | 'moderate' | 'high' | 'critical';
  summary: string;
  findings: string[];
  recommendedAction?: string;
}

@Injectable()
export class PostVisitEscalationRoutingService {
  private readonly logger = new Logger(PostVisitEscalationRoutingService.name);

  constructor(
    // Not @Optional() — both are always registered in ehr.module.ts. Making alertDelivery
    // optional meant a module-wiring mistake would silently disable critical/high alert
    // delivery at runtime instead of failing loudly at startup (S264).
    private readonly alertDelivery: AlertDeliveryService,
    @Optional() private readonly tenantService?: TenantService,
  ) {}

  /**
   * Route an escalation signal from the post-visit AI classifier.
   * Creates a nurse task in the DB, delivers an alert, and records the escalation lifecycle row.
   */
  async routeEscalation(
    sessionId: string,
    patientId: string,
    signal: EscalationSignal,
    db: any,
  ): Promise<string | null> {
    if (signal.escalationLevel === 'low') {
      this.logger.debug(`Escalation level low for session ${sessionId} — skipping routing`);
      return null;
    }

    const taskPriority =
      signal.escalationLevel === 'critical' ? 'urgent'
      : signal.escalationLevel === 'high' ? 'high'
      : 'normal';

    const [task] = await db.query(
      `INSERT INTO nurse_tasks
         (patient_id, task_type, title, description, priority, source, source_entity_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'open')
       RETURNING id`,
      [
        patientId,
        'post_visit_escalation',
        `Post-Visit Escalation: ${signal.escalationLevel.toUpperCase()}`,
        `${signal.summary}\n\nFindings:\n${signal.findings.map((f) => `• ${f}`).join('\n')}`,
        taskPriority,
        'post_visit_ai',
        sessionId,
      ],
    );

    const taskId: string = task?.id ?? null;

    const [esc] = await db.query(
      `INSERT INTO post_visit_escalations
         (post_visit_session_id, patient_id, escalation_level, signal_summary,
          detected_findings, nurse_task_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'routed')
       RETURNING id`,
      [
        sessionId,
        patientId,
        signal.escalationLevel,
        signal.summary,
        JSON.stringify(signal.findings),
        taskId,
      ],
    );

    const escalationId: string = esc?.id ?? null;

    if (signal.escalationLevel === 'critical' || signal.escalationLevel === 'high') {
      await this.deliverAlert(sessionId, patientId, escalationId, taskId, signal, db);
    }

    this.logger.log(
      `Escalation routed for session ${sessionId}: level=${signal.escalationLevel}, taskId=${taskId}`,
    );
    return escalationId;
  }

  async getOpenEscalations(db: any): Promise<any[]> {
    return db.query(
      `SELECT pve.*, p.first_name, p.last_name, p.mrn
       FROM post_visit_escalations pve
       JOIN patients p ON p.id = pve.patient_id
       WHERE pve.status IN ('detected', 'routed')
       ORDER BY
         CASE pve.escalation_level WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
         pve.created_at DESC
       LIMIT 100`,
    );
  }

  async acknowledgeEscalation(escalationId: string, userId: string, db: any): Promise<void> {
    await db.query(
      `UPDATE post_visit_escalations
       SET status = 'acknowledged', acknowledged_at = now(), acknowledged_by = $2, updated_at = now()
       WHERE id = $1`,
      [escalationId, userId],
    );
    await db.query(
      `UPDATE nurse_tasks SET status = 'in_progress', updated_at = now()
       WHERE source = 'post_visit_ai' AND source_entity_id IN (
         SELECT post_visit_session_id FROM post_visit_escalations WHERE id = $1
       )`,
      [escalationId],
    );
  }

  async resolveEscalation(
    escalationId: string,
    userId: string,
    resolutionNote: string,
    db: any,
  ): Promise<void> {
    await db.query(
      `UPDATE post_visit_escalations
       SET status = 'resolved', resolved_at = now(), resolved_by = $2,
           resolution_note = $3, updated_at = now()
       WHERE id = $1`,
      [escalationId, userId, resolutionNote],
    );
    await db.query(
      `UPDATE nurse_tasks SET status = 'completed', completed_at = now(), completed_by = $2, updated_at = now()
       WHERE source = 'post_visit_ai' AND source_entity_id IN (
         SELECT post_visit_session_id FROM post_visit_escalations WHERE id = $1
       )`,
      [escalationId, userId],
    );
  }

  /**
   * Delivers the critical/high-severity alert and records the outcome on the escalation
   * row rather than letting a failure vanish. Deliberately does NOT rethrow — the nurse
   * task and escalation DB record already exist and must stand regardless of whether the
   * push/SMS/websocket fan-out succeeds; a nurse can still find the task by working the
   * open-escalations list even if the alert failed to reach anyone in real time.
   */
  private async deliverAlert(
    sessionId: string,
    patientId: string,
    escalationId: string,
    taskId: string,
    signal: EscalationSignal,
    db: any,
  ): Promise<void> {
    let failureReason: string | null = null;

    const subdomain = await this.resolveTenantSubdomain(db);
    if (!subdomain) {
      failureReason = 'Could not resolve tenant subdomain for alert delivery';
    } else {
      const alertPayload: AlertPayload = {
        alertType: 'post_visit_escalation',
        sourceEntityId: sessionId,
        patientId,
        severity: signal.escalationLevel,
        message: signal.summary,
        payload: {
          findings: signal.findings,
          taskId,
          escalationId,
          sourceService: 'PostVisitEscalationRoutingService',
        },
      };
      try {
        const result = await this.alertDelivery.broadcastCriticalAlert(subdomain, alertPayload);
        if (!result.delivered) {
          failureReason = 'No on-call staff found to receive the alert';
        }
      } catch (err: any) {
        failureReason = err?.message || 'broadcastCriticalAlert threw an unknown error';
      }
    }

    if (failureReason) {
      this.logger.error(
        `Alert delivery failed for escalation ${escalationId} (session ${sessionId}, level ${signal.escalationLevel}): ${failureReason}`,
      );
      await db
        .query(
          `UPDATE post_visit_escalations
           SET alert_delivery_failed = true, alert_delivery_error = $2, updated_at = now()
           WHERE id = $1`,
          [escalationId, failureReason],
        )
        .catch((updateErr: any) =>
          this.logger.error(`Also failed to record the alert-delivery failure itself: ${updateErr?.message}`),
        );
    }
  }

  private async resolveTenantSubdomain(db: any): Promise<string | null> {
    if (!this.tenantService) return null;
    try {
      const dbName = db.options?.database ?? '';
      const tenants = await this.tenantService.getAllActiveTenants();
      const found = tenants.find((t) => t.databaseName === dbName);
      return found?.subdomain ?? null;
    } catch {
      return null;
    }
  }
}
