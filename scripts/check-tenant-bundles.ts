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

    console.log(`Checking bundle versions across ${tenantsResult.rows.length} tenant(s)...\n`);

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
        const result = await tenantClient.query(`
          SELECT bundle_id, version, applied_at, applied_by
          FROM tenant_schema_versions
          ORDER BY bundle_id
        `);
        
        console.log(`${tenant.clinic_name} (${tenant.subdomain}):`);
        if (result.rows.length === 0) {
          console.log('  ⚠️  No bundles recorded');
        } else {
          result.rows.forEach((row: any) => {
            console.log(`  ✓ ${row.bundle_id}: v${row.version} (applied ${new Date(row.applied_at).toLocaleDateString()})`);
          });
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

