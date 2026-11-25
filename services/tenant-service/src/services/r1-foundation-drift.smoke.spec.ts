/**
 * R1 / FX-001 red→green: drift columns exist on a freshly provisioned tenant.
 *
 * Failing first (red): the columns below are referenced by entities / raw SQL
 * (audit S-003, P-003 tables, F-004, RES-007 notes) but were absent from the
 * provisioning bundle, so fresh tenants 500 on patient reads, family panels,
 * and $everything. This spec provisions a scratch tenant DB and asserts each
 * column exists via information_schema.
 *
 * Run: SMOKE_DB_HOST=localhost SMOKE_DB_PORT=55440 SMOKE_DB_USER=postgres
 *      SMOKE_DB_PASSWORD=postgres npm run test:smoke -- r1-foundation-drift
 * (same throwaway-Postgres pattern as database-provisioning.smoke.spec.ts;
 *  synthetic data only, DB dropped in afterAll.)
 */
import { DataSource } from 'typeorm';
import { DatabaseProvisioningService } from './database-provisioning.service';

const SMOKE_DB = 'smoke_r1_foundation_drift';
const SLUG = 'smoke-r1';

function masterConfig() {
  return {
    host: process.env.SMOKE_DB_HOST ?? 'localhost',
    port: Number(process.env.SMOKE_DB_PORT ?? 5432),
    username: process.env.SMOKE_DB_USER ?? 'postgres',
    password: process.env.SMOKE_DB_PASSWORD ?? 'postgres',
    database: process.env.SMOKE_DB_NAME ?? 'postgres',
  };
}

jest.setTimeout(240_000);

// [table, column] pairs that must exist after provisioning (R0 DRIFT_ANALYSIS).
const REQUIRED_COLUMNS: Array<[string, string]> = [
  // S-003: Patient entity vs bundle
  ['patients', 'confidentiality_tier'],
  ['patients', 'deceased_at'],
  ['patients', 'vip_flag'],
  // R0 auditor: post_visit_sessions / readmission_predictions
  ['post_visit_sessions', 'ambient_session_id'],
  ['readmission_predictions', 'readmission_30_day_risk'],
  // R0 auditor: iot timestamp columns
  ['fhir_ingestion_logs', 'created_at'],
  ['iot_data_ingestions', 'created_at'],
  ['iot_device_registrations', 'created_at'],
  ['iot_device_registrations', 'updated_at'],
  ['iot_device_registrations', 'oauth_expires_at'],
  // R0 auditor: vaccine_inventory
  ['vaccine_inventory', 'cost_per_dose'],
  ['vaccine_inventory', 'current_temperature'],
  ['vaccine_inventory', 'funding_source'],
  ['vaccine_inventory', 'ndc_code'],
  ['vaccine_inventory', 'notes'],
  ['vaccine_inventory', 'recall_information'],
  ['vaccine_inventory', 'temperature_alert'],
  // P-003: family panel query targets
  ['patients', 'latest_risk_level'],
  ['patients', 'household_id'],
  // P-001: QR check-in token store
  ['patient_checkin_tokens', 'token_hash'],
];

describe('R1 FX-001 drift columns on fresh tenant', () => {
  let master: DataSource;
  let service: DatabaseProvisioningService;

  beforeAll(async () => {
    const cfg = masterConfig();
    process.env.DB_HOST = cfg.host;
    process.env.SERVICE_POSTGRES_HOST = cfg.host;
    process.env.DB_PORT = String(cfg.port);
    process.env.DB_USERNAME = cfg.username;
    process.env.POSTGRES_USER = cfg.username;
    process.env.DB_PASSWORD = cfg.password;
    process.env.POSTGRES_PASSWORD = cfg.password;
    process.env.POSTGRES_DB = cfg.database;

    master = new DataSource({ name: 'r1_master', type: 'postgres', ...cfg });
    await master.initialize();
    await master.query(`DROP DATABASE IF EXISTS "${SMOKE_DB}" WITH (FORCE)`);
    service = new DatabaseProvisioningService(master);
    await service.createDatabase(SMOKE_DB, SLUG);
  });

  afterAll(async () => {
    try {
      await master.query(`DROP DATABASE IF EXISTS "${SMOKE_DB}" WITH (FORCE)`);
    } catch {}
    if (master?.isInitialized) await master.destroy();
  });

  it.each(REQUIRED_COLUMNS)('has column %s.%s', async (table, column) => {
    const tenant = new DataSource({
      name: `r1_${table}`,
      type: 'postgres',
      ...masterConfig(),
      database: SMOKE_DB,
    });
    await tenant.initialize();
    try {
      const rows = await tenant.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
        [table, column],
      );
      expect(rows.length).toBe(1);
    } finally {
      await tenant.destroy();
    }
  });
});
