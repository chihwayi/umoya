import { Client } from 'pg';

const BUNDLE_ID = 'sprint59_vitals_extended';
const BUNDLE_VERSION = '2026.03.18';

function quoteIdent(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`;
}

function buildTenantConnection(databaseName: string) {
  return {
    host: process.env.DB_HOST || process.env.SERVICE_POSTGRES_HOST || 'localhost',
    port: Number(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432'),
    user: process.env.DB_USERNAME || process.env.POSTGRES_USER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
    database: databaseName,
  };
}

function getStatements(): string[] {
  return [
    // ── Core BP fix: separate integer columns ──────────────────────────────────
    `ALTER TABLE vitals
       ADD COLUMN IF NOT EXISTS systolic_bp  INT,
       ADD COLUMN IF NOT EXISTS diastolic_bp INT`,

    // Backfill existing string "120/80" rows into the new INT columns
    `UPDATE vitals
     SET
       systolic_bp  = NULLIF(SPLIT_PART(blood_pressure, '/', 1), '')::INT,
       diastolic_bp = NULLIF(SPLIT_PART(blood_pressure, '/', 2), '')::INT
     WHERE blood_pressure LIKE '%/%'
       AND systolic_bp IS NULL`,

    // ── NEWS2 auto-calculated score ────────────────────────────────────────────
    `ALTER TABLE vitals
       ADD COLUMN IF NOT EXISTS news_score INT`,

    // ── Extended anthropometric / monitoring fields ────────────────────────────
    `ALTER TABLE vitals
       ADD COLUMN IF NOT EXISTS waist_circumference  DECIMAL(5,2),
       ADD COLUMN IF NOT EXISTS head_circumference   DECIMAL(5,2),
       ADD COLUMN IF NOT EXISTS muac                 DECIMAL(5,2),
       ADD COLUMN IF NOT EXISTS peak_flow_rate       INT`,

    // ── Structured pain fields ─────────────────────────────────────────────────
    `ALTER TABLE vitals
       ADD COLUMN IF NOT EXISTS pain_location   VARCHAR(100),
       ADD COLUMN IF NOT EXISTS pain_character  VARCHAR(100)`,

    // ── Data source provenance ─────────────────────────────────────────────────
    `ALTER TABLE vitals
       ADD COLUMN IF NOT EXISTS vital_source VARCHAR(30) NOT NULL DEFAULT 'manual'`,

    // ── Indexes for AI trending / alerting ────────────────────────────────────
    `CREATE INDEX IF NOT EXISTS idx_vitals_systolic_trend
       ON vitals(patient_id, systolic_bp, recorded_at DESC)`,

    `CREATE INDEX IF NOT EXISTS idx_vitals_diastolic_trend
       ON vitals(patient_id, diastolic_bp, recorded_at DESC)`,

    `CREATE INDEX IF NOT EXISTS idx_vitals_news_score
       ON vitals(patient_id, news_score, recorded_at DESC)`,
  ];
}

async function applyToTenant(databaseName: string): Promise<void> {
  const tenantClient = new Client(buildTenantConnection(databaseName));
  await tenantClient.connect();

  try {
    await tenantClient.query(`
      CREATE TABLE IF NOT EXISTS tenant_schema_versions (
        bundle_id   TEXT PRIMARY KEY,
        version     TEXT NOT NULL,
        applied_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        applied_by  TEXT,
        notes       TEXT
      )
    `);

    const versionRow = await tenantClient.query(
      `SELECT version FROM tenant_schema_versions WHERE bundle_id = $1 LIMIT 1`,
      [BUNDLE_ID],
    );

    if (versionRow.rowCount && versionRow.rows[0].version === BUNDLE_VERSION) {
      console.log(`⏭️  ${databaseName}: ${BUNDLE_ID}@${BUNDLE_VERSION} already applied`);
      return;
    }

    for (const statement of getStatements()) {
      await tenantClient.query(statement);
    }

    await tenantClient.query(
      `INSERT INTO tenant_schema_versions (bundle_id, version, applied_at, applied_by, notes)
       VALUES ($1, $2, NOW(), $3, $4)
       ON CONFLICT (bundle_id) DO UPDATE
         SET version    = EXCLUDED.version,
             applied_at = NOW(),
             applied_by = EXCLUDED.applied_by,
             notes      = EXCLUDED.notes`,
      [
        BUNDLE_ID,
        BUNDLE_VERSION,
        'scripts/provision-sprint59-vitals-extended.ts',
        'Sprint 59 — fix BP VARCHAR bug, add systolic_bp/diastolic_bp INT columns, NEWS2 score, extended vitals fields',
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

    if (!dbNameColumn) {
      throw new Error('Cannot resolve tenant database-name column (expected databaseName or database_name).');
    }

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
