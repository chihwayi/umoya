/**
 * R1 / FX-001 (S-005) red→green: master `tenants` policy columns.
 *
 * getTenantSecurityPolicy (ehr-service tenant.service.ts) SELECTs
 * "mfaRequired", "sessionTimeoutMinutes", "allowEmergencyBypass" from master
 * `tenants`, but no provisioning path created them — live 500 "column
 * mfaRequired does not exist". This spec builds a drifted master (tenants
 * table WITHOUT the policy columns), runs the R1 master bundle, and asserts
 * the columns exist afterwards.
 *
 * Run: SMOKE_DB_HOST=localhost SMOKE_DB_PORT=55440 ... npm run test:smoke -- r1-master-policy
 */
import { DataSource } from 'typeorm';
import { DatabaseProvisioningService } from './database-provisioning.service';

const SMOKE_DB = 'smoke_r1_master_policy';

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

describe('R1 FX-001 master tenants policy columns (S-005)', () => {
  let master: DataSource;
  let service: DatabaseProvisioningService;

  beforeAll(async () => {
    const cfg = masterConfig();
    for (const k of ['DB_HOST', 'SERVICE_POSTGRES_HOST']) process.env[k] = cfg.host;
    process.env.DB_PORT = String(cfg.port);
    for (const k of ['DB_USERNAME', 'POSTGRES_USER']) process.env[k] = cfg.username;
    for (const k of ['DB_PASSWORD', 'POSTGRES_PASSWORD']) process.env[k] = cfg.password;
    process.env.POSTGRES_DB = cfg.database;

    master = new DataSource({ name: 'r1_master2', type: 'postgres', ...cfg });
    await master.initialize();
    await master.query(`DROP DATABASE IF EXISTS "${SMOKE_DB}" WITH (FORCE)`);
    await master.query(`CREATE DATABASE "${SMOKE_DB}"`);
    service = new DatabaseProvisioningService(master);
  });

  afterAll(async () => {
    try {
      await master.query(`DROP DATABASE IF EXISTS "${SMOKE_DB}" WITH (FORCE)`);
    } catch {}
    if (master?.isInitialized) await master.destroy();
  });

  it('adds policy columns to a drifted master tenants table', async () => {
    const cfg = masterConfig();
    const target = `postgresql://${cfg.username}:${cfg.password}@${cfg.host}:${cfg.port}/${SMOKE_DB}`;
    const scratch = new DataSource({ name: 'r1_scratch', type: 'postgres', url: target });
    await scratch.initialize();
    try {
      // Simulate the drifted master: tenants WITHOUT policy columns.
      await scratch.query(`CREATE TABLE tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        subdomain TEXT UNIQUE NOT NULL,
        "databaseName" TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active'
      )`);
      const result = await service.applyClinicSchema(target, {
        bundles: ['r1_master_tenant_policy_columns'],
        appliedBy: 'r1-test',
      });
      expect(result.pendingBundles.length).toBe(0);
      for (const col of ['mfaRequired', 'sessionTimeoutMinutes', 'allowEmergencyBypass']) {
        const rows = await scratch.query(
          `SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = $1`,
          [col],
        );
        expect(rows.length).toBe(1);
      }
    } finally {
      await scratch.destroy();
    }
  });
});
