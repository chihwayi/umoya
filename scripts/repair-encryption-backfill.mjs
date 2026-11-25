#!/usr/bin/env node
// R1 / FX-002 backfill triage for silently-plaintext / truncated values.
//
// Background: before R1, encrypt() returned PLAINTEXT when ENCRYPTION_KEY was
// missing/invalid, and VARCHAR(50) truncated real ciphertext. This script
// classifies every value in patients(id_number, phone, email) WITHOUT a key:
//   empty | plaintext (no colons — missing-key era) |
//   truncated (colons, wrong shape — overflow cut or corruption) |
//   ciphertext-shape (healthy-looking; still needs a decrypt spot-check with
//   the real key, which this script never touches).
//
// Usage:
//   node scripts/repair-encryption-backfill.mjs --db <postgres-url> [--apply]
// Default is REPORT ONLY. --apply re-encrypts `plaintext`-class values with
// the current ENCRYPTION_KEY (fails closed if the key is missing/invalid) and
// logs every row touched. `truncated` values are NEVER auto-fixed — they need
// manual review (source documents may still exist). `ciphertext-shape` values
// need a decrypt spot-check: see remediation/FX002_BACKFILL.md.
import crypto from 'node:crypto';
import { Client } from 'pg';

const COLUMNS = ['id_number', 'phone', 'email'];

export function classifyStoredValue(value) {
  if (value === null || value === undefined || value === '') return 'empty';
  if (!value.includes(':')) return 'plaintext';
  const parts = value.split(':');
  if (
    parts.length >= 3 &&
    /^[0-9a-fA-F]{32}$/.test(parts[0]) &&
    /^[0-9a-fA-F]{32}$/.test(parts[1]) &&
    /^[0-9a-fA-F]+$/.test(parts.slice(2).join(''))
  ) {
    return 'ciphertext-shape';
  }
  return 'truncated';
}

function loadKeyOrThrow() {
  const hex = (process.env.ENCRYPTION_KEY || '').trim();
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('ENCRYPTION_KEY must be a 64-char hex string (refusing --apply without it)');
  }
  return Buffer.from(hex, 'hex');
}

function encryptWithKey(text, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let enc = cipher.update(text, 'utf8', 'hex');
  enc += cipher.final('hex');
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${enc}`;
}

async function main() {
  const args = process.argv.slice(2);
  const dbUrl = args[args.indexOf('--db') + 1];
  const apply = args.includes('--apply');
  if (!dbUrl || args.indexOf('--db') === -1) {
    console.error('Usage: repair-encryption-backfill.mjs --db <postgres-url> [--apply]');
    process.exit(2);
  }
  const key = apply ? loadKeyOrThrow() : null;
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const report = {};
    for (const col of COLUMNS) {
      const { rows } = await client.query(`SELECT id, ${col} AS v FROM patients`);
      const counts = { empty: 0, plaintext: 0, truncated: 0, 'ciphertext-shape': 0 };
      const toFix = [];
      for (const r of rows) {
        const cls = classifyStoredValue(r.v);
        counts[cls]++;
        if (apply && cls === 'plaintext') toFix.push(r);
      }
      if (apply) {
        for (const r of toFix) {
          const ct = encryptWithKey(String(r.v), key);
          await client.query(`UPDATE patients SET ${col} = $1 WHERE id = $2`, [ct, r.id]);
          console.log(`re-encrypted patients.${col} id=${r.id}`);
        }
      }
      report[col] = { ...counts, reEncrypted: toFix.length };
    }
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'report', report }, null, 2));
  } finally {
    await client.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith('repair-encryption-backfill.mjs')) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
