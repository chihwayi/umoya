#!/usr/bin/env node
/**
 * Setup Care Plan Test Scenario
 * Creates a patient, appointment, and vitals for Dr. Smith on December 2, 2025
 */

import 'dotenv/config';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API_BASE = 'http://localhost:3013/api';
const TENANT_SLUG = 'bulawayo-general';

// Nurse credentials to create patient and appointment
const NURSE = {
  email: 'nurse@bulawayo-general.co.zw',
  password: 'Password1#',
};

// Dr. Smith ID (we'll use this for the appointment)
const DR_SMITH_ID = 'f1777fa7-cf07-4c87-9c5e-4da405129512';

let authToken = '';
let drSmithId = '';
let patientId = '';
let appointmentId = '';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function authenticate() {
  log('\n🔐 Authenticating as Nurse...', colors.cyan);
  try {
    const response = await axios.post(`${API_BASE}/auth/login`, NURSE, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
      },
    });
    authToken = response.data.access_token || response.data.token;
    drSmithId = DR_SMITH_ID; // Use Dr. Smith's ID for the appointment
    log(`✅ Authenticated as Nurse! Will schedule appointment for Dr. Smith`, colors.green);
    return true;
  } catch (error: any) {
    log(`❌ Authentication failed: ${error.response?.data?.message || error.message}`, colors.yellow);
    return false;
  }
}

async function createPatient() {
  log('\n👤 Creating test patient...', colors.cyan);
  try {
    const patientData = {
      firstName: 'Sarah',
      lastName: 'Johnson',
      dateOfBirth: '1985-06-15',
      gender: 'female',
      phone: '+263 77 123 4567',
      email: 'sarah.johnson@example.com',
      address: '123 Main Street',
      city: 'Bulawayo',
      nationalId: 'BW123456789',
      medicalAidNumber: 'MA-2025-001',
      medicalAidProvider: 'CIMAS',
      emergencyContactName: 'John Johnson',
      emergencyContactPhone: '+263 77 999 8888',
      emergencyContactRelationship: 'Spouse',
    };

    const response = await axios.post(`${API_BASE}/patients`, patientData, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${authToken}`,
      },
    });

    patientId = response.data.id;
    log(`✅ Patient created: ${response.data.firstName} ${response.data.lastName} (ID: ${patientId})`, colors.green);
    return true;
  } catch (error: any) {
    log(`❌ Failed to create patient: ${error.response?.data?.message || error.message}`, colors.yellow);
    return false;
  }
}

async function createAppointment() {
  log('\n📅 Creating appointment for today (December 2, 2025)...', colors.cyan);
  try {
    const appointmentData = {
      patientId: patientId,
      doctorId: drSmithId,
      appointmentDate: '2025-12-02T10:00:00.000Z',
      appointmentType: 'follow-up',
      reason: 'Chronic disease management - Care plan review',
    };

    const response = await axios.post(`${API_BASE}/appointments`, appointmentData, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${authToken}`,
      },
    });

    appointmentId = response.data.id;
    log(`✅ Appointment created for 10:00 AM today (ID: ${appointmentId})`, colors.green);
    return true;
  } catch (error: any) {
    log(`❌ Failed to create appointment: ${error.response?.data?.message || error.message}`, colors.yellow);
    return false;
  }
}

async function recordVitals() {
  log('\n🩺 Recording vitals for patient...', colors.cyan);
  try {
    const vitalsData = {
      patientId: patientId,
      appointmentId: appointmentId,
      bloodPressureSystolic: 145,
      bloodPressureDiastolic: 92,
      heartRate: 78,
      temperature: 37.2,
      weight: 82.5,
      height: 170,
      oxygenSaturation: 98,
      respiratoryRate: 16,
      bloodGlucose: 8.5,
      recordedBy: drSmithId,
    };

    const response = await axios.post(`${API_BASE}/vitals`, vitalsData, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${authToken}`,
      },
    });

    log(`✅ Vitals recorded:`, colors.green);
    log(`   - Blood Pressure: 145/92 mmHg (elevated)`, colors.blue);
    log(`   - Blood Glucose: 8.5 mmol/L (elevated)`, colors.blue);
    log(`   - Heart Rate: 78 bpm`, colors.blue);
    log(`   - Temperature: 37.2°C`, colors.blue);
    log(`   - Weight: 82.5 kg`, colors.blue);
    log(`   - O2 Saturation: 98%`, colors.blue);
    return true;
  } catch (error: any) {
    log(`❌ Failed to record vitals: ${error.response?.data?.message || error.message}`, colors.yellow);
    return false;
  }
}

async function addProblemList() {
  log('\n📋 Adding diagnoses to problem list...', colors.cyan);
  try {
    // Add Type 2 Diabetes
    await axios.post(
      `${API_BASE}/patients/${patientId}/problems`,
      {
        problemName: 'Type 2 Diabetes Mellitus',
        snomedCode: '44054006',
        icd10Code: 'E11.9',
        status: 'active',
        severity: 'moderate',
        onsetDate: '2023-01-15',
        notes: 'Requires ongoing management and monitoring',
      },
      {
        headers: {
          'X-Tenant-ID': TENANT_SLUG,
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    // Add Hypertension
    await axios.post(
      `${API_BASE}/patients/${patientId}/problems`,
      {
        problemName: 'Essential Hypertension',
        snomedCode: '38341003',
        icd10Code: 'I10',
        status: 'active',
        severity: 'moderate',
        onsetDate: '2022-08-20',
        notes: 'Blood pressure control needed',
      },
      {
        headers: {
          'X-Tenant-ID': TENANT_SLUG,
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    log(`✅ Diagnoses added:`, colors.green);
    log(`   - Type 2 Diabetes Mellitus (E11.9)`, colors.blue);
    log(`   - Essential Hypertension (I10)`, colors.blue);
    return true;
  } catch (error: any) {
    log(`❌ Failed to add problems: ${error.response?.data?.message || error.message}`, colors.yellow);
    return false;
  }
}

async function main() {
  log('═══════════════════════════════════════════════════', colors.cyan);
  log('  🏥 Care Plan Test Scenario Setup', colors.cyan);
  log('═══════════════════════════════════════════════════', colors.cyan);

  // Step 1: Authenticate
  if (!(await authenticate())) {
    log('\n❌ Setup failed at authentication', colors.yellow);
    process.exit(1);
  }

  // Step 2: Create patient
  if (!(await createPatient())) {
    log('\n❌ Setup failed at patient creation', colors.yellow);
    process.exit(1);
  }

  // Step 3: Create appointment
  if (!(await createAppointment())) {
    log('\n❌ Setup failed at appointment creation', colors.yellow);
    process.exit(1);
  }

  // Step 4: Record vitals
  if (!(await recordVitals())) {
    log('\n❌ Setup failed at vitals recording', colors.yellow);
    process.exit(1);
  }

  // Step 5: Add problem list
  if (!(await addProblemList())) {
    log('\n❌ Setup failed at problem list', colors.yellow);
    process.exit(1);
  }

  // Summary
  log('\n═══════════════════════════════════════════════════', colors.cyan);
  log('  ✅ Setup Complete!', colors.green);
  log('═══════════════════════════════════════════════════', colors.cyan);
  log('\n📊 Test Scenario Created:', colors.cyan);
  log(`   👤 Patient: Sarah Johnson (38 years old, female)`, colors.blue);
  log(`   📅 Appointment: Today (Dec 2, 2025) at 10:00 AM`, colors.blue);
  log(`   🩺 Vitals: Recorded (elevated BP and glucose)`, colors.blue);
  log(`   📋 Diagnoses: Type 2 Diabetes + Hypertension`, colors.blue);
  log(`   👨‍⚕️ Doctor: Dr. Smith`, colors.blue);
  
  log('\n🎯 Next Steps:', colors.cyan);
  log('   1. Refresh your browser (Cmd+R or Ctrl+R)', colors.blue);
  log('   2. Click Menu (☰) → "Care Plans" 🎯', colors.blue);
  log('   3. System will auto-select Sarah Johnson', colors.blue);
  log('   4. Click "Templates" to see 4 pre-built templates', colors.blue);
  log('   5. Apply "Diabetes Management Plan" or "Hypertension Care Plan"', colors.blue);
  log('\n🎉 Ready to test Care Plans!', colors.green);
  log('');
}

main().catch((error) => {
  log(`\n❌ Script failed: ${error.message}`, colors.yellow);
  console.error(error);
  process.exit(1);
});

