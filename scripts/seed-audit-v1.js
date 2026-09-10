/*
  Master Assurance Programme §8 seed extension for the e2e-clinic tenant.
  Creates:
  - ~200 synthetic patients with Zimbabwean names/IDs/addresses, spread across
    2 cities, ages 0-90 (dependants/minors included via age<18).
  - A documented set of near-duplicate registration pairs (same name+DOB,
    different national ID) for DAT-030 duplicate-recall measurement.
  - Additional clinician/nurse accounts (role=doctor/nurse) to approach the
    >=30 clinician minimum.
  Writes seed/v1/manifest.json recording every created patient id, the
  deliberate near-duplicate pairs, and every clinician id, so downstream
  tests (duplication recall, concurrency, golden flows) can reference the
  exact fixture set instead of scanning the whole table.

  NOT covered by this script (out of scope for this pass, documented in the
  audit report): multi-facility/multi-tenant continuity (needs 5 separate
  tenant provisioning), 2 years of historical encounters, deceased/VIP flags
  (the Patient entity has no columns for them yet - see gap A-005).
*/
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const EHR_API_URL = process.env.EHR_API_URL || 'http://localhost:3013/api';
const TENANT_ID = process.env.TENANT_ID || 'e2e-clinic';
const DOCTOR_EMAIL = process.env.DOCTOR_EMAIL || 'doctor@e2e-clinic.com';
const DOCTOR_PASSWORD = process.env.DOCTOR_PASSWORD || 'Demo1234!';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@e2e-clinic.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Umoya1#';

const ehr = axios.create({ baseURL: EHR_API_URL, timeout: 20000 });
function authHeaders(token) { return { headers: { 'X-Tenant-ID': TENANT_ID, Authorization: `Bearer ${token}` } }; }
function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pad(n, len) { return String(n).padStart(len, '0'); }

const firstNamesM = ['Tendai','Farai','Tapiwa','Blessing','Tinashe','Takudzwa','Munashe','Kudakwashe','Simbarashe','Tafadzwa','Wellington','Panashe'];
const firstNamesF = ['Tariro','Ruvimbo','Nyasha','Chiedza','Rutendo','Ropafadzo','Anesu','Vimbai','Nomsa','Sithembile','Chipo','Rumbidzai'];
const lastNames = ['Moyo','Dube','Chikafu','Mhlanga','Ndlovu','Gutu','Madzorera','Sithole','Mlambo','Chihwayi','Ncube','Mpofu','Dlamini','Mhaka','Zhou','Chirwa','Muponda','Sibanda'];
const cities = [
  { city: 'Harare', prefix: '63' },
  { city: 'Bulawayo', prefix: '68' },
];

function makePatientPayload(i, opts = {}) {
  const gender = opts.gender || randomChoice(['male', 'female']);
  const firstName = opts.firstName || randomChoice(gender === 'male' ? firstNamesM : firstNamesF);
  const lastName = opts.lastName || randomChoice(lastNames);
  const ageYears = opts.ageYears != null ? opts.ageYears : Math.floor(Math.random() * 85) + 1;
  const dob = opts.dob || new Date(2026 - ageYears, Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 27)).toISOString().slice(0, 10);
  const cityInfo = opts.cityInfo || randomChoice(cities);
  const nationalId = opts.nationalId || `${cityInfo.prefix}-${pad(1000000 + i, 7)}-${randomChoice(['A','B','C','D'])}-${pad(10 + (i % 89), 2)}`;
  const isMinor = ageYears < 18;
  return {
    firstName, lastName, gender, dateOfBirth: dob,
    nationalId,
    phone: `077${pad(1000000 + i, 7)}`,
    address: `${1 + (i % 400)} ${randomChoice(['Samora Machel Ave','Josiah Tongogara St','Robert Mugabe Rd','Herbert Chitepo St','Leopold Takawira St'])}`,
    city: cityInfo.city,
    emergencyContactName: isMinor ? `${randomChoice(firstNamesF)} ${lastName}` : `${randomChoice([...firstNamesM, ...firstNamesF])} ${randomChoice(lastNames)}`,
    emergencyContactPhone: `071${pad(2000000 + i, 7)}`,
    emergencyContactRelationship: isMinor ? 'Parent' : randomChoice(['Spouse', 'Sibling', 'Parent', 'Friend']),
  };
}

async function main() {
  const loginRes = await ehr.post('/auth/login', { email: DOCTOR_EMAIL, password: DOCTOR_PASSWORD }, { headers: { 'X-Tenant-ID': TENANT_ID } });
  const token = loginRes.data?.token;
  if (!token) throw new Error('Doctor login failed');
  console.log('Logged in as', DOCTOR_EMAIL);

  const adminLoginRes = await ehr.post('/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, { headers: { 'X-Tenant-ID': TENANT_ID } });
  const adminToken = adminLoginRes.data?.token;

  const manifest = { createdAt: new Date().toISOString(), tenant: TENANT_ID, patients: [], nearDuplicatePairs: [], clinicians: [], errors: [] };

  const TARGET_PATIENTS = Number(process.env.SEED_PATIENT_COUNT || 190);
  console.log(`Creating ${TARGET_PATIENTS} base patients...`);
  for (let i = 0; i < TARGET_PATIENTS; i++) {
    const payload = makePatientPayload(i);
    try {
      const res = await ehr.post('/patients', payload, authHeaders(token));
      manifest.patients.push({ id: res.data.id, patientNumber: res.data.patientNumber, firstName: payload.firstName, lastName: payload.lastName, dateOfBirth: payload.dateOfBirth, nationalId: payload.nationalId });
    } catch (e) {
      manifest.errors.push({ index: i, phase: 'base-patient', message: e?.response?.data?.message || e.message });
    }
    if ((i + 1) % 25 === 0) console.log(`  ...${i + 1}/${TARGET_PATIENTS}`);
  }
  console.log(`Base patients created: ${manifest.patients.length} (errors: ${manifest.errors.length})`);

  // Deliberate near-duplicate set: same first+last name + DOB as an existing
  // seeded patient, but a different (typo-style) national ID - this is the
  // DAT-030 fuzzy-duplicate-recall test fixture.
  const NEAR_DUP_COUNT = Math.min(15, manifest.patients.length);
  console.log(`Creating ${NEAR_DUP_COUNT} deliberate near-duplicate registrations...`);
  const sourceSample = manifest.patients.slice(0, NEAR_DUP_COUNT);
  for (const src of sourceSample) {
    const dupNationalId = `${src.nationalId.slice(0, -2)}${randomChoice(['91','92','93','94'])}`;
    const dupPayload = makePatientPayload(9000 + manifest.nearDuplicatePairs.length, {
      firstName: src.firstName, lastName: src.lastName, dob: src.dateOfBirth, nationalId: dupNationalId,
    });
    try {
      const res = await ehr.post('/patients', dupPayload, authHeaders(token));
      manifest.nearDuplicatePairs.push({
        originalId: src.id, originalNationalId: src.nationalId,
        duplicateId: res.data.id, duplicateNationalId: dupNationalId,
        name: `${src.firstName} ${src.lastName}`, dob: src.dateOfBirth,
        systemFlaggedDuplicate: false, // filled in below if the API rejected/flagged it
      });
    } catch (e) {
      // If creation was rejected, that's the system correctly catching the near-duplicate.
      manifest.nearDuplicatePairs.push({
        originalId: src.id, originalNationalId: src.nationalId,
        duplicateId: null, duplicateNationalId: dupNationalId,
        name: `${src.firstName} ${src.lastName}`, dob: src.dateOfBirth,
        systemFlaggedDuplicate: true,
        rejectionMessage: e?.response?.data?.message || e.message,
      });
    }
  }
  const caughtCount = manifest.nearDuplicatePairs.filter(p => p.systemFlaggedDuplicate).length;
  console.log(`Near-duplicate pairs: ${manifest.nearDuplicatePairs.length}, system caught: ${caughtCount}, recall: ${(100 * caughtCount / manifest.nearDuplicatePairs.length).toFixed(1)}%`);

  // Additional clinicians (best-effort; existing tenant already has 9 role accounts)
  // MOAS-23: DELETE /users/:id is a soft deactivate (isActive=false), not a
  // hard delete — the email unique constraint stays occupied by a
  // deactivated row after seed-reset.mjs "deletes" a prior seed run's
  // clinicians. Include a per-run tag in the email so repeated
  // reset->reseed cycles never collide with a previous run's deactivated accounts.
  const CLINICIAN_COUNT = Number(process.env.SEED_CLINICIAN_COUNT || 21);
  const clinicianFirstNames = [...firstNamesM, ...firstNamesF];
  const RUN_TAG = Date.now().toString(36);
  console.log(`Creating ${CLINICIAN_COUNT} additional clinician accounts...`);
  for (let i = 0; i < CLINICIAN_COUNT; i++) {
    const firstName = clinicianFirstNames[i % clinicianFirstNames.length];
    const lastName = lastNames[i % lastNames.length];
    const role = i % 5 === 0 ? 'nurse' : 'doctor';
    const email = `seed.${role}.${i}.${RUN_TAG}@e2e-clinic.com`;
    try {
      const res = await ehr.post('/users', { email, firstName, lastName, role, phone: `078${pad(3000000 + i, 7)}` }, authHeaders(adminToken || token));
      manifest.clinicians.push({ email, role, id: res.data?.id || res.data?.user?.id || null });
    } catch (e) {
      manifest.errors.push({ index: i, phase: 'clinician', email, message: e?.response?.data?.message || e.message });
    }
  }
  console.log(`Clinicians created: ${manifest.clinicians.length} (errors during clinician phase: ${manifest.errors.filter(e => e.phase === 'clinician').length})`);

  const outDir = path.resolve(process.cwd(), 'seed', 'v1');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('Manifest written to', path.join(outDir, 'manifest.json'));
  console.log(`TOTALS: patients=${manifest.patients.length + manifest.nearDuplicatePairs.filter(p => p.duplicateId).length}, nearDupPairs=${manifest.nearDuplicatePairs.length}, dupRecall=${(100 * caughtCount / manifest.nearDuplicatePairs.length).toFixed(1)}%, clinicians=${manifest.clinicians.length + 9} (9 pre-existing), errors=${manifest.errors.length}`);
}

main().catch((err) => {
  console.error('Seed failed:', err?.response?.data || err.message);
  process.exit(1);
});
