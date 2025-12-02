#!/usr/bin/env ts-node
/**
 * Apply Sprint 17 Care Plans Provisioning Bundle
 * 
 * This script applies the sprint17_care_plans bundle to the bulawayo-general tenant
 * using the DatabaseProvisioningService.
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const TENANT_SLUG = 'bulawayo-general';

async function applyProvisioning() {
  console.log(`\n🚀 Applying Sprint 17 Care Plans provisioning to tenant: ${TENANT_SLUG}\n`);

  // Connect directly to tenant database
  const tenantDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'medicore',
    password: process.env.DB_PASSWORD || 'medicore_password',
    database: `medicore_${TENANT_SLUG.replace(/-/g, '_')}`,
  });

  try {
    await tenantDataSource.initialize();
    console.log(`✅ Connected to tenant database\n`);

    // Apply Sprint 17 schema
    console.log('📋 Applying Sprint 17 Care Plans schema...\n');

    const statements = getSprint17Statements();
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement.trim()) continue;
      
      try {
        await tenantDataSource.query(statement);
        console.log(`✅ Statement ${i + 1}/${statements.length} executed`);
      } catch (error: any) {
        console.error(`❌ Error executing statement ${i + 1}:`, error.message);
        throw error;
      }
    }

    console.log('\n🎉 Sprint 17 Care Plans schema applied successfully!\n');

    await tenantDataSource.destroy();
    console.log('✅ Database connection closed\n');

  } catch (error) {
    console.error('❌ Error applying provisioning:', error);
    throw error;
  }
}

function getSprint17Statements(): string[] {
  const statements: string[] = [];

  // Care Plan Templates Table
  statements.push(`
    CREATE TABLE IF NOT EXISTS care_plan_templates (
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
    )
  `);

  // Care Plans Table
  statements.push(`
    CREATE TABLE IF NOT EXISTS care_plans (
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
    )
  `);

  // Care Plan Goals Table
  statements.push(`
    CREATE TABLE IF NOT EXISTS care_plan_goals (
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
    )
  `);

  // Care Plan Interventions Table
  statements.push(`
    CREATE TABLE IF NOT EXISTS care_plan_interventions (
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
    )
  `);

  // Care Plan Progress Log Table
  statements.push(`
    CREATE TABLE IF NOT EXISTS care_plan_progress_log (
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
    )
  `);

  // Care Plan Outcomes Table
  statements.push(`
    CREATE TABLE IF NOT EXISTS care_plan_outcomes (
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
    )
  `);

  // Indexes
  statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plan_templates_category ON care_plan_templates(category)`);
  statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plan_templates_condition ON care_plan_templates(condition_code)`);
  statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plan_templates_is_active ON care_plan_templates(is_active)`);
  statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plans_patient_id ON care_plans(patient_id)`);
  statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plans_status ON care_plans(status)`);
  statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plans_primary_provider ON care_plans(primary_provider_id)`);
  statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plans_start_date ON care_plans(start_date)`);
  statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plan_goals_care_plan_id ON care_plan_goals(care_plan_id)`);
  statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plan_goals_status ON care_plan_goals(status)`);
  statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plan_goals_target_date ON care_plan_goals(target_date)`);
  statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plan_interventions_care_plan_id ON care_plan_interventions(care_plan_id)`);
  statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plan_interventions_goal_id ON care_plan_interventions(goal_id)`);
  statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plan_interventions_status ON care_plan_interventions(status)`);
  statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plan_interventions_assigned_to ON care_plan_interventions(assigned_to)`);
  statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plan_progress_care_plan_id ON care_plan_progress_log(care_plan_id)`);
  statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plan_progress_goal_id ON care_plan_progress_log(goal_id)`);
  statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plan_progress_date ON care_plan_progress_log(progress_date)`);
  statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plan_outcomes_care_plan_id ON care_plan_outcomes(care_plan_id)`);
  statements.push(`CREATE INDEX IF NOT EXISTS idx_care_plan_outcomes_date ON care_plan_outcomes(outcome_date)`);

  return statements;
}

// Run provisioning
applyProvisioning()
  .then(() => {
    console.log('✅ Provisioning completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Provisioning failed:', error);
    process.exit(1);
  });

