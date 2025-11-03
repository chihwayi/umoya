/**
 * Setup test patient appointment and lab results for CDSS testing
 */

const axios = require('axios');

const EHR_API_URL = 'http://localhost:3013/api';
const TENANT_SLUG = 'bulawayo-general';
const PATIENT_ID = '4af57d66-a8f3-4778-8bfe-659043341bcc'; // Kwame Asante

async function setupTestPatient() {
  try {
    console.log('🚀 Setting up test patient appointment and lab results...\n');

    // Login as admin
    const loginResponse = await axios.post(`${EHR_API_URL}/auth/login`, {
      email: 'admin@bulawayo-general.co.zw',
      password: 'Password1#'
    }, {
      headers: { 'X-Tenant-ID': TENANT_SLUG }
    });
    
    const token = loginResponse.data.token;
    const headers = {
      'X-Tenant-ID': TENANT_SLUG,
      'Authorization': `Bearer ${token}`
    };

    // Find a doctor
    const doctorsResponse = await axios.get(`${EHR_API_URL}/users?role=doctor`, { headers });
    const doctors = Array.isArray(doctorsResponse.data) ? doctorsResponse.data : (doctorsResponse.data.users || []);
    const doctor = doctors.find(d => d.email?.includes('moyo')) || doctors[0];
    
    if (!doctor) {
      console.error('❌ No doctor found! Please create a doctor first.');
      return;
    }
    
    console.log(`✅ Using doctor: ${doctor.firstName} ${doctor.lastName} (${doctor.email})\n`);

    // Create today's appointment - try different times
    const today = new Date();
    today.setHours(14, 30, 0, 0); // 2:30 PM
    
    console.log('1️⃣ Creating appointment for today...');
    const apptResponse = await axios.post(`${EHR_API_URL}/appointments`, {
      patientId: PATIENT_ID,
      doctorId: doctor.id,
      appointmentDate: today.toISOString(),
      appointmentType: 'follow-up',
      reason: 'Comprehensive CDSS testing - multiple chronic conditions, abnormal labs, medication review needed'
    }, { headers });
    
    const appointmentId = apptResponse.data.appointment?.id || apptResponse.data.id;
    console.log(`✅ Appointment created: ${appointmentId}\n`);

    // Start the appointment
    console.log('2️⃣ Starting appointment...');
    await axios.put(`${EHR_API_URL}/appointments/${appointmentId}/start`, {}, { headers });
    console.log('✅ Appointment started\n');

    // Create a lab order with results
    console.log('3️⃣ Creating lab order with results...');
    const labOrderResponse = await axios.post(`${EHR_API_URL}/lab-orders`, {
      patientId: PATIENT_ID,
      orderingProviderId: doctor.id,
      tests: [
        { testCode: 'CREAT', testName: 'Creatinine', category: 'chemistry', specimenType: 'serum' },
        { testCode: 'EGFR', testName: 'eGFR', category: 'chemistry', specimenType: 'calculated' },
        { testCode: 'K', testName: 'Potassium', category: 'chemistry', specimenType: 'serum' },
        { testCode: 'NA', testName: 'Sodium', category: 'chemistry', specimenType: 'serum' },
        { testCode: 'GLUC', testName: 'Glucose', category: 'chemistry', specimenType: 'serum' },
        { testCode: 'HBA1C', testName: 'HbA1c', category: 'chemistry', specimenType: 'whole blood' },
        { testCode: 'INR', testName: 'INR', category: 'coagulation', specimenType: 'plasma' },
        { testCode: 'HGB', testName: 'Hemoglobin', category: 'hematology', specimenType: 'whole blood' },
        { testCode: 'PLT', testName: 'Platelet Count', category: 'hematology', specimenType: 'whole blood' },
        { testCode: 'WBC', testName: 'White Blood Cell Count', category: 'hematology', specimenType: 'whole blood' }
      ],
      priority: 'urgent',
      clinicalInfo: 'CDSS testing patient - multiple abnormal values expected'
    }, { headers });

    const labOrderId = labOrderResponse.data.labOrder?.id || labOrderResponse.data.id;
    console.log(`✅ Lab order created: ${labOrderId}\n`);

    // Submit lab results with abnormal values
    console.log('4️⃣ Submitting lab results with abnormal values...');
    await axios.put(`${EHR_API_URL}/lab-orders/${labOrderId}/submit-results`, {
      results: [
        { testCode: 'CREAT', testName: 'Creatinine', value: '1.8', unit: 'mg/dL', referenceRange: '0.6-1.2', flag: 'high', resultDate: new Date().toISOString(), performedBy: doctor.id },
        { testCode: 'EGFR', testName: 'eGFR', value: '35', unit: 'mL/min/1.73m²', referenceRange: '90-120', flag: 'low', resultDate: new Date().toISOString(), performedBy: doctor.id },
        { testCode: 'K', testName: 'Potassium', value: '5.8', unit: 'mEq/L', referenceRange: '3.5-5.0', flag: 'critical', resultDate: new Date().toISOString(), performedBy: doctor.id },
        { testCode: 'NA', testName: 'Sodium', value: '142', unit: 'mEq/L', referenceRange: '136-145', flag: 'normal', resultDate: new Date().toISOString(), performedBy: doctor.id },
        { testCode: 'GLUC', testName: 'Glucose', value: '185', unit: 'mg/dL', referenceRange: '70-100', flag: 'high', resultDate: new Date().toISOString(), performedBy: doctor.id },
        { testCode: 'HBA1C', testName: 'HbA1c', value: '8.2', unit: '%', referenceRange: '4.0-5.7', flag: 'high', resultDate: new Date().toISOString(), performedBy: doctor.id },
        { testCode: 'INR', testName: 'INR', value: '3.5', unit: 'ratio', referenceRange: '0.9-1.1', flag: 'critical', resultDate: new Date().toISOString(), performedBy: doctor.id },
        { testCode: 'HGB', testName: 'Hemoglobin', value: '11.5', unit: 'g/dL', referenceRange: '12.0-16.0', flag: 'low', resultDate: new Date().toISOString(), performedBy: doctor.id },
        { testCode: 'PLT', testName: 'Platelet Count', value: '320', unit: '×10³/μL', referenceRange: '150-450', flag: 'normal', resultDate: new Date().toISOString(), performedBy: doctor.id },
        { testCode: 'WBC', testName: 'White Blood Cell Count', value: '8.5', unit: '×10³/μL', referenceRange: '4.5-11.0', flag: 'normal', resultDate: new Date().toISOString(), performedBy: doctor.id }
      ],
      interpretation: 'Multiple abnormal values detected - requires CDSS analysis'
    }, { headers });
    
    console.log('✅ Lab results submitted with abnormal values\n');

    // Add current vitals
    console.log('5️⃣ Adding current vitals...');
    await axios.post(`${EHR_API_URL}/vitals`, {
      patientId: PATIENT_ID,
      bloodPressure: '155/98',
      heartRate: 92,
      temperature: 37.2,
      weight: 75.5,
      oxygenSaturation: 95,
      recordedAt: new Date().toISOString()
    }, { headers });
    console.log('✅ Current vitals added\n');

    console.log('\n✅✅✅ SETUP COMPLETE! ✅✅✅\n');
    console.log('📋 Summary:');
    console.log(`   Patient: Kwame Asante (ID: ${PATIENT_ID.substring(0, 8)}...)`);
    console.log(`   Doctor: ${doctor.firstName} ${doctor.lastName} (${doctor.email})`);
    console.log(`   Appointment: ${appointmentId.substring(0, 8)}... (STARTED)`);
    console.log(`   Lab Order: ${labOrderId.substring(0, 8)}... (COMPLETED with results)\n`);
    
    console.log('🎯 To Test CDSS Features:\n');
    console.log(`   1. Login as doctor: ${doctor.email}`);
    console.log('      Password: Password1#\n');
    console.log('   2. Go to Doctor Dashboard');
    console.log('   3. You should see "Kwame Asante" in Current Appointment');
    console.log('   4. Click "Lab Results" button to see lab results');
    console.log('   5. The lab results show CRITICAL and HIGH values that trigger CDSS alerts');
    console.log('   6. Click "Refresh" on Risk Assessment to see CDSS analysis\n');
    
    console.log('📡 Test CDSS Lab Interpreter:');
    console.log('   The lab results include:');
    console.log('   - CRITICAL: Potassium 5.8 (hyperkalemia), INR 3.5 (over-anticoagulated)');
    console.log('   - HIGH: Creatinine 1.8, Glucose 185, HbA1c 8.2');
    console.log('   - LOW: eGFR 35, Hemoglobin 11.5\n');
    console.log('   You can call the CDSS API to interpret these:');
    console.log('   POST /api/cdss/labs/interpret\n');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('   Full error:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

setupTestPatient();

