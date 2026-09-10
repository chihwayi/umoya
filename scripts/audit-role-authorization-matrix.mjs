#!/usr/bin/env node
// MOAS-20 (A-004, §51): static persona-by-endpoint authorization inventory.
//
// A-004 found that a pharmacist token could read GET /finance/transactions —
// an endpoint gated by JwtAuthGuard (any logged-in user) but with no
// @Roles()/RolesGuard restriction narrowing it to accounts/billing/admin.
// This script generalizes that finding: it statically enumerates every
// route across every NestJS controller, resolves the effective role
// restriction (method-level @Roles() > class-level @Roles() > none), and
// flags any route inside a domain that handles financial, administrative,
// or audit data with NO role restriction at all — the exact shape of bug
// A-004 was.
//
// This is a heuristic line-based scanner, not a TS compiler — it is a
// best-effort inventory to find likely gaps and drive live verification
// (see scripts/regression-role-authorization-matrix.mjs), not a proof that
// every declared @Roles() is correct.

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const CONTROLLERS_DIR = path.join(ROOT, 'services/ehr-service/src/controllers');

const SENSITIVE_NAME_PATTERN = /finance|billing|claim|payroll|admin|audit|tenant|payment|invoice|salary|report/i;

// Reviewed 2026-09-07 (MOAS-20): these routes intentionally have no @Roles()
// restriction beyond "any authenticated staff member" because their content
// is clinical (not financial/administrative) and legitimately needed by any
// clinical role — patient summaries, clinical stats, appointments,
// prescriptions, lab results, general module reports, mortality quality
// metrics. Only reports.controller.ts's one genuinely financial route
// (GET /reports/financial) was fixed with a real @Roles() restriction.
const REVIEWED_INTENTIONAL_UNGUARDED = new Set([
  'GET reports.controller.ts /reports/patient-summary/:id',
  'GET reports.controller.ts /reports/clinical',
  'GET reports.controller.ts /reports/dashboard',
  'GET reports.controller.ts /reports/appointments',
  'GET reports.controller.ts /reports/prescriptions',
  'GET reports.controller.ts /reports/lab-results',
  'GET reports.controller.ts /reports/modules/:module/general',
  'GET reports.controller.ts /reports/quality/mortality',
]);

const HTTP_DECORATOR = /@(Get|Post|Put|Patch|Delete)\(([^)]*)\)/;

function extractRolesArg(decoratorLine) {
  const match = decoratorLine.match(/@Roles\(([^)]*)\)/);
  if (!match) return null;
  return match[1]
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

async function findControllerFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    if (entry.name.endsWith('.controller.ts') && !entry.name.endsWith('.spec.ts')) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files.sort();
}

function analyzeController(fileName, content) {
  const lines = content.split('\n');

  // Class-level: scan from top until `export class` for @Controller(...) and
  // trailing decorators immediately above the class declaration.
  let controllerPrefix = '';
  let classLevelRoles = null;
  let classHasRolesGuard = false;
  let classLevelPublic = false;
  let isPatientFacing = false;

  const classDeclIdx = lines.findIndex((l) => /export class \w+Controller/.test(l));
  const classScanEnd = classDeclIdx === -1 ? lines.length : classDeclIdx;
  for (let i = 0; i < classScanEnd; i++) {
    const line = lines[i];
    const ctrlMatch = line.match(/@Controller\(['"]?([^'")]*)['"]?\)/);
    if (ctrlMatch) controllerPrefix = ctrlMatch[1] || '';
    if (/@UseGuards\([^)]*RolesGuard/.test(line)) classHasRolesGuard = true;
    if (/@Public\(\)/.test(line)) classLevelPublic = true;
    // PatientJwtAuthGuard (not JwtAuthGuard) means the caller is a patient
    // authenticating into their own record via the patient portal, not a
    // staff member — @Roles() (a staff-role concept) doesn't apply; the
    // scoping is "this patient's own data", enforced in the service layer.
    if (/PatientJwtAuthGuard/.test(line)) isPatientFacing = true;
    const roles = extractRolesArg(line);
    if (roles) classLevelRoles = roles;
  }

  // A method's decorator block in this codebase is NOT always "@Roles()
  // immediately above @Get()" — the observed convention is @Get(...) FIRST,
  // then @Api*(...) documentation decorators, with @Roles(...) LAST, right
  // above the method signature. So scan FORWARD from the HTTP decorator to
  // the method signature line, not backward.
  const METHOD_SIG = /^\s*(?:public\s+|private\s+|protected\s+|static\s+)*(?:async\s+)?[a-zA-Z_$][\w$]*\s*\(/;

  const routes = [];
  for (let i = 0; i < lines.length; i++) {
    const httpMatch = lines[i].match(HTTP_DECORATOR);
    if (!httpMatch) continue;

    const method = httpMatch[1].toUpperCase();
    const routePath = (httpMatch[2] || '').trim().replace(/^['"]|['"]$/g, '');

    let block = '';
    for (let j = i; j < lines.length; j++) {
      block += lines[j] + '\n';
      if (j > i && METHOD_SIG.test(lines[j]) && !lines[j].trim().startsWith('@')) break;
      if (j - i > 60) break; // safety bound against runaway scans
    }

    const methodHasRolesGuard = /@UseGuards\([^)]*RolesGuard/.test(block);
    const methodPublic = /@Public\(\)/.test(block);
    const rolesMatch = block.match(/@Roles\(([^)]*)\)/);
    const methodRoles = rolesMatch
      ? rolesMatch[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
      : null;

    const effectiveRoles = methodRoles || classLevelRoles;
    const hasRolesGuard = methodHasRolesGuard || classHasRolesGuard;
    const isPublic = methodPublic || classLevelPublic;

    routes.push({
      file: fileName,
      controllerPrefix,
      method,
      routePath,
      effectiveRoles,
      hasRolesGuard,
      isPublic,
      isPatientFacing,
      sensitive: SENSITIVE_NAME_PATTERN.test(fileName),
    });
  }

  return routes;
}

async function main() {
  const files = await findControllerFiles(CONTROLLERS_DIR);
  const allRoutes = [];

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    const routes = analyzeController(path.basename(file), content);
    allRoutes.push(...routes);
  }

  const sensitiveUnguarded = allRoutes.filter(
    (r) =>
      r.sensitive &&
      !r.isPublic &&
      !r.isPatientFacing &&
      (!r.effectiveRoles || r.effectiveRoles.length === 0) &&
      !REVIEWED_INTENTIONAL_UNGUARDED.has(`${r.method} ${r.file} /${r.controllerPrefix}${r.routePath ? '/' + r.routePath : ''}`),
  );

  console.log(`Scanned ${files.length} controllers, ${allRoutes.length} routes.`);
  console.log(`Routes with an explicit @Roles() restriction: ${allRoutes.filter((r) => r.effectiveRoles?.length).length}`);
  console.log(`Routes marked @Public(): ${allRoutes.filter((r) => r.isPublic).length}`);
  console.log(
    `Sensitive-domain routes (finance/billing/claims/admin/audit/tenant/payment/report) with NO role restriction: ${sensitiveUnguarded.length}`,
  );

  if (sensitiveUnguarded.length > 0) {
    console.log('\nSensitive routes with no @Roles() restriction (any authenticated user of any role can call these):');
    for (const r of sensitiveUnguarded) {
      console.log(`  ${r.method} /${r.controllerPrefix}${r.routePath ? '/' + r.routePath : ''}  (${r.file})`);
    }
  }

  const outPath = path.join(ROOT, 'reports', `role-authorization-matrix-${new Date().toISOString().slice(0, 10)}.json`);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), totalRoutes: allRoutes.length, sensitiveUnguarded, allRoutes }, null, 2));
  console.log(`\nFull matrix written to ${path.relative(ROOT, outPath)}`);

  if (process.env.MOAS20_STRICT === '1' && sensitiveUnguarded.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
