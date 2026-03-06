import { Client } from 'pg';

const BUNDLE_ID = 'sprint51_post_visit_patient_companion_escalations';
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
    `CREATE TABLE IF NOT EXISTS post_visit_companion_threads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','closed')),
      message_count INTEGER NOT NULL DEFAULT 0,
      last_message_at TIMESTAMP WITH TIME ZONE,
      last_patient_message_at TIMESTAMP WITH TIME ZONE,
      last_clinician_message_at TIMESTAMP WITH TIME ZONE,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      UNIQUE(session_id, patient_id)
    )`,
    `CREATE TABLE IF NOT EXISTS post_visit_companion_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      thread_id UUID NOT NULL REFERENCES post_visit_companion_threads(id) ON DELETE CASCADE,
      session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      sender_type VARCHAR(20) NOT NULL
        CHECK (sender_type IN ('patient','clinician','system')),
      sender_id UUID,
      message_type VARCHAR(30) NOT NULL DEFAULT 'question'
        CHECK (message_type IN ('question','answer','summary','checklist','alert','system')),
      message_text TEXT NOT NULL,
      grounded_context JSONB NOT NULL DEFAULT '{}'::jsonb,
      escalation_detected BOOLEAN NOT NULL DEFAULT FALSE,
      escalation_event_id UUID,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS post_visit_escalation_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      thread_id UUID REFERENCES post_visit_companion_threads(id) ON DELETE SET NULL,
      message_id UUID REFERENCES post_visit_companion_messages(id) ON DELETE SET NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open','acknowledged','resolved','dismissed')),
      severity VARCHAR(20) NOT NULL
        CHECK (severity IN ('low','moderate','high','critical')),
      route_target VARCHAR(20) NOT NULL
        CHECK (route_target IN ('emergency','doctor','nurse')),
      trigger_type VARCHAR(50) NOT NULL DEFAULT 'symptom_keyword',
      trigger_terms JSONB NOT NULL DEFAULT '[]'::jsonb,
      signal_text TEXT,
      detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      sla_due_at TIMESTAMP WITH TIME ZONE,
      acknowledged_at TIMESTAMP WITH TIME ZONE,
      acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
      resolved_at TIMESTAMP WITH TIME ZONE,
      resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
      resolution_note TEXT,
      workflow_key VARCHAR(160),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS post_visit_companion_acknowledgements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      acknowledgement_type VARCHAR(60) NOT NULL
        CHECK (acknowledgement_type IN ('teach_back','medication_adherence','follow_up_commitment','warning_sign_understanding')),
      acknowledged BOOLEAN NOT NULL DEFAULT TRUE,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_post_visit_companion_threads_session
      ON post_visit_companion_threads(session_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_post_visit_companion_threads_patient
      ON post_visit_companion_threads(patient_id, last_message_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_post_visit_companion_messages_session
      ON post_visit_companion_messages(session_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_post_visit_companion_messages_thread
      ON post_visit_companion_messages(thread_id, created_at ASC)`,
    `CREATE INDEX IF NOT EXISTS idx_post_visit_companion_messages_patient
      ON post_visit_companion_messages(patient_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_post_visit_companion_messages_escalation
      ON post_visit_companion_messages(escalation_detected, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_post_visit_escalation_events_session
      ON post_visit_escalation_events(session_id, detected_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_post_visit_escalation_events_status
      ON post_visit_escalation_events(status, severity, detected_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_post_visit_escalation_events_route
      ON post_visit_escalation_events(route_target, status, sla_due_at)`,
    `CREATE INDEX IF NOT EXISTS idx_post_visit_escalation_events_patient
      ON post_visit_escalation_events(patient_id, detected_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_post_visit_companion_ack_session
      ON post_visit_companion_acknowledgements(session_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_post_visit_companion_ack_patient
      ON post_visit_companion_acknowledgements(patient_id, acknowledgement_type)`,
    `CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql'`,
    `DROP TRIGGER IF EXISTS update_post_visit_companion_threads_updated_at ON post_visit_companion_threads`,
    `CREATE TRIGGER update_post_visit_companion_threads_updated_at
      BEFORE UPDATE ON post_visit_companion_threads
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()`,
    `DROP TRIGGER IF EXISTS update_post_visit_companion_messages_updated_at ON post_visit_companion_messages`,
    `CREATE TRIGGER update_post_visit_companion_messages_updated_at
      BEFORE UPDATE ON post_visit_companion_messages
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()`,
    `DROP TRIGGER IF EXISTS update_post_visit_escalation_events_updated_at ON post_visit_escalation_events`,
    `CREATE TRIGGER update_post_visit_escalation_events_updated_at
      BEFORE UPDATE ON post_visit_escalation_events
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()`,
    `DROP TRIGGER IF EXISTS update_post_visit_companion_acknowledgements_updated_at ON post_visit_companion_acknowledgements`,
    `CREATE TRIGGER update_post_visit_companion_acknowledgements_updated_at
      BEFORE UPDATE ON post_visit_companion_acknowledgements
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
        'scripts/provision-sprint51-post-visit-patient-companion-escalations.ts',
        'Post-visit patient companion messaging, acknowledgements, and escalation routing',
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
