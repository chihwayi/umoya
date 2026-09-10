#!/usr/bin/env node
// Regression for TERM-09..TERM-12: SNOMED spec-completeness items explicitly
// requested (stated-vs-inferred distinction, version/effective-time
// awareness, ECL, FHIR Terminology Service operations). Runs against the
// real SNOMED CT / ICD-10-CM data loaded in TERM-01..03 (gap A-015
// resolution) -- no synthetic fixtures.

const EHR_API_URL = process.env.EHR_API_URL || 'http://localhost:3013/api';
const TENANT_ID = process.env.TENANT_ID || 'e2e-clinic';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@e2e-clinic.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Umoya1#';

async function login() {
  const res = await fetch(`${EHR_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const data = await res.json();
  if (!data.token) throw new Error('Login failed');
  return data.token;
}

function headers(token) {
  return { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID, Authorization: `Bearer ${token}` };
}

async function get(path, token) {
  const res = await fetch(`${EHR_API_URL}${path}`, { headers: headers(token) });
  return { status: res.status, body: await res.json() };
}

async function main() {
  const token = await login();
  let pass = true;
  const check = (label, ok, detail = '') => {
    console.log(`[${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? ` (${detail})` : ''}`);
    pass = pass && ok;
  };

  // TERM-09: stated vs inferred distinction — Diabetes mellitus (73211009)
  // has 2 inferred parents but only 1 stated parent (the other is
  // classifier-derived through a role chain, not directly authored).
  const details = await get('/terminology/snomed/concepts/73211009/details', token);
  check('concept details includes both parents (inferred) and statedParents (authored)',
    Array.isArray(details.body.parents) && Array.isArray(details.body.statedParents), `parents=${details.body.parents?.length}, statedParents=${details.body.statedParents?.length}`);
  check('stated parents is a real subset smaller than inferred parents for 73211009',
    details.body.statedParents.length > 0 && details.body.statedParents.length < details.body.parents.length,
    `inferred=${details.body.parents.length}, stated=${details.body.statedParents.length}`);

  // TERM-10: version/effective-time awareness.
  const releases = await get('/terminology/releases', token);
  check('GET /terminology/releases returns real version history', Array.isArray(releases.body) && releases.body.length >= 2, `${releases.body.length} entries`);

  const oldDateCheck = await get('/terminology/snomed/validate/1163582002?asOfDate=2019-01-01', token);
  check('validate-concept with an asOfDate before a real concept\'s effective_time returns a versionWarning',
    typeof oldDateCheck.body.versionWarning === 'string' && oldDateCheck.body.versionWarning.length > 0);

  const currentDateCheck = await get('/terminology/snomed/validate/1163582002?asOfDate=2026-09-07', token);
  check('validate-concept with a current asOfDate returns no versionWarning', !currentDateCheck.body.versionWarning);

  // TERM-11: ECL support — real hierarchy-constrained search.
  const unrestricted = await get('/terminology/snomed/search?term=diabetes&limit=5', token);
  const eclRestricted = await get('/terminology/snomed/search?term=diabetes&limit=5&ecl=%3C126877002', token);
  const eclExcluded = await get('/terminology/snomed/search?term=diabetes&limit=5&ecl=%3C71388002', token);
  check('ECL <126877002 (glucose metabolism disorders) meaningfully narrows an unrestricted search',
    eclRestricted.body.total > 0 && eclRestricted.body.total < unrestricted.body.total,
    `unrestricted=${unrestricted.body.total}, restricted=${eclRestricted.body.total}`);
  check('ECL against an unrelated hierarchy branch (<71388002, Procedure) correctly excludes all diabetes disorders',
    eclExcluded.body.total === 0);

  // TERM-12: FHIR Terminology Service operations.
  const lookupSnomed = await get('/terminology/fhir/CodeSystem/lookup?system=http://snomed.info/sct&code=73211009', token);
  check('FHIR $lookup resolves a real SNOMED concept',
    lookupSnomed.body.resourceType === 'Parameters' && lookupSnomed.body.parameter.some((p) => p.name === 'display' && p.valueString === 'Diabetes mellitus'));

  const lookupIcd10 = await get('/terminology/fhir/CodeSystem/lookup?system=http://hl7.org/fhir/sid/icd-10-cm&code=E119', token);
  check('FHIR $lookup resolves a real ICD-10-CM code',
    lookupIcd10.body.resourceType === 'Parameters' && lookupIcd10.body.parameter.some((p) => p.name === 'display' && /diabetes/i.test(p.valueString || '')));

  const validateInvalid = await get('/terminology/fhir/CodeSystem/validate-code?system=http://snomed.info/sct&code=999999999999', token);
  check('FHIR $validate-code correctly rejects a fabricated concept ID',
    validateInvalid.body.parameter?.some((p) => p.name === 'result' && p.valueBoolean === false));

  const subsumes = await get('/terminology/fhir/CodeSystem/subsumes?system=http://snomed.info/sct&codeA=126877002&codeB=73211009', token);
  check('FHIR $subsumes correctly identifies a real ancestor-descendant relationship',
    subsumes.body.parameter?.[0]?.valueCode === 'subsumes');

  const expand = await get('/terminology/fhir/ValueSet/expand?ecl=%3C126877002&count=5', token);
  check('FHIR $expand returns a real ValueSet expansion using ECL', expand.body.resourceType === 'ValueSet' && expand.body.expansion.total > 0, `total=${expand.body.expansion?.total}`);

  console.log(pass ? '\nALL PASS' : '\nFAILURES PRESENT');
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
