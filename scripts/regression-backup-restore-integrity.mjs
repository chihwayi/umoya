#!/usr/bin/env node
// Regression for MOAS-21 (B-010 code slice): backup -> restore -> verify
// integrity harness. Runs entirely against isolated, throw-away synthetic
// databases created and dropped by this script — NEVER touches `medicore`
// or any real tenant database (`clinic_*`). Proves: (1) a backup taken via
// pg_dump can be restored via pg_restore into a fresh database with zero
// row-count/content-checksum drift, and (2) two tenants' backups stay
// completely separate — restoring tenant A's backup never leaks tenant B's
// data, and vice versa.
//
// Boundary (per MOAS-21's own scope): this proves the backup/restore
// *mechanism* is correct on synthetic data. Production-like RPO/RTO
// measurement and a full DR drill against real infrastructure remain
// explicitly open, separate work.

import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

// Two run modes: local dev (default) drives the real docker-compose
// postgres-master container by name; CI (PG_HOST set) drives a plain
// postgres service container reachable over TCP — same SQL, same harness,
// different transport. Never touches `medicore` or any `clinic_*` database
// either way — only throw-away `backup_harness_*` databases it creates itself.
const CONTAINER = 'umoya-postgres-master';
const PG_USER = process.env.PG_USER || 'postgres';
const PG_HOST = process.env.PG_HOST || null;
const PG_PORT = process.env.PG_PORT || '5432';
const PG_PASSWORD = process.env.PGPASSWORD || process.env.PG_PASSWORD || 'postgres';

const TENANT_A_DB = `backup_harness_a_${Date.now()}`;
const TENANT_B_DB = `backup_harness_b_${Date.now()}`;
const BACKUP_DIR = `/tmp/backup-harness-${Date.now()}`;

let pass = true;
function check(label, ok) {
  console.log(`[${label}] ${ok ? 'PASS' : 'FAIL'}`);
  pass = pass && ok;
}

function run(cmd) {
  const wrapped = PG_HOST
    ? `PGPASSWORD=${PG_PASSWORD} ${cmd} -h ${PG_HOST} -p ${PG_PORT}`
    : `docker exec -i ${CONTAINER} ${cmd}`;
  return execSync(wrapped, { stdio: 'pipe' }).toString();
}

function psqlExec(db, sql) {
  const oneLine = sql.replace(/\s+/g, ' ').trim();
  return run(`psql -U ${PG_USER} -d "${db}" -tA -c ${JSON.stringify(oneLine)}`).trim();
}

function dockerExec(cmd) {
  // Local-only helpers (mkdir/stat/rm on the backup dir) — in CI mode these
  // run on the GitHub Actions runner's own filesystem directly, no docker.
  if (PG_HOST) {
    return execSync(cmd, { stdio: 'pipe' }).toString();
  }
  return execSync(`docker exec -i ${CONTAINER} ${cmd}`, { stdio: 'pipe' }).toString();
}

function createDatabase(db) {
  run(`psql -U ${PG_USER} -d postgres -c "CREATE DATABASE \\"${db}\\";"`);
}

function dropDatabase(db) {
  try {
    run(`psql -U ${PG_USER} -d postgres -c "DROP DATABASE IF EXISTS \\"${db}\\" WITH (FORCE);"`);
  } catch {
    // best-effort cleanup
  }
}

function seedTenant(db, tenantLabel, rowCount) {
  psqlExec(
    db,
    `CREATE TABLE synthetic_patients (
       id uuid PRIMARY KEY, tenant_label text NOT NULL, seq int NOT NULL, name text NOT NULL, created_at timestamptz DEFAULT now()
     );`,
  );
  const values = [];
  for (let i = 0; i < rowCount; i++) {
    values.push(`('${randomUUID()}', '${tenantLabel}', ${i}, 'Synthetic Patient ${tenantLabel}-${i}')`);
  }
  psqlExec(db, `INSERT INTO synthetic_patients (id, tenant_label, seq, name) VALUES ${values.join(',')};`);
}

function tableChecksum(db) {
  // A content-level checksum (not just row count) — MD5 of every row's
  // stable fields, aggregated order-independently (sum of per-row hashes)
  // so it is insensitive to physical row order, only to actual content.
  return psqlExec(
    db,
    `SELECT md5(string_agg(row_hash, '' ORDER BY row_hash)) FROM (
       SELECT md5(tenant_label || seq::text || name) as row_hash FROM synthetic_patients
     ) t;`,
  );
}

function rowCount(db) {
  return Number(psqlExec(db, `SELECT count(*) FROM synthetic_patients;`));
}

async function main() {
  dockerExec(`mkdir -p ${BACKUP_DIR}`);

  try {
    // --- Setup: two isolated synthetic tenant databases ---
    createDatabase(TENANT_A_DB);
    createDatabase(TENANT_B_DB);
    seedTenant(TENANT_A_DB, 'tenant-a', 25);
    seedTenant(TENANT_B_DB, 'tenant-b', 40);

    const preBackupCountA = rowCount(TENANT_A_DB);
    const preBackupChecksumA = tableChecksum(TENANT_A_DB);
    const preBackupCountB = rowCount(TENANT_B_DB);
    const preBackupChecksumB = tableChecksum(TENANT_B_DB);

    check('Tenant A seeded with expected row count', preBackupCountA === 25);
    check('Tenant B seeded with expected row count', preBackupCountB === 40);

    // --- Backup (pg_dump, custom format — the real production backup format) ---
    run(`pg_dump -U ${PG_USER} -Fc -f ${BACKUP_DIR}/tenant-a.dump "${TENANT_A_DB}"`);
    run(`pg_dump -U ${PG_USER} -Fc -f ${BACKUP_DIR}/tenant-b.dump "${TENANT_B_DB}"`);
    const backupSizeA = dockerExec(`stat -c%s ${BACKUP_DIR}/tenant-a.dump`).trim();
    check('Tenant A backup file is non-empty', Number(backupSizeA) > 0);

    // --- Simulate data loss: drop the "live" databases entirely ---
    dropDatabase(TENANT_A_DB);
    dropDatabase(TENANT_B_DB);
    let dbExistsAfterDrop = false;
    try {
      run(`psql -U ${PG_USER} -d "${TENANT_A_DB}" -c "SELECT 1;"`);
      dbExistsAfterDrop = true;
    } catch {
      dbExistsAfterDrop = false;
    }
    check('Simulated data loss: tenant A database no longer exists', !dbExistsAfterDrop);

    // --- Restore into fresh databases ---
    createDatabase(TENANT_A_DB);
    createDatabase(TENANT_B_DB);
    run(`pg_restore -U ${PG_USER} -d "${TENANT_A_DB}" ${BACKUP_DIR}/tenant-a.dump`);
    run(`pg_restore -U ${PG_USER} -d "${TENANT_B_DB}" ${BACKUP_DIR}/tenant-b.dump`);

    // --- Verify integrity: row counts and content checksums match exactly ---
    const postRestoreCountA = rowCount(TENANT_A_DB);
    const postRestoreChecksumA = tableChecksum(TENANT_A_DB);
    const postRestoreCountB = rowCount(TENANT_B_DB);
    const postRestoreChecksumB = tableChecksum(TENANT_B_DB);

    check(`Tenant A row count matches after restore (${preBackupCountA} -> ${postRestoreCountA})`, postRestoreCountA === preBackupCountA);
    check('Tenant A content checksum matches after restore (zero data corruption)', postRestoreChecksumA === preBackupChecksumA);
    check(`Tenant B row count matches after restore (${preBackupCountB} -> ${postRestoreCountB})`, postRestoreCountB === preBackupCountB);
    check('Tenant B content checksum matches after restore (zero data corruption)', postRestoreChecksumB === preBackupChecksumB);

    // --- Tenant separation: restoring A's backup never introduces B's rows, and vice versa ---
    const crossContaminationInA = psqlExec(TENANT_A_DB, `SELECT count(*) FROM synthetic_patients WHERE tenant_label = 'tenant-b';`);
    const crossContaminationInB = psqlExec(TENANT_B_DB, `SELECT count(*) FROM synthetic_patients WHERE tenant_label = 'tenant-a';`);
    check('Tenant A restore contains zero tenant-b rows (no cross-tenant leakage)', Number(crossContaminationInA) === 0);
    check('Tenant B restore contains zero tenant-a rows (no cross-tenant leakage)', Number(crossContaminationInB) === 0);
  } finally {
    // --- Cleanup: leave no trace on the shared postgres instance ---
    dropDatabase(TENANT_A_DB);
    dropDatabase(TENANT_B_DB);
    dockerExec(`rm -rf ${BACKUP_DIR}`);
  }

  console.log(pass ? '\nALL PASS' : '\nFAILURES PRESENT');
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
