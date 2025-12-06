import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

async function seedMessageTemplates() {
  const tenantSlug = 'bulawayo-general';
  const tenantDbName = `tenant_${tenantSlug.replace(/-/g, '_')}`;

  console.log(`\n📧 Seeding Message Templates for tenant: ${tenantSlug}`);
  console.log(`📦 Database: ${tenantDbName}\n`);

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'medicore',
    password: process.env.DB_PASSWORD || 'medicore_password',
    database: tenantDbName,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Connected to tenant database\n');

    // Check if templates already exist
    const existingTemplates = await dataSource.query(
      `SELECT COUNT(*) as count FROM message_templates`
    );

    if (parseInt(existingTemplates[0].count) > 0) {
      console.log(`⚠️  Found ${existingTemplates[0].count} existing templates. Skipping seed.`);
      console.log('   To re-seed, delete existing templates first.\n');
      return;
    }

    const templates = [
      {
        name: 'Lab Result Alert - Normal',
        category: 'lab_result',
        subject_template: 'Lab Results Available: {{test_name}} for {{patient_name}}',
        message_template: `Hello {{recipient_name}},

Lab results for {{patient_name}} are now available:

Test: {{test_name}}
Status: {{result_status}}
Date: {{test_date}}

Please review the results at your earliest convenience.

Best regards,
{{sender_name}}`,
        variables: ['recipient_name', 'patient_name', 'test_name', 'result_status', 'test_date', 'sender_name'],
        is_default: true,
      },
      {
        name: 'Lab Result Alert - Critical',
        category: 'urgent_alert',
        subject_template: '🚨 CRITICAL: {{test_name}} for {{patient_name}}',
        message_template: `⚠️ URGENT ATTENTION REQUIRED

Patient: {{patient_name}}
Test: {{test_name}}
Critical Value: {{critical_value}}
Normal Range: {{normal_range}}

Immediate action may be required. Please review and respond.

Sent by: {{sender_name}}
Time: {{timestamp}}`,
        variables: ['patient_name', 'test_name', 'critical_value', 'normal_range', 'sender_name', 'timestamp'],
        is_default: true,
      },
      {
        name: 'Consultation Request',
        category: 'consultation',
        subject_template: 'Consultation Request: {{patient_name}} - {{specialty}}',
        message_template: `Dear {{recipient_name}},

I would like to request a consultation for the following patient:

Patient: {{patient_name}}
Age: {{patient_age}}
Reason: {{consultation_reason}}
Urgency: {{urgency_level}}

Current Diagnosis: {{current_diagnosis}}
Current Treatment: {{current_treatment}}

Please let me know your availability.

Thank you,
{{sender_name}}`,
        variables: ['recipient_name', 'patient_name', 'patient_age', 'specialty', 'consultation_reason', 'urgency_level', 'current_diagnosis', 'current_treatment', 'sender_name'],
        is_default: true,
      },
      {
        name: 'Referral Request',
        category: 'referral',
        subject_template: 'Referral Request: {{patient_name}} to {{specialty}}',
        message_template: `Dear Colleague,

I am referring the following patient for {{specialty}} evaluation:

Patient: {{patient_name}}
DOB: {{patient_dob}}
Reason for Referral: {{referral_reason}}

Clinical Summary:
{{clinical_summary}}

Relevant Investigations:
{{investigations}}

Please contact me if you need additional information.

Best regards,
{{sender_name}}
{{sender_contact}}`,
        variables: ['patient_name', 'patient_dob', 'specialty', 'referral_reason', 'clinical_summary', 'investigations', 'sender_name', 'sender_contact'],
        is_default: true,
      },
      {
        name: 'Follow-up Reminder',
        category: 'follow_up',
        subject_template: 'Follow-up Required: {{patient_name}}',
        message_template: `Hello {{recipient_name}},

This is a reminder that {{patient_name}} requires follow-up:

Last Visit: {{last_visit_date}}
Follow-up Due: {{followup_due_date}}
Reason: {{followup_reason}}

Please schedule an appointment or contact the patient.

{{sender_name}}`,
        variables: ['recipient_name', 'patient_name', 'last_visit_date', 'followup_due_date', 'followup_reason', 'sender_name'],
        is_default: false,
      },
      {
        name: 'Medication Clarification',
        category: 'general',
        subject_template: 'Medication Query: {{patient_name}}',
        message_template: `Hello {{recipient_name}},

I need clarification regarding medication for {{patient_name}}:

Medication: {{medication_name}}
Question: {{question}}

Patient Context:
{{patient_context}}

Please advise when possible.

Thank you,
{{sender_name}}`,
        variables: ['recipient_name', 'patient_name', 'medication_name', 'question', 'patient_context', 'sender_name'],
        is_default: false,
      },
      {
        name: 'Discharge Coordination',
        category: 'general',
        subject_template: 'Discharge Planning: {{patient_name}}',
        message_template: `Hello Team,

Patient {{patient_name}} is being prepared for discharge:

Expected Discharge Date: {{discharge_date}}
Discharge Destination: {{discharge_destination}}

Pending Tasks:
{{pending_tasks}}

Discharge Instructions:
{{discharge_instructions}}

Please coordinate accordingly.

{{sender_name}}`,
        variables: ['patient_name', 'discharge_date', 'discharge_destination', 'pending_tasks', 'discharge_instructions', 'sender_name'],
        is_default: false,
      },
      {
        name: 'Urgent Patient Status Change',
        category: 'urgent_alert',
        subject_template: '⚠️ URGENT: Status Change - {{patient_name}}',
        message_template: `URGENT NOTIFICATION

Patient: {{patient_name}}
Location: {{location}}
Status Change: {{status_change}}

Details:
{{details}}

Immediate attention required.

Reported by: {{sender_name}}
Time: {{timestamp}}`,
        variables: ['patient_name', 'location', 'status_change', 'details', 'sender_name', 'timestamp'],
        is_default: true,
      },
      {
        name: 'Handover Note',
        category: 'general',
        subject_template: 'Handover: {{patient_name}}',
        message_template: `Handover Note

Patient: {{patient_name}}
Current Status: {{current_status}}

Active Issues:
{{active_issues}}

Pending Orders:
{{pending_orders}}

Special Instructions:
{{special_instructions}}

Contact me if you have questions.

{{sender_name}}`,
        variables: ['patient_name', 'current_status', 'active_issues', 'pending_orders', 'special_instructions', 'sender_name'],
        is_default: false,
      },
      {
        name: 'Test Result Discussion',
        category: 'consultation',
        subject_template: 'Discussion Needed: {{test_name}} for {{patient_name}}',
        message_template: `Hello {{recipient_name}},

I would like to discuss the following test results:

Patient: {{patient_name}}
Test: {{test_name}}
Result: {{result_summary}}

Questions/Concerns:
{{questions}}

When would be a good time to discuss?

{{sender_name}}`,
        variables: ['recipient_name', 'patient_name', 'test_name', 'result_summary', 'questions', 'sender_name'],
        is_default: false,
      },
    ];

    console.log('📋 Inserting message templates...\n');

    for (const template of templates) {
      await dataSource.query(
        `INSERT INTO message_templates (
          name, category, subject_template, message_template, 
          variables, is_default, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          template.name,
          template.category,
          template.subject_template,
          template.message_template,
          JSON.stringify(template.variables),
          template.is_default,
          true,
        ]
      );
      console.log(`  ✅ ${template.name} (${template.category})`);
    }

    console.log(`\n🎉 Successfully seeded ${templates.length} message templates!\n`);
    console.log('📊 Template Summary:');
    console.log(`  - Lab Result: 2 templates`);
    console.log(`  - Consultation: 2 templates`);
    console.log(`  - Referral: 1 template`);
    console.log(`  - Follow-up: 1 template`);
    console.log(`  - Urgent Alert: 2 templates`);
    console.log(`  - General: 3 templates\n`);

  } catch (error) {
    console.error('❌ Error seeding templates:', error);
    throw error;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('✅ Database connection closed');
    }
  }
}

seedMessageTemplates()
  .then(() => {
    console.log('\n✅ Seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  });


import { config } from 'dotenv';

config();

async function seedMessageTemplates() {
  const tenantSlug = 'bulawayo-general';
  const tenantDbName = `tenant_${tenantSlug.replace(/-/g, '_')}`;

  console.log(`\n📧 Seeding Message Templates for tenant: ${tenantSlug}`);
  console.log(`📦 Database: ${tenantDbName}\n`);

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'medicore',
    password: process.env.DB_PASSWORD || 'medicore_password',
    database: tenantDbName,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Connected to tenant database\n');

    // Check if templates already exist
    const existingTemplates = await dataSource.query(
      `SELECT COUNT(*) as count FROM message_templates`
    );

    if (parseInt(existingTemplates[0].count) > 0) {
      console.log(`⚠️  Found ${existingTemplates[0].count} existing templates. Skipping seed.`);
      console.log('   To re-seed, delete existing templates first.\n');
      return;
    }

    const templates = [
      {
        name: 'Lab Result Alert - Normal',
        category: 'lab_result',
        subject_template: 'Lab Results Available: {{test_name}} for {{patient_name}}',
        message_template: `Hello {{recipient_name}},

Lab results for {{patient_name}} are now available:

Test: {{test_name}}
Status: {{result_status}}
Date: {{test_date}}

Please review the results at your earliest convenience.

Best regards,
{{sender_name}}`,
        variables: ['recipient_name', 'patient_name', 'test_name', 'result_status', 'test_date', 'sender_name'],
        is_default: true,
      },
      {
        name: 'Lab Result Alert - Critical',
        category: 'urgent_alert',
        subject_template: '🚨 CRITICAL: {{test_name}} for {{patient_name}}',
        message_template: `⚠️ URGENT ATTENTION REQUIRED

Patient: {{patient_name}}
Test: {{test_name}}
Critical Value: {{critical_value}}
Normal Range: {{normal_range}}

Immediate action may be required. Please review and respond.

Sent by: {{sender_name}}
Time: {{timestamp}}`,
        variables: ['patient_name', 'test_name', 'critical_value', 'normal_range', 'sender_name', 'timestamp'],
        is_default: true,
      },
      {
        name: 'Consultation Request',
        category: 'consultation',
        subject_template: 'Consultation Request: {{patient_name}} - {{specialty}}',
        message_template: `Dear {{recipient_name}},

I would like to request a consultation for the following patient:

Patient: {{patient_name}}
Age: {{patient_age}}
Reason: {{consultation_reason}}
Urgency: {{urgency_level}}

Current Diagnosis: {{current_diagnosis}}
Current Treatment: {{current_treatment}}

Please let me know your availability.

Thank you,
{{sender_name}}`,
        variables: ['recipient_name', 'patient_name', 'patient_age', 'specialty', 'consultation_reason', 'urgency_level', 'current_diagnosis', 'current_treatment', 'sender_name'],
        is_default: true,
      },
      {
        name: 'Referral Request',
        category: 'referral',
        subject_template: 'Referral Request: {{patient_name}} to {{specialty}}',
        message_template: `Dear Colleague,

I am referring the following patient for {{specialty}} evaluation:

Patient: {{patient_name}}
DOB: {{patient_dob}}
Reason for Referral: {{referral_reason}}

Clinical Summary:
{{clinical_summary}}

Relevant Investigations:
{{investigations}}

Please contact me if you need additional information.

Best regards,
{{sender_name}}
{{sender_contact}}`,
        variables: ['patient_name', 'patient_dob', 'specialty', 'referral_reason', 'clinical_summary', 'investigations', 'sender_name', 'sender_contact'],
        is_default: true,
      },
      {
        name: 'Follow-up Reminder',
        category: 'follow_up',
        subject_template: 'Follow-up Required: {{patient_name}}',
        message_template: `Hello {{recipient_name}},

This is a reminder that {{patient_name}} requires follow-up:

Last Visit: {{last_visit_date}}
Follow-up Due: {{followup_due_date}}
Reason: {{followup_reason}}

Please schedule an appointment or contact the patient.

{{sender_name}}`,
        variables: ['recipient_name', 'patient_name', 'last_visit_date', 'followup_due_date', 'followup_reason', 'sender_name'],
        is_default: false,
      },
      {
        name: 'Medication Clarification',
        category: 'general',
        subject_template: 'Medication Query: {{patient_name}}',
        message_template: `Hello {{recipient_name}},

I need clarification regarding medication for {{patient_name}}:

Medication: {{medication_name}}
Question: {{question}}

Patient Context:
{{patient_context}}

Please advise when possible.

Thank you,
{{sender_name}}`,
        variables: ['recipient_name', 'patient_name', 'medication_name', 'question', 'patient_context', 'sender_name'],
        is_default: false,
      },
      {
        name: 'Discharge Coordination',
        category: 'general',
        subject_template: 'Discharge Planning: {{patient_name}}',
        message_template: `Hello Team,

Patient {{patient_name}} is being prepared for discharge:

Expected Discharge Date: {{discharge_date}}
Discharge Destination: {{discharge_destination}}

Pending Tasks:
{{pending_tasks}}

Discharge Instructions:
{{discharge_instructions}}

Please coordinate accordingly.

{{sender_name}}`,
        variables: ['patient_name', 'discharge_date', 'discharge_destination', 'pending_tasks', 'discharge_instructions', 'sender_name'],
        is_default: false,
      },
      {
        name: 'Urgent Patient Status Change',
        category: 'urgent_alert',
        subject_template: '⚠️ URGENT: Status Change - {{patient_name}}',
        message_template: `URGENT NOTIFICATION

Patient: {{patient_name}}
Location: {{location}}
Status Change: {{status_change}}

Details:
{{details}}

Immediate attention required.

Reported by: {{sender_name}}
Time: {{timestamp}}`,
        variables: ['patient_name', 'location', 'status_change', 'details', 'sender_name', 'timestamp'],
        is_default: true,
      },
      {
        name: 'Handover Note',
        category: 'general',
        subject_template: 'Handover: {{patient_name}}',
        message_template: `Handover Note

Patient: {{patient_name}}
Current Status: {{current_status}}

Active Issues:
{{active_issues}}

Pending Orders:
{{pending_orders}}

Special Instructions:
{{special_instructions}}

Contact me if you have questions.

{{sender_name}}`,
        variables: ['patient_name', 'current_status', 'active_issues', 'pending_orders', 'special_instructions', 'sender_name'],
        is_default: false,
      },
      {
        name: 'Test Result Discussion',
        category: 'consultation',
        subject_template: 'Discussion Needed: {{test_name}} for {{patient_name}}',
        message_template: `Hello {{recipient_name}},

I would like to discuss the following test results:

Patient: {{patient_name}}
Test: {{test_name}}
Result: {{result_summary}}

Questions/Concerns:
{{questions}}

When would be a good time to discuss?

{{sender_name}}`,
        variables: ['recipient_name', 'patient_name', 'test_name', 'result_summary', 'questions', 'sender_name'],
        is_default: false,
      },
    ];

    console.log('📋 Inserting message templates...\n');

    for (const template of templates) {
      await dataSource.query(
        `INSERT INTO message_templates (
          name, category, subject_template, message_template, 
          variables, is_default, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          template.name,
          template.category,
          template.subject_template,
          template.message_template,
          JSON.stringify(template.variables),
          template.is_default,
          true,
        ]
      );
      console.log(`  ✅ ${template.name} (${template.category})`);
    }

    console.log(`\n🎉 Successfully seeded ${templates.length} message templates!\n`);
    console.log('📊 Template Summary:');
    console.log(`  - Lab Result: 2 templates`);
    console.log(`  - Consultation: 2 templates`);
    console.log(`  - Referral: 1 template`);
    console.log(`  - Follow-up: 1 template`);
    console.log(`  - Urgent Alert: 2 templates`);
    console.log(`  - General: 3 templates\n`);

  } catch (error) {
    console.error('❌ Error seeding templates:', error);
    throw error;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('✅ Database connection closed');
    }
  }
}

seedMessageTemplates()
  .then(() => {
    console.log('\n✅ Seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  });





