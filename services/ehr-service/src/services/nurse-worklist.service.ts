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

  async getCrossModuleEscalationFeed(tenantDb: DataSource) {
    const [maternityTasks, hivEnrollments, approvedRegimenChanges] = await Promise.all([
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
          me.enrollment_number
        FROM maternity_care_tasks t
        INNER JOIN patients p ON p.id = t.patient_id
        INNER JOIN maternity_enrollments me ON me.id = t.maternity_enrollment_id
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
          r.current_regimen_name,
          r.requested_regimen_name,
          r.change_reason_details,
          r.clinical_justification,
          r.approved_by_name,
          e.patient_id,
          e.enrollment_number,
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
    ]);

    const maternityItems = (maternityTasks || []).map((task: any) => ({
      id: `maternity:${task.id}`,
      module: 'maternity',
      item_type: 'maternity_care_task',
      severity: task.priority || 'medium',
      workflow_status: task.status,
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

        return [
          {
            id: `hiv-pathway:${enrollment.id}:${status}`,
            module: 'hiv',
            item_type: 'hiv_vl_followup',
            severity,
            workflow_status: status,
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
            metadata: {
              last_vl_value: pathway.lastVlValue ?? enrollment.last_viral_load ?? null,
              last_vl_date: pathway.lastVlDate ?? enrollment.last_viral_load_date ?? null,
              next_vl_date: pathway.nextVlDate ?? null,
              actions: pathway.actions || [],
            },
          },
        ];
      });

    const hivRegimenItems = (approvedRegimenChanges || []).map((request: any) => ({
      id: `hiv-regimen:${request.id}`,
      module: 'hiv',
      item_type: 'hiv_regimen_change',
      severity: 'high',
      workflow_status: 'doctor_approved_pending_nurse_record',
      doctor_sync_status: 'doctor_approved',
      title: 'Doctor-approved HIV regimen change awaiting nurse follow-through',
      summary: `${request.patient_name} has an approved regimen change from ${request.current_regimen_name || 'current regimen'} to ${request.requested_regimen_name || 'new regimen'}.`,
      recommended_action: 'Record the approved regimen change during the next HIV clinical visit and confirm the patient counseling steps.',
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
      metadata: {
        approved_by_name: request.approved_by_name || null,
        current_regimen_name: request.current_regimen_name || null,
        requested_regimen_name: request.requested_regimen_name || null,
        change_reason_details: request.change_reason_details || null,
        clinical_justification: request.clinical_justification || null,
      },
    }));

    const items = [...maternityItems, ...hivRegimenItems, ...hivPathwayItems].sort((a, b) => {
      const severityDiff = this.getSeverityRank(b.severity) - this.getSeverityRank(a.severity);
      if (severityDiff !== 0) {
        return severityDiff;
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
      },
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
