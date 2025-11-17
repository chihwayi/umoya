import { test, expect } from '@playwright/test';

/**
 * Scenario S7: CDSS Hook Validation – Mental Health Pathway
 * Tests CDSS insights for mental health triage and prescriptions
 */

const API_BASE = process.env.EHR_API_URL || 'http://localhost:3001/api';
const TENANT_SLUG = process.env.EHR_QA_TENANT || 'bulawayo-general';
const AUTH_TOKEN = process.env.EHR_QA_TOKEN || 'test-token';

test.describe('Scenario S7: CDSS Hook Validation', () => {
  let patientId: string;
  let triageId: string;
  let prescriptionId: string;

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
        lastName: 'Psych-001',
        dateOfBirth: '1992-11-05',
        gender: 'female',
        phone: '+263775678901',
      },
    });

    if (patientResponse.ok()) {
      const patient = await patientResponse.json();
      patientId = patient.id || patient.data?.id;
    }
  });

  test('Step 1: Trigger triage with anxiety SNOMED code', async ({
    request,
  }) => {
    const response = await request.post(`${API_BASE}/triage`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        patientId,
        chiefComplaint: 'Anxiety and worry',
        chiefComplaintSnomedCode: '197480006', // Anxiety disorder
        chiefComplaintSnomedTerm: 'Anxiety disorder (disorder)',
        observations: 'Patient reports persistent anxiety',
        priority: 'normal',
      },
    });

    expect(response.ok()).toBeTruthy();
    const triage = await response.json();
    triageId = triage.id || triage.data?.id;

    // Verify CDSS insights are present
    expect(triage.cdssInsights).toBeDefined();
    if (triage.cdssInsights) {
      // Should have risk assessment or diagnosis assistance
      expect(
        triage.cdssInsights.riskAssessment ||
          triage.cdssInsights.diagnosisAssist ||
          triage.cdssInsights.suggestedDiagnoses,
      ).toBeDefined();
    }
  });

  test('Step 2: Create prescription for SSRI and check drug interactions', async ({
    request,
  }) => {
    const response = await request.post(`${API_BASE}/prescriptions`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        patientId,
        medicationName: 'Sertraline',
        medicationNameSnomedCode: '372756007', // Sertraline
        medicationNameSnomedTerm: 'Sertraline (substance)',
        strength: '50mg',
        form: 'tablet',
        dosage: '1 tablet',
        frequency: 'once daily',
        route: 'oral',
        quantity: 30,
        startDate: new Date().toISOString().split('T')[0],
        indication: 'Anxiety disorder',
      },
    });

    expect(response.ok()).toBeTruthy();
    const prescription = await response.json();
    prescriptionId = prescription.id || prescription.data?.id;

    // Verify CDSS insights include drug interaction checks
    expect(prescription.cdssInsights).toBeDefined();
    if (prescription.cdssInsights) {
      // May have interactions, warnings, or recommendations
      expect(
        prescription.cdssInsights.interactions ||
          prescription.cdssInsights.warnings ||
          prescription.cdssInsights.recommendations,
      ).toBeDefined();
    }
  });

  test('Step 3: Verify CDSS insights are logged', async ({ request }) => {
    // Verify triage has CDSS insights
    const triageResponse = await request.get(`${API_BASE}/triage/${triageId}`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
    });

    expect(triageResponse.ok()).toBeTruthy();
    const triage = await triageResponse.json();
    expect(triage.cdssInsights).toBeDefined();

    // Verify prescription has CDSS insights
    const prescriptionResponse = await request.get(
      `${API_BASE}/prescriptions/${prescriptionId}`,
      {
        headers: {
          'X-Tenant-ID': TENANT_SLUG,
          Authorization: `Bearer ${AUTH_TOKEN}`,
        },
      },
    );

    expect(prescriptionResponse.ok()).toBeTruthy();
    const prescription = await prescriptionResponse.json();
    expect(prescription.cdssInsights).toBeDefined();
  });
});

