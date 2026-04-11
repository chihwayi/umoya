import { FamilyPlanningService } from './family-planning.service';
import { FamilyPlanningEnrollment } from '../entities/family-planning-enrollment.entity';
import { FamilyPlanningFollowup } from '../entities/family-planning-followup.entity';

describe('FamilyPlanningService', () => {
  const createService = () => {
    const enrollmentRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'enroll-2', ...value })),
      update: jest.fn(async () => undefined),
      find: jest.fn(async () => [{ id: 'enroll-1', patientId: 'patient-1' }]),
      findOne: jest.fn(async ({ where }: any) => {
        if (where?.status === 'active') {
          return { id: 'enroll-1', patientId: 'patient-1', status: 'active' };
        }
        if (where?.id) {
          return { id: where.id, patientId: 'patient-1' };
        }
        return null;
      }),
    };
    const followupRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'followup-1', ...value })),
      find: jest.fn(async () => [{ id: 'followup-1', patientId: 'patient-1' }]),
    };
    const db = {
      getRepository: jest.fn((entity) => {
        if (entity === FamilyPlanningEnrollment) return enrollmentRepo;
        if (entity === FamilyPlanningFollowup) return followupRepo;
        return {};
      }),
    };
    const tenantService = { getTenantDatabase: jest.fn(async () => db) };
    return {
      service: new FamilyPlanningService(tenantService as any),
      enrollmentRepo,
      followupRepo,
    };
  };

  it('auto-discontinues existing active enrollment before saving a new one', async () => {
    const { service, enrollmentRepo } = createService();

    const result = await service.enroll('tenant-a', 'user-1', {
      patientId: 'patient-1',
      enrolledAt: '2026-04-11',
      method: 'implant',
    });

    expect(enrollmentRepo.update).toHaveBeenCalledWith(
      { patientId: 'patient-1', status: 'active' },
      expect.objectContaining({
        status: 'discontinued',
      }),
    );
    expect(enrollmentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        enrolledBy: 'user-1',
        method: 'implant',
      }),
    );
    expect(result.id).toBe('enroll-2');
  });

  it('returns active enrollment for a patient', async () => {
    const { service, enrollmentRepo } = createService();

    const result = await service.getActiveEnrollment('tenant-a', 'patient-1');

    expect(enrollmentRepo.findOne).toHaveBeenCalledWith({
      where: { patientId: 'patient-1', status: 'active' },
      order: { enrolledAt: 'DESC' },
    });
    expect(result?.status).toBe('active');
  });

  it('records a follow-up linked to the patient', async () => {
    const { service, followupRepo } = createService();

    const result = await service.recordFollowup('tenant-a', 'user-2', {
      patientId: 'patient-1',
      visitDate: '2026-04-11',
      sideEffects: ['spotting'],
    });

    expect(followupRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient-1',
        conductedBy: 'user-2',
        sideEffects: ['spotting'],
      }),
    );
    expect(result.id).toBe('followup-1');
  });
}
