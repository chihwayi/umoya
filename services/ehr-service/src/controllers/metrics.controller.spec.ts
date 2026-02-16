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
});

