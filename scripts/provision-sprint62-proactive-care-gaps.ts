import { Client } from 'pg';

const BUNDLE_ID      = 'sprint62_proactive_care_gaps';
const BUNDLE_VERSION = '2026.03.18';

function quoteIdent(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`;
}

function buildTenantConnection(databaseName: string) {
  return {
    host:     process.env.DB_HOST     || process.env.SERVICE_POSTGRES_HOST || 'localhost',
    port:     Number(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432'),
    user:     process.env.DB_USERNAME || process.env.POSTGRES_USER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
    database: databaseName,
  };
}

function getStatements(): string[] {
  return [
    // ── Nurse task queue ──────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS nurse_tasks (
      id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id        UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      assigned_to       UUID         REFERENCES users(id) ON DELETE SET NULL,
      assigned_by_system BOOLEAN     NOT NULL DEFAULT FALSE,
      task_type         VARCHAR(50)  NOT NULL,
      priority          VARCHAR(20)  NOT NULL DEFAULT 'medium',
      title             VARCHAR(255) NOT NULL,
      description       TEXT,
      due_date          DATE,
      source_type       VARCHAR(30),
      source_id         UUID,
      status            VARCHAR(30)  NOT NULL DEFAULT 'pending',
      completed_by      UUID         REFERENCES users(id) ON DELETE SET NULL,
      completed_at      TIMESTAMPTZ,
      completion_notes  TEXT,
      created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )`,

    // ── Care gap detection log ────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS care_gap_detections (
      id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id         UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      detected_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      detected_by        VARCHAR(20)  NOT NULL DEFAULT 'cdss',
      gap_type           VARCHAR(100) NOT NULL,
      gap_description    TEXT         NOT NULL,
      recommended_action TEXT,
      due_date           DATE,
      priority           VARCHAR(20)  NOT NULL DEFAULT 'medium',
      icd_code           VARCHAR(20),
      linked_task_id     UUID         REFERENCES nurse_tasks(id) ON DELETE SET NULL,
      status             VARCHAR(30)  NOT NULL DEFAULT 'open',
      created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )`,

    // ── Indexes ────────────────────────────────────────────────────────────────
    `CREATE INDEX IF NOT EXISTS idx_nurse_tasks_assigned_to
       ON nurse_tasks(assigned_to, status, due_date)`,

    `CREATE INDEX IF NOT EXISTS idx_nurse_tasks_patient
       ON nurse_tasks(patient_id, status)`,

    `CREATE INDEX IF NOT EXISTS idx_nurse_tasks_due
       ON nurse_tasks(due_date, priority, status) WHERE status = 'pending'`,

    `CREATE INDEX IF NOT EXISTS idx_care_gap_patient
       ON care_gap_detections(patient_id, status)`,

    `CREATE INDEX IF NOT EXISTS idx_care_gap_due_date
       ON care_gap_detections(due_date, priority, status)`,
  ];
}

async function applyToTenant(databaseName: string): Promise<void> {
  const tenantClient = new Client(buildTenantConnection(databaseName));
  await tenantClient.connect();

  try {
    const check = await tenantClient.query(
      `SELECT 1 FROM tenant_schema_versions
        WHERE bundle_id = $1 AND bundle_version = $2
        LIMIT 1`,
      [BUNDLE_ID, BUNDLE_VERSION],
    );
    if (check.rowCount && check.rowCount > 0) {
      console.log(`⏭  ${databaseName}: already at ${BUNDLE_ID}@${BUNDLE_VERSION}, skipping`);
      return;
    }

    for (const sql of getStatements()) {
      await tenantClient.query(sql);
    }

    await tenantClient.query(
      `INSERT INTO tenant_schema_versions
         (bundle_id, bundle_version, script_path, description)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (bundle_id) DO UPDATE
         SET bundle_version = EXCLUDED.bundle_version,
             script_path    = EXCLUDED.script_path,
             description    = EXCLUDED.description,
             applied_at     = NOW()`,
      [
        BUNDLE_ID,
        BUNDLE_VERSION,
        'scripts/provision-sprint62-proactive-care-gaps.ts',
        'Sprint 62 — nurse_tasks and care_gap_detections tables for proactive AI-push care gap engine',
      ],
    );

    console.log(`✅ ${databaseName}: applied ${BUNDLE_ID}@${BUNDLE_VERSION}`);
  } finally {
    await tenantClient.end();
  }
}

async function main(): Promise<void> {
  const masterClient = new Client({
    host:     process.env.DB_HOST     || process.env.SERVICE_POSTGRES_HOST || 'localhost',
    port:     Number(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432'),
    user:     process.env.DB_USERNAME || process.env.POSTGRES_USER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
    database: process.env.DB_NAME     || process.env.POSTGRES_DB || 'medicore_master',
  });

  await masterClient.connect();

  try {
    const columnsResult = await masterClient.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'tenants'`,
    );
    const columns = new Set<string>(columnsResult.rows.map((r) => String(r.column_name)));
    const dbNameColumn = columns.has('databaseName')
      ? 'databaseName'
      : columns.has('database_name')
      ? 'database_name'
      : '';
    const statusColumn = columns.has('status') ? 'status' : '';

    if (!dbNameColumn) throw new Error('Cannot resolve tenant database-name column.');

    const query = `
      SELECT id, subdomain, ${quoteIdent(dbNameColumn)} AS database_name
      FROM tenants
      ${statusColumn ? `WHERE ${quoteIdent(statusColumn)} = 'active'` : ''}
      ORDER BY subdomain ASC
    `;

    const tenants = await masterClient.query(query);
    if (!tenants.rowCount) {
      console.log('No tenants found to provision.');
      return;
    }

    console.log(`Found ${tenants.rowCount} active tenant(s). Applying ${BUNDLE_ID}@${BUNDLE_VERSION}...`);

    for (const tenant of tenants.rows) {
      const databaseName = String(tenant.database_name || '').trim();
      const subdomain    = String(tenant.subdomain    || '').trim();

      if (!databaseName) {
        console.log(`⚠️  Skipping tenant ${subdomain || tenant.id} (missing database name)`);
        continue;
      }

      try {
        await applyToTenant(databaseName);
      } catch (error: any) {
        console.error(`❌ ${databaseName}: failed — ${String(error?.message || error)}`);
        throw error;
      }
    }
  } finally {
    await masterClient.end();
  }
}

main().catch((error) => {
  console.error('Provisioning failed:', error);
  process.exit(1);
});
