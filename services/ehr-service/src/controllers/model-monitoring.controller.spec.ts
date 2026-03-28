import { ModelMonitoringController } from './model-monitoring.controller';

describe('ModelMonitoringController', () => {
  it('records offline eval runs through the monitoring service', async () => {
    const response = { blocked: false, run: { id: 'eval-1' }, releaseGates: [] };
    const svc = {
      recordOfflineEvalRun: jest.fn().mockResolvedValue(response),
    } as any;

    const controller = new ModelMonitoringController(svc, {} as any, {} as any, {} as any);
    const result = await controller.recordOfflineEval('kids-clinic', {
      subdomain: 'kids-clinic',
      aiSurface: 'patient_ai',
      caseSetName: 'suite',
      datasetVersion: '2026-03-26.v1',
      totalCases: 4,
      metrics: { citationSupportRate: 1 },
    });

    expect(result).toEqual(response);
    expect(svc.recordOfflineEvalRun).toHaveBeenCalledWith('kids-clinic', expect.objectContaining({
      aiSurface: 'patient_ai',
      caseSetName: 'suite',
    }));
  });
});
