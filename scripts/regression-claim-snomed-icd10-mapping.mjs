#!/usr/bin/env node
// Regression for MOAS-11 / A-010 / TERM-05 (claim creation must
// auto-populate ICD-10 diagnosis codes from the patient's coded SNOMED
// problems via the SNOMED->ICD-10 crosswalk, surfacing any unmappable
// concept for coder resolution rather than silently leaving diagnosisCodes
// blank).
//
// Runs against the REAL SNOMED CT / ICD-10-CM data loaded in TERM-01..03
// (gap A-015/A-025 resolution) — 38341003 "Hypertensive disorder" -> I10 is
// a genuine row in snomed_to_icd10_map, not a test fixture. Only the
// negative-path "unmapped concept" case uses a fabricated concept ID
// (999999001, not a real SNOMED identifier), since we need something
// guaranteed to have no mapping.

import { execSync } from 'node:child_process';

const EHR_API_URL = process.env.EHR_API_URL || 'http://localhost:3013/api';
const TENANT_ID = process.env.TENANT_ID || 'e2e-clinic';
// A-004/MOAS-20: POST /claims is now correctly restricted to
// accounts/nurse_accounts (previously any authenticated staff role could
// hit it) — use an accounts token, not doctor, to exercise this endpoint.
const ACCOUNTS_EMAIL = process.env.ACCOUNTS_EMAIL || 'accounts@e2e-clinic.com';
const ACCOUNTS_PASSWORD = process.env.ACCOUNTS_PASSWORD || 'Umoya1#';
const TENANT_DB = process.env.TENANT_DB || 'clinic_e2e-clinic_db';

function psql(db, sql) {
  const oneLine = sql.replace(/\s+/g, ' ').trim();
  execSync(`docker exec -i umoya-postgres-master psql -U postgres -d "${db}" -c ${JSON.stringify(oneLine)}`, { stdio: 'pipe' });
}

async function login() {
  const res = await fetch(`${EHR_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID },
    body: JSON.stringify({ email: ACCOUNTS_EMAIL, password: ACCOUNTS_PASSWORD }),
  });
  const data = await res.json();
  if (!data.token) throw new Error('Login failed');
  return data.token;
}

async function createPatient(headers, label, suffix) {
  const res = await fetch(`${EHR_API_URL}/patients`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      firstName: `${label}${Math.random().toString(36).slice(2, 10)}`, lastName: `Regress${suffix}`, dateOfBirth: '1980-01-01', gender: 'male',
      nationalId: `63-${suffix}-Q-77`, phone: `077${suffix}`, address: '1 Test Rd', city: 'Harare',
      emergencyContactName: 'Someone', emergencyContactPhone: `078${suffix}`, emergencyContactRelationship: 'Sibling',
    }),
  });
  const patient = await res.json();
  return patient.id;
}

async function main() {
  const token = await login();
  const headers = { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID, Authorization: `Bearer ${token}` };
  let pass = true;

  const suffix = `${Math.floor(Math.random() * 1e8)}`.padStart(8, '0');
  const patientId = await createPatient(headers, 'ClaimMapRegress', suffix);

  psql(TENANT_DB, `
    INSERT INTO problems (patient_id, code, code_system, snomed_concept_id, snomed_term, description, status) VALUES
    ('${patientId}', '38341003', 'SNOMED_CT', '38341003', 'Hypertensive disorder', 'Hypertension', 'active'),
    ('${patientId}', '999999001', 'SNOMED_CT', '999999001', 'Some unmapped condition', 'Rare unmapped condition', 'active');
  `);

  // 1. Claim created with no diagnosisCodes auto-populates from the mapped
  //    SNOMED problem, and surfaces the unmapped one for coder resolution.
  const claim1Res = await fetch(`${EHR_API_URL}/claims`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ patientId, medicalAidProvider: 'cimas', memberNumber: `MN${suffix}`, claimAmount: 50 }),
  });
  const claim1 = await claim1Res.json();
  const autoMapped = Array.isArray(claim1.diagnosisCodes) && claim1.diagnosisCodes.includes('I10');
  const unmappedSurfaced = Array.isArray(claim1.unmappedDiagnosisConcepts)
    && claim1.unmappedDiagnosisConcepts.some((u) => u.snomedCode === '999999001');
  console.log(`[claim with no diagnosisCodes auto-maps mapped SNOMED problem to I10] ${autoMapped ? 'PASS' : 'FAIL'}`);
  pass = pass && autoMapped;
  console.log(`[unmapped SNOMED concept surfaced in unmappedDiagnosisConcepts, not silently dropped] ${unmappedSurfaced ? 'PASS' : 'FAIL'}`);
  pass = pass && unmappedSurfaced;

  // 2. Explicit, manually-entered diagnosisCodes are respected, not overridden.
  const claim2Res = await fetch(`${EHR_API_URL}/claims`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ patientId, medicalAidProvider: 'cimas', memberNumber: `MN${suffix}b`, claimAmount: 50, diagnosisCodes: ['Z99.9'] }),
  });
  const claim2 = await claim2Res.json();
  const manualRespected = Array.isArray(claim2.diagnosisCodes) && claim2.diagnosisCodes.length === 1 && claim2.diagnosisCodes[0] === 'Z99.9';
  console.log(`[manually-provided diagnosisCodes are not overridden by auto-mapping] ${manualRespected ? 'PASS' : 'FAIL'}`);
  pass = pass && manualRespected;

  console.log(pass ? '\nALL PASS' : '\nFAILURES PRESENT');
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
