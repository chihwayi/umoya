import { readFile } from 'fs/promises';
import path from 'path';
import { Client } from 'pg';

function getBaseConfig() {
  const url = new URL(process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/medicore');
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
  };
}

function resolveReportPath() {
  if (process.env.MOAS12_REPORT_PATH) {
    return path.resolve(process.env.MOAS12_REPORT_PATH);
  }

  const today = new Date().toISOString().slice(0, 10);
  return path.resolve(
    process.cwd(),
    'services/cdss-service/evaluation/reports',
    `release-gate-suite-${today}.json`,
  );
}

async function loadTargetTenants(master) {
  const { rows } = await master.query(
    `SELECT "databaseName", subdomain
     FROM tenants
     WHERE status = ANY($1)
     ORDER BY "databaseName"`,
    [['active', 'pending', 'suspended']],
  );

  return rows.map((row) => ({
    databaseName: row.databaseName,
    subdomain: row.subdomain,
  }));
}

async function persistSurface(client, surface, suiteVersion) {
  const caseSetName = `${surface.ai_surface}:${surface.dataset}`;
  const datasetVersion = surface.dataset_version || suiteVersion || 'unknown';
  const metrics = surface.metrics || {};
  const gateSummary = {
    blocked: surface.blocked === true,
    failedGateCount: (surface.gates || []).filter((gate) => gate.status === 'failed').length,
    passedGateCount: (surface.gates || []).filter((gate) => gate.status === 'passed').length,
    notApplicableGateCount: (surface.gates || []).filter((gate) => gate.status === 'not_applicable').length,
  };

  await client.query('BEGIN');
  try {
    const existing = await client.query(
      `SELECT id
       FROM ai_eval_runs
       WHERE ai_surface = $1
         AND dataset_version = $2
         AND case_set_name = $3`,
      [surface.ai_surface, datasetVersion, caseSetName],
    );

    const existingIds = existing.rows.map((row) => row.id).filter(Boolean);
    if (existingIds.length > 0) {
      await client.query(
        `DELETE FROM ai_release_gate_results
         WHERE eval_run_id = ANY($1::uuid[])`,
        [existingIds],
      );
      await client.query(
        `DELETE FROM ai_eval_runs
         WHERE id = ANY($1::uuid[])`,
        [existingIds],
      );
    }

    const inserted = await client.query(
      `
        INSERT INTO ai_eval_runs (
          ai_surface,
          model_name,
          case_set_name,
          dataset_version,
          run_status,
          total_cases,
          report_path,
          retrieval_recall_at_k,
          retrieval_hit_rate_at_k,
          citation_support_rate,
          abstain_correctness,
          unsafe_overconfident_output_rate,
          summary,
          gate_summary,
          executed_by
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15
        )
        RETURNING id
      `,
      [
        surface.ai_surface,
        surface.model_name || null,
        caseSetName,
        datasetVersion,
        surface.blocked ? 'blocked' : 'passed',
        Number(surface.total_cases || 0),
        surface.report_path || null,
        metrics.retrieval_recall_at_k ?? null,
        metrics.retrieval_hit_rate_at_k ?? null,
        metrics.citation_support_rate ?? null,
        metrics.abstain_correctness ?? null,
        metrics.unsafe_overconfident_output_rate ?? null,
        JSON.stringify({
          suiteVersion,
          description: surface.description || null,
          dataset: surface.dataset || null,
          metrics,
        }),
        JSON.stringify(gateSummary),
        'scripts/persist-moas12-release-gates.mjs',
      ],
    );

    const evalRunId = inserted.rows[0]?.id;
    for (const gate of surface.gates || []) {
      await client.query(
        `
          INSERT INTO ai_release_gate_results (
            eval_run_id,
            ai_surface,
            gate_name,
            gate_status,
            comparator,
            observed_value,
            threshold_value,
            details
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
        `,
        [
          evalRunId,
          surface.ai_surface,
          gate.metric,
          gate.status,
          gate.comparator || null,
          gate.observed ?? null,
          gate.threshold ?? null,
          JSON.stringify({
            suiteVersion,
            dataset: surface.dataset || null,
          }),
        ],
      );
    }

    await client.query('COMMIT');
    return {
      aiSurface: surface.ai_surface,
      evalRunId,
      blocked: surface.blocked === true,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  const reportPath = resolveReportPath();
  const raw = await readFile(reportPath, 'utf8');
  const report = JSON.parse(raw);

  const baseConfig = getBaseConfig();
  const master = new Client(baseConfig);
  await master.connect();

  try {
    const tenants = await loadTargetTenants(master);
    const summary = [];

    for (const tenant of tenants) {
      const client = new Client({ ...baseConfig, database: tenant.databaseName });
      await client.connect();
      try {
        const persisted = [];
        for (const surface of report.surfaces || []) {
          persisted.push(await persistSurface(client, surface, report.suite_version));
        }
        summary.push({
          databaseName: tenant.databaseName,
          subdomain: tenant.subdomain,
          persistedCount: persisted.length,
          blockedSurfaces: persisted.filter((entry) => entry.blocked).map((entry) => entry.aiSurface),
        });
      } finally {
        await client.end();
      }
    }

    console.log(JSON.stringify({
      ok: true,
      reportPath,
      suiteVersion: report.suite_version || null,
      tenantCount: summary.length,
      summary,
    }, null, 2));
  } finally {
    await master.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
