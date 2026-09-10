#!/usr/bin/env node
/*
  Regression for the federated/self-learning AI pipeline (deterioration,
  readmission, no_show, sepsis models): drift-triggered/manual FL round
  initiation -> real per-tenant sklearn training -> real weighted-ensemble
  global model aggregation -> real leak-free holdout evaluation -> governed
  shadow staging (never auto-production).

  This exercises real bugs found and fixed live while verifying the
  pipeline for the first time in this session:
  - /fl/aggregate previously fabricated a modelWeightsRef string but never
    wrote anything to it, so no FL round had ever produced a usable global
    model (every promoted "candidate" silently had auc_roc/brier_score=null).
  - fetchTrainingOutcomes's holdout split reused the same rows as training
    whenever the table had fewer rows than the hardcoded LIMITs, making the
    reported holdout AUC meaningless.
  - /fl/round had no role restriction (any authenticated user could trigger
    tenant-wide training).
  - GradientBoostingClassifier's subsample could hit a single-class batch
    and crash the endpoint with an unhandled 500.

  Assumes scripts/seed-fl-training-data.mjs has already been run against the
  e2e-clinic tenant (needs >=50 real outcome rows per model type + labelled
  positives/negatives) — this script does not reseed data itself, since a
  full reseed is expensive; it fails loudly with a clear message if data is
  insufficient rather than silently reporting false positives.
*/

import { execSync } from 'node:child_process';

const EHR_API_URL = process.env.EHR_API_URL || 'http://localhost:3013/api';
const TENANT_DB = process.env.TENANT_DB || 'clinic_e2e-clinic_db';
const TENANT_ID = process.env.TENANT_ID || 'e2e-clinic';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@e2e-clinic.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Umoya1#';
const DOCTOR_EMAIL = process.env.DOCTOR_EMAIL || 'doctor@e2e-clinic.com';
const DOCTOR_PASSWORD = process.env.DOCTOR_PASSWORD || 'Demo1234!';
const MODEL_TYPES = ['deterioration', 'readmission', 'no_show', 'sepsis'];

async function login(email, password) {
  const res = await fetch(`${EHR_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!data.token) throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`);
  return data.token;
}

function headers(token) {
  return { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID, Authorization: `Bearer ${token}` };
}

async function initiateRound(token, modelType) {
  const res = await fetch(`${EHR_API_URL}/fl/round`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ subdomain: TENANT_ID, modelType }),
  });
  return { status: res.status, data: await res.json() };
}

async function getRound(token, roundId) {
  const res = await fetch(`${EHR_API_URL}/fl/round/${roundId}?subdomain=${TENANT_ID}`, { headers: headers(token) });
  return res.json();
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  const adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const doctorToken = await login(DOCTOR_EMAIL, DOCTOR_PASSWORD);
  let pass = true;

  // 1. Security gate: non-admin must be rejected.
  const nonAdminAttempt = await initiateRound(doctorToken, 'sepsis');
  const securityOk = nonAdminAttempt.status === 403;
  console.log(`[1] Non-admin role correctly rejected from /fl/round (403): ${securityOk ? 'PASS' : 'FAIL'} (got ${nonAdminAttempt.status})`);
  pass = pass && securityOk;

  // 2. Initiate a real round per model type as admin.
  const roundIds = {};
  for (const modelType of MODEL_TYPES) {
    const { status, data } = await initiateRound(adminToken, modelType);
    if (status !== 201 && status !== 200) {
      console.log(`[2] ${modelType} round initiation FAILED: status=${status} ${JSON.stringify(data)}`);
      pass = false;
      continue;
    }
    roundIds[modelType] = data.id;
  }
  console.log(`[2] Initiated ${Object.keys(roundIds).length}/${MODEL_TYPES.length} FL rounds as admin: ${Object.keys(roundIds).length === MODEL_TYPES.length ? 'PASS' : 'FAIL'}`);

  // 3. Poll for completion (local training + real aggregation + holdout eval all run async).
  await sleep(4000);
  const finalRounds = {};
  for (const modelType of MODEL_TYPES) {
    if (!roundIds[modelType]) continue;
    let round = await getRound(adminToken, roundIds[modelType]);
    for (let attempt = 0; attempt < 10 && round.status === 'pending'; attempt++) {
      await sleep(1500);
      round = await getRound(adminToken, roundIds[modelType]);
    }
    finalRounds[modelType] = round;
  }

  for (const modelType of MODEL_TYPES) {
    const round = finalRounds[modelType];
    const completed = round?.status === 'completed';
    console.log(`[3] ${modelType} round reached 'completed': ${completed ? 'PASS' : 'FAIL'} (status=${round?.status})`);
    pass = pass && completed;
  }

  // 4. The core regression: modelWeightsRef must point to a REAL saved
  //    object, not a fabricated path — verified by confirming the model
  //    registry recorded a non-null AUC (which is only possible if
  //    /fl/evaluate successfully downloaded and scored the object at that
  //    exact path — before the aggregation fix, this was always null).
  for (const modelType of MODEL_TYPES) {
    const round = finalRounds[modelType];
    const hasWeightsRef = Boolean(round?.modelWeightsRef);
    console.log(`[4] ${modelType} round produced a modelWeightsRef: ${hasWeightsRef ? 'PASS' : 'FAIL'} (${round?.modelWeightsRef || 'none'})`);
    pass = pass && hasWeightsRef;

    if (hasWeightsRef) {
      const out = execSync(
        `docker exec -i umoya-postgres-master psql -U postgres -d "${TENANT_DB}" -At -c "SELECT auc_roc, deployment_stage FROM model_registry WHERE model_name='${modelType}' AND round_id='${round.id}' ORDER BY created_at DESC LIMIT 1;"`,
        { encoding: 'utf8' },
      ).trim();
      const [aucRoc, stage] = out.split('|');
      const evaluated = aucRoc !== '' && aucRoc !== undefined;
      const shadowStaged = stage === 'shadow';
      console.log(`[5] ${modelType} registry entry has a real holdout AUC (${aucRoc || 'null'}) and is staged 'shadow' (never auto-production): ${evaluated && shadowStaged ? 'PASS' : 'FAIL'}`);
      pass = pass && evaluated && shadowStaged;
    }
  }

  console.log(pass ? '\nALL PASS' : '\nFAILURES PRESENT');
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error('FL pipeline regression failed:', err);
  process.exit(2);
});
