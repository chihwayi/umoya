import { Test, TestingModule } from '@nestjs/testing';
import { PostVisitController } from './post-visit.controller';
import { PostVisitService } from '../services/post-visit.service';
import { UploadSecurityService } from '../services/upload-security.service';

describe('PostVisitController', () => {
  let controller: PostVisitController;

  const postVisitServiceMock = {
    createSession: jest.fn(),
    getSession: jest.fn(),
    getSessionDraft: jest.fn(),
    getSessionFhirProjection: jest.fn(),
    getSessionMobileContract: jest.fn(),
    listSessionMobileEvents: jest.fn(),
    generateDraftArtifacts: jest.fn(),
    reviewDraftArtifact: jest.fn(),
    executeRecommendationAction: jest.fn(),
    transcribeSessionAudio: jest.fn(),
    publishSession: jest.fn(),
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
      { note: 'Ready for patient companion release' },
      req,
    );

    expect(postVisitServiceMock.publishSession).toHaveBeenCalledWith(
      req.tenantDb,
      'session-1',
      expect.objectContaining({ note: 'Ready for patient companion release' }),
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
});
