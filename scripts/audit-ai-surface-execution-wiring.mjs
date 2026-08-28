#!/usr/bin/env node
// Fails the build if a service that injects AiSurfaceContractService calls
// buildSurfaceMetadata() (display-only, never persisted) without ever calling
// recordExecution() (persists to prompt_audit_log/ai_model_audit_registry) or
// writing its own real audit trail via HipaaAuditService. Catches the S267 (F7)
// class of bug: an AI surface architected to be audited, that never actually is.
//
// Files legitimately calling buildSurfaceMetadata only to decorate a READ of
// already-executed/cached AI output (not a fresh execution) are allowlisted
// below with the reasoning — this is a judgment call the audit can't make
// automatically, so it's recorded explicitly instead of silently exempted.
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SERVICES_ROOT = path.join(ROOT, 'services/ehr-service/src/services');

// aiSurface: read/decoration paths only — the underlying AI execution is
// audited at its own source (see comment for why each is safe).
const ALLOWLIST = new Map([
  ['radiology-ai.service.ts', 'decorateStudy/decorateFinding format already-persisted findings for display on every read; the real execution audit is recorded in analyzeStudy/analyseStudyWithDb (S267)'],
  ['oncology.service.ts', 'getMobileProtocolSnapshot packages already-computed protocol data for mobile polling — not a fresh AI execution'],
  ['patient-intelligence.service.ts', 'getPatientIntelligence aggregates already-executed AI outputs (proactive snapshot, risk tier, encounter copilot) for chart-view display; each underlying system audits its own execution'],
  ['patient-ai.service.ts', 'writes its own real audit trail directly via HipaaAuditService.registerModelEntry/logPromptAudit in recordPatientAiPromptAudit — equivalent to recordExecution, just not routed through AiSurfaceContractService'],
]);

async function findServiceFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findServiceFiles(full)));
    } else if (entry.name.endsWith('.service.ts') && !entry.name.endsWith('.spec.ts')) {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  const files = await findServiceFiles(SERVICES_ROOT);
  const violations = [];

  for (const file of files) {
    const basename = path.basename(file);
    const content = await fs.readFile(file, 'utf8');

    const usesAiSurfaceContract = /AiSurfaceContractService/.test(content);
    if (!usesAiSurfaceContract) continue;

    const callsBuildDisplayOnly = /\.buildSurfaceMetadata\s*\(/.test(content);
    if (!callsBuildDisplayOnly) continue;

    const callsRecordExecution = /\.recordExecution\s*\(/.test(content);
    const hasOwnAuditTrail = /hipaaAuditService\.(logPromptAudit|registerModelEntry)\s*\(/.test(content);

    if (callsRecordExecution || hasOwnAuditTrail) continue;

    if (ALLOWLIST.has(basename)) continue;

    violations.push({ file: path.relative(ROOT, file), reason: 'calls buildSurfaceMetadata() but never recordExecution() or a HipaaAuditService write' });
  }

  if (violations.length > 0) {
    console.error(`\n✗ ${violations.length} AI-facing service(s) build display metadata but never persist an audit trail:\n`);
    for (const v of violations) console.error(`  - ${v.file}: ${v.reason}`);
    console.error(
      '\nEvery AI execution must call AiSurfaceContractService.recordExecution() (or write its own real ' +
        'audit trail via HipaaAuditService) at the point the AI output is actually generated — not just ' +
        'build unpersisted display metadata. If this call site is a genuine read/decoration of already-' +
        'audited output, add it to the ALLOWLIST in scripts/audit-ai-surface-execution-wiring.mjs with a ' +
        'one-line justification.\n',
    );
    process.exit(1);
  }

  console.log(`✓ All AI-facing services that build surface metadata also persist a real audit trail (or are allowlisted as read-only decoration).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
