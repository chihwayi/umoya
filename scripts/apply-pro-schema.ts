#!/usr/bin/env ts-node

/**
 * Script to apply Patient-Reported Outcomes (PROs) schema to tenant databases
 * Usage: npx ts-node scripts/apply-pro-schema.ts [tenant_slug]
 */

import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATION_FILE = path.join(__dirname, '../database/migrations/015-add-patient-reported-outcomes.sql');

// Database connection details (from docker-compose.yml)
const DB_HOST = process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432', 10);
const DB_USER = process.env.DB_USER || process.env.DB_USERNAME || process.env.POSTGRES_USER || 'medicore';
const DB_PASSWORD = process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'medicore_password';
const MASTER_DB = process.env.MASTER_DB || 'medicore_master';

async function applyToTenant(tenantSlug: string): Promise<boolean> {
  // First, get the actual database name from master database
  const masterDb = new DataSource({
    type: 'postgres',
    host: DB_HOST,
    port: DB_PORT,
    username: DB_USER,
    password: DB_PASSWORD,
    database: MASTER_DB,
  });

  let dbName: string;
  try {
    await masterDb.initialize();
    const result = await masterDb.query(
      `SELECT "databaseName" FROM tenants WHERE subdomain = $1`,
      [tenantSlug]
    );
    await masterDb.destroy();

    if (!result || result.length === 0) {
      console.error(`❌ Error: Tenant '${tenantSlug}' not found in master database`);
      return false;
    }

    dbName = result[0].databaseName;
  } catch (error: any) {
    console.error(`❌ Error connecting to master database:`, error.message);
    // Fallback to default naming convention
    dbName = `medicore_${tenantSlug.replace(/-/g, '_')}`;
    console.log(`⚠️  Using fallback database name: ${dbName}`);
  }
  
  console.log(`\n📋 Applying PRO schema to tenant: ${tenantSlug} (database: ${dbName})`);

  // Check if migration file exists
  if (!fs.existsSync(MIGRATION_FILE)) {
    console.error(`❌ Error: Migration file not found: ${MIGRATION_FILE}`);
    return false;
  }

  // Read migration SQL
  const migrationSQL = fs.readFileSync(MIGRATION_FILE, 'utf-8');

  // Connect to tenant database
  const tenantDb = new DataSource({
    type: 'postgres',
    host: DB_HOST,
    port: DB_PORT,
    username: DB_USER,
    password: DB_PASSWORD,
    database: dbName,
  });

  try {
    await tenantDb.initialize();
    console.log(`✓ Connected to ${dbName}`);

    // Apply migration
    console.log('Applying migration...');
    await tenantDb.query(migrationSQL);
    console.log(`✓ Successfully applied PRO schema to ${tenantSlug}`);

    // Note: Questionnaires will be initialized via separate script or API
    console.log(`⚠️  Note: Standard questionnaires need to be initialized separately`);
    console.log(`   Run: npx ts-node scripts/initialize-pro-questionnaires.ts ${tenantSlug}`);

    await tenantDb.destroy();
    return true;
  } catch (error: any) {
    console.error(`❌ Error applying schema to ${tenantSlug}:`, error.message);
    if (tenantDb.isInitialized) {
      await tenantDb.destroy();
    }
    return false;
  }
}

async function applyToAllTenants(): Promise<void> {
  console.log('📋 Applying PRO schema to ALL tenants...');

  // Connect to master database
  const masterDb = new DataSource({
    type: 'postgres',
    host: DB_HOST,
    port: DB_PORT,
    username: DB_USER,
    password: DB_PASSWORD,
    database: MASTER_DB,
  });

  try {
    await masterDb.initialize();
    
    // Get all active tenants
    const tenants = await masterDb.query(
      `SELECT subdomain FROM tenants WHERE status = 'active' ORDER BY subdomain`
    );

    if (tenants.length === 0) {
      console.log('⚠️  No active tenants found');
      await masterDb.destroy();
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const tenant of tenants) {
      if (await applyToTenant(tenant.subdomain)) {
        successCount++;
      } else {
        failCount++;
      }
    }

    console.log(`\n✅ === Summary ===`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);

    await masterDb.destroy();
  } catch (error: any) {
    console.error('❌ Error connecting to master database:', error.message);
    if (masterDb.isInitialized) {
      await masterDb.destroy();
    }
  }
}

async function main() {
  const tenantSlug = process.argv[2];

  if (!tenantSlug) {
    // Apply to all tenants
    await applyToAllTenants();
  } else {
    // Apply to specific tenant
    const success = await applyToTenant(tenantSlug);
    process.exit(success ? 0 : 1);
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

