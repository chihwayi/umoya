import { MetricsController } from './metrics.controller';

describe('MetricsController', () => {
  it('returns prometheus metrics payload', async () => {
    const metricsService = {
      getMetrics: jest.fn().mockResolvedValue('# HELP test_metric 1\n'),
      getNurseCopilotKpis: jest.fn(),
    } as any;

    const controller = new MetricsController(metricsService);
    const result = await controller.getMetrics();
    expect(result).toContain('test_metric');
    expect(metricsService.getMetrics).toHaveBeenCalledTimes(1);
  });

  it('returns nurse copilot KPI snapshot', () => {
    const kpiSnapshot = {
      recommendationsTotal: 1,
      decisionsTotal: 1,
      recommendationsByType: { triage: 1 },
      decisionsByType: { 'triage:accept': 1 },
      timeToTriage: { samples: 1, averageSeconds: 120 },
      documentation: { samples: 0, averageSeconds: null },
      alertResponse: { samples: 0, averageSeconds: null },
    };
    const metricsService = {
      getMetrics: jest.fn(),
      getNurseCopilotKpis: jest.fn().mockReturnValue(kpiSnapshot),
    } as any;

    const controller = new MetricsController(metricsService);
    const result = controller.getNurseCopilotKpis();
    expect(result).toEqual(kpiSnapshot);
    expect(metricsService.getNurseCopilotKpis).toHaveBeenCalledTimes(1);
  });

  it('returns workflow health snapshot for the current tenant', async () => {
    const workflowSnapshot = {
      generatedAt: '2026-03-10T10:00:00.000Z',
      hiv: { enrollments: { active: 12 } },
      coordination: { handoffs: { draft: 2 } },
      revenueCycle: { claims: { total: 8 } },
    };
    const tenantDb = { query: jest.fn() } as any;
    const metricsService = {
      getMetrics: jest.fn(),
      getNurseCopilotKpis: jest.fn(),
      getWorkflowHealthSnapshot: jest.fn().mockResolvedValue(workflowSnapshot),
    } as any;

    const controller = new MetricsController(metricsService);
    const result = await controller.getWorkflowHealthSnapshot({ tenantDb } as any);

    expect(result).toEqual(workflowSnapshot);
    expect(metricsService.getWorkflowHealthSnapshot).toHaveBeenCalledWith(tenantDb);
  });
});
