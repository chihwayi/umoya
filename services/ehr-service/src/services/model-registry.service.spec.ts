import axios from 'axios';
import { ModelRegistryService } from './model-registry.service';
import { ModelRegistry } from '../entities/model-registry.entity';
import { ModelPerformanceMetric } from '../entities/model-performance-metric.entity';
import { ModelFairnessReport } from '../entities/model-fairness-report.entity';
import { ModelPromotionReview } from '../entities/model-promotion-review.entity';
import { ModelCard } from '../entities/model-card.entity';
import { ModelShadowEvaluation } from '../entities/model-shadow-evaluation.entity';
import { OutcomeLearningJob } from '../entities/outcome-learning-job.entity';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
}));

function createMutableRepo(records: Array<any>) {
  return {
    findOneBy: jest.fn(async (where) => {
      return records.find((record) =>
        Object.entries(where || {}).every(([key, value]) => record[key] === value),
      ) ?? null;
    }),
    findOne: jest.fn(async ({ where, order } = {} as any) => {
      const entries = records.filter((record) => {
        return Object.entries(where || {}).every(([key, value]) => record[key] === value);
      });
      if (order?.createdAt === 'DESC' || order?.retiredAt === 'DESC') {
        return entries[entries.length - 1] ?? null;
      }
      return entries[0] ?? null;
    }),
    find: jest.fn(async ({ where } = {} as any) => {
      return records.filter((record) =>
        Object.entries(where || {}).every(([key, value]) => record[key] === value),
      );
    }),
    create: jest.fn((payload) => payload),
    save: jest.fn(async (payload) => {
      const withId = payload.id ? payload : { id: `id-${records.length + 1}`, ...payload };
      const existingIndex = records.findIndex((record) => record.id === withId.id);
      if (existingIndex >= 0) {
        records[existingIndex] = { ...records[existingIndex], ...withId };
      } else {
        records.push(withId);
      }
      return withId;
    }),
    update: jest.fn(async (criteria, patch) => {
      if (typeof criteria === 'string') {
        const target = records.find((record) => record.id === criteria);
        if (target) {
          Object.assign(target, patch);
        }
        return;
      }
      for (const record of records) {
        Object.assign(record, patch);
      }
    }),
  };
}

function createTenantDb(repos: Map<any, any>) {
  return {
    getRepository: jest.fn((entity) => {
      const repo = repos.get(entity);
      if (!repo) {
        throw new Error(`Unexpected repository request: ${entity?.name}`);
      }
      return repo;
    }),
  };
}

describe('ModelRegistryService governed promotion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks production promotion when governance approvals are missing even if AUC improves', async () => {
    const current = {
      id: 'current-1',
      modelName: 'deterioration',
      version: 'v1',
      status: 'production',
      deploymentStage: 'production',
      aucRoc: 0.65,
      brierScore: 0.21,
      minioPath: 'models/deterioration/v1.pkl',
      createdAt: new Date('2026-03-20T00:00:00Z'),
    };
    const candidate = {
      id: 'candidate-1',
      modelName: 'deterioration',
      version: 'v2',
      status: 'staging',
      deploymentStage: 'development',
      aucRoc: 0.72,
      brierScore: 0.19,
      minioPath: 'models/deterioration/v2.pkl',
      createdAt: new Date('2026-03-24T00:00:00Z'),
    };
    const modelRepo = createMutableRepo([candidate, current]);
    const performanceRepo = createMutableRepo([{
      id: 'perf-1',
      modelName: 'deterioration',
      brierScore: 0.19,
      computedAt: new Date(),
    }]);
    const fairnessRepo = createMutableRepo([{
      id: 'fair-1',
      modelName: 'deterioration',
      fairnessFlag: false,
      computedAt: new Date(),
    }]);
    const reviewRepo = createMutableRepo([]);
    const cardRepo = createMutableRepo([]);

    const tenantService = {
      getTenantDatabase: jest.fn().mockResolvedValue(createTenantDb(new Map<any, any>([
        [ModelRegistry, modelRepo],
        [ModelPerformanceMetric, performanceRepo],
        [ModelFairnessReport, fairnessRepo],
        [ModelPromotionReview, reviewRepo],
        [ModelCard, cardRepo],
      ]))),
    };

    const service = new ModelRegistryService(tenantService as any);
    const result = await service.evaluateAndPromote('tenant-a', 'candidate-1');

    expect(result.promoted).toBe(false);
    expect(result.reason).toContain('clinical approval is required');
    expect(candidate.deploymentStage).toBe('shadow');
    expect(candidate.status).toBe('staging');
    expect(reviewRepo.save).toHaveBeenCalled();
    expect(cardRepo.save).toHaveBeenCalled();
    expect((axios as any).post).not.toHaveBeenCalled();
  });

  it('promotes only after all governed gates are explicitly satisfied', async () => {
    const current = {
      id: 'current-1',
      modelName: 'readmission',
      version: 'v3',
      status: 'production',
      deploymentStage: 'production',
      aucRoc: 0.64,
      brierScore: 0.22,
      minioPath: 'models/readmission/v3.pkl',
      createdAt: new Date('2026-03-20T00:00:00Z'),
    };
    const candidate = {
      id: 'candidate-1',
      modelName: 'readmission',
      version: 'v4',
      status: 'staging',
      deploymentStage: 'shadow',
      aucRoc: 0.71,
      brierScore: 0.18,
      minioPath: 'models/readmission/v4.pkl',
      createdAt: new Date('2026-03-24T00:00:00Z'),
    };
    const modelRepo = createMutableRepo([candidate, current]);
    const performanceRepo = createMutableRepo([{
      id: 'perf-1',
      modelName: 'readmission',
      brierScore: 0.18,
      computedAt: new Date(),
    }]);
    const fairnessRepo = createMutableRepo([{
      id: 'fair-1',
      modelName: 'readmission',
      fairnessFlag: false,
      computedAt: new Date(),
    }]);
    const reviewRepo = createMutableRepo([]);
    const cardRepo = createMutableRepo([]);

    const tenantService = {
      getTenantDatabase: jest.fn().mockResolvedValue(createTenantDb(new Map<any, any>([
        [ModelRegistry, modelRepo],
        [ModelPerformanceMetric, performanceRepo],
        [ModelFairnessReport, fairnessRepo],
        [ModelPromotionReview, reviewRepo],
        [ModelCard, cardRepo],
      ]))),
    };

    const service = new ModelRegistryService(tenantService as any);
    const result = await service.evaluateAndPromote('tenant-b', 'candidate-1', {
      requestedStage: 'production',
      requestedBy: 'clinical-governance-board',
      decisionBy: 'chief-medical-informatics-officer',
      decisionNotes: 'Shadow results reviewed and approved.',
      shadowValidationPassed: true,
      rollbackReady: true,
      clinicalApproval: true,
    });

    expect(result.promoted).toBe(true);
    expect(result.model?.status).toBe('production');
    expect(result.model?.deploymentStage).toBe('production');
    expect(current.status).toBe('retired');
    expect(reviewRepo.save).toHaveBeenCalled();
    expect((axios as any).post).toHaveBeenCalledWith(
      'http://localhost:8001/model/load',
      {
        modelName: 'readmission',
        minioPath: 'models/readmission/v4.pkl',
      },
      { timeout: 30000 },
    );
  });

  it('records an approved shadow evaluation review and advances the candidate to canary when gates are met', async () => {
    const evaluations = [{
      id: 'shadow-1',
      modelName: 'sepsis',
      evaluationStatus: 'candidate_registered',
      candidateRegistryId: 'candidate-1',
      candidateVersion: 'v2',
      sourceJobIds: ['job-1', 'job-2'],
      summary: {},
    }];
    const jobs = [
      { id: 'job-1', jobStatus: 'candidate_registered' },
      { id: 'job-2', jobStatus: 'candidate_registered' },
    ];
    const shadowRepo = createMutableRepo(evaluations);
    const jobRepo = createMutableRepo(jobs);
    const tenantService = {
      getTenantDatabase: jest.fn().mockResolvedValue(createTenantDb(new Map<any, any>([
        [ModelShadowEvaluation, shadowRepo],
        [OutcomeLearningJob, jobRepo],
      ]))),
    };

    const service = new ModelRegistryService(tenantService as any);
    jest.spyOn(service, 'evaluateAndPromote').mockResolvedValue({
      promoted: false,
      reason: 'Model approved for governed canary stage; production promotion still requires an explicit production approval request',
      model: {
        id: 'candidate-1',
        modelName: 'sepsis',
        version: 'v2',
        deploymentStage: 'canary',
      } as any,
      review: { id: 'review-1' } as any,
      gates: { shadowValidationPassed: true } as any,
    });

    const result = await service.reviewShadowEvaluation('tenant-c', 'shadow-1', {
      decision: 'approve',
      requestedStage: 'canary',
      decisionBy: 'governance-nurse',
      decisionNotes: 'Shadow review accepted',
      rollbackReady: true,
      clinicalApproval: true,
    });

    expect(result.approved).toBe(true);
    expect(result.promotion?.deploymentStage).toBe('canary');
    expect((evaluations[0] as any).evaluationStatus).toBe('canary_approved');
    expect((jobs[0] as any).jobStatus).toBe('shadow_reviewed');
    expect((jobs[1] as any).jobStatus).toBe('shadow_reviewed');
  });

  it('rolls back the current production model and restores the latest retired model', async () => {
    const current = {
      id: 'current-1',
      modelName: 'no_show',
      version: 'v4',
      status: 'production',
      deploymentStage: 'production',
      aucRoc: 0.67,
      brierScore: 0.21,
      minioPath: 'models/no_show/v4.pkl',
      createdAt: new Date('2026-03-24T08:00:00Z'),
    };
    const previous = {
      id: 'prev-1',
      modelName: 'no_show',
      version: 'v3',
      status: 'retired',
      deploymentStage: 'rolled_back',
      aucRoc: 0.66,
      brierScore: 0.22,
      minioPath: 'models/no_show/v3.pkl',
      retiredAt: new Date('2026-03-23T08:00:00Z'),
      createdAt: new Date('2026-03-23T08:00:00Z'),
    };
    const modelRepo = createMutableRepo([current, previous]);
    const cardRepo = createMutableRepo([]);
    const tenantService = {
      getTenantDatabase: jest.fn().mockResolvedValue(createTenantDb(new Map<any, any>([
        [ModelRegistry, modelRepo],
        [ModelCard, cardRepo],
      ]))),
    };

    const service = new ModelRegistryService(tenantService as any);
    const rolledBack = await service.rollback('tenant-d', 'no_show');

    expect(rolledBack?.id).toBe('prev-1');
    expect(previous.status).toBe('production');
    expect(previous.deploymentStage).toBe('production');
    expect(current.status).toBe('rolled_back');
    expect(current.deploymentStage).toBe('rolled_back');
    expect((axios as any).post).toHaveBeenCalledWith(
      'http://localhost:8001/model/load',
      {
        modelName: 'no_show',
        minioPath: 'models/no_show/v3.pkl',
      },
      { timeout: 30000 },
    );
  });
});
