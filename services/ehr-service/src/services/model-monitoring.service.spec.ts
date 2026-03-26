import { ModelMonitoringService } from './model-monitoring.service';
import { ModelPerformanceMetric } from '../entities/model-performance-metric.entity';
import { ModelFairnessReport } from '../entities/model-fairness-report.entity';
import { AiEvalRun } from '../entities/ai-eval-run.entity';
import { AiReleaseGateResult } from '../entities/ai-release-gate-result.entity';

describe('ModelMonitoringService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes model evaluation through governed CdssService model-performance endpoint', async () => {
    const perfRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
      find: jest.fn(),
    };
    const fairnessRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
      find: jest.fn(),
    };
    const tenantDb = {
      query: jest.fn().mockResolvedValue([
        { predicted: 0.9, actual: 1, age: 72, gender: 'female' },
        { predicted: 0.3, actual: 0, age: 50, gender: 'male' },
        { predicted: 0.7, actual: 1, age: 66, gender: 'female' },
        { predicted: 0.2, actual: 0, age: 30, gender: 'male' },
        { predicted: 0.8, actual: 1, age: 41, gender: 'female' },
        { predicted: 0.1, actual: 0, age: 24, gender: 'male' },
        { predicted: 0.6, actual: 1, age: 58, gender: 'female' },
        { predicted: 0.4, actual: 0, age: 61, gender: 'male' },
        { predicted: 0.75, actual: 1, age: 45, gender: 'female' },
        { predicted: 0.35, actual: 0, age: 70, gender: 'male' },
      ]),
      getRepository: jest.fn((entity) => {
        if (entity === ModelPerformanceMetric) return perfRepo;
        if (entity === ModelFairnessReport) return fairnessRepo;
        throw new Error(`Unexpected repository ${String(entity)}`);
      }),
    } as any;
    const tenantService = {
      getTenantDatabase: jest.fn().mockResolvedValue(tenantDb),
    };
    const cdssService = {
      evaluateModelPerformance: jest.fn().mockResolvedValue({
        auc_roc: 0.82,
        brier_score: 0.14,
        sensitivity: 0.8,
        specificity: 0.78,
        ppv: 0.76,
        calibration: [],
      }),
    };
    const federatedLearning = {
      initiateRound: jest.fn().mockResolvedValue(undefined),
    };

    const service = new ModelMonitoringService(
      tenantService as any,
      federatedLearning as any,
      cdssService as any,
    );

    const result = await service.evaluateModel('kids-clinic', 'readmission', '2026-03');

    expect(cdssService.evaluateModelPerformance).toHaveBeenCalledWith(
      {
        modelName: 'readmission',
        period: '2026-03',
        outcomes: expect.any(Array),
      },
      'kids-clinic',
      tenantDb,
    );
    expect(result.aucRoc).toBe(0.82);
    expect(result.brierScore).toBe(0.14);
  });

  it('persists offline AI eval runs and release gates with a blocked/ready summary', async () => {
    const perfRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
      find: jest.fn(),
      findOne: jest.fn().mockResolvedValue({
        modelName: 'readmission',
        baselineAuc: 0.9,
        aucRoc: 0.87,
      }),
    };
    const fairnessRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
      find: jest.fn(),
      findOne: jest.fn().mockResolvedValue({
        modelName: 'readmission',
        maxDisparity: 0.03,
      }),
    };
    const evalRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'eval-1', ...value })),
      find: jest.fn(),
      findOne: jest.fn().mockResolvedValue(null),
    };
    const gateRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
      find: jest.fn(),
    };
    const tenantDb = {
      getRepository: jest.fn((entity) => {
        if (entity === ModelPerformanceMetric) return perfRepo;
        if (entity === ModelFairnessReport) return fairnessRepo;
        if (entity === AiEvalRun) return evalRepo;
        if (entity === AiReleaseGateResult) return gateRepo;
        throw new Error(`Unexpected repository ${String(entity)}`);
      }),
    } as any;
    const tenantService = {
      getTenantDatabase: jest.fn().mockResolvedValue(tenantDb),
    };

    const service = new ModelMonitoringService(
      tenantService as any,
      { initiateRound: jest.fn() } as any,
      { evaluateModelPerformance: jest.fn() } as any,
    );

    const result = await service.recordOfflineEvalRun('kids-clinic', {
      aiSurface: 'patient_ai',
      modelName: 'readmission',
      caseSetName: 'moas12.patient_ai.v1',
      datasetVersion: '2026-03-26.v1',
      totalCases: 8,
      reportPath: 'reports/patient-ai.json',
      metrics: {
        citationSupportRate: 0.92,
        abstainCorrectness: 0.97,
        unsafeOverconfidentOutputRate: 0.01,
      },
    });

    expect(result.blocked).toBe(false);
    expect(result.run.runStatus).toBe('passed');
    expect(gateRepo.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ gateName: 'citation_support_rate', gateStatus: 'passed' }),
        expect.objectContaining({ gateName: 'abstain_correctness', gateStatus: 'passed' }),
        expect.objectContaining({ gateName: 'unsafe_overconfident_output_rate', gateStatus: 'passed' }),
        expect.objectContaining({ gateName: 'calibration_drift', gateStatus: 'passed' }),
        expect.objectContaining({ gateName: 'subgroup_disparities', gateStatus: 'passed' }),
      ]),
    );
  });
});
