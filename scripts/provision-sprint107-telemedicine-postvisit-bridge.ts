/**
 * Sprint 107 — Telemedicine ↔ PostVisit Bridge
 *
 * Schema changes:
 *   - post_visit_sessions: ADD COLUMN recording_sha256 TEXT  (integrity hash)
 *   - post_visit_sessions: ADD COLUMN recording_storage_key TEXT already exists
 *     in sprint58 — only recording_sha256 is new here
 *   - Index: post_visit_sessions(consultation_id) for fast bridge upsert lookup
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { createConnection } from 'typeorm';

const BUNDLE_KEY = 'sprint107_telemedicine_postvisit_bridge';

async function getTenantDbs(): Promise<string[]> {
  const conn = await createConnection({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    name: 'system-107',
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
    name: `tenant-107-${subdomain}`,
  });

  try {
    const [already] = await conn
      .query(`SELECT 1 FROM tenant_schema_versions WHERE bundle_key = $1`, [BUNDLE_KEY])
      .catch(() => [null]);

    if (already) {
      console.log(`  [${subdomain}] already provisioned — skipping`);
      return;
    }

    // SHA-256 integrity hash stored alongside the MinIO key
    await conn.query(`
      ALTER TABLE post_visit_sessions
        ADD COLUMN IF NOT EXISTS recording_sha256 TEXT
    `).catch(() => {
      // Table may not exist on tenants that haven't run post-visit migrations yet
      console.warn(`  [${subdomain}] post_visit_sessions not found — skipping column add`);
    });

    // Index for bridge upsert: "does a session already exist for this consultation?"
    await conn.query(`
      CREATE INDEX IF NOT EXISTS idx_pvs_consultation_id
        ON post_visit_sessions (consultation_id)
        WHERE consultation_id IS NOT NULL
    `).catch(() => {});

    await conn
      .query(
        `INSERT INTO tenant_schema_versions (bundle_key, applied_at, description)
         VALUES ($1, NOW(), $2)`,
        [
          BUNDLE_KEY,
          'Sprint 107: recording_sha256 on post_visit_sessions; consultation_id index for bridge',
        ],
      )
      .catch(() => {});

    console.log(`  [${subdomain}] OK`);
  } finally {
    await conn.close();
  }
}

async function main() {
  console.log('Sprint 107 — Telemedicine ↔ PostVisit Bridge');
  console.log('='.repeat(60));

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
