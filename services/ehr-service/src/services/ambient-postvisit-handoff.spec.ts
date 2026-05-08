describe('AmbientService endSession handoff', () => {
  it('creates a post_visit_sessions row on endSession', async () => {
    const mockCreateSession = jest.fn().mockResolvedValue({ id: 'pv-001' });
    const mockPostVisitSessionService = { createSession: mockCreateSession };

    const { AmbientService } = await import('./ambient.service');
    const svc = new (AmbientService as any)(
      { ambientTranscriptionStream: jest.fn() },
      mockPostVisitSessionService,
    );

    const mockSession = {
      id: 'as-001',
      patientId: 'p1',
      providerId: 'd1',
      appointmentId: null,
      sessionStartedAt: new Date(),
      status: 'active',
    };

    const mockTenantDb = {
      getRepository: jest.fn().mockReturnValue({
        update: jest.fn().mockResolvedValue({}),
        findOne: jest.fn().mockResolvedValue({ ...mockSession, status: 'completed' }),
      }),
      query: jest.fn().mockResolvedValue([]),
    } as any;

    const result = await svc.endSession('as-001', mockTenantDb, { tenantId: 't1' });

    expect(mockCreateSession).toHaveBeenCalledWith(
      mockTenantDb,
      expect.objectContaining({ patientId: 'p1', sourceType: 'in_person' }),
      { tenantId: 't1' },
    );
    expect(result.postVisitSessionId).toBe('pv-001');
    expect(mockTenantDb.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE post_visit_sessions'),
      ['as-001', 'pv-001'],
    );
  });

  it('does not throw when PostVisitSessionService is unavailable', async () => {
    const { AmbientService } = await import('./ambient.service');
    const svc = new (AmbientService as any)(
      { ambientTranscriptionStream: jest.fn() },
      undefined, // no postVisitSessionService
    );

    const mockTenantDb = {
      getRepository: jest.fn().mockReturnValue({
        update: jest.fn().mockResolvedValue({}),
        findOne: jest.fn().mockResolvedValue({ id: 'as-001', patientId: 'p1', providerId: 'd1', sessionStartedAt: new Date() }),
      }),
      query: jest.fn().mockResolvedValue([]),
    } as any;

    const result = await svc.endSession('as-001', mockTenantDb);
    expect(result.postVisitSessionId).toBeUndefined();
  });

  it('queues failed chunk for retry', async () => {
    const { AmbientService } = await import('./ambient.service');
    const svc = new (AmbientService as any)(
      { ambientTranscriptionStream: jest.fn().mockRejectedValue(new Error('CDSS down')) },
      undefined,
    );

    const mockSession = {
      id: 'as-001', patientId: 'p1', providerId: 'd1',
      transcriptRaw: '', structuredOutput: {}, draftNote: {},
      alertsRaised: [],
    };

    const mockTenantDb = {
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockSession),
        update: jest.fn().mockResolvedValue({}),
      }),
    } as any;

    // processChunk should not throw even when CDSS fails
    await expect(svc.processChunk('as-001', 'base64audio', mockTenantDb)).resolves.toBeDefined();
    expect((svc as any).chunkRetryQueue.length).toBe(1);
    expect((svc as any).chunkRetryQueue[0].sessionId).toBe('as-001');
  });
});
