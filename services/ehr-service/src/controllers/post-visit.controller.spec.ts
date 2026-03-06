import { Test, TestingModule } from '@nestjs/testing';
import { PostVisitController } from './post-visit.controller';
import { PostVisitService } from '../services/post-visit.service';
import { UploadSecurityService } from '../services/upload-security.service';

describe('PostVisitController', () => {
  let controller: PostVisitController;

  const postVisitServiceMock = {
    createSession: jest.fn(),
    listSessions: jest.fn(),
    getSession: jest.fn(),
    getSessionDraft: jest.fn(),
    getSessionDiarization: jest.fn(),
    getSessionFhirProjection: jest.fn(),
    getSessionMobileContract: jest.fn(),
    listSessionMobileEvents: jest.fn(),
    generateDraftArtifacts: jest.fn(),
    reviewDraftArtifact: jest.fn(),
    reassignDiarizationSegment: jest.fn(),
    ingestDocumentIntelligence: jest.fn(),
    listSessionDocumentIntelligence: jest.fn(),
    analyzeIntraVisitAlerts: jest.fn(),
    listIntraVisitAlerts: jest.fn(),
    resolveIntraVisitAlert: jest.fn(),
    executeRecommendationAction: jest.fn(),
    transcribeSessionAudio: jest.fn(),
    publishSession: jest.fn(),
    classifyEscalation: jest.fn(),
    listEscalations: jest.fn(),
    resolveEscalation: jest.fn(),
  };

  const uploadSecurityServiceMock = {
    assertCleanUpload: jest.fn(),
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
