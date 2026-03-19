/**
 * Sprint 104 — Telemedicine Real Video Provider (Daily.co)
 *
 * No schema changes — Daily.co integration is purely at the service layer.
 * This script:
 *   1. Adds `recording_download_url` column to telemedicine_consultations (stores the
 *      signed Daily.co recording URL once the post-visit bridge fetches it)
 *   2. Documents required environment variables
 *
 * Required env vars (add to .env and deployment secrets):
 *   DAILY_API_KEY=<your Daily.co API key from dashboard.daily.co/developers>
 *   DAILY_API_URL=https://api.daily.co/v1          (default, override only for testing)
 *   TELEHEALTH_CONSULTATION_FEE=30.00              (already set)
 *   FRONTEND_URL=https://app.yourdomain.com        (already set)
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { createConnection } from 'typeorm';

const BUNDLE_KEY = 'sprint104_telemedicine_video';

async function getSystemDb() {
  return createConnection({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    name: 'system-104',
  });
}

async function getTenantDbs(): Promise<string[]> {
  const conn = await getSystemDb();
  try {
    const rows = await conn.query(
      `SELECT subdomain FROM tenants WHERE status = 'active' ORDER BY subdomain`,
    );
    return rows.map((r: any) => r.subdomain);
  } finally {
    await conn.close();
  }
}

async function getTenantConn(subdomain: string) {
  const dbUrl = process.env[`TENANT_DB_URL_${subdomain.toUpperCase()}`]
    || process.env.DATABASE_URL?.replace('/medicore', `/${subdomain}`);

  return createConnection({
    type: 'postgres',
    url: dbUrl,
    name: `tenant-104-${subdomain}`,
  });
}

async function provisionTenant(subdomain: string): Promise<void> {
  const conn = await getTenantConn(subdomain);
  try {
    // Idempotency check
    const [versionRow] = await conn.query(
      `SELECT 1 FROM tenant_schema_versions WHERE bundle_key = $1`,
      [BUNDLE_KEY],
    ).catch(() => [null]);
    if (versionRow) {
      console.log(`  [${subdomain}] already provisioned — skipping`);
      return;
    }

    await conn.query(`
      ALTER TABLE telemedicine_consultations
        ADD COLUMN IF NOT EXISTS recording_download_url TEXT,
        ADD COLUMN IF NOT EXISTS recording_fetched_at TIMESTAMP WITH TIME ZONE
    `);

    await conn.query(
      `INSERT INTO tenant_schema_versions (bundle_key, applied_at, description)
       VALUES ($1, NOW(), $2)`,
      [BUNDLE_KEY, 'Sprint 104: Daily.co recording URL columns on telemedicine_consultations'],
    ).catch(() => {
      // tenant_schema_versions may not exist on older tenants — not a blocker
    });

    console.log(`  [${subdomain}] OK`);
  } finally {
    await conn.close();
  }
}

async function main() {
  console.log('Sprint 104 — Telemedicine Real Video Provider (Daily.co)');
  console.log('='.repeat(60));

  const subdomains = await getTenantDbs().catch(() => {
    console.warn('Could not read tenant list from system DB — running in single-tenant mode');
    return ['default'];
  });

  for (const subdomain of subdomains) {
    await provisionTenant(subdomain).catch(e =>
      console.error(`  [${subdomain}] ERROR: ${e?.message}`),
    );
  }

  console.log('\nProvisioning complete.');
  console.log('\nRequired environment variables for Daily.co integration:');
  console.log('  DAILY_API_KEY    — obtain from https://dashboard.daily.co/developers');
  console.log('  DAILY_API_URL    — defaults to https://api.daily.co/v1 (optional override)');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
