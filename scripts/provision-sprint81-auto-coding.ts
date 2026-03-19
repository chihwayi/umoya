import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const BUNDLE_ID = 'sprint81_auto_coding';

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
        CREATE TABLE IF NOT EXISTS auto_coding_suggestions (
          id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          note_id              UUID NOT NULL,
          patient_id           UUID NOT NULL,
          encounter_id         UUID,
          suggested_icd10_codes JSONB NOT NULL DEFAULT '[]',
          suggested_cpt_codes  JSONB NOT NULL DEFAULT '[]',
          review_status        TEXT NOT NULL DEFAULT 'pending',
          confirmed_codes      JSONB,
          reviewed_by          UUID,
          reviewed_at          TIMESTAMPTZ,
          coding_model         TEXT,
          created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (note_id)
        )
      `);
      await tc.query(`CREATE INDEX IF NOT EXISTS idx_acs_patient ON auto_coding_suggestions (patient_id)`);
      await tc.query(`CREATE INDEX IF NOT EXISTS idx_acs_status ON auto_coding_suggestions (review_status)`);
      await tc.query(`CREATE INDEX IF NOT EXISTS idx_acs_note ON auto_coding_suggestions (note_id)`);

      await tc.query(`INSERT INTO tenant_schema_versions (bundle_id) VALUES ($1)`, [BUNDLE_ID]);
      console.log(`[${subdomain}] ✓ Done.`);
    } catch (err) { console.error(`[${subdomain}] ERROR:`, err); }
    finally { await tc.end(); }
  }
}
run().catch(console.error);
