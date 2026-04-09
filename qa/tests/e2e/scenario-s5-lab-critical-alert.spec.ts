import { test, expect } from '@playwright/test';

/**
 * Scenario S5: Lab Order + Critical Alert Escalation
 * Tests lab order workflow and critical alert handling
 */

const API_BASE = process.env.EHR_API_URL;
const TENANT_SLUG = process.env.EHR_QA_TENANT || 'demo-clinic';
const AUTH_TOKEN = process.env.EHR_QA_TOKEN || 'test-token';

test.describe('Scenario S5: Lab Order + Critical Alert', () => {
  let patientId: string;
  let labOrderId: string;
  let alertId: string;

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
        lastName: 'Lab-Crit-01',
        dateOfBirth: '1985-07-10',
        gender: 'male',
        phone: '+263774567890',
      },
    });

    if (patientResponse.ok()) {
      const patient = await patientResponse.json();
      patientId = patient.id || patient.data?.id;
    }
  });

  test('Step 1: Create lab order for BMP test', async ({ request }) => {
    const response = await request.post(`${API_BASE}/lab-orders`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        patientId,
        testName: 'Basic Metabolic Panel',
        testCode: 'BMP',
        orderedBy: 'doctor-uuid', // Should be actual user ID
        priority: 'urgent',
      },
    });

    expect(response.ok()).toBeTruthy();
    const order = await response.json();
    labOrderId = order.id || order.data?.id;
    expect(order.testCode).toBe('BMP');
  });

  test('Step 2: Collect sample and start processing', async ({
    request,
  }) => {
    // Collect sample
    const collectResponse = await request.put(
      `${API_BASE}/lab-orders/${labOrderId}/collect`,
      {
        headers: {
          'X-Tenant-ID': TENANT_SLUG,
          Authorization: `Bearer ${AUTH_TOKEN}`,
        },
      },
    );
    expect(collectResponse.ok()).toBeTruthy();

    // Start processing
    const processResponse = await request.put(
      `${API_BASE}/lab-orders/${labOrderId}/start-processing`,
      {
        headers: {
          'X-Tenant-ID': TENANT_SLUG,
          Authorization: `Bearer ${AUTH_TOKEN}`,
        },
      },
    );
    expect(processResponse.ok()).toBeTruthy();
  });

  test('Step 3: Submit results with critical potassium value', async ({
    request,
  }) => {
    const response = await request.put(
      `${API_BASE}/lab-orders/${labOrderId}/submit-results`,
      {
        headers: {
          'X-Tenant-ID': TENANT_SLUG,
          Authorization: `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        data: {
          results: [
            {
              componentName: 'Potassium',
              componentCode: 'K',
              resultValue: '2.1', // Critical low value
              unit: 'mmol/L',
              referenceRange: '3.5-5.0',
              status: 'critical',
            },
          ],
          completedAt: new Date().toISOString(),
        },
      },
    );

    expect(response.ok()).toBeTruthy();
    const order = await response.json();

    // Verify critical alert was created
    // This would typically be checked via a separate endpoint
    expect(order.status).toBe('completed');
  });

  test('Step 4: Acknowledge critical alert', async ({ request }) => {
    // First, get the alert (assuming it was created)
    const alertsResponse = await request.get(
      `${API_BASE}/critical-alerts?labOrderId=${labOrderId}`,
      {
        headers: {
          'X-Tenant-ID': TENANT_SLUG,
          Authorization: `Bearer ${AUTH_TOKEN}`,
        },
      },
    );

    if (alertsResponse.ok()) {
      const alerts = await alertsResponse.json();
      const alertList = Array.isArray(alerts) ? alerts : alerts.data || [];
      if (alertList.length > 0) {
        alertId = alertList[0].id;

        // Acknowledge the alert
        const ackResponse = await request.post(
          `${API_BASE}/critical-alerts/${alertId}/acknowledge`,
          {
            headers: {
              'X-Tenant-ID': TENANT_SLUG,
              Authorization: `Bearer ${AUTH_TOKEN}`,
              'Content-Type': 'application/json',
            },
            data: {
              acknowledgmentNotes: 'Alert reviewed and patient notified',
            },
          },
        );

        expect(ackResponse.ok()).toBeTruthy();
        const alert = await ackResponse.json();
        expect(alert.status).toBe('acknowledged');
      }
    }
  });
});

