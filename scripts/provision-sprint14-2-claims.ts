import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const masterDb = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'medicore',
  password: process.env.DB_PASSWORD || 'medicore_password',
  database: 'medicore_master',
});

async function getSprint14_2ClaimsEnhancementStatements() {
  return [
    // Enhance medical_aid_claims table
    `DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'pre_authorization_id') THEN
          ALTER TABLE medical_aid_claims ADD COLUMN pre_authorization_id UUID;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'resubmission_count') THEN
          ALTER TABLE medical_aid_claims ADD COLUMN resubmission_count INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'original_claim_id') THEN
          ALTER TABLE medical_aid_claims ADD COLUMN original_claim_id UUID REFERENCES medical_aid_claims(id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'submission_method') THEN
          ALTER TABLE medical_aid_claims ADD COLUMN submission_method VARCHAR(50) CHECK (submission_method IN ('api', 'edi', 'manual', 'bulk'));
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'external_claim_id') THEN
          ALTER TABLE medical_aid_claims ADD COLUMN external_claim_id VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'api_response_data') THEN
          ALTER TABLE medical_aid_claims ADD COLUMN api_response_data JSONB;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'last_status_check_at') THEN
          ALTER TABLE medical_aid_claims ADD COLUMN last_status_check_at TIMESTAMP WITH TIME ZONE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'next_status_check_at') THEN
          ALTER TABLE medical_aid_claims ADD COLUMN next_status_check_at TIMESTAMP WITH TIME ZONE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'diagnosis_codes') THEN
          ALTER TABLE medical_aid_claims ADD COLUMN diagnosis_codes TEXT[];
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'primary_diagnosis_code') THEN
          ALTER TABLE medical_aid_claims ADD COLUMN primary_diagnosis_code VARCHAR(50);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_aid_claims' AND column_name = 'primary_diagnosis_description') THEN
          ALTER TABLE medical_aid_claims ADD COLUMN primary_diagnosis_description TEXT;
        END IF;
      END $$;`,

    // Pre-Authorization Requests Table
    `CREATE TABLE IF NOT EXISTS pre_authorization_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      billing_id UUID REFERENCES billing(id) ON DELETE SET NULL,
      appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
      medical_aid_name VARCHAR(100) NOT NULL,
      member_number VARCHAR(100) NOT NULL,
      request_type VARCHAR(50) NOT NULL CHECK (request_type IN ('consultation', 'procedure', 'surgery', 'hospitalization', 'medication', 'imaging', 'lab_test', 'other')),
      requested_amount DECIMAL(10,2) NOT NULL,
      approved_amount DECIMAL(10,2),
      status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'rejected', 'expired', 'cancelled')),
      request_date DATE NOT NULL,
      approval_date DATE,
      expiry_date DATE,
      rejection_reason TEXT,
      diagnosis_codes TEXT[],
      primary_diagnosis_code VARCHAR(50),
      primary_diagnosis_description TEXT,
      procedure_codes TEXT[],
      service_codes TEXT[],
      clinical_notes TEXT,
      request_data JSONB,
      api_response_data JSONB,
      external_preauth_id VARCHAR(255),
      submitted_at TIMESTAMP WITH TIME ZONE,
      responded_at TIMESTAMP WITH TIME ZONE,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,

    // Claim Status History Table
    `CREATE TABLE IF NOT EXISTS claim_status_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      claim_id UUID NOT NULL REFERENCES medical_aid_claims(id) ON DELETE CASCADE,
      status VARCHAR(50) NOT NULL,
      previous_status VARCHAR(50),
      changed_by UUID REFERENCES users(id),
      change_reason TEXT,
      notes TEXT,
      api_response JSONB,
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,

    // Medical Aid API Configurations Table
    `CREATE TABLE IF NOT EXISTS medical_aid_api_configurations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      medical_aid_name VARCHAR(100) NOT NULL UNIQUE,
      provider_type VARCHAR(50) NOT NULL CHECK (provider_type IN ('cimas', 'premier', 'econet_health', 'psmas', 'other')),
      api_base_url VARCHAR(500) NOT NULL,
      api_key VARCHAR(255),
      api_secret VARCHAR(255),
      authentication_type VARCHAR(50) NOT NULL CHECK (authentication_type IN ('api_key', 'oauth2', 'basic', 'bearer', 'custom')),
      auth_endpoint VARCHAR(500),
      token_endpoint VARCHAR(500),
      refresh_token_endpoint VARCHAR(500),
      claim_submission_endpoint VARCHAR(500),
      status_check_endpoint VARCHAR(500),
      preauth_endpoint VARCHAR(500),
      member_verification_endpoint VARCHAR(500),
      webhook_url VARCHAR(500),
      webhook_secret VARCHAR(255),
      request_timeout INTEGER DEFAULT 30000,
      retry_count INTEGER DEFAULT 3,
      retry_delay INTEGER DEFAULT 1000,
      is_active BOOLEAN DEFAULT true,
      configuration_data JSONB,
      test_mode BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,

    // Claim Submissions Audit Table
    `CREATE TABLE IF NOT EXISTS claim_submissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      claim_id UUID NOT NULL REFERENCES medical_aid_claims(id) ON DELETE CASCADE,
      submission_method VARCHAR(50) NOT NULL CHECK (submission_method IN ('api', 'edi', 'manual', 'bulk')),
      submission_status VARCHAR(50) NOT NULL CHECK (submission_status IN ('success', 'failed', 'pending', 'retrying')),
      submission_attempt INTEGER DEFAULT 1,
      request_payload JSONB,
      response_payload JSONB,
      error_message TEXT,
      error_code VARCHAR(100),
      external_reference_id VARCHAR(255),
      submitted_by UUID REFERENCES users(id),
      submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      responded_at TIMESTAMP WITH TIME ZONE,
      processing_time_ms INTEGER
    )`,

    // Indexes
    `CREATE INDEX IF NOT EXISTS idx_preauth_requests_patient_id ON pre_authorization_requests(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_preauth_requests_billing_id ON pre_authorization_requests(billing_id)`,
    `CREATE INDEX IF NOT EXISTS idx_preauth_requests_status ON pre_authorization_requests(status)`,
    `CREATE INDEX IF NOT EXISTS idx_preauth_requests_medical_aid_name ON pre_authorization_requests(medical_aid_name)`,
    `CREATE INDEX IF NOT EXISTS idx_preauth_requests_request_date ON pre_authorization_requests(request_date)`,
    `CREATE INDEX IF NOT EXISTS idx_preauth_requests_expiry_date ON pre_authorization_requests(expiry_date) WHERE expiry_date IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_claim_status_history_claim_id ON claim_status_history(claim_id)`,
    `CREATE INDEX IF NOT EXISTS idx_claim_status_history_status ON claim_status_history(status)`,
    `CREATE INDEX IF NOT EXISTS idx_claim_status_history_created_at ON claim_status_history(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_medical_aid_api_config_medical_aid_name ON medical_aid_api_configurations(medical_aid_name)`,
    `CREATE INDEX IF NOT EXISTS idx_medical_aid_api_config_provider_type ON medical_aid_api_configurations(provider_type)`,
    `CREATE INDEX IF NOT EXISTS idx_medical_aid_api_config_is_active ON medical_aid_api_configurations(is_active) WHERE is_active = true`,
    `CREATE INDEX IF NOT EXISTS idx_claim_submissions_claim_id ON claim_submissions(claim_id)`,
    `CREATE INDEX IF NOT EXISTS idx_claim_submissions_status ON claim_submissions(submission_status)`,
    `CREATE INDEX IF NOT EXISTS idx_claim_submissions_submitted_at ON claim_submissions(submitted_at)`,
    `CREATE INDEX IF NOT EXISTS idx_claim_submissions_external_reference_id ON claim_submissions(external_reference_id) WHERE external_reference_id IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_claims_preauth_id ON medical_aid_claims(pre_authorization_id) WHERE pre_authorization_id IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_claims_original_claim_id ON medical_aid_claims(original_claim_id) WHERE original_claim_id IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_claims_submission_method ON medical_aid_claims(submission_method) WHERE submission_method IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_claims_external_claim_id ON medical_aid_claims(external_claim_id) WHERE external_claim_id IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_claims_next_status_check_at ON medical_aid_claims(next_status_check_at) WHERE next_status_check_at IS NOT NULL`,
  ];
}

async function provisionBundle(
  tenantDb: DataSource,
  bundleId: string,
  version: string,
  statements: string[],
) {
  // Ensure schema_versions table exists
  await tenantDb.query(`
    CREATE TABLE IF NOT EXISTS schema_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bundle_id VARCHAR(100) NOT NULL,
      version VARCHAR(50) NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      applied_by VARCHAR(255),
      UNIQUE(bundle_id, version)
    )
  `);

  // Check if already applied
  const existing = await tenantDb.query(
    `SELECT * FROM schema_versions WHERE bundle_id = $1 AND version = $2`,
    [bundleId, version],
  );

  if (existing.length > 0) {
    return { applied: false, reason: 'already_applied' };
  }

  // Apply statements
  for (const statement of statements) {
    if (!statement.trim()) continue;
    try {
      await tenantDb.query(statement);
    } catch (error: any) {
      // If it's a "relation already exists" error, that's fine
      if (error.message.includes('already exists') || error.message.includes('duplicate key')) {
        continue;
      }
      console.error(`  ✗ Error executing statement: ${error.message.split('\n')[0]}`);
      // Don't throw - continue with other statements
    }
  }

  // Record schema version
  await tenantDb.query(
    `INSERT INTO schema_versions (bundle_id, version, applied_by) VALUES ($1, $2, $3)`,
    [bundleId, version, 'provisioning_script'],
  );

  return { applied: true };
}

async function provisionSprint14_2() {
  try {
    await masterDb.initialize();
    console.log('✅ Connected to master database\n');

    // Get all active tenants
    const tenants = await masterDb.query(
      `SELECT id, "databaseName", subdomain FROM tenants WHERE status = 'active'`,
    );

    console.log(`📊 Found ${tenants.length} active tenant(s)\n`);

    if (tenants.length === 0) {
      console.log('⚠️  No active tenants found. Nothing to provision.');
      await masterDb.destroy();
      return;
    }

    const bundle = {
      id: 'sprint14_2_claims_enhancement',
      version: '2025.12.22',
      label: 'Sprint 14.2 - Medical Aid Claims Processing Enhancement',
      getStatements: getSprint14_2ClaimsEnhancementStatements,
    };

    for (const tenant of tenants) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🏥 Provisioning tenant: ${tenant.subdomain} (${tenant.databaseName})`);
      console.log('='.repeat(60));

      const tenantDb = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USERNAME || 'medicore',
        password: process.env.DB_PASSWORD || 'medicore_password',
        database: tenant.databaseName,
      });

      try {
        await tenantDb.initialize();

        console.log(`\n📦 Applying: ${bundle.label}`);
        const statements = await bundle.getStatements();
        const result = await provisionBundle(
          tenantDb,
          bundle.id,
          bundle.version,
          statements,
        );

        if (result.applied) {
          console.log(`  ✅ ${bundle.label} applied successfully`);
        } else if (result.reason === 'already_applied') {
          console.log(`  ⏭️  ${bundle.label} already applied, skipping`);
        }

        await tenantDb.destroy();
        console.log(`\n✅ Completed provisioning for ${tenant.subdomain}`);
      } catch (error: any) {
        console.error(`\n❌ Error provisioning tenant ${tenant.subdomain}: ${error.message}`);
        console.error(error.stack);
        try {
          await tenantDb.destroy();
        } catch {}
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('🎉 Provisioning completed for all tenants!');
    console.log('='.repeat(60));
    console.log('\n📝 Next steps:');
    console.log('   1. Restart the EHR service to pick up the new schema');
    console.log('   2. Implement backend services for claims management');
    console.log('   3. Test the enhanced claims features\n');

    await masterDb.destroy();
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

provisionSprint14_2();

