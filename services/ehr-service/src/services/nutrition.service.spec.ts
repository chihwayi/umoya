import { NutritionService } from './nutrition.service';

describe('NutritionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes nutrition support calls through governed CdssService', async () => {
    const cdssService = {
      screenNutritionRisk: jest.fn().mockResolvedValue({ risk_category: 'high' }),
      prescribeNutritionPlan: jest.fn().mockResolvedValue({ tee_kcal: 2100 }),
      assessNutritionRefeedingRisk: jest.fn().mockResolvedValue({ risk_level: 'moderate' }),
    };
    const service = new NutritionService({} as any, cdssService as any);

    await service.screenNutrition({ tool: 'NRS2002' }, 'kids-clinic');
    await service.prescribeNutrition({ route: 'oral' }, 'kids-clinic');
    await service.refeedingRisk({ duration_starvation_days: 7 }, 'kids-clinic');

    expect(cdssService.screenNutritionRisk).toHaveBeenCalledWith(
      { tool: 'NRS2002' },
      'kids-clinic',
      undefined,
    );
    expect(cdssService.prescribeNutritionPlan).toHaveBeenCalledWith(
      { route: 'oral' },
      'kids-clinic',
      undefined,
    );
    expect(cdssService.assessNutritionRefeedingRisk).toHaveBeenCalledWith(
      { duration_starvation_days: 7 },
      'kids-clinic',
      undefined,
    );
  });
});
