import { Client } from 'pg';

const BUNDLE_ID      = 'sprint61_cdss_outcome_feedback';
const BUNDLE_VERSION = '2026.03.18';

function quoteIdent(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`;
}

function buildTenantConnection(databaseName: string) {
  return {
    host:     process.env.DB_HOST     || process.env.SERVICE_POSTGRES_HOST || 'localhost',
    port:     Number(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432'),
    user:     process.env.DB_USERNAME || process.env.POSTGRES_USER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
    database: databaseName,
  };
}

function getStatements(): string[] {
  return [
    // ── CDSS decision log table ───────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS cdss_decision_log (
      id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id              UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      encounter_id            UUID,
      user_id                 UUID         REFERENCES users(id) ON DELETE SET NULL,
      decision_type           VARCHAR(60)  NOT NULL,
      cdss_request_payload    JSONB        NOT NULL DEFAULT '{}',
      cdss_response_payload   JSONB        NOT NULL DEFAULT '{}',
      top_recommendation      TEXT,
      confidence_score        DECIMAL(5,4),
      clinician_action        VARCHAR(20)  CHECK (clinician_action IN ('accepted','modified','overridden','ignored')),
      override_reason         TEXT,
      patient_outcome_id      UUID         REFERENCES clinical_outcomes(id) ON DELETE SET NULL,
      outcome_at_30_days      JSONB,
      outcome_at_90_days      JSONB,
      feedback_sent_to_cdss   BOOLEAN      NOT NULL DEFAULT FALSE,
      feedback_sent_at        TIMESTAMPTZ,
      created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )`,

    // ── Indexes ────────────────────────────────────────────────────────────────
    `CREATE INDEX IF NOT EXISTS idx_cdss_decision_log_patient
       ON cdss_decision_log(patient_id, created_at DESC)`,

    `CREATE INDEX IF NOT EXISTS idx_cdss_decision_log_type
       ON cdss_decision_log(decision_type, clinician_action)`,

    `CREATE INDEX IF NOT EXISTS idx_cdss_decision_log_feedback
       ON cdss_decision_log(feedback_sent_to_cdss, created_at)`,

    `CREATE INDEX IF NOT EXISTS idx_cdss_decision_log_encounter
       ON cdss_decision_log(encounter_id) WHERE encounter_id IS NOT NULL`,
  ];
}

async function applyToTenant(databaseName: string): Promise<void> {
  const tenantClient = new Client(buildTenantConnection(databaseName));
  await tenantClient.connect();

  try {
    // Idempotency guard — skip if this bundle was already applied
    const check = await tenantClient.query(
      `SELECT 1 FROM tenant_schema_versions
        WHERE bundle_id = $1 AND bundle_version = $2
        LIMIT 1`,
      [BUNDLE_ID, BUNDLE_VERSION],
    );
    if (check.rowCount && check.rowCount > 0) {
      console.log(`⏭  ${databaseName}: already at ${BUNDLE_ID}@${BUNDLE_VERSION}, skipping`);
      return;
    }

    for (const sql of getStatements()) {
      await tenantClient.query(sql);
    }

    await tenantClient.query(
      `INSERT INTO tenant_schema_versions
         (bundle_id, bundle_version, script_path, description)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (bundle_id) DO UPDATE
         SET bundle_version = EXCLUDED.bundle_version,
             script_path    = EXCLUDED.script_path,
             description    = EXCLUDED.description,
             applied_at     = NOW()`,
      [
        BUNDLE_ID,
        BUNDLE_VERSION,
        'scripts/provision-sprint61-cdss-outcome-feedback.ts',
        'Sprint 61 — CDSS decision log for outcome feedback loop; tracks every AI recommendation + clinician response',
      ],
    );

    console.log(`✅ ${databaseName}: applied ${BUNDLE_ID}@${BUNDLE_VERSION}`);
  } finally {
    await tenantClient.end();
  }
}

async function main(): Promise<void> {
  const masterClient = new Client({
    host:     process.env.DB_HOST     || process.env.SERVICE_POSTGRES_HOST || 'localhost',
    port:     Number(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432'),
    user:     process.env.DB_USERNAME || process.env.POSTGRES_USER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
    database: process.env.DB_NAME     || process.env.POSTGRES_DB || 'medicore_master',
  });

  await masterClient.connect();

  try {
    const columnsResult = await masterClient.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'tenants'`,
    );
    const columns = new Set<string>(columnsResult.rows.map((r) => String(r.column_name)));
    const dbNameColumn = columns.has('databaseName')
      ? 'databaseName'
      : columns.has('database_name')
      ? 'database_name'
      : '';
    const statusColumn = columns.has('status') ? 'status' : '';

    if (!dbNameColumn) throw new Error('Cannot resolve tenant database-name column.');

    const query = `
      SELECT id, subdomain, ${quoteIdent(dbNameColumn)} AS database_name
      FROM tenants
      ${statusColumn ? `WHERE ${quoteIdent(statusColumn)} = 'active'` : ''}
      ORDER BY subdomain ASC
    `;

    const tenants = await masterClient.query(query);
    if (!tenants.rowCount) {
      console.log('No tenants found to provision.');
      return;
    }

    console.log(`Found ${tenants.rowCount} active tenant(s). Applying ${BUNDLE_ID}@${BUNDLE_VERSION}...`);

    for (const tenant of tenants.rows) {
      const databaseName = String(tenant.database_name || '').trim();
      const subdomain    = String(tenant.subdomain    || '').trim();

      if (!databaseName) {
        console.log(`⚠️  Skipping tenant ${subdomain || tenant.id} (missing database name)`);
        continue;
      }

      try {
        await applyToTenant(databaseName);
      } catch (error: any) {
        console.error(`❌ ${databaseName}: failed — ${String(error?.message || error)}`);
        throw error;
      }
    }
  } finally {
    await masterClient.end();
  }
}

main().catch((error) => {
  console.error('Provisioning failed:', error);
  process.exit(1);
});
