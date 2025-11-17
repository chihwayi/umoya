#!/usr/bin/env node
import 'dotenv/config';
import { Client } from 'pg';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';

const execFileAsync = promisify(execFile);

/**
 * Import ICD-10 mappings for a specific tenant
 * Usage: npx ts-node scripts/import-icd10-for-new-tenant.ts <tenant-subdomain>
 */
async function main() {
  const subdomain = process.argv[2];

  if (!subdomain) {
    console.error('Usage: npx ts-node scripts/import-icd10-for-new-tenant.ts <tenant-subdomain>');
    process.exit(1);
  }

  const masterDbUrl =
    process.env.TENANT_SERVICE_DATABASE_URL ||
    process.env.ADMIN_DATABASE_URL ||
    process.env.DB_URL ||
    process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USERNAME || 'medicore'}:${process.env.DB_PASSWORD || 'medicore_password'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/medicore_master`;

  const zipPath = path.resolve(
    process.cwd(),
    'snowstorm',
    'import',
    'SNOMED_CT_to_ICD-10-CM_Resources_20250901.zip',
  );

  if (!fs.existsSync(zipPath)) {
    throw new Error(`ZIP file not found at ${zipPath}`);
  }

  const masterClient = new Client({ connectionString: masterDbUrl });
  await masterClient.connect();

  try {
    // Find tenant by subdomain
    const tenantResult = await masterClient.query(
      `SELECT id, "clinicName" as clinic_name, subdomain, "databaseName" as database_name, "connectionString" as connection_string, status
       FROM tenants
       WHERE subdomain = $1`,
      [subdomain]
    );

    if (tenantResult.rows.length === 0) {
      console.error(`Tenant with subdomain '${subdomain}' not found.`);
      process.exit(1);
    }

    const tenant = tenantResult.rows[0];

    if (tenant.status === 'cancelled') {
      console.error(`Tenant '${subdomain}' is cancelled.`);
      process.exit(1);
    }

    console.log(`Importing ICD-10 mappings for: ${tenant.clinic_name} (${tenant.subdomain})...\n`);

    let connectionString = tenant.connection_string;
    if (!connectionString) {
      const host = process.env.DB_HOST || 'localhost';
      const port = process.env.DB_PORT || '5432';
      const username = process.env.DB_USERNAME || 'medicore';
      const password = process.env.DB_PASSWORD || 'medicore_password';
      connectionString = `postgresql://${username}:${password}@${host}:${port}/${tenant.database_name}`;
    } else {
      // Replace Docker hostnames with localhost if needed
      connectionString = connectionString.replace(/postgres-master/g, 'localhost');
      connectionString = connectionString.replace(/postgresql:\/\/[^:]+:[^@]+@[^:]+:(\d+)\//, (_match: string, port: string) => {
        const host = process.env.DB_HOST || 'localhost';
        const username = process.env.DB_USERNAME || 'medicore';
        const password = process.env.DB_PASSWORD || 'medicore_password';
        return `postgresql://${username}:${password}@${host}:${port}/`;
      });
    }

    try {
      // Run the import script for this tenant
      const { stdout, stderr } = await execFileAsync(
        'npx',
        [
          'ts-node',
          'scripts/import-icd10-map.ts',
          '--zip',
          zipPath,
          '--connection',
          connectionString,
          '--truncate',
          'false', // Don't truncate if data already exists
        ],
        {
          cwd: process.cwd(),
          env: { ...process.env },
        }
      );

      if (stdout) console.log(stdout);
      if (stderr && !stderr.includes('Warning')) console.error(stderr);
      console.log(`\n✅ ICD-10 mappings imported successfully for ${tenant.subdomain}`);
    } catch (error: any) {
      console.error(`❌ Failed to import ICD-10 mappings: ${error.message}`);
      if (error.stdout) console.error(error.stdout);
      if (error.stderr) console.error(error.stderr);
      process.exit(1);
    }
  } finally {
    await masterClient.end();
  }
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});

