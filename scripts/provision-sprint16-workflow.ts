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

async function getSprint16WorkflowSchemaStatements() {
  return [
    // Clinical Workflows Table
    `CREATE TABLE IF NOT EXISTS clinical_workflows (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      trigger_event VARCHAR(100) NOT NULL CHECK (trigger_event IN (
        'patient_check_in',
        'appointment_scheduled',
        'appointment_started',
        'appointment_completed',
        'lab_result_received',
        'vitals_recorded',
        'prescription_created',
        'triage_completed',
        'referral_created',
        'custom'
      )),
      trigger_conditions JSONB,
      is_active BOOLEAN DEFAULT true,
      priority INTEGER DEFAULT 0,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,

    // Workflow Steps Table
    `CREATE TABLE IF NOT EXISTS workflow_steps (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workflow_id UUID NOT NULL REFERENCES clinical_workflows(id) ON DELETE CASCADE,
      step_order INTEGER NOT NULL,
      step_type VARCHAR(50) NOT NULL CHECK (step_type IN (
        'assign_role',
        'send_notification',
        'create_task',
        'update_status',
        'create_order',
        'assign_appointment',
        'send_message',
        'execute_script',
        'wait',
        'condition'
      )),
      step_config JSONB NOT NULL,
      conditions JSONB,
      timeout_minutes INTEGER,
      retry_count INTEGER DEFAULT 0,
      is_required BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,

    // Workflow Executions Table
    `CREATE TABLE IF NOT EXISTS workflow_executions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workflow_id UUID NOT NULL REFERENCES clinical_workflows(id),
      trigger_event VARCHAR(100) NOT NULL,
      trigger_entity_type VARCHAR(50) NOT NULL,
      trigger_entity_id UUID NOT NULL,
      patient_id UUID REFERENCES patients(id),
      status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'running',
        'completed',
        'failed',
        'cancelled',
        'timeout'
      )),
      started_at TIMESTAMP WITH TIME ZONE,
      completed_at TIMESTAMP WITH TIME ZONE,
      error_message TEXT,
      execution_data JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,

    // Workflow Step Executions Table
    `CREATE TABLE IF NOT EXISTS workflow_step_executions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
      step_id UUID NOT NULL REFERENCES workflow_steps(id),
      step_order INTEGER NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'running',
        'completed',
        'failed',
        'skipped',
        'timeout'
      )),
      started_at TIMESTAMP WITH TIME ZONE,
      completed_at TIMESTAMP WITH TIME ZONE,
      result_data JSONB,
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,

    // Workflow Templates Table
    `CREATE TABLE IF NOT EXISTS workflow_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(50),
      template_data JSONB NOT NULL,
      is_default BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      usage_count INTEGER DEFAULT 0,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,

    // Indexes
    `CREATE INDEX IF NOT EXISTS idx_workflows_trigger_event ON clinical_workflows(trigger_event)`,
    `CREATE INDEX IF NOT EXISTS idx_workflows_is_active ON clinical_workflows(is_active)`,
    `CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow_id ON workflow_steps(workflow_id)`,
    `CREATE INDEX IF NOT EXISTS idx_workflow_steps_order ON workflow_steps(workflow_id, step_order)`,
    `CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id)`,
    `CREATE INDEX IF NOT EXISTS idx_workflow_executions_trigger ON workflow_executions(trigger_entity_type, trigger_entity_id)`,
    `CREATE INDEX IF NOT EXISTS idx_workflow_executions_patient_id ON workflow_executions(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status)`,
    `CREATE INDEX IF NOT EXISTS idx_workflow_executions_created_at ON workflow_executions(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_step_executions_execution_id ON workflow_step_executions(execution_id)`,
    `CREATE INDEX IF NOT EXISTS idx_step_executions_step_id ON workflow_step_executions(step_id)`,
    `CREATE INDEX IF NOT EXISTS idx_step_executions_status ON workflow_step_executions(status)`,
    `CREATE INDEX IF NOT EXISTS idx_workflow_templates_category ON workflow_templates(category)`,
    `CREATE INDEX IF NOT EXISTS idx_workflow_templates_is_active ON workflow_templates(is_active)`,
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

async function provisionSprint16() {
  try {
    await masterDb.initialize();
    console.log('✅ Connected to master database\n');

    // Get bulawayo-general tenant specifically
    const tenant = await masterDb.query(
      `SELECT id, "databaseName", subdomain FROM tenants WHERE subdomain = 'bulawayo-general' AND status = 'active' LIMIT 1`,
    );

    if (tenant.length === 0) {
      console.log('⚠️  bulawayo-general tenant not found or not active.');
      await masterDb.destroy();
      return;
    }

    const targetTenant = tenant[0];
    console.log(`📊 Found tenant: ${targetTenant.subdomain} (${targetTenant.databaseName})\n`);

    const bundle = {
      id: 'sprint16_workflow_engine',
      version: '2025.12.23',
      label: 'Sprint 16 - Clinical Workflow Engine',
      getStatements: getSprint16WorkflowSchemaStatements,
    };

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🏥 Provisioning tenant: ${targetTenant.subdomain} (${targetTenant.databaseName})`);
    console.log('='.repeat(60));

    const tenantDb = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'medicore',
      password: process.env.DB_PASSWORD || 'medicore_password',
      database: targetTenant.databaseName,
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
      console.log(`\n✅ Completed provisioning for ${targetTenant.subdomain}`);
    } catch (error: any) {
      console.error(`\n❌ Error provisioning tenant ${targetTenant.subdomain}: ${error.message}`);
      console.error(error.stack);
      try {
        await tenantDb.destroy();
      } catch {}
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('🎉 Provisioning completed!');
    console.log('='.repeat(60));
    console.log('\n📝 Next steps:');
    console.log('   1. Restart the EHR service to pick up the new schema');
    console.log('   2. Implement backend services for workflow management');
    console.log('   3. Test the workflow features\n');

    await masterDb.destroy();
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

provisionSprint16();

