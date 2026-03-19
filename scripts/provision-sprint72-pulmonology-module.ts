import { Client } from 'pg';

const BUNDLE_ID = 'sprint72_pulmonology_module';

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
      CREATE TABLE IF NOT EXISTS spirometry_results (
        id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id              UUID NOT NULL,
        performed_by            UUID NOT NULL,
        test_date               TIMESTAMPTZ NOT NULL,
        fvc                     NUMERIC(5,2),
        fev1                    NUMERIC(5,2),
        fev1_fvc_ratio          NUMERIC(5,3),
        fef2575                 NUMERIC(5,2),
        pef                     NUMERIC(6,2),
        tlc                     NUMERIC(5,2),
        dlco                    NUMERIC(5,2),
        fvc_percent_predicted   NUMERIC(5,1),
        fev1_percent_predicted  NUMERIC(5,1),
        interpretation          TEXT NOT NULL CHECK (interpretation IN ('normal','obstructive','restrictive','mixed')),
        gold_stage              SMALLINT CHECK (gold_stage BETWEEN 1 AND 4),
        pre_post_bronchodilator BOOLEAN NOT NULL DEFAULT FALSE,
        reversibility_percent   NUMERIC(5,1),
        quality                 TEXT CHECK (quality IN ('acceptable','borderline','unacceptable')),
        notes                   TEXT,
        created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_spirometry_patient ON spirometry_results (patient_id, test_date DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS copd_assessments (
        id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id                      UUID NOT NULL,
        assessed_by                     UUID NOT NULL,
        assessment_date                 TIMESTAMPTZ NOT NULL,
        cat_score                       SMALLINT CHECK (cat_score BETWEEN 0 AND 40),
        mmrc_dyspnea                    SMALLINT CHECK (mmrc_dyspnea BETWEEN 0 AND 4),
        abcd_group                      TEXT CHECK (abcd_group IN ('A','B','C','D')),
        exacerbation_history            JSONB NOT NULL DEFAULT '[]',
        exacerbations_last_year         SMALLINT NOT NULL DEFAULT 0,
        hospitalizations_last_year      SMALLINT NOT NULL DEFAULT 0,
        current_inhaler_therapy         JSONB NOT NULL DEFAULT '[]',
        smoking_pack_years              NUMERIC(5,1),
        smoking_status                  TEXT CHECK (smoking_status IN ('current','ex','never')),
        oxygen_at_home                  BOOLEAN NOT NULL DEFAULT FALSE,
        pulmonary_rehab_completed       BOOLEAN NOT NULL DEFAULT FALSE,
        notes                           TEXT,
        created_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_copd_patient ON copd_assessments (patient_id, assessment_date DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS asthma_records (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id        UUID NOT NULL,
        assessed_by       UUID NOT NULL,
        assessment_date   TIMESTAMPTZ NOT NULL,
        act_score         SMALLINT CHECK (act_score BETWEEN 5 AND 25),
        acq_score         NUMERIC(3,1),
        severity          TEXT NOT NULL CHECK (severity IN ('intermittent','mild_persistent','moderate_persistent','severe_persistent')),
        control           TEXT NOT NULL CHECK (control IN ('controlled','partly_controlled','uncontrolled')),
        gina_step         SMALLINT CHECK (gina_step BETWEEN 1 AND 5),
        trigger_factors   JSONB NOT NULL DEFAULT '[]',
        asthma_action_plan JSONB NOT NULL DEFAULT '{}',
        reliever_puffs_per_week SMALLINT,
        nocturnal_symptoms BOOLEAN NOT NULL DEFAULT FALSE,
        oral_steroid_courses_last_year SMALLINT NOT NULL DEFAULT 0,
        ige_total         NUMERIC(7,1),
        eosinophil_count  NUMERIC(6,3),
        biologics_eligible BOOLEAN NOT NULL DEFAULT FALSE,
        notes             TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_asthma_patient ON asthma_records (patient_id, assessment_date DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS peak_flow_diaries (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id        UUID NOT NULL,
        recorded_by       UUID NOT NULL,
        recorded_at       TIMESTAMPTZ NOT NULL,
        pef_value         NUMERIC(5,1) NOT NULL,
        percent_predicted NUMERIC(5,1),
        zone              TEXT GENERATED ALWAYS AS (
          CASE
            WHEN percent_predicted >= 80 THEN 'green'
            WHEN percent_predicted >= 50 THEN 'yellow'
            ELSE 'red'
          END
        ) STORED,
        symptoms          JSONB NOT NULL DEFAULT '[]',
        medication_taken  TEXT,
        notes             TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_pef_patient ON peak_flow_diaries (patient_id, recorded_at DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS oxygen_therapy_records (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id       UUID NOT NULL,
        prescribed_by    UUID NOT NULL,
        start_date       DATE NOT NULL,
        end_date         DATE,
        delivery_device  TEXT NOT NULL CHECK (delivery_device IN ('nasal_cannula','simple_mask','venturi_mask','non_rebreather','high_flow_nasal','cpap','bipap','mechanical_ventilator')),
        flow_rate_lpm    NUMERIC(4,1) NOT NULL,
        fio2_percent     NUMERIC(5,2),
        target_spo2_min  SMALLINT NOT NULL DEFAULT 88,
        target_spo2_max  SMALLINT NOT NULL DEFAULT 92,
        indication       TEXT NOT NULL,
        spo2_on_therapy  NUMERIC(4,1),
        pao2_on_therapy  NUMERIC(5,1),
        paco2_on_therapy NUMERIC(5,1),
        status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','weaned','discontinued')),
        weaning_plan     TEXT,
        notes            TEXT,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_o2_patient ON oxygen_therapy_records (patient_id, start_date DESC);
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
