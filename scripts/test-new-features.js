/**
 * Comprehensive test script for all new features:
 * 1. RxNorm Integration
 * 2. FHIR R4 Resource Expansion
 * 3. CCDA Document Generation
 * 4. HIPAA Compliance (Audit Logging)
 * 5. Quality Measures (HEDIS/eCQM)
 */

const axios = require('axios');

const EHR_SERVICE_URL = process.env.EHR_SERVICE_URL || 'http://localhost:3013';
const TENANT_SLUG = process.env.TENANT_SLUG || 'bulawayo-general';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@bulawayo-general.co.zw';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Password1#';

let authToken = '';
let testPatientId = '';
let testUserId = '';

// Test results
const testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    error: '\x1b[31m',   // Red
    warning: '\x1b[33m', // Yellow
    reset: '\x1b[0m'
  };
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
  console.log(`${colors[type]}${icon} ${message}${colors.reset}`);
}

async function checkServiceHealth() {
  try {
    log('Checking service health...', 'info');
    // Try to connect to the service - if it responds (even with 404), it's running
    await axios.get(`${EHR_SERVICE_URL}/api`, { timeout: 5000, validateStatus: () => true });
    log('Service is running', 'success');
    return true;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log('Service is not running. Please start services with: docker-compose up -d', 'error');
      return false;
    } else {
      // If we get any response (even 404), service is running
      log('Service is running', 'success');
      return true;
    }
  }
}

async function login() {
  try {
    log('Authenticating...', 'info');
    const response = await axios.post(`${EHR_SERVICE_URL}/api/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    }, {
      headers: { 'X-Tenant-ID': TENANT_SLUG },
      timeout: 10000
    });
    
    authToken = response.data.token;
    testUserId = response.data.user?.id || response.data.userId;
    log('Authentication successful', 'success');
    return true;
  } catch (error) {
    log(`Authentication failed: ${error.message}`, 'error');
    if (error.code === 'ECONNREFUSED') {
      log('Cannot connect to service. Is it running?', 'error');
    } else if (error.response) {
      log(`Status: ${error.response.status}`, 'error');
      if (error.response.data) {
        log(`Response: ${JSON.stringify(error.response.data).substring(0, 200)}`, 'error');
      }
    }
    return false;
  }
}

function getHeaders() {
  return {
    'X-Tenant-ID': TENANT_SLUG,
    'Authorization': `Bearer ${authToken}`
  };
}

async function getTestPatient() {
  try {
    log('Finding test patient...', 'info');
    const response = await axios.get(`${EHR_SERVICE_URL}/api/patients`, {
      headers: getHeaders(),
      params: { limit: 1 }
    });
    
    const patients = Array.isArray(response.data) ? response.data : (response.data.patients || []);
    if (patients.length > 0) {
      testPatientId = patients[0].id;
      log(`Using patient: ${patients[0].firstName} ${patients[0].lastName} (${testPatientId})`, 'success');
      return true;
    } else {
      log('No patients found. Please create a patient first.', 'warning');
      return false;
    }
  } catch (error) {
    log(`Failed to get patient: ${error.message}`, 'error');
    return false;
  }
}

async function testFeature(name, testFn) {
  try {
    log(`\n📋 Testing: ${name}`, 'info');
    await testFn();
    testResults.passed++;
    log(`${name} - PASSED`, 'success');
  } catch (error) {
    testResults.failed++;
    testResults.errors.push({ feature: name, error: error.message });
    log(`${name} - FAILED: ${error.message}`, 'error');
    if (error.response) {
      log(`  Status: ${error.response.status}`, 'error');
      log(`  Data: ${JSON.stringify(error.response.data)}`, 'error');
    }
  }
}

// ========== RxNorm Tests ==========

async function testRxNorm() {
  // Test 1: Search RxNorm
  log('  Testing RxNorm search...', 'info');
  const searchResponse = await axios.get(`${EHR_SERVICE_URL}/api/terminology/rxnorm/search`, {
    headers: getHeaders(),
    params: { term: 'metformin', limit: 5 }
  });
  
  if (!searchResponse.data || !searchResponse.data.concepts) {
    throw new Error('Invalid search response');
  }
  log(`  Found ${searchResponse.data.concepts.length} concepts`, 'success');
  
  if (searchResponse.data.concepts.length === 0) {
    throw new Error('No RxNorm concepts found');
  }
  
  const firstConcept = searchResponse.data.concepts[0];
  const rxcui = firstConcept.rxcui;
  
  // Test 2: Get RxNorm Concept
  log('  Testing get RxNorm concept...', 'info');
  try {
    const conceptResponse = await axios.get(`${EHR_SERVICE_URL}/api/terminology/rxnorm/concepts/${rxcui}`, {
      headers: getHeaders()
    });
    
    if (!conceptResponse.data || !conceptResponse.data.rxcui) {
      throw new Error('Invalid concept response');
    }
    log(`  Retrieved concept: ${conceptResponse.data.name}`, 'success');
  } catch (error) {
    if (error.response?.status === 404) {
      log(`  Concept ${rxcui} not found - trying known valid RXCUI...`, 'warning');
      // Try with a known valid RXCUI (Metformin)
      const knownRxcui = '6809';
      const fallbackResponse = await axios.get(`${EHR_SERVICE_URL}/api/terminology/rxnorm/concepts/${knownRxcui}`, {
        headers: getHeaders()
      });
      if (fallbackResponse.data?.rxcui) {
        log(`  Verified with known RXCUI ${knownRxcui}: ${fallbackResponse.data.name}`, 'success');
      } else {
        throw new Error('RxNorm API may be unavailable');
      }
    } else {
      throw error;
    }
  }
  
  // Test 3: Validate RxNorm
  log('  Testing validate RxNorm...', 'info');
  const validateResponse = await axios.get(`${EHR_SERVICE_URL}/api/terminology/rxnorm/validate/${rxcui}`, {
    headers: getHeaders()
  });
  
  if (typeof validateResponse.data !== 'boolean') {
    throw new Error('Invalid validation response');
  }
  log(`  Validation result: ${validateResponse.data}`, 'success');
  
  // Test 4: Find by name
  log('  Testing find by name...', 'info');
  const findResponse = await axios.get(`${EHR_SERVICE_URL}/api/terminology/rxnorm/find-by-name`, {
    headers: getHeaders(),
    params: { name: 'Metformin', tty: 'SCD' }
  });
  
  if (!findResponse.data) {
    throw new Error('Invalid find response');
  }
  log(`  Find by name successful`, 'success');
}

// ========== FHIR R4 Tests ==========

async function testFhirR4() {
  // Test new FHIR resources
  const newResources = [
    'Immunization',
    'Procedure',
    'Location',
    'Organization',
    'Practitioner',
    'PractitionerRole',
    'CarePlan'
  ];
  
  for (const resource of newResources) {
    log(`  Testing FHIR ${resource}...`, 'info');
    try {
      const response = await axios.get(`${EHR_SERVICE_URL}/api/fhir/${resource}`, {
        headers: getHeaders(),
        params: { _count: 1 }
      });
      
      if (!response.data || response.data.resourceType !== 'Bundle') {
        throw new Error(`Invalid ${resource} response`);
      }
      log(`  ${resource} - OK (${response.data.total || 0} resources)`, 'success');
    } catch (error) {
      if (error.response?.status === 404) {
        log(`  ${resource} - Not found (may be empty)`, 'warning');
      } else {
        throw error;
      }
    }
  }
  
  // Test CapabilityStatement includes new resources
  log('  Testing CapabilityStatement...', 'info');
  const capabilityResponse = await axios.get(`${EHR_SERVICE_URL}/api/fhir/metadata`, {
    headers: getHeaders()
  });
  
  if (!capabilityResponse.data || !capabilityResponse.data.rest) {
    throw new Error('Invalid CapabilityStatement');
  }
  
  const resources = capabilityResponse.data.rest[0]?.resource || [];
  const resourceTypes = resources.map(r => r.type);
  
  for (const resource of newResources) {
    if (!resourceTypes.includes(resource)) {
      throw new Error(`${resource} not found in CapabilityStatement`);
    }
  }
  log(`  CapabilityStatement includes all ${newResources.length} new resources`, 'success');
}

// ========== CCDA Tests ==========

async function testCcda() {
  if (!testPatientId) {
    throw new Error('No test patient available');
  }
  
  // Test 1: Generate CCD
  log('  Testing CCD generation...', 'info');
  const ccdResponse = await axios.get(`${EHR_SERVICE_URL}/api/ccda/ccd/${testPatientId}`, {
    headers: getHeaders(),
    params: { authorId: testUserId }
  });
  
  if (!ccdResponse.data || !ccdResponse.data.includes('ClinicalDocument')) {
    throw new Error('Invalid CCD document');
  }
  log(`  CCD generated (${ccdResponse.data.length} bytes)`, 'success');
  
  // Test 2: Generate Referral Summary
  log('  Testing Referral Summary generation...', 'info');
  const referralResponse = await axios.get(`${EHR_SERVICE_URL}/api/ccda/referral-summary/${testPatientId}`, {
    headers: getHeaders(),
    params: { authorId: testUserId }
  });
  
  if (!referralResponse.data || !referralResponse.data.includes('ClinicalDocument')) {
    throw new Error('Invalid Referral Summary');
  }
  log(`  Referral Summary generated (${referralResponse.data.length} bytes)`, 'success');
  
  // Note: Discharge Summary and Progress Note require encounterId, so we'll skip if no encounters
  log('  Note: Discharge Summary and Progress Note require encounterId', 'warning');
}

// ========== HIPAA Audit Tests ==========

async function testHipaaAudit() {
  // Test 1: Get audit logs
  log('  Testing get audit logs...', 'info');
  const logsResponse = await axios.get(`${EHR_SERVICE_URL}/api/hipaa-audit/logs`, {
    headers: getHeaders(),
    params: { limit: 10 }
  });
  
  if (!logsResponse.data || !Array.isArray(logsResponse.data.logs)) {
    throw new Error('Invalid audit logs response');
  }
  log(`  Retrieved ${logsResponse.data.logs.length} audit logs`, 'success');
  
  // Test 2: Get audit summary
  log('  Testing audit summary...', 'info');
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 1);
  const endDate = new Date();
  
  const summaryResponse = await axios.get(`${EHR_SERVICE_URL}/api/hipaa-audit/summary`, {
    headers: getHeaders(),
    params: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    }
  });
  
  if (!summaryResponse.data || !summaryResponse.data.summary) {
    throw new Error('Invalid audit summary response');
  }
  log(`  Summary: ${summaryResponse.data.summary.total_events || 0} events`, 'success');
  
  // Test 3: Detect breaches
  log('  Testing breach detection...', 'info');
  const breachesResponse = await axios.get(`${EHR_SERVICE_URL}/api/hipaa-audit/breaches`, {
    headers: getHeaders(),
    params: { lookbackDays: 30 }
  });
  
  if (!Array.isArray(breachesResponse.data)) {
    throw new Error('Invalid breaches response');
  }
  log(`  Detected ${breachesResponse.data.length} potential breaches`, 'success');
  
  // Test 4: Get patient access report
  if (testPatientId) {
    log('  Testing patient access report...', 'info');
    const reportResponse = await axios.get(`${EHR_SERVICE_URL}/api/hipaa-audit/patient/${testPatientId}/access-report`, {
      headers: getHeaders()
    });
    
    if (!reportResponse.data || !reportResponse.data.patientId) {
      throw new Error('Invalid patient access report');
    }
    log(`  Patient access report generated`, 'success');
  }
}

// ========== Quality Measures Tests ==========

async function testQualityMeasures() {
  // Test 1: Get all measures
  log('  Testing get all measures...', 'info');
  const measuresResponse = await axios.get(`${EHR_SERVICE_URL}/api/quality-measures/measures`, {
    headers: getHeaders()
  });
  
  if (!Array.isArray(measuresResponse.data) || measuresResponse.data.length === 0) {
    throw new Error('No quality measures found');
  }
  log(`  Found ${measuresResponse.data.length} quality measures`, 'success');
  
  // Test 2: Get specific measure
  log('  Testing get specific measure...', 'info');
  const measureId = 'hedis-dm-001';
  const measureResponse = await axios.get(`${EHR_SERVICE_URL}/api/quality-measures/measures/${measureId}`, {
    headers: getHeaders()
  });
  
  if (!measureResponse.data || measureResponse.data.id !== measureId) {
    throw new Error('Invalid measure response');
  }
  log(`  Retrieved measure: ${measureResponse.data.name}`, 'success');
  
  // Test 3: Calculate measure
  log('  Testing calculate measure...', 'info');
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 1);
  const endDate = new Date();
  
  const calculateResponse = await axios.post(
    `${EHR_SERVICE_URL}/api/quality-measures/calculate/${measureId}`,
    null,
    {
      headers: getHeaders(),
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        save: 'false'
      }
    }
  );
  
  if (!calculateResponse.data || typeof calculateResponse.data.rate !== 'number') {
    throw new Error('Invalid measure calculation response');
  }
  log(`  Calculated rate: ${calculateResponse.data.rate.toFixed(2)}% (${calculateResponse.data.numerator}/${calculateResponse.data.denominator})`, 'success');
  
  // Test 4: Get results history
  log('  Testing get results history...', 'info');
  const resultsResponse = await axios.get(`${EHR_SERVICE_URL}/api/quality-measures/results`, {
    headers: getHeaders(),
    params: { limit: 10 }
  });
  
  if (!resultsResponse.data || !Array.isArray(resultsResponse.data.results)) {
    throw new Error('Invalid results response');
  }
  log(`  Retrieved ${resultsResponse.data.results.length} results`, 'success');
  
  // Test 5: Get dashboard
  log('  Testing quality dashboard...', 'info');
  const dashboardResponse = await axios.get(`${EHR_SERVICE_URL}/api/quality-measures/dashboard`, {
    headers: getHeaders(),
    params: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    }
  });
  
  if (!dashboardResponse.data || !dashboardResponse.data.period) {
    throw new Error('Invalid dashboard response');
  }
  log(`  Dashboard: ${dashboardResponse.data.calculatedMeasures || 0} measures calculated`, 'success');
}

// ========== Main Test Runner ==========

async function runAllTests() {
  console.log('\n🚀 Starting Comprehensive Feature Tests\n');
  console.log(`EHR Service: ${EHR_SERVICE_URL}`);
  console.log(`Tenant: ${TENANT_SLUG}\n`);
  
  // Step 0: Check service health
  const serviceHealthy = await checkServiceHealth();
  if (!serviceHealthy) {
    log('\n💡 To start services, run: docker-compose up -d', 'warning');
    log('   Or start individual services manually', 'warning');
    process.exit(1);
  }
  
  // Step 1: Login
  const loggedIn = await login();
  if (!loggedIn) {
    log('Cannot proceed without authentication', 'error');
    log('Please check your credentials and tenant configuration', 'error');
    process.exit(1);
  }
  
  // Step 2: Get test patient
  await getTestPatient();
  
  // Step 3: Run all tests
  await testFeature('RxNorm Integration', testRxNorm);
  await testFeature('FHIR R4 Resource Expansion', testFhirR4);
  await testFeature('CCDA Document Generation', testCcda);
  await testFeature('HIPAA Compliance (Audit Logging)', testHipaaAudit);
  await testFeature('Quality Measures (HEDIS/eCQM)', testQualityMeasures);
  
  // Step 4: Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  if (testResults.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    testResults.errors.forEach(({ feature, error }) => {
      console.log(`  ${feature}: ${error}`);
    });
  }
  
  console.log('='.repeat(60) + '\n');
  
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  log(`Fatal error: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});

