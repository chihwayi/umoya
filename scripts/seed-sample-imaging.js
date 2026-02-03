#!/usr/bin/env node

/**
 * Seeds a demo imaging order/study with a real DICOM file for the specified tenant.
 * Requirements:
 *   - EHR service running locally (http://localhost:3013)
 *   - Sample DICOM stored at sample-data/dicom/CT-MONO2-16-ankle.dcm
 *
 * Environment variables:
 *   TENANT_SLUG          (default: bulawayo-general)
 *   LOGIN_EMAIL          (default: doctor@bulawayo-general.co.zw)
 *   LOGIN_PASSWORD       (default: Password1#)
 *   DICOM_PATH           (default: sample-data/dicom/CT-MONO2-16-ankle.dcm)
 *   EHR_API_URL          (default: http://localhost:3013/api)
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const API_URL = process.env.REACT_APP_EHR_API_URL || process.env.EHR_API_URL;
if (!API_URL) {
  console.error('❌ Error: REACT_APP_EHR_API_URL or EHR_API_URL is not set.');
  process.exit(1);
}

const TENANT_SLUG = process.env.TENANT_SLUG || 'bulawayo-general';
const LOGIN_EMAIL = process.env.LOGIN_EMAIL || 'doctor@bulawayo-general.co.zw';
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || 'Password1#';
const TECH_LOGIN_EMAIL =
  process.env.TECH_LOGIN_EMAIL || 'radiologist@bulawayo-general.co.zw';
const TECH_LOGIN_PASSWORD = process.env.TECH_LOGIN_PASSWORD || 'Password1#';
const DICOM_PATH =
  process.env.DICOM_PATH ||
  path.join(process.cwd(), 'sample-data', 'dicom', 'CT-MONO2-16-ankle.dcm');

async function main() {
  console.log('📥 Reading sample DICOM:', DICOM_PATH);
  const dicomBuffer = await fs.promises.readFile(DICOM_PATH);
  const dicomBase64 = dicomBuffer.toString('base64');
  const dicomDataUri = `data:application/dicom;base64,${dicomBase64}`;

  console.log(`🔐 Logging in as ordering provider ${LOGIN_EMAIL}...`);
  const doctorLogin = await loginUser(LOGIN_EMAIL, LOGIN_PASSWORD);
  const orderingProviderId = doctorLogin.user?.id;

  if (!orderingProviderId) {
    throw new Error('Could not determine ordering provider ID from login response.');
  }

  console.log(`🛠️  Logging in as technologist/admin ${TECH_LOGIN_EMAIL}...`);
  const technologistLogin = await loginUser(TECH_LOGIN_EMAIL, TECH_LOGIN_PASSWORD);
  const technologistId = technologistLogin.user?.id || orderingProviderId;

  const doctorHeaders = () => ({ ...baseHeaders(), Authorization: `Bearer ${doctorLogin.token}` });
  const technologistHeaders = () => ({
    ...baseHeaders(),
    Authorization: `Bearer ${technologistLogin.token}`,
  });

  console.log('👥 Fetching patient list...');
  const patientsRes = await rawFetch('/patients?limit=1', {
    method: 'GET',
    headers: doctorHeaders(),
  });
  const patientsBody = await parseJson(patientsRes);
  assertOk(patientsRes, 'Failed to load patients');
  const patient =
    (patientsBody.patients && patientsBody.patients[0]) ||
    (patientsBody.items && patientsBody.items[0]) ||
    (Array.isArray(patientsBody.data) && patientsBody.data[0]);

  if (!patient) {
    throw new Error('No patient records found for this tenant.');
  }

  console.log(`✅ Using patient ${patient.firstName} ${patient.lastName} (${patient.id})`);

  console.log('🧾 Fetching imaging study types (CT)...');
  const studyTypeRes = await rawFetch('/imaging/study-types?modality=CT', {
    method: 'GET',
    headers: doctorHeaders(),
  });
  const studyTypeBody = await parseJson(studyTypeRes);
  assertOk(studyTypeRes, 'Failed to load study types');
  const studyType =
    (studyTypeBody.studyTypes && studyTypeBody.studyTypes[0]) ||
    (Array.isArray(studyTypeBody) && studyTypeBody[0]);

  if (!studyType) {
    throw new Error('No CT study types available. Please seed imaging_study_types first.');
  }

  console.log(`📝 Creating imaging order for study ${studyType.study_name}...`);
  const orderPayload = {
    patient_id: patient.id,
    study_type_id: studyType.id,
    ordering_provider: orderingProviderId,
    clinical_indication: 'Demo ankle trauma – seeded DICOM',
    clinical_history: 'Sample case created via seed script',
    suspected_diagnosis: 'Ankle fracture',
    priority: 'routine',
    snomedConceptId: '363680008',
    snomedTerm: 'CT of ankle',
  };

  const orderRes = await rawFetch('/imaging/orders', {
    method: 'POST',
    headers: { ...doctorHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(orderPayload),
  });
  const orderBody = await parseJson(orderRes);
  assertOk(orderRes, 'Failed to create imaging order');
  const order = orderBody;
  console.log(`✅ Created imaging order ${order.order_number}`);

  if (order.finance_transaction_id) {
    const paymentAmount =
      Number(order.fee_amount ?? studyType.cost ?? 0) || 0;
    if (paymentAmount > 0) {
      console.log(
        `💰 Recording payment of $${paymentAmount.toFixed(2)} for transaction ${order.finance_transaction_id}...`,
      );
      const paymentRes = await rawFetch(
        `/finance/transactions/${order.finance_transaction_id}/payments`,
        {
          method: 'POST',
        headers: { ...technologistHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: paymentAmount,
            paymentMethod: 'cash',
            paymentReference: 'SEED-DEMO',
            note: 'Auto-cleared by seed script',
          }),
        },
      );
      assertOk(paymentRes, 'Failed to record payment');
    }
  }

  console.log('🗓️ Scheduling order...');
  const scheduleRes = await rawFetch(`/imaging/orders/${order.id}/schedule`, {
    method: 'PATCH',
    headers: { ...technologistHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ scheduled_date: new Date().toISOString() }),
  });
  assertOk(scheduleRes, 'Failed to schedule order');

  console.log('📷 Creating imaging study...');
  const now = new Date();
  const studyPayload = {
    imaging_order_id: order.id,
    patient_id: patient.id,
    study_type_id: studyType.id,
    study_date: now.toISOString().slice(0, 10),
    study_time: now.toISOString().slice(11, 16),
    technologist: technologistId,
    study_description: 'Demo ankle CT acquisition',
    technique: 'Helical CT 1mm slice',
    contrast_used: false,
  };
  const studyRes = await rawFetch('/imaging/studies', {
    method: 'POST',
    headers: { ...technologistHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(studyPayload),
  });
  const study = await parseJson(studyRes);
  assertOk(studyRes, 'Failed to create imaging study');
  console.log(`✅ Study ${study.accession_number} created.`);

  console.log('🖼️ Uploading DICOM image...');
  const uploadRes = await rawFetch(`/imaging/studies/${study.id}/images`, {
    method: 'POST',
    headers: { ...technologistHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file_name: path.basename(DICOM_PATH),
      file_path: dicomDataUri,
      file_type: 'DICOM',
      file_size: dicomBuffer.length,
      image_number: 1,
      view_position: 'AP',
      is_primary: true,
    }),
  });
  assertOk(uploadRes, 'Failed to upload DICOM image');

  console.log('✅ Image uploaded. Marking study as completed...');
  const completeRes = await rawFetch(`/imaging/studies/${study.id}/complete`, {
    method: 'PATCH',
    headers: { ...technologistHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ completion_notes: 'Sample DICOM seeded via script' }),
  });
  assertOk(completeRes, 'Failed to complete study');

  console.log('\n🎉 Sample imaging study is ready!');
  console.log(`   • Order: ${order.order_number}`);
  console.log(`   • Study: ${study.accession_number}`);
  console.log(`   • Patient: ${patient.firstName} ${patient.lastName}`);
const frontendUrl = process.env.FRONTEND_URL;
  console.log(
    `   • View in app: ${frontendUrl}/ehr/${TENANT_SLUG}/radiologist (open the study viewer)`,
  );
}

async function rawFetch(endpoint, options) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
  return fetch(url, options);
}

async function loginUser(email, password) {
  const res = await rawFetch('/auth/login', {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const body = await parseJson(res);
  assertOk(res, `Login failed for ${email}`);
  return body;
}

function baseHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Tenant-ID': TENANT_SLUG,
  };
}

async function parseJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (error) {
    console.error('Failed to parse JSON:', text);
    throw error;
  }
}

function assertOk(response, message) {
  if (!response.ok) {
    throw new Error(`${message}: ${response.status} ${response.statusText}`);
  }
}

main().catch((error) => {
  console.error('❌ Seed failed:', error.message || error);
  process.exit(1);
});


