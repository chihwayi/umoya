import { Client } from 'pg';

const BUNDLE_ID = 'sprint71_neurology_module';

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
      CREATE TABLE IF NOT EXISTS seizure_records (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id       UUID NOT NULL,
        recorded_by      UUID NOT NULL,
        seizure_date     TIMESTAMPTZ NOT NULL,
        seizure_type     TEXT NOT NULL CHECK (seizure_type IN ('focal_aware','focal_impaired','focal_to_bilateral','generalised_tonic_clonic','absence','myoclonic','atonic','unknown')),
        duration_seconds INT,
        triggers         JSONB DEFAULT '[]',
        postictal_state  TEXT CHECK (postictal_state IN ('none','confusion','headache','fatigue','weakness','sleep','other')),
        injury_occurred  BOOLEAN DEFAULT FALSE,
        injury_details   TEXT,
        witness_present  BOOLEAN DEFAULT FALSE,
        video_capture    BOOLEAN DEFAULT FALSE,
        current_aed      JSONB DEFAULT '[]',
        cluster_event    BOOLEAN DEFAULT FALSE,
        status_epilepticus BOOLEAN DEFAULT FALSE,
        notes            TEXT,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_sr_patient ON seizure_records(patient_id);
      CREATE INDEX IF NOT EXISTS idx_sr_date ON seizure_records(seizure_date DESC);
      CREATE INDEX IF NOT EXISTS idx_sr_status_ep ON seizure_records(patient_id) WHERE status_epilepticus = TRUE;

      CREATE TABLE IF NOT EXISTS stroke_assessments (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id            UUID NOT NULL,
        assessed_by           UUID NOT NULL,
        assessment_date       TIMESTAMPTZ NOT NULL DEFAULT now(),
        stroke_type           TEXT NOT NULL CHECK (stroke_type IN ('ischemic','hemorrhagic','TIA','unknown')),
        onset_time            TIMESTAMPTZ,
        last_known_well       TIMESTAMPTZ,
        nihss_score           INT CHECK (nihss_score BETWEEN 0 AND 42),
        ct_findings           TEXT,
        mri_findings          TEXT,
        vessel_occlusion      TEXT,
        ivtpa_eligible        BOOLEAN,
        ivtpa_administered    BOOLEAN DEFAULT FALSE,
        ivtpa_time            TIMESTAMPTZ,
        thrombectomy_performed BOOLEAN DEFAULT FALSE,
        thrombectomy_time     TIMESTAMPTZ,
        mrs_score_admission   INT CHECK (mrs_score_admission BETWEEN 0 AND 6),
        mrs_score_discharge   INT CHECK (mrs_score_discharge BETWEEN 0 AND 6),
        mrs_score_90day       INT CHECK (mrs_score_90day BETWEEN 0 AND 6),
        risk_factors          JSONB DEFAULT '[]',
        secondary_prevention  JSONB DEFAULT '[]',
        notes                 TEXT,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_sa_patient ON stroke_assessments(patient_id);
      CREATE INDEX IF NOT EXISTS idx_sa_date ON stroke_assessments(assessment_date DESC);

      CREATE TABLE IF NOT EXISTS headache_diaries (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id       UUID NOT NULL,
        entry_date       TIMESTAMPTZ NOT NULL DEFAULT now(),
        headache_type    TEXT CHECK (headache_type IN ('migraine_without_aura','migraine_with_aura','tension_type','cluster','medication_overuse','other')),
        severity_vas     INT CHECK (severity_vas BETWEEN 0 AND 10),
        duration_hours   NUMERIC(6,1),
        triggers         JSONB DEFAULT '[]',
        aura_present     BOOLEAN DEFAULT FALSE,
        aura_features    JSONB DEFAULT '[]',
        medication_used  TEXT,
        hit6_score       INT CHECK (hit6_score BETWEEN 36 AND 78),
        disability_level TEXT CHECK (disability_level IN ('little_or_none','some','substantial','severe')),
        notes            TEXT,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_hd_patient ON headache_diaries(patient_id);
      CREATE INDEX IF NOT EXISTS idx_hd_date ON headache_diaries(entry_date DESC);

      CREATE TABLE IF NOT EXISTS neurology_examinations (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id       UUID NOT NULL,
        examined_by      UUID NOT NULL,
        exam_date        TIMESTAMPTZ NOT NULL DEFAULT now(),
        cranial_nerves   JSONB DEFAULT '{}',
        motor_exam       JSONB DEFAULT '{}',
        sensory_exam     JSONB DEFAULT '{}',
        cerebellar       JSONB DEFAULT '{}',
        gait             TEXT,
        reflexes         JSONB DEFAULT '{}',
        mmt              JSONB DEFAULT '{}',
        summary          TEXT,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_ne_patient ON neurology_examinations(patient_id);

      CREATE TABLE IF NOT EXISTS cognitive_assessments (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id       UUID NOT NULL,
        assessed_by      UUID NOT NULL,
        assessment_date  TIMESTAMPTZ NOT NULL DEFAULT now(),
        mmse_score       INT CHECK (mmse_score BETWEEN 0 AND 30),
        moca_score       INT CHECK (moca_score BETWEEN 0 AND 30),
        cdt_score        INT,
        domain_scores    JSONB DEFAULT '{}',
        interpretation   TEXT,
        follow_up_date   DATE,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_ca_patient ON cognitive_assessments(patient_id);
      CREATE INDEX IF NOT EXISTS idx_ca_date ON cognitive_assessments(assessment_date DESC);

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
