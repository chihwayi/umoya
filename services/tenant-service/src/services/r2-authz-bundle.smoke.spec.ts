// R2 / FX-011+FX-012 RED: bundle r2_authz_disclosure must provision the
// authorization + disclosure-consent schema. Fails until the bundle lands.
import { DataSource } from 'typeorm';

const DB_URL = `postgresql://postgres:postgres@localhost:55440/tenant_audit_clinic`;

describe('R2 bundle r2_authz_disclosure (red→green)', () => {
  let db: DataSource;

  beforeAll(async () => {
    db = new DataSource({ type: 'postgres', url: DB_URL });
    await db.initialize();
  });

  afterAll(async () => {
    await db.destroy();
  });

  test('patient_care_team table exists with active flag', async () => {
    const rows = await db.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'patient_care_team'`,
    );
    const cols = rows.map((r: any) => r.column_name);
    expect(cols).toEqual(expect.arrayContaining(['patient_id', 'user_id', 'active']));
  });

  test('break_glass_access_log table exists with reason + expiry', async () => {
    const rows = await db.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'break_glass_access_log'`,
    );
    const cols = rows.map((r: any) => r.column_name);
    expect(cols).toEqual(
      expect.arrayContaining(['user_id', 'patient_id', 'reason', 'action', 'expires_at']),
    );
  });

  test('household_disclosure_consents table exists with lifecycle columns', async () => {
    const rows = await db.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'household_disclosure_consents'`,
    );
    const cols = rows.map((r: any) => r.column_name);
    expect(cols).toEqual(
      expect.arrayContaining([
        'source_patient_id',
        'condition_category',
        'status',
        'granted_at',
        'withdrawn_at',
      ]),
    );
  });

  test('patient_family_links carries do_not_notify safeguard', async () => {
    const rows = await db.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'patient_family_links' AND column_name = 'do_not_notify'`,
    );
    expect(rows.length).toBe(1);
  });

  test('facility scope columns exist (nullable legacy semantics)', async () => {
    const rows = await db.query(
      `SELECT table_name FROM information_schema.columns WHERE column_name = 'facility_id' AND table_name IN ('patients', 'users')`,
    );
    expect(rows.map((r: any) => r.table_name).sort()).toEqual(['patients', 'users']);
  });

  test('consent household reference matches household_groups id type (bigint)', async () => {
    const rows = await db.query(
      `SELECT data_type FROM information_schema.columns
       WHERE table_name = 'household_disclosure_consents' AND column_name = 'target_household_id'`,
    );
    expect(rows[0]?.data_type).toBe('bigint');
  });
});
