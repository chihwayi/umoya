#!/usr/bin/env node
import 'dotenv/config';
import { Client } from 'pg';
import { DataSource } from 'typeorm';

// Simple script to apply ICD-10 mapping bundle to tenant databases
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

    console.log(`Found ${tenantsResult.rows.length} tenant(s). Applying ICD-10 mapping bundle...\n`);

    const icd10Statements = [
      `CREATE TABLE IF NOT EXISTS snomed_icd10_mappings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        concept_id VARCHAR(50) NOT NULL,
        concept_fsn TEXT,
        target_code VARCHAR(20) NOT NULL,
        target_display TEXT,
        map_group SMALLINT DEFAULT 1,
        map_priority SMALLINT DEFAULT 1,
        map_rule TEXT,
        map_advice TEXT,
        map_status VARCHAR(10),
        map_category_id VARCHAR(20),
        module_id VARCHAR(50),
        map_source VARCHAR(100),
        effective_time DATE,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_snomed_icd10_unique_map
        ON snomed_icd10_mappings (concept_id, target_code, map_group, map_priority)`,
      `CREATE INDEX IF NOT EXISTS idx_snomed_icd10_concept
        ON snomed_icd10_mappings (concept_id)`,
      `CREATE INDEX IF NOT EXISTS idx_snomed_icd10_target
        ON snomed_icd10_mappings (target_code)`,
      `CREATE INDEX IF NOT EXISTS idx_snomed_icd10_active_concept
        ON snomed_icd10_mappings (active, concept_id)`,
      `CREATE TABLE IF NOT EXISTS icd10_mapping_metadata (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        release_label VARCHAR(150) NOT NULL,
        effective_time DATE,
        source_zip TEXT,
        total_rows INTEGER,
        import_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        import_completed_at TIMESTAMP WITH TIME ZONE,
        notes TEXT
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_icd10_mapping_metadata_release
        ON icd10_mapping_metadata (release_label)`,
      `CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ language 'plpgsql'`,
      `DROP TRIGGER IF EXISTS update_snomed_icd10_mappings_updated_at ON snomed_icd10_mappings;
       CREATE TRIGGER update_snomed_icd10_mappings_updated_at
       BEFORE UPDATE ON snomed_icd10_mappings
       FOR EACH ROW
       EXECUTE PROCEDURE update_updated_at_column()`,
      `DROP TRIGGER IF EXISTS update_icd10_mapping_metadata_updated_at ON icd10_mapping_metadata;
       CREATE TRIGGER update_icd10_mapping_metadata_updated_at
       BEFORE UPDATE ON icd10_mapping_metadata
       FOR EACH ROW
       EXECUTE PROCEDURE update_updated_at_column()`,
      `CREATE TABLE IF NOT EXISTS tenant_schema_versions (
        bundle_id TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        applied_by TEXT,
        notes TEXT
      )`,
      `INSERT INTO tenant_schema_versions (bundle_id, version, applied_at, applied_by)
       VALUES ('icd10_mapping', '2025.03.01', NOW(), 'apply-icd10-bundle-script')
       ON CONFLICT (bundle_id) DO UPDATE
       SET version = EXCLUDED.version,
           applied_at = NOW(),
           applied_by = EXCLUDED.applied_by`,
    ];

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

      console.log(`→ Applying to ${tenant.clinic_name} (${tenant.subdomain})...`);

      const tenantClient = new Client({ connectionString });
      try {
        await tenantClient.connect();

        for (const statement of icd10Statements) {
          try {
            await tenantClient.query(statement);
          } catch (error: any) {
            // Ignore "already exists" errors
            if (!error.message.includes('already exists') && !error.message.includes('duplicate')) {
              console.error(`  ⚠️  Warning: ${error.message.substring(0, 100)}`);
            }
          }
        }

        console.log(`  ✅ Completed ${tenant.subdomain}\n`);
        await tenantClient.end();
      } catch (error: any) {
        console.error(`  ❌ Failed ${tenant.subdomain}: ${error.message}\n`);
        try {
          await tenantClient.end();
        } catch {}
      }
    }

    console.log('✅ ICD-10 mapping bundle applied to all tenants.');
  } finally {
    await masterClient.end();
  }
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});

