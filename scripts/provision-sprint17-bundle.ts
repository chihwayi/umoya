#!/usr/bin/env node
/**
 * Provision Sprint 17 Care Plans Bundle
 * Applies the sprint17_care_plans bundle to bulawayo-general tenant
 */

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
    console.log('\n🚀 Provisioning Sprint 17 Care Plans Bundle\n');

    // Get bulawayo-general tenant
    const tenantsResult = await masterClient.query(`
      SELECT id, "clinicName" as clinic_name, subdomain, "databaseName" as database_name, "connectionString" as connection_string
      FROM tenants
      WHERE subdomain = 'bulawayo-general'
    `);

    if (tenantsResult.rows.length === 0) {
      console.error('❌ Tenant bulawayo-general not found');
      return;
    }

    const tenant = tenantsResult.rows[0];
    console.log(`Found tenant: ${tenant.clinic_name} (${tenant.subdomain})\n`);

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

    console.log('Initializing provisioning service...\n');

    // Import the provisioning service
    const provisioningModule = await import('../services/tenant-service/dist/services/database-provisioning.service.js');
    const { DatabaseProvisioningService } = provisioningModule;
    
    const adminDataSource = new DataSource({
      type: 'postgres',
      url: masterDbUrl,
    });
    await adminDataSource.initialize();
    const provisioningService = new DatabaseProvisioningService(adminDataSource);

    console.log('Applying sprint17_care_plans bundle...\n');

    try {
      // Apply only the sprint17_care_plans bundle
      await provisioningService.applyClinicSchema(connectionString, {
        bundles: ['sprint17_care_plans'],
        appliedBy: 'sprint17_provisioning_script',
      });
      console.log('\n✅ Sprint 17 Care Plans bundle applied successfully!\n');
    } catch (error: any) {
      console.error(`\n❌ Failed to apply bundle: ${error.message}\n`);
      throw error;
    }

    await adminDataSource.destroy();
  } finally {
    await masterClient.end();
  }
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});

