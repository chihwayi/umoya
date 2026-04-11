import { MentalHealthService } from './mental-health.service';
import { MentalHealthCarePlan } from '../entities/mental-health-care-plan.entity';
import { MentalHealthFollowup } from '../entities/mental-health-followup.entity';

describe('MentalHealthService', () => {
  const createService = () => {
    const carePlanRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'plan-1', ...value })),
      find: jest.fn(async () => [{ id: 'plan-1', patientId: 'patient-1' }]),
      findOne: jest.fn(async ({ where }: any) => (where?.id ? { id: where.id, patientId: 'patient-1' } : null)),
      update: jest.fn(async () => undefined),
    };
    const followupRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'followup-1', ...value })),
      find: jest.fn(async () => [{ id: 'followup-1', patientId: 'patient-1' }]),
    };
    const db = {
      getRepository: jest.fn((entity) => {
        if (entity === MentalHealthCarePlan) return carePlanRepo;
        if (entity === MentalHealthFollowup) return followupRepo;
        return {};
      }),
    };
    const tenantService = { getTenantDatabase: jest.fn(async () => db) };
    const cdssService = {} as any;
    return {
      service: new MentalHealthService(tenantService as any, cdssService),
      carePlanRepo,
      followupRepo,
      tenantService,
    };
  };

  it('creates a care plan with normalized goals and interventions', async () => {
    const { service, carePlanRepo } = createService();

    const result = await service.createCarePlan('tenant-a', 'user-1', {
      patientId: 'patient-1',
      diagnosisName: 'Depression',
      goals: 'Sleep better, Return to work',
      interventions: ['Behavioural activation', 'Psychoeducation'],
    } as any);

    expect(carePlanRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        createdBy: 'user-1',
        goals: ['Sleep better', 'Return to work'],
        interventions: ['Behavioural activation', 'Psychoeducation'],
      }),
    );
    expect(result.id).toBe('plan-1');
  });

  it('lists care plans by patient', async () => {
    const { service, carePlanRepo } = createService();

    const result = await service.getCarePlans('tenant-a', 'patient-1');

    expect(carePlanRepo.find).toHaveBeenCalledWith({
      where: { patientId: 'patient-1' },
      order: { createdAt: 'DESC' },
    });
    expect(result).toHaveLength(1);
  });

  it('records a community follow-up', async () => {
    const { service, followupRepo } = createService();

    const result = await service.recordFollowup('tenant-a', 'user-1', {
      patientId: 'patient-1',
      followupDate: '2026-04-11',
      safetyConcern: true,
    });

    expect(followupRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient-1',
        conductedBy: 'user-1',
        safetyConcern: true,
      }),
    );
    expect(result.id).toBe('followup-1');
  });

  it('lists follow-ups by patient ordered by follow-up date', async () => {
    const { service, followupRepo } = createService();

    const result = await service.getFollowups('tenant-a', 'patient-1');

    expect(followupRepo.find).toHaveBeenCalledWith({
      where: { patientId: 'patient-1' },
      order: { followupDate: 'DESC', createdAt: 'DESC' },
    });
    expect(result).toHaveLength(1);
  });
});
