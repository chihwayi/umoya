#!/usr/bin/env node
// Regression for MOAS-16 (B-012/B-014): EHR liveness/readiness contract and
// the six-probe smoke:core release gate.
//
// - /health (liveness) must be 200 while the process runs, with NO tenant
//   context required (no X-Tenant-ID header).
// - /health/ready (readiness) must be 200 only when the master tenant-registry
//   DB is reachable, and 503 when it is not — proven here by actually
//   stopping/starting the postgres-master container, not just code reading.
// - scripts/smoke-core.sh must run all six probes without crashing on .env
//   parsing (the original B-014 failure mode).

import { execSync } from 'node:child_process';

const EHR_URL = process.env.EHR_URL || 'http://localhost:3013';

let pass = true;
function check(label, ok) {
  console.log(`[${label}] ${ok ? 'PASS' : 'FAIL'}`);
  pass = pass && ok;
}

async function getStatus(path, headers = {}) {
  const res = await fetch(`${EHR_URL}${path}`, { headers });
  return res.status;
}

function dockerCmd(cmd) {
  return execSync(cmd, { stdio: 'pipe' }).toString().trim();
}

async function waitFor(predicate, timeoutMs, intervalMs = 1000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

async function main() {
  // --- Liveness: 200, no tenant header required ---
  const livenessStatus = await getStatus('/health');
  check('GET /health returns 200 with no X-Tenant-ID header', livenessStatus === 200);

  // --- Readiness: 200 while DB is healthy ---
  const readyStatusHealthy = await getStatus('/health/ready');
  check('GET /health/ready returns 200 while master DB is reachable', readyStatusHealthy === 200);

  // --- Readiness: 503 when the master DB dependency is actually down ---
  dockerCmd('docker stop umoya-postgres-master');
  await new Promise((r) => setTimeout(r, 2000));

  const livenessDuringOutage = await getStatus('/health');
  check('GET /health stays 200 during a DB outage (proves liveness is dependency-independent)', livenessDuringOutage === 200);

  const readyStatusDown = await getStatus('/health/ready');
  check('GET /health/ready returns 503 when master DB is unreachable', readyStatusDown === 503);

  dockerCmd('docker start umoya-postgres-master');
  const recovered = await waitFor(async () => {
    try {
      dockerCmd('docker exec -i umoya-postgres-master pg_isready -U postgres');
      return true;
    } catch {
      return false;
    }
  }, 40000, 2000);
  check('postgres-master recovered after restart', recovered);

  if (recovered) {
    await new Promise((r) => setTimeout(r, 3000));
    const readyStatusRecovered = await waitFor(async () => (await getStatus('/health/ready')) === 200, 20000, 2000);
    check('GET /health/ready returns 200 again after DB recovery', readyStatusRecovered);
  }

  // --- smoke:core: six probes, no shell-syntax crash on .env parsing ---
  function hostPort(container) {
    const firstLine = dockerCmd(`docker port ${container}`).split('\n')[0];
    return firstLine.split('->')[1].trim().split(':').pop();
  }

  try {
    const ports = {
      TENANT_URL: `http://localhost:${hostPort('umoya-tenant-service')}`,
      EHR_URL: `http://localhost:${hostPort('umoya-ehr-service')}`,
      CDSS_URL: `http://localhost:${hostPort('umoya-cdss-service')}`,
      WEB_ADMIN_URL: `http://localhost:${hostPort('umoya-web-app')}`,
      STAFF_WEB_URL: `http://localhost:${hostPort('umoya-ehr-frontend')}`,
      PATIENT_PORTAL_URL: `http://localhost:${hostPort('umoya-patient-portal')}`,
    };
    const output = execSync('bash scripts/smoke-core.sh', {
      cwd: process.cwd(),
      env: { ...process.env, ...ports },
      stdio: 'pipe',
    }).toString();
    const passCount = (output.match(/^PASS/gm) || []).length;
    check('smoke-core.sh runs without a shell-syntax crash on .env parsing', true);
    check('smoke-core.sh records all six probes as PASS', passCount === 6);
  } catch (err) {
    check('smoke-core.sh runs without a shell-syntax crash on .env parsing', false);
    console.error(err.stdout?.toString() || err.message);
  }

  console.log(pass ? '\nALL PASS' : '\nFAILURES PRESENT');
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
