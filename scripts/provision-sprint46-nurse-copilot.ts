import { Client } from 'pg';

const BUNDLE_ID = 'sprint46_nurse_copilot';
const BUNDLE_VERSION = '2026.02.16';

function quoteIdent(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`;
}

function buildTenantConnection(databaseName: string): {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
} {
  return {
    host: process.env.DB_HOST || process.env.SERVICE_POSTGRES_HOST || 'localhost',
    port: Number(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432'),
    user: process.env.DB_USERNAME || process.env.POSTGRES_USER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
    database: databaseName,
  };
}

function getStatements(): string[] {
  return [
    `CREATE EXTENSION IF NOT EXISTS pgcrypto`,
    `CREATE TABLE IF NOT EXISTS nurse_copilot_task_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_id VARCHAR(120) NOT NULL,
      patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed')),
      reason TEXT,
      context JSONB,
      source VARCHAR(50) NOT NULL DEFAULT 'nurse_worklist',
      completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, task_id)
    )`,
    `CREATE TABLE IF NOT EXISTS nurse_copilot_alert_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      alert_id VARCHAR(120) NOT NULL,
      patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'acknowledged' CHECK (status IN ('acknowledged')),
      reason TEXT,
      context JSONB,
      source VARCHAR(50) NOT NULL DEFAULT 'nurse_worklist',
      acknowledged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, alert_id)
    )`,
    `CREATE TABLE IF NOT EXISTS nurse_handoff_workflow_state (
      patient_id UUID PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'reviewed', 'shared')),
      finalized_by UUID REFERENCES users(id) ON DELETE SET NULL,
      finalized_at TIMESTAMP WITH TIME ZONE,
      finalized_summary_preview TEXT,
      finalize_reason TEXT,
      finalize_context JSONB,
      reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMP WITH TIME ZONE,
      reviewer_name VARCHAR(255),
      reviewer_role VARCHAR(100),
      review_reason TEXT,
      review_context JSONB,
      shared_by UUID REFERENCES users(id) ON DELETE SET NULL,
      shared_at TIMESTAMP WITH TIME ZONE,
      share_channel VARCHAR(50),
      share_recipient VARCHAR(255),
      share_reason TEXT,
      share_context JSONB,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_nurse_task_events_user_status ON nurse_copilot_task_events(user_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_nurse_task_events_patient ON nurse_copilot_task_events(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_nurse_task_events_completed_at ON nurse_copilot_task_events(completed_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_nurse_alert_events_user_status ON nurse_copilot_alert_events(user_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_nurse_alert_events_patient ON nurse_copilot_alert_events(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_nurse_alert_events_ack_at ON nurse_copilot_alert_events(acknowledged_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_nurse_handoff_status ON nurse_handoff_workflow_state(status)`,
    `CREATE INDEX IF NOT EXISTS idx_nurse_handoff_finalized_at ON nurse_handoff_workflow_state(finalized_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_nurse_handoff_shared_at ON nurse_handoff_workflow_state(shared_at DESC)`,
    `CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql'`,
    `DROP TRIGGER IF EXISTS update_nurse_copilot_task_events_updated_at ON nurse_copilot_task_events`,
    `CREATE TRIGGER update_nurse_copilot_task_events_updated_at
      BEFORE UPDATE ON nurse_copilot_task_events
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()`,
    `DROP TRIGGER IF EXISTS update_nurse_copilot_alert_events_updated_at ON nurse_copilot_alert_events`,
    `CREATE TRIGGER update_nurse_copilot_alert_events_updated_at
      BEFORE UPDATE ON nurse_copilot_alert_events
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()`,
    `DROP TRIGGER IF EXISTS update_nurse_handoff_workflow_state_updated_at ON nurse_handoff_workflow_state`,
    `CREATE TRIGGER update_nurse_handoff_workflow_state_updated_at
      BEFORE UPDATE ON nurse_handoff_workflow_state
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()`,
  ];
}

async function applyToTenant(databaseName: string): Promise<void> {
  const tenantClient = new Client(buildTenantConnection(databaseName));
  await tenantClient.connect();

  try {
    await tenantClient.query(`
      CREATE TABLE IF NOT EXISTS tenant_schema_versions (
        bundle_id TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        applied_by TEXT,
        notes TEXT
      )
    `);

    const versionRow = await tenantClient.query(
      `SELECT version FROM tenant_schema_versions WHERE bundle_id = $1 LIMIT 1`,
      [BUNDLE_ID],
    );

    if (versionRow.rowCount && versionRow.rows[0].version === BUNDLE_VERSION) {
      console.log(`⏭️  ${databaseName}: ${BUNDLE_ID}@${BUNDLE_VERSION} already applied`);
      return;
    }

    for (const statement of getStatements()) {
      await tenantClient.query(statement);
    }

    await tenantClient.query(
      `
        INSERT INTO tenant_schema_versions (bundle_id, version, applied_at, applied_by, notes)
        VALUES ($1, $2, NOW(), $3, $4)
        ON CONFLICT (bundle_id) DO UPDATE
        SET version = EXCLUDED.version,
            applied_at = NOW(),
            applied_by = EXCLUDED.applied_by,
            notes = EXCLUDED.notes
      `,
      [BUNDLE_ID, BUNDLE_VERSION, 'scripts/provision-sprint46-nurse-copilot.ts', 'Wave 6 nurse copilot persistence'],
    );

    console.log(`✅ ${databaseName}: applied ${BUNDLE_ID}@${BUNDLE_VERSION}`);
  } finally {
    await tenantClient.end();
  }
}

async function main(): Promise<void> {
  const masterClient = new Client({
    host: process.env.DB_HOST || process.env.SERVICE_POSTGRES_HOST || 'localhost',
    port: Number(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432'),
    user: process.env.DB_USERNAME || process.env.POSTGRES_USER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
    database: process.env.DB_NAME || process.env.POSTGRES_DB || 'medicore_master',
  });

  await masterClient.connect();

  try {
    const columnsResult = await masterClient.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'tenants'
      `,
    );

    const columns = new Set<string>(columnsResult.rows.map((row) => String(row.column_name)));
    const dbNameColumn = columns.has('databaseName') ? 'databaseName' : columns.has('database_name') ? 'database_name' : '';
    const statusColumn = columns.has('status') ? 'status' : '';

    if (!dbNameColumn) {
      throw new Error('Unable to resolve tenant database-name column (expected databaseName or database_name).');
    }

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
      const subdomain = String(tenant.subdomain || '').trim();

      if (!databaseName) {
        console.log(`⚠️  Skipping tenant ${subdomain || tenant.id} (missing database name)`);
        continue;
      }

      try {
        await applyToTenant(databaseName);
      } catch (error: any) {
        console.error(`❌ ${databaseName}: ${error.message}`);
      }
    }
  } finally {
    await masterClient.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
