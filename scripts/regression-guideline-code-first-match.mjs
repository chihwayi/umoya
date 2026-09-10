#!/usr/bin/env node
// Regression for MOAS-09 / A-008 (guideline retrieval must match on coded
// diagnosis (ICD-10/SNOMED) before falling back to free-text condition
// matching, so clinically-equivalent synonyms not present in the free-text
// alias/keyword lists still resolve to the correct governed guideline).

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

async function getGuidelines(headers, condition, diagnosisCode) {
  const res = await fetch(`${EHR_API_URL}/cdss/guidelines`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ condition, diagnosisCode }),
  });
  return res.json();
}

async function main() {
  const token = await login();
  const headers = { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID, Authorization: `Bearer ${token}` };
  let pass = true;

  // 1. Known synonyms already covered by free-text aliases/keywords resolve without a code.
  const knownVariants = ['HTN', 'high blood pressure', 'hypertension', 'elevated bp'];
  for (const variant of knownVariants) {
    const result = await getGuidelines(headers, variant);
    const ok = result.guidelines?.[0]?.condition === 'hypertension';
    console.log(`[free-text "${variant}"] resolves to hypertension: ${ok ? 'PASS' : 'FAIL'}`);
    pass = pass && ok;
  }

  // 2. A synonym NOT covered by free-text aliases/keywords fails without a code.
  const uncoveredNoCode = await getGuidelines(headers, 'raised blood pressure');
  const uncoveredFailsAsExpected = (uncoveredNoCode.guidelines || []).length === 0;
  console.log(`[free-text "raised blood pressure", no code] correctly finds nothing: ${uncoveredFailsAsExpected ? 'PASS' : 'FAIL'}`);
  pass = pass && uncoveredFailsAsExpected;

  // 3. The same uncovered synonym resolves when the coded diagnosis is supplied.
  const uncoveredWithCode = await getGuidelines(headers, 'raised blood pressure', 'I10');
  const codeRescues = uncoveredWithCode.guidelines?.[0]?.condition === 'hypertension';
  console.log(`[free-text "raised blood pressure" + diagnosisCode I10] resolves to hypertension: ${codeRescues ? 'PASS' : 'FAIL'}`);
  pass = pass && codeRescues;

  // 4. A completely unrelated free-text label resolves purely off a coded diagnosis (diabetes).
  const diabetesByCode = await getGuidelines(headers, 'sugar sickness xyz', 'E11.9');
  const diabetesOk = diabetesByCode.guidelines?.[0]?.condition === 'diabetes_type2';
  console.log(`[unrelated text + diagnosisCode E11.9] resolves to diabetes_type2: ${diabetesOk ? 'PASS' : 'FAIL'}`);
  pass = pass && diabetesOk;

  // 5. An unmatched condition + unmatched code still degrades gracefully (no crash, empty guidelines).
  const noMatch = await getGuidelines(headers, 'sugar sickness xyz', 'Z99.9');
  const gracefulFallback = Array.isArray(noMatch.guidelines) && noMatch.guidelines.length === 0 && typeof noMatch.recommendations?.[0] === 'string';
  console.log(`[unrelated text + unmatched code] degrades gracefully: ${gracefulFallback ? 'PASS' : 'FAIL'}`);
  pass = pass && gracefulFallback;

  console.log(pass ? '\nALL PASS' : '\nFAILURES PRESENT');
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
