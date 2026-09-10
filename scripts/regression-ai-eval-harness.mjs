#!/usr/bin/env node
// Regression for MOAS-22 (B-015 code slice): the AI evaluation harness must
// support a batch of cases well beyond the original 10 (2 per surface x 5
// surfaces), version its data/results, write per-case artifacts, report
// subgroup summaries, and produce byte-identical results across repeated
// (parallel) runs — proving the harness scales rather than just adding more
// rows to a script that only ever ran a handful of cases at a time.

import { execSync } from 'node:child_process';

let pass = true;
function check(label, ok) {
  console.log(`[${label}] ${ok ? 'PASS' : 'FAIL'}`);
  pass = pass && ok;
}

function dockerExec(cmd) {
  return execSync(`docker exec -i -w /app umoya-cdss-service ${cmd}`, { stdio: 'pipe' }).toString();
}

async function main() {
  // 1. Total placeholder case count across the whole fixture set is >=50.
  const countsOutput = dockerExec(
    `python3 -c "
import json, glob
total = 0
for f in glob.glob('evaluation/fixtures/*_eval_cases.v1.json'):
    total += len(json.load(open(f))['cases'])
print(total)
"`,
  ).trim();
  check(`Total eval cases across fixtures >= 50 (found ${countsOutput})`, Number(countsOutput) >= 50);

  // 2. Release-gate suite runs clean and reports subgroup summaries for every surface.
  dockerExec('python evaluation/run_release_gate_suite.py --allow-blocked --output /tmp/regress-run1.json');
  const run1 = JSON.parse(dockerExec('cat /tmp/regress-run1.json'));
  const allHaveSubgroups = run1.surfaces.every((s) => s.subgroup_summary && Object.keys(s.subgroup_summary).length > 0);
  check('Every surface in the release-gate report has a non-empty subgroup_summary', allHaveSubgroups);

  const subgroupNames = new Set(run1.surfaces.flatMap((s) => Object.keys(s.subgroup_summary)));
  const expectedSubgroups = ['pediatric', 'adult', 'elderly', 'maternity', 'general'];
  const hasExpectedSubgroups = expectedSubgroups.every((sg) => subgroupNames.has(sg));
  check('Subgroup summaries cover pediatric/adult/elderly/maternity/general', hasExpectedSubgroups);

  // 3. Per-case artifacts are written when requested.
  dockerExec('python -m evaluation.offline_clinical_eval --case-artifacts --output /tmp/regress-offline.json');
  const offlineReport = JSON.parse(dockerExec('cat /tmp/regress-offline.json'));
  const datasetVersion = offlineReport.summary.dataset_version;
  const artifactFiles = dockerExec(`find evaluation/reports/cases/${datasetVersion} -name "*.json" | wc -l`).trim();
  check(
    `Per-case artifacts written (${artifactFiles} files for ${offlineReport.cases.length} cases)`,
    Number(artifactFiles) >= offlineReport.cases.length,
  );

  // 4. Reproducible parallel runs: two independent runs produce identical
  //    results (modulo the timestamp), proving thread-pool scheduling
  //    non-determinism doesn't leak into the report.
  dockerExec('python evaluation/run_release_gate_suite.py --allow-blocked --output /tmp/regress-run2.json');
  const identical = dockerExec(
    `python3 -c "
import json
a = json.load(open('/tmp/regress-run1.json'))
b = json.load(open('/tmp/regress-run2.json'))
del a['generated_at']; del b['generated_at']
print('IDENTICAL' if a == b else 'DIFFERENT')
"`,
  ).trim();
  check('Two independent parallel runs produce byte-identical results (modulo timestamp)', identical === 'IDENTICAL');

  // 5. Dataset versioning: every fixture declares a dataset_version, and the
  //    report echoes it back (traceable evidence, not anonymous numbers).
  const versionsOutput = dockerExec(
    `python3 -c "
import json, glob
for f in sorted(glob.glob('evaluation/fixtures/*_eval_cases.v1.json')):
    d = json.load(open(f))
    print(f, '->', d.get('dataset_version'))
"`,
  );
  const allVersioned = !versionsOutput.includes('-> None');
  check('Every fixture file declares a dataset_version', allVersioned);

  console.log(pass ? '\nALL PASS' : '\nFAILURES PRESENT');
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
