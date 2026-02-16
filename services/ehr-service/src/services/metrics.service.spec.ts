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
});

