import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const BUNDLE_ID = 'sprint83_antibiogram';

async function run() {
  const client = new Client({ connectionString: process.env.MASTER_DATABASE_URL });
  await client.connect();
  const { rows } = await client.query(`SELECT subdomain FROM tenants WHERE is_active = true`);
  const subdomains: string[] = rows.map((r: any) => r.subdomain);
  await client.end();

  for (const subdomain of subdomains) {
    const dbName = `medicore_${subdomain}`;
    const tc = new Client({ connectionString: process.env.MASTER_DATABASE_URL!.replace(/\/[^/]+$/, `/${dbName}`) });
    await tc.connect();
    console.log(`[${subdomain}] Provisioning ${BUNDLE_ID}…`);
    try {
      await tc.query(`CREATE TABLE IF NOT EXISTS tenant_schema_versions (bundle_id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
      const { rowCount } = await tc.query(`SELECT 1 FROM tenant_schema_versions WHERE bundle_id = $1`, [BUNDLE_ID]);
      if (rowCount && rowCount > 0) { console.log(`[${subdomain}] Already applied — skipping.`); await tc.end(); continue; }

      await tc.query(`
        CREATE TABLE IF NOT EXISTS antibiogram_entries (
          id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organism             TEXT NOT NULL,
          antibiotic           TEXT NOT NULL,
          year                 INT NOT NULL,
          quarter              SMALLINT,
          susceptible_percent  NUMERIC NOT NULL,
          intermediate_percent NUMERIC NOT NULL DEFAULT 0,
          resistant_percent    NUMERIC NOT NULL,
          total_isolates       INT NOT NULL,
          specimen_type        TEXT NOT NULL,
          ward                 TEXT,
          created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await tc.query(`CREATE INDEX IF NOT EXISTS idx_abio_organism ON antibiogram_entries (organism, antibiotic, year)`);
      await tc.query(`CREATE INDEX IF NOT EXISTS idx_abio_specimen ON antibiogram_entries (specimen_type, year)`);

      await tc.query(`
        CREATE TABLE IF NOT EXISTS antibiogram_summaries (
          id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          period_label                    TEXT NOT NULL,
          specimen_type                   TEXT NOT NULL,
          data                            JSONB NOT NULL,
          top_resistant_organisms         JSONB NOT NULL DEFAULT '[]',
          recommended_empirical_choices   JSONB NOT NULL DEFAULT '{}',
          generated_at                    TIMESTAMPTZ NOT NULL,
          created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (period_label, specimen_type)
        )
      `);

      await tc.query(`
        CREATE TABLE IF NOT EXISTS culture_sensitivity_results (
          id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id               UUID NOT NULL,
          lab_order_id             UUID,
          specimen_type            TEXT NOT NULL,
          collection_date          DATE NOT NULL,
          organism_isolated        TEXT,
          no_growth                BOOLEAN NOT NULL DEFAULT FALSE,
          disk_diffusion_results   JSONB NOT NULL DEFAULT '{}',
          mic_values               JSONB NOT NULL DEFAULT '{}',
          clsi_breakpoints_used    TEXT,
          esbl_detected            BOOLEAN,
          carbapenem_resistant     BOOLEAN,
          notes                    TEXT,
          created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await tc.query(`CREATE INDEX IF NOT EXISTS idx_culture_patient ON culture_sensitivity_results (patient_id)`);
      await tc.query(`CREATE INDEX IF NOT EXISTS idx_culture_organism ON culture_sensitivity_results (organism_isolated)`);

      await tc.query(`INSERT INTO tenant_schema_versions (bundle_id) VALUES ($1)`, [BUNDLE_ID]);
      console.log(`[${subdomain}] ✓ Done.`);
    } catch (err) { console.error(`[${subdomain}] ERROR:`, err); }
    finally { await tc.end(); }
  }
}
run().catch(console.error);
