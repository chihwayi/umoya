import { TierNetService } from './tier-net.service';

describe('TierNetService', () => {
  it('builds and stores TIER.net XML from live HIV rows', async () => {
    const exportRepo = {
      findOne: jest.fn(async () => null),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'export-1', ...value })),
    };
    const patientRepo = {
      findOne: jest.fn(async () => ({
        id: 'patient-1',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'female',
        nationalId: '9001011234088',
      })),
    };
    const db = {
      getRepository: jest.fn((entity) => {
        if (entity.name === 'TierNetExport') return exportRepo;
        return patientRepo;
      }),
      query: jest
        .fn()
        .mockResolvedValueOnce([{ id: 'enroll-1', art_start_date: '2024-01-15', enrollment_date: '2024-01-15', current_regimen: 'TLD' }])
        .mockResolvedValueOnce([{ arv_regimen_name: 'TLD', arv_regimen_code: 'TLD' }])
        .mockResolvedValueOnce([{ vl_date: '2026-03-01', vl_value: 240 }])
        .mockResolvedValueOnce([{ cd4_date: '2026-02-01', cd4_value: 523 }]),
    };
    const tenantService = {
      getTenantDatabase: jest.fn(async () => db),
    };

    const service = new TierNetService(tenantService as any);
    const exported = await service.exportPatient('tenant-a', 'patient-1');

    expect(exported.id).toBe('export-1');
    expect(exportRepo.create).toHaveBeenCalledTimes(1);
    expect(exported.payloadXml).toContain('<TIERNetExport version="2.0"');
    expect(exported.payloadXml).toContain('<CurrentRegimen>TLD</CurrentRegimen>');
    expect(exported.payloadXml).toContain('suppressed="true"');
  });
});
