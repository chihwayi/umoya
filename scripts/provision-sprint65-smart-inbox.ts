import { Client } from 'pg';

const BUNDLE_ID      = 'sprint65_smart_inbox';
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
    `CREATE TABLE IF NOT EXISTS inbox_items (
      id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id            UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      patient_id         UUID          REFERENCES patients(id) ON DELETE CASCADE,
      source_type        VARCHAR(50)   NOT NULL,
      source_id          UUID,
      title              VARCHAR(255)  NOT NULL,
      preview            TEXT,
      ai_priority        VARCHAR(20)   NOT NULL DEFAULT 'routine'
                           CHECK (ai_priority IN ('critical','urgent','routine','informational')),
      ai_priority_reason TEXT,
      ai_draft_reply     TEXT,
      is_read            BOOLEAN       NOT NULL DEFAULT FALSE,
      is_actioned        BOOLEAN       NOT NULL DEFAULT FALSE,
      actioned_at        TIMESTAMPTZ,
      due_by             TIMESTAMPTZ,
      triage_score       INT,
      triage_model       VARCHAR(60),
      created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )`,

    `CREATE INDEX IF NOT EXISTS idx_inbox_user
       ON inbox_items(user_id, is_read, ai_priority, created_at DESC)`,

    `CREATE INDEX IF NOT EXISTS idx_inbox_patient
       ON inbox_items(patient_id, created_at DESC)`,

    `CREATE INDEX IF NOT EXISTS idx_inbox_critical
       ON inbox_items(user_id, ai_priority, is_actioned)
       WHERE ai_priority IN ('critical','urgent')`,
  ];
}

async function applyToTenant(databaseName: string): Promise<void> {
  const tenantClient = new Client(buildTenantConnection(databaseName));
  await tenantClient.connect();
  try {
    const check = await tenantClient.query(
      `SELECT 1 FROM tenant_schema_versions WHERE bundle_id=$1 AND bundle_version=$2 LIMIT 1`,
      [BUNDLE_ID, BUNDLE_VERSION],
    );
    if (check.rowCount && check.rowCount > 0) {
      console.log(`⏭  ${databaseName}: already at ${BUNDLE_ID}@${BUNDLE_VERSION}, skipping`);
      return;
    }
    for (const sql of getStatements()) await tenantClient.query(sql);
    await tenantClient.query(
      `INSERT INTO tenant_schema_versions (bundle_id,bundle_version,script_path,description)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (bundle_id) DO UPDATE
         SET bundle_version=EXCLUDED.bundle_version, script_path=EXCLUDED.script_path,
             description=EXCLUDED.description, applied_at=NOW()`,
      [BUNDLE_ID, BUNDLE_VERSION,
       'scripts/provision-sprint65-smart-inbox.ts',
       'Sprint 65 — inbox_items table: AI-triaged smart inbox for providers'],
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
      `SELECT column_name FROM information_schema.columns WHERE table_name='tenants'`,
    );
    const columns = new Set<string>(columnsResult.rows.map((r) => String(r.column_name)));
    const dbNameColumn = columns.has('databaseName') ? 'databaseName'
      : columns.has('database_name') ? 'database_name' : '';
    const statusColumn = columns.has('status') ? 'status' : '';
    if (!dbNameColumn) throw new Error('Cannot resolve tenant database-name column.');

    const tenants = await masterClient.query(`
      SELECT id, subdomain, ${quoteIdent(dbNameColumn)} AS database_name FROM tenants
      ${statusColumn ? `WHERE ${quoteIdent(statusColumn)}='active'` : ''}
      ORDER BY subdomain ASC
    `);
    if (!tenants.rowCount) { console.log('No tenants found.'); return; }
    console.log(`Found ${tenants.rowCount} tenant(s). Applying ${BUNDLE_ID}@${BUNDLE_VERSION}...`);

    for (const tenant of tenants.rows) {
      const databaseName = String(tenant.database_name || '').trim();
      if (!databaseName) { console.log(`⚠️  Skipping ${tenant.subdomain}`); continue; }
      try { await applyToTenant(databaseName); }
      catch (e: any) { console.error(`❌ ${databaseName}: ${String(e?.message||e)}`); throw e; }
    }
  } finally { await masterClient.end(); }
}

main().catch((e) => { console.error('Provisioning failed:', e); process.exit(1); });
