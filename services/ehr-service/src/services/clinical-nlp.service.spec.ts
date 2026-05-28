import { Test } from '@nestjs/testing';
import { ClinicalNlpService } from './clinical-nlp.service';
import { ClinicalLlmService } from './clinical-llm.service';

describe('ClinicalNlpService', () => {
  let svc: ClinicalNlpService;
  let db: any;
  let llmMock: jest.Mocked<Partial<ClinicalLlmService>>;

  const LLM_JSON = JSON.stringify({
    diagnoses: [{ text: 'Hypertension', icd10Hint: 'I10', confidence: 0.95 }],
    medications: [{ name: 'Amlodipine', dose: '10mg', frequency: 'OD', confidence: 0.9 }],
    allergies: [{ substance: 'Penicillin', reaction: 'Rash', confidence: 0.88 }],
    symptoms: [{ text: 'headache', duration: '3 days', severity: 'moderate', confidence: 0.8 }],
    procedures: [],
  });

  beforeEach(() => {
    db = { query: jest.fn().mockResolvedValue([]) };
  });

  it('extracts entities from LLM JSON response', async () => {
    llmMock = {
      generate: jest.fn().mockResolvedValue({
        text: LLM_JSON, backend: 'ollama', model: 'llama3', latencyMs: 300,
      }),
    };
    const module = await Test.createTestingModule({
      providers: [
        ClinicalNlpService,
        { provide: ClinicalLlmService, useValue: llmMock },
      ],
    }).compile();
    svc = module.get(ClinicalNlpService);

    const result = await svc.extractEntities(
      'Patient has hypertension. On Amlodipine 10mg OD. Allergic to Penicillin.',
      { context: 'test' },
      db,
    );

    expect(result.diagnoses[0].text).toBe('Hypertension');
    expect(result.medications[0].name).toBe('Amlodipine');
    expect(result.allergies[0].substance).toBe('Penicillin');
    expect(result.aiSource).toBe('llm:ollama');
  });

  it('falls back to rule extraction when LLM returns null', async () => {
    llmMock = { generate: jest.fn().mockResolvedValue(null) };
    const module = await Test.createTestingModule({
      providers: [
        ClinicalNlpService,
        { provide: ClinicalLlmService, useValue: llmMock },
      ],
    }).compile();
    svc = module.get(ClinicalNlpService);

    const result = await svc.extractEntities(
      'Patient has hypertension. Allergic to penicillin.',
      { context: 'test' },
      db,
    );

    expect(result.aiSource).toBe('rule');
    expect(result.diagnoses.some(d => d.text === 'hypertension')).toBe(true);
  });

  it('falls back to rule extraction when LLM returns malformed JSON', async () => {
    llmMock = {
      generate: jest.fn().mockResolvedValue({
        text: 'not json', backend: 'ollama', model: 'llama3', latencyMs: 100,
      }),
    };
    const module = await Test.createTestingModule({
      providers: [
        ClinicalNlpService,
        { provide: ClinicalLlmService, useValue: llmMock },
      ],
    }).compile();
    svc = module.get(ClinicalNlpService);
    const result = await svc.extractEntities('has diabetes and cough', { context: 'test' }, db);
    expect(result.aiSource).toBe('rule');
  });

  it('returns empty entities for very short input', async () => {
    const module = await Test.createTestingModule({
      providers: [ClinicalNlpService],
    }).compile();
    svc = module.get(ClinicalNlpService);
    const result = await svc.extractEntities('ok', { context: 'test' }, db);
    expect(result.diagnoses).toHaveLength(0);
  });

  it('audits every extraction call', async () => {
    llmMock = {
      generate: jest.fn().mockResolvedValue({
        text: LLM_JSON, backend: 'ollama', model: 'llama3', latencyMs: 200,
      }),
    };
    const module = await Test.createTestingModule({
      providers: [
        ClinicalNlpService,
        { provide: ClinicalLlmService, useValue: llmMock },
      ],
    }).compile();
    svc = module.get(ClinicalNlpService);
    await svc.extractEntities('Patient has HIV.', { context: 'test', patientId: 1 }, db);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO clinical_nlp_extractions'),
      expect.any(Array),
    );
  });
});
