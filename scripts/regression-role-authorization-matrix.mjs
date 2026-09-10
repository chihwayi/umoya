#!/usr/bin/env node
// Regression for MOAS-20 (A-004, §51): live, authenticated persona-by-endpoint
// authorization checks. A-004's original finding was one concrete case
// (pharmacist reading GET /finance/transactions); MOAS-20 generalized the
// static inventory (scripts/audit-role-authorization-matrix.mjs) across all
// controllers and fixed every real gap it found in the financial/billing/
// claims/admin-reporting domains. This script proves the fix live: for a
// representative set of sensitive endpoints, roles that should be blocked
// get 401/403, and roles that should be allowed do not get blocked.

const EHR_API_URL = process.env.EHR_API_URL || 'http://localhost:3013/api';
const TENANT_ID = process.env.TENANT_ID || 'e2e-clinic';

const CREDENTIALS = {
  doctor: { email: 'doctor@e2e-clinic.com', password: 'Demo1234!' },
  nurse: { email: 'nurse@e2e-clinic.com', password: 'Demo1234!' },
  accounts: { email: 'accounts@e2e-clinic.com', password: 'Umoya1#' },
  admin: { email: 'admin@e2e-clinic.com', password: 'Umoya1#' },
  pharmacist: { email: 'pharmacist@e2e-clinic.com', password: 'Umoya1#' },
  radiologist: { email: 'radiologist@e2e-clinic.com', password: 'Umoya1#' },
  receptionist: { email: 'receptionist@e2e-clinic.com', password: 'Umoya1#' },
  lab_tech: { email: 'lab@e2e-clinic.com', password: 'Umoya1#' },
};

let pass = true;
function check(label, ok) {
  console.log(`[${label}] ${ok ? 'PASS' : 'FAIL'}`);
  pass = pass && ok;
}

async function login(role) {
  const creds = CREDENTIALS[role];
  const res = await fetch(`${EHR_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID },
    body: JSON.stringify(creds),
  });
  const data = await res.json();
  if (!data.token) throw new Error(`Login failed for ${role}: ${JSON.stringify(data)}`);
  return data.token;
}

async function call(token, method, path) {
  const res = await fetch(`${EHR_API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID, Authorization: `Bearer ${token}` },
  });
  return res.status;
}

async function main() {
  const tokens = {};
  for (const role of Object.keys(CREDENTIALS)) {
    tokens[role] = await login(role);
  }

  // Endpoint -> { allowed: [roles that should NOT get 401/403], blocked: [roles that MUST get 401/403] }
  const cases = [
    { method: 'GET', path: '/finance/transactions', allowed: ['accounts'], blocked: ['pharmacist', 'radiologist', 'receptionist', 'lab_tech'] },
    { method: 'GET', path: '/billing/bills', allowed: ['accounts'], blocked: ['pharmacist', 'radiologist', 'lab_tech'] },
    { method: 'GET', path: '/claims', allowed: ['accounts'], blocked: ['pharmacist', 'radiologist', 'receptionist', 'lab_tech'] },
    { method: 'GET', path: '/financial-reports/revenue', allowed: ['accounts'], blocked: ['pharmacist', 'radiologist', 'nurse', 'lab_tech'] },
    { method: 'GET', path: '/payment-reconciliation/report', allowed: ['accounts'], blocked: ['pharmacist', 'nurse', 'radiologist'] },
    { method: 'GET', path: '/himis/submissions', allowed: ['admin'], blocked: ['pharmacist', 'nurse', 'doctor', 'accounts'] },
    { method: 'GET', path: `/tenants/${TENANT_ID}/module-reports`, allowed: ['admin'], blocked: ['pharmacist', 'nurse', 'accounts'] },
    { method: 'GET', path: '/reports/financial', allowed: ['accounts'], blocked: ['pharmacist', 'radiologist', 'lab_tech'] },
    // Clinical reports remain intentionally open to clinical staff (not a
    // security bug — doctors/nurses need these).
    { method: 'GET', path: '/reports/clinical', allowed: ['doctor', 'nurse'], blocked: [] },
  ];

  for (const c of cases) {
    for (const role of c.allowed) {
      const status = await call(tokens[role], c.method, c.path);
      check(`${role} ${c.method} ${c.path} → not blocked (got ${status})`, status !== 401 && status !== 403);
    }
    for (const role of c.blocked) {
      const status = await call(tokens[role], c.method, c.path);
      check(`${role} ${c.method} ${c.path} → correctly blocked (got ${status})`, status === 401 || status === 403);
    }
  }

  console.log(pass ? '\nALL PASS' : '\nFAILURES PRESENT');
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
