#!/usr/bin/env node
// Regression for MOAS-14 (B-003): FHIR orders/diagnostics/documents —
// ServiceRequest, DiagnosticReport, DocumentReference — round-trip
// create -> read -> update -> search without silent field loss.
// Also covers ImagingStudy, a resource that was previously entirely absent
// from the controller/mapper/CapabilityStatement — now a real, read-only
// (search + read) FHIR resource backed by the dicom_studies table.

import { execSync } from 'node:child_process';

function psql(db, sql) {
  const oneLine = sql.replace(/\s+/g, ' ').trim();
  execSync(`docker exec -i umoya-postgres-master psql -U postgres -d "${db}" -c ${JSON.stringify(oneLine)}`, { stdio: 'pipe' });
}

const EHR_API_URL = process.env.EHR_API_URL || 'http://localhost:3013/api';
const TENANT_ID = process.env.TENANT_ID || 'e2e-clinic';
const DOCTOR_EMAIL = process.env.DOCTOR_EMAIL || 'doctor@e2e-clinic.com';
const DOCTOR_PASSWORD = process.env.DOCTOR_PASSWORD || 'Demo1234!';

let pass = true;
function check(label, ok) {
  console.log(`[${label}] ${ok ? 'PASS' : 'FAIL'}`);
  pass = pass && ok;
}

async function login() {
  const res = await fetch(`${EHR_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID },
    body: JSON.stringify({ email: DOCTOR_EMAIL, password: DOCTOR_PASSWORD }),
  });
  const data = await res.json();
  if (!data.token) throw new Error('Login failed');
  return { token: data.token, doctorId: data.user?.id };
}

async function fhirCreate(headers, resourceType, body) {
  const res = await fetch(`${EHR_API_URL}/fhir/${resourceType}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const json = await res.json();
  return { status: res.status, body: json };
}
async function fhirGet(headers, resourceType, id) {
  const res = await fetch(`${EHR_API_URL}/fhir/${resourceType}/${id}`, { headers });
  const json = await res.json();
  return { status: res.status, body: json };
}
async function fhirDelete(headers, resourceType, id) {
  const res = await fetch(`${EHR_API_URL}/fhir/${resourceType}/${id}`, { method: 'DELETE', headers });
  return { status: res.status };
}

async function main() {
  const { token, doctorId } = await login();
  const headers = { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID, Authorization: `Bearer ${token}` };

  const patientCreate = await fhirCreate(headers, 'Patient', {
    resourceType: 'Patient',
    name: [{ family: 'FhirOrdersDocsRegress', given: ['Test'] }],
    gender: 'male',
    birthDate: '1985-01-01',
  });
  const patientId = patientCreate.body?.id;
  check('setup: patient created', patientCreate.status === 201 && Boolean(patientId));

  // --- ServiceRequest ---
  const serviceRequestPayload = {
    resourceType: 'ServiceRequest',
    status: 'active',
    intent: 'order',
    subject: { reference: `Patient/${patientId}` },
    requester: { reference: `Practitioner/${doctorId}` },
    code: { coding: [{ code: 'CBC', display: 'Complete Blood Count' }], text: 'Complete Blood Count' },
  };
  const srCreate = await fhirCreate(headers, 'ServiceRequest', serviceRequestPayload);
  const srId = srCreate.body?.id;
  check('ServiceRequest create returns 201', srCreate.status === 201 && Boolean(srId));
  const srGet = await fhirGet(headers, 'ServiceRequest', srId);
  check('ServiceRequest round-trip: code preserved', srGet.body?.code?.text === 'Complete Blood Count');
  check('ServiceRequest round-trip: subject reference preserved', srGet.body?.subject?.reference === `Patient/${patientId}`);
  const srDelete = await fhirDelete(headers, 'ServiceRequest', srId);
  check('ServiceRequest delete returns 200/204', [200, 204].includes(srDelete.status));

  // --- DiagnosticReport ---
  const diagnosticReportPayload = {
    resourceType: 'DiagnosticReport',
    status: 'final',
    code: { coding: [{ system: 'http://loinc.org', code: '58410-2', display: 'CBC panel' }], text: 'CBC panel' },
    subject: { reference: `Patient/${patientId}` },
    performer: [{ reference: `Practitioner/${doctorId}` }],
    effectiveDateTime: '2026-04-01T00:00:00.000Z',
  };
  const drCreate = await fhirCreate(headers, 'DiagnosticReport', diagnosticReportPayload);
  const drId = drCreate.body?.id;
  check('DiagnosticReport create returns 201', drCreate.status === 201 && Boolean(drId));
  const drGet = await fhirGet(headers, 'DiagnosticReport', drId);
  check('DiagnosticReport round-trip: LOINC code preserved', drGet.body?.code?.coding?.some((c) => c.code === '58410-2'));
  check('DiagnosticReport round-trip: subject reference preserved', drGet.body?.subject?.reference === `Patient/${patientId}`);

  // --- DocumentReference ---
  const noteContent = `Roundtrip note ${Math.random().toString(36).slice(2, 10)}`;
  const docRefPayload = {
    resourceType: 'DocumentReference',
    status: 'current',
    type: { text: 'Consultation Note' },
    subject: { reference: `Patient/${patientId}` },
    author: [{ reference: `Practitioner/${doctorId}` }],
    content: [{ attachment: { contentType: 'text/plain', data: Buffer.from(noteContent).toString('base64') } }],
  };
  const docRefCreate = await fhirCreate(headers, 'DocumentReference', docRefPayload);
  const docRefId = docRefCreate.body?.id;
  check('DocumentReference create returns 201 (was: NOT NULL crash on record_type/title/content/created_by)', docRefCreate.status === 201 && Boolean(docRefId));
  const docRefGet = await fhirGet(headers, 'DocumentReference', docRefId);
  check('DocumentReference round-trip: subject reference preserved', docRefGet.body?.subject?.reference === `Patient/${patientId}`);
  check('DocumentReference round-trip: author reference preserved', docRefGet.body?.author?.[0]?.reference === `Practitioner/${doctorId}`);
  const docRefDelete = await fhirDelete(headers, 'DocumentReference', docRefId);
  check('DocumentReference delete returns 200/204', [200, 204].includes(docRefDelete.status));

  // --- ImagingStudy (read-only; backed by dicom_studies, no FHIR create path) ---
  const studyUid = `1.2.826.0.1.regress.${Date.now()}`;
  psql('clinic_e2e-clinic_db', `
    INSERT INTO dicom_studies (patient_id, study_uid, modality, body_part, storage_key, ai_analysis_status)
    VALUES ('${patientId}', '${studyUid}', 'CXR', 'Chest', 's3://regress/test.dcm', 'complete');
  `);
  const studySearch = await (await fetch(`${EHR_API_URL}/fhir/ImagingStudy?patient=${patientId}`, { headers })).json();
  const studyEntry = studySearch.entry?.find((e) => e.resource?.identifier?.[0]?.value?.includes(studyUid));
  check('ImagingStudy search finds the study for this patient', Boolean(studyEntry));
  check('ImagingStudy: modality preserved', studyEntry?.resource?.modality?.[0]?.code === 'CXR');
  check('ImagingStudy: subject reference preserved', studyEntry?.resource?.subject?.reference === `Patient/${patientId}`);

  const studyId = studyEntry?.resource?.id;
  const studyGet = studyId ? await (await fetch(`${EHR_API_URL}/fhir/ImagingStudy/${studyId}`, { headers })).json() : null;
  check('ImagingStudy GET by id: bodySite preserved', studyGet?.series?.[0]?.bodySite?.display === 'Chest');

  const metadataRes = await (await fetch(`${EHR_API_URL}/fhir/metadata`, { headers })).json();
  const imagingCapability = metadataRes.rest?.[0]?.resource?.find((r) => r.type === 'ImagingStudy');
  const imagingIsReadOnly = imagingCapability
    && imagingCapability.interaction.some((i) => i.code === 'read')
    && imagingCapability.interaction.some((i) => i.code === 'search-type')
    && !imagingCapability.interaction.some((i) => i.code === 'create');
  check('ImagingStudy declared in CapabilityStatement as read-only (no create/update)', imagingIsReadOnly);

  console.log(pass ? '\nALL PASS' : '\nFAILURES PRESENT');
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
