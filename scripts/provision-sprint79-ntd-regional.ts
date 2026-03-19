import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const BUNDLE_ID = 'sprint79_ntd_regional';

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

      // ── ntd_cases ─────────────────────────────────────────────────────────
      await tenantClient.query(`
        CREATE TABLE IF NOT EXISTS ntd_cases (
          id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id                  UUID NOT NULL,
          disease                     TEXT NOT NULL,
          species                     TEXT,
          acquisition_route           TEXT,
          presenting_manifestations   TEXT[],
          stool_urine_result          TEXT,
          treatment                   TEXT,
          mass_chemoprophylaxis_campaign BOOLEAN NOT NULL DEFAULT FALSE,
          diagnosis_date              DATE,
          notes                       TEXT,
          created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await tenantClient.query(`
        CREATE INDEX IF NOT EXISTS idx_ntd_cases_patient ON ntd_cases (patient_id);
      `);
      await tenantClient.query(`
        CREATE INDEX IF NOT EXISTS idx_ntd_cases_disease ON ntd_cases (disease);
      `);

      // ── cholera_cases ─────────────────────────────────────────────────────
      await tenantClient.query(`
        CREATE TABLE IF NOT EXISTS cholera_cases (
          id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id           UUID NOT NULL,
          case_classification  TEXT NOT NULL DEFAULT 'suspected',
          onset                DATE NOT NULL,
          dehydration_severity TEXT,
          ivf_given            BOOLEAN NOT NULL DEFAULT FALSE,
          oral_rehydration     BOOLEAN NOT NULL DEFAULT FALSE,
          antibiotic           TEXT,
          contact_tracing      JSONB NOT NULL DEFAULT '[]',
          outbreak_cluster     TEXT,
          notes                TEXT,
          created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await tenantClient.query(`
        CREATE INDEX IF NOT EXISTS idx_cholera_patient ON cholera_cases (patient_id);
      `);
      await tenantClient.query(`
        CREATE INDEX IF NOT EXISTS idx_cholera_cluster ON cholera_cases (outbreak_cluster);
      `);

      // ── typhoid_cases ─────────────────────────────────────────────────────
      await tenantClient.query(`
        CREATE TABLE IF NOT EXISTS typhoid_cases (
          id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id                  UUID NOT NULL,
          onset_date                  DATE NOT NULL,
          widal_titer                 TEXT,
          blood_culture_result        TEXT,
          resistance_pattern          TEXT[],
          chloramphenicol_sensitivity TEXT,
          treatment                   TEXT,
          complication                TEXT[],
          notes                       TEXT,
          created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await tenantClient.query(`
        CREATE INDEX IF NOT EXISTS idx_typhoid_patient ON typhoid_cases (patient_id);
      `);

      // ── regional_disease_reports ──────────────────────────────────────────
      await tenantClient.query(`
        CREATE TABLE IF NOT EXISTS regional_disease_reports (
          id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          report_period         TEXT NOT NULL,
          period_type           TEXT NOT NULL,
          facility_id           TEXT,
          malaria_cases         INT NOT NULL DEFAULT 0,
          malaria_deaths        INT NOT NULL DEFAULT 0,
          cholera_cases         INT NOT NULL DEFAULT 0,
          cholera_deaths        INT NOT NULL DEFAULT 0,
          typhoid_cases         INT NOT NULL DEFAULT 0,
          ntd_cases             INT NOT NULL DEFAULT 0,
          schistosomiasis_cases INT NOT NULL DEFAULT 0,
          submitted_to_mohcc    BOOLEAN NOT NULL DEFAULT FALSE,
          submission_date       DATE,
          notes                 TEXT,
          created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (report_period, period_type)
        );
      `);
      await tenantClient.query(`
        CREATE INDEX IF NOT EXISTS idx_rdr_period ON regional_disease_reports (report_period, period_type);
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
