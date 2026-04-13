import { EpilepsyService } from './epilepsy.service';

describe('EpilepsyService S145', () => {
  it('enroll defaults pregnancy risk counselling to false when not supplied', async () => {
    const registerRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'reg-1', ...value })),
    };
    const db = {
      getRepository: jest.fn((entity) => {
        if (entity.name === 'EpilepsyRegister') return registerRepo;
        throw new Error(`Unexpected entity: ${entity?.name}`);
      }),
    };
    const tenantService = { getTenantDatabase: jest.fn(async () => db) };
    const service = new EpilepsyService(tenantService as any, {} as any);

    const result = await service.enroll('tenant-a', 'patient-1', 'user-1', {
      ilaeSeizureType: 'focal_aware',
      enrolledAt: '2026-04-13',
    });

    expect(result.pregnancyRiskCounselled).toBe(false);
    expect(result.patientId).toBe('patient-1');
  });

  it('recordAedTherapy returns interaction alerts when concurrent drugs are supplied', async () => {
    const aedRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'aed-1', ...value })),
    };
    const registerRepo = {
      findOne: jest.fn(async () => ({ id: 'reg-1', patientId: 'patient-1' })),
    };
    const db = {
      getRepository: jest.fn((entity) => {
        if (entity.name === 'AedTherapyRecord') return aedRepo;
        if (entity.name === 'EpilepsyRegister') return registerRepo;
        throw new Error(`Unexpected entity: ${entity?.name}`);
      }),
    };
    const tenantService = { getTenantDatabase: jest.fn(async () => db) };
    const cdssService = {
      epilepsyDrugInteractions: jest.fn(async () => ({
        interaction_count: 1,
        alerts: [{ severity: 'critical', interacting_drug: 'efavirenz' }],
        has_critical: true,
      })),
    };

    const service = new EpilepsyService(tenantService as any, cdssService as any);
    const result = await service.recordAedTherapy('tenant-a', 'patient-1', 'user-1', {
      drugName: 'phenobarbital',
      doseMg: 60,
      frequency: 'once daily at night',
      startDate: '2026-04-13',
      concurrentDrugs: ['efavirenz'],
    });

    expect(result.interactionAlerts.has_critical).toBe(true);
    expect(result.aedRecord.epilepsyRegisterId).toBe('reg-1');
  });

  it('getStatusEpilepticusProtocol proxies the payload to CDSS', async () => {
    const tenantService = { getTenantDatabase: jest.fn() };
    const cdssService = {
      epilepsyStatusEpilepticus: jest.fn(async () => ({
        is_status_epilepticus: true,
        current_recommendation: { drug: 'diazepam', phase: 2 },
      })),
    };
    const service = new EpilepsyService(tenantService as any, cdssService as any);

    const result = await service.getStatusEpilepticusProtocol('tenant-a', {
      duration_minutes: 12,
      patient_age_years: 7,
      patient_weight_kg: 20,
    });

    expect(cdssService.epilepsyStatusEpilepticus).toHaveBeenCalled();
    expect(result.current_recommendation.drug).toBe('diazepam');
  });
});
