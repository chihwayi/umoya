#!/usr/bin/env node
import 'dotenv/config';
import { Client } from 'pg';

// Simple script to apply missing bundles based on what's actually missing
async function main() {
  const masterDbUrl =
    process.env.TENANT_SERVICE_DATABASE_URL ||
    process.env.ADMIN_DATABASE_URL ||
    process.env.DB_URL ||
    process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USERNAME || 'medicore'}:${process.env.DB_PASSWORD || 'medicore_password'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/medicore_master`;

  const masterClient = new Client({ connectionString: masterDbUrl });
  await masterClient.connect();

  try {
    const tenantsResult = await masterClient.query(`
      SELECT id, "clinicName" as clinic_name, subdomain, "databaseName" as database_name, "connectionString" as connection_string
      FROM tenants
      WHERE status != 'cancelled'
      ORDER BY "clinicName"
    `);

    if (tenantsResult.rows.length === 0) {
      console.log('No active tenants found.');
      return;
    }

    console.log(`Applying missing bundles to ${tenantsResult.rows.length} tenant(s)...\n`);

    for (const tenant of tenantsResult.rows) {
      let connectionString = tenant.connection_string;
      if (!connectionString) {
        const host = process.env.DB_HOST || 'localhost';
        const port = process.env.DB_PORT || '5432';
        const username = process.env.DB_USERNAME || 'medicore';
        const password = process.env.DB_PASSWORD || 'medicore_password';
        connectionString = `postgresql://${username}:${password}@${host}:${port}/${tenant.database_name}`;
      } else {
        connectionString = connectionString.replace(/postgres-master/g, 'localhost');
        connectionString = connectionString.replace(/postgresql:\/\/[^:]+:[^@]+@[^:]+:(\d+)\//, (_match: string, port: string) => {
          const host = process.env.DB_HOST || 'localhost';
          const username = process.env.DB_USERNAME || 'medicore';
          const password = process.env.DB_PASSWORD || 'medicore_password';
          return `postgresql://${username}:${password}@${host}:${port}/`;
        });
      }

      console.log(`→ Checking ${tenant.clinic_name} (${tenant.subdomain})...`);

      const tenantClient = new Client({ connectionString });
      try {
        await tenantClient.connect();

        // Check and apply SNOMED cache tables if missing
        const snomedCheck = await tenantClient.query(`
          SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'snomed_concept_cache') as exists
        `);
        if (!snomedCheck.rows[0]?.exists) {
          console.log(`  → Applying SNOMED cache tables...`);
          await tenantClient.query(`
            CREATE TABLE IF NOT EXISTS snomed_concept_cache (
              concept_id VARCHAR(50) PRIMARY KEY,
              concept_data JSONB NOT NULL,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
          `);
          await tenantClient.query(`
            CREATE TABLE IF NOT EXISTS snomed_search_cache (
              search_term TEXT NOT NULL,
              result_limit INTEGER NOT NULL,
              result_offset INTEGER NOT NULL,
              data JSONB NOT NULL,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              PRIMARY KEY (search_term, result_limit, result_offset)
            )
          `);
          await tenantClient.query(`
            INSERT INTO tenant_schema_versions (bundle_id, version, applied_at, applied_by)
            VALUES ('snomed', '2025.03.01', NOW(), 'apply-missing-bundles-script')
            ON CONFLICT (bundle_id) DO UPDATE
            SET version = EXCLUDED.version, applied_at = NOW(), applied_by = EXCLUDED.applied_by
          `);
          console.log(`  ✓ SNOMED cache tables created`);
        }

        // Check and apply lab_test_catalog if missing
        const labCheck = await tenantClient.query(`
          SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'lab_test_catalog') as exists
        `);
        if (!labCheck.rows[0]?.exists) {
          console.log(`  → Lab catalog missing - this requires full core bundle. Skipping for now.`);
        }

        // Check and apply HIV tables if missing
        const hivCheck = await tenantClient.query(`
          SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'hiv_enrollments') as exists
        `);
        if (!hivCheck.rows[0]?.exists) {
          console.log(`  → HIV tables missing - this requires full HIV bundle. Skipping for now.`);
        }

        // Record core bundle if not recorded (tables exist but version not tracked)
        const coreVersionCheck = await tenantClient.query(`
          SELECT bundle_id FROM tenant_schema_versions WHERE bundle_id = 'core'
        `);
        if (coreVersionCheck.rows.length === 0) {
          // Check if core tables exist
          const usersCheck = await tenantClient.query(`
            SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') as exists
          `);
          if (usersCheck.rows[0]?.exists) {
            await tenantClient.query(`
              INSERT INTO tenant_schema_versions (bundle_id, version, applied_at, applied_by)
              VALUES ('core', '2025.03.01', NOW(), 'apply-missing-bundles-script')
              ON CONFLICT (bundle_id) DO UPDATE
              SET version = EXCLUDED.version, applied_at = NOW(), applied_by = EXCLUDED.applied_by
            `);
            console.log(`  ✓ Core bundle version recorded`);
          }
        }

        console.log(`  ✅ Completed ${tenant.subdomain}\n`);
        await tenantClient.end();
      } catch (error: any) {
        console.error(`  ❌ Failed ${tenant.subdomain}: ${error.message}\n`);
        try {
          await tenantClient.end();
        } catch {}
      }
    }

    console.log('✅ Missing bundles check completed.');
  } finally {
    await masterClient.end();
  }
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});

