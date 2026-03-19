import { Client } from 'pg';

const BUNDLE_ID      = 'sprint64_pre_charting';
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
    `CREATE TABLE IF NOT EXISTS encounter_precharts (
      id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      appointment_id          UUID         NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
      patient_id              UUID         NOT NULL REFERENCES patients(id)    ON DELETE CASCADE,
      generated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      clinical_summary        TEXT,
      active_problems         JSONB        NOT NULL DEFAULT '[]',
      current_medications     JSONB        NOT NULL DEFAULT '[]',
      allergies               JSONB        NOT NULL DEFAULT '[]',
      outstanding_care_gaps   JSONB        NOT NULL DEFAULT '[]',
      suggested_agenda        JSONB        NOT NULL DEFAULT '[]',
      risk_flags              JSONB        NOT NULL DEFAULT '[]',
      last_lab_abnormalities  JSONB        NOT NULL DEFAULT '[]',
      last_imaging_findings   JSONB        NOT NULL DEFAULT '[]',
      provider_reviewed       BOOLEAN      NOT NULL DEFAULT FALSE,
      provider_reviewed_at    TIMESTAMPTZ,
      created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )`,

    `CREATE INDEX IF NOT EXISTS idx_prechart_appointment
       ON encounter_precharts(appointment_id)`,

    `CREATE INDEX IF NOT EXISTS idx_prechart_patient
       ON encounter_precharts(patient_id, generated_at DESC)`,

    `CREATE UNIQUE INDEX IF NOT EXISTS idx_prechart_appt_unique
       ON encounter_precharts(appointment_id)`,
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
       'scripts/provision-sprint64-pre-charting.ts',
       'Sprint 64 — encounter_precharts table: AI prepares chart 30 min before each appointment'],
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
