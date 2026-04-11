import axios from 'axios';
import { OpenmrsFhirService } from './openmrs-fhir.service';

jest.mock('axios');

describe('OpenmrsFhirService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.OPENMRS_USERNAME = 'admin';
    process.env.OPENMRS_PASSWORD = 'Admin123';
  });

  it('creates or updates an OpenMRS patient link', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'link-1', ...value })),
    };
    const db = { getRepository: jest.fn(() => repo) };
    const tenantService = { getTenantDatabase: jest.fn(async () => db) };

    const service = new OpenmrsFhirService(tenantService as any);
    const result = await service.linkPatient('tenant-a', 'patient-1', 'openmrs-uuid-1', 'https://openmrs.example.test/');

    expect(result.openmrsBaseUrl).toBe('https://openmrs.example.test');
    expect(repo.save).toHaveBeenCalled();
  });

  it('pushes a local patient to OpenMRS and records a sync log', async () => {
    (axios.post as jest.Mock).mockResolvedValue({ data: { id: 'openmrs-uuid-1', resourceType: 'Patient' } });

    const patientRepo = {
      findOne: jest.fn(async () => ({
        id: 'patient-1',
        firstName: 'Jane',
        lastName: 'Doe',
        gender: 'female',
        dateOfBirth: new Date('2000-01-01'),
        nationalId: '12345678',
        phone: '+254700000000',
        email: 'jane@example.test',
        address: 'Nairobi',
        city: 'Nairobi',
      })),
    };
    const linkRepo = {
      findOne: jest.fn(async () => ({
        id: 'link-1',
        patientId: 'patient-1',
        openmrsUuid: 'openmrs-uuid-1',
        openmrsBaseUrl: 'https://openmrs.example.test',
      })),
      update: jest.fn(async () => undefined),
    };
    const logRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'log-1', ...value })),
    };
    const db = {
      getRepository: jest.fn((entity) => {
        if (entity.name === 'Patient') return patientRepo;
        if (entity.name === 'OpenmrsPatientLink') return linkRepo;
        return logRepo;
      }),
    };
    const tenantService = { getTenantDatabase: jest.fn(async () => db) };

    const service = new OpenmrsFhirService(tenantService as any);
    const response = await service.pushPatientToOpenmrs('tenant-a', 'patient-1');

    expect(axios.post).toHaveBeenCalledWith(
      'https://openmrs.example.test/ws/fhir2/R4/Patient',
      expect.objectContaining({
        resourceType: 'Patient',
        id: 'openmrs-uuid-1',
      }),
      expect.objectContaining({
        auth: { username: 'admin', password: 'Admin123' },
      }),
    );
    expect(response.id).toBe('openmrs-uuid-1');
    expect(logRepo.save).toHaveBeenCalled();
  });
});
