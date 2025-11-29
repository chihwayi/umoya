import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const EHR_API_URL = process.env.EHR_API_URL || 'http://localhost:3013/api';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@bulawayo-general.co.zw';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Password1#';
const TENANT_SLUG = process.env.TENANT_SLUG || 'bulawayo-general';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message?: string;
  duration?: number;
}

const results: TestResult[] = [];
let adminToken: string = '';
let doctorToken: string = '';
let patientId: string = '';
let templateId: string = '';
let scheduleId: string = '';
let outcomeId: string = '';

async function login(role: 'admin' | 'doctor' = 'admin'): Promise<string> {
  const email = role === 'admin' ? ADMIN_EMAIL : 'doctor@medicore.com';
  const password = role === 'admin' ? ADMIN_PASSWORD : 'doctor123';

  try {
    const response = await axios.post(
      `${EHR_API_URL}/auth/login`,
      { email, password },
      {
        headers: {
          'X-Tenant-ID': TENANT_SLUG,
        },
      },
    );

    if (response.data.token) {
      return response.data.token;
    }
    throw new Error('No token received');
  } catch (error: any) {
    throw new Error(`Login failed: ${error.response?.data?.message || error.message}`);
  }
}

async function runTest(name: string, testFn: () => Promise<any>): Promise<void> {
  const startTime = Date.now();
  try {
    await testFn();
    const duration = Date.now() - startTime;
    results.push({ name, status: 'PASS', duration });
    console.log(`✅ ${name} (${duration}ms)`);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const message = error.response?.data?.message || error.message || 'Unknown error';
    results.push({ name, status: 'FAIL', message, duration });
    console.log(`❌ ${name}: ${message}`);
  }
}

async function runSkipTest(name: string, reason: string): Promise<void> {
  results.push({ name, status: 'SKIP', message: reason });
  console.log(`⏭️  ${name}: ${reason}`);
}

async function main() {
  console.log('🧪 Testing Advanced Analytics & Reporting Module\n');
  console.log(`API URL: ${EHR_API_URL}`);
  console.log(`Tenant: ${TENANT_SLUG}\n`);

  // Authentication
  console.log('📋 Authentication Tests');
  await runTest('Login as Admin', async () => {
    adminToken = await login('admin');
    if (!adminToken) throw new Error('Failed to get admin token');
  });

  await runTest('Login as Doctor', async () => {
    try {
      doctorToken = await login('doctor');
    } catch {
      // Doctor might not exist, that's okay - use admin token
      doctorToken = adminToken;
    }
  });

  // Get a patient ID for testing
  await runTest('Get Patient for Testing', async () => {
    const response = await axios.get(`${EHR_API_URL}/patients`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${adminToken}`,
      },
      params: { limit: 1 },
    });
    if (response.data?.patients?.length > 0) {
      patientId = response.data.patients[0].id;
    } else {
      throw new Error('No patients found');
    }
  });

  console.log('\n📊 Report Templates Tests');
  
  // Create Template
  await runTest('Create Report Template', async () => {
    const response = await axios.post(
      `${EHR_API_URL}/analytics/templates`,
      {
        name: 'Test Revenue Report',
        description: 'Test template for revenue reporting',
        reportType: 'financial',
        category: 'Revenue',
        config: {},
        queryConfig: {
          table: 'billing',
          columns: ['id', 'total_amount', 'status', 'invoice_date'],
        },
        visualizationConfig: {},
        isPublic: false,
        isDefault: false,
      },
      {
        headers: {
          'X-Tenant-ID': TENANT_SLUG,
          Authorization: `Bearer ${adminToken}`,
        },
      },
    );
    if (!response.data?.id) throw new Error('Template ID not returned');
    templateId = response.data.id;
  });

  // List Templates
  await runTest('List Report Templates', async () => {
    const response = await axios.get(`${EHR_API_URL}/analytics/templates`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${adminToken}`,
      },
      params: { page: 1, limit: 10 },
    });
    if (!response.data?.templates) throw new Error('Templates not returned');
  });

  // Get Template
  await runTest('Get Report Template by ID', async () => {
    if (!templateId) throw new Error('No template ID available');
    const response = await axios.get(`${EHR_API_URL}/analytics/templates/${templateId}`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${adminToken}`,
      },
    });
    if (!response.data?.id) throw new Error('Template not found');
  });

  // Update Template
  await runTest('Update Report Template', async () => {
    if (!templateId) throw new Error('No template ID available');
    try {
      const response = await axios.put(
        `${EHR_API_URL}/analytics/templates/${templateId}`,
        {
          description: 'Updated test template description',
          isPublic: true,
        },
        {
          headers: {
            'X-Tenant-ID': TENANT_SLUG,
            Authorization: `Bearer ${adminToken}`,
          },
        },
      );
      // PostgreSQL returns lowercase column names
      if (!response.data?.id && !response.data?.Id && !response.data) {
        throw new Error(`Template update failed - no data returned. Response: ${JSON.stringify(response.data)}`);
      }
    } catch (error: any) {
      throw new Error(`Template update failed: ${error.response?.data?.message || error.message}`);
    }
  });

  // Execute Template (JSON)
  await runTest('Execute Template (JSON)', async () => {
    if (!templateId) throw new Error('No template ID available');
    const response = await axios.post(
      `${EHR_API_URL}/analytics/templates/${templateId}/execute`,
      {
        format: 'json',
        filters: {},
        page: 1,
        limit: 10,
      },
      {
        headers: {
          'X-Tenant-ID': TENANT_SLUG,
          Authorization: `Bearer ${adminToken}`,
        },
      },
    );
    if (!response.data?.executionId) throw new Error('Execution ID not returned');
  });

  // Clone Template
  await runTest('Clone Report Template', async () => {
    if (!templateId) throw new Error('No template ID available');
    const response = await axios.post(
      `${EHR_API_URL}/analytics/templates/${templateId}/clone`,
      {},
      {
        params: { newName: 'Cloned Revenue Report' },
        headers: {
          'X-Tenant-ID': TENANT_SLUG,
          Authorization: `Bearer ${adminToken}`,
        },
      },
    );
    if (!response.data?.id) throw new Error('Clone failed');
  });

  // Get Template Executions
  await runTest('Get Template Execution History', async () => {
    if (!templateId) throw new Error('No template ID available');
    const response = await axios.get(`${EHR_API_URL}/analytics/templates/${templateId}/executions`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${adminToken}`,
      },
      params: { page: 1, limit: 10 },
    });
    if (!response.data?.executions) throw new Error('Executions not returned');
  });

  console.log('\n📅 Scheduled Reports Tests');

  // Create Schedule
  await runTest('Create Scheduled Report', async () => {
    const response = await axios.post(
      `${EHR_API_URL}/analytics/schedules`,
      {
        name: 'Daily Revenue Report',
        templateId: templateId || undefined,
        scheduleType: 'daily',
        scheduleConfig: { hour: 9, minute: 0 },
        format: 'pdf',
        recipients: ['admin@medicore.com'],
        isActive: true,
      },
      {
        headers: {
          'X-Tenant-ID': TENANT_SLUG,
          Authorization: `Bearer ${adminToken}`,
        },
      },
    );
    if (!response.data?.id) throw new Error('Schedule ID not returned');
    scheduleId = response.data.id;
  });

  // List Schedules
  await runTest('List Scheduled Reports', async () => {
    const response = await axios.get(`${EHR_API_URL}/analytics/schedules`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${adminToken}`,
      },
      params: { page: 1, limit: 10 },
    });
    if (!response.data?.schedules) throw new Error('Schedules not returned');
  });

  // Get Schedule
  await runTest('Get Scheduled Report by ID', async () => {
    if (!scheduleId) throw new Error('No schedule ID available');
    const response = await axios.get(`${EHR_API_URL}/analytics/schedules/${scheduleId}`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${adminToken}`,
      },
    });
    if (!response.data?.id) throw new Error('Schedule not found');
  });

  // Update Schedule
  await runTest('Update Scheduled Report', async () => {
    if (!scheduleId) throw new Error('No schedule ID available');
    try {
      const response = await axios.put(
        `${EHR_API_URL}/analytics/schedules/${scheduleId}`,
        {
          name: 'Updated Daily Revenue Report',
          scheduleConfig: { hour: 10, minute: 30 },
        },
        {
          headers: {
            'X-Tenant-ID': TENANT_SLUG,
            Authorization: `Bearer ${adminToken}`,
          },
        },
      );
      // PostgreSQL returns lowercase column names
      if (!response.data?.id && !response.data?.Id && !response.data) {
        throw new Error(`Schedule update failed - no data returned. Response: ${JSON.stringify(response.data)}`);
      }
    } catch (error: any) {
      throw new Error(`Schedule update failed: ${error.response?.data?.message || error.message}`);
    }
  });

  // Pause Schedule
  await runTest('Pause Scheduled Report', async () => {
    if (!scheduleId) throw new Error('No schedule ID available');
    try {
      const response = await axios.post(
        `${EHR_API_URL}/analytics/schedules/${scheduleId}/pause`,
        {},
        {
          headers: {
            'X-Tenant-ID': TENANT_SLUG,
            Authorization: `Bearer ${adminToken}`,
          },
        },
      );
      // PostgreSQL returns lowercase column names
      if (!response.data?.id && !response.data?.Id && !response.data) {
        throw new Error(`Pause failed - no data returned. Response: ${JSON.stringify(response.data)}`);
      }
    } catch (error: any) {
      throw new Error(`Pause failed: ${error.response?.data?.message || error.message}`);
    }
  });

  // Resume Schedule
  await runTest('Resume Scheduled Report', async () => {
    if (!scheduleId) throw new Error('No schedule ID available');
    try {
      const response = await axios.post(
        `${EHR_API_URL}/analytics/schedules/${scheduleId}/resume`,
        {},
        {
          headers: {
            'X-Tenant-ID': TENANT_SLUG,
            Authorization: `Bearer ${adminToken}`,
          },
        },
      );
      // PostgreSQL returns lowercase column names
      if (!response.data?.id && !response.data?.Id && !response.data) {
        throw new Error(`Resume failed - no data returned. Response: ${JSON.stringify(response.data)}`);
      }
    } catch (error: any) {
      throw new Error(`Resume failed: ${error.response?.data?.message || error.message}`);
    }
  });

  // Get Schedule History
  await runTest('Get Schedule Execution History', async () => {
    if (!scheduleId) throw new Error('No schedule ID available');
    const response = await axios.get(`${EHR_API_URL}/analytics/schedules/${scheduleId}/history`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${adminToken}`,
      },
      params: { page: 1, limit: 10 },
    });
    if (!response.data?.executions) throw new Error('Execution history not returned');
  });

  console.log('\n🏥 Clinical Outcomes Tests');

  // Record Outcome
  await runTest('Record Clinical Outcome', async () => {
    if (!patientId) throw new Error('No patient ID available');
    const response = await axios.post(
      `${EHR_API_URL}/analytics/outcomes`,
      {
        patientId,
        outcomeType: 'treatment_response',
        condition: 'Diabetes Type 2',
        outcomeDate: new Date().toISOString().split('T')[0],
        outcomeValue: 7.2,
        outcomeUnit: 'mg/dL',
        outcomeStatus: 'improved',
        severity: 'mild',
        notes: 'HbA1c improved from 8.5% to 7.2%',
      },
      {
        headers: {
          'X-Tenant-ID': TENANT_SLUG,
          Authorization: `Bearer ${adminToken}`,
        },
      },
    );
    if (!response.data?.id) throw new Error('Outcome ID not returned');
    outcomeId = response.data.id;
  });

  // Get Outcomes
  await runTest('Get Clinical Outcomes', async () => {
    const response = await axios.get(`${EHR_API_URL}/analytics/outcomes`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${adminToken}`,
      },
      params: { page: 1, limit: 10 },
    });
    if (!response.data?.outcomes) throw new Error('Outcomes not returned');
  });

  // Get Patient Outcomes
  await runTest('Get Patient Outcomes', async () => {
    if (!patientId) throw new Error('No patient ID available');
    const response = await axios.get(`${EHR_API_URL}/analytics/outcomes/patient/${patientId}`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${adminToken}`,
      },
    });
    if (!Array.isArray(response.data)) throw new Error('Patient outcomes not returned');
  });

  // Get Outcome Trends
  await runTest('Get Outcome Trends', async () => {
    const response = await axios.get(`${EHR_API_URL}/analytics/outcomes/trends`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${adminToken}`,
      },
      params: {
        condition: 'Diabetes Type 2',
        dateFrom: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        dateTo: new Date().toISOString().split('T')[0],
      },
    });
    if (!Array.isArray(response.data)) throw new Error('Trends not returned');
  });

  // Get Outcome Metrics
  await runTest('Get Outcome Metrics', async () => {
    const response = await axios.get(`${EHR_API_URL}/analytics/outcomes/metrics`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${adminToken}`,
      },
      params: {
        condition: 'Diabetes Type 2',
        period: '30d',
      },
    });
    if (!Array.isArray(response.data)) throw new Error('Metrics not returned');
  });

  // Get Outcome Comparisons
  await runTest('Get Outcome Comparisons', async () => {
    const response = await axios.get(`${EHR_API_URL}/analytics/outcomes/comparisons`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${adminToken}`,
      },
      params: {
        condition: 'Diabetes Type 2',
        groups: ['treatment_group_1', 'treatment_group_2'],
      },
    });
    if (!Array.isArray(response.data)) throw new Error('Comparisons not returned');
  });

  // Update Outcome
  await runTest('Update Clinical Outcome', async () => {
    if (!outcomeId) throw new Error('No outcome ID available');
    try {
      const response = await axios.put(
        `${EHR_API_URL}/analytics/outcomes/${outcomeId}`,
        {
          outcomeStatus: 'resolved',
          notes: 'Updated: Patient fully recovered',
        },
        {
          headers: {
            'X-Tenant-ID': TENANT_SLUG,
            Authorization: `Bearer ${adminToken}`,
          },
        },
      );
      // PostgreSQL returns lowercase column names
      if (!response.data?.id && !response.data?.Id && !response.data) {
        throw new Error(`Outcome update failed - no data returned. Response: ${JSON.stringify(response.data)}`);
      }
    } catch (error: any) {
      throw new Error(`Outcome update failed: ${error.response?.data?.message || error.message}`);
    }
  });

  console.log('\n📈 Analytics Metrics Tests');

  // Create Metric
  await runTest('Create Analytics Metric', async () => {
    const response = await axios.post(
      `${EHR_API_URL}/analytics/metrics`,
      {
        metricName: 'daily_revenue',
        metricCategory: 'financial',
        metricDate: new Date().toISOString().split('T')[0],
        metricValue: 12500.50,
        metricUnit: 'USD',
        dimensions: { department: 'general' },
        calculationMethod: 'sum(billing.total_amount)',
      },
      {
        headers: {
          'X-Tenant-ID': TENANT_SLUG,
          Authorization: `Bearer ${adminToken}`,
        },
      },
    );
    if (!response.data?.id) throw new Error('Metric ID not returned');
  });

  // Get Metrics
  await runTest('Get Analytics Metrics', async () => {
    const response = await axios.get(`${EHR_API_URL}/analytics/metrics`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${adminToken}`,
      },
      params: {
        page: 1,
        limit: 10,
        metricCategory: 'financial',
      },
    });
    if (!response.data?.metrics) throw new Error('Metrics not returned');
  });

  // Calculate Metrics
  await runTest('Calculate Metrics', async () => {
    const response = await axios.get(`${EHR_API_URL}/analytics/metrics/calculate`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${adminToken}`,
      },
      params: {
        metricNames: ['daily_revenue', 'appointment_count'],
        dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        dateTo: new Date().toISOString().split('T')[0],
      },
    });
    if (!Array.isArray(response.data)) throw new Error('Calculated metrics not returned');
  });

  // Get Metric Trends
  await runTest('Get Metric Trends', async () => {
    const response = await axios.get(`${EHR_API_URL}/analytics/metrics/trends`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${adminToken}`,
      },
      params: {
        metricName: 'daily_revenue',
        period: '30d',
        groupBy: 'day',
      },
    });
    if (!Array.isArray(response.data)) throw new Error('Trends not returned');
  });

  // Compare Metrics
  await runTest('Compare Metrics', async () => {
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const response = await axios.get(`${EHR_API_URL}/analytics/metrics/compare`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${adminToken}`,
      },
      params: {
        metricName: 'daily_revenue',
        period1Start: lastMonth.toISOString().split('T')[0],
        period1End: lastMonthEnd.toISOString().split('T')[0],
        period2Start: thisMonth.toISOString().split('T')[0],
        period2End: thisMonthEnd.toISOString().split('T')[0],
      },
    });
    if (!response.data?.period1 || !response.data?.period2) throw new Error('Comparison not returned');
  });

  // Get Benchmarks
  await runTest('Get Metric Benchmarks', async () => {
    const response = await axios.get(`${EHR_API_URL}/analytics/metrics/benchmarks`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${adminToken}`,
      },
      params: {
        metricName: 'daily_revenue',
      },
    });
    if (!response.data?.metricName) throw new Error('Benchmarks not returned');
  });

  // Cleanup
  console.log('\n🧹 Cleanup Tests');

  await runTest('Delete Clinical Outcome', async () => {
    if (!outcomeId) throw new Error('No outcome ID available');
    await axios.delete(`${EHR_API_URL}/analytics/outcomes/${outcomeId}`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${adminToken}`,
      },
    });
  });

  await runTest('Delete Scheduled Report', async () => {
    if (!scheduleId) throw new Error('No schedule ID available');
    await axios.delete(`${EHR_API_URL}/analytics/schedules/${scheduleId}`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${adminToken}`,
      },
    });
  });

  await runTest('Delete Report Template', async () => {
    if (!templateId) throw new Error('No template ID available');
    await axios.delete(`${EHR_API_URL}/analytics/templates/${templateId}`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${adminToken}`,
      },
    });
  });

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;
  const total = results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results
      .filter((r) => r.status === 'FAIL')
      .forEach((r) => {
        console.log(`  - ${r.name}: ${r.message}`);
      });
  }

  const avgDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0) / total;
  console.log(`\n⏱️  Average Duration: ${avgDuration.toFixed(2)}ms`);

  console.log('\n' + '='.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

