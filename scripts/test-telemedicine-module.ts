/**
 * Comprehensive Test Script for Telemedicine Module (Sprint 9)
 * Tests all telemedicine functionality including consultations, remote monitoring, consents, and digital prescriptions
 */

import axios from 'axios';

const BASE_URL = process.env.EHR_API_URL || 'http://localhost:3013/api';
const TENANT_SLUG = process.env.TENANT_SLUG || 'bulawayo-general';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@bulawayo-general.co.zw';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Password1#';
const DOCTOR_EMAIL = process.env.DOCTOR_EMAIL || 'doctor@bulawayo-general.co.zw';
const DOCTOR_PASSWORD = process.env.DOCTOR_PASSWORD || 'doctor123';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message?: string;
  data?: any;
}

const results: TestResult[] = [];

// Helper function to log test results
function logResult(result: TestResult) {
  results.push(result);
  const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} ${result.name}: ${result.status}`);
  if (result.message) {
    console.log(`   ${result.message}`);
  }
}

// Helper function to make authenticated requests
async function makeRequest(method: string, endpoint: string, token: string, data?: any) {
  try {
    const config: any = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status,
    };
  }
}

// Test authentication
async function testLogin(email: string, password: string): Promise<string | null> {
  try {
    const response = await axios.post(
      `${BASE_URL}/auth/login`,
      {
        email,
        password,
      },
      {
        headers: { 'X-Tenant-ID': TENANT_SLUG },
      },
    );

    if (response.data?.token) {
      return response.data.token;
    }
    if (response.data?.access_token) {
      return response.data.access_token;
    }
    return null;
  } catch (error: any) {
    console.error(`Login failed: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

// Test consultation creation
async function testCreateConsultation(token: string, patientId: string, doctorId: string) {
  const consultationData = {
    patientId,
    doctorId,
    consultationType: 'video',
    scheduledStartTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
    notes: 'Test telemedicine consultation',
  };

  const result = await makeRequest('POST', '/telemedicine/consultations', token, consultationData);

  if (result.success && result.data) {
    logResult({
      name: 'Create Consultation',
      status: 'PASS',
      message: `Consultation created: ${result.data.id}`,
      data: result.data,
    });
    return result.data;
  } else {
    logResult({
      name: 'Create Consultation',
      status: 'FAIL',
      message: result.error?.message || 'Failed to create consultation',
    });
    return null;
  }
}

// Test get consultations
async function testGetConsultations(token: string) {
  const result = await makeRequest('GET', '/telemedicine/consultations?page=1&limit=10', token);

  if (result.success && result.data) {
    logResult({
      name: 'Get Consultations',
      status: 'PASS',
      message: `Retrieved ${result.data.consultations?.length || result.data.length || 0} consultations`,
      data: result.data,
    });
    return result.data.consultations || result.data || [];
  } else {
    logResult({
      name: 'Get Consultations',
      status: 'FAIL',
      message: result.error?.message || 'Failed to get consultations',
    });
    return [];
  }
}

// Test get consultation by ID
async function testGetConsultation(token: string, consultationId: string) {
  const result = await makeRequest('GET', `/telemedicine/consultations/${consultationId}`, token);

  if (result.success && result.data) {
    logResult({
      name: 'Get Consultation by ID',
      status: 'PASS',
      message: `Retrieved consultation: ${consultationId}`,
      data: result.data,
    });
    return result.data;
  } else {
    logResult({
      name: 'Get Consultation by ID',
      status: 'FAIL',
      message: result.error?.message || 'Failed to get consultation',
    });
    return null;
  }
}

// Test join consultation
async function testJoinConsultation(token: string, consultationId: string, role: 'patient' | 'doctor', userId: string) {
  const result = await makeRequest('POST', `/telemedicine/consultations/${consultationId}/join`, token, {
    userId,
    role,
  });

  if (result.success && result.data) {
    logResult({
      name: `Join Consultation (${role})`,
      status: 'PASS',
      message: `Successfully joined as ${role}`,
      data: result.data,
    });
    return result.data;
  } else {
    logResult({
      name: `Join Consultation (${role})`,
      status: 'FAIL',
      message: result.error?.message || `Failed to join as ${role}`,
    });
    return null;
  }
}

// Test get meeting URL
async function testGetMeetingUrl(token: string, consultationId: string) {
  const result = await makeRequest('GET', `/telemedicine/consultations/${consultationId}/meeting-url`, token);

  if (result.success && result.data) {
    logResult({
      name: 'Get Meeting URL',
      status: 'PASS',
      message: `Meeting URL: ${result.data.meetingUrl || 'N/A'}`,
      data: result.data,
    });
    return result.data;
  } else {
    logResult({
      name: 'Get Meeting URL',
      status: 'FAIL',
      message: result.error?.message || 'Failed to get meeting URL',
    });
    return null;
  }
}

// Test record technical issue
async function testRecordTechnicalIssue(token: string, consultationId: string) {
  const result = await makeRequest('POST', `/telemedicine/consultations/${consultationId}/technical-issue`, token, {
    consultationId,
    logType: 'connection_issue',
    severity: 'medium',
    description: 'Test technical issue - connection dropped briefly',
  });

  if (result.success && result.data) {
    logResult({
      name: 'Record Technical Issue',
      status: 'PASS',
      message: 'Technical issue logged successfully',
      data: result.data,
    });
    return result.data;
  } else {
    logResult({
      name: 'Record Technical Issue',
      status: 'FAIL',
      message: result.error?.message || 'Failed to record technical issue',
    });
    return null;
  }
}

// Test end consultation
async function testEndConsultation(token: string, consultationId: string) {
  const result = await makeRequest('POST', `/telemedicine/consultations/${consultationId}/end`, token, {});

  if (result.success && result.data) {
    logResult({
      name: 'End Consultation',
      status: 'PASS',
      message: `Consultation ended. Duration: ${result.data.duration_minutes || 'N/A'} minutes`,
      data: result.data,
    });
    return result.data;
  } else {
    logResult({
      name: 'End Consultation',
      status: 'FAIL',
      message: result.error?.message || 'Failed to end consultation',
    });
    return null;
  }
}

// Test record satisfaction
async function testRecordSatisfaction(token: string, consultationId: string) {
  const result = await makeRequest('POST', `/telemedicine/consultations/${consultationId}/satisfaction`, token, {
    rating: 5,
    feedback: 'Excellent consultation experience',
  });

  if (result.success && result.data) {
    logResult({
      name: 'Record Satisfaction',
      status: 'PASS',
      message: 'Satisfaction recorded successfully',
      data: result.data,
    });
    return result.data;
  } else {
    logResult({
      name: 'Record Satisfaction',
      status: 'FAIL',
      message: result.error?.message || 'Failed to record satisfaction',
    });
    return null;
  }
}

// Test remote monitoring - record reading
async function testRecordMonitoringReading(token: string, patientId: string) {
  const readingData = {
    patientId,
    monitoringType: 'blood_pressure',
    readingValue: 120,
    readingUnit: 'mmHg',
    deviceName: 'Omron BP Monitor',
    deviceModel: 'HEM-7130',
    deviceSynced: false,
    notes: 'Test reading',
  };

  const result = await makeRequest('POST', '/telemedicine/monitoring/readings', token, readingData);

  if (result.success && result.data) {
    logResult({
      name: 'Record Monitoring Reading',
      status: 'PASS',
      message: `Reading recorded: ${readingData.readingValue} ${readingData.readingUnit}`,
      data: result.data,
    });
    return result.data;
  } else {
    logResult({
      name: 'Record Monitoring Reading',
      status: 'FAIL',
      message: result.error?.message || 'Failed to record reading',
    });
    return null;
  }
}

// Test get monitoring readings
async function testGetMonitoringReadings(token: string, patientId: string) {
  const result = await makeRequest('GET', `/telemedicine/monitoring/readings?patientId=${patientId}&page=1&limit=10`, token);

  if (result.success && result.data) {
    logResult({
      name: 'Get Monitoring Readings',
      status: 'PASS',
      message: `Retrieved ${result.data.readings?.length || result.data.length || 0} readings`,
      data: result.data,
    });
    return result.data;
  } else {
    logResult({
      name: 'Get Monitoring Readings',
      status: 'FAIL',
      message: result.error?.message || 'Failed to get readings',
    });
    return null;
  }
}

// Test get monitoring trends
async function testGetMonitoringTrends(token: string, patientId: string) {
  const result = await makeRequest(
    'GET',
    `/telemedicine/monitoring/trends?patientId=${patientId}&monitoringType=blood_pressure&period=30d`,
    token,
  );

  if (result.success && result.data) {
    logResult({
      name: 'Get Monitoring Trends',
      status: 'PASS',
      message: `Retrieved ${result.data.length || 0} trend data points`,
      data: result.data,
    });
    return result.data;
  } else {
    logResult({
      name: 'Get Monitoring Trends',
      status: 'FAIL',
      message: result.error?.message || 'Failed to get trends',
    });
    return null;
  }
}

// Test grant consent
async function testGrantConsent(token: string, patientId: string) {
  const consentData = {
    patientId,
    consentType: 'general_telehealth',
    consentStatus: 'granted',
    notes: 'Test consent grant',
  };

  const result = await makeRequest('POST', '/telemedicine/consents', token, consentData);

  if (result.success && result.data) {
    logResult({
      name: 'Grant Consent',
      status: 'PASS',
      message: `Consent granted: ${result.data.consent_type}`,
      data: result.data,
    });
    return result.data;
  } else {
    // If consent already exists, that's expected behavior - mark as SKIP
    if (result.error?.message?.includes('already exists')) {
      logResult({
        name: 'Grant Consent',
        status: 'SKIP',
        message: 'Consent already exists (expected behavior)',
      });
      return null;
    }
    logResult({
      name: 'Grant Consent',
      status: 'FAIL',
      message: result.error?.message || 'Failed to grant consent',
    });
    return null;
  }
}

// Test check consent
async function testCheckConsent(token: string, patientId: string) {
  const result = await makeRequest(
    'GET',
    `/telemedicine/consents/check?patientId=${patientId}&consentType=general_telehealth`,
    token,
  );

  if (result.success && result.data) {
    logResult({
      name: 'Check Consent',
      status: 'PASS',
      message: `Has consent: ${result.data.hasConsent}`,
      data: result.data,
    });
    return result.data;
  } else {
    logResult({
      name: 'Check Consent',
      status: 'FAIL',
      message: result.error?.message || 'Failed to check consent',
    });
    return null;
  }
}

// Test get consent history
async function testGetConsentHistory(token: string, patientId: string) {
  const result = await makeRequest('GET', `/telemedicine/consents?patientId=${patientId}`, token);

  if (result.success && result.data) {
    logResult({
      name: 'Get Consent History',
      status: 'PASS',
      message: `Retrieved ${result.data.length || 0} consent records`,
      data: result.data,
    });
    return result.data;
  } else {
    logResult({
      name: 'Get Consent History',
      status: 'FAIL',
      message: result.error?.message || 'Failed to get consent history',
    });
    return null;
  }
}

// Test validate consent for consultation
async function testValidateConsent(token: string, patientId: string, consultationId: string) {
  const result = await makeRequest('POST', '/telemedicine/consents/validate', token, {
    patientId,
    consultationId,
  });

  if (result.success && result.data) {
    logResult({
      name: 'Validate Consent',
      status: 'PASS',
      message: `Consent valid: ${result.data.valid}`,
      data: result.data,
    });
    return result.data;
  } else {
    logResult({
      name: 'Validate Consent',
      status: 'FAIL',
      message: result.error?.message || 'Failed to validate consent',
    });
    return null;
  }
}

// Test create digital prescription
async function testCreateDigitalPrescription(token: string, consultationId: string) {
  const prescriptionData = {
    consultationId,
    signatureMethod: 'click_to_sign',
  };

  const result = await makeRequest('POST', '/telemedicine/prescriptions', token, prescriptionData);

  if (result.success && result.data) {
    logResult({
      name: 'Create Digital Prescription',
      status: 'PASS',
      message: `Prescription created: ${result.data.id}`,
      data: result.data,
    });
    return result.data;
  } else {
    logResult({
      name: 'Create Digital Prescription',
      status: 'FAIL',
      message: result.error?.message || 'Failed to create prescription',
    });
    return null;
  }
}

// Test sign prescription
async function testSignPrescription(token: string, prescriptionId: string, role: 'patient' | 'doctor') {
  const signatureData = {
    signature: `base64_signature_${Date.now()}`,
    role,
    signatureMethod: 'click_to_sign',
  };

  const result = await makeRequest('POST', `/telemedicine/prescriptions/${prescriptionId}/sign`, token, signatureData);

  if (result.success && result.data) {
    logResult({
      name: `Sign Prescription (${role})`,
      status: 'PASS',
      message: `Prescription signed by ${role}`,
      data: result.data,
    });
    return result.data;
  } else {
    logResult({
      name: `Sign Prescription (${role})`,
      status: 'FAIL',
      message: result.error?.message || `Failed to sign as ${role}`,
    });
    return null;
  }
}

// Test validate prescription
async function testValidatePrescription(token: string, prescriptionId: string) {
  const result = await makeRequest('GET', `/telemedicine/prescriptions/${prescriptionId}/validate`, token);

  if (result.success && result.data) {
    logResult({
      name: 'Validate Prescription',
      status: 'PASS',
      message: `Prescription valid: ${result.data.isValid}`,
      data: result.data,
    });
    return result.data;
  } else {
    logResult({
      name: 'Validate Prescription',
      status: 'FAIL',
      message: result.error?.message || 'Failed to validate prescription',
    });
    return null;
  }
}

// Test get patient
async function getPatient(token: string): Promise<string | null> {
  try {
    const response = await axios.get(`${BASE_URL}/patients`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${token}`,
      },
      params: { page: 1, limit: 1 },
    });

    const patients = response.data?.patients || response.data?.data || response.data || [];
    if (patients.length > 0) {
      return patients[0].id;
    }
    return null;
  } catch (error: any) {
    console.error(`Failed to get patient: ${error.message}`);
    return null;
  }
}

// Test get doctor
async function getDoctor(token: string): Promise<string | null> {
  try {
    const response = await axios.get(`${BASE_URL}/users`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${token}`,
      },
      params: { role: 'doctor', page: 1, limit: 1 },
    });

    const doctors = response.data?.users || response.data?.data || response.data || [];
    if (doctors.length > 0) {
      return doctors[0].id;
    }
    return null;
  } catch (error: any) {
    console.error(`Failed to get doctor: ${error.message}`);
    return null;
  }
}

// Main test runner
async function runTests() {
  console.log('🧪 Starting Telemedicine Module Tests');
  console.log('=====================================\n');

  // Login
  console.log('🔐 Authenticating...');
  const adminToken = await testLogin(ADMIN_EMAIL, ADMIN_PASSWORD);
  if (!adminToken) {
    console.error('❌ Failed to login as admin. Exiting.');
    process.exit(1);
  }
  logResult({ name: 'Admin Login', status: 'PASS', message: 'Logged in successfully' });

  const doctorToken = await testLogin(DOCTOR_EMAIL, DOCTOR_PASSWORD);
  if (!doctorToken) {
    console.log('⚠️  Doctor login failed, using admin token for doctor operations');
  } else {
    logResult({ name: 'Doctor Login', status: 'PASS', message: 'Logged in successfully' });
  }

  const token = doctorToken || adminToken;

  // Get patient and doctor IDs
  console.log('\n📋 Getting test data...');
  const patientId = await getPatient(token);
  const doctorId = await getDoctor(token);

  if (!patientId) {
    logResult({ name: 'Get Patient', status: 'FAIL', message: 'No patients found' });
    console.log('\n⚠️  Cannot proceed without a patient. Please create a patient first.');
    printSummary();
    process.exit(1);
  } else {
    logResult({ name: 'Get Patient', status: 'PASS', message: `Patient ID: ${patientId}` });
  }

  if (!doctorId) {
    logResult({ name: 'Get Doctor', status: 'FAIL', message: 'No doctors found' });
    console.log('\n⚠️  Cannot proceed without a doctor. Please create a doctor first.');
    printSummary();
    process.exit(1);
  } else {
    logResult({ name: 'Get Doctor', status: 'PASS', message: `Doctor ID: ${doctorId}` });
  }

  console.log('\n🏥 Testing Telemedicine Consultations...');
  console.log('----------------------------------------');

  // Test consultations
  const consultation = await testCreateConsultation(token, patientId, doctorId);
  if (!consultation) {
    console.log('\n⚠️  Cannot proceed without a consultation. Some tests will be skipped.');
    printSummary();
    process.exit(1);
  }

  const consultationId = consultation.id;
  await testGetConsultations(token);
  await testGetConsultation(token, consultationId);
  await testGetMeetingUrl(token, consultationId);
  await testJoinConsultation(token, consultationId, 'patient', patientId);
  await testJoinConsultation(token, consultationId, 'doctor', doctorId);
  await testRecordTechnicalIssue(token, consultationId);

  // Don't end consultation yet - we'll test satisfaction first
  // await testEndConsultation(token, consultationId);

  console.log('\n📊 Testing Remote Patient Monitoring...');
  console.log('--------------------------------------');

  // Test remote monitoring
  await testRecordMonitoringReading(token, patientId);
  await testGetMonitoringReadings(token, patientId);
  await testGetMonitoringTrends(token, patientId);

  console.log('\n📝 Testing Consent Management...');
  console.log('-------------------------------');

  // Test consents
  await testGrantConsent(token, patientId);
  await testCheckConsent(token, patientId);
  await testGetConsentHistory(token, patientId);
  if (consultationId) {
    await testValidateConsent(token, patientId, consultationId);
  }

  console.log('\n💊 Testing Digital Prescriptions...');
  console.log('-----------------------------------');

  // Test digital prescriptions
  if (consultationId) {
    const prescription = await testCreateDigitalPrescription(token, consultationId);
    if (prescription) {
      const prescriptionId = prescription.id;
      await testSignPrescription(token, prescriptionId, 'patient');
      await testSignPrescription(token, prescriptionId, 'doctor');
      await testValidatePrescription(token, prescriptionId);
    }
  }

  console.log('\n✅ Testing Consultation Completion...');
  console.log('------------------------------------');

  // End consultation and test satisfaction
  if (consultationId) {
    await testEndConsultation(token, consultationId);
    await testRecordSatisfaction(token, consultationId);
  }

  // Print summary
  printSummary();
}

function printSummary() {
  console.log('\n📊 Test Summary');
  console.log('===============');
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;

  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`📈 Total: ${results.length}`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results
      .filter((r) => r.status === 'FAIL')
      .forEach((r) => {
        console.log(`   - ${r.name}: ${r.message}`);
      });
  }

  console.log('\n✨ Test run completed!');
}

// Run tests
runTests().catch((error) => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});

