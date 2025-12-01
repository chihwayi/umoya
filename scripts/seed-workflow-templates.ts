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

async function seedWorkflowTemplates() {
  try {
    await masterDb.initialize();
    console.log('✅ Connected to master database\n');

    // Get bulawayo-general tenant
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

    const tenantDb = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'medicore',
      password: process.env.DB_PASSWORD || 'medicore_password',
      database: targetTenant.databaseName,
    });

    await tenantDb.initialize();

    // Default workflow templates
    const templates = [
      {
        name: 'Patient Check-In Workflow',
        description: 'Automatically assigns patient to triage, notifies nurse, creates vitals task, and updates appointment status',
        category: 'triage',
        template_data: {
          name: 'Patient Check-In Workflow',
          description: 'Automatically assigns patient to triage, notifies nurse, creates vitals task, and updates appointment status',
          triggerEvent: 'patient_check_in',
          triggerConditions: {},
          is_active: true,
          priority: 10,
          steps: [
            {
              step_type: 'assign_role',
              step_config: {
                role: 'nurse',
                entityType: 'appointment',
                entityId: '{{trigger.entityId}}',
              },
              is_required: true,
            },
            {
              step_type: 'send_notification',
              step_config: {
                userIds: ['{{trigger.data.doctorId}}'],
                message: 'Patient {{trigger.patientId}} has checked in and is ready for triage',
                priority: 'normal',
              },
              is_required: false,
            },
            {
              step_type: 'create_task',
              step_config: {
                assignedTo: '{{trigger.data.doctorId}}',
                title: 'Record Vitals for Checked-In Patient',
                description: 'Patient has checked in - please record vitals',
              },
              is_required: false,
            },
            {
              step_type: 'update_status',
              step_config: {
                entityType: 'appointments',
                entityId: '{{trigger.entityId}}',
                status: 'confirmed',
              },
              is_required: true,
            },
          ],
        },
        is_default: true,
        is_active: true,
      },
      {
        name: 'Urgent Appointment Workflow',
        description: 'For urgent appointments - immediately notifies doctor, creates preparation task, and sends patient reminder',
        category: 'appointment',
        template_data: {
          name: 'Urgent Appointment Workflow',
          description: 'For urgent appointments - immediately notifies doctor, creates preparation task, and sends patient reminder',
          triggerEvent: 'appointment_scheduled',
          triggerConditions: { priority: 'urgent' },
          is_active: true,
          priority: 20,
          steps: [
            {
              step_type: 'send_notification',
              step_config: {
                userIds: ['{{trigger.data.doctorId}}'],
                message: 'URGENT: Appointment scheduled for patient {{trigger.patientId}}',
                priority: 'urgent',
              },
              is_required: true,
            },
            {
              step_type: 'create_task',
              step_config: {
                assignedTo: '{{trigger.data.doctorId}}',
                title: 'Prepare for Urgent Appointment',
                description: 'Urgent appointment scheduled - review patient history and prepare',
              },
              is_required: false,
            },
          ],
        },
        is_default: true,
        is_active: true,
      },
      {
        name: 'Lab Result Received Workflow',
        description: 'When critical lab results are received - alerts doctor, creates review task, and notifies patient if configured',
        category: 'lab',
        template_data: {
          name: 'Lab Result Received Workflow',
          description: 'When critical lab results are received - alerts doctor, creates review task, and notifies patient if configured',
          triggerEvent: 'lab_result_received',
          triggerConditions: { hasCriticalValues: true },
          is_active: true,
          priority: 30,
          steps: [
            {
              step_type: 'send_notification',
              step_config: {
                userIds: ['{{trigger.data.orderingProviderId}}'],
                message: 'CRITICAL: Lab results received for patient {{trigger.patientId}}',
                priority: 'urgent',
              },
              is_required: true,
            },
            {
              step_type: 'create_task',
              step_config: {
                assignedTo: '{{trigger.data.orderingProviderId}}',
                title: 'Review Critical Lab Results',
                description: 'Critical lab results require immediate review',
              },
              is_required: true,
            },
          ],
        },
        is_default: true,
        is_active: true,
      },
      {
        name: 'Discharge Workflow',
        description: 'When appointment is completed - generates discharge summary, creates follow-up appointment, and sends instructions',
        category: 'discharge',
        template_data: {
          name: 'Discharge Workflow',
          description: 'When appointment is completed - generates discharge summary, creates follow-up appointment, and sends instructions',
          triggerEvent: 'appointment_completed',
          triggerConditions: { appointmentType: 'discharge' },
          is_active: true,
          priority: 5,
          steps: [
            {
              step_type: 'create_task',
              step_config: {
                assignedTo: '{{trigger.data.doctorId}}',
                title: 'Generate Discharge Summary',
                description: 'Complete discharge documentation for patient',
              },
              is_required: true,
            },
            {
              step_type: 'send_message',
              step_config: {
                recipientId: '{{trigger.patientId}}',
                subject: 'Discharge Instructions',
                message: 'Your discharge instructions are ready. Please review and follow up as directed.',
              },
              is_required: false,
            },
          ],
        },
        is_default: true,
        is_active: true,
      },
    ];

    console.log(`📦 Seeding ${templates.length} workflow templates...\n`);

    for (const template of templates) {
      // Check if template already exists
      const existing = await tenantDb.query(
        `SELECT id FROM workflow_templates WHERE name = $1`,
        [template.name],
      );

      if (existing.length > 0) {
        console.log(`  ⏭️  Template "${template.name}" already exists, skipping`);
        continue;
      }

      // Insert template
      await tenantDb.query(
        `INSERT INTO workflow_templates (name, description, category, template_data, is_default, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [
          template.name,
          template.description,
          template.category,
          JSON.stringify(template.template_data),
          template.is_default,
          template.is_active,
        ],
      );

      console.log(`  ✅ Created template: "${template.name}"`);
    }

    console.log(`\n✅ Successfully seeded ${templates.length} workflow templates!`);
    console.log('\n📝 Next steps:');
    console.log('   1. Restart the EHR service');
    console.log('   2. Access Workflows from Doctor Dashboard');
    console.log('   3. Create workflows from templates or create custom ones\n');

    await tenantDb.destroy();
    await masterDb.destroy();
  } catch (error: any) {
    console.error('\n❌ Error seeding workflow templates:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

seedWorkflowTemplates();

