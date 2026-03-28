import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Resolve root relative to CWD (works with both ts-node CJS and ESM)
const PROJECT_ROOT = process.cwd();

/**
 * Sprint 110 — Terminology Master DB Migration
 *
 * Applies to the MASTER database (not per-tenant):
 *  1. Rebuild snomed_search_view to include description_id column,
 *     enabling REFRESH MATERIALIZED VIEW CONCURRENTLY (non-blocking reads).
 *  2. Create icd11_codes + snomed_to_icd11_map tables + indexes + search function
 *     for WHO ICD-11 MMS linearization support.
 */

const MASTER_DB_NAME = process.env.MASTER_POSTGRES_DB || process.env.POSTGRES_DB || 'medicore';

function buildMasterConnection() {
  return {
    host:     process.env.DB_HOST             || process.env.SERVICE_POSTGRES_HOST || 'localhost',
    port:     Number(process.env.DB_PORT      || process.env.POSTGRES_PORT         || '5432'),
    user:     process.env.DB_USERNAME         || process.env.POSTGRES_USER          || 'postgres',
    password: process.env.DB_PASSWORD         || process.env.POSTGRES_PASSWORD      || 'postgres',
    database: MASTER_DB_NAME,
  };
}

async function applySnomedViewMigration(client: Client): Promise<void> {
  console.log('  → Checking snomed_search_view for CONCURRENTLY support...');

  // Check if the view already has description_id (idempotent guard)
  const check = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'snomed_search_view'
      AND column_name = 'description_id'
  `);

  if (check.rowCount && check.rowCount > 0) {
    console.log('  ✓ snomed_search_view already has description_id — skipping view rebuild');
    return;
  }

  console.log('  → Rebuilding snomed_search_view with description_id...');

  // Must DROP and re-CREATE — materialized views cannot be ALTERed
  await client.query('DROP MATERIALIZED VIEW IF EXISTS snomed_search_view');

  await client.query(`
    CREATE MATERIALIZED VIEW snomed_search_view AS
    SELECT
        d.description_id,
        c.concept_id,
        d.term,
        d.type_id      AS term_type,
        c.active,
        to_tsvector('english', d.term) AS search_vector
    FROM snomed_concepts c
    JOIN snomed_descriptions d ON c.concept_id = d.concept_id
    WHERE c.active = true AND d.active = true
  `);

  await client.query(`
    CREATE UNIQUE INDEX idx_snomed_search_description_id
      ON snomed_search_view(description_id)
  `);
  await client.query(`
    CREATE INDEX idx_snomed_search_vector
      ON snomed_search_view USING gin(search_vector)
  `);
  await client.query(`
    CREATE INDEX idx_snomed_search_concept_id
      ON snomed_search_view(concept_id)
  `);

  console.log('  ✓ snomed_search_view rebuilt with CONCURRENTLY support');
}

async function applyIcd11Schema(client: Client): Promise<void> {
  console.log('  → Applying ICD-11 schema...');

  let sqlPath = path.resolve(PROJECT_ROOT, 'database/schemas/icd11-terminology.sql');
  if (!fs.existsSync(sqlPath)) {
    sqlPath = '/app/database/schemas/icd11-terminology.sql';
  }

  if (!fs.existsSync(sqlPath)) {
    console.error(`  ✗ Could not find icd11-terminology.sql at ${sqlPath}`);
    return;
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  await client.query(sql);
  console.log('  ✓ ICD-11 schema applied');
}

async function main(): Promise<void> {
  const client = new Client(buildMasterConnection());
  await client.connect();

  console.log(`\nSprint 110 — Terminology master DB migration (${MASTER_DB_NAME})\n`);

  try {
    // Check if snomed_concepts exists; if not, SNOMED hasn't been imported yet
    // and there's nothing to migrate for the view — but we still create ICD-11 tables
    const snomedExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'snomed_concepts'
      )
    `);

    if (snomedExists.rows[0].exists) {
      await applySnomedViewMigration(client);
    } else {
      console.log('  ⚠  snomed_concepts table not found — skipping view rebuild (run after first SNOMED import)');
    }

    await applyIcd11Schema(client);

    console.log('\n✅  Sprint 110 master DB migration complete\n');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.message || err);
  process.exit(1);
});
