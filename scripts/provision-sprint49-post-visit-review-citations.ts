import { Client } from 'pg';

const BUNDLE_ID = 'sprint49_post_visit_review_citations';
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
    `CREATE TABLE IF NOT EXISTS post_visit_review_actions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
      artifact_id UUID REFERENCES post_visit_draft_artifacts(id) ON DELETE SET NULL,
      artifact_type VARCHAR(50) NOT NULL,
      action VARCHAR(20) NOT NULL CHECK (action IN ('accept','edit','reject')),
      review_reason TEXT,
      review_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      before_content JSONB NOT NULL DEFAULT '{}'::jsonb,
      after_content JSONB NOT NULL DEFAULT '{}'::jsonb,
      reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
      source VARCHAR(80) NOT NULL DEFAULT 'post_visit_review',
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS post_visit_rule_citations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
      artifact_type VARCHAR(50) NOT NULL DEFAULT 'recommendation_bundle',
      recommendation_id VARCHAR(120),
      rule_id VARCHAR(120) NOT NULL,
      guideline_id VARCHAR(120) NOT NULL,
      citation_label VARCHAR(255) NOT NULL,
      citation_source VARCHAR(255) NOT NULL,
      citation_url TEXT,
      evidence_excerpt TEXT,
      confidence DOUBLE PRECISION,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_post_visit_review_actions_session ON post_visit_review_actions(session_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_post_visit_review_actions_artifact ON post_visit_review_actions(artifact_type, action)`,
    `CREATE INDEX IF NOT EXISTS idx_post_visit_rule_citations_session ON post_visit_rule_citations(session_id, rule_id)`,
    `CREATE INDEX IF NOT EXISTS idx_post_visit_rule_citations_guideline ON post_visit_rule_citations(guideline_id)`,
    `CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql'`,
    `DROP TRIGGER IF EXISTS update_post_visit_review_actions_updated_at ON post_visit_review_actions`,
    `CREATE TRIGGER update_post_visit_review_actions_updated_at
      BEFORE UPDATE ON post_visit_review_actions
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()`,
    `DROP TRIGGER IF EXISTS update_post_visit_rule_citations_updated_at ON post_visit_rule_citations`,
    `CREATE TRIGGER update_post_visit_rule_citations_updated_at
      BEFORE UPDATE ON post_visit_rule_citations
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
        'scripts/provision-sprint49-post-visit-review-citations.ts',
        'Post-visit review action + rule citation normalization',
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
