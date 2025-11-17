#!/usr/bin/env node
import 'dotenv/config';
import { Client } from 'pg';
import { DataSource } from 'typeorm';

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

    console.log(`Found ${tenantsResult.rows.length} tenant(s). Applying all provisioning bundles...\n`);

    // Import the provisioning service using dynamic import
    const provisioningModule = await import('../services/tenant-service/src/services/database-provisioning.service');
    const { DatabaseProvisioningService } = provisioningModule;
    
    const adminDataSource = new DataSource({
      type: 'postgres',
      url: masterDbUrl,
    });
    await adminDataSource.initialize();
    const provisioningService = new DatabaseProvisioningService(adminDataSource);

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

      console.log(`→ Provisioning ${tenant.clinic_name} (${tenant.subdomain})...`);

      try {
        // Apply all bundles (no filter = all bundles)
        await provisioningService.applyClinicSchema(connectionString, {
          appliedBy: 'full_provisioning_script',
        });
        console.log(`  ✅ Completed ${tenant.subdomain}\n`);
      } catch (error: any) {
        console.error(`  ❌ Failed ${tenant.subdomain}: ${error.message}\n`);
      }
    }

    await adminDataSource.destroy();
    console.log('✅ Full provisioning completed for all tenants.');
  } finally {
    await masterClient.end();
  }
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});

