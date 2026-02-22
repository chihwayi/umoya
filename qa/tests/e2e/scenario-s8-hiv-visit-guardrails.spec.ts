import { test, expect } from '@playwright/test';

/**
 * Scenario S8: HIV Clinical Visit Guardrails
 * Validates WHO/Zim ART data-capture safety checks for HIV clinical visits.
 */

const API_BASE = process.env.EHR_API_URL;
const TENANT_SLUG = process.env.EHR_QA_TENANT || 'bulawayo-general';
const AUTH_TOKEN = process.env.EHR_QA_TOKEN || 'test-token';

test.describe('Scenario S8: HIV clinical visit guardrails', () => {
  test.skip(!API_BASE, 'EHR_API_URL is required to run API e2e tests');

  let patientId: string;
  let enrollmentId: string;

  test.beforeAll(async ({ request }) => {
    const patientResponse = await request.post(`${API_BASE}/patients`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        firstName: 'QA',
        lastName: `HIV-S8-${Date.now()}`,
        dateOfBirth: '1994-05-14',
        gender: 'female',
        phone: '+263771000999',
      },
    });

    expect(patientResponse.ok()).toBeTruthy();
    const patient = await patientResponse.json();
    patientId = patient.id || patient.data?.id;

    const enrollmentResponse = await request.post(`${API_BASE}/hiv/enrollments`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        patientId,
        enrollmentDate: new Date().toISOString().split('T')[0],
        dateConfirmedPositive: new Date().toISOString().split('T')[0],
      },
    });

    expect(enrollmentResponse.ok()).toBeTruthy();
    const enrollment = await enrollmentResponse.json();
    enrollmentId = enrollment.id || enrollment.data?.id;
  });

  test('Step 1: rejects future visit dates', async ({ request }) => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const response = await request.post(`${API_BASE}/hiv/visits`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        enrollmentId,
        visitDate: tomorrow,
        visitType: 'A',
        arvStatus: '1',
        arvReasonNotOnCode: 'CLIENT_DECLINED',
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    const message = JSON.stringify(body).toLowerCase();
    expect(message).toContain('future');
  });

  test('Step 2: rejects on-ART status without regimen', async ({ request }) => {
    const response = await request.post(`${API_BASE}/hiv/visits`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        enrollmentId,
        visitDate: new Date().toISOString().split('T')[0],
        visitType: 'A',
        arvStatus: '3',
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    const message = JSON.stringify(body).toLowerCase();
    expect(message).toContain('arvregimencode');
  });

  test('Step 3: rejects non-numeric viral load payloads', async ({ request }) => {
    const response = await request.post(`${API_BASE}/hiv/visits`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        enrollmentId,
        visitDate: new Date().toISOString().split('T')[0],
        visitType: 'A',
        arvStatus: '1',
        arvReasonNotOnCode: 'CLIENT_DECLINED',
        viralLoad: 'undetected',
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    const message = JSON.stringify(body).toLowerCase();
    expect(message).toContain('viralload');
  });

  test('Step 4: accepts a valid baseline visit payload', async ({ request }) => {
    const response = await request.post(`${API_BASE}/hiv/visits`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        enrollmentId,
        visitDate: new Date().toISOString().split('T')[0],
        visitType: 'A',
        arvStatus: '1',
        arvReasonNotOnCode: 'CLIENT_DECLINED',
        whoClinicalStage: 2,
        visitNotes: 'Baseline visit captured with guardrail-safe data.',
      },
    });

    expect(response.ok()).toBeTruthy();
    const visit = await response.json();
    expect(visit.id || visit.data?.id).toBeTruthy();
  });
});
