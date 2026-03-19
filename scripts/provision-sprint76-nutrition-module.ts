import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const BUNDLE_ID = 'sprint76_nutrition_module';

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
      // idempotency table
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

      // ── nutritional_screenings ─────────────────────────────────────────────
      await tenantClient.query(`
        CREATE TABLE IF NOT EXISTS nutritional_screenings (
          id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id      UUID NOT NULL,
          screened_by     UUID NOT NULL,
          screening_tool  TEXT NOT NULL CHECK (screening_tool IN ('NRS2002','MUST','MNA','STAMP_pediatric','SNAQ')),
          total_score     SMALLINT NOT NULL,
          risk_category   TEXT NOT NULL CHECK (risk_category IN ('low','moderate','high')),
          follow_up_required BOOLEAN NOT NULL DEFAULT FALSE,
          notes           TEXT,
          screened_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_nutr_screen_patient ON nutritional_screenings (patient_id, screened_at DESC);
      `);

      // ── nutritional_assessments ────────────────────────────────────────────
      await tenantClient.query(`
        CREATE TABLE IF NOT EXISTS nutritional_assessments (
          id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id        UUID NOT NULL,
          dietitian_id      UUID NOT NULL,
          assessment_date   DATE NOT NULL,
          sga_score         TEXT CHECK (sga_score IN ('A','B','C')),
          body_composition  JSONB NOT NULL DEFAULT '{}',
          dietary_history   TEXT,
          intolerances      TEXT[],
          meal_frequency    SMALLINT,
          supplements       TEXT[],
          current_weight_kg NUMERIC(6,2),
          ideal_weight_kg   NUMERIC(6,2),
          height_cm         NUMERIC(5,1),
          bmi               NUMERIC(4,1),
          notes             TEXT,
          created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_nutr_assess_patient ON nutritional_assessments (patient_id, assessment_date DESC);
      `);

      // ── dietary_prescriptions ──────────────────────────────────────────────
      await tenantClient.query(`
        CREATE TABLE IF NOT EXISTS dietary_prescriptions (
          id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id       UUID NOT NULL,
          prescribed_by    UUID NOT NULL,
          prescription_date DATE NOT NULL,
          calorie_target   NUMERIC(7,1),
          protein_target_g NUMERIC(6,1),
          fluid_target_ml  NUMERIC(7,1),
          route            TEXT NOT NULL CHECK (route IN ('oral','NGT','PEG','TPN','PN','NJ')),
          formula          TEXT,
          special_diet     TEXT CHECK (special_diet IN ('standard','diabetic','renal','cardiac','low_sodium','low_fat','ketogenic','high_protein','vegan','gluten_free','other')),
          restrictions     JSONB NOT NULL DEFAULT '[]',
          duration_days    SMALLINT,
          review_date      DATE,
          is_active        BOOLEAN NOT NULL DEFAULT TRUE,
          notes            TEXT,
          created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_nutr_rx_patient ON dietary_prescriptions (patient_id, prescription_date DESC);
      `);

      // ── nutrition_monitoring ───────────────────────────────────────────────
      await tenantClient.query(`
        CREATE TABLE IF NOT EXISTS nutrition_monitoring (
          id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id              UUID NOT NULL,
          recorded_by             UUID NOT NULL,
          monitoring_date         DATE NOT NULL,
          actual_calories_intake  NUMERIC(7,1),
          actual_protein_intake_g NUMERIC(6,1),
          oral_intake_percent     SMALLINT CHECK (oral_intake_percent BETWEEN 0 AND 100),
          tolerance_issues        TEXT,
          weight_kg               NUMERIC(6,2),
          albumin_g_dl            NUMERIC(4,2),
          prealbumin_mg_dl        NUMERIC(5,2),
          plan_adjustment         TEXT,
          notes                   TEXT,
          created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_nutr_mon_patient ON nutrition_monitoring (patient_id, monitoring_date DESC);
      `);

      await tenantClient.query(
        `INSERT INTO tenant_schema_versions (bundle_id) VALUES ($1)`, [BUNDLE_ID]
      );
      console.log(`[${subdomain}] Done.`);
    } catch (err) {
      console.error(`[${subdomain}] Error:`, err);
    } finally {
      await tenantClient.end();
    }
  }
}

run().catch(console.error);
