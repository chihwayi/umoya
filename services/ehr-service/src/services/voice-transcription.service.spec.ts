import { VoiceTranscriptionService } from './voice-transcription.service';

function makeService(cdss?: any) {
  return new VoiceTranscriptionService(cdss ?? null, null);
}

function makeDb(overrides?: Record<string, any>) {
  return {
    query: jest.fn().mockImplementation((sql: string, params?: any[]) => {
      if (sql.includes('INSERT INTO voice_transcriptions')) {
        return Promise.resolve([{ id: 'tr-1' }]);
      }
      if (sql.includes('UPDATE voice_transcriptions')) return Promise.resolve([]);
      if (sql.includes('SELECT * FROM voice_transcriptions')) return Promise.resolve([]);
      return Promise.resolve([]);
    }),
    ...overrides,
  };
}

describe('VoiceTranscriptionService', () => {
  it('transcribes audio when CDSS is available', async () => {
    const cdss = {
      ambientTranscriptionStream: jest.fn().mockResolvedValue({
        transcript: 'Patient complains of chest pain.',
        entities: {
          diagnoses: [{ text: 'Chest pain', confidence: 0.9 }],
          medications: [],
          allergies: [],
          orders: [],
          vitals: [],
          alerts: [],
        },
        draftNote: { subjective: 'Chest pain', plan: 'ECG' },
        abstained: false,
        abstainReason: null,
        governance: {},
      }),
    };
    const svc = makeService(cdss);
    const db = makeDb();
    const result = await svc.transcribeAudio('base64audio', 'en', db, 'nurse-1', { patientId: 'p1' });
    expect(result.transcriptId).toBe('tr-1');
    expect(result.text).toBe('Patient complains of chest pain.');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('abstains gracefully when CDSS unavailable', async () => {
    const svc = makeService(null);
    const db = makeDb();
    const result = await svc.transcribeAudio('base64', 'en', db, 'nurse-1');
    expect(result.transcriptId).toBe('tr-1');
    expect(result.text).toBe('');
    expect(result.confidence).toBe(0);
  });

  it('parseClinical uses regex fallback when no CDSS', async () => {
    const svc = makeService(null);
    const db = makeDb();
    const structured = await svc.parseClinical('tr-1', 'BP: 120/80. Complaining of headache.', db);
    expect(structured.vitals?.bloodPressure).toBe('120/80');
  });

  it('maps CDSS vitals entities to structured data', async () => {
    const cdss = {
      ambientTranscriptionStream: jest.fn().mockResolvedValue({
        transcript: '',
        entities: {
          diagnoses: [],
          medications: [],
          allergies: [],
          orders: [],
          vitals: [{ type: 'bp', value: '130/85' }, { type: 'temperature', value: '37.2' }],
          alerts: [],
        },
        draftNote: {},
        abstained: false,
        abstainReason: null,
        governance: {},
      }),
    };
    const svc = makeService(cdss);
    const db = makeDb();
    await svc.transcribeAudio('base64', 'en', db, 'doc-1');
    const structured = await svc.parseClinical('tr-1', '', db);
    expect(structured).toBeDefined();
  });

  it('getTranscription returns null for missing record', async () => {
    const svc = makeService(null);
    const db = makeDb();
    const result = await svc.getTranscription('none', db);
    expect(result).toBeNull();
  });
});
