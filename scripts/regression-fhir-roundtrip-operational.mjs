#!/usr/bin/env node
// Regression for MOAS-15 (B-003): FHIR operational/reference resources —
// Location, Organization, Practitioner, PractitionerRole, CarePlan — must
// reconcile with the CapabilityStatement (declared interactions must match
// what the controller actually implements) and, where declared, return
// real per-tenant data rather than a hardcoded placeholder.

const EHR_API_URL = process.env.EHR_API_URL || 'http://localhost:3013/api';
const TENANT_ID = process.env.TENANT_ID || 'e2e-clinic';
const DOCTOR_EMAIL = process.env.DOCTOR_EMAIL || 'doctor@e2e-clinic.com';
const DOCTOR_PASSWORD = process.env.DOCTOR_PASSWORD || 'Demo1234!';

let pass = true;
function check(label, ok) {
  console.log(`[${label}] ${ok ? 'PASS' : 'FAIL'}`);
  pass = pass && ok;
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

async function main() {
  const { token, doctorId } = await login();
  const headers = { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID, Authorization: `Bearer ${token}` };

  // --- Location / Organization now reflect the real tenant, not a hardcoded placeholder ---
  const locationBundle = await (await fetch(`${EHR_API_URL}/fhir/Location`, { headers })).json();
  const locationName = locationBundle.entry?.[0]?.resource?.name;
  check('Location returns the real tenant clinic name, not the "Umoya Clinic" placeholder', locationName === 'E2E Test Clinic');

  const orgBundle = await (await fetch(`${EHR_API_URL}/fhir/Organization`, { headers })).json();
  const orgName = orgBundle.entry?.[0]?.resource?.name;
  check('Organization returns the real tenant clinic name, not the "Umoya Solutions" placeholder', orgName === 'E2E Test Clinic');

  const orgTelecom = orgBundle.entry?.[0]?.resource?.telecom;
  check('Organization telecom reflects real tenant contact info', orgTelecom?.some((t) => t.system === 'email' && t.value === 'admin@e2e-clinic.umoya.health'));

  // --- Practitioner is genuinely backed by the users table (was already correct) ---
  const practitionerGet = await (await fetch(`${EHR_API_URL}/fhir/Practitioner/${doctorId}`, { headers })).json();
  check('Practitioner GET returns the real logged-in doctor', practitionerGet?.id === doctorId);

  // --- CapabilityStatement reconciliation: every resource's declared
  // interactions must match what the controller can actually do. Spot-check
  // the read-only resources fixed/confirmed in this ticket.
  const metadata = await (await fetch(`${EHR_API_URL}/fhir/metadata`, { headers })).json();
  const resourceCapability = (type) => metadata.rest?.[0]?.resource?.find((r) => r.type === type);

  for (const type of ['Location', 'Organization', 'Practitioner', 'PractitionerRole', 'CarePlan', 'ImagingStudy']) {
    const cap = resourceCapability(type);
    const codes = cap?.interaction?.map((i) => i.code) || [];
    const readOnlyCorrect = codes.includes('read') && codes.includes('search-type') && !codes.includes('create') && !codes.includes('update');
    check(`${type} CapabilityStatement declares read+search only (no create/update, matching controller)`, readOnlyCorrect);
  }

  // Reconciliation: every resource the controller actually implements a
  // route for must appear in the CapabilityStatement (no orphaned routes).
  const declaredTypes = new Set((metadata.rest?.[0]?.resource || []).map((r) => r.type));
  const expectedTypes = [
    'Patient', 'Observation', 'Encounter', 'MedicationRequest', 'Medication', 'MedicationDispense',
    'DiagnosticReport', 'Condition', 'AllergyIntolerance', 'ServiceRequest', 'DocumentReference',
    'Immunization', 'Procedure', 'CarePlan', 'Location', 'Organization', 'Practitioner', 'PractitionerRole',
    'ImagingStudy',
  ];
  const allDeclared = expectedTypes.every((t) => declaredTypes.has(t));
  check('CapabilityStatement inventory reconciles: every controller-implemented resource is declared', allDeclared);

  console.log(pass ? '\nALL PASS' : '\nFAILURES PRESENT');
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
