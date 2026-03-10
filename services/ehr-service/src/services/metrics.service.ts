import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as promClient from 'prom-client';
import { DataSource } from 'typeorm';

/**
 * Prometheus Metrics Service
 * Exposes metrics for monitoring and observability
 */
@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly register: promClient.Registry;

  // CDSS Hook Metrics
  private readonly cdssHookCounter: promClient.Counter;
  private readonly cdssHookDuration: promClient.Histogram;
  private readonly cdssHookErrors: promClient.Counter;
  private readonly cdssDependencyRetryCounter: promClient.Counter;
  private readonly cdssDependencyTimeoutCounter: promClient.Counter;
  private readonly cdssAbstentionCounter: promClient.Counter;
  private readonly nurseCopilotRecommendationCounter: promClient.Counter;
  private readonly nurseCopilotDecisionCounter: promClient.Counter;
  private readonly nurseCopilotTimeToTriage: promClient.Histogram;
  private readonly nurseCopilotDocumentationDuration: promClient.Histogram;
  private readonly nurseCopilotAlertResponseDuration: promClient.Histogram;

  private readonly nurseCopilotKpiState = {
    recommendationsTotal: 0,
    decisionsTotal: 0,
    decisionsByType: {} as Record<string, number>,
    recommendationsByType: {} as Record<string, number>,
    timeToTriageSamples: 0,
    timeToTriageTotalSeconds: 0,
    documentationSamples: 0,
    documentationTotalSeconds: 0,
    alertResponseSamples: 0,
    alertResponseTotalSeconds: 0,
  };

  // Provisioning Metrics
  private readonly provisioningCounter: promClient.Counter;
  private readonly provisioningDuration: promClient.Histogram;
  private readonly provisioningErrors: promClient.Counter;

  // Automation Metrics
  private readonly automationCounter: promClient.Counter;
  private readonly automationErrors: promClient.Counter;

  // SNOMED/ICD-10 Metrics
  private readonly snomedSearchCounter: promClient.Counter;
  private readonly icd10MappingCounter: promClient.Counter;

  constructor() {
    this.register = new promClient.Registry();
    promClient.collectDefaultMetrics({ register: this.register });

    // CDSS Hook Metrics
    this.cdssHookCounter = new promClient.Counter({
      name: 'cdss_hooks_total',
      help: 'Total number of CDSS hooks triggered',
      labelNames: ['event_type', 'status', 'tenant_id'],
      registers: [this.register],
    });

    this.cdssHookDuration = new promClient.Histogram({
      name: 'cdss_hook_duration_seconds',
      help: 'CDSS hook processing duration in seconds',
      labelNames: ['event_type', 'tenant_id'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.register],
    });

    this.cdssHookErrors = new promClient.Counter({
      name: 'cdss_hook_errors_total',
      help: 'Total number of CDSS hook errors',
      labelNames: ['event_type', 'error_type', 'tenant_id'],
      registers: [this.register],
    });

    this.cdssDependencyRetryCounter = new promClient.Counter({
      name: 'cdss_dependency_retries_total',
      help: 'Total number of EHR to CDSS retry attempts',
      labelNames: ['event_type', 'reason', 'tenant_id'],
      registers: [this.register],
    });

    this.cdssDependencyTimeoutCounter = new promClient.Counter({
      name: 'cdss_dependency_timeouts_total',
      help: 'Total number of EHR to CDSS timeout failures',
      labelNames: ['event_type', 'tenant_id'],
      registers: [this.register],
    });

    this.cdssAbstentionCounter = new promClient.Counter({
      name: 'cdss_abstentions_total',
      help: 'Total number of CDSS abstained responses observed by EHR proxy',
      labelNames: ['event_type', 'reason', 'tenant_id'],
      registers: [this.register],
    });

    this.nurseCopilotRecommendationCounter = new promClient.Counter({
      name: 'nurse_copilot_recommendations_total',
      help: 'Total nurse copilot recommendations emitted by type and risk level',
      labelNames: ['copilot_type', 'risk_level'],
      registers: [this.register],
    });

    this.nurseCopilotDecisionCounter = new promClient.Counter({
      name: 'nurse_copilot_decisions_total',
      help: 'Total nurse copilot decisions by copilot type and decision',
      labelNames: ['copilot_type', 'decision'],
      registers: [this.register],
    });

    this.nurseCopilotTimeToTriage = new promClient.Histogram({
      name: 'nurse_copilot_time_to_triage_seconds',
      help: 'Elapsed time from queue entry to copilot triage recommendation',
      buckets: [30, 60, 120, 300, 600, 900, 1800],
      registers: [this.register],
    });

    this.nurseCopilotDocumentationDuration = new promClient.Histogram({
      name: 'nurse_copilot_documentation_duration_seconds',
      help: 'Elapsed time from documentation start to copilot note/handoff output',
      labelNames: ['documentation_type'],
      buckets: [15, 30, 60, 120, 300, 600, 900],
      registers: [this.register],
    });

    this.nurseCopilotAlertResponseDuration = new promClient.Histogram({
      name: 'nurse_copilot_alert_response_seconds',
      help: 'Elapsed time from alert creation to nurse acknowledgement',
      buckets: [10, 30, 60, 120, 300, 600, 900, 1800],
      registers: [this.register],
    });

    // Provisioning Metrics
    this.provisioningCounter = new promClient.Counter({
      name: 'provisioning_operations_total',
      help: 'Total number of provisioning operations',
      labelNames: ['bundle_id', 'status'],
      registers: [this.register],
    });

    this.provisioningDuration = new promClient.Histogram({
      name: 'provisioning_duration_seconds',
      help: 'Provisioning operation duration in seconds',
      labelNames: ['bundle_id'],
      buckets: [1, 5, 10, 30, 60, 300],
      registers: [this.register],
    });

    this.provisioningErrors = new promClient.Counter({
      name: 'provisioning_errors_total',
      help: 'Total number of provisioning errors',
      labelNames: ['bundle_id', 'error_type'],
      registers: [this.register],
    });

    // Automation Metrics
    this.automationCounter = new promClient.Counter({
      name: 'automation_jobs_total',
      help: 'Total number of automation jobs executed',
      labelNames: ['job_type', 'status'],
      registers: [this.register],
    });

    this.automationErrors = new promClient.Counter({
      name: 'automation_errors_total',
      help: 'Total number of automation job errors',
      labelNames: ['job_type'],
      registers: [this.register],
    });

    // SNOMED/ICD-10 Metrics
    this.snomedSearchCounter = new promClient.Counter({
      name: 'snomed_searches_total',
      help: 'Total number of SNOMED searches',
      labelNames: ['status'],
      registers: [this.register],
    });

    this.icd10MappingCounter = new promClient.Counter({
      name: 'icd10_mappings_total',
      help: 'Total number of ICD-10 mapping lookups',
      labelNames: ['status'],
      registers: [this.register],
    });
  }

  private ensureTenantDb(tenantDb: DataSource) {
    if (!tenantDb) {
      throw new BadRequestException('Tenant database connection required');
    }
  }

  private isMissingRelationError(error: unknown): boolean {
    const code = (error as any)?.code;
    const message = String((error as any)?.message || '').toLowerCase();
    return (
      code === '42P01' ||
      (message.includes('relation') && message.includes('does not exist'))
    );
  }

  private async safeSnapshotRow<T>(
    tenantDb: DataSource,
    query: string,
    fallback: T,
    description: string,
  ): Promise<T> {
    try {
      const rows = await tenantDb.query(query);
      return (rows?.[0] || fallback) as T;
    } catch (error) {
      if (this.isMissingRelationError(error)) {
        this.logger.warn(`Workflow snapshot skipped missing relation for ${description}`);
        return fallback;
      }
      throw error;
    }
  }

  // CDSS Hook Metrics
  private normalizeTenantId(tenantId?: string): string {
    const raw = String(tenantId || 'unknown').trim().toLowerCase();
    if (!raw) {
      return 'unknown';
    }
    return raw.replace(/[^a-z0-9._-]/g, '_').slice(0, 80) || 'unknown';
  }

  recordCdssHook(eventType: string, status: 'success' | 'error', durationSeconds?: number, tenantId?: string) {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    this.cdssHookCounter.inc({ event_type: eventType, status, tenant_id: normalizedTenantId });
    if (durationSeconds !== undefined) {
      this.cdssHookDuration.observe({ event_type: eventType, tenant_id: normalizedTenantId }, durationSeconds);
    }
    if (status === 'error') {
      this.cdssHookErrors.inc({ event_type: eventType, error_type: 'unknown', tenant_id: normalizedTenantId });
    }
  }

  recordCdssHookError(eventType: string, errorType: string, tenantId?: string) {
    this.cdssHookErrors.inc({
      event_type: eventType,
      error_type: errorType,
      tenant_id: this.normalizeTenantId(tenantId),
    });
  }

  recordCdssRetry(eventType: string, reason: string, tenantId?: string) {
    this.cdssDependencyRetryCounter.inc({
      event_type: eventType,
      reason,
      tenant_id: this.normalizeTenantId(tenantId),
    });
  }

  recordCdssTimeout(eventType: string, tenantId?: string) {
    this.cdssDependencyTimeoutCounter.inc({
      event_type: eventType,
      tenant_id: this.normalizeTenantId(tenantId),
    });
  }

  recordCdssAbstention(eventType: string, reason?: string, tenantId?: string) {
    this.cdssAbstentionCounter.inc({
      event_type: eventType,
      reason: (reason || 'unspecified').toString().trim().toLowerCase() || 'unspecified',
      tenant_id: this.normalizeTenantId(tenantId),
    });
  }

  recordNurseCopilotRecommendation(copilotType: string, riskLevel?: string) {
    const type = (copilotType || 'unknown').toLowerCase();
    const risk = (riskLevel || 'unknown').toLowerCase();
    this.nurseCopilotRecommendationCounter.inc({ copilot_type: type, risk_level: risk });
    this.nurseCopilotKpiState.recommendationsTotal += 1;
    this.nurseCopilotKpiState.recommendationsByType[type] =
      (this.nurseCopilotKpiState.recommendationsByType[type] || 0) + 1;
  }

  recordNurseCopilotDecision(copilotType: string, decision: string) {
    const type = (copilotType || 'unknown').toLowerCase();
    const normalizedDecision = (decision || 'unknown').toLowerCase();
    this.nurseCopilotDecisionCounter.inc({ copilot_type: type, decision: normalizedDecision });
    this.nurseCopilotKpiState.decisionsTotal += 1;
    const stateKey = `${type}:${normalizedDecision}`;
    this.nurseCopilotKpiState.decisionsByType[stateKey] =
      (this.nurseCopilotKpiState.decisionsByType[stateKey] || 0) + 1;
  }

  recordNurseCopilotTimeToTriage(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return;
    }
    this.nurseCopilotTimeToTriage.observe(seconds);
    this.nurseCopilotKpiState.timeToTriageSamples += 1;
    this.nurseCopilotKpiState.timeToTriageTotalSeconds += seconds;
  }

  recordNurseCopilotDocumentationDuration(seconds: number, documentationType: 'note' | 'handoff' = 'note') {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return;
    }
    this.nurseCopilotDocumentationDuration.observe({ documentation_type: documentationType }, seconds);
    this.nurseCopilotKpiState.documentationSamples += 1;
    this.nurseCopilotKpiState.documentationTotalSeconds += seconds;
  }

  recordNurseCopilotAlertResponseTime(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return;
    }
    this.nurseCopilotAlertResponseDuration.observe(seconds);
    this.nurseCopilotKpiState.alertResponseSamples += 1;
    this.nurseCopilotKpiState.alertResponseTotalSeconds += seconds;
  }

  getNurseCopilotKpis() {
    const triageAvg =
      this.nurseCopilotKpiState.timeToTriageSamples > 0
        ? this.nurseCopilotKpiState.timeToTriageTotalSeconds / this.nurseCopilotKpiState.timeToTriageSamples
        : null;
    const documentationAvg =
      this.nurseCopilotKpiState.documentationSamples > 0
        ? this.nurseCopilotKpiState.documentationTotalSeconds / this.nurseCopilotKpiState.documentationSamples
        : null;
    const alertAvg =
      this.nurseCopilotKpiState.alertResponseSamples > 0
        ? this.nurseCopilotKpiState.alertResponseTotalSeconds / this.nurseCopilotKpiState.alertResponseSamples
        : null;

    return {
      recommendationsTotal: this.nurseCopilotKpiState.recommendationsTotal,
      decisionsTotal: this.nurseCopilotKpiState.decisionsTotal,
      recommendationsByType: this.nurseCopilotKpiState.recommendationsByType,
      decisionsByType: this.nurseCopilotKpiState.decisionsByType,
      timeToTriage: {
        samples: this.nurseCopilotKpiState.timeToTriageSamples,
        averageSeconds: triageAvg,
      },
      documentation: {
        samples: this.nurseCopilotKpiState.documentationSamples,
        averageSeconds: documentationAvg,
      },
      alertResponse: {
        samples: this.nurseCopilotKpiState.alertResponseSamples,
        averageSeconds: alertAvg,
      },
    };
  }

  async getWorkflowHealthSnapshot(tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const [
      hivEnrollmentSummary,
      hivMonitoringSummary,
      hivActionSummary,
      handoffSummary,
      triageSummary,
      abnormalVitalsSummary,
      labOrderSummary,
      imagingOrderSummary,
      labCriticalSummary,
      imagingResultSummary,
      claimStatusSummary,
      claimQualitySummary,
      claimTurnaroundSummary,
    ] = await Promise.all([
      this.safeSnapshotRow(
        tenantDb,
        `
        SELECT
          COUNT(*) FILTER (WHERE enrollment_status = 'active')::int AS active_enrollments,
          COUNT(*) FILTER (WHERE enrollment_status = 'lost_to_followup')::int AS lost_to_follow_up,
          COUNT(*) FILTER (WHERE enrollment_status = 'transferred_out')::int AS transferred_out,
          COUNT(*) FILTER (WHERE enrollment_status = 'deceased')::int AS deceased
        FROM hiv_care_enrollments
        `,
        {
          active_enrollments: 0,
          lost_to_follow_up: 0,
          transferred_out: 0,
          deceased: 0,
        },
        'hiv enrollments',
      ),
      this.safeSnapshotRow(
        tenantDb,
        `
        SELECT
          COUNT(*) FILTER (WHERE latest_visit.visit_date IS NULL)::int AS without_visit_history,
          COUNT(*) FILTER (
            WHERE latest_visit.visit_date IS NOT NULL
              AND latest_visit.visit_date < CURRENT_DATE - INTERVAL '90 days'
          )::int AS overdue_clinical_review,
          COUNT(*) FILTER (
            WHERE latest_visit.viral_load IS NOT NULL
              AND latest_visit.viral_load >= 1000
          )::int AS unsuppressed_latest_viral_load,
          COUNT(*) FILTER (
            WHERE latest_visit.viral_load_test_date IS NULL
              OR latest_visit.viral_load_test_date < CURRENT_DATE - INTERVAL '180 days'
          )::int AS overdue_viral_load_monitoring
        FROM hiv_care_enrollments e
        LEFT JOIN LATERAL (
          SELECT
            visit_date,
            viral_load,
            viral_load_test_date
          FROM hiv_clinical_visits v
          WHERE v.enrollment_id = e.id
          ORDER BY v.visit_date DESC, v.created_at DESC
          LIMIT 1
        ) latest_visit ON TRUE
        WHERE e.enrollment_status = 'active'
        `,
        {
          without_visit_history: 0,
          overdue_clinical_review: 0,
          unsuppressed_latest_viral_load: 0,
          overdue_viral_load_monitoring: 0,
        },
        'hiv monitoring',
      ),
      this.safeSnapshotRow(
        tenantDb,
        `
        SELECT
          COUNT(*) FILTER (WHERE request_summary.pending_request)::int AS pending_arv_change_requests,
          COUNT(*) FILTER (
            WHERE latest_visit.viral_load IS NOT NULL
              AND latest_visit.viral_load >= 1000
              AND NOT EXISTS (
                SELECT 1
                FROM hiv_eac_sessions session
                WHERE session.enrollment_id = e.id
                  AND session.session_date >= CURRENT_DATE - INTERVAL '90 days'
              )
          )::int AS unsuppressed_without_recent_eac,
          COUNT(*) FILTER (
            WHERE request_summary.approved_without_documented_visit
          )::int AS approved_regimen_changes_without_documented_visit
        FROM hiv_care_enrollments e
        LEFT JOIN LATERAL (
          SELECT
            viral_load
          FROM hiv_clinical_visits v
          WHERE v.enrollment_id = e.id
          ORDER BY v.visit_date DESC, v.created_at DESC
          LIMIT 1
        ) latest_visit ON TRUE
        LEFT JOIN LATERAL (
          SELECT
            BOOL_OR(status = 'pending') AS pending_request,
            BOOL_OR(status = 'approved' AND COALESCE(visit_recorded, false) = false) AS approved_without_documented_visit
          FROM hiv_arv_change_requests r
          WHERE r.enrollment_id = e.id
        ) request_summary ON TRUE
        WHERE e.enrollment_status = 'active'
        `,
        {
          pending_arv_change_requests: 0,
          unsuppressed_without_recent_eac: 0,
          approved_regimen_changes_without_documented_visit: 0,
        },
        'hiv action queues',
      ),
      this.safeSnapshotRow(
        tenantDb,
        `
        SELECT
          COUNT(*) FILTER (WHERE status = 'draft')::int AS draft_handoffs,
          COUNT(*) FILTER (WHERE status = 'finalized')::int AS finalized_pending_review,
          COUNT(*) FILTER (WHERE status = 'reviewed')::int AS reviewed_pending_share,
          COUNT(*) FILTER (WHERE status = 'shared')::int AS shared_handoffs,
          COUNT(*) FILTER (
            WHERE status IN ('draft', 'finalized', 'reviewed')
              AND updated_at < NOW() - INTERVAL '4 hours'
          )::int AS aging_open_handoffs
        FROM nurse_handoff_workflow_state
        `,
        {
          draft_handoffs: 0,
          finalized_pending_review: 0,
          reviewed_pending_share: 0,
          shared_handoffs: 0,
          aging_open_handoffs: 0,
        },
        'nurse handoff state',
      ),
      this.safeSnapshotRow(
        tenantDb,
        `
        SELECT
          COUNT(*) FILTER (WHERE recorded_at >= NOW() - INTERVAL '24 hours')::int AS last_24h_total,
          COUNT(*) FILTER (
            WHERE recorded_at >= NOW() - INTERVAL '24 hours'
              AND priority = 'urgent'
          )::int AS last_24h_urgent,
          COUNT(*) FILTER (
            WHERE recorded_at >= NOW() - INTERVAL '24 hours'
              AND priority = 'high'
          )::int AS last_24h_high,
          COALESCE(
            ROUND(
              AVG(severity_score) FILTER (WHERE recorded_at >= NOW() - INTERVAL '24 hours')::numeric,
              2
            ),
            0
          ) AS last_24h_average_severity
        FROM triage_assessments
        `,
        {
          last_24h_total: 0,
          last_24h_urgent: 0,
          last_24h_high: 0,
          last_24h_average_severity: 0,
        },
        'triage assessments',
      ),
      this.safeSnapshotRow(
        tenantDb,
        `
        SELECT
          COUNT(*) FILTER (
            WHERE recorded_at >= NOW() - INTERVAL '24 hours'
              AND (
                COALESCE(heart_rate, 0) >= 120
                OR COALESCE(oxygen_saturation, 100) < 92
                OR COALESCE(temperature, 0) >= 38.5
                OR COALESCE(respiratory_rate, 0) >= 24
              )
          )::int AS flagged_last_24h,
          COUNT(*) FILTER (
            WHERE recorded_at >= NOW() - INTERVAL '24 hours'
              AND COALESCE(oxygen_saturation, 100) < 92
          )::int AS low_oxygen_last_24h,
          COUNT(*) FILTER (
            WHERE recorded_at >= NOW() - INTERVAL '24 hours'
              AND COALESCE(temperature, 0) >= 38.5
          )::int AS fever_last_24h,
          COUNT(*) FILTER (
            WHERE recorded_at >= NOW() - INTERVAL '24 hours'
              AND COALESCE(respiratory_rate, 0) >= 24
          )::int AS tachypnea_last_24h
        FROM vitals
        `,
        {
          flagged_last_24h: 0,
          low_oxygen_last_24h: 0,
          fever_last_24h: 0,
          tachypnea_last_24h: 0,
        },
        'vitals abnormality baseline',
      ),
      this.safeSnapshotRow(
        tenantDb,
        `
        SELECT
          COUNT(*) FILTER (WHERE status IN ('ordered', 'collected', 'in_progress'))::int AS open_lab_orders,
          COUNT(*) FILTER (
            WHERE status = 'ordered'
              AND created_at < NOW() - INTERVAL '4 hours'
          )::int AS stale_uncollected_lab_orders,
          COUNT(*) FILTER (
            WHERE status = 'completed'
              AND reviewed_at IS NULL
          )::int AS completed_unreviewed_lab_orders
        FROM lab_orders
        `,
        {
          open_lab_orders: 0,
          stale_uncollected_lab_orders: 0,
          completed_unreviewed_lab_orders: 0,
        },
        'lab orders',
      ),
      this.safeSnapshotRow(
        tenantDb,
        `
        SELECT
          COUNT(*) FILTER (WHERE order_status IN ('ordered', 'scheduled', 'in_progress', 'awaiting_report'))::int AS open_imaging_orders,
          COUNT(*) FILTER (WHERE order_status = 'awaiting_report')::int AS imaging_awaiting_report,
          COUNT(*) FILTER (WHERE order_status = 'completed')::int AS completed_imaging_orders
        FROM imaging_orders
        `,
        {
          open_imaging_orders: 0,
          imaging_awaiting_report: 0,
          completed_imaging_orders: 0,
        },
        'imaging orders',
      ),
      this.safeSnapshotRow(
        tenantDb,
        `
        SELECT
          COUNT(*) FILTER (WHERE alert_status = 'pending')::int AS pending_count,
          COUNT(*) FILTER (WHERE alert_status = 'acknowledged')::int AS acknowledged_count,
          COUNT(*) FILTER (WHERE alert_status = 'escalated')::int AS escalated_count,
          COUNT(*) FILTER (
            WHERE alert_status = 'pending'
              AND alerted_at < NOW() - INTERVAL '30 minutes'
          )::int AS overdue_count
        FROM lab_critical_alerts
        WHERE created_at > NOW() - INTERVAL '7 days'
        `,
        {
          pending_count: 0,
          acknowledged_count: 0,
          escalated_count: 0,
          overdue_count: 0,
        },
        'lab critical alerts',
      ),
      this.safeSnapshotRow(
        tenantDb,
        `
        SELECT
          COUNT(*)::int AS awaiting_acknowledgement,
          COUNT(*) FILTER (
            WHERE COALESCE(r.is_critical, false) = true
          )::int AS critical_awaiting_acknowledgement
        FROM imaging_reports r
        INNER JOIN imaging_orders io ON io.id = r.imaging_order_id
        WHERE LOWER(COALESCE(r.report_status, '')) = 'final'
          AND (
            COALESCE(r.is_critical, false) = true
            OR COALESCE(r.follow_up_recommended, false) = true
          )
          AND NOT EXISTS (
            SELECT 1
            FROM imaging_report_acknowledgements ack
            WHERE ack.imaging_report_id = r.id
          )
        `,
        {
          awaiting_acknowledgement: 0,
          critical_awaiting_acknowledgement: 0,
        },
        'imaging actionable reports',
      ),
      this.safeSnapshotRow(
        tenantDb,
        `
        SELECT
          COUNT(*)::int AS total_claims,
          COUNT(*) FILTER (WHERE status = 'draft')::int AS draft_claims,
          COUNT(*) FILTER (WHERE status = 'submitted')::int AS submitted_claims,
          COUNT(*) FILTER (WHERE status = 'processing')::int AS processing_claims,
          COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected_claims,
          COUNT(*) FILTER (WHERE status = 'paid')::int AS paid_claims,
          COALESCE(
            ROUND(
              SUM(claim_amount) FILTER (WHERE status IN ('submitted', 'processing', 'approved'))::numeric,
              2
            ),
            0
          ) AS open_claim_amount
        FROM medical_aid_claims
        `,
        {
          total_claims: 0,
          draft_claims: 0,
          submitted_claims: 0,
          processing_claims: 0,
          rejected_claims: 0,
          paid_claims: 0,
          open_claim_amount: 0,
        },
        'claim status baseline',
      ),
      this.safeSnapshotRow(
        tenantDb,
        `
        SELECT
          COUNT(*) FILTER (
            WHERE status = 'draft'
              AND COALESCE(primary_diagnosis_code, '') = ''
              AND (diagnosis_codes IS NULL OR cardinality(diagnosis_codes) = 0)
          )::int AS draft_missing_diagnosis,
          COUNT(*) FILTER (
            WHERE status IN ('submitted', 'processing')
              AND submission_date < NOW() - INTERVAL '7 days'
          )::int AS aging_over_7_days,
          COUNT(*) FILTER (
            WHERE status IN ('submitted', 'processing')
              AND submission_date < NOW() - INTERVAL '30 days'
          )::int AS aging_over_30_days,
          COUNT(*) FILTER (
            WHERE status = 'rejected'
              AND COALESCE(rejection_reason, '') <> ''
          )::int AS rejected_with_reason
        FROM medical_aid_claims
        `,
        {
          draft_missing_diagnosis: 0,
          aging_over_7_days: 0,
          aging_over_30_days: 0,
          rejected_with_reason: 0,
        },
        'claim quality baseline',
      ),
      this.safeSnapshotRow(
        tenantDb,
        `
        SELECT
          COALESCE(
            ROUND(
              AVG(EXTRACT(EPOCH FROM (response_date - submission_date)) / 86400)::numeric,
              1
            ),
            0
          ) AS average_response_days
        FROM medical_aid_claims
        WHERE response_date IS NOT NULL
          AND submission_date IS NOT NULL
        `,
        {
          average_response_days: 0,
        },
        'claim turnaround baseline',
      ),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      hiv: {
        enrollments: {
          active: Number(hivEnrollmentSummary.active_enrollments || 0),
          lostToFollowUp: Number(hivEnrollmentSummary.lost_to_follow_up || 0),
          transferredOut: Number(hivEnrollmentSummary.transferred_out || 0),
          deceased: Number(hivEnrollmentSummary.deceased || 0),
        },
        monitoring: {
          withoutVisitHistory: Number(hivMonitoringSummary.without_visit_history || 0),
          overdueClinicalReview: Number(hivMonitoringSummary.overdue_clinical_review || 0),
          unsuppressedLatestViralLoad: Number(hivMonitoringSummary.unsuppressed_latest_viral_load || 0),
          overdueViralLoadMonitoring: Number(hivMonitoringSummary.overdue_viral_load_monitoring || 0),
        },
        actions: {
          pendingArvChangeRequests: Number(hivActionSummary.pending_arv_change_requests || 0),
          unsuppressedWithoutRecentEac: Number(hivActionSummary.unsuppressed_without_recent_eac || 0),
          approvedRegimenChangesWithoutDocumentedVisit: Number(
            hivActionSummary.approved_regimen_changes_without_documented_visit || 0,
          ),
        },
      },
      coordination: {
        handoffs: {
          draft: Number(handoffSummary.draft_handoffs || 0),
          finalizedPendingReview: Number(handoffSummary.finalized_pending_review || 0),
          reviewedPendingShare: Number(handoffSummary.reviewed_pending_share || 0),
          shared: Number(handoffSummary.shared_handoffs || 0),
          agingOpen: Number(handoffSummary.aging_open_handoffs || 0),
        },
        triage: {
          assessedLast24Hours: Number(triageSummary.last_24h_total || 0),
          urgentLast24Hours: Number(triageSummary.last_24h_urgent || 0),
          highPriorityLast24Hours: Number(triageSummary.last_24h_high || 0),
          averageSeverityLast24Hours: Number(triageSummary.last_24h_average_severity || 0),
        },
        abnormalVitals: {
          flaggedLast24Hours: Number(abnormalVitalsSummary.flagged_last_24h || 0),
          lowOxygenLast24Hours: Number(abnormalVitalsSummary.low_oxygen_last_24h || 0),
          feverLast24Hours: Number(abnormalVitalsSummary.fever_last_24h || 0),
          tachypneaLast24Hours: Number(abnormalVitalsSummary.tachypnea_last_24h || 0),
        },
        orders: {
          openLabOrders: Number(labOrderSummary.open_lab_orders || 0),
          staleUncollectedLabOrders: Number(labOrderSummary.stale_uncollected_lab_orders || 0),
          completedUnreviewedLabOrders: Number(labOrderSummary.completed_unreviewed_lab_orders || 0),
          openImagingOrders: Number(imagingOrderSummary.open_imaging_orders || 0),
          imagingAwaitingReport: Number(imagingOrderSummary.imaging_awaiting_report || 0),
        },
        criticalResults: {
          pendingLabAlerts7d: Number(labCriticalSummary.pending_count || 0),
          escalatedLabAlerts7d: Number(labCriticalSummary.escalated_count || 0),
          overdueLabAlerts7d: Number(labCriticalSummary.overdue_count || 0),
          imagingAwaitingAcknowledgement: Number(imagingResultSummary.awaiting_acknowledgement || 0),
          criticalImagingAwaitingAcknowledgement: Number(
            imagingResultSummary.critical_awaiting_acknowledgement || 0,
          ),
        },
      },
      revenueCycle: {
        claims: {
          total: Number(claimStatusSummary.total_claims || 0),
          draft: Number(claimStatusSummary.draft_claims || 0),
          submitted: Number(claimStatusSummary.submitted_claims || 0),
          processing: Number(claimStatusSummary.processing_claims || 0),
          rejected: Number(claimStatusSummary.rejected_claims || 0),
          paid: Number(claimStatusSummary.paid_claims || 0),
          openClaimAmount: Number(claimStatusSummary.open_claim_amount || 0),
        },
        quality: {
          draftMissingDiagnosis: Number(claimQualitySummary.draft_missing_diagnosis || 0),
          agingOver7Days: Number(claimQualitySummary.aging_over_7_days || 0),
          agingOver30Days: Number(claimQualitySummary.aging_over_30_days || 0),
          rejectedWithReason: Number(claimQualitySummary.rejected_with_reason || 0),
          averageResponseDays: Number(claimTurnaroundSummary.average_response_days || 0),
        },
      },
    };
  }

  // Provisioning Metrics
  recordProvisioning(bundleId: string, status: 'success' | 'error', durationSeconds?: number) {
    this.provisioningCounter.inc({ bundle_id: bundleId, status });
    if (durationSeconds !== undefined) {
      this.provisioningDuration.observe({ bundle_id: bundleId }, durationSeconds);
    }
    if (status === 'error') {
      this.provisioningErrors.inc({ bundle_id: bundleId, error_type: 'unknown' });
    }
  }

  recordProvisioningError(bundleId: string, errorType: string) {
    this.provisioningErrors.inc({ bundle_id: bundleId, error_type: errorType });
  }

  // Automation Metrics
  recordAutomationJob(jobType: string, status: 'success' | 'error') {
    this.automationCounter.inc({ job_type: jobType, status });
    if (status === 'error') {
      this.automationErrors.inc({ job_type: jobType });
    }
  }

  recordAutomationError(jobType: string) {
    this.automationErrors.inc({ job_type: jobType });
  }

  // SNOMED/ICD-10 Metrics
  recordSnomedSearch(status: 'success' | 'error') {
    this.snomedSearchCounter.inc({ status });
  }

  recordIcd10Mapping(status: 'success' | 'error') {
    this.icd10MappingCounter.inc({ status });
  }

  // Get metrics in Prometheus format
  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  // Get metrics registry
  getRegister(): promClient.Registry {
    return this.register;
  }
}
