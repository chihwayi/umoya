import { ConflictException } from '@nestjs/common';
import { PatientService } from './patient.service';

function makeTenantDb(repo: any) {
  return { getRepository: jest.fn().mockReturnValue(repo) } as any;
}

describe('PatientService.createPatient — MRN collision handling', () => {
  it('retries with a fresh random suffix on a unique-constraint violation and succeeds', async () => {
    const service = new PatientService();
    let saveAttempts = 0;
    const repo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((dto) => ({ ...dto })),
      save: jest.fn().mockImplementation(async (patient) => {
        saveAttempts += 1;
        if (saveAttempts < 3) {
          const err: any = new Error('duplicate key value violates unique constraint');
          err.code = '23505';
          throw err;
        }
        return { ...patient, id: 'new-patient-id' };
      }),
    };

    const result = await service.createPatient(
      { firstName: 'Test', lastName: 'Patient' } as any,
      makeTenantDb(repo),
      'demo-clinic',
    );

    expect(saveAttempts).toBe(3);
    expect(result.id).toBe('new-patient-id');
    expect(result.patientNumber).toMatch(/^DEM\d{6}\d{3}$/);
  });

  it('gives up after maxAttempts and rethrows the unique-constraint error', async () => {
    const service = new PatientService();
    const repo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((dto) => ({ ...dto })),
      save: jest.fn().mockImplementation(async () => {
        const err: any = new Error('duplicate key value violates unique constraint');
        err.code = '23505';
        throw err;
      }),
    };

    await expect(
      service.createPatient({ firstName: 'Test', lastName: 'Patient' } as any, makeTenantDb(repo), 'demo-clinic'),
    ).rejects.toThrow('duplicate key value violates unique constraint');

    expect(repo.save).toHaveBeenCalledTimes(5);
  });

  it('does not retry on a non-collision error', async () => {
    const service = new PatientService();
    const repo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((dto) => ({ ...dto })),
      save: jest.fn().mockRejectedValue(new Error('connection lost')),
    };

    await expect(
      service.createPatient({ firstName: 'Test', lastName: 'Patient' } as any, makeTenantDb(repo), 'demo-clinic'),
    ).rejects.toThrow('connection lost');

    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate national ID before generating an MRN', async () => {
    const service = new PatientService();
    const repo = {
      findOne: jest.fn().mockResolvedValue({ id: 'existing' }),
      create: jest.fn(),
      save: jest.fn(),
    };

    await expect(
      service.createPatient({ nationalId: '63-123456A78' } as any, makeTenantDb(repo), 'demo-clinic'),
    ).rejects.toThrow(ConflictException);

    expect(repo.save).not.toHaveBeenCalled();
  });
});
