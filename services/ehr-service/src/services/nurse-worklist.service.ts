import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HipaaAuditAction, HipaaAuditService } from './hipaa-audit.service';

@Injectable()
export class NurseWorklistService {
  constructor(private readonly hipaaAuditService: HipaaAuditService) {}

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
      userName:
        user.fullName ||
        [user.firstName, user.lastName].filter(Boolean).join(' ') ||
        user.email ||
        'Unknown',
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
      userName:
        user.fullName ||
        [user.firstName, user.lastName].filter(Boolean).join(' ') ||
        user.email ||
        'Unknown',
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
}
