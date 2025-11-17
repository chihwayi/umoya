#!/usr/bin/env ts-node
import 'dotenv/config';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { DatabaseProvisioningService } from '../services/tenant-service/src/services/database-provisioning.service';

const argv = yargs(hideBin(process.argv))
  .option('connection', {
    type: 'string',
    describe: 'Tenant database connection string',
  })
  .option('schema', {
    type: 'string',
    default: 'public',
    describe: 'Database schema to inspect',
  })
  .option('bundle', {
    type: 'array',
    describe: 'Specific provisioning bundle IDs to inspect (defaults to core bundle)',
  })
  .help()
  .alias('help', 'h').argv as unknown as {
  connection?: string;
  schema: string;
  bundle?: string[];
};

async function main() {
  const connectionString =
    argv.connection ||
    process.env.TENANT_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.DB_URL;

  if (!connectionString) {
    throw new Error(
      'Provide a tenant connection string via --connection or TENANT_DATABASE_URL/DATABASE_URL env vars',
    );
  }

  const schema = argv.schema || 'public';
  const adminDataSource = new DataSource({
    type: 'postgres',
    url: process.env.DB_URL || process.env.DATABASE_URL || connectionString,
  });

  const provisioningService = new DatabaseProvisioningService(adminDataSource);
  const bundleManifest = provisioningService.getProvisioningBundlesManifest();

  const bundleIds =
    argv.bundle && argv.bundle.length > 0
      ? argv.bundle.map(String)
      : ['core'];

  const targetBundles = bundleManifest.filter((bundle) => bundleIds.includes(bundle.id));
  if (targetBundles.length === 0) {
    throw new Error(`No provisioning bundles matched selection: ${bundleIds.join(', ')}`);
  }

  const statements = provisioningService.getCoreSchemaStatements();
  const { tables: expectedTables, indexes: expectedIndexes } = extractDefinitions(statements);

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const existingTables = await fetchExistingTables(client, schema);
    const existingIndexes = await fetchExistingIndexes(client, schema);

    const missingTables = [...expectedTables].filter((table) => !existingTables.has(table));
    const missingIndexes = [...expectedIndexes].filter((index) => !existingIndexes.has(index));

    const report = {
      target: connectionString.replace(/:\/\/.*@/, '://***@'),
      schema,
      bundles: targetBundles,
      missingTables,
      missingIndexes,
      timestamp: new Date().toISOString(),
    };

    if (missingTables.length === 0 && missingIndexes.length === 0) {
      console.log('✅ No schema drift detected for selected bundles.');
    } else {
      console.log('⚠️  Schema drift detected:');
    }
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await client.end();
  }
}

function extractDefinitions(statements: string[]) {
  const tableRegex = /CREATE TABLE(?: IF NOT EXISTS)?\s+"?([a-zA-Z0-9_]+)"?/i;
  const indexRegex = /CREATE INDEX(?: IF NOT EXISTS)?\s+"?([a-zA-Z0-9_]+)"?/i;

  const tables = new Set<string>();
  const indexes = new Set<string>();

  for (const statement of statements) {
    const tableMatch = statement.match(tableRegex);
    if (tableMatch) {
      tables.add(tableMatch[1].toLowerCase());
    }
    const indexMatch = statement.match(indexRegex);
    if (indexMatch) {
      indexes.add(indexMatch[1].toLowerCase());
    }
  }

  return { tables, indexes };
}

async function fetchExistingTables(client: Client, schema: string) {
  const result = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = $1`,
    [schema],
  );
  return new Set(result.rows.map((row) => row.table_name.toLowerCase()));
}

async function fetchExistingIndexes(client: Client, schema: string) {
  const result = await client.query(
    `SELECT indexname FROM pg_indexes WHERE schemaname = $1`,
    [schema],
  );
  return new Set(result.rows.map((row) => row.indexname.toLowerCase()));
}

main().catch((error) => {
  console.error('Schema drift detection failed:', error);
  process.exit(1);
});


