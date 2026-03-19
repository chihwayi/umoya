import { Client } from 'pg';

const BUNDLE_ID = 'sprint60_patient_extended_sdoh';
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
    // ── Extended demographics ─────────────────────────────────────────────────
    `ALTER TABLE patients
       ADD COLUMN IF NOT EXISTS ethnicity           VARCHAR(100),
       ADD COLUMN IF NOT EXISTS race                VARCHAR(100),
       ADD COLUMN IF NOT EXISTS preferred_language  VARCHAR(10)  NOT NULL DEFAULT 'en',
       ADD COLUMN IF NOT EXISTS nationality         VARCHAR(100),
       ADD COLUMN IF NOT EXISTS country_of_birth    VARCHAR(100),
       ADD COLUMN IF NOT EXISTS religion            VARCHAR(100),
       ADD COLUMN IF NOT EXISTS interpreter_required BOOLEAN     NOT NULL DEFAULT FALSE`,

    // ── Socioeconomic context ────────────────────────────────────────────────
    `ALTER TABLE patients
       ADD COLUMN IF NOT EXISTS marital_status      VARCHAR(30),
       ADD COLUMN IF NOT EXISTS occupation          VARCHAR(150),
       ADD COLUMN IF NOT EXISTS employment_status   VARCHAR(50),
       ADD COLUMN IF NOT EXISTS education_level     VARCHAR(50)`,

    // ── Disability ────────────────────────────────────────────────────────────
    `ALTER TABLE patients
       ADD COLUMN IF NOT EXISTS disability_status   BOOLEAN      NOT NULL DEFAULT FALSE,
       ADD COLUMN IF NOT EXISTS disability_type     VARCHAR(200)`,

    // ── Preferred care ────────────────────────────────────────────────────────
    `ALTER TABLE patients
       ADD COLUMN IF NOT EXISTS preferred_provider_id UUID REFERENCES users(id) ON DELETE SET NULL`,

    // ── Substance use (structured — AI risk stratification) ──────────────────
    `ALTER TABLE patients
       ADD COLUMN IF NOT EXISTS smoking_status      VARCHAR(20),
       ADD COLUMN IF NOT EXISTS pack_years          DECIMAL(5,1),
       ADD COLUMN IF NOT EXISTS alcohol_use         VARCHAR(20),
       ADD COLUMN IF NOT EXISTS audit_c_score       INT,
       ADD COLUMN IF NOT EXISTS substance_use       BOOLEAN      NOT NULL DEFAULT FALSE,
       ADD COLUMN IF NOT EXISTS substance_use_details TEXT`,

    // ── Reproductive health ───────────────────────────────────────────────────
    `ALTER TABLE patients
       ADD COLUMN IF NOT EXISTS pregnancy_status    VARCHAR(30),
       ADD COLUMN IF NOT EXISTS gestational_age_weeks INT`,

    // ── Advance care planning ─────────────────────────────────────────────────
    `ALTER TABLE patients
       ADD COLUMN IF NOT EXISTS advance_directive_on_file BOOLEAN NOT NULL DEFAULT FALSE`,

    // ── Indexes for AI risk stratification ───────────────────────────────────
    `CREATE INDEX IF NOT EXISTS idx_patients_smoking_status
       ON patients(smoking_status) WHERE smoking_status IS NOT NULL`,

    `CREATE INDEX IF NOT EXISTS idx_patients_pregnancy_status
       ON patients(pregnancy_status) WHERE pregnancy_status IS NOT NULL`,

    `CREATE INDEX IF NOT EXISTS idx_patients_preferred_language
       ON patients(preferred_language)`,

    // ── New table: patient_sdoh ───────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS patient_sdoh (
       id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
       patient_id                  UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
       assessment_date             DATE         NOT NULL DEFAULT CURRENT_DATE,
       housing_status              VARCHAR(30),
       food_security_status        VARCHAR(30),
       transportation_access       VARCHAR(30),
       social_isolation_score      INT          CHECK (social_isolation_score BETWEEN 0 AND 10),
       financial_strain            VARCHAR(30),
       literacy_level              VARCHAR(30),
       icd_z_codes                 JSONB        NOT NULL DEFAULT '[]',
       community_resource_referrals JSONB       NOT NULL DEFAULT '[]',
       assessed_by                 UUID         REFERENCES users(id) ON DELETE SET NULL,
       next_assessment_due         DATE,
       notes                       TEXT,
       created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
       updated_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
     )`,

    `CREATE INDEX IF NOT EXISTS idx_patient_sdoh_patient
       ON patient_sdoh(patient_id, assessment_date DESC)`,

    `CREATE INDEX IF NOT EXISTS idx_patient_sdoh_next_assessment
       ON patient_sdoh(next_assessment_due) WHERE next_assessment_due IS NOT NULL`,
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
        'scripts/provision-sprint60-patient-extended-sdoh.ts',
        'Sprint 60 — expand patients table with demographics/clinical risk fields; add patient_sdoh table',
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
      throw new Error('Cannot resolve tenant database-name column.');
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
