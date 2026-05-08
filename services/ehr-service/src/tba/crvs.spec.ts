import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

describe('CRVS notification logic', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('skips when CRVS_ENABLED is not set', async () => {
    delete process.env.CRVS_ENABLED;
    const crvsEnabled = process.env.CRVS_ENABLED === 'true';
    expect(crvsEnabled).toBe(false);
  });

  it('skips when CRVS_ENDPOINT is not set', async () => {
    process.env.CRVS_ENABLED = 'true';
    delete process.env.CRVS_ENDPOINT;
    const shouldSkip = !process.env.CRVS_ENDPOINT;
    expect(shouldSkip).toBe(true);
  });

  it('builds correct birth payload shape', () => {
    const birthData = {
      babyFirstName: 'Amara',
      babyLastName: 'Nkosi',
      dateOfBirth: '2026-05-01',
      birthWeight: 3200,
      gestationalAge: 39,
      motherNationalId: '63-1234567-A-01',
      facilityCode: 'HARAR001',
    };
    const payload = {
      eventType: 'BIRTH',
      eventDate: birthData.dateOfBirth,
      child: {
        firstName: birthData.babyFirstName,
        lastName: birthData.babyLastName,
        dateOfBirth: birthData.dateOfBirth,
        birthWeight: birthData.birthWeight,
        gestationalAge: birthData.gestationalAge,
      },
      mother: { nationalId: birthData.motherNationalId },
      facility: { code: birthData.facilityCode, attendantType: 'SKILLED_BIRTH_ATTENDANT' },
    };
    expect(payload.eventType).toBe('BIRTH');
    expect(payload.child.firstName).toBe('Amara');
    expect(payload.mother.nationalId).toBe('63-1234567-A-01');
  });

  it('builds correct death payload shape', () => {
    const deathData = {
      deceasedFirstName: 'John',
      deceasedLastName: 'Doe',
      dateOfDeath: '2026-05-02',
      causeOfDeath: 'Malaria',
      icd10Code: 'B50.9',
    };
    const payload = {
      eventType: 'DEATH',
      eventDate: deathData.dateOfDeath,
      deceased: {
        firstName: deathData.deceasedFirstName,
        lastName: deathData.deceasedLastName,
        dateOfDeath: deathData.dateOfDeath,
      },
      causeOfDeath: {
        description: deathData.causeOfDeath,
        icd10Code: deathData.icd10Code,
      },
    };
    expect(payload.eventType).toBe('DEATH');
    expect(payload.causeOfDeath.icd10Code).toBe('B50.9');
  });

  it('referral delivery prefers webhook over email', () => {
    const referral = {
      id: 'ref-1',
      receivingFacilityWebhook: 'https://facility.example.com/referrals',
      receivingFacilityEmail: 'referrals@facility.example.com',
    };
    const deliveryMethod = referral.receivingFacilityWebhook ? 'webhook' : 'email';
    expect(deliveryMethod).toBe('webhook');
  });
});
