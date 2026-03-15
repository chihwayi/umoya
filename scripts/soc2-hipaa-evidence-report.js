#!/usr/bin/env node
/**
 * SOC2/HIPAA evidence automation (Sprint D4).
 * Produces a report suitable for compliance evidence (audit coverage, PHI access logging).
 * Usage: node scripts/soc2-hipaa-evidence-report.js [--format=json|csv] [--days=30]
 * With DB: set DATABASE_URL (tenant DB URL) to include live audit counts; otherwise stub report.
 */
const format = process.argv.includes('--format=csv') ? 'csv' : 'json';
const daysArg = process.argv.find((a) => a.startsWith('--days='));
const lookbackDays = daysArg ? Math.max(1, parseInt(daysArg.split('=')[1], 10) || 30) : 30;
const timestamp = new Date().toISOString();

const report = {
  generatedAt: timestamp,
  scope: 'post-visit and PHI audit',
  lookbackDays,
  checks: [
    { id: 'PHI_READ_AUDIT', description: 'PHI read operations logged', status: 'implemented', note: 'HipaaAuditService.logPhiAccess' },
    { id: 'PHI_WRITE_AUDIT', description: 'PHI modifications logged', status: 'implemented', note: 'HipaaAuditService.logPhiModification' },
    { id: 'NO_PHI_IN_LOGS', description: 'No PHI in log payloads', status: 'policy', note: 'Metadata only in audit entries' },
    { id: 'TRIAL_MATCHER_DEIDENTIFIED', description: 'Trial matcher uses de-identified query only', status: 'implemented', note: 'deriveTrialSearchTerms whitelist' },
    { id: 'PEER_CONSULT_DEIDENTIFIED', description: 'Peer consult summaries de-identified', status: 'implemented', note: 'buildDeidentifiedPeerConsultSummary' },
    { id: 'FHIR_SYNC_LOG', description: 'FHIR write-back attempts logged', status: 'implemented', note: 'fhir_sync_log table' },
    { id: 'RED_TEAM_SUITE', description: 'Adversarial tests in CI', status: 'implemented', note: '>=50 tests, CI gate' },
  ],
  evidenceSummary: 'Run with DATABASE_URL set to a tenant DB to include per-tenant hipaa_audit_logs counts.',
  auditCounts: null,
};

async function fetchAuditCounts() {
  const databaseUrl = process.env.DATABASE_URL || process.env.TENANT_DATABASE_URL;
  if (!databaseUrl) return null;
  let Client;
  try {
    Client = require('pg').Client;
  } catch (e) {
    return null;
  }
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
  } catch (e) {
    console.error('Warning: could not connect to database:', e.message);
    return null;
  }
  const since = new Date();
  since.setDate(since.getDate() - lookbackDays);
  const sinceStr = since.toISOString();

  try {
    const tableCheck = await client.query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'hipaa_audit_logs'
      ) AS exists`
    );
    if (!tableCheck.rows[0]?.exists) return { error: 'Table hipaa_audit_logs not found in this database' };

    const [total, byOperation, byOutcome] = await Promise.all([
      client.query(
        `SELECT COUNT(*)::bigint AS c FROM hipaa_audit_logs WHERE created_at >= $1`,
        [sinceStr]
      ),
      client.query(
        `SELECT operation, COUNT(*)::bigint AS c FROM hipaa_audit_logs WHERE created_at >= $1 GROUP BY operation ORDER BY c DESC`,
        [sinceStr]
      ),
      client.query(
        `SELECT outcome, COUNT(*)::bigint AS c FROM hipaa_audit_logs WHERE created_at >= $1 GROUP BY outcome ORDER BY c DESC`,
        [sinceStr]
      ),
    ]);

    await client.end();
    return {
      period: { from: sinceStr, to: new Date().toISOString() },
      totalEvents: Number(total.rows[0]?.c ?? 0),
      byOperation: (byOperation.rows || []).reduce((acc, r) => {
        acc[r.operation || 'unknown'] = Number(r.c);
        return acc;
      }, {}),
      byOutcome: (byOutcome.rows || []).reduce((acc, r) => {
        acc[r.outcome || 'unknown'] = Number(r.c);
        return acc;
      }, {}),
    };
  } catch (e) {
    try { await client.end(); } catch (_) {}
    return { error: e.message };
  }
}

(async () => {
  report.auditCounts = await fetchAuditCounts();
  if (report.auditCounts && !report.auditCounts.error) {
    report.evidenceSummary = `Database connected. hipaa_audit_logs: ${report.auditCounts.totalEvents} events in last ${lookbackDays} days.`;
  } else if (report.auditCounts?.error) {
    report.evidenceSummary = `Database error: ${report.auditCounts.error}.`;
  }

  if (format === 'csv') {
    console.log('id,description,status,note');
    report.checks.forEach((c) => {
      console.log([c.id, `"${c.description}"`, c.status, `"${(c.note || '').replace(/"/g, '""')}"`].join(','));
    });
    if (report.auditCounts && !report.auditCounts.error) {
      console.log('');
      console.log('audit_period_from,audit_period_to,total_events');
      console.log([report.auditCounts.period.from, report.auditCounts.period.to, report.auditCounts.totalEvents].join(','));
    }
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
  process.exit(0);
})();
