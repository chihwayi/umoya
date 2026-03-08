#!/usr/bin/env node
/**
 * Secret rotation and key age policy checks (Sprint D4).
 * Exits 0 if checks pass, 1 if required secrets missing or key age exceeds policy.
 * Usage: node scripts/check-secret-rotation.js
 * Env: SECRET_KEY_MAX_AGE_DAYS (default 365), KEY_LAST_ROTATED_ISO (optional, e.g. 2025-01-01)
 */
const requiredSecrets = [
  'JWT_SECRET',
  'TENANT_DB_ENCRYPTION_KEY',
].filter(() => true);

const optionalButRecommended = [
  'CDSS_ENCRYPTION_KEY',
  'SMTP_PASSWORD',
];

function main() {
  let failed = false;
  const maxAgeDays = Math.min(730, Math.max(1, parseInt(process.env.SECRET_KEY_MAX_AGE_DAYS || '365', 10)));

  for (const key of requiredSecrets) {
    const val = process.env[key];
    if (!val || String(val).trim().length < 8) {
      console.error(`[FAIL] Required secret missing or too short: ${key}`);
      failed = true;
    }
  }

  if (process.env.KEY_LAST_ROTATED_ISO) {
    const rotated = new Date(process.env.KEY_LAST_ROTATED_ISO);
    if (Number.isNaN(rotated.getTime())) {
      console.error('[FAIL] KEY_LAST_ROTATED_ISO is not a valid ISO date');
      failed = true;
    } else {
      const ageDays = (Date.now() - rotated.getTime()) / (24 * 60 * 60 * 1000);
      if (ageDays > maxAgeDays) {
        console.error(`[FAIL] Key age ${Math.floor(ageDays)} days exceeds policy (max ${maxAgeDays} days). Rotate and set KEY_LAST_ROTATED_ISO.`);
        failed = true;
      }
    }
  }

  for (const key of optionalButRecommended) {
    const val = process.env[key];
    if (!val || String(val).trim().length < 4) {
      console.warn(`[WARN] Recommended secret missing or short: ${key}`);
    }
  }

  if (failed) {
    process.exit(1);
  }
  console.log('[OK] Secret rotation checks passed.');
  process.exit(0);
}

main();
