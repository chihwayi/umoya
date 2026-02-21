import { CdssService } from './cdss.service';

describe('CdssService nurse copilot metrics instrumentation', () => {
  const metricsMock = {
    recordCdssHook: jest.fn(),
    recordCdssHookError: jest.fn(),
    recordCdssRetry: jest.fn(),
    recordCdssTimeout: jest.fn(),
    recordCdssAbstention: jest.fn(),
    recordNurseCopilotRecommendation: jest.fn(),
    recordNurseCopilotDecision: jest.fn(),
    recordNurseCopilotTimeToTriage: jest.fn(),
    recordNurseCopilotDocumentationDuration: jest.fn(),
    recordNurseCopilotAlertResponseTime: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records triage recommendation and time-to-triage', async () => {
    const service = new CdssService(undefined, metricsMock as any);
    (service as any).diagnosisAssist = jest.fn().mockResolvedValue({ urgencyLevel: 'high', red_flags: ['shock'] });
    (service as any).riskAssessment = jest.fn().mockResolvedValue({ risk_level: 'high', factors: [] });

    const queueEnteredAt = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const result = await service.analyzeNurseTriage(
      { symptoms: ['fever'], queueEnteredAt, vitals: { heartRate: 120 }, age: 30, gender: 'female' },
      undefined,
      'tenant-a',
    );

    expect(result.riskLevel).toBe('high');
    expect(metricsMock.recordNurseCopilotRecommendation).toHaveBeenCalledWith('triage', 'high');
    expect(metricsMock.recordNurseCopilotTimeToTriage).toHaveBeenCalledTimes(1);
    expect((metricsMock.recordNurseCopilotTimeToTriage as jest.Mock).mock.calls[0][0]).toBeGreaterThan(0);
  });

  it('records note and handoff documentation durations', async () => {
    const service = new CdssService(undefined, metricsMock as any);
    (service as any).postWithPolicy = jest.fn().mockResolvedValue({ summary: 'ok' });

    const noteStart = new Date(Date.now() - 60 * 1000).toISOString();
    await service.generateNurseNoteDraft({ age: 10, gender: 'male', documentationStartedAt: noteStart }, 'tenant-a');
    expect(metricsMock.recordNurseCopilotRecommendation).toHaveBeenCalledWith('notes', 'n/a');
    expect(metricsMock.recordNurseCopilotDocumentationDuration).toHaveBeenCalledWith(expect.any(Number), 'note');

    const handoffStart = new Date(Date.now() - 120 * 1000).toISOString();
    await service.generateNurseHandoffSummary({ age: 10, gender: 'male', handoffStartedAt: handoffStart }, 'tenant-a');
    expect(metricsMock.recordNurseCopilotRecommendation).toHaveBeenCalledWith('handoff', 'n/a');
    expect(metricsMock.recordNurseCopilotDocumentationDuration).toHaveBeenCalledWith(expect.any(Number), 'handoff');
  });

  it('records copilot decision and alert response latency', async () => {
    const service = new CdssService(undefined, metricsMock as any);
    const alertCreatedAt = new Date(Date.now() - 30 * 1000).toISOString();
    const res = await service.recordCopilotAction({
      decision: 'accept',
      copilotType: 'triage',
      alertCreatedAt,
    });
    expect(res.ok).toBe(true);
    expect(metricsMock.recordNurseCopilotDecision).toHaveBeenCalledWith('triage', 'accept');
    expect(metricsMock.recordNurseCopilotAlertResponseTime).toHaveBeenCalledWith(expect.any(Number));
  });
});
