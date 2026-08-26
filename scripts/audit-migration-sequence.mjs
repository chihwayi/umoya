#!/usr/bin/env node
// Fails the build if database/migrations/*.sql has duplicate or gapped numeric
// prefixes. database/migrations is a legacy replay-only path (see scripts/migrate.sh,
// TARGET_DB usage) — the live per-tenant provisioning source of truth is
// services/tenant-service/src/services/database-provisioning.service.ts. This
// guard exists because a duplicate prefix makes the replay order for old tenant
// databases an accident of filesystem glob sort rather than an intentional
// sequence (found in the S249 remediation, 2026-08-25).
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(ROOT, 'database/migrations');

async function main() {
  const entries = await fs.readdir(MIGRATIONS_DIR);
  const sqlFiles = entries.filter((f) => f.endsWith('.sql'));

  const byPrefix = new Map();
  const malformed = [];

  for (const file of sqlFiles) {
    const match = file.match(/^(\d+)-/);
    if (!match) {
      malformed.push(file);
      continue;
    }
    const prefix = Number(match[1]);
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
    byPrefix.get(prefix).push(file);
  }

  const duplicates = [...byPrefix.entries()].filter(([, files]) => files.length > 1);

  const prefixes = [...byPrefix.keys()].sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < prefixes.length; i++) {
    if (prefixes[i] !== prefixes[i - 1] + 1) {
      gaps.push(`${prefixes[i - 1]} -> ${prefixes[i]}`);
    }
  }

  let failed = false;

  if (malformed.length > 0) {
    failed = true;
    console.error(`\n✗ ${malformed.length} migration file(s) have no numeric prefix:`);
    for (const f of malformed) console.error(`  - ${f}`);
  }

  if (duplicates.length > 0) {
    failed = true;
    console.error(`\n✗ ${duplicates.length} duplicate migration sequence number(s):`);
    for (const [prefix, files] of duplicates) {
      console.error(`  - ${String(prefix).padStart(3, '0')}: ${files.join(', ')}`);
    }
  }

  if (gaps.length > 0) {
    failed = true;
    console.error(`\n✗ ${gaps.length} gap(s) in migration sequence:`);
    for (const g of gaps) console.error(`  - ${g}`);
  }

  if (failed) {
    console.error(
      '\nRenumber so database/migrations/*.sql has exactly one file per sequential integer prefix.\n',
    );
    process.exit(1);
  }

  console.log(`✓ ${sqlFiles.length} migration files, sequential 001-${String(prefixes[prefixes.length - 1]).padStart(3, '0')}, no duplicates or gaps.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
