import { AutoCodingService } from './auto-coding.service';

describe('AutoCodingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes code extraction through governed CdssService and persists the suggestion', async () => {
    const savedRows: any[] = [];
    const repo = {
      findOneBy: jest.fn().mockResolvedValue(null),
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
      extractClinicalCodes: jest.fn().mockResolvedValue({
        suggestedIcd10Codes: [{ code: 'J18.9', description: 'Pneumonia', confidence: 0.8 }],
        suggestedCptCodes: [{ code: '71046', description: 'Chest x-ray', confidence: 0.7 }],
        model: 'llama3.1:8b',
      }),
    };

    const service = new AutoCodingService(tenantService as any, cdssService as any);
    const result = await service.extractAndSaveCodes(
      'kids-clinic',
      'note-1',
      'patient-1',
      'Patient has fever and pneumonia, chest x-ray ordered.',
      'enc-1',
    );

    expect(cdssService.extractClinicalCodes).toHaveBeenCalledWith(
      {
        noteText: 'Patient has fever and pneumonia, chest x-ray ordered.',
        patientId: 'patient-1',
        noteId: 'note-1',
        encounterId: 'enc-1',
      },
      'kids-clinic',
      tenantDb,
    );
    expect(savedRows).toHaveLength(1);
    expect(result.suggestedIcd10Codes).toEqual([{ code: 'J18.9', description: 'Pneumonia', confidence: 0.8 }]);
    expect(result.suggestedCptCodes).toEqual([{ code: '71046', description: 'Chest x-ray', confidence: 0.7 }]);
  });
});
