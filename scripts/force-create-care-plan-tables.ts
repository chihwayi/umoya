#!/usr/bin/env node
/**
 * Force Create Care Plan Tables
 * Directly creates all Sprint 17 care plan tables
 */

import 'dotenv/config';
import { Client } from 'pg';
import { DataSource } from 'typeorm';

const TENANT_SLUG = 'bulawayo-general';

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
    console.log('\n🔨 Force Creating Sprint 17 Care Plan Tables\n');

    // Get tenant
    const tenantsResult = await masterClient.query(`
      SELECT id, "clinicName" as clinic_name, subdomain, "databaseName" as database_name, "connectionString" as connection_string
      FROM tenants
      WHERE subdomain = $1
    `, [TENANT_SLUG]);

    if (tenantsResult.rows.length === 0) {
      console.error(`❌ Tenant ${TENANT_SLUG} not found`);
      return;
    }

    const tenant = tenantsResult.rows[0];
    console.log(`Found tenant: ${tenant.clinic_name}\n`);

    // Build connection string
    let connectionString = tenant.connection_string;
    if (!connectionString) {
      const host = process.env.DB_HOST || 'localhost';
      const port = process.env.DB_PORT || '5432';
      const username = process.env.DB_USERNAME || 'medicore';
      const password = process.env.DB_PASSWORD || 'medicore_password';
      connectionString = `postgresql://${username}:${password}@${host}:${port}/${tenant.database_name}`;
    } else {
      connectionString = connectionString.replace(/postgres-master/g, 'localhost');
      connectionString = connectionString.replace(/postgresql:\/\/[^:]+:[^@]+@[^:]+:(\d+)\//, (_match: string, port: string) => {
        const host = process.env.DB_HOST || 'localhost';
        const username = process.env.DB_USERNAME || 'medicore';
        const password = process.env.DB_PASSWORD || 'medicore_password';
        return `postgresql://${username}:${password}@${host}:${port}/`;
      });
    }

    // Connect to tenant database
    const tenantDataSource = new DataSource({
      type: 'postgres',
      url: connectionString,
    });

    await tenantDataSource.initialize();
    console.log('✅ Connected to tenant database\n');

    // Step 1: Delete version record if exists
    console.log('Step 1: Removing version record...');
    const deleteResult = await tenantDataSource.query(`
      DELETE FROM tenant_schema_versions WHERE bundle_id = 'sprint17_care_plans'
    `);
    console.log('✅ Version record removed\n');

    // Step 2: Create tables
    console.log('Step 2: Creating tables...\n');

    const sqlStatements = [
      // Care Plan Templates Table
      `CREATE TABLE IF NOT EXISTS care_plan_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(50) NOT NULL CHECK (category IN (
          'chronic_disease',
          'post_surgery',
          'preventive_care',
          'mental_health',
          'maternity',
          'pediatric',
          'geriatric',
          'rehabilitation',
          'palliative',
          'general'
        )),
        condition_code VARCHAR(50),
        condition_name VARCHAR(255),
        template_data JSONB NOT NULL,
        is_default BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        usage_count INTEGER DEFAULT 0,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,

      // Care Plans Table
      `CREATE TABLE IF NOT EXISTS care_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        template_id UUID REFERENCES care_plan_templates(id),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN (
          'draft',
          'active',
          'on_hold',
          'completed',
          'cancelled'
        )),
        start_date DATE NOT NULL,
        end_date DATE,
        target_completion_date DATE,
        primary_provider_id UUID REFERENCES users(id),
        care_team JSONB DEFAULT '[]'::jsonb,
        diagnosis_codes TEXT[],
        notes TEXT,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,

      // Care Plan Goals Table
      `CREATE TABLE IF NOT EXISTS care_plan_goals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        care_plan_id UUID NOT NULL REFERENCES care_plans(id) ON DELETE CASCADE,
        goal_number INTEGER NOT NULL,
        goal_text TEXT NOT NULL,
        goal_type VARCHAR(50) NOT NULL CHECK (goal_type IN (
          'clinical',
          'functional',
          'behavioral',
          'quality_of_life',
          'symptom_management',
          'preventive',
          'education'
        )),
        target_value VARCHAR(255),
        current_value VARCHAR(255),
        measurement_unit VARCHAR(50),
        target_date DATE,
        status VARCHAR(50) NOT NULL DEFAULT 'in_progress' CHECK (status IN (
          'not_started',
          'in_progress',
          'achieved',
          'partially_achieved',
          'not_achieved',
          'on_hold'
        )),
        priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,

      // Care Plan Interventions Table
      `CREATE TABLE IF NOT EXISTS care_plan_interventions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        care_plan_id UUID NOT NULL REFERENCES care_plans(id) ON DELETE CASCADE,
        goal_id UUID REFERENCES care_plan_goals(id) ON DELETE CASCADE,
        intervention_number INTEGER NOT NULL,
        intervention_text TEXT NOT NULL,
        intervention_type VARCHAR(50) NOT NULL CHECK (intervention_type IN (
          'medication',
          'therapy',
          'education',
          'lifestyle',
          'monitoring',
          'referral',
          'procedure',
          'counseling',
          'other'
        )),
        frequency VARCHAR(100),
        duration VARCHAR(100),
        responsible_role VARCHAR(50),
        assigned_to UUID REFERENCES users(id),
        status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
          'pending',
          'in_progress',
          'completed',
          'cancelled',
          'on_hold'
        )),
        start_date DATE,
        end_date DATE,
        completion_date DATE,
        outcome_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,

      // Care Plan Progress Log Table
      `CREATE TABLE IF NOT EXISTS care_plan_progress_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        care_plan_id UUID NOT NULL REFERENCES care_plans(id) ON DELETE CASCADE,
        goal_id UUID REFERENCES care_plan_goals(id) ON DELETE CASCADE,
        intervention_id UUID REFERENCES care_plan_interventions(id) ON DELETE CASCADE,
        progress_date DATE NOT NULL,
        progress_type VARCHAR(50) NOT NULL CHECK (progress_type IN (
          'goal_update',
          'intervention_completed',
          'milestone_reached',
          'status_change',
          'note'
        )),
        current_value VARCHAR(255),
        progress_percentage INTEGER CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
        notes TEXT,
        recorded_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,

      // Care Plan Outcomes Table
      `CREATE TABLE IF NOT EXISTS care_plan_outcomes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        care_plan_id UUID NOT NULL REFERENCES care_plans(id) ON DELETE CASCADE,
        outcome_date DATE NOT NULL,
        outcome_type VARCHAR(50) NOT NULL CHECK (outcome_type IN (
          'clinical_improvement',
          'symptom_reduction',
          'functional_improvement',
          'goal_achieved',
          'no_change',
          'deterioration',
          'complication'
        )),
        measurement_value VARCHAR(255),
        measurement_unit VARCHAR(50),
        baseline_value VARCHAR(255),
        improvement_percentage DECIMAL(5,2),
        notes TEXT,
        assessed_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,

      // Indexes
      `CREATE INDEX IF NOT EXISTS idx_care_plan_templates_category ON care_plan_templates(category)`,
      `CREATE INDEX IF NOT EXISTS idx_care_plan_templates_condition ON care_plan_templates(condition_code)`,
      `CREATE INDEX IF NOT EXISTS idx_care_plan_templates_is_active ON care_plan_templates(is_active)`,
      `CREATE INDEX IF NOT EXISTS idx_care_plans_patient_id ON care_plans(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_care_plans_status ON care_plans(status)`,
      `CREATE INDEX IF NOT EXISTS idx_care_plans_primary_provider ON care_plans(primary_provider_id)`,
      `CREATE INDEX IF NOT EXISTS idx_care_plans_start_date ON care_plans(start_date)`,
      `CREATE INDEX IF NOT EXISTS idx_care_plan_goals_care_plan_id ON care_plan_goals(care_plan_id)`,
      `CREATE INDEX IF NOT EXISTS idx_care_plan_goals_status ON care_plan_goals(status)`,
      `CREATE INDEX IF NOT EXISTS idx_care_plan_goals_target_date ON care_plan_goals(target_date)`,
      `CREATE INDEX IF NOT EXISTS idx_care_plan_interventions_care_plan_id ON care_plan_interventions(care_plan_id)`,
      `CREATE INDEX IF NOT EXISTS idx_care_plan_interventions_goal_id ON care_plan_interventions(goal_id)`,
      `CREATE INDEX IF NOT EXISTS idx_care_plan_interventions_status ON care_plan_interventions(status)`,
      `CREATE INDEX IF NOT EXISTS idx_care_plan_interventions_assigned_to ON care_plan_interventions(assigned_to)`,
      `CREATE INDEX IF NOT EXISTS idx_care_plan_progress_care_plan_id ON care_plan_progress_log(care_plan_id)`,
      `CREATE INDEX IF NOT EXISTS idx_care_plan_progress_goal_id ON care_plan_progress_log(goal_id)`,
      `CREATE INDEX IF NOT EXISTS idx_care_plan_progress_date ON care_plan_progress_log(progress_date)`,
      `CREATE INDEX IF NOT EXISTS idx_care_plan_outcomes_care_plan_id ON care_plan_outcomes(care_plan_id)`,
      `CREATE INDEX IF NOT EXISTS idx_care_plan_outcomes_date ON care_plan_outcomes(outcome_date)`,
    ];

    // Execute each statement
    for (let i = 0; i < sqlStatements.length; i++) {
      const statement = sqlStatements[i];
      console.log(`Executing statement ${i + 1}/${sqlStatements.length}...`);
      await tenantDataSource.query(statement);
      console.log(`✅ Statement ${i + 1} completed`);
    }

    console.log('\n✅ All tables created successfully!\n');

    // Step 3: Record version
    console.log('Step 3: Recording version...');
    await tenantDataSource.query(`
      INSERT INTO tenant_schema_versions (bundle_id, version, applied_at, applied_by)
      VALUES ('sprint17_care_plans', '2025.12.02', NOW(), 'force_create_script')
    `);
    console.log('✅ Version recorded\n');

    await tenantDataSource.destroy();
    await masterClient.end();

    console.log('🎉 Sprint 17 Care Plan tables created successfully!\n');

  } catch (error) {
    console.error('❌ Script failed:', error);
    throw error;
  }
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});

