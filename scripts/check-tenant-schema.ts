#!/usr/bin/env node
import 'dotenv/config';
import { Client } from 'pg';

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

    console.log(`Checking schema completeness across ${tenantsResult.rows.length} tenant(s)...\n`);

    // Key tables to check for each bundle
    const bundleChecks = {
      core: ['users', 'patients', 'appointments', 'vitals', 'lab_test_catalog'],
      snomed: ['snomed_concept_cache', 'snomed_search_cache'],
      hiv_testing: ['hiv_enrollments', 'hiv_visits', 'hiv_art_regimens'],
      icd10_mapping: ['snomed_icd10_mappings', 'icd10_mapping_metadata'],
    };

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

      const tenantClient = new Client({ connectionString });
      try {
        await tenantClient.connect();
        
        console.log(`${tenant.clinic_name} (${tenant.subdomain}):`);
        
        for (const [bundle, tables] of Object.entries(bundleChecks)) {
          const missing: string[] = [];
          for (const table of tables) {
            const result = await tenantClient.query(`
              SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = $1
              ) as exists
            `, [table]);
            if (!result.rows[0]?.exists) {
              missing.push(table);
            }
          }
          if (missing.length === 0) {
            console.log(`  ✓ ${bundle}: All tables present`);
          } else {
            console.log(`  ⚠️  ${bundle}: Missing tables: ${missing.join(', ')}`);
          }
        }
        
        // Check version tracking
        const versionResult = await tenantClient.query(`
          SELECT bundle_id, version FROM tenant_schema_versions ORDER BY bundle_id
        `);
        if (versionResult.rows.length > 0) {
          console.log(`  📋 Recorded bundles: ${versionResult.rows.map((r: any) => r.bundle_id).join(', ')}`);
        }
        
        console.log('');
        await tenantClient.end();
      } catch (error: any) {
        console.error(`  ❌ Error: ${error.message}\n`);
        try {
          await tenantClient.end();
        } catch {}
      }
    }
  } finally {
    await masterClient.end();
  }
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});

