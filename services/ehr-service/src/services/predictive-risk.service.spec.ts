import { PredictiveRiskService } from './predictive-risk.service';

describe('PredictiveRiskService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes deterioration prediction through governed CdssService', async () => {
    const repo = {
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const tenantDb = {
      getRepository: jest.fn().mockReturnValue(repo),
    } as any;
    const tenantService = {
      getTenantDatabase: jest.fn().mockResolvedValue(tenantDb),
    };
    const cdssService = {
      predictDeteriorationRisk: jest.fn().mockResolvedValue({
        score: 75,
        event_type: 'sepsis',
        timeframe_hours: 4,
        features: { spo2: 90 },
      }),
      predictReadmissionRisk: jest.fn(),
    };

    const service = new PredictiveRiskService(tenantService as any, cdssService as any);
    const result = await service.predictDeterioration('kids-clinic', 'patient-1', 'adm-1', { spo2: 90 });

    expect(cdssService.predictDeteriorationRisk).toHaveBeenCalledWith(
      { patientId: 'patient-1', admissionId: 'adm-1', vitals: { spo2: 90 } },
      'kids-clinic',
      tenantDb,
    );
    expect(result.deteriorationScore).toBe(75);
    expect(result.triggeredAlert).toBe(true);
  });

  it('routes readmission prediction through governed CdssService', async () => {
    const repo = {
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const tenantDb = {
      getRepository: jest.fn().mockReturnValue(repo),
      query: jest.fn().mockResolvedValue(undefined),
    } as any;
    const tenantService = {
      getTenantDatabase: jest.fn().mockResolvedValue(tenantDb),
    };
    const cdssService = {
      predictDeteriorationRisk: jest.fn(),
      predictReadmissionRisk: jest.fn().mockResolvedValue({
        risk: 0.44,
        category: 'high',
        factors: ['frequent ED visits'],
        followup_days: 7,
        model: 'LACE+',
      }),
    };

    const service = new PredictiveRiskService(tenantService as any, cdssService as any);
    const result = await service.predictReadmission('kids-clinic', 'patient-2', 'dis-1', { age: 67 });

    expect(cdssService.predictReadmissionRisk).toHaveBeenCalledWith(
      { patientId: 'patient-2', dischargeId: 'dis-1', clinicalData: { age: 67 } },
      'kids-clinic',
      tenantDb,
    );
    expect(result.riskCategory).toBe('high');
    expect(tenantDb.query).toHaveBeenCalled();
  });

  // S278 — trend-based deterioration lookahead
  describe('computeVitalsTrend', () => {
    const tenantService = { getTenantDatabase: jest.fn() };
    const cdssService = { predictDeteriorationRisk: jest.fn(), predictReadmissionRisk: jest.fn() };

    it('reports insufficient_data with fewer than 3 vitals readings', async () => {
      const ds = { query: jest.fn().mockResolvedValue([{ recorded_at: '2026-08-28T08:00:00Z', oxygen_saturation: 96 }]) } as any;
      const service = new PredictiveRiskService(tenantService as any, cdssService as any);
      const trend = await service.computeVitalsTrend(ds, 'patient-1');
      expect(trend.trendDirection).toBe('insufficient_data');
      expect(trend.projectedHoursToCritical).toBeNull();
    });

    it('detects a worsening SpO2 trend and projects hours to the critical threshold', async () => {
      const ds = {
        query: jest.fn().mockResolvedValue([
          { recorded_at: '2026-08-28T04:00:00Z', oxygen_saturation: 98, heart_rate: 80, respiratory_rate: 16, systolic_bp: 120 },
          { recorded_at: '2026-08-28T06:00:00Z', oxygen_saturation: 96, heart_rate: 80, respiratory_rate: 16, systolic_bp: 120 },
          { recorded_at: '2026-08-28T08:00:00Z', oxygen_saturation: 94, heart_rate: 80, respiratory_rate: 16, systolic_bp: 120 },
        ]),
      } as any;
      const service = new PredictiveRiskService(tenantService as any, cdssService as any);
      const trend = await service.computeVitalsTrend(ds, 'patient-1');
      expect(trend.trendDirection).toBe('worsening');
      expect(trend.trendDetails.perVital.spo2.movingTowardCritical).toBe(true);
      expect(trend.projectedHoursToCritical).toBeGreaterThan(0);
    });

    it('reports stable when no vital is trending toward its critical threshold', async () => {
      const ds = {
        query: jest.fn().mockResolvedValue([
          { recorded_at: '2026-08-28T04:00:00Z', oxygen_saturation: 97, heart_rate: 78, respiratory_rate: 16, systolic_bp: 118 },
          { recorded_at: '2026-08-28T06:00:00Z', oxygen_saturation: 97, heart_rate: 79, respiratory_rate: 16, systolic_bp: 119 },
          { recorded_at: '2026-08-28T08:00:00Z', oxygen_saturation: 97, heart_rate: 78, respiratory_rate: 16, systolic_bp: 118 },
        ]),
      } as any;
      const service = new PredictiveRiskService(tenantService as any, cdssService as any);
      const trend = await service.computeVitalsTrend(ds, 'patient-1');
      expect(trend.trendDirection).toBe('stable');
      expect(trend.projectedHoursToCritical).toBeNull();
    });
  });

  it('persists modelUsed and trend fields on the saved deterioration prediction', async () => {
    const repo = {
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const tenantDb = {
      getRepository: jest.fn().mockReturnValue(repo),
      query: jest.fn().mockResolvedValue([
        { recorded_at: '2026-08-28T04:00:00Z', oxygen_saturation: 98, heart_rate: 80, respiratory_rate: 16, systolic_bp: 120 },
        { recorded_at: '2026-08-28T06:00:00Z', oxygen_saturation: 96, heart_rate: 80, respiratory_rate: 16, systolic_bp: 120 },
        { recorded_at: '2026-08-28T08:00:00Z', oxygen_saturation: 94, heart_rate: 80, respiratory_rate: 16, systolic_bp: 120 },
      ]),
    } as any;
    const tenantService = { getTenantDatabase: jest.fn().mockResolvedValue(tenantDb) };
    const cdssService = {
      predictDeteriorationRisk: jest.fn().mockResolvedValue({
        score: 40, event_type: null, timeframe_hours: null, features: {}, model: 'MEWS', ml_enhanced: false,
      }),
      predictReadmissionRisk: jest.fn(),
    };

    const service = new PredictiveRiskService(tenantService as any, cdssService as any);
    const result = await service.predictDeterioration('kids-clinic', 'patient-1', 'adm-1', { spo2: 94 });

    expect(result.modelUsed).toBe('MEWS');
    expect(result.trendDirection).toBe('worsening');
    expect(result.projectedHoursToCritical).toBeGreaterThan(0);
  });
});
