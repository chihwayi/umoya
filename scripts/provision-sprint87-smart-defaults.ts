import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const BUNDLE_ID = 'sprint87_smart_defaults';

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
        CREATE TABLE IF NOT EXISTS form_intelligence_configs (
          id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          form_name        TEXT NOT NULL,
          visibility_rules JSONB NOT NULL DEFAULT '[]',
          default_rules    JSONB NOT NULL DEFAULT '[]',
          is_active        BOOLEAN NOT NULL DEFAULT TRUE,
          version          INT NOT NULL DEFAULT 1,
          created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await tc.query(`CREATE INDEX IF NOT EXISTS idx_form_intel_name ON form_intelligence_configs (form_name)`);

      await tc.query(`INSERT INTO tenant_schema_versions (bundle_id) VALUES ($1)`, [BUNDLE_ID]);
      console.log(`[${subdomain}] ✓ Done.`);
    } catch (err) { console.error(`[${subdomain}] ERROR:`, err); }
    finally { await tc.end(); }
  }
}
run().catch(console.error);
