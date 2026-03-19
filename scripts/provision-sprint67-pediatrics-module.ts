import { Client } from 'pg';

const BUNDLE_ID      = 'sprint67_pediatrics_module';
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
    // ── pediatric_profiles ───────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS pediatric_profiles (
      id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id              UUID        NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
      gestational_age_weeks   NUMERIC(4,1),
      birth_weight_grams      INT,
      birth_length_cm         NUMERIC(5,1),
      birth_head_circ_cm      NUMERIC(5,1),
      apgar_1min              INT,
      apgar_5min              INT,
      delivery_type           VARCHAR(20)
                                CHECK (delivery_type IN ('vaginal','caesarean','instrumental','unknown')),
      feeding_type            VARCHAR(20) DEFAULT 'unknown'
                                CHECK (feeding_type IN ('breast','formula','mixed','unknown')),
      neonatal_complications  TEXT,
      blood_group             VARCHAR(5),
      notes                   TEXT,
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE INDEX IF NOT EXISTS idx_ped_profile_patient ON pediatric_profiles(patient_id)`,

    // ── growth_measurements ──────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS growth_measurements (
      id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id              UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      measured_at             DATE        NOT NULL DEFAULT CURRENT_DATE,
      age_months              NUMERIC(6,2),
      weight_kg               NUMERIC(6,3),
      height_cm               NUMERIC(6,2),
      head_circumference_cm   NUMERIC(5,2),
      muac_cm                 NUMERIC(5,2),
      weight_for_age_z        NUMERIC(6,3),
      height_for_age_z        NUMERIC(6,3),
      weight_for_height_z     NUMERIC(6,3),
      bmi_for_age_z           NUMERIC(6,3),
      growth_chart_percentile NUMERIC(5,2),
      nutritional_status      VARCHAR(30),
      measured_by             UUID REFERENCES users(id) ON DELETE SET NULL,
      notes                   TEXT,
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE INDEX IF NOT EXISTS idx_growth_patient ON growth_measurements(patient_id, measured_at DESC)`,

    // ── developmental_milestones ─────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS developmental_milestones (
      id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id                UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      domain                    VARCHAR(30) NOT NULL
                                  CHECK (domain IN ('gross_motor','fine_motor','language',
                                                    'social','cognitive','adaptive')),
      milestone                 VARCHAR(200) NOT NULL,
      expected_age_months       INT,
      achieved_date             DATE,
      age_at_achievement_months INT,
      status                    VARCHAR(20) NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('achieved','delayed','referred','pending')),
      assessed_by               UUID REFERENCES users(id) ON DELETE SET NULL,
      notes                     TEXT,
      created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE INDEX IF NOT EXISTS idx_milestone_patient ON developmental_milestones(patient_id, domain)`,

    // ── neonatal_records ─────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS neonatal_records (
      id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id                  UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      delivery_date               DATE,
      delivery_type               VARCHAR(20),
      gestational_age_weeks       NUMERIC(4,1),
      birth_weight_grams          INT,
      apgar_1min                  INT,
      apgar_5min                  INT,
      apgar_10min                 INT,
      resuscitation_required      BOOLEAN     NOT NULL DEFAULT FALSE,
      resuscitation_details       TEXT,
      special_care_unit_admission BOOLEAN     NOT NULL DEFAULT FALSE,
      scbu_admission_reason       TEXT,
      scbu_discharge_date         DATE,
      vitamin_k_given             BOOLEAN     NOT NULL DEFAULT FALSE,
      eye_prophylaxis_given       BOOLEAN     NOT NULL DEFAULT FALSE,
      hearing_screen_result       VARCHAR(20),
      metabolic_screen_result     VARCHAR(20),
      hiv_exposure_status         VARCHAR(20) DEFAULT 'unknown'
                                    CHECK (hiv_exposure_status IN ('exposed','unexposed','unknown')),
      arvs_given                  BOOLEAN     NOT NULL DEFAULT FALSE,
      discharge_weight_grams      INT,
      discharge_date              DATE,
      attending_clinician_id      UUID REFERENCES users(id) ON DELETE SET NULL,
      notes                       TEXT,
      created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE INDEX IF NOT EXISTS idx_neonatal_patient ON neonatal_records(patient_id)`,

    // ── school_health_records ────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS school_health_records (
      id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id              UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      assessment_date         DATE        NOT NULL DEFAULT CURRENT_DATE,
      grade                   VARCHAR(10),
      school_name             VARCHAR(150),
      vision_right            VARCHAR(20),
      vision_left             VARCHAR(20),
      vision_status           VARCHAR(20),
      hearing_status          VARCHAR(20),
      dental_status           VARCHAR(30),
      immunization_up_to_date BOOLEAN,
      growth_status           VARCHAR(30),
      referrals               JSONB        NOT NULL DEFAULT '[]',
      assessed_by             UUID REFERENCES users(id) ON DELETE SET NULL,
      notes                   TEXT,
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE INDEX IF NOT EXISTS idx_school_health_patient ON school_health_records(patient_id, assessment_date DESC)`,
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
       'scripts/provision-sprint67-pediatrics-module.ts',
       'Sprint 67 — Pediatrics: pediatric_profiles, growth_measurements, developmental_milestones, neonatal_records, school_health_records'],
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
