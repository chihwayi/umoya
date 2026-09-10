#!/usr/bin/env node
// Regression for MOAS-01 / A-003 (DAT-030): quantifies duplicate-patient
// detection recall against a seeded near-duplicate batch, plus a
// genuinely-distinct control batch to confirm 0% false-accept.

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

async function createPatient(token, payload) {
  const res = await fetch(`${EHR_API_URL}/patients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID, Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return { status: res.status, data };
}

import { randomInt, randomBytes } from 'node:crypto';

// A well-distributed per-run salt (not a near-adjacent value across runs a
// few seconds apart, unlike a raw Date.now()-derived string, which produces
// near-identical-looking name strings between quick successive runs and
// caused false "duplicate" collisions across runs of this very script).
const RUN_SALT = randomInt(0, 2 ** 31);
const RUN_TAG = randomBytes(4).toString('hex'); // 8 hex chars, high entropy, no numeric adjacency

const FIRST_NAME_POOL = ['Blessing', 'Tariro', 'Farai', 'Nyasha', 'Tendai', 'Rutendo', 'Kudzai', 'Anesu', 'Simba', 'Chiedza', 'Munyaradzi', 'Vimbai'];
const LAST_NAME_POOL = ['Moyo', 'Dube', 'Ncube', 'Chikafu', 'Mhlanga', 'Gutu', 'Sithole', 'Mlambo', 'Zhou', 'Chirwa'];

// Multiplicative hash for good avalanche: small changes in `i` or the salt
// produce large, non-adjacent changes in the output, so two runs' index-i
// records never look like near-duplicates of each other.
function hash(i, salt) {
  let h = (i + 1) * 2654435761 + salt;
  h = (h ^ (h >>> 16)) >>> 0;
  h = (h * 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  return h;
}

function basePatient(i, overrides = {}) {
  const h = hash(i, RUN_SALT);
  const firstName = FIRST_NAME_POOL[h % FIRST_NAME_POOL.length];
  // A-018: append the per-run tag to the surname so this run's synthetic
  // patients occupy a name namespace no other run (of this script, or of
  // seed-audit-v1.js's separate small name pool) can ever coincidentally
  // reproduce. The near-duplicate pair still shares the exact same
  // firstName+lastName+DOB (both derived from basePatient(1000+i)), so the
  // fuzzy-match detection under test is unaffected; only cross-run/
  // cross-fixture false collisions are eliminated.
  const lastName = `${LAST_NAME_POOL[(h >>> 8) % LAST_NAME_POOL.length]}-${RUN_TAG}`;
  const year = 1955 + (h % 45);
  const month = 1 + ((h >>> 4) % 12);
  const day = 1 + ((h >>> 8) % 27);
  const uniqueTag = `${RUN_TAG}${(h % 100000).toString(36)}`;
  return {
    firstName,
    lastName,
    dateOfBirth: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    gender: i % 2 === 0 ? 'male' : 'female',
    nationalId: `63-${uniqueTag}-R${String(i).padStart(3, '0')}`,
    phone: `077${(h % 10000000).toString().padStart(7, '0')}`,
    address: `${i} Regression Ave`,
    city: 'Harare',
    emergencyContactName: 'Regression Contact',
    emergencyContactPhone: `078${((h >>> 3) % 10000000).toString().padStart(7, '0')}`,
    emergencyContactRelationship: 'Friend',
    ...overrides,
  };
}

async function main() {
  const token = await login();
  const N = 20;
  let caughtCount = 0;
  let falseAcceptCount = 0;

  console.log(`Creating ${N} originals + ${N} deliberate near-duplicates...`);
  for (let i = 0; i < N; i += 1) {
    const original = basePatient(1000 + i);
    const created = await createPatient(token, original);
    if (created.status !== 201) {
      console.error(`Original #${i} failed to create:`, created.data);
      continue;
    }

    // Near-duplicate: identical name + DOB, different national ID/phone.
    const dup = basePatient(1000 + i, {
      nationalId: `63-${Date.now().toString().slice(-6)}${i}-D-99`,
      phone: `07${79000000 + i}`,
    });
    const dupResult = await createPatient(token, dup);
    if (dupResult.status === 409 && dupResult.data?.code === 'POSSIBLE_DUPLICATE_PATIENT') {
      caughtCount += 1;
    } else {
      console.warn(`Near-dup #${i} NOT caught: status=${dupResult.status}`, dupResult.data?.message || '');
    }
  }

  console.log(`\nCreating ${N} genuinely-distinct control patients (different name+DOB each)...`);
  for (let i = 0; i < N; i += 1) {
    const distinct = basePatient(2000 + i);
    const result = await createPatient(token, distinct);
    if (result.status !== 201) {
      falseAcceptCount += 1; // "false accept" here means falsely BLOCKED
      console.warn(`Control #${i} incorrectly blocked: status=${result.status}`, result.data?.message || '');
    }
  }

  const recall = (100 * caughtCount) / N;
  const falseBlockRate = (100 * falseAcceptCount) / N;

  console.log('\n=== MOAS-01 / A-003 regression results ===');
  console.log(`Near-duplicate recall: ${caughtCount}/${N} = ${recall.toFixed(1)}% (threshold: >=95%)`);
  console.log(`Distinct-patient false-block rate: ${falseAcceptCount}/${N} = ${falseBlockRate.toFixed(1)}% (threshold: 0%)`);

  const pass = recall >= 95 && falseBlockRate === 0;
  console.log(pass ? '\nPASS' : '\nFAIL');
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error('Regression failed:', err);
  process.exit(2);
});
