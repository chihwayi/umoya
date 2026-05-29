import { NhlsHl7Service } from './nhls-hl7.service';

describe('NhlsHl7Service', () => {
  it('creates one NHLS result row per OBX segment and auto-links the patient by national ID', async () => {
    const resultRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: `result-${resultRepo.save.mock.calls.length + 1}`, ...value })),
    };
    const patientRepo = {
      findOne: jest.fn(async () => ({ id: 'patient-1', nationalId: '8001015009087' })),
    };
    const db = {
      getRepository: jest.fn((entity) => {
        if (entity.name === 'NhlsLabResult') return resultRepo;
        return patientRepo;
      }),
    };
    const tenantService = {
      getTenantDatabase: jest.fn(async () => db),
    };

    const service = new NhlsHl7Service(tenantService as any);
    const hl7 = [
      'MSH|^~\\&|NHLS|LAB|UMOYA|EHR|20260411090000||ORU^R01|LAB-001|P|2.5',
      'PID|1||8001015009087^^^RSA^NI||Doe^Jane',
      'OBR|1|ORD-1|ACC-1|PANEL^NHLS HIV PANEL||20260410080000',
      'OBX|1|NM|NHLS-CD4^CD4 Count||523|cells/uL|350-1200|N|||F|||20260411083000',
      'OBX|2|NM|NHLS-VL^Viral Load||240|copies/mL|0-999|N|||F|||20260411083500',
    ].join('\r');

    const results = await service.ingestHl7('tenant-a', hl7);

    expect(results).toHaveLength(2);
    expect(patientRepo.findOne).toHaveBeenCalledWith({ where: { nationalId: '8001015009087' } });
    expect(resultRepo.create).toHaveBeenCalledTimes(2);
    expect(results[0].patientId).toBe('patient-1');
    expect(results[0].testLoincCode).toBe('24467-3');
    expect(results[1].testLoincCode).toBe('20447-9');
    expect(results[0].nhlsLabNumber).toBe('LAB-001');
  });
});
