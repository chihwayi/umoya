import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const BUNDLE_ID = 'sprint82_pharmacogenomics';

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
        CREATE TABLE IF NOT EXISTS pgx_profiles (
          id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id           UUID NOT NULL UNIQUE,
          genotype_source      TEXT NOT NULL DEFAULT 'lab_test',
          report_date          DATE,
          cyp2d6_phenotype     TEXT,
          cyp2c19_phenotype    TEXT,
          cyp2c9_phenotype     TEXT,
          vkorc1_variant       TEXT,
          tpmt_phenotype       TEXT,
          hla_b_5701           TEXT,
          hla_b_1502           TEXT,
          slco1b1_variant      TEXT,
          g6pd_status          TEXT,
          ugt1a1_phenotype     TEXT,
          raw_genotyping_data  JSONB,
          created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await tc.query(`CREATE INDEX IF NOT EXISTS idx_pgx_profile_patient ON pgx_profiles (patient_id)`);

      await tc.query(`
        CREATE TABLE IF NOT EXISTS pgx_alerts (
          id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id            UUID NOT NULL,
          drug                  TEXT NOT NULL,
          pgx_interaction       TEXT NOT NULL,
          clinical_implication  TEXT NOT NULL,
          alternative_recommended TEXT,
          severity              TEXT NOT NULL,
          gene_involved         TEXT,
          acknowledged          BOOLEAN NOT NULL DEFAULT FALSE,
          acknowledged_by       UUID,
          generated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await tc.query(`CREATE INDEX IF NOT EXISTS idx_pgx_alert_patient ON pgx_alerts (patient_id)`);
      await tc.query(`CREATE INDEX IF NOT EXISTS idx_pgx_alert_unacked ON pgx_alerts (patient_id, acknowledged)`);

      await tc.query(`INSERT INTO tenant_schema_versions (bundle_id) VALUES ($1)`, [BUNDLE_ID]);
      console.log(`[${subdomain}] ✓ Done.`);
    } catch (err) { console.error(`[${subdomain}] ERROR:`, err); }
    finally { await tc.end(); }
  }
}
run().catch(console.error);
