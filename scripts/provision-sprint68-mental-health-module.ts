import { Client } from 'pg';

const BUNDLE_ID = 'sprint68_mental_health_module';

async function applyToTenant(connStr: string): Promise<void> {
  const client = new Client({ connectionString: connStr });
  await client.connect();
  try {
    // Idempotency check
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
      CREATE TABLE IF NOT EXISTS mental_health_screenings (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id    UUID NOT NULL,
        screened_by   UUID NOT NULL,
        screened_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        tool          TEXT NOT NULL CHECK (tool IN ('PHQ-9','PHQ-2','GAD-7','AUDIT-C','AUDIT','CSSRS','EPDS','MDQ','PC-PTSD-5')),
        responses     JSONB NOT NULL DEFAULT '{}',
        total_score   INT,
        severity      TEXT CHECK (severity IN ('minimal','mild','moderate','moderately_severe','severe')),
        risk_level    TEXT CHECK (risk_level IN ('low','moderate','high','imminent')),
        action_taken  TEXT,
        follow_up_date DATE,
        notes         TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_mhs_patient ON mental_health_screenings(patient_id);
      CREATE INDEX IF NOT EXISTS idx_mhs_tool_date ON mental_health_screenings(tool, screened_at DESC);
      CREATE INDEX IF NOT EXISTS idx_mhs_risk ON mental_health_screenings(risk_level) WHERE risk_level IN ('high','imminent');

      CREATE TABLE IF NOT EXISTS psychiatric_encounters (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id        UUID NOT NULL,
        provider_id       UUID NOT NULL,
        encounter_date    TIMESTAMPTZ NOT NULL DEFAULT now(),
        encounter_type    TEXT NOT NULL CHECK (encounter_type IN ('initial','follow_up','crisis','inpatient','day_program','telepsychiatry')),
        chief_complaint   TEXT,
        mental_status     JSONB NOT NULL DEFAULT '{}',
        diagnoses         JSONB NOT NULL DEFAULT '[]',
        treatment_plan    TEXT,
        risk_assessment   JSONB,
        disposition       TEXT CHECK (disposition IN ('discharge','follow_up','refer','admit','crisis_team','emergency')),
        next_appointment  DATE,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_pe_patient ON psychiatric_encounters(patient_id);
      CREATE INDEX IF NOT EXISTS idx_pe_provider_date ON psychiatric_encounters(provider_id, encounter_date DESC);

      CREATE TABLE IF NOT EXISTS crisis_events (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id        UUID NOT NULL,
        reported_by       UUID NOT NULL,
        event_date        TIMESTAMPTZ NOT NULL DEFAULT now(),
        crisis_type       TEXT NOT NULL CHECK (crisis_type IN ('suicidal_ideation','suicide_attempt','self_harm','psychosis','aggression','substance_intoxication','panic_attack','other')),
        ideation_type     TEXT CHECK (ideation_type IN ('passive','active_no_plan','active_with_plan','active_with_intent')),
        lethality         TEXT CHECK (lethality IN ('low','medium','high')),
        means_access      BOOLEAN DEFAULT FALSE,
        prior_attempts    INT DEFAULT 0,
        protective_factors JSONB DEFAULT '[]',
        intervention      TEXT,
        outcome           TEXT CHECK (outcome IN ('stabilised','admitted','referred','absconded','deceased','ongoing')),
        follow_up_plan    TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_ce_patient ON crisis_events(patient_id);
      CREATE INDEX IF NOT EXISTS idx_ce_date ON crisis_events(event_date DESC);
      CREATE INDEX IF NOT EXISTS idx_ce_lethality ON crisis_events(lethality) WHERE lethality = 'high';

      CREATE TABLE IF NOT EXISTS safe_plans (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id          UUID NOT NULL,
        created_by          UUID NOT NULL,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        warning_signs       JSONB NOT NULL DEFAULT '[]',
        internal_coping     JSONB NOT NULL DEFAULT '[]',
        social_distractions JSONB NOT NULL DEFAULT '[]',
        support_contacts    JSONB NOT NULL DEFAULT '[]',
        professional_contacts JSONB NOT NULL DEFAULT '[]',
        means_restriction   TEXT,
        reason_to_live      TEXT,
        is_active           BOOLEAN NOT NULL DEFAULT TRUE
      );

      CREATE INDEX IF NOT EXISTS idx_sp_patient ON safe_plans(patient_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sp_patient_active ON safe_plans(patient_id) WHERE is_active = TRUE;

      CREATE TABLE IF NOT EXISTS psychotropic_medications (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id      UUID NOT NULL,
        prescribed_by   UUID NOT NULL,
        drug_name       TEXT NOT NULL,
        drug_class      TEXT NOT NULL CHECK (drug_class IN ('antidepressant','antipsychotic','mood_stabilizer','anxiolytic','stimulant','hypnotic','other')),
        dose_mg         NUMERIC(8,2),
        frequency       TEXT,
        route           TEXT DEFAULT 'oral',
        start_date      DATE NOT NULL,
        end_date        DATE,
        indication      TEXT,
        monitoring_required JSONB DEFAULT '[]',
        last_level_date DATE,
        last_level_value NUMERIC(8,2),
        last_level_unit TEXT,
        adverse_effects TEXT,
        status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','discontinued','held','completed')),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_pm_patient ON psychotropic_medications(patient_id);
      CREATE INDEX IF NOT EXISTS idx_pm_status ON psychotropic_medications(patient_id, status) WHERE status = 'active';
      CREATE INDEX IF NOT EXISTS idx_pm_monitoring ON psychotropic_medications(last_level_date) WHERE monitoring_required != '[]'::jsonb;

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
