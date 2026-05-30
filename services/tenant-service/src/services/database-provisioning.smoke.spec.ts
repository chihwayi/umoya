/**
 * Tenant Provisioning Smoke Test
 *
 * Provisions a real tenant database against a live PostgreSQL instance and
 * asserts structural completeness. Catches SQL bugs in provisioning bundles
 * at CI time rather than at the point of first real tenant creation.
 *
 * Requires environment variables:
 *   SMOKE_DB_HOST     (default: localhost)
 *   SMOKE_DB_PORT     (default: 5432)
 *   SMOKE_DB_USER     (default: postgres)
 *   SMOKE_DB_PASSWORD (default: postgres)
 *   SMOKE_DB_NAME     (default: postgres — the master/bootstrap DB to connect to)
 *
 * Run locally: npm run test:smoke
 * Run in CI:   set SMOKE_* env vars, then same command
 */

import { DataSource } from 'typeorm';
import { DatabaseProvisioningService } from './database-provisioning.service';

const SMOKE_DB   = 'smoke_tenant_provision_test';
const SLUG       = 'smoke-tenant';
const MIN_TABLES = 500;
const MIN_BUNDLES = 200;

function masterConfig() {
  return {
    host:     process.env.SMOKE_DB_HOST     ?? 'localhost',
    port:     Number(process.env.SMOKE_DB_PORT ?? 5432),
    username: process.env.SMOKE_DB_USER     ?? 'postgres',
    password: process.env.SMOKE_DB_PASSWORD ?? 'postgres',
    database: process.env.SMOKE_DB_NAME     ?? 'postgres',
  };
}

// Increase timeout — full provisioning of 250+ bundles takes 30-90 s
jest.setTimeout(180_000);

describe('Tenant provisioning smoke test', () => {
  let master: DataSource;
  let service: DatabaseProvisioningService;

  beforeAll(async () => {
    master = new DataSource({
      name: 'smoke_master',
      type: 'postgres',
      ...masterConfig(),
    });
    await master.initialize();

    // Drop leftover from a previous interrupted run
    await master.query(`DROP DATABASE IF EXISTS "${SMOKE_DB}" WITH (FORCE)`);

    service = new DatabaseProvisioningService(master);
  });

  afterAll(async () => {
    // Always clean up regardless of test outcome
    try {
      await master.query(`DROP DATABASE IF EXISTS "${SMOKE_DB}" WITH (FORCE)`);
    } catch {}
    if (master?.isInitialized) await master.destroy();
  });

  it('creates the tenant database and returns a connection string', async () => {
    const connStr = await service.createDatabase(SMOKE_DB, SLUG);
    expect(connStr).toMatch(/^postgresql:\/\//);
    expect(connStr).toContain(SMOKE_DB);
  });

  it(`has at least ${MIN_TABLES} tables`, async () => {
    const tenant = new DataSource({
      name: 'smoke_tenant',
      type: 'postgres',
      ...masterConfig(),
      database: SMOKE_DB,
    });
    await tenant.initialize();
    try {
      const [row] = await tenant.query(`
        SELECT count(*)::int AS n
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      `);
      expect(row.n).toBeGreaterThanOrEqual(MIN_TABLES);
    } finally {
      await tenant.destroy();
    }
  });

  it(`applied at least ${MIN_BUNDLES} provisioning bundles`, async () => {
    const tenant = new DataSource({
      name: 'smoke_tenant_bundles',
      type: 'postgres',
      ...masterConfig(),
      database: SMOKE_DB,
    });
    await tenant.initialize();
    try {
      const [row] = await tenant.query(`
        SELECT count(*)::int AS n FROM tenant_schema_versions
      `);
      expect(row.n).toBeGreaterThanOrEqual(MIN_BUNDLES);
    } finally {
      await tenant.destroy();
    }
  });

  it('seeds all 9 demo users with slug-scoped emails', async () => {
    const tenant = new DataSource({
      name: 'smoke_tenant_users',
      type: 'postgres',
      ...masterConfig(),
      database: SMOKE_DB,
    });
    await tenant.initialize();
    try {
      const [row] = await tenant.query(`SELECT count(*)::int AS n FROM users`);
      expect(row.n).toBe(9);

      const roles = await tenant.query<{ role: string }[]>(`
        SELECT role FROM users ORDER BY role
      `);
      const roleSet = new Set(roles.map((r: any) => r.role));
      for (const expected of ['doctor', 'nurse', 'admin', 'pharmacist', 'lab_tech', 'radiologist', 'accounts', 'receptionist', 'nurse_accounts']) {
        expect(roleSet).toContain(expected);
      }

      const [emailRow] = await tenant.query(`
        SELECT count(*)::int AS n FROM users WHERE email LIKE '%@${SLUG}.com'
      `);
      expect(emailRow.n).toBe(9);
    } finally {
      await tenant.destroy();
    }
  });

  it('has no tables without a primary key', async () => {
    const tenant = new DataSource({
      name: 'smoke_tenant_pk',
      type: 'postgres',
      ...masterConfig(),
      database: SMOKE_DB,
    });
    await tenant.initialize();
    try {
      const noPk = await tenant.query(`
        SELECT t.table_name
        FROM information_schema.tables t
        WHERE t.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
          AND NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints tc
            WHERE tc.table_schema = 'public'
              AND tc.table_name = t.table_name
              AND tc.constraint_type = 'PRIMARY KEY'
          )
        ORDER BY t.table_name
      `);
      if (noPk.length > 0) {
        const names = noPk.map((r: any) => r.table_name).join(', ');
        fail(`Tables without primary key: ${names}`);
      }
      expect(noPk.length).toBe(0);
    } finally {
      await tenant.destroy();
    }
  });
});
