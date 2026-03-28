import { MultilingualEducationService } from './multilingual-education.service';

describe('MultilingualEducationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes education generation through governed CdssService and persists the material', async () => {
    const savedRows: any[] = [];
    const repo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        savedRows.push(value);
        return value;
      }),
    };
    const tenantDb = {
      getRepository: jest.fn(() => repo),
    } as any;
    const tenantService = {
      getTenantDatabase: jest.fn().mockResolvedValue(tenantDb),
    };
    const cdssService = {
      generatePatientEducation: jest.fn().mockResolvedValue({
        content: 'Use the inhaler exactly as instructed and return urgently if your breathing worsens.',
        governance: { governed_path: true },
        model: 'llama3.1:8b',
      }),
    };

    const service = new MultilingualEducationService(tenantService as any, cdssService as any);
    const result = await service.generate(
      'kids-clinic',
      'patient-1',
      'Asthma inhaler use',
      'en',
      6,
      'enc-1',
    );

    expect(cdssService.generatePatientEducation).toHaveBeenCalledWith(
      {
        topic: 'Asthma inhaler use',
        language: 'en',
        reading_level: 6,
        patient_id: 'patient-1',
        encounterId: 'enc-1',
      },
      'kids-clinic',
      tenantDb,
    );
    expect(savedRows).toHaveLength(1);
    expect(result.content).toContain('Use the inhaler exactly as instructed');
    expect(result.aiGenerated).toBe(true);
  });
});
