import { ScdService } from './scd.service';

describe('ScdService S144', () => {
  it('enroll defaults malaria prophylaxis to false when not supplied', async () => {
    const registerRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'reg-1', ...value })),
    };
    const db = {
      getRepository: jest.fn((entity) => {
        if (entity.name === 'ScdRegister') return registerRepo;
        throw new Error(`Unexpected entity: ${entity?.name}`);
      }),
    };
    const tenantService = { getTenantDatabase: jest.fn(async () => db) };
    const service = new ScdService(tenantService as any, {} as any);

    const result = await service.enroll('tenant-a', 'patient-1', 'user-1', {
      genotype: 'HbSS',
      enrolledAt: '2026-04-12',
    });

    expect(result.onMalariaProphylaxis).toBe(false);
    expect(result.patientId).toBe('patient-1');
  });

  it('recordCrisis stores the event and returns CDSS triage guidance', async () => {
    const crisisRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'crisis-1', ...value })),
    };
    const registerRepo = {
      findOne: jest.fn(async () => ({ id: 'reg-1', patientId: 'patient-1' })),
    };
    const db = {
      getRepository: jest.fn((entity) => {
        if (entity.name === 'ScdCrisisEvent') return crisisRepo;
        if (entity.name === 'ScdRegister') return registerRepo;
        throw new Error(`Unexpected entity: ${entity?.name}`);
      }),
    };
    const tenantService = { getTenantDatabase: jest.fn(async () => db) };
    const cdssService = {
      scdCrisisTriage: jest.fn(async () => ({
        severity: 'life_threatening',
        management: 'Urgent exchange transfusion',
        escalate_now: true,
      })),
    };

    const service = new ScdService(tenantService as any, cdssService as any);
    const result = await service.recordCrisis('tenant-a', 'patient-1', 'user-1', {
      crisisType: 'stroke',
      newNeuroSymptoms: true,
    });

    expect(result.crisisEvent.severity).toBe('life_threatening');
    expect(result.triageGuidance.escalate_now).toBe(true);
  });

  it('recordTreatment returns HU dose guidance when hydroxyurea is selected', async () => {
    const treatmentRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'tx-1', ...value })),
    };
    const registerRepo = {
      findOne: jest.fn(async () => ({ id: 'reg-1', patientId: 'patient-1', genotype: 'HbSS' })),
    };
    const db = {
      getRepository: jest.fn((entity) => {
        if (entity.name === 'ScdTreatmentRecord') return treatmentRepo;
        if (entity.name === 'ScdRegister') return registerRepo;
        throw new Error(`Unexpected entity: ${entity?.name}`);
      }),
    };
    const tenantService = { getTenantDatabase: jest.fn(async () => db) };
    const cdssService = {
      scdHydroxyureaDose: jest.fn(async () => ({
        action: 'hold',
        reason: ['ANC 1.8 ×10⁹/L < 2.0 — HOLD hydroxyurea'],
        recommended_dose_mg: null,
      })),
    };

    const service = new ScdService(tenantService as any, cdssService as any);
    const result = await service.recordTreatment('tenant-a', 'patient-1', 'user-1', {
      treatmentType: 'hydroxyurea',
      patientWeightKg: 24,
      ancX10_9: 1.8,
      genotype: 'HbSS',
    });

    expect(result.doseGuidance?.action).toBe('hold');
    expect(result.treatmentRecord.action).toBe('hold');
  });
});
