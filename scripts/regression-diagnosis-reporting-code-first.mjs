#!/usr/bin/env node
// Regression for MOAS-12 / A-011 (top-diagnoses reporting must group by
// coded concept, not free-text description, so two differently-phrased
// encounters sharing one code count as a single diagnosis; uncoded rows
// must be reported separately, never silently merged by description).

import { execSync } from 'node:child_process';

const EHR_API_URL = process.env.EHR_API_URL || 'http://localhost:3013/api';
const TENANT_ID = process.env.TENANT_ID || 'e2e-clinic';
const DOCTOR_EMAIL = process.env.DOCTOR_EMAIL || 'doctor@e2e-clinic.com';
const DOCTOR_PASSWORD = process.env.DOCTOR_PASSWORD || 'Demo1234!';
const TENANT_DB = process.env.TENANT_DB || 'clinic_e2e-clinic_db';

function psql(db, sql) {
  const oneLine = sql.replace(/\s+/g, ' ').trim();
  execSync(`docker exec -i umoya-postgres-master psql -U postgres -d "${db}" -c ${JSON.stringify(oneLine)}`, { stdio: 'pipe' });
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

async function createPatient(headers, suffix) {
  const res = await fetch(`${EHR_API_URL}/patients`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      firstName: `DxReportRegress${Math.random().toString(36).slice(2, 10)}`, lastName: `Test${suffix}`, dateOfBirth: '1980-01-01', gender: 'male',
      nationalId: `63-${suffix}-Q-88`, phone: `077${suffix}`, address: '1 Test Rd', city: 'Harare',
      emergencyContactName: 'Someone', emergencyContactPhone: `078${suffix}`, emergencyContactRelationship: 'Sibling',
    }),
  });
  const patient = await res.json();
  return patient.id;
}

async function main() {
  const { token, doctorId } = await login();
  const headers = { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID, Authorization: `Bearer ${token}` };
  let pass = true;

  const suffix = `${Math.floor(Math.random() * 1e8)}`.padStart(8, '0');
  const patientId = await createPatient(headers, suffix);

  // Two coded encounters sharing one SNOMED concept, phrased differently
  // ("Hypertension" vs "HTN"), plus one uncoded free-text encounter.
  // GET /reports/clinical's uncodedDiagnoses is (by design, see
  // reports.service.ts's getClinicalReport) a top-10-by-frequency slice over
  // the whole tenant's history, not a full listing. On a heavily-seeded
  // tenant a single fresh occurrence can rank outside the top 10 purely
  // because of unrelated accumulated data, which is a reporting-volume
  // artifact, not a bug in the code-first grouping this ticket covers.
  // Insert the uncoded diagnosis 80x so its count reliably clears whatever
  // top-10 threshold the tenant's existing data has established, even as
  // this long-running session's accumulated medical_records keeps growing.
  const uncodedRows = Array.from({ length: 80 }, (_, i) =>
    `('${patientId}','consultation','Visit C-${i}','note','${doctorId}','[{"code":null,"description":"Feeling tired ${suffix}","type":"primary"}]'::jsonb)`
  ).join(',\n    ');
  psql(TENANT_DB, `
    INSERT INTO medical_records (patient_id, record_type, title, content, created_by, diagnoses) VALUES
    ('${patientId}','consultation','Visit A','note','${doctorId}','[{"code":"38341003","description":"Hypertension","type":"primary"}]'::jsonb),
    ('${patientId}','consultation','Visit B','note','${doctorId}','[{"code":"38341003","description":"HTN","type":"primary"}]'::jsonb),
    ${uncodedRows};
  `);

  const res = await fetch(`${EHR_API_URL}/reports/clinical`, { headers });
  const report = await res.json();

  const htnEntry = (report.topDiagnoses || []).find((d) => d.code === '38341003');
  const aggregatesOnce = htnEntry?.count >= 2;
  console.log(`[two differently-phrased encounters sharing one code aggregate as one topDiagnoses row] ${aggregatesOnce ? 'PASS' : 'FAIL'}`);
  pass = pass && aggregatesOnce;

  const uncodedEntry = (report.uncodedDiagnoses || []).find((d) => d.diagnosis === `Feeling tired ${suffix}`);
  const uncodedSeparate = Boolean(uncodedEntry) && !(report.topDiagnoses || []).some((d) => d.diagnosis === `Feeling tired ${suffix}`);
  console.log(`[uncoded free-text diagnosis reported separately, not merged into topDiagnoses] ${uncodedSeparate ? 'PASS' : 'FAIL'}`);
  pass = pass && uncodedSeparate;

  console.log(pass ? '\nALL PASS' : '\nFAILURES PRESENT');
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
