/**
 * Sprint 106 — Telemedicine: Notifications, State Machine, Full Update Fix
 *
 * Schema changes:
 *   - telemedicine_consultations: ADD COLUMN reminder_sent_at TIMESTAMPTZ
 *   - telemedicine_consultations: ADD COLUMN updated_by UUID REFERENCES users(id)
 *     (if not already present — some tenants may have it from earlier migrations)
 *
 * No new tables required.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { createConnection } from 'typeorm';

const BUNDLE_KEY = 'sprint106_telemedicine_fixes';

async function getTenantDbs(): Promise<string[]> {
  const conn = await createConnection({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    name: 'system-106',
  });
  try {
    const rows = await conn.query(
      `SELECT subdomain FROM tenants WHERE status = 'active' ORDER BY subdomain`,
    );
    return rows.map((r: any) => r.subdomain);
  } finally {
    await conn.close();
  }
}

async function provisionTenant(subdomain: string): Promise<void> {
  const dbUrl =
    process.env[`TENANT_DB_URL_${subdomain.toUpperCase()}`] ||
    process.env.DATABASE_URL?.replace('/medicore', `/${subdomain}`);

  const conn = await createConnection({
    type: 'postgres',
    url: dbUrl,
    name: `tenant-106-${subdomain}`,
  });

  try {
    const [already] = await conn
      .query(`SELECT 1 FROM tenant_schema_versions WHERE bundle_key = $1`, [BUNDLE_KEY])
      .catch(() => [null]);

    if (already) {
      console.log(`  [${subdomain}] already provisioned — skipping`);
      return;
    }

    // reminder_sent_at — set when the 15-min reminder SMS is dispatched
    await conn.query(`
      ALTER TABLE telemedicine_consultations
        ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL
    `);

    // Index to speed up the cron query (status + scheduled_start_time + reminder_sent_at IS NULL)
    await conn.query(`
      CREATE INDEX IF NOT EXISTS idx_tele_upcoming_reminder
        ON telemedicine_consultations (scheduled_start_time)
        WHERE status = 'scheduled' AND reminder_sent_at IS NULL
    `);

    await conn
      .query(
        `INSERT INTO tenant_schema_versions (bundle_key, applied_at, description)
         VALUES ($1, NOW(), $2)`,
        [
          BUNDLE_KEY,
          'Sprint 106: reminder_sent_at + updated_by on telemedicine_consultations; reminder index',
        ],
      )
      .catch(() => {});

    console.log(`  [${subdomain}] OK`);
  } finally {
    await conn.close();
  }
}

async function main() {
  console.log('Sprint 106 — Telemedicine Notifications + State Machine + Full Update Fix');
  console.log('='.repeat(72));

  const subdomains = await getTenantDbs().catch(() => {
    console.warn('Could not read tenant list — single-tenant mode');
    return ['default'];
  });

  for (const subdomain of subdomains) {
    await provisionTenant(subdomain).catch(e =>
      console.error(`  [${subdomain}] ERROR: ${e?.message}`),
    );
  }

  console.log('\nProvisioning complete.');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
