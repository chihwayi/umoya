import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const BUNDLE_ID = 'sprint78_sdoh_module';

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

      // ── community_resources ────────────────────────────────────────────────
      await tenantClient.query(`
        CREATE TABLE IF NOT EXISTS community_resources (
          id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name          TEXT NOT NULL,
          category      TEXT NOT NULL,
          description   TEXT,
          address       TEXT,
          phone         TEXT,
          website       TEXT,
          eligibility_criteria TEXT,
          languages     TEXT[],
          availability  TEXT,
          tenant_specific BOOLEAN NOT NULL DEFAULT TRUE,
          is_active     BOOLEAN NOT NULL DEFAULT TRUE,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await tenantClient.query(`
        CREATE INDEX IF NOT EXISTS idx_comm_res_category ON community_resources (category);
      `);
      await tenantClient.query(`
        CREATE INDEX IF NOT EXISTS idx_comm_res_active ON community_resources (is_active);
      `);

      // ── sdoh_referrals ─────────────────────────────────────────────────────
      await tenantClient.query(`
        CREATE TABLE IF NOT EXISTS sdoh_referrals (
          id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id      UUID NOT NULL,
          resource_id     UUID NOT NULL,
          referral_date   DATE NOT NULL,
          referral_reason TEXT NOT NULL,
          referred_by     UUID NOT NULL,
          status          TEXT NOT NULL DEFAULT 'sent',
          outcome         TEXT,
          follow_up_date  DATE,
          notes           TEXT,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await tenantClient.query(`
        CREATE INDEX IF NOT EXISTS idx_sdoh_ref_patient ON sdoh_referrals (patient_id);
      `);
      await tenantClient.query(`
        CREATE INDEX IF NOT EXISTS idx_sdoh_ref_status ON sdoh_referrals (status);
      `);

      // ── sdoh_screening_logs ────────────────────────────────────────────────
      await tenantClient.query(`
        CREATE TABLE IF NOT EXISTS sdoh_screening_logs (
          id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id       UUID NOT NULL,
          screening_date   DATE NOT NULL,
          tool_used        TEXT NOT NULL,
          responses        JSONB NOT NULL DEFAULT '{}',
          positive_screens JSONB NOT NULL DEFAULT '[]',
          z_codes          TEXT[],
          conducted_by     UUID NOT NULL,
          created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await tenantClient.query(`
        CREATE INDEX IF NOT EXISTS idx_sdoh_screen_patient ON sdoh_screening_logs (patient_id);
      `);
      await tenantClient.query(`
        CREATE INDEX IF NOT EXISTS idx_sdoh_screen_date ON sdoh_screening_logs (screening_date);
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
