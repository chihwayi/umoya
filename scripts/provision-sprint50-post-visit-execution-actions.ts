import { Client } from 'pg';

const BUNDLE_ID = 'sprint50_post_visit_execution_actions';
const BUNDLE_VERSION = '2026.03.05';

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
    `CREATE TABLE IF NOT EXISTS post_visit_action_executions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
      recommendation_id VARCHAR(120) NOT NULL,
      action_key VARCHAR(160) NOT NULL,
      action_type VARCHAR(60) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'executed' CHECK (status IN ('executed','failed','skipped')),
      execution_note TEXT,
      result_resource_type VARCHAR(80),
      result_resource_id VARCHAR(120),
      result_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      error_message TEXT,
      executed_by UUID REFERENCES users(id) ON DELETE SET NULL,
      executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      source VARCHAR(80) NOT NULL DEFAULT 'post_visit_execute',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      UNIQUE(session_id, recommendation_id, action_key)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_post_visit_action_executions_session ON post_visit_action_executions(session_id, recommendation_id)`,
    `CREATE INDEX IF NOT EXISTS idx_post_visit_action_executions_status ON post_visit_action_executions(status, executed_at DESC)`,
    `CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql'`,
    `DROP TRIGGER IF EXISTS update_post_visit_action_executions_updated_at ON post_visit_action_executions`,
    `CREATE TRIGGER update_post_visit_action_executions_updated_at
      BEFORE UPDATE ON post_visit_action_executions
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
      [
        BUNDLE_ID,
        BUNDLE_VERSION,
        'scripts/provision-sprint50-post-visit-execution-actions.ts',
        'Post-visit recommendation execution persistence',
      ],
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
