import { Client } from 'pg';

const BUNDLE_ID = 'sprint69_malaria_module';

async function applyToTenant(connStr: string): Promise<void> {
  const client = new Client({ connectionString: connStr });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenant_schema_versions (
        bundle_id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    const { rows } = await client.query(
      `SELECT 1 FROM tenant_schema_versions WHERE bundle_id = $1`,
      [BUNDLE_ID],
    );
    if (rows.length > 0) {
      console.log(`  [skip] ${BUNDLE_ID} already applied`);
      return;
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS malaria_cases (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id          UUID NOT NULL,
        registered_by       UUID NOT NULL,
        registered_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
        case_type           TEXT NOT NULL CHECK (case_type IN ('uncomplicated','severe','mixed')),
        species             TEXT CHECK (species IN ('falciparum','vivax','malariae','ovale','knowlesi','mixed','unknown')),
        haemoglobin         NUMERIC(5,1),
        parasitaemia        NUMERIC(10,2),
        gcs                 INT CHECK (gcs BETWEEN 3 AND 15),
        outcome             TEXT CHECK (outcome IN ('recovered','died','transferred','defaulted','ongoing')),
        outcome_date        DATE,
        notes               TEXT,
        status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_mc_patient ON malaria_cases(patient_id);
      CREATE INDEX IF NOT EXISTS idx_mc_status ON malaria_cases(status, registered_at DESC);
      CREATE INDEX IF NOT EXISTS idx_mc_species ON malaria_cases(species);

      CREATE TABLE IF NOT EXISTS malaria_tests (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        malaria_case_id  UUID NOT NULL REFERENCES malaria_cases(id) ON DELETE CASCADE,
        patient_id       UUID NOT NULL,
        test_date        TIMESTAMPTZ NOT NULL DEFAULT now(),
        test_type        TEXT NOT NULL CHECK (test_type IN ('RDT','microscopy','PCR','LAMP')),
        result           TEXT NOT NULL CHECK (result IN ('positive','negative','indeterminate')),
        species          TEXT,
        parasite_density NUMERIC(10,2),
        gametocytes      BOOLEAN DEFAULT FALSE,
        performed_by     UUID,
        lab_reference    TEXT,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_mt_case ON malaria_tests(malaria_case_id);
      CREATE INDEX IF NOT EXISTS idx_mt_patient_date ON malaria_tests(patient_id, test_date DESC);

      CREATE TABLE IF NOT EXISTS malaria_treatments (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        malaria_case_id  UUID NOT NULL REFERENCES malaria_cases(id) ON DELETE CASCADE,
        patient_id       UUID NOT NULL,
        prescribed_by    UUID NOT NULL,
        regimen          TEXT NOT NULL CHECK (regimen IN ('AL','ASAQ','IV_artesunate','IM_artesunate','quinine_IV','quinine_oral','primaquine','chloroquine','SP_IPTp','other')),
        regimen_label    TEXT,
        start_date       DATE NOT NULL,
        duration_days    INT,
        dose_mg_per_kg   NUMERIC(6,2),
        act_lot_number   TEXT,
        day_one_observed BOOLEAN DEFAULT FALSE,
        follow_up_day3   JSONB,
        follow_up_day7   JSONB,
        follow_up_day14  JSONB,
        follow_up_day28  JSONB,
        treatment_outcome TEXT CHECK (treatment_outcome IN ('adequate_clinical_response','early_treatment_failure','late_clinical_failure','late_parasitological_failure','completed','ongoing')),
        created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_mtr_case ON malaria_treatments(malaria_case_id);
      CREATE INDEX IF NOT EXISTS idx_mtr_patient ON malaria_treatments(patient_id);

      CREATE TABLE IF NOT EXISTS malaria_contact_tracing (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        malaria_case_id  UUID NOT NULL REFERENCES malaria_cases(id) ON DELETE CASCADE,
        contact_name     TEXT NOT NULL,
        relationship     TEXT,
        age_years        INT,
        screened_date    DATE,
        rdt_result       TEXT CHECK (rdt_result IN ('positive','negative','pending','not_done')),
        treated          BOOLEAN DEFAULT FALSE,
        irs_applied      BOOLEAN DEFAULT FALSE,
        itn_provided     BOOLEAN DEFAULT FALSE,
        notes            TEXT,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_mct_case ON malaria_contact_tracing(malaria_case_id);

      CREATE TABLE IF NOT EXISTS malaria_surveillance_reports (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_week      INT NOT NULL,
        report_year      INT NOT NULL,
        facility_id      UUID,
        total_tested     INT DEFAULT 0,
        total_positive   INT DEFAULT 0,
        falciparum_cases INT DEFAULT 0,
        vivax_cases      INT DEFAULT 0,
        severe_cases     INT DEFAULT 0,
        deaths           INT DEFAULT 0,
        act_courses_used INT DEFAULT 0,
        irs_households   INT DEFAULT 0,
        itn_distributed  INT DEFAULT 0,
        submitted_by     UUID,
        submitted_at     TIMESTAMPTZ,
        dhis2_synced     BOOLEAN DEFAULT FALSE,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_msr_week_facility ON malaria_surveillance_reports(report_week, report_year, facility_id);

      INSERT INTO tenant_schema_versions (bundle_id) VALUES ($1);
    `, [BUNDLE_ID]);

    console.log(`  [ok] ${BUNDLE_ID} applied`);
  } finally {
    await client.end();
  }
}

async function main() {
  const master = new Client({ connectionString: process.env.MASTER_DB_URL });
  await master.connect();
  const { rows: tenants } = await master.query(
    `SELECT subdomain, db_url FROM tenants WHERE active = TRUE`,
  );
  await master.end();
  for (const t of tenants) {
    console.log(`Tenant: ${t.subdomain}`);
    await applyToTenant(t.db_url);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
