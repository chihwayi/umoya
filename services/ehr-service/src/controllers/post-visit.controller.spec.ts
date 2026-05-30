import { Test, TestingModule } from '@nestjs/testing';
import { PostVisitController } from './post-visit.controller';
import { PostVisitService } from '../services/post-visit.service';
import { UploadSecurityService } from '../services/upload-security.service';
import { FollowUpRecommendationService } from '../services/followup-recommendation.service';

describe('PostVisitController', () => {
  let controller: PostVisitController;

  const postVisitServiceMock = {
    createSession: jest.fn(),
    listSessions: jest.fn(),
    getSession: jest.fn(),
    getSessionDraft: jest.fn(),
    getSessionRecordingUrl: jest.fn(),
    getAnnotatedDraft: jest.fn(),
    askAboutSection: jest.fn(),
    getSessionDiarization: jest.fn(),
    getSessionFhirProjection: jest.fn(),
    getSessionMobileContract: jest.fn(),
    listSessionMobileEvents: jest.fn(),
    generateDraftArtifacts: jest.fn(),
    reviewDraftArtifact: jest.fn(),
    generateSessionAdminDocuments: jest.fn(),
    listSessionAdminDocuments: jest.fn(),
    listSessionTrialMatches: jest.fn(),
    reviewTrialMatch: jest.fn(),
    listTrialMatchAuditLog: jest.fn(),
    listSessionCompanionMemory: jest.fn(),
    curateCompanionMemory: jest.fn(),
    getTrialMemoryAnalytics: jest.fn(),
    getTrialDecisionSlaAccountability: jest.fn(),
    exportTrialMemoryAudit: jest.fn(),
    listTrialDecisionCoordinationQueue: jest.fn(),
    executeVoiceReviewCommand: jest.fn(),
    reassignDiarizationSegment: jest.fn(),
    ingestDocumentIntelligence: jest.fn(),
    listSessionDocumentIntelligence: jest.fn(),
    analyzeIntraVisitAudioChunk: jest.fn(),
    analyzeIntraVisitAlerts: jest.fn(),
    listIntraVisitAlerts: jest.fn(),
    resolveIntraVisitAlert: jest.fn(),
    getSessionBillingIntelligence: jest.fn(),
    reviewBillingSuggestion: jest.fn(),
    generateAppointmentPreVisitBrief: jest.fn(),
    generatePreVisitBriefsForUpcomingAppointments: jest.fn(),
    markAdminDocumentDispatched: jest.fn(),
    executeRecommendationAction: jest.fn(),
    transcribeSessionAudio: jest.fn(),
    publishSession: jest.fn(),
    classifyEscalation: jest.fn(),
    listEscalations: jest.fn(),
    resolveEscalation: jest.fn(),
    getPatientStoryLatest: jest.fn(),
    getPatientStoryVersions: jest.fn(),
    getPatientStoryVersion: jest.fn(),
    getPatientStoryDiff: jest.fn(),
    logFhirSyncAttempt: jest.fn(),
    queueFhirWriteBack: jest.fn(),
    getFhirSyncLogForSession: jest.fn(),
    createPeerConsultRequest: jest.fn(),
    respondPeerConsult: jest.fn(),
    listPeerConsults: jest.fn(),
  };

  const uploadSecurityServiceMock = {
    assertCleanUpload: jest.fn(),
  };

  const followUpServiceMock = {
    generateRecommendation: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostVisitController],
      providers: [
        {
          provide: PostVisitService,
          useValue: postVisitServiceMock,
        },
        {
          provide: UploadSecurityService,
          useValue: uploadSecurityServiceMock,
        },
        {
          provide: FollowUpRecommendationService,
          useValue: followUpServiceMock,
        },
      ],
    }).compile();

    controller = module.get<PostVisitController>(PostVisitController);
    jest.clearAllMocks();
  });

  it('creates a session with tenant/user context', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.createSession.mockResolvedValue({ id: 'session-1' });

    const result = await controller.createSession(
      {
        patientId: 'patient-1',
      },
      req,
    );

    expect(postVisitServiceMock.createSession).toHaveBeenCalledWith(
      req.tenantDb,
      expect.objectContaining({ patientId: 'patient-1' }),
      {
        tenantId: 'tenant-a',
        actorUserId: 'doctor-1',
      },
    );
    expect(result).toEqual({ id: 'session-1' });
  });

  it('lists clinician post-visit sessions with normalized query filters', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.listSessions.mockResolvedValue({
      sessions: [{ id: 'session-1' }],
      paging: { limit: 10, offset: 0, total: 1 },
    });

    const result = await controller.listSessions(
      req,
      'doctor_reviewed',
      'patient-1',
      'doctor-1',
      'telemedicine',
      'true',
      '10',
      '0',
    );

    expect(postVisitServiceMock.listSessions).toHaveBeenCalledWith(
      req.tenantDb,
      expect.objectContaining({
        status: 'doctor_reviewed',
        patientId: 'patient-1',
        doctorId: 'doctor-1',
        sourceType: 'telemedicine',
        includePublishedOnly: true,
        limit: 10,
        offset: 0,
      }),
    );
    expect(result.paging.total).toBe(1);
  });

  it('transcribes and persists audio for a session', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      headers: { authorization: 'Bearer token' },
      user: { id: 'doctor-1' },
    } as any;
    const file = {
      buffer: Buffer.from('audio'),
      originalname: 'consult.wav',
      mimetype: 'audio/wav',
    } as Express.Multer.File;

    uploadSecurityServiceMock.assertCleanUpload.mockResolvedValue(undefined);
    postVisitServiceMock.transcribeSessionAudio.mockResolvedValue({
      session: { id: 'session-1', status: 'draft_ready' },
    });

    const result = await controller.transcribeSession(
      'session-1',
      file,
      { language: 'en', temperature: '0.2' },
      req,
    );

    expect(uploadSecurityServiceMock.assertCleanUpload).toHaveBeenCalledWith(file, 'audio');
    expect(postVisitServiceMock.transcribeSessionAudio).toHaveBeenCalledWith(
      req.tenantDb,
      'session-1',
      file,
      expect.objectContaining({
        language: 'en',
        temperature: 0.2,
      }),
      expect.objectContaining({
        tenantId: 'tenant-a',
        authorization: 'Bearer token',
        actorUserId: 'doctor-1',
      }),
    );
    expect(result).toEqual({
      session: { id: 'session-1', status: 'draft_ready' },
    });
  });

  it('ingests post-visit document intelligence from uploaded file', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      headers: { authorization: 'Bearer token' },
      user: { id: 'doctor-1' },
    } as any;
    const file = {
      buffer: Buffer.from('Potassium: 6.4 mmol/L'),
      originalname: 'lab-report.txt',
      mimetype: 'text/plain',
      size: 25,
    } as Express.Multer.File;

    uploadSecurityServiceMock.assertCleanUpload.mockResolvedValue(undefined);
    postVisitServiceMock.ingestDocumentIntelligence.mockResolvedValue({
      id: 'doc-intel-1',
      criticalDetected: true,
    });

    const result = await controller.ingestDocumentIntelligence(
      'session-1',
      file,
      { documentType: 'lab_report', language: 'en', note: 'uploaded from doctor workspace' },
      req,
    );

    expect(uploadSecurityServiceMock.assertCleanUpload).toHaveBeenCalledWith(file, 'document');
    expect(postVisitServiceMock.ingestDocumentIntelligence).toHaveBeenCalledWith(
      req.tenantDb,
      'session-1',
      file,
      expect.objectContaining({ documentType: 'lab_report' }),
      expect.objectContaining({
        actorUserId: 'doctor-1',
        tenantId: 'tenant-a',
      }),
    );
    expect(result.criticalDetected).toBe(true);
  });

  it('lists document intelligence extracts for a session', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.listSessionDocumentIntelligence.mockResolvedValue({
      sessionId: 'session-1',
      items: [{ id: 'doc-intel-1' }],
    });

    const result = await controller.listDocumentIntelligence('session-1', req, '30');
    expect(postVisitServiceMock.listSessionDocumentIntelligence).toHaveBeenCalledWith(
      req.tenantDb,
      'session-1',
      expect.objectContaining({ limit: 30 }),
    );
    expect(result.items).toHaveLength(1);
  });

  it('regenerates draft artifacts from transcript + context', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.generateDraftArtifacts.mockResolvedValue({
      sessionId: 'session-1',
      artifacts: [],
    });

    const result = await controller.regenerateDraft(
      'session-1',
      { reason: 'refresh_after_new_lab' },
      req,
    );

    expect(postVisitServiceMock.generateDraftArtifacts).toHaveBeenCalledWith(
      req.tenantDb,
      'session-1',
      expect.objectContaining({
        tenantId: 'tenant-a',
        actorUserId: 'doctor-1',
        source: 'post_visit_regenerate_endpoint',
        reason: 'refresh_after_new_lab',
      }),
    );
    expect(result).toEqual({
      sessionId: 'session-1',
      artifacts: [],
    });
  });

  it('returns FHIR projection bundle for post-visit session', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.getSessionFhirProjection.mockResolvedValue({
      sessionId: 'session-1',
      exportVersion: 'post-visit-fhir-r4.v1',
      bundle: { resourceType: 'Bundle', entry: [] },
    });

    const result = await controller.getSessionFhirProjection('session-1', req);
    expect(postVisitServiceMock.getSessionFhirProjection).toHaveBeenCalledWith(req.tenantDb, 'session-1');
    expect(result.exportVersion).toBe('post-visit-fhir-r4.v1');
  });

  it('returns signed recording URL when recording exists', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.getSessionRecordingUrl.mockResolvedValue({
      url: 'https://storage.example/signed-url',
      mimeType: 'audio/webm',
      durationMs: 120000,
    });

    const result = await controller.getSessionRecordingUrl('session-1', req);
    expect(postVisitServiceMock.getSessionRecordingUrl).toHaveBeenCalledWith('session-1', req.tenantDb);
    expect(result).toEqual({
      url: 'https://storage.example/signed-url',
      mimeType: 'audio/webm',
      durationMs: 120000,
    });
  });

  it('returns url null when no recording for session', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.getSessionRecordingUrl.mockResolvedValue({ url: null });

    const result = await controller.getSessionRecordingUrl('session-1', req);
    expect(postVisitServiceMock.getSessionRecordingUrl).toHaveBeenCalledWith('session-1', req.tenantDb);
    expect(result).toEqual({ url: null });
  });

  it('returns annotated draft with entity spans', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.getAnnotatedDraft.mockResolvedValue({
      sessionId: 'session-1',
      entities: [{ id: 'e1', entityType: 'symptom', entityValue: 'chest pain' }],
      artifacts: [
        {
          artifactType: 'visit_summary',
          content: {
            plain_language_summary: {
              raw: 'Patient presents with chest pain.',
              spans: [
                { text: 'Patient presents with ', isEntity: false, startIndex: 0, endIndex: 22 },
                { text: 'chest pain', isEntity: true, entityType: 'symptom', startIndex: 22, endIndex: 32 },
              ],
            },
          },
        },
      ],
    });

    const result = await controller.getAnnotatedDraft('session-1', req);
    expect(postVisitServiceMock.getAnnotatedDraft).toHaveBeenCalledWith('session-1', req.tenantDb);
    expect(result.sessionId).toBe('session-1');
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0].content.plain_language_summary.spans).toHaveLength(2);
  });

  it('askAboutSection returns section-scoped answer', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.askAboutSection.mockResolvedValue({
      answer: 'The assessment indicates stable angina.',
      abstained: false,
    });

    const result = await controller.askAboutSection(
      'session-1',
      { question: 'What does the assessment say?', sectionType: 'assessment' },
      req,
    );
    expect(postVisitServiceMock.askAboutSection).toHaveBeenCalledWith(
      'session-1',
      { question: 'What does the assessment say?', sectionType: 'assessment' },
      req.tenantDb,
    );
    expect(result.answer).toBe('The assessment indicates stable angina.');
    expect(result.abstained).toBe(false);
  });

  it('returns diarization review segments with normalized filters', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.getSessionDiarization.mockResolvedValue({
      sessionId: 'session-1',
      reviewEnabled: true,
      summary: { totalSegments: 2, unresolvedSegments: 1 },
      segments: [{ id: 'seg-1' }],
    });

    const result = await controller.getSessionDiarization('session-1', req, '120', 'yes');
    expect(postVisitServiceMock.getSessionDiarization).toHaveBeenCalledWith(
      req.tenantDb,
      'session-1',
      expect.objectContaining({
        limit: 120,
        unresolvedOnly: true,
      }),
    );
    expect(result.reviewEnabled).toBe(true);
  });

  it('reassigns diarization segment speaker attribution from clinician workspace', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.reassignDiarizationSegment.mockResolvedValue({
      id: 'seg-1',
      speakerRole: 'doctor',
      needsReview: false,
    });

    const result = await controller.reassignDiarizationSegment(
      'session-1',
      'seg-1',
      { speakerRole: 'doctor', note: 'confirmed' },
      req,
    );

    expect(postVisitServiceMock.reassignDiarizationSegment).toHaveBeenCalledWith(
      req.tenantDb,
      'session-1',
      'seg-1',
      expect.objectContaining({ speakerRole: 'doctor' }),
      expect.objectContaining({ actorUserId: 'doctor-1' }),
    );
    expect(result.needsReview).toBe(false);
  });

  it('returns versioned mobile contract payload', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.getSessionMobileContract.mockResolvedValue({
      contractVersion: 'post-visit-mobile.v1',
      session: { id: 'session-1' },
    });

    const result = await controller.getSessionMobileContract('session-1', req, 'v1');
    expect(postVisitServiceMock.getSessionMobileContract).toHaveBeenCalledWith(
      req.tenantDb,
      'session-1',
      expect.objectContaining({ version: 'v1' }),
    );
    expect(result.contractVersion).toBe('post-visit-mobile.v1');
  });

  it('returns versioned mobile events feed', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.listSessionMobileEvents.mockResolvedValue({
      contractVersion: 'post-visit-mobile-events.v1',
      events: [{ id: 'publish:session-1', eventType: 'post_visit.session.published' }],
      paging: { limit: 20, offset: 0, total: 1 },
    });

    const result = await controller.getSessionMobileEvents('session-1', req, 'v1', '20', '0');
    expect(postVisitServiceMock.listSessionMobileEvents).toHaveBeenCalledWith(
      req.tenantDb,
      'session-1',
      expect.objectContaining({
        version: 'v1',
        limit: 20,
        offset: 0,
      }),
    );
    expect(result.contractVersion).toBe('post-visit-mobile-events.v1');
    expect(result.events).toHaveLength(1);
  });

  it('persists doctor review actions for artifacts', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.reviewDraftArtifact.mockResolvedValue({
      session: { id: 'session-1', status: 'doctor_reviewed' },
      reviewAction: { action: 'accept' },
    });

    const result = await controller.reviewArtifact(
      'session-1',
      {
        artifactType: 'recommendation_bundle',
        action: 'accept',
        reason: 'approved for release',
      },
      req,
    );

    expect(postVisitServiceMock.reviewDraftArtifact).toHaveBeenCalledWith(
      req.tenantDb,
      'session-1',
      expect.objectContaining({
        artifactType: 'recommendation_bundle',
        action: 'accept',
      }),
      expect.objectContaining({
        tenantId: 'tenant-a',
        actorUserId: 'doctor-1',
        source: 'post_visit_review_endpoint',
      }),
    );
    expect(result.session.status).toBe('doctor_reviewed');
  });

  it('executes recommendation action from doctor workspace', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.executeRecommendationAction.mockResolvedValue({
      reused: false,
      execution: { recommendationId: 'htn_followup', status: 'executed' },
    });

    const result = await controller.executeRecommendationAction(
      'session-1',
      'htn_followup',
      { note: 'Proceed with follow-up' },
      req,
    );

    expect(postVisitServiceMock.executeRecommendationAction).toHaveBeenCalledWith(
      req.tenantDb,
      'session-1',
      'htn_followup',
      expect.objectContaining({ note: 'Proceed with follow-up' }),
      expect.objectContaining({
        tenantId: 'tenant-a',
        actorUserId: 'doctor-1',
        source: 'post_visit_execute_recommendation_endpoint',
      }),
    );
    expect(result.execution.status).toBe('executed');
  });

  it('returns generated pre-visit brief and follow-up risk for appointment context', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.generateAppointmentPreVisitBrief.mockResolvedValue({
      featureEnabled: true,
      appointmentId: 'appt-1',
      followUpRisk: { score: 72, tier: 'high' },
    });

    const result = await controller.getAppointmentPreVisitBrief('appt-1', req, 'true');

    expect(postVisitServiceMock.generateAppointmentPreVisitBrief).toHaveBeenCalledWith(
      req.tenantDb,
      'appt-1',
      expect.objectContaining({
        actorUserId: 'doctor-1',
        forceRefresh: true,
      }),
    );
    expect(result.followUpRisk.score).toBe(72);
  });

  it('POST jobs/generate-previsit-briefs calls service with tenantDb and optional withinMinutes', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: {},
      user: { id: 'admin-1' },
    } as any;
    postVisitServiceMock.generatePreVisitBriefsForUpcomingAppointments.mockResolvedValue({
      generated: 2,
      skipped: 0,
      errors: [],
    });

    const result = await controller.generatePreVisitBriefsJob(req, '90');

    expect(postVisitServiceMock.generatePreVisitBriefsForUpcomingAppointments).toHaveBeenCalledWith(
      req.tenantDb,
      { withinMinutes: 90 },
    );
    expect(result.generated).toBe(2);
    expect(result.errors).toEqual([]);
  });

  it('generates and signs post-visit admin documents for doctor workflow', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.generateSessionAdminDocuments.mockResolvedValue({
      featureEnabled: true,
      sessionId: 'session-1',
      generatedCount: 2,
      documents: [{ id: 'doc-1', documentType: 'referral_letter', status: 'signed' }],
    });

    const result = await controller.generateSessionAdminDocuments(
      'session-1',
      {
        documentTypes: ['referral_letter', 'sick_note'],
        note: 'Generate all docs from doctor workspace',
      },
      req,
    );

    expect(postVisitServiceMock.generateSessionAdminDocuments).toHaveBeenCalledWith(
      req.tenantDb,
      'session-1',
      expect.objectContaining({
        documentTypes: ['referral_letter', 'sick_note'],
      }),
      expect.objectContaining({
        actorUserId: 'doctor-1',
      }),
    );
    expect(result.generatedCount).toBe(2);
  });

  it('marks signed admin document as dispatched with audit', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: {},
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.markAdminDocumentDispatched.mockResolvedValue({
      documentId: 'doc-1',
      sessionId: 'session-1',
      patientId: 'patient-1',
      status: 'dispatched',
      document: { id: 'doc-1', status: 'dispatched' },
    });

    const result = await controller.markAdminDocumentDispatched('doc-1', req);

    expect(postVisitServiceMock.markAdminDocumentDispatched).toHaveBeenCalledWith(
      req.tenantDb,
      'doc-1',
      { actorUserId: 'doctor-1' },
    );
    expect(result.status).toBe('dispatched');
  });

  it('executes voice command workflow action with tenant context', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.executeVoiceReviewCommand.mockResolvedValue({
      featureEnabled: true,
      sessionId: 'session-1',
      command: 'SIGN_AND_PUBLISH',
      status: 'executed',
    });

    const result = await controller.executeVoiceCommand(
      'session-1',
      {
        command: 'SIGN_AND_PUBLISH',
        note: 'Voice sign and publish',
        confirmSignAndPublish: true,
      },
      req,
    );

    expect(postVisitServiceMock.executeVoiceReviewCommand).toHaveBeenCalledWith(
      req.tenantDb,
      'session-1',
      expect.objectContaining({
        command: 'SIGN_AND_PUBLISH',
        confirmSignAndPublish: true,
      }),
      expect.objectContaining({
        tenantId: 'tenant-a',
        actorUserId: 'doctor-1',
      }),
    );
    expect(result.status).toBe('executed');
  });

  it('lists trial matches with refresh option for doctor workflow', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.listSessionTrialMatches.mockResolvedValue({
      featureEnabled: true,
      sessionId: 'session-1',
      matches: [{ id: 'trial-1', matchStatus: 'proposed' }],
    });

    const result = await controller.listSessionTrialMatches('session-1', req, 'true');
    expect(postVisitServiceMock.listSessionTrialMatches).toHaveBeenCalledWith(
      req.tenantDb,
      'session-1',
      expect.objectContaining({
        refresh: true,
        actorUserId: 'doctor-1',
      }),
    );
    expect(result.matches).toHaveLength(1);
  });

  it('persists trial match review decision', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.reviewTrialMatch.mockResolvedValue({
      sessionId: 'session-1',
      action: 'consider',
      match: { id: 'trial-1', matchStatus: 'considered' },
    });

    const result = await controller.reviewTrialMatch(
      'session-1',
      'trial-1',
      {
        action: 'consider',
        note: 'Potential fit for this patient',
      },
      req,
    );

    expect(postVisitServiceMock.reviewTrialMatch).toHaveBeenCalledWith(
      req.tenantDb,
      'session-1',
      'trial-1',
      expect.objectContaining({ action: 'consider' }),
      expect.objectContaining({ actorUserId: 'doctor-1' }),
    );
    expect(result.match.matchStatus).toBe('considered');
  });

  it('returns trial match action audit drilldown', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.listTrialMatchAuditLog.mockResolvedValue({
      sessionId: 'session-1',
      matchId: 'trial-1',
      entries: [{ id: 'audit-1', action: 'consider' }],
      summary: { total: 1, lastAction: 'consider' },
    });

    const result = await controller.listTrialMatchAuditLog('session-1', 'trial-1', req, '40');
    expect(postVisitServiceMock.listTrialMatchAuditLog).toHaveBeenCalledWith(
      req.tenantDb,
      'session-1',
      'trial-1',
      expect.objectContaining({ limit: 40 }),
    );
    expect(result.entries).toHaveLength(1);
  });

  it('lists companion memory profile for doctor review', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.listSessionCompanionMemory.mockResolvedValue({
      featureEnabled: true,
      sessionId: 'session-1',
      memories: [{ id: 'mem-1', memoryType: 'preference' }],
    });

    const result = await controller.listSessionCompanionMemory('session-1', req, '20');
    expect(postVisitServiceMock.listSessionCompanionMemory).toHaveBeenCalledWith(
      req.tenantDb,
      'session-1',
      expect.objectContaining({
        limit: 20,
        includeInactive: false,
      }),
    );
    expect(result.memories).toHaveLength(1);
  });

  it('curates companion memory entry from doctor workspace', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.curateCompanionMemory.mockResolvedValue({
      sessionId: 'session-1',
      action: 'retire',
      memory: { id: 'mem-1', isActive: false },
    });

    const result = await controller.curateCompanionMemory(
      'session-1',
      'mem-1',
      {
        action: 'retire',
        note: 'Outdated after medication reconciliation',
      },
      req,
    );
    expect(postVisitServiceMock.curateCompanionMemory).toHaveBeenCalledWith(
      req.tenantDb,
      'session-1',
      'mem-1',
      expect.objectContaining({ action: 'retire' }),
      expect.objectContaining({ actorUserId: 'doctor-1' }),
    );
    expect(result.memory.isActive).toBe(false);
  });

  it('returns trial and memory analytics snapshot', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.getTrialMemoryAnalytics.mockResolvedValue({
      trialFunnel: { total: 10, enrolled: 2 },
      companionMemory: { total: 5 },
    });

    const result = await controller.getTrialMemoryAnalytics(req, '30', 'doctor');
    expect(postVisitServiceMock.getTrialMemoryAnalytics).toHaveBeenCalledWith(
      req.tenantDb,
      expect.objectContaining({
        days: 30,
        routeTarget: 'doctor',
      }),
    );
    expect(result.trialFunnel.total).toBe(10);
  });

  it('returns per-clinician trial SLA accountability analytics', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.getTrialDecisionSlaAccountability.mockResolvedValue({
      summary: { totalEscalations: 8 },
      items: [{ clinician: { id: 'doctor-1' }, openCount: 2 }],
    });

    const result = await controller.getTrialDecisionSlaAccountability(req, '14', 'doctor', 'doctor-1', '12');
    expect(postVisitServiceMock.getTrialDecisionSlaAccountability).toHaveBeenCalledWith(
      req.tenantDb,
      expect.objectContaining({
        days: 14,
        routeTarget: 'doctor',
        clinicianId: 'doctor-1',
        limit: 12,
      }),
    );
    expect(result.summary.totalEscalations).toBe(8);
  });

  it('exports trial/memory audit feed in csv format', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.exportTrialMemoryAudit.mockResolvedValue({
      format: 'csv',
      csv: 'eventType,eventTimestamp\ntrial_sla_escalation,2026-03-06T10:00:00.000Z',
      summary: { totalRecords: 1 },
    });

    const result = await controller.exportTrialMemoryAudit(
      req,
      '30',
      'csv',
      'nurse',
      'doctor-1',
      'session-1',
      '50',
    );
    expect(postVisitServiceMock.exportTrialMemoryAudit).toHaveBeenCalledWith(
      req.tenantDb,
      expect.objectContaining({
        days: 30,
        format: 'csv',
        routeTarget: 'nurse',
        clinicianId: 'doctor-1',
        sessionId: 'session-1',
        limit: 50,
      }),
    );
    expect(result.format).toBe('csv');
    expect(result.summary.totalRecords).toBe(1);
  });

  it('lists trial decision coordination queue', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.listTrialDecisionCoordinationQueue.mockResolvedValue({
      items: [{ id: 'esc-1' }],
      summary: { total: 1, openCount: 1, breachedCount: 0 },
    });

    const result = await controller.listTrialDecisionCoordinationQueue(req, 'open', 'nurse', '20', '0');
    expect(postVisitServiceMock.listTrialDecisionCoordinationQueue).toHaveBeenCalledWith(
      req.tenantDb,
      expect.objectContaining({
        status: 'open',
        routeTarget: 'nurse',
        limit: 20,
        offset: 0,
      }),
    );
    expect(result.items).toHaveLength(1);
  });

  it('publishes reviewed post-visit session for patient companion access', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.publishSession.mockResolvedValue({
      session: { id: 'session-1', status: 'published' },
    });

    const result = await controller.publishSession(
      'session-1',
      {
        note: 'Ready for patient companion release',
        acknowledgedSupersededCitationIds: ['c6f2e0f5-5a0f-4117-b8cb-8e6c6c6e565f'],
      },
      req,
    );

    expect(postVisitServiceMock.publishSession).toHaveBeenCalledWith(
      req.tenantDb,
      'session-1',
      expect.objectContaining({
        note: 'Ready for patient companion release',
        acknowledgedSupersededCitationIds: ['c6f2e0f5-5a0f-4117-b8cb-8e6c6c6e565f'],
      }),
      expect.objectContaining({
        tenantId: 'tenant-a',
        actorUserId: 'doctor-1',
        source: 'post_visit_publish_endpoint',
      }),
    );
    expect(result.session.status).toBe('published');
  });

  it('lists post-visit escalations for clinician queue views', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.listEscalations.mockResolvedValue({
      escalations: [{ id: 'esc-1', status: 'open' }],
      summary: { openCount: 1 },
    });

    const result = await controller.getEscalations(
      req,
      'open',
      'high',
      'doctor',
      'trial_decision_sla_breach',
      undefined,
      undefined,
      undefined,
      undefined,
      '10',
      '0',
    );

    expect(postVisitServiceMock.listEscalations).toHaveBeenCalledWith(
      req.tenantDb,
      expect.objectContaining({
        status: 'open',
        severity: 'high',
        routeTarget: 'doctor',
        triggerType: 'trial_decision_sla_breach',
        limit: 10,
        offset: 0,
      }),
    );
    expect(result.summary.openCount).toBe(1);
  });

  it('classifies escalation messages using v2 endpoint', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.classifyEscalation.mockResolvedValue({
      classification: {
        detected: true,
        severity: 'high',
        routeTarget: 'doctor',
        confidence: 0.84,
        temporality: 'current',
      },
    });

    const result = await controller.classifyEscalation(
      { message: 'I have severe headache right now', sessionId: '0f089143-703e-4cf4-89dc-36fef2f5f1ff' },
      req,
    );

    expect(postVisitServiceMock.classifyEscalation).toHaveBeenCalledWith(
      req.tenantDb,
      expect.objectContaining({
        message: 'I have severe headache right now',
      }),
    );
    expect(result.classification.confidence).toBe(0.84);
  });

  it('resolves escalation events from post-visit safety queue', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.resolveEscalation.mockResolvedValue({
      id: 'esc-1',
      status: 'resolved',
    });

    const result = await controller.resolveEscalation(
      'esc-1',
      { status: 'resolved', resolutionNote: 'Called patient and stabilized' },
      req,
    );

    expect(postVisitServiceMock.resolveEscalation).toHaveBeenCalledWith(
      req.tenantDb,
      'esc-1',
      expect.objectContaining({ status: 'resolved' }),
      expect.objectContaining({ actorUserId: 'doctor-1' }),
    );
    expect(result.status).toBe('resolved');
  });

  it('analyzes intra-visit transcript chunk for safety alerts', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.analyzeIntraVisitAlerts.mockResolvedValue({
      featureEnabled: true,
      alerts: [{ id: 'intravisit-1', severity: 'critical' }],
    });

    const result = await controller.analyzeIntraVisitAlertChunk(
      'session-1',
      { text: 'Patient has chest pain and cannot breathe', source: 'streamed_transcript', transcriptOffsetSeconds: 33 },
      req,
    );

    expect(postVisitServiceMock.analyzeIntraVisitAlerts).toHaveBeenCalledWith(
      req.tenantDb,
      'session-1',
      expect.objectContaining({
        text: 'Patient has chest pain and cannot breathe',
      }),
      expect.objectContaining({ actorUserId: 'doctor-1' }),
    );
    expect(result.alerts).toHaveLength(1);
  });

  it('transcribes and analyzes intra-visit audio chunk for safety alerts', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      headers: { authorization: 'Bearer token' },
      user: { id: 'doctor-1' },
    } as any;
    const file = {
      buffer: Buffer.from('audio-bytes'),
      originalname: 'live-chunk.webm',
      mimetype: 'audio/webm',
      size: 1024,
    } as Express.Multer.File;

    uploadSecurityServiceMock.assertCleanUpload.mockResolvedValue(undefined);
    postVisitServiceMock.analyzeIntraVisitAudioChunk.mockResolvedValue({
      featureEnabled: true,
      transcript: { text: 'Patient says chest pain now' },
      alerts: [{ id: 'intravisit-2', severity: 'critical' }],
    });

    const result = await controller.analyzeIntraVisitAudioChunk(
      'session-1',
      file,
      { language: 'en', temperature: '0', source: 'browser_live_stream', transcriptOffsetSeconds: '12' },
      req,
    );

    expect(uploadSecurityServiceMock.assertCleanUpload).toHaveBeenCalledWith(file, 'audio');
    expect(postVisitServiceMock.analyzeIntraVisitAudioChunk).toHaveBeenCalledWith(
      req.tenantDb,
      'session-1',
      file,
      expect.objectContaining({
        language: 'en',
        source: 'browser_live_stream',
        transcriptOffsetSeconds: 12,
      }),
      expect.objectContaining({
        tenantId: 'tenant-a',
        authorization: 'Bearer token',
        actorUserId: 'doctor-1',
      }),
    );
    expect(result.alerts).toHaveLength(1);
  });

  it('lists intra-visit alerts with normalized paging filters', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.listIntraVisitAlerts.mockResolvedValue({
      featureEnabled: true,
      items: [{ id: 'intravisit-1', status: 'open' }],
      paging: { limit: 20, offset: 0 },
    });

    const result = await controller.listIntraVisitAlerts('session-1', req, 'open', '20', '0');

    expect(postVisitServiceMock.listIntraVisitAlerts).toHaveBeenCalledWith(
      req.tenantDb,
      'session-1',
      expect.objectContaining({
        status: 'open',
        limit: 20,
        offset: 0,
      }),
    );
    expect(result.items).toHaveLength(1);
  });

  it('resolves intra-visit alert from doctor workspace', async () => {
    const req = {
      tenantId: 'tenant-a',
      tenantDb: { query: jest.fn() },
      user: { id: 'doctor-1' },
    } as any;

    postVisitServiceMock.resolveIntraVisitAlert.mockResolvedValue({
      id: 'intravisit-1',
      status: 'confirmed',
    });

    const result = await controller.resolveIntraVisitAlert(
      'session-1',
      'intravisit-1',
      { status: 'confirmed', note: 'Confirmed at bedside' },
      req,
    );

    expect(postVisitServiceMock.resolveIntraVisitAlert).toHaveBeenCalledWith(
      req.tenantDb,
      'session-1',
      'intravisit-1',
      expect.objectContaining({ status: 'confirmed' }),
      expect.objectContaining({ actorUserId: 'doctor-1' }),
    );
    expect(result.status).toBe('confirmed');
  });
});
