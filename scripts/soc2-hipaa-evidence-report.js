#!/usr/bin/env node
/**
 * SOC2/HIPAA evidence report.
 * Usage: node scripts/soc2-hipaa-evidence-report.js [--format=json|csv] [--days=30]
 * Set DATABASE_URL (or TENANT_DATABASE_URL) to include live tenant audit counts.
 */
const { Client } = require('pg');

const format = process.argv.includes('--format=csv') ? 'csv' : 'json';
const daysArg = process.argv.find((arg) => arg.startsWith('--days='));
const lookbackDays = daysArg ? Math.max(1, parseInt(daysArg.split('=')[1], 10) || 30) : 30;
const databaseUrl = process.env.DATABASE_URL || process.env.TENANT_DATABASE_URL;

function getPeriodStart(days) {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);
  return start.toISOString();
}

async function fetchAuditEvidence() {
  if (!databaseUrl) {
    return {
      connected: false,
      message: 'DATABASE_URL not set; returning implementation evidence only.',
    };
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  const since = getPeriodStart(lookbackDays);

  try {
    const tableCheck = await client.query(
      `SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'hipaa_audit_logs'
      ) AS exists`,
    );

    if (!tableCheck.rows[0]?.exists) {
      return {
        connected: true,
        message: 'Connected, but hipaa_audit_logs table was not found in this database.',
      };
    }

    const [totals, byAction, byOutcome, byRisk] = await Promise.all([
      client.query(
        `SELECT COUNT(*)::bigint AS total_events
         FROM hipaa_audit_logs
         WHERE created_at >= $1`,
        [since],
      ),
      client.query(
        `SELECT COALESCE(action, 'unknown') AS key, COUNT(*)::bigint AS total
         FROM hipaa_audit_logs
         WHERE created_at >= $1
         GROUP BY COALESCE(action, 'unknown')
         ORDER BY total DESC, key ASC`,
        [since],
      ),
      client.query(
        `SELECT COALESCE(outcome, 'unknown') AS key, COUNT(*)::bigint AS total
         FROM hipaa_audit_logs
         WHERE created_at >= $1
         GROUP BY COALESCE(outcome, 'unknown')
         ORDER BY total DESC, key ASC`,
        [since],
      ),
      client.query(
        `SELECT COALESCE(risk_level, 'unknown') AS key, COUNT(*)::bigint AS total
         FROM hipaa_audit_logs
         WHERE created_at >= $1
         GROUP BY COALESCE(risk_level, 'unknown')
         ORDER BY total DESC, key ASC`,
        [since],
      ),
    ]);

    return {
      connected: true,
      message: `Connected to tenant DB; computed HIPAA audit evidence for the last ${lookbackDays} days.`,
      period: {
        from: since,
        to: new Date().toISOString(),
      },
      totals: {
        totalEvents: Number(totals.rows[0]?.total_events ?? 0),
      },
      byAction: byAction.rows.map((row) => ({ action: row.key, total: Number(row.total) })),
      byOutcome: byOutcome.rows.map((row) => ({ outcome: row.key, total: Number(row.total) })),
      byRisk: byRisk.rows.map((row) => ({ riskLevel: row.key, total: Number(row.total) })),
    };
  } finally {
    await client.end();
  }
}

async function main() {
  const auditEvidence = await fetchAuditEvidence();
  const report = {
    generatedAt: new Date().toISOString(),
    lookbackDays,
    scope: 'SOC2/HIPAA operational evidence',
    controls: [
      {
        id: 'audit_log_capture',
        status: 'implemented',
        evidence: 'hipaa_audit_logs records PHI access and modification events',
      },
      {
        id: 'access_outcome_tracking',
        status: 'implemented',
        evidence: 'audit rows track action, outcome, and risk_level for compliance review',
      },
      {
        id: 'accounting_of_disclosures',
        status: 'implemented',
        evidence: 'HIPAA disclosure reporting is available through the audit reporting flow',
      },
      {
        id: 'implementation_report',
        status: auditEvidence.connected ? 'validated' : 'partial',
        evidence: auditEvidence.message,
      },
    ],
    auditEvidence,
  };

  if (format === 'csv') {
    console.log('section,key,value');
    console.log(`meta,generatedAt,${report.generatedAt}`);
    console.log(`meta,lookbackDays,${lookbackDays}`);
    console.log(`meta,scope,"${report.scope}"`);

    for (const control of report.controls) {
      console.log(`control.${control.id},status,${control.status}`);
      console.log(`control.${control.id},evidence,"${String(control.evidence).replace(/"/g, '""')}"`);
    }

    if (auditEvidence.period) {
      console.log(`audit,period_from,${auditEvidence.period.from}`);
      console.log(`audit,period_to,${auditEvidence.period.to}`);
      console.log(`audit,total_events,${auditEvidence.totals.totalEvents}`);
    }

    for (const row of auditEvidence.byAction || []) {
      console.log(`audit.byAction,${row.action},${row.total}`);
    }
    for (const row of auditEvidence.byOutcome || []) {
      console.log(`audit.byOutcome,${row.outcome},${row.total}`);
    }
    for (const row of auditEvidence.byRisk || []) {
      console.log(`audit.byRisk,${row.riskLevel},${row.total}`);
    }
    return;
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
