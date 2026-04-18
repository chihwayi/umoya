import { VhfService } from './vhf.service';

describe('VhfService S150', () => {
  it('builds triage from real patient context when reporting a case', async () => {
    const caseRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'case-1', ...value })),
      update: jest.fn(async () => undefined),
    };
    const patientRepo = {
      findOne: jest.fn(async () => ({
        id: 'patient-1',
        age: 28,
        pregnancyStatus: 'pregnant',
      })),
    };
    const db = {
      getRepository: jest.fn((entity) => {
        if (entity.name === 'VhfCase') return caseRepo;
        if (entity.name === 'Patient') return patientRepo;
        throw new Error(`Unexpected entity: ${entity?.name}`);
      }),
    };
    const tenantService = { getTenantDatabase: jest.fn(async () => db) };
    const cdssService = {
      vhfRiskTriage: jest.fn(async () => ({ classification: 'probable', risk_level: 'high' })),
    };

    const service = new VhfService(tenantService as any, cdssService as any);
    const result = await service.reportCase('tenant-a', 'user-1', {
      patientId: 'patient-1',
      pathogen: 'mpox_clade_i',
      fever: true,
      rash: true,
    });

    expect(cdssService.vhfRiskTriage).toHaveBeenCalledWith(
      expect.objectContaining({
        pathogen: 'mpox_clade_i',
        fever: true,
        age_years: 28,
        pregnant: true,
      }),
      'tenant-a',
    );
    expect(result.caseRecord.classification).toBe('probable');
  });

  it('adds a contact and refreshes monitoring counters', async () => {
    const caseRepo = {
      findOne: jest.fn(async () => ({ id: 'case-1' })),
      update: jest.fn(async () => undefined),
    };
    const contactRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'contact-1', ...value })),
      count: jest
        .fn()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1),
    };
    const db = {
      getRepository: jest.fn((entity) => {
        if (entity.name === 'VhfCase') return caseRepo;
        if (entity.name === 'VhfContact') return contactRepo;
        throw new Error(`Unexpected entity: ${entity?.name}`);
      }),
    };
    const tenantService = { getTenantDatabase: jest.fn(async () => db) };
    const service = new VhfService(tenantService as any, {} as any);

    const result = await service.addContact('tenant-a', 'case-1', {
      contactName: 'Jane Contact',
      contactType: 'household',
      firstExposureDate: '2026-04-10',
      lastExposureDate: '2026-04-12',
    });

    expect(result.monitoringEndDate).toBe('2026-05-03');
    expect(caseRepo.update).toHaveBeenCalledWith('case-1', {
      contactsListed: 1,
      contactsUnderFollowup: 1,
    });
  });

  it('applies mpox severity CDSS output onto the saved assessment', async () => {
    const lesionRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'lesion-1', ...value })),
      update: jest.fn(async () => undefined),
    };
    const patientRepo = {
      findOne: jest.fn(async () => ({ id: 'patient-1', age: 34, pregnancyStatus: 'not_pregnant' })),
    };
    const db = {
      getRepository: jest.fn((entity) => {
        if (entity.name === 'MpoxLesionAssessment') return lesionRepo;
        if (entity.name === 'Patient') return patientRepo;
        throw new Error(`Unexpected entity: ${entity?.name}`);
      }),
    };
    const tenantService = { getTenantDatabase: jest.fn(async () => db) };
    const cdssService = {
      mpoxSeverity: jest.fn(async () => ({
        severity_score: 7.5,
        care_principles: ['Isolate patient', 'Start tecovirimat'],
        confidence: 0.92,
        antiviral_indicated: true,
        antiviral_drug: 'tecovirimat',
        antiviral_dose: '600 mg PO twice daily x 14 days',
      })),
    };

    const service = new VhfService(tenantService as any, cdssService as any);
    const result = await service.recordLesionAssessment('tenant-a', 'user-1', {
      patientId: 'patient-1',
      stage: 'pustules',
      lesionCountCategory: 'moderate_10-100',
      lesionDistribution: { genitalia: true },
    });

    expect(result.assessment.cdssSeverityScore).toBe(7.5);
    expect(result.assessment.antiviralIndicated).toBe(true);
    expect(result.assessment.antiviralDrug).toBe('tecovirimat');
  });
});
