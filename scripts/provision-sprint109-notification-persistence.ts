import { Client } from 'pg';

/**
 * Sprint 109 — Persistent Notification System
 *
 * Changes:
 *  1. nurse_tasks   — add viewed_at / viewed_by columns so the frontend can
 *                     track which tasks a nurse has already opened and stop
 *                     re-showing them as "new" after every login/logout.
 *  2. staff_notifications — new table giving nurses, doctors, and admins a
 *                     proper persistent in-app notification inbox (equivalent
 *                     of patient_notifications but for staff).
 */

const BUNDLE_ID      = 'sprint109_notification_persistence';
const BUNDLE_VERSION = '2026.03.21';

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
    // ── 1. Nurse task viewed tracking ────────────────────────────────────────
    // Adds columns to the existing nurse_tasks table so that once a nurse opens
    // a task notification the timestamp is persisted and the UI stops treating
    // the task as "unseen" across sessions.
    `ALTER TABLE nurse_tasks
       ADD COLUMN IF NOT EXISTS viewed_at   TIMESTAMPTZ,
       ADD COLUMN IF NOT EXISTS viewed_by   UUID REFERENCES users(id) ON DELETE SET NULL`,

    `CREATE INDEX IF NOT EXISTS idx_nurse_tasks_unseen
       ON nurse_tasks(assigned_to, viewed_at)
       WHERE status IN ('pending', 'in_progress') AND viewed_at IS NULL`,

    // ── 2. Staff notifications inbox ─────────────────────────────────────────
    // Persistent in-app notification store for staff (nurses, doctors, admins).
    // Each row represents one notification for one recipient; read/readAt track
    // whether the user has dismissed it.
    `CREATE TABLE IF NOT EXISTS staff_notifications (
      id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id         VARCHAR(120) NOT NULL,
      recipient_id      UUID         NOT NULL,
      recipient_role    VARCHAR(50),
      notification_type VARCHAR(60)  NOT NULL,
      title             VARCHAR(255) NOT NULL,
      message           TEXT         NOT NULL,
      action_url        VARCHAR(500),
      action_label      VARCHAR(100),
      priority          VARCHAR(20)  NOT NULL DEFAULT 'normal',
      read              BOOLEAN      NOT NULL DEFAULT FALSE,
      read_at           TIMESTAMPTZ,
      source_entity_id  UUID,
      metadata          JSONB,
      expires_at        TIMESTAMPTZ,
      created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )`,

    // Primary lookup: all notifications for a user (notification bell)
    `CREATE INDEX IF NOT EXISTS idx_staff_notif_recipient
       ON staff_notifications(tenant_id, recipient_id, created_at DESC)`,

    // Unread badge count
    `CREATE INDEX IF NOT EXISTS idx_staff_notif_unread
       ON staff_notifications(tenant_id, recipient_id, read)
       WHERE read = FALSE`,

    // Deduplication check by source entity
    `CREATE INDEX IF NOT EXISTS idx_staff_notif_source
       ON staff_notifications(tenant_id, recipient_id, source_entity_id, notification_type)
       WHERE source_entity_id IS NOT NULL AND read = FALSE`,

    // Expiry cleanup
    `CREATE INDEX IF NOT EXISTS idx_staff_notif_expires
       ON staff_notifications(expires_at)
       WHERE expires_at IS NOT NULL`,
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
        'scripts/provision-sprint109-notification-persistence.ts',
        'Sprint 109 — nurse_tasks viewed_at/viewed_by + staff_notifications inbox table',
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
