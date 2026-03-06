import { Client } from 'pg';

const BUNDLE_ID = 'sprint56_post_visit_document_intelligence';
const BUNDLE_VERSION = '2026.03.06';

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
    `CREATE TABLE IF NOT EXISTS post_visit_document_intelligence (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      document_type VARCHAR(40) NOT NULL
        CHECK (document_type IN ('lab_report', 'prescription', 'imaging_report', 'discharge_summary', 'other')),
      document_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(120),
      file_size INTEGER,
      file_sha256 VARCHAR(128) NOT NULL,
      duplicate_of_document_id UUID REFERENCES post_visit_document_intelligence(id) ON DELETE SET NULL,
      duplicate_similarity DOUBLE PRECISION,
      extraction_status VARCHAR(20) NOT NULL DEFAULT 'processed'
        CHECK (extraction_status IN ('processed', 'failed', 'duplicate')),
      ocr_engine VARCHAR(120),
      ocr_confidence DOUBLE PRECISION,
      extracted_text TEXT,
      structured_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      fhir_resources JSONB NOT NULL DEFAULT '[]'::jsonb,
      critical_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
      critical_detected BOOLEAN NOT NULL DEFAULT FALSE,
      critical_routed BOOLEAN NOT NULL DEFAULT FALSE,
      escalation_event_id UUID,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )`,
    `ALTER TABLE IF EXISTS post_visit_document_intelligence
      ADD COLUMN IF NOT EXISTS duplicate_of_document_id UUID REFERENCES post_visit_document_intelligence(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS duplicate_similarity DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS extraction_status VARCHAR(20) NOT NULL DEFAULT 'processed'
        CHECK (extraction_status IN ('processed', 'failed', 'duplicate')),
      ADD COLUMN IF NOT EXISTS ocr_engine VARCHAR(120),
      ADD COLUMN IF NOT EXISTS ocr_confidence DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS extracted_text TEXT,
      ADD COLUMN IF NOT EXISTS structured_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS fhir_resources JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS critical_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS critical_detected BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS critical_routed BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS escalation_event_id UUID,
      ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb`,
    `CREATE INDEX IF NOT EXISTS idx_post_visit_doc_intelligence_session
      ON post_visit_document_intelligence(session_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_post_visit_doc_intelligence_hash
      ON post_visit_document_intelligence(session_id, file_sha256)`,
    `CREATE INDEX IF NOT EXISTS idx_post_visit_doc_intelligence_critical
      ON post_visit_document_intelligence(session_id, critical_detected, created_at DESC)`,
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
        'scripts/provision-sprint56-post-visit-document-intelligence.ts',
        'Sprint B1 OCR document intelligence schema and indexes',
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
        console.error(`❌ ${databaseName}: failed to apply ${BUNDLE_ID}: ${String(error?.message || error)}`);
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
