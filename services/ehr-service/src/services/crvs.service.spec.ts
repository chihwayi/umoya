import axios from 'axios';
import { CrvsService } from './crvs.service';

jest.mock('axios');

const TEST_ENV: Record<string, string> = {
  CRVS_API_KEY: process.env.CRVS_API_KEY ?? 'ci-key-stub',
  CRVS_BASE_URL: process.env.CRVS_BASE_URL ?? 'https://crvs.example.test',
  CRVS_COUNTRY_CODE: process.env.CRVS_COUNTRY_CODE ?? 'ZW',
};

describe('CrvsService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    Object.assign(process.env, TEST_ENV);
  });

  it('registerBirth stores live birth with submitted_to_crvs false when CRVS is not configured', async () => {
    process.env.CRVS_BASE_URL = '';
    process.env.CRVS_API_KEY = '';

    const repo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'birth-1', ...value })),
      update: jest.fn(async () => undefined),
      findOne: jest.fn(async () => ({
        id: 'birth-1',
        submittedToCrvs: false,
        errorMessage: 'CRVS not configured',
        birthType: 'live_birth',
      })),
    };
    const db = { getRepository: jest.fn(() => repo) };
    const tenantService = { getTenantDatabase: jest.fn(async () => db) };

    const service = new CrvsService(tenantService as any);
    const result = await service.registerBirth('tenant-a', {
      patientId: 'patient-1',
      birthDate: '2026-04-11T06:00:00Z',
      birthType: 'live_birth',
    });

    expect(result.submittedToCrvs).toBe(false);
    expect(result.errorMessage).toBe('CRVS not configured');
  });

  it('registerBirth stores stillbirth type correctly', async () => {
    process.env.CRVS_BASE_URL = '';
    process.env.CRVS_API_KEY = '';

    const repo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'birth-2', ...value })),
      update: jest.fn(async () => undefined),
      findOne: jest.fn(async () => ({
        id: 'birth-2',
        birthType: 'stillbirth',
        submittedToCrvs: false,
        errorMessage: 'CRVS not configured',
      })),
    };
    const db = { getRepository: jest.fn(() => repo) };
    const tenantService = { getTenantDatabase: jest.fn(async () => db) };

    const service = new CrvsService(tenantService as any);
    const result = await service.registerBirth('tenant-a', {
      patientId: 'patient-2',
      birthDate: '2026-04-11T07:00:00Z',
      birthType: 'stillbirth',
    });

    expect(result.birthType).toBe('stillbirth');
  });

  it('registerDeath creates a death certificate and calls the CRVS API when env vars are present', async () => {
    (axios.post as jest.Mock).mockResolvedValue({ data: { reference: 'CRVS-REF-1' } });

    const repo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'death-1', ...value })),
      update: jest.fn(async () => undefined),
      findOne: jest.fn(async () => ({
        id: 'death-1',
        patientId: 'patient-3',
        crvsReference: 'CRVS-REF-1',
        submittedToCrvs: true,
      })),
    };
    const db = { getRepository: jest.fn(() => repo) };
    const tenantService = { getTenantDatabase: jest.fn(async () => db) };

    const service = new CrvsService(tenantService as any);
    const result = await service.registerDeath('tenant-a', {
      patientId: 'patient-3',
      deathDate: '2026-04-11',
      causeOfDeathPrimary: 'Cardiac arrest',
      causeOfDeathIcd10: 'I46.9',
    });

    expect(axios.post).toHaveBeenCalled();
    expect(result.crvsReference).toBe('CRVS-REF-1');
  });

  it('submitMdsr creates an MDSR notification', async () => {
    const repo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'mdsr-1', ...value })),
    };
    const db = { getRepository: jest.fn(() => repo) };
    const tenantService = { getTenantDatabase: jest.fn(async () => db) };

    const service = new CrvsService(tenantService as any);
    const result = await service.submitMdsr('tenant-a', {
      patientId: 'patient-4',
      deathDate: '2026-04-10',
      primaryCause: 'Postpartum hemorrhage',
      primaryCauseIcd10: 'O72.1',
    });

    expect(result.id).toBe('mdsr-1');
    expect(result.submittedToMoh).toBe(true);
  });

  it('reviewMdsr persists committee review fields', async () => {
    const repo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({
          id: 'mdsr-2',
          committeeReviewDate: null,
          reviewedBy: null,
          actionPoints: null,
          avoidable: null,
          avoidanceFactors: null,
        })
        .mockResolvedValueOnce({
          id: 'mdsr-2',
          committeeReviewDate: '2026-04-12',
          reviewedBy: 'user-1',
          actionPoints: 'Improve PPH response',
          avoidable: true,
          avoidanceFactors: 'Delay in escalation',
        }),
      update: jest.fn(async () => undefined),
    };
    const db = { getRepository: jest.fn(() => repo) };
    const tenantService = { getTenantDatabase: jest.fn(async () => db) };

    const service = new CrvsService(tenantService as any);
    const result = await service.reviewMdsr('tenant-a', 'mdsr-2', {
      committeeReviewDate: '2026-04-12',
      reviewedBy: 'user-1',
      actionPoints: 'Improve PPH response',
      avoidable: true,
      avoidanceFactors: 'Delay in escalation',
    });

    expect(result.actionPoints).toBe('Improve PPH response');
    expect(repo.update).toHaveBeenCalled();
  });
});
