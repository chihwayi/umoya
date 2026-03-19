import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const BUNDLE_ID = 'sprint88_formulary_optimization';

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
        CREATE TABLE IF NOT EXISTS formulary_ai_suggestions (
          id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          prescription_id      UUID,
          patient_id           UUID NOT NULL,
          branded_drug         TEXT NOT NULL,
          generic_alternative  TEXT,
          branded_cost         NUMERIC,
          generic_cost         NUMERIC,
          saving_amount        NUMERIC,
          medical_aid_coverage BOOLEAN NOT NULL DEFAULT FALSE,
          medical_aid_tier     INT,
          evidence_equivalence TEXT,
          ai_recommendation    TEXT NOT NULL,
          reason               TEXT,
          accepted             BOOLEAN,
          created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await tc.query(`CREATE INDEX IF NOT EXISTS idx_formulary_patient ON formulary_ai_suggestions (patient_id)`);
      await tc.query(`CREATE INDEX IF NOT EXISTS idx_formulary_prescription ON formulary_ai_suggestions (prescription_id)`);

      // Extend drugs table
      await tc.query(`ALTER TABLE drugs ADD COLUMN IF NOT EXISTS generic_name_canonical VARCHAR(255)`);
      await tc.query(`ALTER TABLE drugs ADD COLUMN IF NOT EXISTS formulary_tier INT`);
      await tc.query(`ALTER TABLE drugs ADD COLUMN IF NOT EXISTS average_unit_cost_usd DECIMAL(10,4)`);
      await tc.query(`ALTER TABLE drugs ADD COLUMN IF NOT EXISTS bioequivalent_group VARCHAR(100)`);

      await tc.query(`INSERT INTO tenant_schema_versions (bundle_id) VALUES ($1)`, [BUNDLE_ID]);
      console.log(`[${subdomain}] ✓ Done.`);
    } catch (err) { console.error(`[${subdomain}] ERROR:`, err); }
    finally { await tc.end(); }
  }
}
run().catch(console.error);
