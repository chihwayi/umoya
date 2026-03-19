import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const BUNDLE_ID = 'sprint86_smart_scheduling';

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
        CREATE TABLE IF NOT EXISTS scheduling_ai_predictions (
          id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          appointment_id       UUID NOT NULL,
          no_show_probability  NUMERIC NOT NULL,
          cancel_probability   NUMERIC NOT NULL,
          recommended_duration INT,
          confidence_score     NUMERIC NOT NULL,
          feature_importance   JSONB NOT NULL DEFAULT '{}',
          model                TEXT,
          prediction_date      TIMESTAMPTZ NOT NULL,
          created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (appointment_id)
        )
      `);
      await tc.query(`CREATE INDEX IF NOT EXISTS idx_sched_pred_apt ON scheduling_ai_predictions (appointment_id)`);
      await tc.query(`CREATE INDEX IF NOT EXISTS idx_sched_pred_noshw ON scheduling_ai_predictions (no_show_probability DESC)`);

      // Extend appointments table
      await tc.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS ai_recommended_duration INT`);
      await tc.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS no_show_risk VARCHAR(20)`);
      await tc.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS overbooking_slot BOOLEAN DEFAULT FALSE`);

      await tc.query(`INSERT INTO tenant_schema_versions (bundle_id) VALUES ($1)`, [BUNDLE_ID]);
      console.log(`[${subdomain}] ✓ Done.`);
    } catch (err) { console.error(`[${subdomain}] ERROR:`, err); }
    finally { await tc.end(); }
  }
}
run().catch(console.error);
