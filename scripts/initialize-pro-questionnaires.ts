#!/usr/bin/env ts-node

/**
 * Script to initialize standard questionnaires in a tenant database
 * Usage: npx ts-node scripts/initialize-pro-questionnaires.ts [tenant_slug]
 */

import { DataSource } from 'typeorm';
import { fileURLToPath } from 'url';
import * as path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_HOST = process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432', 10);
const DB_USER = process.env.DB_USER || process.env.DB_USERNAME || process.env.POSTGRES_USER || 'medicore';
const DB_PASSWORD = process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'medicore_password';
const MASTER_DB = process.env.MASTER_DB || 'medicore_master';

async function initializeQuestionnaires(tenantSlug: string): Promise<void> {
  // Get the actual database name from master database
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
      process.exit(1);
    }

    dbName = result[0].databaseName;
  } catch (error: any) {
    console.error(`❌ Error connecting to master database:`, error.message);
    // Fallback to default naming convention
    dbName = `medicore_${tenantSlug.replace(/-/g, '_')}`;
    console.log(`⚠️  Using fallback database name: ${dbName}`);
  }
  
  console.log(`📋 Initializing standard questionnaires for tenant: ${tenantSlug} (database: ${dbName})`);

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

    // Import and initialize questionnaires
    // Use dynamic import with proper path resolution
    const proServicePath = path.resolve(__dirname, '../services/ehr-service/src/services/patient-pro.service.ts');
    const proServiceModule = await import(proServicePath);
    const PatientProService = (proServiceModule as any).PatientProService;
    
    if (!PatientProService) {
      throw new Error('PatientProService not found in module');
    }
    
    // Create mock dependencies
    const notificationsService = {
      sendNotification: async () => {},
    } as any;
    const cdssService = {} as any;
    
    const proService = new PatientProService(notificationsService, cdssService);
    
    await proService.initializeStandardQuestionnaires(tenantDb);
    console.log(`✅ Standard questionnaires initialized successfully!`);
    console.log(`   - PHQ-9 (Depression)`);
    console.log(`   - GAD-7 (Anxiety)`);
    console.log(`   - PROMIS-29 (Quality of Life)`);
    console.log(`   - Pain Scale (NRS 0-10)`);
    console.log(`   - DDS (Diabetes Distress Scale)`);
    console.log(`   - KCCQ (Kansas City Cardiomyopathy Questionnaire)`);

    await tenantDb.destroy();
  } catch (error: any) {
    console.error(`❌ Error initializing questionnaires:`, error.message);
    if (tenantDb.isInitialized) {
      await tenantDb.destroy();
    }
    process.exit(1);
  }
}

async function main() {
  const tenantSlug = process.argv[2];

  if (!tenantSlug) {
    console.error('❌ Error: Tenant slug is required');
    console.log('Usage: npx ts-node scripts/initialize-pro-questionnaires.ts <tenant_slug>');
    process.exit(1);
  }

  await initializeQuestionnaires(tenantSlug);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

