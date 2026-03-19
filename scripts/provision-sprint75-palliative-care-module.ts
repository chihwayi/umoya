import { Client } from 'pg';

const BUNDLE_ID = 'sprint75_palliative_care_module';

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
      CREATE TABLE IF NOT EXISTS palliative_assessments (
        id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id                      UUID NOT NULL,
        assessed_by                     UUID NOT NULL,
        assessment_date                 TIMESTAMPTZ NOT NULL,
        ecog_status                     SMALLINT CHECK (ecog_status BETWEEN 0 AND 4),
        kps_score                       SMALLINT CHECK (kps_score BETWEEN 0 AND 100),
        palliative_phase                TEXT CHECK (palliative_phase IN ('stable','unstable','deteriorating','terminal','dying')),
        primary_diagnosis               TEXT,
        prognosis_weeks                 SMALLINT,
        prognosis_discussed_patient     BOOLEAN NOT NULL DEFAULT FALSE,
        prognosis_discussed_family      BOOLEAN NOT NULL DEFAULT FALSE,
        symptom_burden                  JSONB NOT NULL DEFAULT '{}',
        functional_trajectory           TEXT CHECK (functional_trajectory IN ('improving','stable','declining','rapid_decline')),
        ppi_score                       NUMERIC(5,2),
        pps_score                       NUMERIC(5,2),
        notes                           TEXT,
        created_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_palliative_patient ON palliative_assessments (patient_id, assessment_date DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS symptom_burden_scores (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id          UUID NOT NULL,
        recorded_by         UUID NOT NULL,
        recorded_at         TIMESTAMPTZ NOT NULL,
        pain                SMALLINT NOT NULL DEFAULT 0 CHECK (pain BETWEEN 0 AND 10),
        fatigue             SMALLINT NOT NULL DEFAULT 0 CHECK (fatigue BETWEEN 0 AND 10),
        nausea              SMALLINT NOT NULL DEFAULT 0 CHECK (nausea BETWEEN 0 AND 10),
        depression          SMALLINT NOT NULL DEFAULT 0 CHECK (depression BETWEEN 0 AND 10),
        anxiety             SMALLINT NOT NULL DEFAULT 0 CHECK (anxiety BETWEEN 0 AND 10),
        drowsiness          SMALLINT NOT NULL DEFAULT 0 CHECK (drowsiness BETWEEN 0 AND 10),
        appetite            SMALLINT NOT NULL DEFAULT 0 CHECK (appetite BETWEEN 0 AND 10),
        wellbeing           SMALLINT NOT NULL DEFAULT 0 CHECK (wellbeing BETWEEN 0 AND 10),
        shortness_of_breath SMALLINT NOT NULL DEFAULT 0 CHECK (shortness_of_breath BETWEEN 0 AND 10),
        esas_total          SMALLINT GENERATED ALWAYS AS (
          pain + fatigue + nausea + depression + anxiety +
          drowsiness + appetite + wellbeing + shortness_of_breath
        ) STORED,
        notes               TEXT,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_esas_patient ON symptom_burden_scores (patient_id, recorded_at DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS goals_of_care (
        id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id                  UUID NOT NULL,
        facilitated_by              UUID NOT NULL,
        document_date               TIMESTAMPTZ NOT NULL,
        primary_goal                TEXT NOT NULL CHECK (primary_goal IN ('curative','life_prolonging','comfort')),
        cpr_wishes                  TEXT NOT NULL CHECK (cpr_wishes IN ('full_resuscitation','limited','DNR')),
        ventilation_wishes          TEXT NOT NULL CHECK (ventilation_wishes IN ('full','limited','none')),
        artificial_nutrition_wishes TEXT NOT NULL CHECK (artificial_nutrition_wishes IN ('yes','time_limited_trial','no')),
        hospitalisation_wishes      TEXT NOT NULL CHECK (hospitalisation_wishes IN ('yes','for_symptom_control_only','no')),
        preferred_place_of_death    TEXT CHECK (preferred_place_of_death IN ('home','hospice','hospital','care_facility','undecided')),
        discussion_participants     JSONB NOT NULL DEFAULT '[]',
        patient_has_capacity        BOOLEAN NOT NULL DEFAULT TRUE,
        interpreter_used            BOOLEAN NOT NULL DEFAULT FALSE,
        review_date                 DATE,
        is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
        created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_goc_active_patient ON goals_of_care (patient_id) WHERE is_active = TRUE;
      CREATE INDEX IF NOT EXISTS idx_goc_patient ON goals_of_care (patient_id, document_date DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS advance_directive_records (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id       UUID NOT NULL,
        document_type    TEXT NOT NULL CHECK (document_type IN ('DNACPR','living_will','lasting_power_of_attorney','health_proxy','advance_statement','POLST','MOLST')),
        document_date    DATE NOT NULL,
        summary          TEXT,
        witness_name     TEXT,
        physician_name   TEXT,
        storage_key      TEXT,
        is_active        BOOLEAN NOT NULL DEFAULT TRUE,
        superseded_by_id UUID REFERENCES advance_directive_records(id),
        created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_adv_dir_patient ON advance_directive_records (patient_id, document_date DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS palliative_medication_reviews (
        id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id                  UUID NOT NULL,
        reviewed_by                 UUID NOT NULL,
        review_date                 TIMESTAMPTZ NOT NULL,
        opioid_equivalence_mg_oral  NUMERIC(8,2),
        syringe_driver_contents     JSONB NOT NULL DEFAULT '[]',
        prn_medications             JSONB NOT NULL DEFAULT '[]',
        discontinued_medications    JSONB NOT NULL DEFAULT '[]',
        route_of_administration     TEXT CHECK (route_of_administration IN ('oral','subcutaneous','IV','transdermal','buccal','rectal','intranasal')),
        bowel_care_plan             TEXT,
        anticipatory_medications    JSONB NOT NULL DEFAULT '[]',
        notes                       TEXT,
        created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_pal_med_patient ON palliative_medication_reviews (patient_id, review_date DESC);
    `);

    await client.query(
      `INSERT INTO tenant_schema_versions (bundle_id) VALUES ($1)`,
      [BUNDLE_ID],
    );
    console.log(`  [ok] ${BUNDLE_ID} applied`);
  } finally {
    await client.end();
  }
}

async function main() {
  const masterDb = new Client({ connectionString: process.env.MASTER_DATABASE_URL });
  await masterDb.connect();
  const { rows } = await masterDb.query(`SELECT connection_string FROM tenants WHERE is_active = TRUE`);
  await masterDb.end();
  for (const row of rows) {
    console.log(`Applying to: ${row.connection_string}`);
    await applyToTenant(row.connection_string);
  }
  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
