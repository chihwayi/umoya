import { ModelMonitoringController } from './model-monitoring.controller';

describe('ModelMonitoringController', () => {
  it('records offline eval runs through the monitoring service', async () => {
    const response = { blocked: false, run: { id: 'eval-1' }, releaseGates: [] };
    const svc = {
      recordOfflineEvalRun: jest.fn().mockResolvedValue(response),
    } as any;

    const controller = new ModelMonitoringController(
      svc,
      {} as any,
      {} as any,
      {} as any,
      { listContracts: jest.fn().mockReturnValue([]), getContract: jest.fn() } as any,
    );
    const result = await controller.recordOfflineEval('kids-clinic', {
      subdomain: 'kids-clinic',
      aiSurface: 'patient_ai',
      caseSetName: 'suite',
      datasetVersion: '2026-03-26.v1',
      totalCases: 4,
      metrics: { citationSupportRate: 1 },
    });

    expect(result).toEqual(response);
    expect(svc.recordOfflineEvalRun).toHaveBeenCalledWith('kids-clinic', expect.objectContaining({
      aiSurface: 'patient_ai',
      caseSetName: 'suite',
    }));
  });

  it('returns the AI surface contract with latest readiness details', async () => {
    const svc = {
      getOfflineEvalRuns: jest.fn().mockResolvedValue([{ id: 'eval-1' }]),
      getReleaseReadiness: jest.fn().mockResolvedValue({ aiSurface: 'patient_ai', releaseStatus: 'ready' }),
    } as any;
    const aiSurfaceContractService = {
      getContract: jest.fn().mockReturnValue({
        aiSurface: 'patient_ai',
        displayName: 'Patient AI',
        monitoring: { offlineEvalSupported: true, releaseGateSupported: true },
      }),
      listContracts: jest.fn(),
    } as any;

    const controller = new ModelMonitoringController(
      svc,
      {} as any,
      {} as any,
      {} as any,
      aiSurfaceContractService,
    );

    const result = await controller.getAiSurfaceContract('patient_ai', 'kids-clinic');

    expect(aiSurfaceContractService.getContract).toHaveBeenCalledWith('patient_ai');
    expect(svc.getOfflineEvalRuns).toHaveBeenCalledWith('kids-clinic', 'patient_ai');
    expect(svc.getReleaseReadiness).toHaveBeenCalledWith('kids-clinic', 'patient_ai');
    expect(result).toEqual(expect.objectContaining({
      aiSurface: 'patient_ai',
      latestRun: { id: 'eval-1' },
      releaseReadiness: { aiSurface: 'patient_ai', releaseStatus: 'ready' },
    }));
  });

  it('builds an AI ops control tower payload by surface', async () => {
    const svc = {
      getReleaseReadiness: jest.fn().mockImplementation(async (_tenantId: string, aiSurface: string) => ({
        aiSurface,
        releaseStatus: aiSurface === 'claims_ai' ? 'blocked' : 'ready',
      })),
    } as any;
    const aiSurfaceContractService = {
      listContracts: jest.fn().mockReturnValue([
        {
          aiSurface: 'patient_ai',
          displayName: 'Patient AI',
          description: 'Patient-facing AI',
          useCases: ['patient_symptom_check'],
          monitoring: { metricsSurface: 'patient_ai', offlineEvalSupported: true, releaseGateSupported: true },
          audit: {
            modelRegistry: 'ai_model_audit_registry',
            promptAuditLog: 'prompt_audit_log',
            sourceOfTruth: 'Patient AI audit trail',
          },
          controls: { disablePaths: ['tenant policy'], rollbackPaths: ['release gate'] },
        },
        {
          aiSurface: 'claims_ai',
          displayName: 'Claims AI',
          description: 'Claims AI',
          useCases: ['claims_denial_prediction'],
          monitoring: { metricsSurface: 'claims_ai', offlineEvalSupported: true, releaseGateSupported: true },
          audit: {
            modelRegistry: 'ai_model_audit_registry',
            promptAuditLog: 'prompt_audit_log',
            sourceOfTruth: 'Claims AI audit trail',
          },
          controls: { disablePaths: ['tenant policy'], rollbackPaths: ['manual review'] },
        },
        {
          aiSurface: 'oncology_mobile_intelligence',
          displayName: 'Mobile Oncology Intelligence',
          description: 'Compact oncology mobile intelligence',
          useCases: ['oncology_protocol_mobile'],
          monitoring: { metricsSurface: 'oncology_mobile_intelligence', offlineEvalSupported: false, releaseGateSupported: false },
          audit: {
            modelRegistry: 'ai_model_audit_registry',
            promptAuditLog: 'prompt_audit_log',
            sourceOfTruth: 'Oncology protocol bundle snapshot + governed protocol recommendation services',
          },
          controls: { disablePaths: ['mobile specialty card disable'], rollbackPaths: ['feature rollback'] },
        },
      ]),
      getContract: jest.fn(),
    } as any;
    const riskStratService = {
      tenantService: {
        getTenantDatabase: jest.fn().mockResolvedValue({
          query: jest.fn().mockResolvedValue([
            {
              surface: 'patient_ai',
              metric_date: '2026-04-06',
              total_calls: 100,
              abstention_count: 12,
              circuit_breaker_trips: 0,
              avg_latency_ms: 820,
              accuracy: 0.91,
              fairness_age_parity: 0.03,
              fairness_gender_parity: 0.04,
              fairness_sdoh_parity: 0.05,
            },
            {
              surface: 'claims_ai',
              metric_date: '2026-04-06',
              total_calls: 40,
              abstention_count: 11,
              circuit_breaker_trips: 2,
              avg_latency_ms: 4100,
              accuracy: 0.69,
              fairness_age_parity: 0.08,
              fairness_gender_parity: 0.09,
              fairness_sdoh_parity: 0.14,
            },
          ]),
        }),
      },
    } as any;
    const cdssService = {
      getModelVersions: jest.fn().mockResolvedValue({
        patient_ai: { version: 'patient-ai-v3' },
        claims_ai: { version: 'claims-ai-v5' },
      }),
    } as any;

    const controller = new ModelMonitoringController(
      svc,
      riskStratService,
      {} as any,
      cdssService,
      aiSurfaceContractService,
    );

    const result = await controller.getAiOpsControlTower('kids-clinic', { headers: {} });

    expect(result.surfaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          aiSurface: 'patient_ai',
          status: 'healthy',
          audit: expect.objectContaining({
            sourceOfTruth: 'Patient AI audit trail',
          }),
          modelVersion: { version: 'patient-ai-v3' },
          latestMetrics: expect.objectContaining({
            totalCalls: 100,
            abstentionRate: 0.12,
          }),
        }),
        expect.objectContaining({
          aiSurface: 'claims_ai',
          status: 'blocked',
          alerts: expect.arrayContaining([
            'Release gates blocked',
            'Recent circuit breaker activity',
            'High abstention rate',
            'High latency',
            'Fairness parity gap requires review',
          ]),
        }),
        expect.objectContaining({
          aiSurface: 'oncology_mobile_intelligence',
          status: 'unknown',
          latestMetrics: null,
          alerts: expect.arrayContaining(['No AI ops metrics recorded yet']),
          audit: expect.objectContaining({
            sourceOfTruth: 'Oncology protocol bundle snapshot + governed protocol recommendation services',
          }),
          controls: expect.objectContaining({
            disablePaths: ['mobile specialty card disable'],
          }),
        }),
      ]),
    );
  });
});
