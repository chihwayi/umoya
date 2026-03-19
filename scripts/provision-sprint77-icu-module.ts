import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const BUNDLE_ID = 'sprint77_icu_module';

async function run() {
  const client = new Client({ connectionString: process.env.MASTER_DATABASE_URL });
  await client.connect();
  const tenantsResult = await client.query(`SELECT subdomain FROM tenants WHERE is_active = true`);
  const subdomains: string[] = tenantsResult.rows.map((r: any) => r.subdomain);
  await client.end();

  for (const subdomain of subdomains) {
    const dbName = `medicore_${subdomain}`;
    const tenantClient = new Client({
      connectionString: process.env.MASTER_DATABASE_URL!.replace(/\/[^/]+$/, `/${dbName}`),
    });
    await tenantClient.connect();
    console.log(`[${subdomain}] Provisioning ${BUNDLE_ID}…`);

    try {
      await tenantClient.query(`
        CREATE TABLE IF NOT EXISTS tenant_schema_versions (
          bundle_id TEXT PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      const already = await tenantClient.query(
        `SELECT 1 FROM tenant_schema_versions WHERE bundle_id = $1`, [BUNDLE_ID]
      );
      if (already.rowCount && already.rowCount > 0) {
        console.log(`[${subdomain}] Already applied — skipping.`);
        await tenantClient.end();
        continue;
      }

      // ── icu_admissions ─────────────────────────────────────────────────────
      await tenantClient.query(`
        CREATE TABLE IF NOT EXISTS icu_admissions (
          id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id          UUID NOT NULL,
          admission_id        UUID,
          icu_admission_date  TIMESTAMPTZ NOT NULL,
          icu_discharge_date  TIMESTAMPTZ,
          admission_source    TEXT,
          primary_diagnosis   TEXT,
          apache_ii_score     SMALLINT,
          sofa_admission      SMALLINT,
          icu_discharge_reason TEXT,
          mortality_predicted NUMERIC(5,2),
          notes               TEXT,
          created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_icu_adm_patient ON icu_admissions (patient_id, icu_admission_date DESC);
      `);

      // ── sofa_scores ────────────────────────────────────────────────────────
      await tenantClient.query(`
        CREATE TABLE IF NOT EXISTS sofa_scores (
          id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id      UUID NOT NULL,
          scored_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          pao2_fio2       NUMERIC(6,1),
          respiration     SMALLINT CHECK (respiration BETWEEN 0 AND 4),
          platelets       NUMERIC(7,0),
          coagulation     SMALLINT CHECK (coagulation BETWEEN 0 AND 4),
          bilirubin_umol  NUMERIC(7,1),
          liver           SMALLINT CHECK (liver BETWEEN 0 AND 4),
          map_mmhg        NUMERIC(5,1),
          vasopressors    TEXT,
          cardiovascular  SMALLINT CHECK (cardiovascular BETWEEN 0 AND 4),
          gcs             SMALLINT CHECK (gcs BETWEEN 3 AND 15),
          cns             SMALLINT CHECK (cns BETWEEN 0 AND 4),
          creatinine_umol NUMERIC(7,1),
          urine_output_ml NUMERIC(7,1),
          renal           SMALLINT CHECK (renal BETWEEN 0 AND 4),
          total_sofa      SMALLINT,
          delta_sofa      SMALLINT,
          notes           TEXT,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_sofa_patient ON sofa_scores (patient_id, scored_at DESC);
      `);

      // ── ventilator_settings ────────────────────────────────────────────────
      await tenantClient.query(`
        CREATE TABLE IF NOT EXISTS ventilator_settings (
          id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id      UUID NOT NULL,
          recorded_at     TIMESTAMPTZ NOT NULL,
          mode            TEXT NOT NULL CHECK (mode IN ('AC_VC','AC_PC','SIMV','CPAP','PRVC','BiPAP','HFNC','NIV_CPAP','NIV_BiPAP')),
          tidal_volume_ml NUMERIC(6,1),
          rate            SMALLINT,
          fio2_pct        NUMERIC(5,2),
          peep_cmh2o      NUMERIC(5,1),
          i_pressure_cmh2o NUMERIC(5,1),
          e_pressure_cmh2o NUMERIC(5,1),
          pip_cmh2o       NUMERIC(5,1),
          map_airway      NUMERIC(5,1),
          i_time          NUMERIC(4,2),
          e_time          NUMERIC(4,2),
          compliance_ml_cmh2o NUMERIC(6,2),
          resistance_cmh2o_l_s NUMERIC(6,2),
          spo2_pct        NUMERIC(5,2),
          pao2_kpa        NUMERIC(5,1),
          paco2_kpa       NUMERIC(5,1),
          notes           TEXT,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_vent_patient ON ventilator_settings (patient_id, recorded_at DESC);
      `);

      // ── sedation_records ───────────────────────────────────────────────────
      await tenantClient.query(`
        CREATE TABLE IF NOT EXISTS sedation_records (
          id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id                UUID NOT NULL,
          recorded_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          rass_target               SMALLINT CHECK (rass_target BETWEEN -5 AND 4),
          rass_actual               SMALLINT CHECK (rass_actual BETWEEN -5 AND 4),
          cam_icu_result            TEXT CHECK (cam_icu_result IN ('positive','negative','unable_to_assess')),
          analgesic                 JSONB NOT NULL DEFAULT '{}',
          sedative                  JSONB NOT NULL DEFAULT '{}',
          nmba_used                 BOOLEAN NOT NULL DEFAULT FALSE,
          sab_hold_date             DATE,
          wakefulness_trial_completed BOOLEAN NOT NULL DEFAULT FALSE,
          notes                     TEXT,
          created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_sed_patient ON sedation_records (patient_id, recorded_at DESC);
      `);

      // ── central_line_records ───────────────────────────────────────────────
      await tenantClient.query(`
        CREATE TABLE IF NOT EXISTS central_line_records (
          id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id       UUID NOT NULL,
          line_type        TEXT NOT NULL CHECK (line_type IN ('CVL','arterial','PICC','Midline','PA_catheter','dialysis')),
          site             TEXT,
          insertion_date   DATE NOT NULL,
          removal_date     DATE,
          inserted_by      UUID,
          indication       TEXT,
          dressing_changes JSONB NOT NULL DEFAULT '[]',
          complications    JSONB NOT NULL DEFAULT '[]',
          notes            TEXT,
          created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_line_patient ON central_line_records (patient_id, insertion_date DESC);
      `);

      // ── vasopressor_records ────────────────────────────────────────────────
      await tenantClient.query(`
        CREATE TABLE IF NOT EXISTS vasopressor_records (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id  UUID NOT NULL,
          drug        TEXT NOT NULL,
          dose        NUMERIC(8,3),
          unit        TEXT,
          start_time  TIMESTAMPTZ NOT NULL,
          stop_time   TIMESTAMPTZ,
          titrations  JSONB NOT NULL DEFAULT '[]',
          notes       TEXT,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_vaso_patient ON vasopressor_records (patient_id, start_time DESC);
      `);

      await tenantClient.query(
        `INSERT INTO tenant_schema_versions (bundle_id) VALUES ($1)`, [BUNDLE_ID]
      );
      console.log(`[${subdomain}] Done.`);
    } catch (err) {
      console.error(`[${subdomain}] Error:`, err);
    } finally {
      await tenantClient.end();
    }
  }
}

run().catch(console.error);
