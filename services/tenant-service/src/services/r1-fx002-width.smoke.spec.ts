/**
 * R1 / FX-002 (S-004) red→green: encrypted columns fit real ciphertext.
 *
 * AES-256-GCM hex format iv:tag:ct carries 66 chars of overhead alone, so
 * VARCHAR(50) rejects EVERY non-empty encrypted value (live 500 on patient
 * intake). This spec provisions a scratch tenant, then inserts max-realistic
 * ciphertext-length values (96 chars ≈ 15-char plaintext + overhead) into
 * id_number/phone/email. Red before the widening bundle, green after.
 *
 * Run: SMOKE_DB_HOST=localhost SMOKE_DB_PORT=55440 ... npm run test:smoke -- r1-fx002-width
 */
import { DataSource } from 'typeorm';
import { DatabaseProvisioningService } from './database-provisioning.service';

const SMOKE_DB = 'smoke_r1_fx002_width';
const SLUG = 'smoke-r1w';

function masterConfig() {
  return {
    host: process.env.SMOKE_DB_HOST ?? 'localhost',
    port: Number(process.env.SMOKE_DB_PORT ?? 55440),
    username: process.env.SMOKE_DB_USER ?? 'postgres',
    password: process.env.SMOKE_DB_PASSWORD ?? 'postgres',
    database: process.env.SMOKE_DB_NAME ?? 'postgres',
  };
}

jest.setTimeout(240_000);

describe('R1 FX-002 encrypted column width (red→green)', () => {
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

    master = new DataSource({ name: 'r1_width_master', type: 'postgres', ...cfg });
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

  it.each(['id_number', 'phone', 'email'])(
    'column %s stores 96-char ciphertext without truncation',
    async (col) => {
      const tenant = new DataSource({
        name: `r1w_${col}`,
        type: 'postgres',
        ...masterConfig(),
        database: SMOKE_DB,
      });
      await tenant.initialize();
      try {
        const ct = 'x'.repeat(96); // 15-char plaintext + 66 overhead + margin
        await tenant.query(
          `INSERT INTO patients (patient_number, first_name, last_name, date_of_birth, gender, ${col})
           VALUES ('PN-W1', 'W', 'Test', '1990-01-01', 'female', $1)`,
          [ct],
        );
        const [row] = await tenant.query(
          `SELECT ${col} AS v FROM patients WHERE patient_number = 'PN-W1'`,
        );
        expect(row.v).toHaveLength(96);
      } finally {
        await tenant.query(`DELETE FROM patients WHERE patient_number = 'PN-W1'`).catch(() => {});
        await tenant.destroy();
      }
    },
  );
});
