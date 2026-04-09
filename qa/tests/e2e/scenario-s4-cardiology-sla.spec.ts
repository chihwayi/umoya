import { test, expect } from '@playwright/test';

/**
 * Scenario S4: Cardiology Encounter + Diagnostics SLA
 * Tests SNOMED-coded symptoms, diagnostics, and SLA tracking
 */

const API_BASE = process.env.EHR_API_URL;
const TENANT_SLUG = process.env.EHR_QA_TENANT || 'demo-clinic';
const AUTH_TOKEN = process.env.EHR_QA_TOKEN || 'test-token';

test.describe('Scenario S4: Cardiology Encounter + Diagnostics SLA', () => {
  let patientId: string;
  let encounterId: string;

  test.beforeAll(async ({ request }) => {
    // Create or find test patient
    const patientResponse = await request.post(`${API_BASE}/patients`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        firstName: 'QA',
        lastName: 'Cardio-001',
        dateOfBirth: '1975-03-20',
        gender: 'male',
        phone: '+263773456789',
      },
    });

    if (patientResponse.ok()) {
      const patient = await patientResponse.json();
      patientId = patient.id || patient.data?.id;
    }
  });

  test('Step 1: Create cardiology encounter with SNOMED symptoms', async ({
    request,
  }) => {
    const response = await request.post(`${API_BASE}/cardiology/encounters`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        patientId,
        encounterDate: new Date().toISOString().split('T')[0],
        visitReason: 'Chest pain evaluation',
        reasonSnomedCode: '29857009', // Chest pain
        symptomSnomedCodes: [
          {
            conceptId: '29857009',
            term: 'Chest pain (finding)',
          },
        ],
        diagnosticSnomedCodes: [
          {
            conceptId: '43764008', // Electrocardiogram
            term: 'Electrocardiogram (procedure)',
          },
        ],
        followUpRequired: true,
        followUpDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        careStatus: 'in_progress',
      },
    });

    expect(response.ok()).toBeTruthy();
    const encounter = await response.json();
    encounterId = encounter.id || encounter.data?.id;

    // Verify SNOMED codes are stored
    expect(encounter.symptomSnomedCodes).toBeDefined();
    expect(Array.isArray(encounter.symptomSnomedCodes)).toBeTruthy();
    expect(encounter.symptomSnomedCodes.length).toBeGreaterThan(0);
    expect(encounter.diagnosticSnomedCodes).toBeDefined();
    expect(encounter.followUpRequired).toBe(true);
  });

  test('Step 2: Update encounter care status', async ({ request }) => {
    const response = await request.patch(
      `${API_BASE}/cardiology/encounters/${encounterId}`,
      {
        headers: {
          'X-Tenant-ID': TENANT_SLUG,
          Authorization: `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        data: {
          careStatus: 'completed',
        },
      },
    );

    expect(response.ok()).toBeTruthy();
    const encounter = await response.json();
    expect(encounter.careStatus).toBe('completed');
  });

  test('Step 3: Verify dashboard shows SNOMED metrics', async ({
    request,
  }) => {
    const response = await request.get(`${API_BASE}/cardiology/dashboard`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
    });

    expect(response.ok()).toBeTruthy();
    const dashboard = await response.json();

    // Verify SNOMED aggregates are present
    expect(
      dashboard.chiefComplaintMix || dashboard.data?.chiefComplaintMix,
    ).toBeDefined();
    expect(dashboard.symptomMix || dashboard.data?.symptomMix).toBeDefined();
    expect(
      dashboard.diagnosticBacklog || dashboard.data?.diagnosticBacklog,
    ).toBeDefined();
  });
});

