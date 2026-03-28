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
});
