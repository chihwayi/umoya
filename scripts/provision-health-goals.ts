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

async function provisionHealthGoals() {
  try {
    await masterDb.initialize();
    console.log('Connected to master database');

    // Get all active tenants
    const tenants = await masterDb.query(
      `SELECT id, "databaseName", subdomain FROM tenants WHERE status = 'active'`
    );

    console.log(`Found ${tenants.length} active tenants`);

    for (const tenant of tenants) {
      console.log(`\nProvisioning health goals schema for tenant: ${tenant.subdomain} (${tenant.databaseName})`);

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

        // Check if schema version table exists
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
          ['sprint13_7_health_goals', '2025.12.21']
        );

        if (existing.length > 0) {
          console.log(`  ✓ Schema already applied, skipping`);
          await tenantDb.destroy();
          continue;
        }

        // Apply schema
        const statements = [
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

          // Indexes
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

        for (const statement of statements) {
          try {
            await tenantDb.query(statement);
          } catch (error: any) {
            console.error(`  ✗ Error executing statement: ${error.message}`);
            throw error;
          }
        }

        // Record schema version
        await tenantDb.query(
          `INSERT INTO schema_versions (bundle_id, version, applied_by) VALUES ($1, $2, $3)`,
          ['sprint13_7_health_goals', '2025.12.21', 'provisioning_script']
        );

        console.log(`  ✓ Health goals schema applied successfully`);

        await tenantDb.destroy();
      } catch (error: any) {
        console.error(`  ✗ Error provisioning tenant ${tenant.subdomain}: ${error.message}`);
        try {
          await tenantDb.destroy();
        } catch {}
      }
    }

    console.log('\n✓ Health goals provisioning completed');
    await masterDb.destroy();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

provisionHealthGoals();

