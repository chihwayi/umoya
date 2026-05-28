import { Test } from '@nestjs/testing';
import { ClinicalLlmService } from './clinical-llm.service';

describe('ClinicalLlmService', () => {
  let svc: ClinicalLlmService;
  let db: any;
  const origFetch = global.fetch;
  const origEnv = { ...process.env };

  beforeEach(async () => {
    process.env.CLINICAL_LLM_BACKEND = 'ollama';
    process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
    process.env.OLLAMA_MODEL = 'llama3.2:3b';
    const module = await Test.createTestingModule({
      providers: [ClinicalLlmService],
    }).compile();
    svc = module.get(ClinicalLlmService);
    db = { query: jest.fn().mockResolvedValue([]) };
  });

  afterEach(() => {
    global.fetch = origFetch;
    process.env = { ...origEnv };
    jest.useRealTimers();
  });

  it('returns generated text from Ollama', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: '  Patient has hypertension.  ' }),
    } as any);

    const result = await svc.generate(
      'Summarise the patient in 1 sentence.',
      { context: 'clinical_summary', maxTokens: 128 },
      db,
    );

    expect(result).not.toBeNull();
    expect(result!.text).toBe('Patient has hypertension.');
    expect(result!.backend).toBe('ollama');
    expect(result!.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('returns null and logs abstention on timeout', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockImplementation(
      () => new Promise(() => { /* never resolves */ }),
    );

    const generatePromise = svc.generate(
      'Summarise.',
      { context: 'clinical_summary' },
      db,
    );
    jest.advanceTimersByTime(16_000);
    const result = await generatePromise;

    expect(result).toBeNull();
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO clinical_llm_audit'),
      expect.arrayContaining([false]),
    );
  });

  it('reports correct backend from getBackend()', () => {
    expect(svc.getBackend()).toBe('ollama');
  });

  it('reports isConfigured() = true when OLLAMA_BASE_URL is set', () => {
    expect(svc.isConfigured()).toBe(true);
  });

  it('reports isConfigured() = false when OLLAMA_BASE_URL is missing', async () => {
    delete process.env.OLLAMA_BASE_URL;
    const module = await Test.createTestingModule({
      providers: [ClinicalLlmService],
    }).compile();
    const svc2 = module.get(ClinicalLlmService);
    expect(svc2.isConfigured()).toBe(false);
  });
});
