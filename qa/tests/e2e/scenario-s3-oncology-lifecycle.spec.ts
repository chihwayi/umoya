import { test, expect } from '@playwright/test';

/**
 * Scenario S3: Oncology Case Lifecycle
 * Tests oncology case creation, regimen assignment, and adverse events
 */

const API_BASE = process.env.EHR_API_URL;
const TENANT_SLUG = process.env.EHR_QA_TENANT || 'bulawayo-general';
const AUTH_TOKEN = process.env.EHR_QA_TOKEN || 'test-token';

test.describe('Scenario S3: Oncology Case Lifecycle', () => {
  let patientId: string;
  let caseId: string;
  let regimenId: string;
  let adverseEventId: string;

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
        lastName: 'Oncology-001',
        dateOfBirth: '1980-05-15',
        gender: 'female',
        phone: '+263772345678',
      },
    });

    if (patientResponse.ok()) {
      const patient = await patientResponse.json();
      patientId = patient.id || patient.data?.id;
    }
  });

  test('Step 1: Create oncology case with SNOMED diagnosis', async ({
    request,
  }) => {
    const response = await request.post(`${API_BASE}/oncology/cases`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        patientId,
        primaryDiagnosis: 'Breast cancer',
        primaryDiagnosisSnomedCode: '254837009', // Malignant neoplasm of breast
        primaryDiagnosisSnomedTerm: 'Malignant neoplasm of breast (disorder)',
        stage: 'II',
        diagnosisDate: new Date().toISOString().split('T')[0],
      },
    });

    expect(response.ok()).toBeTruthy();
    const oncologyCase = await response.json();
    caseId = oncologyCase.id || oncologyCase.data?.id;

    // Verify SNOMED code is stored
    expect(oncologyCase.primaryDiagnosisSnomedCode).toBe('254837009');
    expect(oncologyCase.primaryDiagnosisSnomedTerm).toBeDefined();
  });

  test('Step 2: Create regimen for the case', async ({ request }) => {
    const response = await request.post(
      `${API_BASE}/oncology/cases/${caseId}/regimens`,
      {
        headers: {
          'X-Tenant-ID': TENANT_SLUG,
          Authorization: `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        data: {
          regimenName: 'AC-T',
          regimenNameSnomedCode: '703357002', // Chemotherapy regimen
          cycleLengthDays: 21,
          totalCycles: 6,
          startDate: new Date().toISOString().split('T')[0],
        },
      },
    );

    expect(response.ok()).toBeTruthy();
    const regimen = await response.json();
    regimenId = regimen.id || regimen.data?.id;

    expect(regimen.regimenName).toBe('AC-T');
  });

  test('Step 3: Record adverse event with SNOMED code', async ({
    request,
  }) => {
    const response = await request.post(`${API_BASE}/oncology/adverse-events`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        regimenId,
        eventType: 'Nausea',
        snomedConceptId: '281398003', // Nausea
        snomedTerm: 'Nausea (finding)',
        severityGrade: 2,
        eventDate: new Date().toISOString().split('T')[0],
        status: 'active',
      },
    });

    expect(response.ok()).toBeTruthy();
    const event = await response.json();
    adverseEventId = event.id || event.data?.id;

    // Verify SNOMED code is stored
    expect(event.snomedConceptId).toBe('281398003');
    expect(event.severityGrade).toBe(2);
  });

  test('Step 4: Verify dashboard aggregates include new data', async ({
    request,
  }) => {
    const response = await request.get(`${API_BASE}/oncology/dashboard`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
    });

    expect(response.ok()).toBeTruthy();
    const dashboard = await response.json();

    // Verify SNOMED aggregates are present
    expect(dashboard.topDiagnosesSnomed || dashboard.data?.topDiagnosesSnomed).toBeDefined();
    expect(dashboard.adverseEventSnomedSummary || dashboard.data?.adverseEventSnomedSummary).toBeDefined();
  });
});

