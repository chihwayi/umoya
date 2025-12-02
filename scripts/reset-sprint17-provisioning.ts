#!/usr/bin/env node
/**
 * Reset Sprint 17 Provisioning
 * Removes the sprint17_care_plans version record and re-applies the bundle
 */

import 'dotenv/config';
import { Client } from 'pg';
import { DataSource } from 'typeorm';

const TENANT_SLUG = 'bulawayo-general';

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
    console.log('\n🔄 Resetting Sprint 17 Care Plans Provisioning\n');

    // Get tenant
    const tenantsResult = await masterClient.query(`
      SELECT id, "clinicName" as clinic_name, subdomain, "databaseName" as database_name, "connectionString" as connection_string
      FROM tenants
      WHERE subdomain = $1
    `, [TENANT_SLUG]);

    if (tenantsResult.rows.length === 0) {
      console.error(`❌ Tenant ${TENANT_SLUG} not found`);
      return;
    }

    const tenant = tenantsResult.rows[0];
    console.log(`Found tenant: ${tenant.clinic_name}\n`);

    // Build connection string
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

    // Connect to tenant database
    const tenantDataSource = new DataSource({
      type: 'postgres',
      url: connectionString,
    });

    await tenantDataSource.initialize();
    console.log('✅ Connected to tenant database\n');

    // Check if version record exists
    const versionCheck = await tenantDataSource.query(`
      SELECT * FROM tenant_schema_versions WHERE bundle_id = 'sprint17_care_plans'
    `);

    if (versionCheck.length > 0) {
      console.log(`Found version record: ${versionCheck[0].bundle_id} v${versionCheck[0].version}`);
      console.log(`Applied at: ${versionCheck[0].applied_at}`);
      console.log(`Applied by: ${versionCheck[0].applied_by}\n`);

      // Delete the version record
      console.log('Deleting version record...');
      await tenantDataSource.query(`
        DELETE FROM tenant_schema_versions WHERE bundle_id = 'sprint17_care_plans'
      `);
      console.log('✅ Version record deleted\n');
    } else {
      console.log('ℹ️  No version record found for sprint17_care_plans\n');
    }

    await tenantDataSource.destroy();
    await masterClient.end();

    console.log('Now re-running provisioning...\n');

    // Import and run the provisioning
    const provisioningModule = await import('../services/tenant-service/dist/services/database-provisioning.service.js');
    const { DatabaseProvisioningService } = provisioningModule;
    
    const adminDataSource = new DataSource({
      type: 'postgres',
      url: masterDbUrl,
    });
    await adminDataSource.initialize();
    const provisioningService = new DatabaseProvisioningService(adminDataSource);

    console.log('Applying sprint17_care_plans bundle...\n');

    await provisioningService.applyClinicSchema(connectionString, {
      bundles: ['sprint17_care_plans'],
      appliedBy: 'reset_sprint17_script',
    });

    console.log('\n✅ Sprint 17 Care Plans provisioning completed!\n');

    await adminDataSource.destroy();

  } catch (error) {
    console.error('❌ Script failed:', error);
    throw error;
  }
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});

