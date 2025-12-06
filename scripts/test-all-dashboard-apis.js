#!/usr/bin/env node

/**
 * Comprehensive API Test Script for All Dashboard Modules
 * Tests all endpoints used by the 8 new dashboards
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3013/api';
const TENANT = 'bulawayo-general';
const EMAIL = 'dr.smith@bulawayo-general.co.zw';
const PASSWORD = 'Password1#';

let TOKEN = '';

// Test results
const results = {
  passed: [],
  failed: [],
  warnings: []
};

// Helper function to make API calls
async function testEndpoint(name, method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'X-Tenant-ID': TENANT,
        'Content-Type': 'application/json'
      }
    };

    if (data && method === 'POST') {
      config.data = data;
    }

    const response = await axios(config);
    
    if (response.status === 200 || response.status === 201) {
      results.passed.push({ name, endpoint, status: response.status });
      console.log(`✅ ${name} - ${response.status}`);
      return response.data;
    } else {
      results.failed.push({ name, endpoint, status: response.status, error: 'Unexpected status' });
      console.log(`❌ ${name} - Status: ${response.status}`);
      return null;
    }
  } catch (error) {
    const status = error.response?.status || 'Network Error';
    const message = error.response?.data?.message || error.message;
    results.failed.push({ name, endpoint, status, error: message });
    console.log(`❌ ${name} - ${status}: ${message}`);
    return null;
  }
}

// Main test function
async function runTests() {
  console.log('🧪 Testing All Dashboard APIs');
  console.log('==============================\n');

  // Step 1: Login
  console.log('📝 Step 1: Logging in...');
  try {
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: EMAIL,
      password: PASSWORD
    }, {
      headers: { 'X-Tenant-ID': TENANT }
    });

    TOKEN = loginResponse.data.accessToken;
    if (!TOKEN) {
      console.log('❌ Login failed: No token received');
      return;
    }
    console.log('✅ Login successful\n');
  } catch (error) {
    console.log(`❌ Login failed: ${error.response?.data?.message || error.message}`);
    return;
  }

  // Get a patient ID for tests that need it
  let patientId = null;
  try {
    const admissionsResponse = await axios.get(`${BASE_URL}/beds/admissions`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'X-Tenant-ID': TENANT
      }
    });
    if (admissionsResponse.data && admissionsResponse.data.length > 0) {
      patientId = admissionsResponse.data[0].patientId;
    }
  } catch (error) {
    console.log('⚠️  Could not fetch patient ID for MAR test\n');
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  const endDate = new Date();
  const dateParams = `startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`;

  // ==================== PACU DASHBOARD ====================
  console.log('🏥 PACU Dashboard APIs');
  console.log('----------------------');
  await testEndpoint('Get Active PACU Patients', 'GET', '/anesthesia/pacu/active');
  console.log('');

  // ==================== OR DASHBOARD ====================
  console.log('🏥 Operating Room Dashboard APIs');
  console.log('---------------------------------');
  const today = new Date().toISOString().split('T')[0];
  await testEndpoint('Get OR Availability', 'GET', `/operating-room/availability?date=${today}`);
  await testEndpoint('Get OR Metrics', 'GET', `/operating-room/metrics?${dateParams}`);
  console.log('');

  // ==================== MAR DASHBOARD ====================
  console.log('🏥 MAR (BCMA) Dashboard APIs');
  console.log('-----------------------------');
  if (patientId) {
    await testEndpoint('Get Patient MAR', 'GET', `/bcma/mar/patient/${patientId}`);
  } else {
    console.log('⚠️  No admitted patients found, skipping MAR test');
    results.warnings.push('MAR test skipped - no patients');
  }
  console.log('');

  // ==================== BLOOD BANK DASHBOARD ====================
  console.log('🏥 Blood Bank Dashboard APIs');
  console.log('----------------------------');
  await testEndpoint('Get Blood Inventory', 'GET', '/blood-bank/inventory');
  await testEndpoint('Get Inventory Stats', 'GET', '/blood-bank/inventory/stats');
  await testEndpoint('Get Active Transfusions', 'GET', '/blood-bank/transfusions/active');
  console.log('');

  // ==================== INFECTION CONTROL DASHBOARD ====================
  console.log('🏥 Infection Control Dashboard APIs');
  console.log('-----------------------------------');
  await testEndpoint('Get Infections', 'GET', `/infection-control/infections?${dateParams}`);
  await testEndpoint('Get HAI Metrics', 'GET', `/infection-control/metrics/hai?${dateParams}`);
  await testEndpoint('Get Active Isolations', 'GET', '/infection-control/isolation/active');
  console.log('');

  // ==================== SEPSIS DASHBOARD ====================
  console.log('🏥 Sepsis Dashboard APIs');
  console.log('-----------------------');
  await testEndpoint('Get Sepsis Alerts', 'GET', '/sepsis/alerts');
  await testEndpoint('Get Bundle Compliance', 'GET', `/sepsis/compliance?${dateParams}`);
  console.log('');

  // ==================== REVENUE CYCLE DASHBOARD ====================
  console.log('🏥 Revenue Cycle Dashboard APIs');
  console.log('-------------------------------');
  await testEndpoint('Get Charge Master', 'GET', '/revenue-cycle/charge-master');
  console.log('');

  // ==================== CDI DASHBOARD ====================
  console.log('🏥 CDI Dashboard APIs');
  console.log('--------------------');
  await testEndpoint('Get CDI Metrics', 'GET', `/cdi/metrics?${dateParams}`);
  // For physician queries, we need a user ID - using a placeholder
  // In real scenario, this would come from the logged-in user
  await testEndpoint('Get Physician Queries (placeholder)', 'GET', '/cdi/queries/physician/test-user-id');
  console.log('');

  // Summary
  console.log('\n📊 Test Summary');
  console.log('==============================');
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⚠️  Warnings: ${results.warnings.length}`);
  console.log('');

  if (results.failed.length > 0) {
    console.log('❌ Failed Tests:');
    results.failed.forEach(test => {
      console.log(`   - ${test.name}: ${test.status} - ${test.error}`);
    });
    console.log('');
  }

  if (results.passed.length > 0) {
    console.log('✅ All Passed Tests:');
    results.passed.forEach(test => {
      console.log(`   - ${test.name}`);
    });
  }

  console.log('\n✅ API Testing Complete!');
  console.log('==============================\n');

  // Exit with error code if any tests failed
  process.exit(results.failed.length > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});




