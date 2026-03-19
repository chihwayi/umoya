import { Client } from 'pg';

const BUNDLE_ID = 'sprint74_dermatology_module';

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
      CREATE TABLE IF NOT EXISTS skin_lesions (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id            UUID NOT NULL,
        recorded_by           UUID NOT NULL,
        recorded_at           TIMESTAMPTZ NOT NULL,
        body_location         JSONB NOT NULL DEFAULT '{}',
        lesion_type           TEXT,
        dimensions            JSONB NOT NULL DEFAULT '{}',
        morphology            TEXT CHECK (morphology IN ('macule','patch','papule','plaque','nodule','vesicle','pustule','bulla','wheal','crust','scale','erosion','ulcer','fissure','scar','atrophy','purpura','telangiectasia','other')),
        colour                TEXT,
        borders               TEXT CHECK (borders IN ('well_defined','ill_defined','irregular','scalloped')),
        surface               TEXT,
        evolution             JSONB NOT NULL DEFAULT '{}',
        photograph_key        TEXT,
        dermoscopy_key        TEXT,
        ai_classification     JSONB,
        notes                 TEXT,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_skin_patient ON skin_lesions (patient_id, recorded_at DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS wound_assessments (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id        UUID NOT NULL,
        assessed_by       UUID NOT NULL,
        assessment_date   TIMESTAMPTZ NOT NULL,
        wound_type        TEXT NOT NULL CHECK (wound_type IN ('surgical','pressure','diabetic_foot','venous','arterial','burn','trauma','other')),
        location          TEXT NOT NULL,
        length_cm         NUMERIC(5,2),
        width_cm          NUMERIC(5,2),
        depth_cm          NUMERIC(5,2),
        tunnelling_cm     NUMERIC(5,2),
        undermining       TEXT,
        tissue_type       JSONB NOT NULL DEFAULT '{}',
        exudate_amount    TEXT CHECK (exudate_amount IN ('none','minimal','moderate','heavy')),
        exudate_type      TEXT CHECK (exudate_type IN ('serous','serosanguineous','sanguineous','purulent','haemopurulent')),
        odour             TEXT CHECK (odour IN ('none','mild','moderate','strong')),
        periwound         TEXT,
        infection_signs   BOOLEAN NOT NULL DEFAULT FALSE,
        push_score        SMALLINT,
        bwat_score        SMALLINT,
        treatment_plan    TEXT,
        dressing_used     TEXT,
        review_date       DATE,
        wound_photograph  TEXT,
        notes             TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_wound_patient ON wound_assessments (patient_id, assessment_date DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS burn_assessments (
        id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id              UUID NOT NULL,
        assessed_by             UUID NOT NULL,
        assessment_date         TIMESTAMPTZ NOT NULL,
        mechanism               TEXT CHECK (mechanism IN ('thermal','chemical','electrical','radiation','friction')),
        estimated_tbsa          NUMERIC(5,2),
        burn_depth              JSONB NOT NULL DEFAULT '{}',
        lund_browder_chart      JSONB NOT NULL DEFAULT '{}',
        fluid_resuscitation     JSONB NOT NULL DEFAULT '{}',
        escharotomy_required    BOOLEAN NOT NULL DEFAULT FALSE,
        inhalation_injury       BOOLEAN NOT NULL DEFAULT FALSE,
        weight_kg               NUMERIC(6,2),
        parkland_total_ml       NUMERIC(10,2),
        first_8h_ml             NUMERIC(10,2),
        next_16h_ml             NUMERIC(10,2),
        referral_burns_unit     BOOLEAN NOT NULL DEFAULT FALSE,
        notes                   TEXT,
        created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_burn_patient ON burn_assessments (patient_id, assessment_date DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS dermatology_notes (
        id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id              UUID NOT NULL,
        provider_id             UUID NOT NULL,
        note_date               TIMESTAMPTZ NOT NULL,
        presenting_complaint    TEXT NOT NULL,
        morphology_description  TEXT,
        differential_diagnosis  JSONB NOT NULL DEFAULT '[]',
        ai_lesion_classification JSONB,
        treatment               TEXT,
        follow_up_plan          TEXT,
        biopsy_requested        BOOLEAN NOT NULL DEFAULT FALSE,
        biopsy_site             TEXT,
        created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_derm_note_patient ON dermatology_notes (patient_id, note_date DESC);
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
