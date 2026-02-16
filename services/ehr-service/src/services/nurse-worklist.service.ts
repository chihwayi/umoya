import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HipaaAuditAction, HipaaAuditService } from './hipaa-audit.service';

@Injectable()
export class NurseWorklistService {
  constructor(private readonly hipaaAuditService: HipaaAuditService) {}

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
    payload?: { reason?: string; patientId?: string; context?: any },
    requestMeta?: { ipAddress?: string; userAgent?: string; sessionId?: string },
  ) {
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
        [user.id, taskId, payload?.patientId || null, payload?.reason || null, JSON.stringify(payload?.context || null)],
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
        reason: payload?.reason || null,
        context: payload?.context || null,
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
    payload?: { reason?: string; patientId?: string; context?: any },
    requestMeta?: { ipAddress?: string; userAgent?: string; sessionId?: string },
  ) {
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
        [user.id, alertId, payload?.patientId || null, payload?.reason || null, JSON.stringify(payload?.context || null)],
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
        reason: payload?.reason || null,
        context: payload?.context || null,
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
