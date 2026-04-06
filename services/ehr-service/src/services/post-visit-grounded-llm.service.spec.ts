import { PostVisitGroundedLlmService } from './post-visit-grounded-llm.service';

describe('PostVisitGroundedLlmService', () => {
  const aiSurfaceContractService = {
    buildSurfaceMetadata: jest.fn((payload) => ({
      aiSurface: 'post_visit_grounded_llm',
      useCase: payload.useCase,
      provenance: { modelId: payload.modelId, modelVersion: payload.modelVersion, provider: payload.provider, source: payload.source },
      audit: { recorded: true },
      monitoring: { metricsSurface: 'post_visit_grounded_llm', offlineEvalSupported: true, releaseGateSupported: true },
      controls: { disablePaths: ['POSTVISIT_GROUNDED_LLM_ENABLED'], rollbackPaths: ['model-monitoring release readiness'] },
    })),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when governed CDSS is not configured', async () => {
    const service = new PostVisitGroundedLlmService(undefined, aiSurfaceContractService as any);
    const result = await service.answerPatientQuestion({
      sessionId: 'session-1',
      question: 'What should I do next?',
      summary: 'Follow up in one week',
      checklist: ['Repeat blood pressure check'],
      citations: [],
    });

    expect(result).toBeNull();
  });

  it('accepts grounded patient answer when citation IDs are valid', async () => {
    const cdssService = {
      requestGovernedJson: jest.fn().mockResolvedValue({
        json: {
          abstain: false,
          answer: 'Please follow your blood pressure follow-up in one week.',
          citations_used: ['cit-1'],
          urgent_signal: false,
        },
        model: 'governed-postvisit-answer',
        audit: { promptHash: 'hash', templateVersion: 'postvisit-patient-answer-v1' },
      }),
    };

    const service = new PostVisitGroundedLlmService(cdssService as any, aiSurfaceContractService as any);
    const result = await service.answerPatientQuestion({
      sessionId: 'session-1',
      question: 'When is my follow-up?',
      summary: 'You need a one-week follow-up.',
      checklist: ['Repeat blood pressure check in one week'],
      citations: [{ id: 'cit-1', label: 'WHO follow-up guidance' }],
    });

    expect(result).toEqual(
      expect.objectContaining({
        abstained: false,
        citationsUsed: ['cit-1'],
        model: 'governed-postvisit-answer',
        aiMetadata: expect.objectContaining({
          aiSurface: 'post_visit_grounded_llm',
          useCase: 'post_visit_patient_answer',
        }),
      }),
    );
    expect(cdssService.requestGovernedJson).toHaveBeenCalledWith(
      expect.objectContaining({
        useCase: 'post_visit_patient_answer',
      }),
      undefined,
    );
  });

  it('rejects patient answer when citation IDs are outside allow-list', async () => {
    const cdssService = {
      requestGovernedJson: jest.fn().mockResolvedValue({
        json: {
          abstain: false,
          answer: 'Unsafe ungrounded answer',
          citations_used: ['unknown-citation'],
          urgent_signal: false,
        },
        model: 'governed-postvisit-answer',
        audit: { promptHash: 'hash', templateVersion: 'postvisit-patient-answer-v1' },
      }),
    };

    const service = new PostVisitGroundedLlmService(cdssService as any, aiSurfaceContractService as any);
    const result = await service.answerPatientQuestion({
      sessionId: 'session-1',
      question: 'Can I skip medication?',
      summary: 'Do not skip medication.',
      checklist: ['Take medication daily'],
      citations: [{ id: 'cit-1', label: 'Medication adherence guidance' }],
    });

    expect(result).toBeNull();
  });

  it('classifies escalation signals with normalized confidence and temporality', async () => {
    const cdssService = {
      requestGovernedJson: jest.fn().mockResolvedValue({
        json: {
          severity: 'high',
          route_target: 'doctor',
          temporality: 'current',
          confidence: 0.84,
          rationale: 'Current severe symptom language',
        },
        model: 'governed-postvisit-escalation',
        audit: { promptHash: 'hash', templateVersion: 'postvisit-escalation-v2' },
      }),
    };

    const service = new PostVisitGroundedLlmService(cdssService as any, aiSurfaceContractService as any);
    const result = await service.classifyEscalationSignal({
      sessionId: 'session-1',
      message: 'I have severe headache right now',
      triggerTerms: ['severe headache'],
      candidateSeverity: 'high',
    });

    expect(result).toEqual(
      expect.objectContaining({
        severity: 'high',
        routeTarget: 'doctor',
        temporality: 'current',
        confidence: 0.84,
        model: 'governed-postvisit-escalation',
        aiMetadata: expect.objectContaining({
          aiSurface: 'post_visit_grounded_llm',
          useCase: 'post_visit_escalation_classification',
        }),
      }),
    );
  });
});
