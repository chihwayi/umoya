import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  it('returns default nurse copilot KPI snapshot', () => {
    const snapshot = service.getNurseCopilotKpis();
    expect(snapshot.recommendationsTotal).toBe(0);
    expect(snapshot.decisionsTotal).toBe(0);
    expect(snapshot.timeToTriage.samples).toBe(0);
    expect(snapshot.timeToTriage.averageSeconds).toBeNull();
  });

  it('accumulates nurse copilot KPI counters and averages', () => {
    service.recordNurseCopilotRecommendation('triage', 'high');
    service.recordNurseCopilotRecommendation('notes', 'n/a');
    service.recordNurseCopilotDecision('triage', 'accept');
    service.recordNurseCopilotDecision('triage', 'modify');
    service.recordNurseCopilotTimeToTriage(120);
    service.recordNurseCopilotTimeToTriage(60);
    service.recordNurseCopilotDocumentationDuration(30, 'note');
    service.recordNurseCopilotDocumentationDuration(90, 'handoff');
    service.recordNurseCopilotAlertResponseTime(45);

    const snapshot = service.getNurseCopilotKpis();
    expect(snapshot.recommendationsTotal).toBe(2);
    expect(snapshot.decisionsTotal).toBe(2);
    expect(snapshot.recommendationsByType.triage).toBe(1);
    expect(snapshot.recommendationsByType.notes).toBe(1);
    expect(snapshot.decisionsByType['triage:accept']).toBe(1);
    expect(snapshot.decisionsByType['triage:modify']).toBe(1);
    expect(snapshot.timeToTriage.samples).toBe(2);
    expect(snapshot.timeToTriage.averageSeconds).toBe(90);
    expect(snapshot.documentation.samples).toBe(2);
    expect(snapshot.documentation.averageSeconds).toBe(60);
    expect(snapshot.alertResponse.samples).toBe(1);
    expect(snapshot.alertResponse.averageSeconds).toBe(45);
  });

  it('records tenant-labeled CDSS dependency and abstention metrics', async () => {
    service.recordCdssHook('guidelines_search', 'success', 0.25, 'Tenant-A');
    service.recordCdssHookError('guidelines_search', 'http_401', 'Tenant-A');
    service.recordCdssRetry('guidelines_search', 'timeout', 'Tenant-A');
    service.recordCdssTimeout('guidelines_search', 'Tenant-A');
    service.recordCdssAbstention('guidelines_search', 'low_confidence', 'Tenant-A');

    const metrics = await service.getMetrics();
    expect(metrics).toContain('cdss_hooks_total');
    expect(metrics).toContain('cdss_hook_errors_total');
    expect(metrics).toContain('cdss_abstentions_total');
    expect(metrics).toContain('tenant_id="tenant-a"');
    expect(metrics).toContain('reason="low_confidence"');
  });

  it('builds a workflow health snapshot from tenant workflow data', async () => {
    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM hiv_care_enrollments') && sql.includes('deceased')) {
          return [{ active_enrollments: '14', lost_to_follow_up: '2', transferred_out: '1', deceased: '0' }];
        }
        if (sql.includes('FROM hiv_care_enrollments e') && sql.includes('overdue_viral_load_monitoring')) {
          return [{
            without_visit_history: '1',
            overdue_clinical_review: '3',
            unsuppressed_latest_viral_load: '4',
            overdue_viral_load_monitoring: '5',
          }];
        }
        if (sql.includes('approved_regimen_changes_without_documented_visit')) {
          return [{
            pending_arv_change_requests: '2',
            unsuppressed_without_recent_eac: '3',
            approved_regimen_changes_without_documented_visit: '1',
          }];
        }
        if (sql.includes('FROM nurse_handoff_workflow_state')) {
          return [{
            draft_handoffs: '2',
            finalized_pending_review: '1',
            reviewed_pending_share: '1',
            shared_handoffs: '6',
            aging_open_handoffs: '1',
          }];
        }
        if (sql.includes('FROM triage_assessments')) {
          return [{
            last_24h_total: '9',
            last_24h_urgent: '2',
            last_24h_high: '3',
            last_24h_average_severity: '4.75',
          }];
        }
        if (sql.includes('FROM vitals')) {
          return [{
            flagged_last_24h: '4',
            low_oxygen_last_24h: '1',
            fever_last_24h: '2',
            tachypnea_last_24h: '1',
          }];
        }
        if (sql.includes('FROM lab_orders')) {
          return [{
            open_lab_orders: '7',
            stale_uncollected_lab_orders: '2',
            completed_unreviewed_lab_orders: '1',
          }];
        }
        if (sql.includes('FROM imaging_orders')) {
          return [{
            open_imaging_orders: '5',
            imaging_awaiting_report: '2',
            completed_imaging_orders: '6',
          }];
        }
        if (sql.includes('FROM lab_critical_alerts')) {
          return [{
            pending_count: '3',
            acknowledged_count: '4',
            escalated_count: '1',
            overdue_count: '2',
          }];
        }
        if (sql.includes('FROM imaging_reports r')) {
          return [{
            awaiting_acknowledgement: '2',
            critical_awaiting_acknowledgement: '1',
          }];
        }
        if (sql.includes('FROM medical_aid_claims') && sql.includes('open_claim_amount')) {
          return [{
            total_claims: '20',
            draft_claims: '4',
            submitted_claims: '5',
            processing_claims: '3',
            rejected_claims: '2',
            paid_claims: '6',
            open_claim_amount: '812.50',
          }];
        }
        if (sql.includes('FROM medical_aid_claims') && sql.includes('draft_missing_diagnosis')) {
          return [{
            draft_missing_diagnosis: '2',
            aging_over_7_days: '3',
            aging_over_30_days: '1',
            rejected_with_reason: '2',
          }];
        }
        if (sql.includes('average_response_days')) {
          return [{ average_response_days: '6.4' }];
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      }),
    } as any;

    const snapshot = await service.getWorkflowHealthSnapshot(tenantDb);

    expect(snapshot.hiv.enrollments.active).toBe(14);
    expect(snapshot.hiv.monitoring.unsuppressedLatestViralLoad).toBe(4);
    expect(snapshot.hiv.actions.unsuppressedWithoutRecentEac).toBe(3);
    expect(snapshot.coordination.handoffs.shared).toBe(6);
    expect(snapshot.coordination.triage.averageSeverityLast24Hours).toBe(4.75);
    expect(snapshot.coordination.orders.openLabOrders).toBe(7);
    expect(snapshot.coordination.criticalResults.imagingAwaitingAcknowledgement).toBe(2);
    expect(snapshot.revenueCycle.claims.openClaimAmount).toBe(812.5);
    expect(snapshot.revenueCycle.quality.averageResponseDays).toBe(6.4);
  });

  it('falls back to zeroed workflow snapshot sections when relations are missing', async () => {
    const tenantDb = {
      query: jest.fn().mockRejectedValue({ code: '42P01', message: 'relation does not exist' }),
    } as any;

    const snapshot = await service.getWorkflowHealthSnapshot(tenantDb);

    expect(snapshot.hiv.enrollments.active).toBe(0);
    expect(snapshot.coordination.handoffs.draft).toBe(0);
    expect(snapshot.revenueCycle.claims.total).toBe(0);
    expect(snapshot.revenueCycle.quality.averageResponseDays).toBe(0);
  });
});
