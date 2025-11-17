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
    // Get all active tenants
    const tenantsResult = await masterClient.query(`
      SELECT id, "clinicName" as clinic_name, subdomain, "databaseName" as database_name, "connectionString" as connection_string, status
      FROM tenants
      WHERE status != 'cancelled'
      ORDER BY "clinicName"
    `);

    if (tenantsResult.rows.length === 0) {
      console.log('No active tenants found.');
      return;
    }

    console.log(`Found ${tenantsResult.rows.length} tenant(s). Fixing map_status column...\n`);

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

      console.log(`→ Fixing ${tenant.clinic_name} (${tenant.subdomain})...`);

      const tenantClient = new Client({ connectionString });
      try {
        await tenantClient.connect();
        await tenantClient.query(`
          ALTER TABLE snomed_icd10_mappings 
          ALTER COLUMN map_status TYPE VARCHAR(100);
        `);
        console.log(`  ✅ Completed ${tenant.subdomain}\n`);
        await tenantClient.end();
      } catch (error: any) {
        if (error.message.includes('does not exist')) {
          console.log(`  ⚠️  Table doesn't exist yet, skipping\n`);
        } else {
          console.error(`  ❌ Failed ${tenant.subdomain}: ${error.message}\n`);
        }
        try {
          await tenantClient.end();
        } catch {}
      }
    }

    console.log('✅ Column fix completed for all tenants.');
  } finally {
    await masterClient.end();
  }
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});

