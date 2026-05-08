describe('PostVisitIngestionCronService', () => {
  const buildService = (overrides: any = {}) => {
    const { PostVisitIngestionCronService } = require('./post-visit-ingestion-cron.service');
    const mockPostVisitService = {
      ingestTranscriptionResult: jest.fn().mockResolvedValue({}),
      ...overrides.postVisitService,
    };
    const mockTranscriptionService = {
      transcribe: jest.fn().mockResolvedValue({
        text: 'Patient reports headache.',
        language: 'en',
        segments: [],
        confidence: 0.95,
      }),
      ...overrides.transcriptionService,
    };
    const mockFileStorageService = {
      downloadBuffer: jest.fn().mockResolvedValue(Buffer.from('fake-mp4')),
      ...overrides.fileStorageService,
    };
    const mockTenantService = {
      getAllActiveTenants: jest.fn().mockResolvedValue(['clinic-a']),
      getTenantDatabase: jest.fn().mockResolvedValue(overrides.tenantDb ?? null),
      ...overrides.tenantService,
    };
    return new PostVisitIngestionCronService(
      mockPostVisitService,
      mockTranscriptionService,
      mockFileStorageService,
      mockTenantService,
    );
  };

  it('calls ingestTranscriptionResult for an ambient captured session', async () => {
    const mockTenantDb = {
      query: jest.fn()
        .mockResolvedValueOnce([
          { id: 's1', source_type: 'in_person', ambient_session_id: 'a1', recording_storage_key: null, patient_id: 'p1', doctor_id: 'd1', language: 'en' },
        ])
        .mockResolvedValueOnce([
          { transcript_raw: 'Patient has a cough.', structured_output: {}, draft_note: { subjective: 'cough', objective: '', assessment: '', plan: '' }, session_started_at: new Date(), session_ended_at: new Date() },
        ]),
    } as any;

    const mockIngest = jest.fn().mockResolvedValue({});
    const svc = buildService({
      tenantDb: mockTenantDb,
      postVisitService: { ingestTranscriptionResult: mockIngest },
    });

    await svc.ingestCapturedSessions();

    expect(mockIngest).toHaveBeenCalledWith(
      mockTenantDb,
      's1',
      expect.objectContaining({ text: 'Patient has a cough.', language: 'en' }),
      expect.objectContaining({ source: 'ingestion_cron_in_person' }),
    );
  });

  it('calls transcriptionService.transcribe for a telemedicine recording session', async () => {
    const mockTenantDb = {
      query: jest.fn().mockResolvedValueOnce([
        { id: 's2', source_type: 'telemedicine', ambient_session_id: null, recording_storage_key: 'post-visit/recordings/s2/recording.mp4', patient_id: 'p1', doctor_id: 'd1', language: 'en' },
      ]),
    } as any;

    const mockTranscribe = jest.fn().mockResolvedValue({ text: 'Transcribed tele.', language: 'en', segments: [], confidence: 0.9 });
    const mockIngest = jest.fn().mockResolvedValue({});
    const svc = buildService({
      tenantDb: mockTenantDb,
      transcriptionService: { transcribe: mockTranscribe },
      postVisitService: { ingestTranscriptionResult: mockIngest },
    });

    await svc.ingestCapturedSessions();

    expect(mockTranscribe).toHaveBeenCalledWith(
      expect.objectContaining({ mimetype: 'video/mp4' }),
      expect.objectContaining({ language: 'en' }),
      {},
    );
    expect(mockIngest).toHaveBeenCalledWith(
      mockTenantDb,
      's2',
      expect.objectContaining({ text: 'Transcribed tele.' }),
      expect.objectContaining({ source: 'ingestion_cron_telemedicine' }),
    );
  });

  it('does not process the same session twice concurrently', async () => {
    const mockTenantDb = {
      query: jest.fn().mockResolvedValue([
        { id: 's3', source_type: 'in_person', ambient_session_id: 'a3', recording_storage_key: null, patient_id: 'p1', doctor_id: 'd1', language: 'en' },
        { id: 's3', source_type: 'in_person', ambient_session_id: 'a3', recording_storage_key: null, patient_id: 'p1', doctor_id: 'd1', language: 'en' },
      ]),
    } as any;

    const mockIngest = jest.fn().mockResolvedValue({});
    const svc = buildService({
      tenantDb: mockTenantDb,
      postVisitService: { ingestTranscriptionResult: mockIngest },
    });

    // Force s3 into inFlight before calling
    (svc as any).inFlight.add('s3');

    // Even though the query returns s3 twice, it should not be processed
    await svc['processTenant'](mockTenantDb, 'clinic-a');
    await new Promise(r => setTimeout(r, 50));

    expect(mockIngest).not.toHaveBeenCalled();
  });

  it('skips sessions with neither ambient_session_id nor recording_storage_key', async () => {
    const mockTenantDb = {
      query: jest.fn().mockResolvedValue([
        { id: 's4', source_type: 'in_person', ambient_session_id: null, recording_storage_key: null, patient_id: 'p1', doctor_id: 'd1', language: 'en' },
      ]),
    } as any;

    const mockIngest = jest.fn().mockResolvedValue({});
    const svc = buildService({
      tenantDb: mockTenantDb,
      postVisitService: { ingestTranscriptionResult: mockIngest },
    });

    await svc['processTenant'](mockTenantDb, 'clinic-a');
    await new Promise(r => setTimeout(r, 50));

    expect(mockIngest).not.toHaveBeenCalled();
  });

  it('respects FEATURE_POSTVISIT_INGESTION_CRON=false', async () => {
    process.env.FEATURE_POSTVISIT_INGESTION_CRON = 'false';
    const mockIngest = jest.fn();
    const svc = buildService({ postVisitService: { ingestTranscriptionResult: mockIngest } });

    await svc.ingestCapturedSessions();

    expect(mockIngest).not.toHaveBeenCalled();
    delete process.env.FEATURE_POSTVISIT_INGESTION_CRON;
  });
});
