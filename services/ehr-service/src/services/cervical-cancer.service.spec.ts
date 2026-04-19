import { CervicalCancerService } from './cervical-cancer.service';
import { CervicalScreening } from '../entities/cervical-screening.entity';
import { CervicalTreatment } from '../entities/cervical-treatment.entity';

describe('CervicalCancerService', () => {
  const createService = () => {
    const screeningRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'screen-1', ...value })),
      find: jest.fn(async () => [{ id: 'screen-1', patientId: 'patient-1' }]),
      findOne: jest.fn(async () => ({ id: 'screen-1', patientId: 'patient-1' })),
    };
    const treatmentRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'treat-1', ...value })),
      find: jest.fn(async () => [{ id: 'treat-1', patientId: 'patient-1' }]),
    };
    const db = {
      getRepository: jest.fn((entity) => {
        if (entity === CervicalScreening) return screeningRepo;
        if (entity === CervicalTreatment) return treatmentRepo;
        return {};
      }),
    };
    const tenantService = { getTenantDatabase: jest.fn(async () => db) };
    return {
      service: new CervicalCancerService(tenantService as any),
      screeningRepo,
      treatmentRepo,
    };
  };

  it('records a screening using request user when provided', async () => {
    const { service, screeningRepo } = createService();

    const result = await service.recordScreening('tenant-a', 'user-1', {
      patientId: 'patient-1',
      method: 'VIA',
      result: 'positive',
    });

    expect(screeningRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient-1',
        screenedBy: 'user-1',
      }),
    );
    expect(result.id).toBe('screen-1');
  });

  it('lists screenings by patient descending', async () => {
    const { service, screeningRepo } = createService();

    const result = await service.getScreenings('tenant-a', 'patient-1');

    expect(screeningRepo.find).toHaveBeenCalledWith({
      where: { patientId: 'patient-1' },
      order: { screenedAt: 'DESC' },
    });
    expect(result).toHaveLength(1);
  });

  it('returns the latest screening by patient', async () => {
    const { service, screeningRepo } = createService();

    const result = await service.getLatestScreening('tenant-a', 'patient-1');

    expect(screeningRepo.findOne).toHaveBeenCalledWith({
      where: { patientId: 'patient-1' },
      order: { screenedAt: 'DESC' },
    });
    expect(result?.id).toBe('screen-1');
  });

  it('records treatment using request user when provided', async () => {
    const { service, treatmentRepo } = createService();

    const result = await service.recordTreatment('tenant-a', 'user-2', {
      patientId: 'patient-1',
      method: 'cryotherapy',
      outcome: 'successful',
    });

    expect(treatmentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient-1',
        treatedBy: 'user-2',
      }),
    );
    expect(result.id).toBe('treat-1');
  });
});
