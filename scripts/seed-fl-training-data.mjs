#!/usr/bin/env node
/*
  Seeds realistic, statistically-correlated synthetic outcome data into the
  e2e-clinic tenant so the federated-learning pipeline
  (federated-learning.service.ts / CDSS /fl/train-local) has enough real rows
  to actually train a meaningful (non-degenerate) classifier for each of the
  4 model types, rather than always hitting the MIN_OUTCOMES=50 skip path.
  All patient/user references are drawn from the tenant's existing synthetic
  patients/users — no new PHI-shaped identities are minted here.

  Correlation is real, not decorative: for each model type, the feature
  values genuinely drive the probability of the "positive" outcome (e.g.
  worse vitals -> higher chance of an actual ICU transfer), so a trained
  GradientBoostingClassifier should recover meaningfully-above-chance AUC,
  not just memorize noise.

  Usage: node scripts/seed-fl-training-data.mjs
*/
import { execSync } from 'node:child_process';

const TENANT_DB = process.env.TENANT_DB || 'clinic_e2e-clinic_db';
const N_PER_MODEL = Number(process.env.FL_SEED_COUNT || 160);
const ONLY = process.env.FL_SEED_ONLY || null; // 'deterioration' | 'readmission' | 'no_show' | 'sepsis'

function psql(sql) {
  execSync(`docker exec -i umoya-postgres-master psql -U postgres -d "${TENANT_DB}" -v ON_ERROR_STOP=1 -q`, {
    input: sql,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
}

function psqlJson(sql) {
  const out = execSync(`docker exec -i umoya-postgres-master psql -U postgres -d "${TENANT_DB}" -v ON_ERROR_STOP=1 -At -F','`, {
    input: sql,
    encoding: 'utf8',
  });
  return out.trim().split('\n').filter(Boolean).map((l) => l.split(','));
}

function rand(min, max) { return min + Math.random() * (max - min); }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
function bernoulli(p) { return Math.random() < p ? 1 : 0; }
function daysAgo(d) { return `NOW() - INTERVAL '${d} days'`; }
function isoDaysAgo(d) { return new Date(Date.now() - d * 86400000).toISOString(); }

async function main() {
  console.log('Fetching patient pool and provider id...');
  const patients = psqlJson('SELECT id, date_of_birth, gender FROM patients ORDER BY random() LIMIT 400;');
  const providerRow = psqlJson("SELECT id FROM users WHERE role IN ('doctor','nurse') LIMIT 1;");
  const providerId = providerRow[0]?.[0];
  if (!providerId) throw new Error('No doctor/nurse user found to attribute records to');
  console.log(`Got ${patients.length} patients, provider ${providerId}`);

  // ── 1. Deterioration: admissions + icu_admissions + deterioration_predictions ──
  if (!ONLY || ONLY === 'deterioration') {
  console.log(`\nSeeding ${N_PER_MODEL} deterioration prediction rows...`);
  const detRows = [];
  const admRows = [];
  const icuRows = [];
  for (let i = 0; i < N_PER_MODEL; i++) {
    const [patientId] = choice(patients);
    const admissionNumber = `FLSEED-ADM-${Date.now().toString(36)}-${i}`;
    const admDaysAgo = randInt(1, 170);
    const admissionId = `gen_random_uuid()`;

    const rr = rand(12, 40); // respiratory rate
    const spo2 = rand(82, 100);
    const sbp = rand(70, 150);
    const hr = rand(55, 160);
    const temp = rand(35.5, 40.5);

    // Genuine risk signal: worse vitals push deterioration probability up.
    const riskScore = sigmoid(
      (rr - 20) * 0.15 + (95 - spo2) * 0.25 + (110 - sbp) * 0.03 + (hr - 90) * 0.03 + (temp - 37) * 0.6 - 1.0
    );
    const deteriorationScore = Math.round(riskScore * 100 * 100) / 100;
    const isPositive = bernoulli(riskScore);

    const admVar = `adm_${i}`;
    admRows.push(`('${admissionNumber}', '${patientId}', NOW() - INTERVAL '${admDaysAgo} days', NOW() - INTERVAL '${admDaysAgo} days', 'emergency', 'Synthetic FL training fixture admission', '${providerId}', 'active')`);

    detRows.push({ patientId, admDaysAgo, rr, spo2, sbp, hr, temp, deteriorationScore, isPositive });
  }

  // Insert admissions first, capturing generated ids in order via RETURNING.
  const admissionIds = psqlJson(`
    INSERT INTO admissions (admission_number, patient_id, admission_date, admission_time, admission_type, admitting_diagnosis, admitting_provider, admission_status)
    VALUES ${admRows.join(',\n')}
    RETURNING id;
  `).map((r) => r[0]);

  const detInsertRows = detRows.map((d, i) => {
    const admissionId = admissionIds[i];
    return `('${d.patientId}', '${admissionId}', NOW() - INTERVAL '${d.admDaysAgo - 0.5} days', ${d.deteriorationScore}, '{"respiratory_rate":${d.rr.toFixed(1)},"spo2":${d.spo2.toFixed(1)},"systolic_bp":${d.sbp.toFixed(1)},"heart_rate":${d.hr.toFixed(1)},"temperature":${d.temp.toFixed(2)}}'::jsonb, ${d.deteriorationScore > 60})`;
  });
  psql(`
    INSERT INTO deterioration_predictions (patient_id, admission_id, prediction_time, deterioration_score, feature_contributions, triggered_alert)
    VALUES ${detInsertRows.join(',\n')};
  `);

  const icuInsertRows = detRows
    .map((d, i) => ({ d, admissionId: admissionIds[i] }))
    .filter(({ d }) => d.isPositive)
    .map(({ d, admissionId }) => `('${d.patientId}', '${admissionId}', NOW() - INTERVAL '${d.admDaysAgo - 1}  days', NOW() - INTERVAL '${d.admDaysAgo - 1}  days', 'ICU', 'unassigned', 'Deteriorating vitals per FL training fixture')`);
  if (icuInsertRows.length) {
    psql(`
      INSERT INTO icu_admissions (patient_id, admission_id, admission_at, icu_admission_date, icu_type, bed_code, admission_diagnosis)
      VALUES ${icuInsertRows.join(',\n')};
    `);
  }
  console.log(`  ${detRows.length} deterioration predictions, ${icuInsertRows.length} real ICU transfers (positives)`);
  }

  // ── 2. Readmission: admissions + readmission_predictions ──
  if (!ONLY || ONLY === 'readmission') {
  console.log(`\nSeeding ${N_PER_MODEL} readmission prediction rows...`);
  const readmRows = [];
  for (let i = 0; i < N_PER_MODEL; i++) {
    const [patientId] = choice(patients);
    const priorAdmissions90d = randInt(0, 4);
    const comorbidityCount = randInt(0, 5);
    const riskScore = sigmoid(priorAdmissions90d * 0.6 + comorbidityCount * 0.35 - 1.5);
    const predictionDaysAgo = randInt(5, 175);
    const willReadmit = bernoulli(riskScore);
    readmRows.push({ patientId, priorAdmissions90d, comorbidityCount, riskScore, predictionDaysAgo, willReadmit });
  }

  // Index admission must be strictly before prediction_date's whole day, or
  // truncating prediction_date to a bare DATE (midnight) while admission_date
  // keeps a same-day time-of-day makes admission_date > prediction_date true
  // for the index admission itself, causing it to spuriously match its own
  // 30-day readmission-lookahead window (a self-referential false positive
  // discovered live: a first pass produced 160/160 "readmitted" rows).
  const indexAdmRows = readmRows.map((r, i) =>
    `('FLSEED-IDX-${Date.now().toString(36)}-${i}', '${r.patientId}', NOW() - INTERVAL '${r.predictionDaysAgo + 1} days', NOW() - INTERVAL '${r.predictionDaysAgo + 1} days', 'emergency', 'Synthetic FL training fixture index admission', '${providerId}', 'discharged')`
  );
  const indexAdmissionIds = psqlJson(`
    INSERT INTO admissions (admission_number, patient_id, admission_date, admission_time, admission_type, admitting_diagnosis, admitting_provider, admission_status)
    VALUES ${indexAdmRows.join(',\n')}
    RETURNING id;
  `).map((r) => r[0]);

  const readmPredRows = readmRows.map((r) =>
    `('${r.patientId}', TO_DATE((NOW() - INTERVAL '${r.predictionDaysAgo} days')::text, 'YYYY-MM-DD'), ${r.riskScore.toFixed(4)}, '${r.riskScore > 0.5 ? 'high' : 'low'}', '[]'::jsonb)`
  );
  psql(`
    INSERT INTO readmission_predictions (patient_id, prediction_date, readmission_30day_risk, risk_category, key_risk_factors)
    VALUES ${readmPredRows.join(',\n')};
  `);

  const readmitAdmRows = readmRows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.willReadmit && r.predictionDaysAgo > 20)
    .map(({ r, i }) => `('FLSEED-READM-${Date.now().toString(36)}-${i}', '${r.patientId}', NOW() - INTERVAL '${r.predictionDaysAgo - 15} days', NOW() - INTERVAL '${r.predictionDaysAgo - 15} days', 'urgent', 'Synthetic FL training fixture readmission', '${providerId}', 'discharged')`);
  let readmitCount = 0;
  if (readmitAdmRows.length) {
    psql(`
      INSERT INTO admissions (admission_number, patient_id, admission_date, admission_time, admission_type, admitting_diagnosis, admitting_provider, admission_status)
      VALUES ${readmitAdmRows.join(',\n')};
    `);
    readmitCount = readmitAdmRows.length;
  }
  console.log(`  ${readmRows.length} readmission predictions, ${readmitCount} real 30-day readmissions (positives)`);
  }

  // ── 3. No-show: appointments + scheduling_ai_predictions ──
  if (!ONLY || ONLY === 'no_show') {
  console.log(`\nSeeding ${N_PER_MODEL} appointment/no-show rows...`);
  const doctorRow = psqlJson("SELECT id FROM users WHERE role='doctor' LIMIT 1;");
  const doctorId = doctorRow[0]?.[0] || providerId;
  const apptRows = [];
  for (let i = 0; i < N_PER_MODEL; i++) {
    const [patientId] = choice(patients);
    const dayOfWeek = randInt(0, 6);
    const hourOfDay = randInt(7, 18);
    const daysInFuture = randInt(-170, -1);
    // Genuine risk signal: Monday/weekend + very early appointments no-show more.
    const riskScore = sigmoid((dayOfWeek === 0 || dayOfWeek === 1 ? 0.6 : 0) + (hourOfDay <= 8 ? 0.7 : 0) - 1.1);
    const noShow = bernoulli(riskScore);
    apptRows.push({ patientId, dayOfWeek, hourOfDay, daysInFuture, riskScore, noShow });
  }
  const apptInsertRows = apptRows.map((a) =>
    `('${a.patientId}', '${doctorId}', (NOW() + INTERVAL '${a.daysInFuture} days')::date + TIME '${String(a.hourOfDay).padStart(2, '0')}:00:00', 'consultation', ${a.noShow ? "'no_show'" : "'completed'"}, 'payment_confirmed')`
  );
  const apptIds = psqlJson(`
    INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_type, status, payment_status)
    VALUES ${apptInsertRows.join(',\n')}
    RETURNING id;
  `).map((r) => r[0]);

  const schedPredRows = apptRows.map((a, i) =>
    `('${apptIds[i]}', ${a.riskScore.toFixed(4)}, ${(a.riskScore * 0.4).toFixed(4)}, 30, 0.75, '{}'::jsonb, 'fl-training-fixture', NOW() - INTERVAL '${Math.abs(a.daysInFuture) + 3} days')`
  );
  psql(`
    INSERT INTO scheduling_ai_predictions (appointment_id, no_show_probability, cancel_probability, recommended_duration, confidence_score, feature_importance, model, prediction_date)
    VALUES ${schedPredRows.join(',\n')};
  `);
  const noShowCount = apptRows.filter((a) => a.noShow).length;
  console.log(`  ${apptRows.length} appointments, ${noShowCount} real no-shows (positives)`);
  }

  // ── 4. Sepsis: sepsis_screenings ──
  if (!ONLY || ONLY === 'sepsis') {
  console.log(`\nSeeding ${N_PER_MODEL} sepsis screening rows...`);
  const sepsisRows = [];
  for (let i = 0; i < N_PER_MODEL; i++) {
    const [patientId] = choice(patients);
    const rr = rand(14, 38);
    const hr = rand(60, 150);
    const temp = rand(35.5, 40.0);
    const sbp = rand(75, 145);
    const wbc = rand(3, 24);
    const lactate = rand(0.5, 6.5);
    const qsofa = (rr >= 22 ? 1 : 0) + (sbp <= 100 ? 1 : 0) + bernoulli(0.15);
    const riskScore = sigmoid((lactate - 2) * 0.6 + (wbc - 11) * 0.12 + qsofa * 0.7 + (temp - 37.5) * 0.3 - 0.8);
    const severe = bernoulli(riskScore);
    const shock = severe && bernoulli(0.3);
    sepsisRows.push({ patientId, rr, hr, temp, sbp, wbc, lactate, qsofa, severe, shock });
  }
  const sepsisInsertRows = sepsisRows.map((s) =>
    `('${s.patientId}', NOW() - INTERVAL '${randInt(1, 170)} days', 'ED', ${s.qsofa}, ${s.temp.toFixed(2)}, ${Math.round(s.hr)}, ${Math.round(s.rr)}, ${Math.round(s.sbp)}, ${(98 - s.rr * 0.3).toFixed(0)}, ${s.wbc.toFixed(2)}, ${s.lactate.toFixed(2)}, ${s.severe ? 'true' : 'false'}, ${s.severe ? 'true' : 'false'}, ${s.shock ? 'true' : 'false'}, '${providerId}')`
  );
  psql(`
    INSERT INTO sepsis_screenings (patient_id, screening_datetime, screening_location, qsofa_score, temperature, heart_rate, respiratory_rate, systolic_bp, oxygen_saturation, wbc_count, lactate, sepsis_suspected, severe_sepsis, septic_shock, screened_by)
    VALUES ${sepsisInsertRows.join(',\n')};
  `);
  const severeCount = sepsisRows.filter((s) => s.severe).length;
  console.log(`  ${sepsisRows.length} sepsis screenings, ${severeCount} severe/shock (positives)`);
  }

  console.log('\nFL training data seed complete.');
}

main().catch((err) => {
  console.error('FL training data seed failed:', err.message);
  process.exit(1);
});
