#!/usr/bin/env node
// Regression for MOAS-13 (B-003): FHIR clinical-core resources — Patient,
// Encounter, Condition, AllergyIntolerance, Observation, MedicationRequest —
// must round-trip create -> read -> update -> search without silent field
// loss. Each check creates a resource via the real /fhir/* REST API, reads
// it back, and diffs the fields that matter clinically (not just HTTP 200).

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
async function fhirUpdate(headers, resourceType, id, body) {
  const res = await fetch(`${EHR_API_URL}/fhir/${resourceType}/${id}`, { method: 'PUT', headers, body: JSON.stringify(body) });
  const json = await res.json();
  return { status: res.status, body: json };
}
async function fhirSearch(headers, resourceType, qs) {
  const res = await fetch(`${EHR_API_URL}/fhir/${resourceType}?${qs}`, { headers });
  const json = await res.json();
  return { status: res.status, body: json };
}

async function main() {
  const { token, doctorId } = await login();
  const headers = { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID, Authorization: `Bearer ${token}` };
  const suffix = `${Math.floor(Math.random() * 1e8)}`.padStart(8, '0');

  // --- 1. Patient ---
  const patientPayload = {
    resourceType: 'Patient',
    active: true,
    name: [{ family: `FhirRegress${suffix}`, given: ['Roundtrip'], use: 'official' }],
    gender: 'female',
    birthDate: '1990-05-15',
    telecom: [{ system: 'phone', value: `077${suffix}` }, { system: 'email', value: `fhir${suffix}@test.com` }],
    address: [{ use: 'home', line: ['1 Round Trip Rd'], city: 'Harare', country: 'ZW' }],
    identifier: [{ system: 'http://umoya.health/fhir/national-id', value: `63-${suffix}-F-01` }],
  };
  const patientCreate = await fhirCreate(headers, 'Patient', patientPayload);
  const patientId = patientCreate.body?.id;
  check('Patient create returns 201 with id', patientCreate.status === 201 && Boolean(patientId));

  const patientGet = await fhirGet(headers, 'Patient', patientId);
  check('Patient round-trip: name preserved', patientGet.body?.name?.[0]?.family === patientPayload.name[0].family && patientGet.body?.name?.[0]?.given?.[0] === 'Roundtrip');
  check('Patient round-trip: gender/birthDate preserved', patientGet.body?.gender === 'female' && patientGet.body?.birthDate === '1990-05-15');
  check('Patient round-trip: telecom preserved', patientGet.body?.telecom?.some((t) => t.system === 'phone' && t.value === `077${suffix}`));
  check('Patient round-trip: address preserved', patientGet.body?.address?.[0]?.city === 'Harare');
  check('Patient round-trip: national-id identifier preserved', patientGet.body?.identifier?.some((i) => i.value === `63-${suffix}-F-01`));

  const patientUpdate = await fhirUpdate(headers, 'Patient', patientId, { ...patientPayload, id: patientId, telecom: [{ system: 'phone', value: `099${suffix}` }] });
  check('Patient update applies new phone', patientUpdate.body?.telecom?.some((t) => t.value === `099${suffix}`));

  const patientSearch = await fhirSearch(headers, 'Patient', `name=FhirRegress${suffix}`);
  check('Patient search finds created patient', patientSearch.body?.entry?.some((e) => e.resource?.id === patientId));

  // --- 2. Condition ---
  const conditionPayload = {
    resourceType: 'Condition',
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
    code: { coding: [{ system: 'http://snomed.info/sct', code: '38341003', display: 'Hypertensive disorder' }], text: 'Hypertension' },
    subject: { reference: `Patient/${patientId}` },
    onsetDateTime: '2026-01-01T00:00:00.000Z',
  };
  const conditionCreate = await fhirCreate(headers, 'Condition', conditionPayload);
  const conditionId = conditionCreate.body?.id;
  check('Condition create returns 201', conditionCreate.status === 201 && Boolean(conditionId));
  const conditionGet = await fhirGet(headers, 'Condition', conditionId);
  check('Condition round-trip: SNOMED code preserved', conditionGet.body?.code?.coding?.some((c) => c.code === '38341003'));
  check('Condition round-trip: subject reference preserved', conditionGet.body?.subject?.reference === `Patient/${patientId}`);

  // --- 3. AllergyIntolerance ---
  const allergyPayload = {
    resourceType: 'AllergyIntolerance',
    clinicalStatus: { coding: [{ code: 'active' }] },
    verificationStatus: { coding: [{ code: 'confirmed' }] },
    code: { text: 'Penicillin' },
    patient: { reference: `Patient/${patientId}` },
    criticality: 'high',
    reaction: [{ manifestation: [{ text: 'Anaphylaxis' }], severity: 'severe' }],
  };
  const allergyCreate = await fhirCreate(headers, 'AllergyIntolerance', allergyPayload);
  const allergyId = allergyCreate.body?.id;
  check('AllergyIntolerance create returns 201', allergyCreate.status === 201 && Boolean(allergyId));
  const allergyGet = await fhirGet(headers, 'AllergyIntolerance', allergyId);
  check('AllergyIntolerance round-trip: allergen text preserved', allergyGet.body?.code?.text === 'Penicillin');
  check('AllergyIntolerance round-trip: reaction manifestation preserved', allergyGet.body?.reaction?.[0]?.manifestation?.[0]?.text === 'Anaphylaxis');

  // --- 4. Observation (laboratory category — simplest 1:1 create path) ---
  const observationPayload = {
    resourceType: 'Observation',
    status: 'final',
    category: [{ coding: [{ code: 'laboratory' }] }],
    code: { coding: [{ system: 'http://loinc.org', code: '2345-7', display: 'Glucose' }], text: 'Glucose' },
    subject: { reference: `Patient/${patientId}` },
    performer: [{ reference: `Practitioner/${doctorId}` }],
    effectiveDateTime: '2026-02-01T00:00:00.000Z',
    valueQuantity: { value: 95, unit: 'mg/dL' },
  };
  const observationCreate = await fhirCreate(headers, 'Observation', observationPayload);
  const observationId = observationCreate.body?.id;
  check('Observation create returns 201', observationCreate.status === 201 && Boolean(observationId));
  const observationGet = await fhirGet(headers, 'Observation', observationId);
  check('Observation round-trip: LOINC code preserved', observationGet.body?.code?.coding?.some((c) => c.code === '2345-7'));
  check('Observation round-trip: value preserved', Number(observationGet.body?.valueQuantity?.value) === 95);

  // A lab Observation with no `performer` (legitimately optional per FHIR)
  // must fail cleanly with a 400 explaining what's missing, not an opaque
  // 500 from a NOT NULL DB constraint further down the stack.
  const { performer: _omitted, ...observationNoPerformer } = observationPayload;
  const observationNoPerformerCreate = await fhirCreate(headers, 'Observation', observationNoPerformer);
  check(
    'Observation without performer fails with clean 400, not opaque 500',
    observationNoPerformerCreate.status === 400 && /performer/i.test(observationNoPerformerCreate.body?.message || ''),
  );

  // --- 5. Encounter (ambulatory/appointment path) ---
  const encounterPayload = {
    resourceType: 'Encounter',
    status: 'planned',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
    type: [{ text: 'Consultation' }],
    subject: { reference: `Patient/${patientId}` },
    period: { start: '2026-03-01T09:00:00.000Z', end: '2026-03-01T09:30:00.000Z' },
    participant: [{ individual: { reference: `Practitioner/${doctorId}` } }],
  };
  const encounterCreate = await fhirCreate(headers, 'Encounter', encounterPayload);
  const encounterId = encounterCreate.body?.id;
  check('Encounter create returns 201', encounterCreate.status === 201 && Boolean(encounterId));
  const encounterGet = await fhirGet(headers, 'Encounter', encounterId);
  check('Encounter round-trip: class preserved', encounterGet.body?.class?.code === 'AMB');
  check('Encounter round-trip: type preserved', encounterGet.body?.type?.[0]?.text === 'Consultation');
  check('Encounter round-trip: subject reference preserved', encounterGet.body?.subject?.reference === `Patient/${patientId}`);

  // --- 6. MedicationRequest ---
  const medRequestPayload = {
    resourceType: 'MedicationRequest',
    status: 'active',
    intent: 'order',
    medicationCodeableConcept: { text: 'Amoxicillin', coding: [{ system: 'http://snomed.info/sct', code: '27658006', display: 'Amoxicillin' }] },
    subject: { reference: `Patient/${patientId}` },
    requester: { reference: `Practitioner/${doctorId}` },
    dosageInstruction: [{ text: '500mg three times daily', doseAndRate: [{ doseQuantity: { value: 500, unit: 'mg' } }], route: { text: 'oral' } }],
    dispenseRequest: { quantity: { value: 21 }, numberOfRepeatsAllowed: 0 },
  };
  const medRequestCreate = await fhirCreate(headers, 'MedicationRequest', medRequestPayload);
  const medRequestId = medRequestCreate.body?.id;
  check('MedicationRequest create returns 201', medRequestCreate.status === 201 && Boolean(medRequestId));
  const medRequestGet = await fhirGet(headers, 'MedicationRequest', medRequestId);
  check('MedicationRequest round-trip: medication name preserved', medRequestGet.body?.medicationCodeableConcept?.text === 'Amoxicillin');
  check('MedicationRequest round-trip: subject reference preserved', medRequestGet.body?.subject?.reference === `Patient/${patientId}`);

  console.log(pass ? '\nALL PASS' : '\nFAILURES PRESENT');
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
