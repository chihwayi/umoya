import { AmbientService } from './ambient.service';

describe('AmbientService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes chunk processing through governed CdssService ambient transcription', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'session-1',
        patientId: 'patient-1',
        appointmentId: 'appt-1',
        structuredOutput: {},
        draftNote: {},
        transcriptRaw: '',
        alertsRaised: [],
      }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const tenantDb = {
      getRepository: jest.fn().mockReturnValue(repo),
    } as any;
    const cdssService = {
      ambientTranscriptionStream: jest.fn().mockResolvedValue({
        transcript: 'Patient says she has cough.',
        entities: {
          diagnoses: [{ text: 'Cough', confidence: 0.7 }],
          medications: [],
          allergies: [],
          orders: [],
          vitals: [],
          alerts: [],
        },
        draftNote: { subjective: 'Cough for three days.' },
      }),
    };

    const service = new AmbientService(cdssService as any);
    const result = await service.processChunk('session-1', 'ZmFrZQ==', tenantDb);

    expect(cdssService.ambientTranscriptionStream).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        patientId: 'patient-1',
        appointmentId: 'appt-1',
      }),
      undefined,
      tenantDb,
    );
    expect(result.transcript).toContain('cough');
    expect(repo.update).toHaveBeenCalled();
  });
});
