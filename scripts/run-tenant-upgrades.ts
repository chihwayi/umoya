#!/usr/bin/env ts-node
import 'dotenv/config';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { DatabaseProvisioningService } from '../services/tenant-service/dist/services/database-provisioning.service.js';

type TenantRow = {
  id: string;
  clinic_name: string;
  subdomain: string;
  database_name: string;
  connection_string: string | null;
  status: string;
};

const argv = yargs(hideBin(process.argv))
  .option('bundle', {
    type: 'array',
    describe: 'Specific provisioning bundles to run (defaults to all bundles)',
  })
  .option('tenant', {
    type: 'array',
    describe: 'Limit upgrades to specific subdomains/tenant slugs',
  })
  .option('continueOnError', {
    type: 'boolean',
    default: false,
    describe: 'Continue processing other tenants if one upgrade fails',
  })
  .help()
  .alias('help', 'h').argv as unknown as {
  bundle?: string[];
  tenant?: string[];
  continueOnError: boolean;
};

async function main() {
  const adminDbUrl =
    process.env.TENANT_SERVICE_DATABASE_URL ||
    process.env.ADMIN_DATABASE_URL ||
    process.env.DB_URL ||
    process.env.DATABASE_URL;

  if (!adminDbUrl) {
    throw new Error('Set TENANT_SERVICE_DATABASE_URL or DATABASE_URL to the tenant-service database');
  }

  const adminDataSource = new DataSource({
    type: 'postgres',
    url: adminDbUrl,
  });
  await adminDataSource.initialize();

  const provisioningService = new DatabaseProvisioningService(adminDataSource);
  const manifest = provisioningService.getProvisioningBundlesManifest();
  const availableBundleIds = manifest.map((bundle) => bundle.id);

  const selectedBundles = argv.bundle && argv.bundle.length > 0 ? argv.bundle.map(String) : availableBundleIds;
  const unknownBundles = selectedBundles.filter((bundle) => !availableBundleIds.includes(bundle));
  if (unknownBundles.length > 0) {
    throw new Error(`Unknown bundle(s): ${unknownBundles.join(', ')}. Available: ${availableBundleIds.join(', ')}`);
  }

  const adminClient = new Client({ connectionString: adminDbUrl });
  await adminClient.connect();

  const targetingSpecificTenants = argv.tenant && argv.tenant.length > 0;
  const tenantQuery = targetingSpecificTenants
    ? `
      SELECT id, clinic_name, subdomain, database_name, connection_string, status
      FROM tenants
      WHERE status != 'cancelled'
        AND subdomain = ANY($1)
      ORDER BY clinic_name
    `
    : `
      SELECT id, clinic_name, subdomain, database_name, connection_string, status
      FROM tenants
      WHERE status != 'cancelled'
      ORDER BY clinic_name
    `;

  const queryParams: any[] = targetingSpecificTenants ? [argv.tenant] : [];

  const tenantsResult = await adminClient.query<TenantRow>(tenantQuery, queryParams);
  if (tenantsResult.rows.length === 0) {
    console.log('No tenants matched the provided filters.');
    await adminClient.end();
    await adminDataSource.destroy();
    return;
  }

  console.log(`Running bundles [${selectedBundles.join(', ')}] across ${tenantsResult.rows.length} tenant(s)...`);

  const successes: string[] = [];
  const failures: Array<{ tenant: string; error: string }> = [];

  for (const tenant of tenantsResult.rows) {
    const connectionString = tenant.connection_string || buildTenantConnectionString(tenant.database_name);
    const maskedConnection = connectionString.replace(/:\/\/.*@/, '://***@');
    console.log(`→ Upgrading ${tenant.clinic_name} (${tenant.subdomain}) using ${maskedConnection}`);
    try {
      await provisioningService.applyClinicSchema(connectionString, {
        bundles: selectedBundles,
        appliedBy: 'tenant_upgrade_runner',
      });
      successes.push(tenant.subdomain);
      console.log(`✓ Completed ${tenant.subdomain}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ tenant: tenant.subdomain, error: message });
      console.error(`✗ Failed ${tenant.subdomain}: ${message}`);
      if (!argv.continueOnError) {
        break;
      }
    }
  }

  console.log('Upgrade summary:');
  console.log(`  Successful: ${successes.length}`);
  console.log(`  Failed: ${failures.length}`);
  if (failures.length > 0) {
    failures.forEach((failure) => console.log(`    - ${failure.tenant}: ${failure.error}`));
  }

  await adminClient.end();
  await adminDataSource.destroy();

  if (failures.length > 0 && !argv.continueOnError) {
    process.exit(1);
  }
}

function buildTenantConnectionString(databaseName: string): string {
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const username = process.env.DB_USERNAME || 'medicore';
  const password = process.env.DB_PASSWORD || 'medicore_password';
  return `postgresql://${username}:${password}@${host}:${port}/${databaseName}`;
}

main().catch((error) => {
  console.error('Tenant upgrade runner failed:', error);
  process.exit(1);
});

