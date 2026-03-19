import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const BUNDLE_ID = 'sprint80_advanced_hiv_pmtct_pepfar';

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

      // ── pmtct_enrollments ─────────────────────────────────────────────────
      await tenantClient.query(`
        CREATE TABLE IF NOT EXISTS pmtct_enrollments (
          id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id                   UUID NOT NULL,
          gestational_age_at_enrollment SMALLINT,
          hiv_status_at_booking        TEXT NOT NULL,
          art_started                  BOOLEAN NOT NULL DEFAULT FALSE,
          art_regimen                  TEXT,
          viral_load_at_booking        NUMERIC,
          viral_load_at_delivery       NUMERIC,
          delivery_mode                TEXT,
          infant_nvp_provided          BOOLEAN NOT NULL DEFAULT FALSE,
          enrollment_date              DATE NOT NULL,
          notes                        TEXT,
          created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await tenantClient.query(`
        CREATE INDEX IF NOT EXISTS idx_pmtct_enroll_patient ON pmtct_enrollments (patient_id);
      `);

      // ── pmtct_infants ─────────────────────────────────────────────────────
      await tenantClient.query(`
        CREATE TABLE IF NOT EXISTS pmtct_infants (
          id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          mother_patient_id     UUID NOT NULL,
          infant_patient_id     UUID,
          birth_date            DATE NOT NULL,
          birth_weight_kg       NUMERIC,
          hiv_test_at_6weeks    TEXT,
          dbs_result_6weeks     TEXT,
          hiv_test_18months     TEXT,
          final_hiv_status      TEXT,
          breastfeeding_status  TEXT,
          cotrimoxazole_started BOOLEAN NOT NULL DEFAULT FALSE,
          notes                 TEXT,
          created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await tenantClient.query(`
        CREATE INDEX IF NOT EXISTS idx_pmtct_infant_mother ON pmtct_infants (mother_patient_id);
      `);

      // ── pepfar_mer_indicators ─────────────────────────────────────────────
      await tenantClient.query(`
        CREATE TABLE IF NOT EXISTS pepfar_mer_indicators (
          id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          reporting_period   TEXT NOT NULL,
          indicator          TEXT NOT NULL,
          numerator          INT,
          denominator        INT,
          disaggregations    JSONB NOT NULL DEFAULT '{}',
          submitted_to_datim BOOLEAN NOT NULL DEFAULT FALSE,
          created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await tenantClient.query(`
        CREATE INDEX IF NOT EXISTS idx_mer_period_indicator ON pepfar_mer_indicators (reporting_period, indicator);
      `);

      // ── art_cohorts ───────────────────────────────────────────────────────
      await tenantClient.query(`
        CREATE TABLE IF NOT EXISTS art_cohorts (
          id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          cohort_start_date    DATE NOT NULL,
          cohort_size          INT NOT NULL,
          alive_on_art_12m     INT,
          lost_to_followup_12m INT,
          died_12m             INT,
          transferred_out_12m  INT,
          retention_rate       NUMERIC,
          notes                TEXT,
          created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await tenantClient.query(`
        CREATE INDEX IF NOT EXISTS idx_art_cohort_date ON art_cohorts (cohort_start_date DESC);
      `);

      await tenantClient.query(
        `INSERT INTO tenant_schema_versions (bundle_id) VALUES ($1)`, [BUNDLE_ID]
      );
      console.log(`[${subdomain}] ✓ Done.`);
    } catch (err) {
      console.error(`[${subdomain}] ERROR:`, err);
    } finally {
      await tenantClient.end();
    }
  }
}

run().catch(console.error);
