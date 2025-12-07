#!/usr/bin/env node
/**
 * Provision Sprint 18 Referral Management Bundle
 * Applies the sprint18_referral_management bundle to bulawayo-general tenant
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
    console.log('\n🚀 Provisioning Sprint 18 Referral Management Bundle\n');

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

    // Connect to tenant database (replace postgres-master with localhost)
    const connectionString = tenant.connection_string.replace('postgres-master', 'localhost');
    const tenantClient = new Client({ connectionString });
    await tenantClient.connect();

    console.log('📦 Applying Sprint 18 Referral Management schema...\n');

    // Create tables
    console.log('Creating referrals table...');
    await tenantClient.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        referring_provider_id UUID NOT NULL REFERENCES users(id),
        referring_facility_name VARCHAR(255),
        referred_to_provider_id UUID REFERENCES users(id),
        referred_to_facility_name VARCHAR(255) NOT NULL,
        referred_to_facility_address TEXT,
        referred_to_facility_phone VARCHAR(50),
        referred_to_facility_email VARCHAR(255),
        referral_type VARCHAR(50) NOT NULL CHECK (referral_type IN (
          'specialist', 'laboratory', 'imaging', 'surgery', 'hospitalization',
          'therapy', 'mental_health', 'dental', 'ophthalmology', 'cardiology',
          'oncology', 'other'
        )),
        specialty VARCHAR(100),
        priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        urgency VARCHAR(20) CHECK (urgency IN ('routine', 'urgent', 'emergent')),
        reason TEXT NOT NULL,
        clinical_summary TEXT,
        relevant_history TEXT,
        current_medications TEXT,
        allergies TEXT,
        diagnostic_tests_ordered TEXT,
        requested_services TEXT,
        referral_date DATE NOT NULL,
        requested_appointment_date DATE,
        status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
          'draft', 'pending', 'sent', 'acknowledged', 'scheduled',
          'in_progress', 'completed', 'cancelled', 'rejected', 'expired'
        )),
        external_referral_id VARCHAR(255),
        response_received_date DATE,
        appointment_scheduled_date DATE,
        appointment_completed_date DATE,
        response_notes TEXT,
        outcome_summary TEXT,
        cancellation_reason TEXT,
        rejection_reason TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    console.log('Creating referral_attachments table...');
    await tenantClient.query(`
      CREATE TABLE IF NOT EXISTS referral_attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
        document_type VARCHAR(50) NOT NULL CHECK (document_type IN (
          'clinical_note', 'lab_result', 'imaging_result', 'prescription',
          'medical_record', 'other'
        )),
        document_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500),
        file_url TEXT,
        file_size INTEGER,
        mime_type VARCHAR(100),
        description TEXT,
        uploaded_by UUID REFERENCES users(id),
        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    console.log('Creating referral_status_history table...');
    await tenantClient.query(`
      CREATE TABLE IF NOT EXISTS referral_status_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
        old_status VARCHAR(50),
        new_status VARCHAR(50) NOT NULL,
        change_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        changed_by UUID REFERENCES users(id),
        notes TEXT,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    console.log('Creating referral_templates table...');
    await tenantClient.query(`
      CREATE TABLE IF NOT EXISTS referral_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        referral_type VARCHAR(50) NOT NULL,
        specialty VARCHAR(100),
        template_data JSONB NOT NULL,
        is_default BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        usage_count INTEGER DEFAULT 0,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    console.log('Creating referral_facilities table...');
    await tenantClient.query(`
      CREATE TABLE IF NOT EXISTS referral_facilities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        facility_name VARCHAR(255) NOT NULL,
        facility_type VARCHAR(50) CHECK (facility_type IN (
          'hospital', 'clinic', 'specialist_practice', 'laboratory',
          'imaging_center', 'therapy_center', 'other'
        )),
        specialties TEXT[],
        address TEXT,
        city VARCHAR(100),
        phone VARCHAR(50),
        email VARCHAR(255),
        website VARCHAR(255),
        contact_person VARCHAR(255),
        referral_process TEXT,
        required_documents TEXT[],
        average_wait_time_days INTEGER,
        accepts_insurance BOOLEAN DEFAULT true,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    console.log('Creating indexes...');
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_referrals_patient_id ON referrals(patient_id)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_referrals_referring_provider ON referrals(referring_provider_id)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_referrals_referred_to_provider ON referrals(referred_to_provider_id)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_referrals_type ON referrals(referral_type)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_referrals_referral_date ON referrals(referral_date)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_referral_attachments_referral_id ON referral_attachments(referral_id)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_referral_status_history_referral_id ON referral_status_history(referral_id)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_referral_status_history_change_date ON referral_status_history(change_date)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_referral_templates_type ON referral_templates(referral_type)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_referral_templates_specialty ON referral_templates(specialty)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_referral_facilities_type ON referral_facilities(facility_type)`);
    await tenantClient.query(`CREATE INDEX IF NOT EXISTS idx_referral_facilities_specialties ON referral_facilities USING GIN(specialties)`);

    console.log('\n✅ Sprint 18 Referral Management provisioning completed successfully!\n');
    console.log('📋 Tables created:');
    console.log('  - referrals');
    console.log('  - referral_attachments');
    console.log('  - referral_status_history');
    console.log('  - referral_templates');
    console.log('  - referral_facilities');
    console.log('\n🎉 Ready to implement backend services!\n');

    await tenantClient.end();
    await masterClient.end();
  } catch (error) {
    console.error('\n❌ Error during provisioning:', error);
    await masterClient.end();
    process.exit(1);
  }
}

main();
