import { AiPerformanceService } from './ai-performance.service';

// F16 (S270) — these 5 call sites used to swallow DB failures into an empty
// array / no-op resolve, so an operator saw "no drift/no governance events/no
// fairness concerns" when the underlying query actually crashed. Now the
// failure must propagate so it surfaces as a real HTTP error (the frontend's
// AiGovernanceDashboard.tsx ErrorBanner/retry UI was already built for this,
// it just never fired).
describe('AiPerformanceService — F16 error propagation', () => {
  const buildService = (db: any) => {
    const tenantService = { getTenantDatabase: jest.fn().mockResolvedValue(db) };
    return new AiPerformanceService(tenantService as any);
  };

  it('requestModelReview propagates a DB failure instead of silently resolving', async () => {
    const db = { query: jest.fn().mockRejectedValue(new Error('governance log insert failed')) };
    const service = buildService(db);

    await expect(
      service.requestModelReview('clinic-a', 'readmission_risk', 'accuracy_drop', 'user-1'),
    ).rejects.toThrow('governance log insert failed');
  });

  it('updateModelStatus propagates a DB failure instead of silently resolving', async () => {
    const db = { query: jest.fn().mockRejectedValue(new Error('governance log insert failed')) };
    const service = buildService(db);

    await expect(
      service.updateModelStatus('clinic-a', 'readmission_risk', 'approved', 'user-1', 'looks fine'),
    ).rejects.toThrow('governance log insert failed');
  });

  it('getGovernanceHistory propagates a DB failure instead of returning an empty array', async () => {
    const db = { query: jest.fn().mockRejectedValue(new Error('relation does not exist')) };
    const service = buildService(db);

    await expect(service.getGovernanceHistory('clinic-a', 'readmission_risk')).rejects.toThrow('relation does not exist');
  });

  it('getCalibrationPlot propagates a DB failure instead of returning an empty array', async () => {
    const db = { query: jest.fn().mockRejectedValue(new Error('query timeout')) };
    const service = buildService(db);

    await expect(service.getCalibrationPlot('clinic-a', 'readmission_risk', '2026-08')).rejects.toThrow('query timeout');
  });

  it('getModelFairness propagates a DB failure from either the sex or age query', async () => {
    const db = {
      query: jest.fn()
        .mockRejectedValueOnce(new Error('fairness sex query failed'))
        .mockResolvedValueOnce([]),
    };
    const service = buildService(db);

    await expect(service.getModelFairness('clinic-a', 'readmission_risk', '2026-08')).rejects.toThrow('fairness sex query failed');
  });

  it('getModelFairness still returns real data when both queries succeed', async () => {
    const db = {
      query: jest.fn()
        .mockResolvedValueOnce([{ group_val: 'male', total: 10, tp: 4, fp: 1, tn: 4, fn: 1 }])
        .mockResolvedValueOnce([{ group_val: '25–49', total: 10, tp: 4, fp: 1, tn: 4, fn: 1 }]),
    };
    const service = buildService(db);

    const result = await service.getModelFairness('clinic-a', 'readmission_risk', '2026-08');
    expect(result.by_sex).toHaveLength(1);
    expect(result.by_sex[0].group).toBe('male');
    expect(result.by_age_band).toHaveLength(1);
  });
});
