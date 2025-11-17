#!/usr/bin/env node
import 'dotenv/config';
import { Client } from 'pg';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';

const execFileAsync = promisify(execFile);

async function main() {
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

    console.log(`Found ${tenantsResult.rows.length} tenant(s). Importing ICD-10 mappings...\n`);

    for (const tenant of tenantsResult.rows) {
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

      console.log(`→ Importing into ${tenant.clinic_name} (${tenant.subdomain})...`);

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
        console.log(`  ✅ Completed ${tenant.subdomain}\n`);
      } catch (error: any) {
        console.error(`  ❌ Failed ${tenant.subdomain}: ${error.message}\n`);
        if (error.stdout) console.error(error.stdout);
        if (error.stderr) console.error(error.stderr);
      }
    }

    console.log('✅ ICD-10 mapping import completed for all tenants.');
  } finally {
    await masterClient.end();
  }
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});

