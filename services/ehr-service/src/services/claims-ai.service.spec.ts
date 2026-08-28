import { ClaimsAiService } from './claims-ai.service';

describe('ClaimsAiService', () => {
  const aiSurfaceContractService = {
    recordExecution: jest.fn().mockResolvedValue({ aiSurface: 'claims_ai', audit: { recorded: true } }),
    buildSurfaceMetadata: jest.fn(() => ({ aiSurface: 'claims_ai', audit: { recorded: false } })),
  };

  const tenantDb = {
    getRepository: jest.fn().mockReturnValue({
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'saved-1', ...value })),
    }),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // S267 (F7) — scoreClaimBeforeSubmission previously called buildSurfaceMetadata
  // (never persisted); now must call recordExecution to write a real audit row.
  it('calls recordExecution with tenant/patient context when scoring a claim', async () => {
    const cdssService = {
      predictClaimDenial: jest.fn().mockResolvedValue({
        risk_score: 0.42, confidence: 0.8, top_reasons: [], model_version: 'v1', feature_snapshot: {}, threshold_action: 'allow',
      }),
    };
    const svc = new ClaimsAiService(cdssService as any, aiSurfaceContractService as any);

    await svc.scoreClaimBeforeSubmission(
      {
        claimId: 'claim-1', patientId: 'patient-1', procedureCodes: ['99213'], diagnosisCodes: ['J06.9'],
        totalAmount: 200, planType: 'ppo', hasPreAuthorization: true, isInpatient: false, patientAge: 40,
        priorDenialCount12m: 0, providerSpecialty: 'general',
      },
      'clinic-a',
      tenantDb,
    );

    expect(aiSurfaceContractService.recordExecution).toHaveBeenCalledWith(
      expect.objectContaining({ tenantDb, tenantId: 'clinic-a', patientId: 'patient-1', useCase: 'claims_denial_prediction' }),
    );
  });

  it('falls back to buildSurfaceMetadata(recorded: false) when recordExecution throws', async () => {
    const cdssService = {
      predictClaimDenial: jest.fn().mockResolvedValue({
        risk_score: 0.9, confidence: 0.8, top_reasons: [], model_version: 'v1', feature_snapshot: {}, threshold_action: 'block',
      }),
    };
    const failingAiSurface = {
      recordExecution: jest.fn().mockRejectedValue(new Error('audit db down')),
      buildSurfaceMetadata: jest.fn(() => ({ aiSurface: 'claims_ai', audit: { recorded: false } })),
    };
    const svc = new ClaimsAiService(cdssService as any, failingAiSurface as any);

    const result = await svc.scoreClaimBeforeSubmission(
      {
        claimId: 'claim-2', patientId: 'patient-2', procedureCodes: ['99213'], diagnosisCodes: ['J06.9'],
        totalAmount: 200, planType: 'ppo', hasPreAuthorization: true, isInpatient: false, patientAge: 40,
        priorDenialCount12m: 0, providerSpecialty: 'general',
      },
      'clinic-a',
      tenantDb,
    );

    expect(result.aiMetadata).toEqual(expect.objectContaining({ audit: { recorded: false } }));
  });

  it('calls recordExecution when generating an appeal template', async () => {
    const cdssService = {
      generateAppealTemplateCdss: jest.fn().mockResolvedValue({
        denial_reason_code: 'CO-97', draft_letter: 'letter text', rag_sources: [], model_version: 'v1',
      }),
    };
    const svc = new ClaimsAiService(cdssService as any, aiSurfaceContractService as any);

    await svc.generateAppealTemplate('claim-3', 'patient-3', 'CO-97', {}, 'clinic-a', tenantDb);

    expect(aiSurfaceContractService.recordExecution).toHaveBeenCalledWith(
      expect.objectContaining({ tenantDb, tenantId: 'clinic-a', patientId: 'patient-3', useCase: 'claims_appeal_generation' }),
    );
  });

  it('calls recordExecution when checking PDMP', async () => {
    const cdssService = {
      checkPdmpDrug: jest.fn().mockResolvedValue({
        morphine_milligram_equivalent: 10, risk_level: 'low', prescriber_alerts: [], other_active_prescriptions: [], dispensing_blocked: false,
      }),
    };
    const svc = new ClaimsAiService(cdssService as any, aiSurfaceContractService as any);

    await svc.checkPdmp('patient-4', 'doctor-1', 'oxycodone', 'II', 20, 'clinic-a', tenantDb);

    expect(aiSurfaceContractService.recordExecution).toHaveBeenCalledWith(
      expect.objectContaining({ tenantDb, tenantId: 'clinic-a', patientId: 'patient-4', useCase: 'pharmacy_pdmp_check' }),
    );
  });
});
