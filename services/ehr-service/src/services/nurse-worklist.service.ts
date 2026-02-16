import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HipaaAuditAction, HipaaAuditService } from './hipaa-audit.service';

@Injectable()
export class NurseWorklistService {
  constructor(private readonly hipaaAuditService: HipaaAuditService) {}

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
