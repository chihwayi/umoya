import { Client } from 'pg';

const BUNDLE_ID      = 'sprint63_ambient_ai';
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
    `CREATE TABLE IF NOT EXISTS ambient_sessions (
      id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id               UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      appointment_id           UUID         REFERENCES appointments(id) ON DELETE SET NULL,
      provider_id              UUID         NOT NULL REFERENCES users(id),
      status                   VARCHAR(20)  NOT NULL DEFAULT 'active'
                                            CHECK (status IN ('active','paused','completed','failed')),
      audio_storage_key        TEXT,
      transcript_raw           TEXT,
      structured_output        JSONB        NOT NULL DEFAULT '{}',
      draft_note               JSONB        NOT NULL DEFAULT '{}',
      ai_suggested_orders      JSONB        NOT NULL DEFAULT '[]',
      ai_suggested_diagnoses   JSONB        NOT NULL DEFAULT '[]',
      alerts_raised            JSONB        NOT NULL DEFAULT '[]',
      provider_accepted_fields JSONB        NOT NULL DEFAULT '{}',
      session_started_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      session_ended_at         TIMESTAMPTZ,
      created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )`,

    `CREATE INDEX IF NOT EXISTS idx_ambient_session_patient
       ON ambient_sessions(patient_id, session_started_at DESC)`,

    `CREATE INDEX IF NOT EXISTS idx_ambient_session_appointment
       ON ambient_sessions(appointment_id) WHERE appointment_id IS NOT NULL`,

    `CREATE INDEX IF NOT EXISTS idx_ambient_session_provider
       ON ambient_sessions(provider_id, status)`,
  ];
}

async function applyToTenant(databaseName: string): Promise<void> {
  const tenantClient = new Client(buildTenantConnection(databaseName));
  await tenantClient.connect();
  try {
    const check = await tenantClient.query(
      `SELECT 1 FROM tenant_schema_versions WHERE bundle_id = $1 AND bundle_version = $2 LIMIT 1`,
      [BUNDLE_ID, BUNDLE_VERSION],
    );
    if (check.rowCount && check.rowCount > 0) {
      console.log(`⏭  ${databaseName}: already at ${BUNDLE_ID}@${BUNDLE_VERSION}, skipping`);
      return;
    }
    for (const sql of getStatements()) await tenantClient.query(sql);
    await tenantClient.query(
      `INSERT INTO tenant_schema_versions (bundle_id, bundle_version, script_path, description)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (bundle_id) DO UPDATE
         SET bundle_version=EXCLUDED.bundle_version, script_path=EXCLUDED.script_path,
             description=EXCLUDED.description, applied_at=NOW()`,
      [BUNDLE_ID, BUNDLE_VERSION,
       'scripts/provision-sprint63-ambient-ai.ts',
       'Sprint 63 — ambient_sessions table for real-time AI transcription + SOAP pre-fill'],
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
    const dbNameColumn = columns.has('databaseName') ? 'databaseName'
      : columns.has('database_name') ? 'database_name' : '';
    const statusColumn = columns.has('status') ? 'status' : '';
    if (!dbNameColumn) throw new Error('Cannot resolve tenant database-name column.');

    const tenants = await masterClient.query(`
      SELECT id, subdomain, ${quoteIdent(dbNameColumn)} AS database_name FROM tenants
      ${statusColumn ? `WHERE ${quoteIdent(statusColumn)} = 'active'` : ''}
      ORDER BY subdomain ASC
    `);
    if (!tenants.rowCount) { console.log('No tenants found.'); return; }
    console.log(`Found ${tenants.rowCount} tenant(s). Applying ${BUNDLE_ID}@${BUNDLE_VERSION}...`);

    for (const tenant of tenants.rows) {
      const databaseName = String(tenant.database_name || '').trim();
      if (!databaseName) { console.log(`⚠️  Skipping ${tenant.subdomain} (no DB name)`); continue; }
      try {
        await applyToTenant(databaseName);
      } catch (e: any) {
        console.error(`❌ ${databaseName}: ${String(e?.message || e)}`);
        throw e;
      }
    }
  } finally {
    await masterClient.end();
  }
}

main().catch((e) => { console.error('Provisioning failed:', e); process.exit(1); });
