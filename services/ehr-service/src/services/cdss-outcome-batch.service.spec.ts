import { CdssOutcomeBatchService } from './cdss-outcome-batch.service';
import { OutcomeLearningJob } from '../entities/outcome-learning-job.entity';
import { ModelShadowEvaluation } from '../entities/model-shadow-evaluation.entity';
import { ModelRegistry } from '../entities/model-registry.entity';
import { FlRound } from '../entities/fl-round.entity';

function createRepo(initialRecords: Array<any>) {
  const records = [...initialRecords];
  return {
    records,
    find: jest.fn(async ({ where } = {} as any) => {
      return records.filter((record) =>
        Object.entries(where || {}).every(([key, value]) => {
          if (value && typeof value === 'object' && '_value' in (value as any)) {
            const values = Array.isArray((value as any)._value) ? (value as any)._value : [];
            return values.includes(record[key]);
          }
          return record[key] === value;
        }),
      );
    }),
    findOne: jest.fn(async ({ where } = {} as any) => {
      return records.find((record) =>
        Object.entries(where || {}).every(([key, value]) => {
          if (value && typeof value === 'object' && '_value' in (value as any)) {
            const values = Array.isArray((value as any)._value) ? (value as any)._value : [];
            return values.includes(record[key]);
          }
          return record[key] === value;
        }),
      ) ?? null;
    }),
    findOneBy: jest.fn(async (where) => {
      return records.find((record) =>
        Object.entries(where || {}).every(([key, value]) => record[key] === value),
      ) ?? null;
    }),
    create: jest.fn((payload) => payload),
    save: jest.fn(async (payload) => {
      const withId = payload.id ? payload : { id: `generated-${records.length + 1}`, ...payload };
      records.push(withId);
      return withId;
    }),
    update: jest.fn(async (_criteria, patch) => {
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

describe('CdssOutcomeBatchService governed learning orchestration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('turns claimed learning jobs into a governed federated shadow evaluation request', async () => {
    const jobs = [
      { id: 'job-1', feedbackLogId: 'log-1', patientId: 'patient-1', modelName: 'sepsis', jobStatus: 'claimed', createdAt: new Date('2026-03-24T01:00:00Z') },
      { id: 'job-2', feedbackLogId: 'log-2', patientId: 'patient-2', modelName: 'sepsis', jobStatus: 'claimed', createdAt: new Date('2026-03-24T01:01:00Z') },
      { id: 'job-3', feedbackLogId: 'log-3', patientId: 'patient-3', modelName: 'sepsis', jobStatus: 'claimed', createdAt: new Date('2026-03-24T01:02:00Z') },
      { id: 'job-4', feedbackLogId: 'log-4', patientId: 'patient-4', modelName: 'sepsis', jobStatus: 'claimed', createdAt: new Date('2026-03-24T01:03:00Z') },
      { id: 'job-5', feedbackLogId: 'log-5', patientId: 'patient-5', modelName: 'sepsis', jobStatus: 'claimed', createdAt: new Date('2026-03-24T01:04:00Z') },
    ];
    const jobRepo = createRepo(jobs);
    const shadowRepo = createRepo([]);
    const roundRepo = createRepo([]);
    const registryRepo = createRepo([
      { id: 'prod-1', modelName: 'sepsis', status: 'production', version: 'v3' },
    ]);
    const tenantDb = createTenantDb(new Map<any, any>([
      [OutcomeLearningJob, jobRepo],
      [ModelShadowEvaluation, shadowRepo],
      [FlRound, roundRepo],
      [ModelRegistry, registryRepo],
    ]));
    const tenantService = {
      getAllActiveTenants: jest.fn().mockResolvedValue([{ subdomain: 'tenant-a' }]),
      getTenantDatabase: jest.fn().mockResolvedValue(tenantDb),
    };
    const federatedLearningService = {
      initiateRound: jest.fn().mockResolvedValue({
        id: 'round-1',
        modelType: 'sepsis',
        status: 'pending',
      }),
    };

    const service = new CdssOutcomeBatchService(
      tenantService as any,
      undefined as any,
      federatedLearningService as any,
    );

    await service.runGovernedLearningOrchestration();

    expect(federatedLearningService.initiateRound).toHaveBeenCalledWith('tenant-a', 'sepsis');
    expect(shadowRepo.save).toHaveBeenCalled();
    expect(jobRepo.update).toHaveBeenCalled();
  });

  it('reconciles a completed federated round into a candidate_registered shadow evaluation', async () => {
    const jobs = [
      { id: 'job-1', jobStatus: 'training_requested' },
      { id: 'job-2', jobStatus: 'training_requested' },
    ];
    const jobRepo = createRepo(jobs);
    const shadowRepo = createRepo([
      {
        id: 'shadow-1',
        modelName: 'readmission',
        evaluationStatus: 'training_requested',
        flRoundId: 'round-1',
        sourceJobIds: ['job-1', 'job-2'],
        summary: {},
      },
    ]);
    const roundRepo = createRepo([
      {
        id: 'round-1',
        modelType: 'readmission',
        status: 'completed',
        aggregatedMetrics: { auc: 0.71 },
        modelWeightsRef: 'models/readmission/v4.pkl',
      },
    ]);
    const registryRepo = createRepo([
      {
        id: 'candidate-1',
        modelName: 'readmission',
        roundId: 'round-1',
        version: 'v4',
        deploymentStage: 'shadow',
        createdAt: new Date('2026-03-24T08:00:00Z'),
      },
    ]);
    const tenantDb = createTenantDb(new Map<any, any>([
      [OutcomeLearningJob, jobRepo],
      [ModelShadowEvaluation, shadowRepo],
      [FlRound, roundRepo],
      [ModelRegistry, registryRepo],
    ]));
    const tenantService = {
      getAllActiveTenants: jest.fn().mockResolvedValue([{ subdomain: 'tenant-b' }]),
      getTenantDatabase: jest.fn().mockResolvedValue(tenantDb),
    };

    const service = new CdssOutcomeBatchService(
      tenantService as any,
      undefined as any,
      undefined as any,
    );

    await service.reconcileGovernedShadowEvaluations();

    expect(shadowRepo.update).toHaveBeenCalled();
    expect(jobRepo.update).toHaveBeenCalled();
  });
});
