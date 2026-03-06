import { Client } from 'pg';

const BUNDLE_ID = 'sprint48_post_visit_companion';
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
    `CREATE TABLE IF NOT EXISTS post_visit_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id VARCHAR(100),
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
      appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
      consultation_id UUID REFERENCES telemedicine_consultations(id) ON DELETE SET NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'captured'
        CHECK (status IN ('captured','processing','draft_ready','doctor_reviewed','published','closed')),
      source_type VARCHAR(20) NOT NULL DEFAULT 'in_person'
        CHECK (source_type IN ('in_person','telemedicine','hybrid')),
      language VARCHAR(10) DEFAULT 'en',
      started_at TIMESTAMP WITH TIME ZONE,
      completed_at TIMESTAMP WITH TIME ZONE,
      reviewed_at TIMESTAMP WITH TIME ZONE,
      reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
      published_at TIMESTAMP WITH TIME ZONE,
      safety_level VARCHAR(20),
      risk_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
      meta JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS post_visit_transcript_segments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
      segment_order INTEGER NOT NULL,
      start_second DOUBLE PRECISION NOT NULL,
      end_second DOUBLE PRECISION NOT NULL,
      text TEXT NOT NULL,
      confidence DOUBLE PRECISION,
      language VARCHAR(10),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS post_visit_extracted_entities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
      entity_type VARCHAR(60) NOT NULL,
      entity_value TEXT NOT NULL,
      normalized_value JSONB NOT NULL DEFAULT '{}'::jsonb,
      confidence DOUBLE PRECISION,
      source_start_second DOUBLE PRECISION,
      source_end_second DOUBLE PRECISION,
      source_origin VARCHAR(30) NOT NULL DEFAULT 'transcript',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS post_visit_draft_artifacts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
      artifact_type VARCHAR(50) NOT NULL,
      artifact_status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (artifact_status IN ('draft','reviewed','published')),
      content JSONB NOT NULL DEFAULT '{}'::jsonb,
      citations JSONB NOT NULL DEFAULT '[]'::jsonb,
      confidence DOUBLE PRECISION,
      generated_by VARCHAR(80) NOT NULL DEFAULT 'post_visit_pipeline',
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      UNIQUE(session_id, artifact_type)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_post_visit_sessions_patient_id ON post_visit_sessions(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_post_visit_sessions_doctor_id ON post_visit_sessions(doctor_id)`,
    `CREATE INDEX IF NOT EXISTS idx_post_visit_sessions_status ON post_visit_sessions(status)`,
    `CREATE INDEX IF NOT EXISTS idx_post_visit_sessions_started_at ON post_visit_sessions(started_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_post_visit_transcript_segments_session ON post_visit_transcript_segments(session_id, segment_order)`,
    `CREATE INDEX IF NOT EXISTS idx_post_visit_extracted_entities_session ON post_visit_extracted_entities(session_id, entity_type)`,
    `CREATE INDEX IF NOT EXISTS idx_post_visit_draft_artifacts_session ON post_visit_draft_artifacts(session_id, artifact_type)`,
    `CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql'`,
    `DROP TRIGGER IF EXISTS update_post_visit_sessions_updated_at ON post_visit_sessions`,
    `CREATE TRIGGER update_post_visit_sessions_updated_at
      BEFORE UPDATE ON post_visit_sessions
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()`,
    `DROP TRIGGER IF EXISTS update_post_visit_transcript_segments_updated_at ON post_visit_transcript_segments`,
    `CREATE TRIGGER update_post_visit_transcript_segments_updated_at
      BEFORE UPDATE ON post_visit_transcript_segments
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()`,
    `DROP TRIGGER IF EXISTS update_post_visit_extracted_entities_updated_at ON post_visit_extracted_entities`,
    `CREATE TRIGGER update_post_visit_extracted_entities_updated_at
      BEFORE UPDATE ON post_visit_extracted_entities
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()`,
    `DROP TRIGGER IF EXISTS update_post_visit_draft_artifacts_updated_at ON post_visit_draft_artifacts`,
    `CREATE TRIGGER update_post_visit_draft_artifacts_updated_at
      BEFORE UPDATE ON post_visit_draft_artifacts
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
      [BUNDLE_ID, BUNDLE_VERSION, 'scripts/provision-sprint48-post-visit.ts', 'Post-visit AI companion core schema'],
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
