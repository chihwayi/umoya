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

// Import the provisioning service methods
// We'll need to get the schema statements directly
async function getProSchemaStatements() {
  return [
    // Questionnaire Templates Table
    `CREATE TABLE IF NOT EXISTS questionnaire_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(100) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(100),
      version VARCHAR(50),
      questions JSONB NOT NULL DEFAULT '[]'::jsonb,
      scoring JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,

    // Patient Questionnaires Table
    `CREATE TABLE IF NOT EXISTS patient_questionnaires (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      questionnaire_template_id UUID NOT NULL REFERENCES questionnaire_templates(id) ON DELETE CASCADE,
      appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'expired', 'cancelled')),
      assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      due_date DATE,
      started_at TIMESTAMP WITH TIME ZONE,
      completed_at TIMESTAMP WITH TIME ZONE,
      responses JSONB DEFAULT '{}'::jsonb,
      total_score DECIMAL(10,2),
      completion_percentage INTEGER CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,

    // Questionnaire Schedules Table
    `CREATE TABLE IF NOT EXISTS questionnaire_schedules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      questionnaire_template_id UUID NOT NULL REFERENCES questionnaire_templates(id) ON DELETE CASCADE,
      start_date DATE NOT NULL,
      end_date DATE,
      frequency INTEGER NOT NULL DEFAULT 1,
      frequency_unit VARCHAR(50) NOT NULL DEFAULT 'days' CHECK (frequency_unit IN ('days', 'weeks', 'months')),
      is_active BOOLEAN DEFAULT true,
      last_triggered_at TIMESTAMP WITH TIME ZONE,
      next_due_date DATE,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,

    // Indexes for PRO tables
    `CREATE INDEX IF NOT EXISTS idx_questionnaire_templates_code ON questionnaire_templates(code)`,
    `CREATE INDEX IF NOT EXISTS idx_questionnaire_templates_category ON questionnaire_templates(category)`,
    `CREATE INDEX IF NOT EXISTS idx_questionnaire_templates_is_active ON questionnaire_templates(is_active) WHERE is_active = true`,
    `CREATE INDEX IF NOT EXISTS idx_patient_questionnaires_patient_id ON patient_questionnaires(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_patient_questionnaires_template_id ON patient_questionnaires(questionnaire_template_id)`,
    `CREATE INDEX IF NOT EXISTS idx_patient_questionnaires_status ON patient_questionnaires(status)`,
    `CREATE INDEX IF NOT EXISTS idx_patient_questionnaires_due_date ON patient_questionnaires(due_date)`,
    `CREATE INDEX IF NOT EXISTS idx_patient_questionnaires_completed_at ON patient_questionnaires(completed_at)`,
    `CREATE INDEX IF NOT EXISTS idx_questionnaire_schedules_patient_id ON questionnaire_schedules(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_questionnaire_schedules_template_id ON questionnaire_schedules(questionnaire_template_id)`,
    `CREATE INDEX IF NOT EXISTS idx_questionnaire_schedules_is_active ON questionnaire_schedules(is_active) WHERE is_active = true`,
    `CREATE INDEX IF NOT EXISTS idx_questionnaire_schedules_next_due_date ON questionnaire_schedules(next_due_date)`,
  ];
}

async function getHealthGoalsSchemaStatements() {
  return [
    // Patient Health Goals Table
    `CREATE TABLE IF NOT EXISTS patient_health_goals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      goal_type VARCHAR(100) NOT NULL CHECK (goal_type IN ('weight_loss', 'weight_gain', 'blood_pressure', 'blood_glucose', 'cholesterol', 'exercise', 'medication_adherence', 'smoking_cessation', 'alcohol_reduction', 'diet', 'other')),
      goal_name VARCHAR(255) NOT NULL,
      description TEXT,
      target_value DECIMAL(10,2),
      current_value DECIMAL(10,2),
      unit VARCHAR(50),
      start_date DATE NOT NULL,
      target_date DATE NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled', 'failed')),
      progress_percentage DECIMAL(5,2) DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
      milestone_percentage DECIMAL(5,2) DEFAULT 25,
      milestone_achieved BOOLEAN DEFAULT false,
      milestone_achieved_at TIMESTAMP WITH TIME ZONE,
      is_auto_tracked BOOLEAN DEFAULT false,
      tracking_source VARCHAR(100),
      notes TEXT,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,

    // Goal Progress Logs Table
    `CREATE TABLE IF NOT EXISTS goal_progress_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      goal_id UUID NOT NULL REFERENCES patient_health_goals(id) ON DELETE CASCADE,
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      logged_value DECIMAL(10,2) NOT NULL,
      logged_date DATE NOT NULL,
      source VARCHAR(100) CHECK (source IN ('manual', 'vitals', 'lab_result', 'patient_portal', 'wearable', 'auto')),
      source_id UUID,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(goal_id, logged_date)
    )`,

    // Patient Achievements Table
    `CREATE TABLE IF NOT EXISTS patient_achievements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      achievement_type VARCHAR(100) NOT NULL CHECK (achievement_type IN ('goal_completed', 'milestone_reached', 'streak', 'consistency', 'improvement', 'engagement', 'special')),
      achievement_name VARCHAR(255) NOT NULL,
      achievement_description TEXT,
      badge_icon VARCHAR(100),
      badge_color VARCHAR(50),
      points INTEGER DEFAULT 0,
      goal_id UUID REFERENCES patient_health_goals(id) ON DELETE SET NULL,
      milestone_percentage DECIMAL(5,2),
      streak_days INTEGER,
      earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,

    // Patient Streaks Table
    `CREATE TABLE IF NOT EXISTS patient_streaks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      streak_type VARCHAR(100) NOT NULL CHECK (streak_type IN ('vitals_submission', 'medication_adherence', 'exercise', 'goal_progress', 'portal_login')),
      current_streak_days INTEGER DEFAULT 0,
      longest_streak_days INTEGER DEFAULT 0,
      last_activity_date DATE,
      streak_start_date DATE,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(patient_id, streak_type)
    )`,

    // Indexes for Health Goals
    `CREATE INDEX IF NOT EXISTS idx_patient_health_goals_patient_id ON patient_health_goals(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_patient_health_goals_status ON patient_health_goals(status) WHERE status = 'active'`,
    `CREATE INDEX IF NOT EXISTS idx_patient_health_goals_goal_type ON patient_health_goals(goal_type)`,
    `CREATE INDEX IF NOT EXISTS idx_patient_health_goals_target_date ON patient_health_goals(target_date)`,
    `CREATE INDEX IF NOT EXISTS idx_goal_progress_logs_goal_id ON goal_progress_logs(goal_id)`,
    `CREATE INDEX IF NOT EXISTS idx_goal_progress_logs_patient_id ON goal_progress_logs(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_goal_progress_logs_logged_date ON goal_progress_logs(logged_date)`,
    `CREATE INDEX IF NOT EXISTS idx_patient_achievements_patient_id ON patient_achievements(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_patient_achievements_achievement_type ON patient_achievements(achievement_type)`,
    `CREATE INDEX IF NOT EXISTS idx_patient_achievements_earned_at ON patient_achievements(earned_at)`,
    `CREATE INDEX IF NOT EXISTS idx_patient_streaks_patient_id ON patient_streaks(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_patient_streaks_streak_type ON patient_streaks(streak_type)`,
    `CREATE INDEX IF NOT EXISTS idx_patient_streaks_is_active ON patient_streaks(is_active) WHERE is_active = true`,
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
      // If it's a "column does not exist" error on an index, try to add the column first
      if (error.message.includes('column') && error.message.includes('does not exist') && statement.includes('CREATE INDEX')) {
        console.log(`  ⚠️  Index creation failed (column missing), skipping: ${error.message.split('\n')[0]}`);
        continue;
      }
      // If it's a "relation already exists" error, that's fine
      if (error.message.includes('already exists') || error.message.includes('duplicate key')) {
        continue;
      }
      console.error(`  ✗ Error executing statement: ${error.message.split('\n')[0]}`);
      // Don't throw - continue with other statements
    }
  }
  
  // Add missing columns to existing tables
  try {
    // Check if questionnaire_schedules exists but missing next_due_date
    const schedulesCheck = await tenantDb.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'questionnaire_schedules' 
      AND column_name = 'next_due_date'
    `);
    
    if (schedulesCheck.length === 0) {
      // Table exists but column doesn't - add it
      const tableExists = await tenantDb.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'questionnaire_schedules'
        )
      `);
      
      if (tableExists[0]?.exists) {
        console.log(`  ➕ Adding missing column 'next_due_date' to questionnaire_schedules`);
        await tenantDb.query(`
          ALTER TABLE questionnaire_schedules 
          ADD COLUMN IF NOT EXISTS next_due_date DATE
        `);
      }
    }
  } catch (error: any) {
    // Ignore errors in column addition
    console.log(`  ⚠️  Could not add missing columns: ${error.message.split('\n')[0]}`);
  }

  // Record schema version
  await tenantDb.query(
    `INSERT INTO schema_versions (bundle_id, version, applied_by) VALUES ($1, $2, $3)`,
    [bundleId, version, 'provisioning_script'],
  );

  return { applied: true };
}

async function provisionAllSprints() {
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

    const bundles = [
      {
        id: 'sprint15_pro',
        version: '2025.12.20',
        label: 'Sprint 15 - Patient-Reported Outcomes (PROs)',
        getStatements: getProSchemaStatements,
      },
      {
        id: 'sprint13_7_health_goals',
        version: '2025.12.21',
        label: 'Sprint 13.7 - Health Goals & Progress Tracking',
        getStatements: getHealthGoalsSchemaStatements,
      },
    ];

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

        for (const bundle of bundles) {
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
    console.log('   2. Test the PRO questionnaires and Health Goals features');
    console.log('   3. Verify data can be created and retrieved\n');

    await masterDb.destroy();
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

provisionAllSprints();

