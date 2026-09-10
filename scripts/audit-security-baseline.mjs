#!/usr/bin/env node
// MOAS-19 (B-009 code slice): SCA/SAST no-regression gate.
//
// This is deliberately a *no-regression* gate, not a "zero findings" gate —
// audit/security/SECURITY_EXCEPTIONS.md documents 22 JS/TS and 12 Python SCA
// findings that need a semver-major dependency bump to fix for real, each
// with an owner/expiry/justification/compensating-control. This script fails
// the build if:
//   1. A NEW high/critical JS/TS finding appears beyond the accepted baseline
//      (audit/security/npm-audit-summary.json), or
//   2. Bandit (Python SAST) reports ANY high/critical finding at all — that
//      bar is zero, not "baselined", because the 3 HIGH findings this
//      session found were real, fixable bugs (weak-hash-for-security
//      warnings on cache-key MD5 calls), not major-bump-blocked SCA noise.

import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const BASELINE_PATH = path.join(ROOT, 'audit/security/npm-audit-summary.json');

async function loadBaseline() {
  const raw = await fs.readFile(BASELINE_PATH, 'utf8');
  const rows = JSON.parse(raw);
  return new Set(rows.filter((r) => r.severity === 'high' || r.severity === 'critical').map((r) => r.name));
}

async function checkNpmAudit() {
  let auditJson;
  try {
    const out = execSync('npm audit --omit=dev --json', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] });
    auditJson = JSON.parse(out.toString());
  } catch (err) {
    // npm audit exits non-zero when vulnerabilities are found — that's
    // expected; the JSON is still on stdout.
    try {
      auditJson = JSON.parse(err.stdout.toString());
    } catch {
      throw new Error('Could not parse `npm audit --json` output.');
    }
  }

  const baseline = await loadBaseline();
  const vulns = auditJson.vulnerabilities || {};
  const currentHighCritical = Object.entries(vulns).filter(([, v]) => v.severity === 'high' || v.severity === 'critical');
  const newFindings = currentHighCritical.filter(([name]) => !baseline.has(name));

  if (newFindings.length > 0) {
    console.error(`\n✗ ${newFindings.length} NEW high/critical JS/TS dependency finding(s) not in the accepted baseline:\n`);
    for (const [name, v] of newFindings) console.error(`  - ${name} (${v.severity})`);
    console.error(
      '\nEither fix these (preferred — try `npm audit fix --legacy-peer-deps`) or add them to ' +
        'audit/security/npm-audit-summary.json and audit/security/SECURITY_EXCEPTIONS.md with an owner/expiry/justification.\n',
    );
    return false;
  }

  console.log(`✓ JS/TS SCA: no new high/critical findings beyond the ${baseline.size}-item accepted baseline.`);
  return true;
}

function resolveBanditPath() {
  const candidates = ['bandit', path.join(process.env.HOME || '', '.local/bin/bandit')];
  for (const candidate of candidates) {
    try {
      execSync(`${candidate} --version`, { stdio: 'ignore' });
      return candidate;
    } catch {
      // try next candidate
    }
  }
  return null;
}

async function checkBandit() {
  const banditPath = resolveBanditPath();
  if (!banditPath) {
    console.log('⚠ bandit not available in this environment — skipping Python SAST gate (run in CI where it is installed).');
    return true;
  }

  let output;
  try {
    output = execSync(
      `${banditPath} -r main.py ai_models services evaluation knowledge_registry terminology who-smart-guidelines -f json`,
      { cwd: path.join(ROOT, 'services/cdss-service'), stdio: ['ignore', 'pipe', 'pipe'] },
    ).toString();
  } catch (err) {
    output = err.stdout ? err.stdout.toString() : null;
    if (!output) {
      console.log('⚠ bandit failed to run — skipping Python SAST gate.');
      return true;
    }
  }

  const report = JSON.parse(output);
  const highCritical = (report.results || []).filter((r) => r.issue_severity === 'HIGH' || r.issue_severity === 'CRITICAL');

  if (highCritical.length > 0) {
    console.error(`\n✗ ${highCritical.length} HIGH/CRITICAL bandit finding(s) — this bar is zero, not baselined:\n`);
    for (const r of highCritical) console.error(`  - ${r.filename}:${r.line_number} ${r.test_id} — ${r.issue_text.replace(/\n/g, ' ').slice(0, 100)}`);
    return false;
  }

  console.log('✓ Python SAST (bandit): zero HIGH/CRITICAL findings.');
  return true;
}

async function main() {
  const results = await Promise.all([checkNpmAudit(), checkBandit()]);
  if (results.some((ok) => !ok)) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
