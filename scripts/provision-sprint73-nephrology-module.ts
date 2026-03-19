import { Client } from 'pg';

const BUNDLE_ID = 'sprint73_nephrology_module';

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
      CREATE TABLE IF NOT EXISTS ckd_assessments (
        id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id              UUID NOT NULL,
        assessed_by             UUID NOT NULL,
        assessment_date         TIMESTAMPTZ NOT NULL,
        egfr                    NUMERIC(6,2),
        ckd_stage               TEXT CHECK (ckd_stage IN ('G1','G2','G3a','G3b','G4','G5','G5D')),
        albumin_creatinine_ratio NUMERIC(8,2),
        acr_category            TEXT CHECK (acr_category IN ('A1','A2','A3')),
        serum_creatinine        NUMERIC(7,3),
        serum_potassium         NUMERIC(4,2),
        serum_phosphate         NUMERIC(5,2),
        serum_bicarbonate       NUMERIC(5,2),
        haemoglobin             NUMERIC(4,1),
        primary_cause           TEXT,
        ckd_progression_risk    TEXT CHECK (ckd_progression_risk IN ('low','moderate','high','very_high')),
        gfr_slope_monthly       NUMERIC(6,3),
        on_ras_blockade         BOOLEAN NOT NULL DEFAULT FALSE,
        bp_systolic             SMALLINT,
        bp_diastolic            SMALLINT,
        complications           JSONB NOT NULL DEFAULT '[]',
        notes                   TEXT,
        created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_ckd_patient ON ckd_assessments (patient_id, assessment_date DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS dialysis_records (
        id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id              UUID NOT NULL,
        recorded_by             UUID NOT NULL,
        session_date            TIMESTAMPTZ NOT NULL,
        dialysis_type           TEXT NOT NULL CHECK (dialysis_type IN ('haemodialysis','peritoneal','CRRT','SLED')),
        session_duration_min    SMALLINT,
        pre_weight_kg           NUMERIC(5,2),
        post_weight_kg          NUMERIC(5,2),
        ultrafiltration_vol_ml  INT,
        blood_flow_rate         SMALLINT,
        dialysate_flow_rate     SMALLINT,
        ktv                     NUMERIC(4,2),
        urrpercent              NUMERIC(5,2),
        access_type             TEXT CHECK (access_type IN ('AVF','AVG','tunnelled_CVC','non_tunnelled_CVC','Tenckhoff','PD_catheter')),
        access_site             TEXT,
        pre_bp_systolic         SMALLINT,
        pre_bp_diastolic        SMALLINT,
        post_bp_systolic        SMALLINT,
        post_bp_diastolic       SMALLINT,
        complications           JSONB NOT NULL DEFAULT '[]',
        medications_given       JSONB NOT NULL DEFAULT '[]',
        notes                   TEXT,
        created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_dialysis_patient ON dialysis_records (patient_id, session_date DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS fluid_balance_records (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id          UUID NOT NULL,
        recorded_by         UUID NOT NULL,
        recorded_at         TIMESTAMPTZ NOT NULL,
        intake_oral_ml      INT NOT NULL DEFAULT 0,
        intake_iv_ml        INT NOT NULL DEFAULT 0,
        intake_ngt_ml       INT NOT NULL DEFAULT 0,
        intake_other_ml     INT NOT NULL DEFAULT 0,
        output_urine_ml     INT NOT NULL DEFAULT 0,
        output_drain_ml     INT NOT NULL DEFAULT 0,
        output_stoma_ml     INT NOT NULL DEFAULT 0,
        output_other_ml     INT NOT NULL DEFAULT 0,
        insensible_loss_ml  INT NOT NULL DEFAULT 0,
        net_balance_ml      INT GENERATED ALWAYS AS (
          (intake_oral_ml + intake_iv_ml + intake_ngt_ml + intake_other_ml)
          - (output_urine_ml + output_drain_ml + output_stoma_ml + output_other_ml + insensible_loss_ml)
        ) STORED,
        notes               TEXT,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_fluid_patient ON fluid_balance_records (patient_id, recorded_at DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS renal_biopsies (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id          UUID NOT NULL,
        performed_by        UUID NOT NULL,
        biopsy_date         DATE NOT NULL,
        indication          TEXT NOT NULL,
        egfr_at_biopsy      NUMERIC(6,2),
        histopathology      TEXT,
        pathology_report    TEXT,
        immunofluorescence  TEXT,
        electron_microscopy TEXT,
        diagnosis           TEXT,
        recommendation      TEXT,
        complications       TEXT,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_biopsy_patient ON renal_biopsies (patient_id, biopsy_date DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS transplant_records (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id            UUID NOT NULL,
        transplant_date       DATE NOT NULL,
        donor_type            TEXT NOT NULL CHECK (donor_type IN ('living_related','living_unrelated','deceased_brain_dead','deceased_cardiac_death')),
        cold_ischaemia_hours  NUMERIC(5,2),
        hla_matching          TEXT,
        immunosuppression     JSONB NOT NULL DEFAULT '[]',
        induction_agent       TEXT,
        current_egfr          NUMERIC(6,2),
        rejection_episodes    JSONB NOT NULL DEFAULT '[]',
        latest_biopsy_result  TEXT,
        dsas_present          BOOLEAN NOT NULL DEFAULT FALSE,
        complications         JSONB NOT NULL DEFAULT '[]',
        transplant_centre     TEXT,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_transplant_patient ON transplant_records (patient_id, transplant_date DESC);
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
