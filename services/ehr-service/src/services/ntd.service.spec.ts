import { NtdService } from './ntd.service';

describe('NtdService S140', () => {
  it('recordAssessment creates an NTD assessment with the requested disease type', async () => {
    const assessmentRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'assess-1', ...value })),
    };
    const db = {
      getRepository: jest.fn((entity) => {
        if (entity.name === 'NtdAssessment') return assessmentRepo;
        throw new Error(`Unexpected entity: ${entity?.name}`);
      }),
    };
    const tenantService = { getTenantDatabase: jest.fn(async () => db) };

    const service = new NtdService(tenantService as any, {} as any, {} as any);
    const result = await service.recordAssessment('tenant-a', 'user-1', {
      patientId: 'patient-1',
      diseaseType: 'schistosomiasis',
      assessmentDate: '2026-04-11',
    });

    expect(result.diseaseType).toBe('schistosomiasis');
    expect(result.assessedBy).toBe('user-1');
  });

  it('createCampaign stores an MDA campaign', async () => {
    const campaignRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'campaign-1', treatedCount: 0, ...value })),
    };
    const db = {
      getRepository: jest.fn((entity) => {
        if (entity.name === 'MdaCampaign') return campaignRepo;
        throw new Error(`Unexpected entity: ${entity?.name}`);
      }),
    };
    const tenantService = { getTenantDatabase: jest.fn(async () => db) };

    const service = new NtdService(tenantService as any, {} as any, {} as any);
    const result = await service.createCampaign('tenant-a', 'user-2', {
      campaignName: 'April MDA',
      diseaseType: 'filariasis',
      drugName: 'Albendazole',
      startDate: '2026-04-11',
      endDate: '2026-04-20',
    });

    expect(result.campaignName).toBe('April MDA');
    expect(result.createdBy).toBe('user-2');
  });

  it('recordTreatedCount increments treated_count correctly', async () => {
    const campaignRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ id: 'campaign-2', treatedCount: 40 })
        .mockResolvedValueOnce({ id: 'campaign-2', treatedCount: 55 }),
      update: jest.fn(async () => undefined),
    };
    const db = {
      getRepository: jest.fn((entity) => {
        if (entity.name === 'MdaCampaign') return campaignRepo;
        throw new Error(`Unexpected entity: ${entity?.name}`);
      }),
    };
    const tenantService = { getTenantDatabase: jest.fn(async () => db) };

    const service = new NtdService(tenantService as any, {} as any, {} as any);
    const result = await service.recordTreatedCount('tenant-a', 'campaign-2', 15);

    expect(result.treatedCount).toBe(55);
    expect(campaignRepo.update).toHaveBeenCalledWith('campaign-2', { treatedCount: 55 });
  });
});
