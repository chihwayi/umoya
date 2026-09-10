#!/usr/bin/env node
// Regression for MOAS-10 / A-009 (drug-drug interaction hard-stop must key
// off catalogued ingredient identity — brand names resolve to the same
// interaction alert as their generic, and an uncoded/unresolvable medicine
// produces an explicit review-required state rather than a silently empty,
// falsely-reassuring interaction list).

const EHR_API_URL = process.env.EHR_API_URL || 'http://localhost:3013/api';
const TENANT_ID = process.env.TENANT_ID || 'e2e-clinic';
const DOCTOR_EMAIL = process.env.DOCTOR_EMAIL || 'doctor@e2e-clinic.com';
const DOCTOR_PASSWORD = process.env.DOCTOR_PASSWORD || 'Demo1234!';

async function login() {
  const res = await fetch(`${EHR_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID },
    body: JSON.stringify({ email: DOCTOR_EMAIL, password: DOCTOR_PASSWORD }),
  });
  const data = await res.json();
  if (!data.token) throw new Error('Login failed');
  return data.token;
}

async function createPatient(headers, label) {
  // Fully-random first+last name (not just a shared "label" + digits suffix)
  // so repeated runs never look like near-duplicates of leftover patients
  // from earlier runs to MOAS-01's fuzzy duplicate-patient detection.
  const suffix = `${Math.floor(Math.random() * 1e8)}`.padStart(8, '0');
  const uniqueName = `${label}${Math.random().toString(36).slice(2, 10)}`;
  const res = await fetch(`${EHR_API_URL}/patients`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      firstName: uniqueName, lastName: `Regress${suffix}`, dateOfBirth: '1980-01-01', gender: 'male',
      nationalId: `63-${suffix}-Q-99`, phone: `077${suffix}`, address: '1 Test Rd', city: 'Harare',
      emergencyContactName: 'Someone', emergencyContactPhone: `078${suffix}`, emergencyContactRelationship: 'Sibling',
    }),
  });
  const patient = await res.json();
  if (!patient.id) {
    throw new Error(`createPatient(${label}) failed: ${JSON.stringify(patient)}`);
  }
  return patient.id;
}

async function prescribe(headers, patientId, medicationName) {
  const res = await fetch(`${EHR_API_URL}/prescriptions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ patientId, medicationName, dosage: '1 unit', frequency: 'daily', duration: '30 days', quantity: 30 }),
  });
  const body = await res.json();
  return { status: res.status, body };
}

async function main() {
  const token = await login();
  const headers = { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID, Authorization: `Bearer ${token}` };
  let pass = true;

  // 1. Brand name resolves to the same ingredient as its generic, and the
  //    hard-stop fires for a genuinely dangerous known-critical pair
  //    (warfarin + aspirin) even when the second drug is prescribed under
  //    its brand name ("Bayer"), not its generic name.
  const p1 = await createPatient(headers, 'MedSafetyBrand');
  const first = await prescribe(headers, p1, 'warfarin');
  const second = await prescribe(headers, p1, 'Bayer');
  const brandHardStopFires = first.status === 201 && second.status === 400 && second.body?.code === 'CONTRAINDICATION_HARD_STOP';
  console.log(`[brand "Bayer" resolves to aspirin, hard-stops against warfarin] ${brandHardStopFires ? 'PASS' : 'FAIL'}`);
  pass = pass && brandHardStopFires;

  // 2. A brand name for an unrelated, non-interacting drug does NOT
  //    false-trigger the hard-stop (proves resolution isn't over-broad).
  const p2 = await createPatient(headers, 'MedSafetyNoInteract');
  const m1 = await prescribe(headers, p2, 'metformin');
  const m2 = await prescribe(headers, p2, 'Zestril'); // brand for lisinopril
  const noFalseHardStop = m1.status === 201 && m2.status === 201;
  console.log(`[brand "Zestril" (lisinopril) + metformin does not false-trigger hard-stop] ${noFalseHardStop ? 'PASS' : 'FAIL'}`);
  pass = pass && noFalseHardStop;

  // 3. A completely uncoded/free-text medication produces an explicit
  //    review-required state rather than silent clearance.
  const p3 = await createPatient(headers, 'MedSafetyUncoded');
  const uncoded = await prescribe(headers, p3, 'GrandmasHerbalTonicXYZ');
  const reviewSurfaced = uncoded.status === 201
    && uncoded.body?.medicationSafetyReview?.reviewRequired === true
    && uncoded.body?.medicationSafetyReview?.uncodedMedications?.includes('GrandmasHerbalTonicXYZ');
  console.log(`[uncoded medicine surfaces medicationSafetyReview.reviewRequired] ${reviewSurfaced ? 'PASS' : 'FAIL'}`);
  pass = pass && reviewSurfaced;

  // 4. A fully catalogued, non-interacting medication does NOT spuriously
  //    report reviewRequired (proves review-state isn't over-triggering).
  const p4 = await createPatient(headers, 'MedSafetyCleanCatalog');
  const clean = await prescribe(headers, p4, 'omeprazole');
  const noSpuriousReview = clean.status === 201 && !clean.body?.medicationSafetyReview;
  console.log(`[fully catalogued medicine does not spuriously flag reviewRequired] ${noSpuriousReview ? 'PASS' : 'FAIL'}`);
  pass = pass && noSpuriousReview;

  console.log(pass ? '\nALL PASS' : '\nFAILURES PRESENT');
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
