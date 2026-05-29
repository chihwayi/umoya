import { Client } from 'pg';

/**
 * Pre-repair migration: ensure tenant_schema_versions table has all columns
 * used by sprint scripts S61+.
 *
 * Older provisioning scripts created the table with:
 *   bundle_id, version, applied_at, applied_by, notes
 *
 * Newer scripts (S61+) expect:
 *   bundle_id, bundle_version, script_path, description, applied_at
 *
 * This script adds the missing columns to all tenant DBs idempotently,
 * and backfills bundle_version from version where null.
 */

function buildConnection(database: string) {
  return {
    host:     process.env.DB_HOST             || process.env.SERVICE_POSTGRES_HOST || 'localhost',
    port:     Number(process.env.DB_PORT      || process.env.POSTGRES_PORT         || '5432'),
    user:     process.env.DB_USERNAME         || process.env.POSTGRES_USER          || 'postgres',
    password: process.env.DB_PASSWORD         || process.env.POSTGRES_PASSWORD      || 'postgres',
    database,
  };
}

// Bundles where we know the key table that proves the bundle actually ran.
// If the table is missing despite the version record existing, the record
// is stale and must be removed so the bundle re-runs on next repair.
const BUNDLE_TABLE_PROOFS: Record<string, string> = {
  sprint62_proactive_care_gaps:         'nurse_tasks',
  sprint63_ambient_ai:                  'ambient_sessions',
  sprint64_pre_charting:                'pre_chart_summaries',
  sprint65_smart_inbox:                 'inbox_items',
  sprint109_notification_persistence:   'staff_notifications',
};

async function migrateVersionsTable(databaseName: string): Promise<void> {
  const client = new Client(buildConnection(databaseName));
  await client.connect();

  try {
    await client.query(`
      ALTER TABLE tenant_schema_versions
        ADD COLUMN IF NOT EXISTS bundle_version TEXT,
        ADD COLUMN IF NOT EXISTS script_path    TEXT,
        ADD COLUMN IF NOT EXISTS description    TEXT
    `);

    // The original table had version NOT NULL; newer scripts insert bundle_version
    // but not version. Make version nullable so both old and new scripts work.
    await client.query(`
      ALTER TABLE tenant_schema_versions
        ALTER COLUMN version DROP NOT NULL
    `);

    // Backfill bundle_version from version where null
    await client.query(`
      UPDATE tenant_schema_versions
         SET bundle_version = version
       WHERE bundle_version IS NULL AND version IS NOT NULL
    `);

    // Clear stale version records where the expected table doesn't exist
    for (const [bundleId, tableName] of Object.entries(BUNDLE_TABLE_PROOFS)) {
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = $1
        )
      `, [tableName]);

      if (!tableCheck.rows[0].exists) {
        const deleted = await client.query(
          `DELETE FROM tenant_schema_versions WHERE bundle_id = $1 RETURNING bundle_id`,
          [bundleId]
        );
        if (deleted.rowCount && deleted.rowCount > 0) {
          console.log(`  ⚠  ${databaseName}: cleared stale version record for ${bundleId} (table ${tableName} missing — will re-apply)`);
        }
      }
    }

    console.log(`  ✓ ${databaseName}: tenant_schema_versions ready`);
  } finally {
    await client.end();
  }
}

async function ensureMasterCompatColumns(master: Client): Promise<void> {
  // Scripts S68-S88 were generated with incorrect column name assumptions.
  // Add compatibility alias columns directly to the tenants table so those
  // scripts can find what they expect without any query modifications.
  //   connection_string  →  mirrors "connectionString"
  //   db_url             →  mirrors "connectionString"
  //   is_active          →  mirrors (status = 'active')
  await master.query(`
    ALTER TABLE tenants
      ADD COLUMN IF NOT EXISTS connection_string TEXT,
      ADD COLUMN IF NOT EXISTS db_url            TEXT,
      ADD COLUMN IF NOT EXISTS is_active         BOOLEAN
  `);

  // Populate / keep in sync
  await master.query(`
    UPDATE tenants
       SET connection_string = "connectionString",
           db_url            = "connectionString",
           is_active         = (status = 'active')
     WHERE connection_string IS DISTINCT FROM "connectionString"
        OR db_url            IS DISTINCT FROM "connectionString"
        OR is_active         IS DISTINCT FROM (status = 'active')
  `);

  console.log('  ✓ master DB: tenants compat columns (connection_string, db_url, is_active) ensured');
}

async function main(): Promise<void> {
  const master = new Client(buildConnection(
    process.env.POSTGRES_DB || process.env.MASTER_POSTGRES_DB || 'umoya'
  ));
  await master.connect();

  try {
    await ensureMasterCompatColumns(master);

    const result = await master.query(`
      SELECT "databaseName" AS db
        FROM tenants
       WHERE status IN ('active', 'pending', 'suspended')
       ORDER BY subdomain
    `);

    if (!result.rowCount) {
      console.log('No tenants found.');
      return;
    }

    console.log(`Migrating tenant_schema_versions for ${result.rowCount} tenant(s)...`);
    for (const row of result.rows) {
      await migrateVersionsTable(String(row.db));
    }
    console.log('Done.\n');
  } finally {
    await master.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.message || err);
  process.exit(1);
});
