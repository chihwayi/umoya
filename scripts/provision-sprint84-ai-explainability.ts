import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const BUNDLE_ID = 'sprint84_ai_explainability';

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
        CREATE TABLE IF NOT EXISTS ai_recommendation_audits (
          id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          decision_log_id       UUID,
          recommendation_type   TEXT NOT NULL,
          patient_id            UUID,
          confidence            NUMERIC,
          reasoning             TEXT,
          evidence              JSONB NOT NULL DEFAULT '[]',
          alternatives          JSONB NOT NULL DEFAULT '[]',
          override_logged       BOOLEAN NOT NULL DEFAULT FALSE,
          override_reason       TEXT,
          override_by           UUID,
          displayed_to_user     BOOLEAN NOT NULL DEFAULT FALSE,
          user_read_at          TIMESTAMPTZ,
          created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await tc.query(`CREATE INDEX IF NOT EXISTS idx_ai_audit_patient ON ai_recommendation_audits (patient_id)`);
      await tc.query(`CREATE INDEX IF NOT EXISTS idx_ai_audit_type ON ai_recommendation_audits (recommendation_type)`);
      await tc.query(`CREATE INDEX IF NOT EXISTS idx_ai_audit_override ON ai_recommendation_audits (override_logged) WHERE override_logged = true`);

      await tc.query(`INSERT INTO tenant_schema_versions (bundle_id) VALUES ($1)`, [BUNDLE_ID]);
      console.log(`[${subdomain}] ✓ Done.`);
    } catch (err) { console.error(`[${subdomain}] ERROR:`, err); }
    finally { await tc.end(); }
  }
}
run().catch(console.error);
