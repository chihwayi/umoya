#!/usr/bin/env node
/*
  MOAS-23 (B-001): golden-flow harness runner. Reads seed/v1/golden-flows.json
  and, for every flow, produces an explicit pass/fail/not_implemented result —
  no flow is silently omitted. "implemented" flows are executed live by
  spawning their mapped scripts/regression-*.mjs runner against the running
  stack; their own live assertions determine pass/fail. Writes a JSON report
  with one entry per flow plus a summary count, so CI or a human can see the
  full 30-flow picture at a glance.

  Usage:
    node scripts/run-golden-flows.mjs [--out reports/golden-flows-report.json]
*/
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const MANIFEST_PATH = path.resolve(process.cwd(), 'seed', 'v1', 'golden-flows.json');
const outArgIdx = process.argv.indexOf('--out');
const OUT_PATH = outArgIdx !== -1 ? process.argv[outArgIdx + 1] : path.resolve(process.cwd(), 'reports', 'golden-flows-report.json');

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const results = [];

  for (const flow of manifest.flows) {
    if (flow.status === 'not_implemented') {
      results.push({ id: flow.id, domain: flow.domain, status: 'not_implemented', reason: flow.reason });
      console.log(`SKIP  ${flow.id} (not_implemented): ${flow.reason}`);
      continue;
    }

    const runnerPath = path.resolve(process.cwd(), flow.runner);
    if (!fs.existsSync(runnerPath)) {
      results.push({ id: flow.id, domain: flow.domain, status: 'fail', error: `runner script not found: ${flow.runner}` });
      console.log(`FAIL  ${flow.id}: runner script not found: ${flow.runner}`);
      continue;
    }

    const started = Date.now();
    const proc = spawnSync('node', [runnerPath], { encoding: 'utf8', cwd: process.cwd(), timeout: 120000 });
    const durationMs = Date.now() - started;
    const passed = proc.status === 0;
    results.push({
      id: flow.id,
      domain: flow.domain,
      status: passed ? 'pass' : 'fail',
      runner: flow.runner,
      durationMs,
      exitCode: proc.status,
      stdoutTail: (proc.stdout || '').split('\n').slice(-15).join('\n'),
      stderrTail: passed ? undefined : (proc.stderr || '').split('\n').slice(-15).join('\n'),
    });
    console.log(`${passed ? 'PASS' : 'FAIL'}  ${flow.id} (${durationMs}ms)`);
  }

  const summary = {
    total: results.length,
    pass: results.filter((r) => r.status === 'pass').length,
    fail: results.filter((r) => r.status === 'fail').length,
    not_implemented: results.filter((r) => r.status === 'not_implemented').length,
  };

  const report = { generatedAt: new Date().toISOString(), manifestVersion: manifest.manifest_version, summary, results };
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2));

  console.log(`\nTOTALS: ${summary.total} flows — ${summary.pass} pass, ${summary.fail} fail, ${summary.not_implemented} not_implemented`);
  console.log(`Report written to ${OUT_PATH}`);

  if (summary.fail > 0) process.exit(1);
}

main();
