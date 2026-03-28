import { SdohService } from './sdoh.service';
import { CommunityResource } from '../entities/community-resource.entity';

describe('SdohService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes SDOH screening through governed CdssService with tenant database context', async () => {
    const tenantDb = {} as any;
    const tenantService = {
      getTenantDatabase: jest.fn().mockResolvedValue(tenantDb),
    };
    const cdssService = {
      screenSdohRisk: jest.fn().mockResolvedValue({
        overall_risk: 'moderate',
        positive_domains: [{ domain: 'food_insecurity' }],
      }),
    };

    const service = new SdohService(tenantService as any, cdssService as any);
    const result = await service.screenSdoh('kids-clinic', {
      patientId: 'patient-1',
      tool: 'prapare',
      responses: { food: 'sometimes' },
    });

    expect(cdssService.screenSdohRisk).toHaveBeenCalledWith(
      {
        patientId: 'patient-1',
        tool: 'prapare',
        responses: { food: 'sometimes' },
      },
      'kids-clinic',
      tenantDb,
    );
    expect(result.overall_risk).toBe('moderate');
  });

  it('routes SDOH resource matching through governed CdssService with active community resources', async () => {
    const resourceRows = [
      {
        id: 'res-1',
        name: 'Community Pantry',
        category: 'food_bank',
        phone: '123',
        website: 'https://example.org',
        address: '1 Main St',
        languages: ['en', 'sn'],
        availability: 'weekdays',
      },
    ];
    const resourceRepo = {
      find: jest.fn().mockResolvedValue(resourceRows),
    };
    const tenantDb = {
      getRepository: jest.fn((entity) => {
        if (entity === CommunityResource) {
          return resourceRepo;
        }
        throw new Error(`Unexpected repository ${String(entity)}`);
      }),
    } as any;
    const tenantService = {
      getTenantDatabase: jest.fn().mockResolvedValue(tenantDb),
    };
    const cdssService = {
      matchSdohResources: jest.fn().mockResolvedValue({
        recommended_categories: ['food_bank'],
        matches: [{ resource_id: 'res-1', category: 'food_bank' }],
        unmet_categories: [],
      }),
    };

    const service = new SdohService(tenantService as any, cdssService as any);
    const result = await service.matchResources('kids-clinic', {
      patientId: 'patient-1',
      positive_domains: [{ domain: 'food_insecurity', category: 'food_bank' }],
      requested_categories: ['food_bank'],
      language: 'en',
    });

    expect(resourceRepo.find).toHaveBeenCalledWith({
      where: { isActive: true },
      order: { name: 'ASC' },
      take: 200,
    });
    expect(cdssService.matchSdohResources).toHaveBeenCalledWith(
      {
        patientId: 'patient-1',
        positive_domains: [{ domain: 'food_insecurity', category: 'food_bank' }],
        requested_categories: ['food_bank'],
        language: 'en',
        available_resources: [
          {
            id: 'res-1',
            name: 'Community Pantry',
            category: 'food_bank',
            phone: '123',
            website: 'https://example.org',
            address: '1 Main St',
            languages: ['en', 'sn'],
            availability: 'weekdays',
          },
        ],
      },
      'kids-clinic',
      tenantDb,
    );
    expect(result.matches).toHaveLength(1);
  });
});
