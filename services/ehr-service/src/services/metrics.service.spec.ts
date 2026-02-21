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
});
