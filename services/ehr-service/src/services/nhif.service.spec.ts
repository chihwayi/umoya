import { NhifService } from './nhif.service';

describe('NhifService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns DB-derived eligibility when no live API is configured', async () => {
    const schemeMemberRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'member-1',
        nhifSchemeId: 'scheme-1',
        memberNumber: 'MEM123',
        status: 'active',
        expiryDate: '2099-12-31',
      }),
    };
    const schemeRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'scheme-1',
        apiBaseUrl: null,
      }),
    };
    const db = {
      getRepository: jest.fn((entity: { name?: string }) => {
        if (entity?.name === 'SchemeMember') {
          return schemeMemberRepository;
        }
        return schemeRepository;
      }),
    };
    const tenantService = {
      getTenantDatabase: jest.fn().mockResolvedValue(db),
    };
    const service = new NhifService(tenantService as any);

    const result = await service.checkEligibility('tenant-1', 'member-1');

    expect(tenantService.getTenantDatabase).toHaveBeenCalledWith('tenant-1');
    expect(result).toEqual({
      eligible: true,
      memberNumber: 'MEM123',
      source: 'local',
    });
  });
});
