#!/usr/bin/env node
/**
 * Provision Sprint 19 Document Management Bundle
 * Adds versioning, sharing, signatures, tags, and access logging to patient documents
 */

import 'dotenv/config';
import { Client } from 'pg';

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
    console.log('\n🚀 Provisioning Sprint 19 Document Management Bundle\n');

    // Get bulawayo-general tenant
    const tenantsResult = await masterClient.query(`
      SELECT id, "clinicName" as clinic_name, subdomain, "databaseName" as database_name, "connectionString" as connection_string
      FROM tenants
      WHERE subdomain = 'bulawayo-general'
    `);

    if (tenantsResult.rows.length === 0) {
      throw new Error('Tenant bulawayo-general not found');
    }

    const tenant = tenantsResult.rows[0];
    console.log(`✅ Found tenant: ${tenant.clinic_name}`);
    console.log(`📊 Database: ${tenant.database_name}\n`);

    // Connect to tenant database
    const connectionString = tenant.connection_string.replace('postgres-master', 'localhost');
    const tenantClient = new Client({ connectionString });
    await tenantClient.connect();

    console.log('📦 Applying Sprint 19 Document Management schema...\n');

    // Create document_versions table
    console.log('Creating document_versions table...');
    await tenantClient.query(`
      CREATE TABLE IF NOT EXISTS document_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES patient_documents(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL,
        file_path VARCHAR(500),
        file_url TEXT,
        file_size INTEGER,
        mime_type VARCHAR(100),
        change_summary TEXT,
        uploaded_by UUID REFERENCES users(id),
        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        is_current BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create document_sharing table
    console.log('Creating document_sharing table...');
    await tenantClient.query(`
      CREATE TABLE IF NOT EXISTS document_sharing (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES patient_documents(id) ON DELETE CASCADE,
        shared_with_user_id UUID REFERENCES users(id),
        shared_with_role VARCHAR(50),
        permission_level VARCHAR(20) NOT NULL CHECK (permission_level IN ('view', 'download', 'edit')),
        shared_by UUID REFERENCES users(id),
        shared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create document_signatures table
    console.log('Creating document_signatures table...');
    await tenantClient.query(`
      CREATE TABLE IF NOT EXISTS document_signatures (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES patient_documents(id) ON DELETE CASCADE,
        signer_id UUID NOT NULL REFERENCES users(id),
        signature_type VARCHAR(50) NOT NULL CHECK (signature_type IN (
          'electronic',
          'digital',
          'wet_signature_scan'
        )),
        signature_data TEXT,
        signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        ip_address INET,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create document_tags table
    console.log('Creating document_tags table...');
    await tenantClient.query(`
      CREATE TABLE IF NOT EXISTS document_tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES patient_documents(id) ON DELETE CASCADE,
        tag_name VARCHAR(100) NOT NULL,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(document_id, tag_name)
      )
    `);

    // Create document_access_log table
    console.log('Creating document_access_log table...');
    await tenantClient.query(`
      CREATE TABLE IF NOT EXISTS document_access_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES patient_documents(id) ON DELETE CASCADE,
        accessed_by UUID REFERENCES users(id),
        access_type VARCHAR(50) NOT NULL CHECK (access_type IN ('view', 'download', 'edit', 'delete', 'share', 'sign')),
        ip_address INET,
        user_agent TEXT,
        accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create indexes
    console.log('Creating indexes...');
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON document_versions(document_id)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_document_versions_is_current ON document_versions(is_current)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_document_sharing_document_id ON document_sharing(document_id)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_document_sharing_user_id ON document_sharing(shared_with_user_id)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_document_sharing_role ON document_sharing(shared_with_role)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_document_signatures_document_id ON document_signatures(document_id)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_document_signatures_signer_id ON document_signatures(signer_id)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_document_tags_document_id ON document_tags(document_id)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_document_tags_tag_name ON document_tags(tag_name)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_document_access_log_document_id ON document_access_log(document_id)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_document_access_log_accessed_by ON document_access_log(accessed_by)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_document_access_log_accessed_at ON document_access_log(accessed_at)`);

    console.log('\n✅ Sprint 19 Document Management provisioning completed successfully!\n');
    console.log('📋 Tables created:');
    console.log('  - document_versions (for version control)');
    console.log('  - document_sharing (for collaboration)');
    console.log('  - document_signatures (for approvals)');
    console.log('  - document_tags (for organization)');
    console.log('  - document_access_log (for audit trail)');
    console.log('\n🎉 Ready to implement document management UI!\n');

    await tenantClient.end();
    await masterClient.end();
  } catch (error) {
    console.error('\n❌ Error during provisioning:', error);
    await masterClient.end();
    process.exit(1);
  }
}

main();


/**
 * Provision Sprint 19 Document Management Bundle
 * Adds versioning, sharing, signatures, tags, and access logging to patient documents
 */

import 'dotenv/config';
import { Client } from 'pg';

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
    console.log('\n🚀 Provisioning Sprint 19 Document Management Bundle\n');

    // Get bulawayo-general tenant
    const tenantsResult = await masterClient.query(`
      SELECT id, "clinicName" as clinic_name, subdomain, "databaseName" as database_name, "connectionString" as connection_string
      FROM tenants
      WHERE subdomain = 'bulawayo-general'
    `);

    if (tenantsResult.rows.length === 0) {
      throw new Error('Tenant bulawayo-general not found');
    }

    const tenant = tenantsResult.rows[0];
    console.log(`✅ Found tenant: ${tenant.clinic_name}`);
    console.log(`📊 Database: ${tenant.database_name}\n`);

    // Connect to tenant database
    const connectionString = tenant.connection_string.replace('postgres-master', 'localhost');
    const tenantClient = new Client({ connectionString });
    await tenantClient.connect();

    console.log('📦 Applying Sprint 19 Document Management schema...\n');

    // Create document_versions table
    console.log('Creating document_versions table...');
    await tenantClient.query(`
      CREATE TABLE IF NOT EXISTS document_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES patient_documents(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL,
        file_path VARCHAR(500),
        file_url TEXT,
        file_size INTEGER,
        mime_type VARCHAR(100),
        change_summary TEXT,
        uploaded_by UUID REFERENCES users(id),
        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        is_current BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create document_sharing table
    console.log('Creating document_sharing table...');
    await tenantClient.query(`
      CREATE TABLE IF NOT EXISTS document_sharing (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES patient_documents(id) ON DELETE CASCADE,
        shared_with_user_id UUID REFERENCES users(id),
        shared_with_role VARCHAR(50),
        permission_level VARCHAR(20) NOT NULL CHECK (permission_level IN ('view', 'download', 'edit')),
        shared_by UUID REFERENCES users(id),
        shared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create document_signatures table
    console.log('Creating document_signatures table...');
    await tenantClient.query(`
      CREATE TABLE IF NOT EXISTS document_signatures (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES patient_documents(id) ON DELETE CASCADE,
        signer_id UUID NOT NULL REFERENCES users(id),
        signature_type VARCHAR(50) NOT NULL CHECK (signature_type IN (
          'electronic',
          'digital',
          'wet_signature_scan'
        )),
        signature_data TEXT,
        signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        ip_address INET,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create document_tags table
    console.log('Creating document_tags table...');
    await tenantClient.query(`
      CREATE TABLE IF NOT EXISTS document_tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES patient_documents(id) ON DELETE CASCADE,
        tag_name VARCHAR(100) NOT NULL,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(document_id, tag_name)
      )
    `);

    // Create document_access_log table
    console.log('Creating document_access_log table...');
    await tenantClient.query(`
      CREATE TABLE IF NOT EXISTS document_access_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES patient_documents(id) ON DELETE CASCADE,
        accessed_by UUID REFERENCES users(id),
        access_type VARCHAR(50) NOT NULL CHECK (access_type IN ('view', 'download', 'edit', 'delete', 'share', 'sign')),
        ip_address INET,
        user_agent TEXT,
        accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create indexes
    console.log('Creating indexes...');
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON document_versions(document_id)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_document_versions_is_current ON document_versions(is_current)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_document_sharing_document_id ON document_sharing(document_id)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_document_sharing_user_id ON document_sharing(shared_with_user_id)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_document_sharing_role ON document_sharing(shared_with_role)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_document_signatures_document_id ON document_signatures(document_id)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_document_signatures_signer_id ON document_signatures(signer_id)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_document_tags_document_id ON document_tags(document_id)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_document_tags_tag_name ON document_tags(tag_name)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_document_access_log_document_id ON document_access_log(document_id)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_document_access_log_accessed_by ON document_access_log(accessed_by)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_document_access_log_accessed_at ON document_access_log(accessed_at)`);

    console.log('\n✅ Sprint 19 Document Management provisioning completed successfully!\n');
    console.log('📋 Tables created:');
    console.log('  - document_versions (for version control)');
    console.log('  - document_sharing (for collaboration)');
    console.log('  - document_signatures (for approvals)');
    console.log('  - document_tags (for organization)');
    console.log('  - document_access_log (for audit trail)');
    console.log('\n🎉 Ready to implement document management UI!\n');

    await tenantClient.end();
    await masterClient.end();
  } catch (error) {
    console.error('\n❌ Error during provisioning:', error);
    await masterClient.end();
    process.exit(1);
  }
}

main();





