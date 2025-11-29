#!/usr/bin/env node
import 'dotenv/config';
import { Client } from 'pg';

/**
 * Script to apply Sprint 5 patient history tables to existing tenant databases
 * These tables are already in the core bundle for new tenants, but need to be
 * applied to existing tenants like bulawayo-general
 */

async function main() {
  const masterDbUrl =
    process.env.TENANT_SERVICE_DATABASE_URL ||
    process.env.ADMIN_DATABASE_URL ||
    process.env.DB_URL ||
    process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USERNAME || 'medicore'}:${process.env.DB_PASSWORD || 'medicore_password'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/medicore_master`;

  // Replace Docker hostnames with localhost for local execution
  const normalizedUrl = masterDbUrl.replace(/postgres-master|postgresql-master/g, 'localhost');

  const masterClient = new Client({ connectionString: normalizedUrl });
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

    console.log(`Found ${tenantsResult.rows.length} tenant(s). Applying patient history tables...\n`);

    const patientHistoryStatements = [
      // Patient Medical History
      `CREATE TABLE IF NOT EXISTS patient_medical_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        condition_type VARCHAR(50) NOT NULL CHECK (condition_type IN ('diagnosis', 'surgery', 'procedure', 'injury', 'hospitalization', 'other')),
        condition_name VARCHAR(255) NOT NULL,
        snomed_concept_id VARCHAR(50),
        snomed_term TEXT,
        diagnosis_date DATE,
        resolved_date DATE,
        status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'chronic', 'history')),
        severity VARCHAR(50),
        notes TEXT,
        treating_physician VARCHAR(255),
        facility_name VARCHAR(255),
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_patient_medical_history_patient_id ON patient_medical_history(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_patient_medical_history_snomed_concept_id ON patient_medical_history(snomed_concept_id)`,
      `CREATE INDEX IF NOT EXISTS idx_patient_medical_history_status ON patient_medical_history(status)`,
      `CREATE INDEX IF NOT EXISTS idx_patient_medical_history_diagnosis_date ON patient_medical_history(diagnosis_date)`,

      // Patient Family History
      `CREATE TABLE IF NOT EXISTS patient_family_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        relationship VARCHAR(50) NOT NULL CHECK (relationship IN ('mother', 'father', 'sibling', 'grandmother', 'grandfather', 'aunt', 'uncle', 'cousin', 'other')),
        relative_name VARCHAR(255),
        condition_name VARCHAR(255) NOT NULL,
        snomed_concept_id VARCHAR(50),
        snomed_term TEXT,
        age_at_onset INTEGER,
        age_at_death INTEGER,
        cause_of_death VARCHAR(255),
        notes TEXT,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_patient_family_history_patient_id ON patient_family_history(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_patient_family_history_relationship ON patient_family_history(relationship)`,
      `CREATE INDEX IF NOT EXISTS idx_patient_family_history_snomed_concept_id ON patient_family_history(snomed_concept_id)`,

      // Patient Social History
      `CREATE TABLE IF NOT EXISTS patient_social_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        history_type VARCHAR(50) NOT NULL CHECK (history_type IN ('smoking', 'alcohol', 'drug_use', 'occupation', 'exercise', 'diet', 'travel', 'sexual_history', 'other')),
        status VARCHAR(50),
        frequency VARCHAR(100),
        quantity VARCHAR(100),
        start_date DATE,
        end_date DATE,
        notes TEXT,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_patient_social_history_patient_id ON patient_social_history(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_patient_social_history_history_type ON patient_social_history(history_type)`,

      // Patient Documents
      `CREATE TABLE IF NOT EXISTS patient_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('id_card', 'insurance_card', 'medical_report', 'lab_result', 'imaging_result', 'prescription', 'certificate', 'other')),
        document_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500),
        file_url TEXT,
        file_size INTEGER,
        mime_type VARCHAR(100),
        description TEXT,
        uploaded_by UUID REFERENCES users(id),
        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_patient_documents_patient_id ON patient_documents(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_patient_documents_document_type ON patient_documents(document_type)`,
      `CREATE INDEX IF NOT EXISTS idx_patient_documents_uploaded_at ON patient_documents(uploaded_at)`,
    ];

    let successCount = 0;
    let failCount = 0;

    for (const tenant of tenantsResult.rows) {
      const tenantDbName = tenant.database_name;
      let connectionString = tenant.connection_string;

      // If no explicit connection string, construct one
      if (!connectionString) {
        const dbHost = process.env.DB_HOST || 'localhost';
        const dbPort = process.env.DB_PORT || '5432';
        const dbUser = process.env.DB_USERNAME || 'medicore';
        const dbPassword = process.env.DB_PASSWORD || 'medicore_password';
        connectionString = `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${tenantDbName}`;
      }

      // Replace Docker hostnames with localhost
      connectionString = connectionString.replace(/postgres-master|postgresql-master/g, 'localhost');

      console.log(`\n📋 Applying to: ${tenant.clinic_name} (${tenantDbName})`);

      const tenantClient = new Client({ connectionString });
      try {
        await tenantClient.connect();

        for (const statement of patientHistoryStatements) {
          try {
            await tenantClient.query(statement);
          } catch (error: any) {
            // Ignore "already exists" errors for tables/indexes
            if (!error.message.includes('already exists') && !error.message.includes('duplicate')) {
              console.error(`  ⚠️  Warning: ${error.message.substring(0, 100)}`);
            }
          }
        }

        await tenantClient.end();
        console.log(`  ✅ Successfully applied patient history tables`);
        successCount++;
      } catch (error: any) {
        console.error(`  ❌ Failed: ${error.message}`);
        failCount++;
        try {
          await tenantClient.end();
        } catch {}
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`  ✅ Success: ${successCount} tenant(s)`);
    if (failCount > 0) {
      console.log(`  ❌ Failed: ${failCount} tenant(s)`);
    }
    console.log(`\n✨ Patient history tables applied to existing tenants!`);
    console.log(`   New tenants will automatically get these tables via the core bundle.\n`);
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await masterClient.end();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

