import { Client } from 'pg';

const BUNDLE_ID      = 'sprint66_tb_module';
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
    // ── tb_patients ──────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS tb_patients (
      id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id        UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      tb_register_number VARCHAR(50),
      notification_date DATE,
      registration_date DATE        NOT NULL DEFAULT CURRENT_DATE,
      case_type         VARCHAR(30) NOT NULL DEFAULT 'pulmonary'
                          CHECK (case_type IN ('pulmonary','extrapulmonary','mdr','xdr','other')),
      treatment_category VARCHAR(20) NOT NULL DEFAULT 'new'
                          CHECK (treatment_category IN ('new','relapse','treatment_after_failure',
                                                        'treatment_after_ltfu','other_previously_treated','unknown')),
      hiv_status        VARCHAR(20) DEFAULT 'unknown'
                          CHECK (hiv_status IN ('positive','negative','unknown')),
      art_started       BOOLEAN     NOT NULL DEFAULT FALSE,
      ipt_started       BOOLEAN     NOT NULL DEFAULT FALSE,
      anatomical_site   VARCHAR(100),
      referred_from     VARCHAR(100),
      treating_facility VARCHAR(100),
      case_officer_id   UUID REFERENCES users(id) ON DELETE SET NULL,
      status            VARCHAR(30) NOT NULL DEFAULT 'on_treatment'
                          CHECK (status IN ('on_treatment','completed','cured','failed',
                                            'died','ltfu','transferred_out','not_evaluated')),
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE INDEX IF NOT EXISTS idx_tb_patients_patient ON tb_patients(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_tb_patients_status  ON tb_patients(status, registration_date DESC)`,

    // ── tb_diagnoses ─────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS tb_diagnoses (
      id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      tb_patient_id       UUID        NOT NULL REFERENCES tb_patients(id) ON DELETE CASCADE,
      patient_id          UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      diagnosis_date      DATE        NOT NULL DEFAULT CURRENT_DATE,
      sputum_smear_result VARCHAR(20)
                            CHECK (sputum_smear_result IN ('positive','negative','scanty','not_done')),
      genexpert_result    VARCHAR(20)
                            CHECK (genexpert_result IN ('mtb_detected','mtb_not_detected',
                                                        'mtb_detected_rif_resistant',
                                                        'mtb_detected_rif_indeterminate',
                                                        'invalid','error','not_done')),
      culture_result      VARCHAR(20)
                            CHECK (culture_result IN ('positive','negative','contaminated','not_done')),
      cxr_finding         TEXT,
      anatomical_site     VARCHAR(100),
      laboratory_id       VARCHAR(50),
      reported_by         UUID REFERENCES users(id) ON DELETE SET NULL,
      notes               TEXT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE INDEX IF NOT EXISTS idx_tb_diagnoses_tb_patient ON tb_diagnoses(tb_patient_id)`,

    // ── tb_treatment_episodes ────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS tb_treatment_episodes (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      tb_patient_id   UUID        NOT NULL REFERENCES tb_patients(id) ON DELETE CASCADE,
      patient_id      UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      regimen_code    VARCHAR(30) NOT NULL,
      regimen_label   VARCHAR(100),
      phase           VARCHAR(20) NOT NULL DEFAULT 'intensive'
                        CHECK (phase IN ('intensive','continuation','completed')),
      start_date      DATE        NOT NULL,
      expected_end    DATE,
      actual_end      DATE,
      dot_required    BOOLEAN     NOT NULL DEFAULT TRUE,
      outcome         VARCHAR(30)
                        CHECK (outcome IN ('cured','treatment_completed','treatment_failed',
                                           'died','ltfu','not_evaluated','transferred_out')),
      outcome_date    DATE,
      prescribed_by   UUID REFERENCES users(id) ON DELETE SET NULL,
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE INDEX IF NOT EXISTS idx_tb_episodes_tb_patient ON tb_treatment_episodes(tb_patient_id)`,

    // ── tb_dot_records ───────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS tb_dot_records (
      id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      tb_patient_id    UUID        NOT NULL REFERENCES tb_patients(id) ON DELETE CASCADE,
      episode_id       UUID        REFERENCES tb_treatment_episodes(id) ON DELETE CASCADE,
      patient_id       UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      dot_date         DATE        NOT NULL,
      observed         BOOLEAN     NOT NULL,
      dot_worker_id    UUID REFERENCES users(id) ON DELETE SET NULL,
      dot_method       VARCHAR(30) DEFAULT 'in_person'
                         CHECK (dot_method IN ('in_person','video','community_worker','self_administered')),
      doses_taken      INT         NOT NULL DEFAULT 1,
      reason_missed    TEXT,
      side_effects     TEXT,
      recorded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE INDEX IF NOT EXISTS idx_tb_dot_tb_patient ON tb_dot_records(tb_patient_id, dot_date DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_tb_dot_episode    ON tb_dot_records(episode_id, dot_date DESC)`,

    // ── tb_contact_investigations ────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS tb_contact_investigations (
      id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      tb_patient_id     UUID        NOT NULL REFERENCES tb_patients(id) ON DELETE CASCADE,
      contact_name      VARCHAR(150) NOT NULL,
      relationship      VARCHAR(50),
      age               INT,
      gender            VARCHAR(10),
      is_registered_patient BOOLEAN NOT NULL DEFAULT FALSE,
      contact_patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
      screening_date    DATE,
      tst_result        VARCHAR(20),
      igra_result       VARCHAR(20),
      cxr_result        TEXT,
      ltbi_status       VARCHAR(20) DEFAULT 'unknown'
                          CHECK (ltbi_status IN ('positive','negative','unknown','pending')),
      prophylaxis_started BOOLEAN  NOT NULL DEFAULT FALSE,
      prophylaxis_regimen VARCHAR(50),
      tb_disease_found  BOOLEAN    NOT NULL DEFAULT FALSE,
      outcome           VARCHAR(30),
      notes             TEXT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE INDEX IF NOT EXISTS idx_tb_contacts_tb_patient ON tb_contact_investigations(tb_patient_id)`,

    // ── tb_drug_susceptibilities ─────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS tb_drug_susceptibilities (
      id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      tb_patient_id     UUID        NOT NULL REFERENCES tb_patients(id) ON DELETE CASCADE,
      patient_id        UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      specimen_date     DATE        NOT NULL,
      reported_date     DATE,
      laboratory_id     VARCHAR(50),
      isoniazid         VARCHAR(20) CHECK (isoniazid IN ('sensitive','resistant','intermediate','not_tested')),
      rifampicin        VARCHAR(20) CHECK (rifampicin IN ('sensitive','resistant','intermediate','not_tested')),
      ethambutol        VARCHAR(20) CHECK (ethambutol IN ('sensitive','resistant','intermediate','not_tested')),
      pyrazinamide      VARCHAR(20) CHECK (pyrazinamide IN ('sensitive','resistant','intermediate','not_tested')),
      streptomycin      VARCHAR(20) CHECK (streptomycin IN ('sensitive','resistant','intermediate','not_tested')),
      fluoroquinolone   VARCHAR(20) CHECK (fluoroquinolone IN ('sensitive','resistant','intermediate','not_tested')),
      kanamycin         VARCHAR(20) CHECK (kanamycin IN ('sensitive','resistant','intermediate','not_tested')),
      resistance_pattern VARCHAR(30),
      notes             TEXT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE INDEX IF NOT EXISTS idx_tb_dst_tb_patient ON tb_drug_susceptibilities(tb_patient_id)`,

    // ── tb_outcomes ──────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS tb_outcomes (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      tb_patient_id UUID        NOT NULL REFERENCES tb_patients(id) ON DELETE CASCADE,
      patient_id    UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      episode_id    UUID REFERENCES tb_treatment_episodes(id) ON DELETE SET NULL,
      outcome       VARCHAR(30) NOT NULL
                      CHECK (outcome IN ('cured','treatment_completed','treatment_failed',
                                         'died','ltfu','transferred_out','not_evaluated')),
      outcome_date  DATE        NOT NULL,
      cause_of_death VARCHAR(200),
      transfer_facility VARCHAR(100),
      recorded_by   UUID REFERENCES users(id) ON DELETE SET NULL,
      notes         TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE INDEX IF NOT EXISTS idx_tb_outcomes_tb_patient ON tb_outcomes(tb_patient_id)`,
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
       'scripts/provision-sprint66-tb-module.ts',
       'Sprint 66 — TB module: tb_patients, tb_diagnoses, tb_treatment_episodes, tb_dot_records, tb_contact_investigations, tb_drug_susceptibilities, tb_outcomes'],
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
