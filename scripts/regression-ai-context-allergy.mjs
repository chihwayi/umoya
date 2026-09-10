#!/usr/bin/env node
// Regression for MOAS-02 / A-007 (canonical AI context must include active
// allergies, and medication-safety assessment must act on them or abstain).

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

async function main() {
  const token = await login();
  const headers = { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID, Authorization: `Bearer ${token}` };
  const suffix = `${Date.now()}`.slice(-8);
  let pass = true;

  // A-018: a fixed firstName+DOB every run (only a numeric lastName suffix
  // varied) fuzzy-matches previous runs' patients closely enough to trip the
  // real POSSIBLE_DUPLICATE_PATIENT guard once this script has run a few
  // times against the same tenant, which is the duplicate-detector working
  // as intended, not a bug — so vary both the surname word and the DOB per
  // run to keep this fixture out of that guard's similarity threshold.
  const surnamePool = ['Context', 'Sentinel', 'Harness', 'Fixture', 'Probe', 'Beacon', 'Marker', 'Anchor'];
  const surname = surnamePool[Math.floor(Math.random() * surnamePool.length)];
  const dobYear = 1960 + Math.floor(Math.random() * 40);
  const dobMonth = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
  const dobDay = String(1 + Math.floor(Math.random() * 27)).padStart(2, '0');

  const patientRes = await fetch(`${EHR_API_URL}/patients`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      firstName: `AiContext${suffix}`, lastName: surname, dateOfBirth: `${dobYear}-${dobMonth}-${dobDay}`, gender: 'female',
      nationalId: `63-${suffix}-Q-01`, phone: `077${suffix}`, address: '1 Context Rd', city: 'Harare',
      emergencyContactName: 'Someone', emergencyContactPhone: `078${suffix}`, emergencyContactRelationship: 'Sibling',
    }),
  });
  const patient = await patientRes.json();
  if (!patient.id) {
    console.error('Patient creation failed:', patient);
    process.exit(2);
  }
  console.log('Patient created:', patient.id);

  await fetch(`${EHR_API_URL}/allergies/patient/${patient.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ allergies: [{ allergen: 'Penicillin', reaction: 'Anaphylaxis', severity: 'severe', status: 'active' }] }),
  });

  // 1. Canonical context must surface the allergy.
  const contextRes = await fetch(`${EHR_API_URL}/patients/${patient.id}/context`, { headers });
  const context = await contextRes.json();
  const contextHasAllergy = Array.isArray(context.activeAllergies) && context.activeAllergies.some((a) => /penicillin/i.test(a.allergen));
  console.log(`[1] Canonical context includes active allergy: ${contextHasAllergy ? 'PASS' : 'FAIL'}`);
  pass = pass && contextHasAllergy;

  // 2. Cross-reactive prescription (amoxicillin, not a direct string match) must be flagged.
  const assessRes = await fetch(`${EHR_API_URL}/medication-safety/assess`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ patientId: patient.id, medications: [{ name: 'Amoxicillin 500mg', genericName: 'amoxicillin' }] }),
  });
  const assessment = await assessRes.json();
  const flagged = assessment?.allergy?.alerts?.some((a) => a.matchType === 'cross-reactive' && /amoxicillin/i.test(a.medication));
  console.log(`[2] Cross-reactive amoxicillin flagged against penicillin allergy: ${flagged ? 'PASS' : 'FAIL'}`);
  pass = pass && !!flagged;

  // 3. Unrelated medication must NOT be flagged (no false positive).
  const controlRes = await fetch(`${EHR_API_URL}/medication-safety/assess`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ patientId: patient.id, medications: [{ name: 'Paracetamol 1g', genericName: 'paracetamol' }] }),
  });
  const controlAssessment = await controlRes.json();
  const noFalsePositive = (controlAssessment?.allergy?.alerts?.length || 0) === 0;
  console.log(`[3] Unrelated medication (paracetamol) not flagged: ${noFalsePositive ? 'PASS' : 'FAIL'}`);
  pass = pass && noFalsePositive;

  console.log(pass ? '\nOVERALL: PASS' : '\nOVERALL: FAIL');
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error('Regression failed:', err);
  process.exit(2);
});
