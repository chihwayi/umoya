import { FormularyOptimizationService } from './formulary-optimization.service';

describe('FormularyOptimizationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes prescription optimization through governed CdssService with corrected payload shape', async () => {
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
      optimizeFormulary: jest.fn().mockResolvedValue({
        generic_alternative: 'atorvastatin 20mg',
        branded_cost: 100,
        generic_cost: 25,
        saving_amount: 75,
        recommendation: 'substitute_generic',
        reason: 'Cost saving',
      }),
    };

    const service = new FormularyOptimizationService(tenantService as any, cdssService as any);
    const result = await service.optimizeOnPrescription('kids-clinic', 'rx-1', 'patient-1', 'Lipitor');

    expect(cdssService.optimizeFormulary).toHaveBeenCalledWith(
      {
        patientId: 'patient-1',
        prescriptionId: 'rx-1',
        brandedDrug: 'Lipitor',
        diagnoses: [],
      },
      'kids-clinic',
      tenantDb,
    );
    expect(result.genericAlternative).toBe('atorvastatin 20mg');
    expect(result.aiRecommendation).toBe('substitute_generic');
  });
});
