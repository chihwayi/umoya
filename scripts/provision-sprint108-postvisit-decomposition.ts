/**
 * Sprint 108 — PostVisit Service Decomposition
 *
 * This sprint is a pure code refactor — no schema changes.
 * Records a bundle marker so the provisioning log is complete.
 *
 * Sub-services extracted from PostVisitService (god class):
 *   - PostVisitEscalationService   (listEscalations, resolveEscalation, intra-visit alerts)
 *   - PostVisitBillingIntelligenceService (getSessionBillingIntelligence, reviewBillingSuggestion,
 *                                          refreshSessionBillingIntelligence)
 *   - PostVisitCompanionMemoryService    (listSessionCompanionMemory, curateCompanionMemory)
 *
 * Schema note: post_visit_sessions table and all related tables were provisioned
 * in sprints 48–58. No new columns or indexes are added here.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { createConnection } from 'typeorm';

const BUNDLE_KEY = 'sprint108_postvisit_decomposition';

async function getTenantDbs(): Promise<string[]> {
  const conn = await createConnection({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    name: 'system-108',
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
    name: `tenant-108-${subdomain}`,
  });

  try {
    const [already] = await conn
      .query(`SELECT 1 FROM tenant_schema_versions WHERE bundle_key = $1`, [BUNDLE_KEY])
      .catch(() => [null]);

    if (already) {
      console.log(`  [${subdomain}] already provisioned — skipping`);
      return;
    }

    await conn
      .query(
        `INSERT INTO tenant_schema_versions (bundle_key, applied_at, description)
         VALUES ($1, NOW(), $2)`,
        [
          BUNDLE_KEY,
          'Sprint 108: PostVisit god class decomposition (EscalationService, BillingIntelligenceService, CompanionMemoryService extracted)',
        ],
      )
      .catch(() => {});

    console.log(`  [${subdomain}] OK`);
  } finally {
    await conn.close();
  }
}

async function main() {
  console.log('Sprint 108 — PostVisit Service Decomposition');
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
