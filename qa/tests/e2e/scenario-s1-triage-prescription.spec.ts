import { test, expect } from '@playwright/test';

/**
 * Scenario S1: Triage → Prescription → Nursing Note
 * Tests SNOMED coding, CDSS hooks, and data persistence
 */

const API_BASE = process.env.EHR_API_URL || 'http://localhost:3001/api';
const TENANT_SLUG = process.env.EHR_QA_TENANT || 'bulawayo-general';
const AUTH_TOKEN = process.env.EHR_QA_TOKEN || 'test-token';

test.describe('Scenario S1: Triage → Prescription → Nursing Note', () => {
  let patientId: string;
  let triageId: string;
  let prescriptionId: string;
  let nursingNoteId: string;

  test.beforeAll(async ({ request }) => {
    // Create test patient if needed
    const patientResponse = await request.post(`${API_BASE}/patients`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        firstName: 'QA',
        lastName: 'Triage-001',
        dateOfBirth: '1990-01-01',
        gender: 'male',
        phone: '+263771234567',
        email: 'qa.triage@test.local',
      },
    });

    if (patientResponse.ok()) {
      const patient = await patientResponse.json();
      patientId = patient.id || patient.data?.id;
    } else {
      // Try to find existing patient
      const searchResponse = await request.get(
        `${API_BASE}/patients?search=Triage-001`,
        {
          headers: {
            'X-Tenant-ID': TENANT_SLUG,
            Authorization: `Bearer ${AUTH_TOKEN}`,
          },
        },
      );
      if (searchResponse.ok()) {
        const patients = await searchResponse.json();
        patientId = patients[0]?.id || patients.data?.[0]?.id;
      }
    }
  });

  test('Step 1: Create triage assessment with SNOMED-coded chief complaint', async ({
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
        chiefComplaint: 'Chest pain',
        chiefComplaintSnomedCode: '162718002', // Chest pain
        chiefComplaintSnomedTerm: 'Chest pain (finding)',
        observations: 'Patient reports chest pain for 2 hours',
        observationsSnomed: [
          {
            conceptId: '162214009',
            term: 'Shortness of breath',
          },
        ],
        priority: 'high',
        severityScore: 7,
      },
    });

    expect(response.ok()).toBeTruthy();
    const triage = await response.json();
    triageId = triage.id || triage.data?.id;

    // Verify SNOMED codes are stored
    expect(triage.chiefComplaintSnomedCode).toBe('162718002');
    expect(triage.observationsSnomed).toBeDefined();
    expect(Array.isArray(triage.observationsSnomed)).toBeTruthy();

    // Verify CDSS insights are present
    expect(triage.cdssInsights).toBeDefined();
    if (triage.cdssInsights) {
      expect(triage.cdssInsights.riskAssessment || triage.cdssInsights.diagnosisAssist).toBeDefined();
    }
  });

  test('Step 2: Create prescription with SNOMED-coded medication', async ({
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
        medicationName: 'Aspirin',
        medicationNameSnomedCode: '372729009', // Aspirin
        medicationNameSnomedTerm: 'Aspirin (substance)',
        strength: '100mg',
        form: 'tablet',
        dosage: '1 tablet',
        frequency: 'once daily',
        route: 'oral',
        quantity: 30,
        startDate: new Date().toISOString().split('T')[0],
        indication: 'Chest pain management',
      },
    });

    expect(response.ok()).toBeTruthy();
    const prescription = await response.json();
    prescriptionId = prescription.id || prescription.data?.id;

    // Verify SNOMED code is stored
    expect(prescription.medicationNameSnomedCode).toBe('372729009');

    // Verify CDSS insights (drug interactions)
    expect(prescription.cdssInsights).toBeDefined();
  });

  test('Step 3: Create nursing note with SNOMED-coded observations', async ({
    request,
  }) => {
    const response = await request.post(`${API_BASE}/nursing-notes`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        patientId,
        noteType: 'assessment',
        content: 'Patient stable, vitals normal',
        observations: 'Patient reports improvement',
        observationsSnomed: [
          {
            conceptId: '162214009',
            term: 'Shortness of breath',
          },
        ],
        interventions: 'Administered medication',
        interventionsSnomed: [
          {
            conceptId: '225746001',
            term: 'Medication administration',
          },
        ],
      },
    });

    expect(response.ok()).toBeTruthy();
    const note = await response.json();
    nursingNoteId = note.id || note.data?.id;

    // Verify SNOMED arrays are stored
    expect(note.observationsSnomed).toBeDefined();
    expect(Array.isArray(note.observationsSnomed)).toBeTruthy();
    expect(note.observationsSnomed.length).toBeGreaterThan(0);
    expect(note.interventionsSnomed).toBeDefined();
    expect(Array.isArray(note.interventionsSnomed)).toBeTruthy();
  });

  test('Step 4: Verify data persistence in database', async ({ request }) => {
    // Verify triage assessment
    const triageResponse = await request.get(`${API_BASE}/triage/${triageId}`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
    });
    expect(triageResponse.ok()).toBeTruthy();
    const triage = await triageResponse.json();
    expect(triage.chiefComplaintSnomedCode).toBe('162718002');

    // Verify prescription
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
    expect(prescription.medicationNameSnomedCode).toBe('372729009');

    // Verify nursing note
    const noteResponse = await request.get(
      `${API_BASE}/nursing-notes/${nursingNoteId}`,
      {
        headers: {
          'X-Tenant-ID': TENANT_SLUG,
          Authorization: `Bearer ${AUTH_TOKEN}`,
        },
      },
    );
    expect(noteResponse.ok()).toBeTruthy();
    const note = await noteResponse.json();
    expect(note.observationsSnomed).toBeDefined();
    expect(note.observationsSnomed.length).toBeGreaterThan(0);
  });
});

