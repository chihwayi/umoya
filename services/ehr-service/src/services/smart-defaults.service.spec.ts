import { SmartDefaultsService } from './smart-defaults.service';

describe('SmartDefaultsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes AI defaults suggestions through governed CdssService with tenant context', async () => {
    const tenantDb = {} as any;
    const tenantService = {
      getTenantDatabase: jest.fn().mockResolvedValue(tenantDb),
    };
    const cdssService = {
      suggestFormDefaults: jest.fn().mockResolvedValue({
        defaults: {
          weight_based_dosing: { value: true, confidence: 0.95, source: 'cdss_rule' },
        },
        model: 'form_defaults_rules_v1',
      }),
    };

    const service = new SmartDefaultsService(tenantService as any, cdssService as any);
    const result = await service.aiSuggestDefaults('kids-clinic', {
      formName: 'pediatric-intake',
      context: { age: 8, sex: 'female' },
    });

    expect(cdssService.suggestFormDefaults).toHaveBeenCalledWith(
      {
        formName: 'pediatric-intake',
        context: { age: 8, sex: 'female' },
      },
      'kids-clinic',
      tenantDb,
    );
    expect(result.defaults.weight_based_dosing.value).toBe(true);
  });
});
