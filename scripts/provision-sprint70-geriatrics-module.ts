import { Client } from 'pg';

const BUNDLE_ID = 'sprint70_geriatrics_module';

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
      CREATE TABLE IF NOT EXISTS geriatric_assessments (
        id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id             UUID NOT NULL,
        assessed_by            UUID NOT NULL,
        assessment_date        TIMESTAMPTZ NOT NULL DEFAULT now(),
        clinical_frailty_scale INT CHECK (clinical_frailty_scale BETWEEN 1 AND 9),
        barthel_index          INT CHECK (barthel_index BETWEEN 0 AND 100),
        adl_score              INT,
        iadl_score             INT,
        tinnetti_score         INT,
        mmse_score             INT CHECK (mmse_score BETWEEN 0 AND 30),
        moca_score             INT CHECK (moca_score BETWEEN 0 AND 30),
        gds_score              INT CHECK (gds_score BETWEEN 0 AND 30),
        nutritional_screen     TEXT CHECK (nutritional_screen IN ('normal','at_risk','malnourished')),
        hearing_impaired       BOOLEAN DEFAULT FALSE,
        vision_impaired        BOOLEAN DEFAULT FALSE,
        continence_issues      BOOLEAN DEFAULT FALSE,
        social_support         TEXT CHECK (social_support IN ('good','limited','none')),
        caregiver_burden       TEXT CHECK (caregiver_burden IN ('low','moderate','high')),
        notes                  TEXT,
        created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_ga_patient ON geriatric_assessments(patient_id);
      CREATE INDEX IF NOT EXISTS idx_ga_date ON geriatric_assessments(assessment_date DESC);

      CREATE TABLE IF NOT EXISTS falls_assessments (
        id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id           UUID NOT NULL,
        assessed_by          UUID NOT NULL,
        assessment_date      TIMESTAMPTZ NOT NULL DEFAULT now(),
        morse_score          INT,
        fall_history_count   INT DEFAULT 0,
        primary_diagnosis    TEXT,
        ambulation           TEXT CHECK (ambulation IN ('normal','uses_aid','impaired','bed_rest')),
        iv_line_present      BOOLEAN DEFAULT FALSE,
        gait                 TEXT CHECK (gait IN ('normal','weak','impaired')),
        mental_status        TEXT CHECK (mental_status IN ('oriented','confused')),
        medications          JSONB DEFAULT '[]',
        risk_category        TEXT CHECK (risk_category IN ('low','medium','high')),
        prevention_plan      TEXT,
        tinnetti_gait        INT,
        tinnetti_balance     INT,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_fa_patient ON falls_assessments(patient_id);
      CREATE INDEX IF NOT EXISTS idx_fa_risk ON falls_assessments(risk_category) WHERE risk_category = 'high';

      CREATE TABLE IF NOT EXISTS pressure_injury_assessments (
        id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id              UUID NOT NULL,
        assessed_by             UUID NOT NULL,
        assessment_date         TIMESTAMPTZ NOT NULL DEFAULT now(),
        braden_score            INT CHECK (braden_score BETWEEN 6 AND 23),
        existing_injuries       JSONB DEFAULT '[]',
        prevention_protocol     TEXT,
        repositioning_schedule  TEXT,
        special_surface_required BOOLEAN DEFAULT FALSE,
        skin_condition          TEXT,
        moisture_management     TEXT,
        nutritional_support     TEXT,
        created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_pia_patient ON pressure_injury_assessments(patient_id);

      CREATE TABLE IF NOT EXISTS polypharmacy_reviews (
        id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id                  UUID NOT NULL,
        reviewed_by                 UUID NOT NULL,
        review_date                 TIMESTAMPTZ NOT NULL DEFAULT now(),
        total_medications           INT DEFAULT 0,
        beers_criteria_flags        JSONB DEFAULT '[]',
        stopp_start_flags           JSONB DEFAULT '[]',
        deprescribing_recommendations JSONB DEFAULT '[]',
        medications_reviewed        JSONB DEFAULT '[]',
        action_taken                TEXT,
        follow_up_date              DATE,
        created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_pr_patient ON polypharmacy_reviews(patient_id);

      CREATE TABLE IF NOT EXISTS advance_care_planning (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id          UUID NOT NULL,
        created_by          UUID NOT NULL,
        document_type       TEXT NOT NULL CHECK (document_type IN ('DNACPR','living_will','health_proxy','advance_directive','goals_of_care')),
        document_date       DATE NOT NULL,
        summary             TEXT,
        document_storage_key TEXT,
        witness_signed      BOOLEAN DEFAULT FALSE,
        physician_signed    BOOLEAN DEFAULT FALSE,
        patient_signed      BOOLEAN DEFAULT FALSE,
        capacity_confirmed  BOOLEAN DEFAULT FALSE,
        review_date         DATE,
        is_active           BOOLEAN DEFAULT TRUE,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_acp_patient ON advance_care_planning(patient_id);
      CREATE INDEX IF NOT EXISTS idx_acp_active ON advance_care_planning(patient_id, is_active) WHERE is_active = TRUE;

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
