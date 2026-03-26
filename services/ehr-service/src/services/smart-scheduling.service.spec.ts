import { SmartSchedulingService } from './smart-scheduling.service';

describe('SmartSchedulingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes scheduling prediction through governed CdssService and persists the prediction', async () => {
    const repo = {
      findOneBy: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const tenantDb = {
      getRepository: jest.fn(() => repo),
      query: jest.fn().mockResolvedValue(undefined),
    } as any;
    const tenantService = {
      getTenantDatabase: jest.fn().mockResolvedValue(tenantDb),
    };
    const cdssService = {
      predictSchedulingRisk: jest.fn().mockResolvedValue({
        no_show_probability: 0.44,
        cancel_probability: 0.16,
        recommended_duration: 45,
        confidence_score: 0.78,
        model: 'scheduling_rules_v1',
        feature_importance: { prior_no_shows: 0.24 },
      }),
    };

    const service = new SmartSchedulingService(tenantService as any, cdssService as any);
    const result = await service.predictAppointment('kids-clinic', 'apt-1', {
      priorNoShows: 2,
      leadTimeDays: 10,
      visitType: 'new',
    });

    expect(cdssService.predictSchedulingRisk).toHaveBeenCalledWith(
      {
        appointmentId: 'apt-1',
        priorNoShows: 2,
        leadTimeDays: 10,
        visitType: 'new',
      },
      'kids-clinic',
      tenantDb,
    );
    expect(result.noShowProbability).toBe(0.44);
    expect(result.recommendedDuration).toBe(45);
  });
});
