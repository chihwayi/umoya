#!/usr/bin/env node
/**
 * Seed Default Care Plan Templates
 * Creates 4 default care plan templates for common conditions
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
    console.log('\n🌱 Seeding Care Plan Templates\n');

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

    // Check if table exists
    const tableCheck = await tenantDataSource.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'care_plan_templates'
      );
    `);
    
    console.log('Table exists check:', tableCheck[0].exists);
    
    if (!tableCheck[0].exists) {
      console.log('⚠️  care_plan_templates table does not exist!');
      console.log('The provisioning bundle may not have been applied correctly.');
      console.log('Please run: node scripts/provision-sprint17-bundle.ts');
      process.exit(1);
    }

    // Define templates
    const templates = [
      {
        name: 'Diabetes Management Plan',
        description: 'Comprehensive care plan for Type 2 Diabetes management',
        category: 'chronic_disease',
        condition_code: '44054006',
        condition_name: 'Type 2 Diabetes Mellitus',
        template_data: {
          name: 'Diabetes Management Plan',
          description: 'Comprehensive care plan for Type 2 Diabetes management',
          category: 'chronic_disease',
          goals: [
            {
              goalText: 'Achieve HbA1c level below 7%',
              goalType: 'clinical',
              targetValue: '< 7%',
              measurementUnit: '%',
              priority: 'high',
            },
            {
              goalText: 'Maintain healthy weight (BMI 18.5-24.9)',
              goalType: 'clinical',
              targetValue: '18.5-24.9',
              measurementUnit: 'BMI',
              priority: 'normal',
            },
            {
              goalText: 'Control blood pressure below 140/90 mmHg',
              goalType: 'clinical',
              targetValue: '< 140/90',
              measurementUnit: 'mmHg',
              priority: 'high',
            },
            {
              goalText: 'Improve diabetes self-management knowledge',
              goalType: 'education',
              priority: 'normal',
            },
          ],
          interventions: [
            {
              interventionText: 'Metformin 500mg twice daily',
              interventionType: 'medication',
              frequency: 'Twice daily',
              duration: 'Ongoing',
              responsibleRole: 'doctor',
            },
            {
              interventionText: 'Dietary counseling - low glycemic index diet',
              interventionType: 'education',
              frequency: 'Monthly',
              duration: '6 months',
              responsibleRole: 'nurse',
            },
            {
              interventionText: 'Exercise program - 30 minutes daily',
              interventionType: 'lifestyle',
              frequency: 'Daily',
              duration: 'Ongoing',
              responsibleRole: 'patient',
            },
            {
              interventionText: 'Blood glucose monitoring',
              interventionType: 'monitoring',
              frequency: 'Twice daily',
              duration: 'Ongoing',
              responsibleRole: 'patient',
            },
            {
              interventionText: 'HbA1c testing',
              interventionType: 'monitoring',
              frequency: 'Every 3 months',
              duration: 'Ongoing',
              responsibleRole: 'doctor',
            },
          ],
        },
      },
      {
        name: 'Hypertension Care Plan',
        description: 'Blood pressure management and cardiovascular risk reduction',
        category: 'chronic_disease',
        condition_code: '38341003',
        condition_name: 'Hypertension',
        template_data: {
          name: 'Hypertension Care Plan',
          description: 'Blood pressure management and cardiovascular risk reduction',
          category: 'chronic_disease',
          goals: [
            {
              goalText: 'Achieve blood pressure below 140/90 mmHg',
              goalType: 'clinical',
              targetValue: '< 140/90',
              measurementUnit: 'mmHg',
              priority: 'high',
            },
            {
              goalText: 'Reduce sodium intake to less than 2g per day',
              goalType: 'behavioral',
              targetValue: '< 2g',
              measurementUnit: 'g/day',
              priority: 'normal',
            },
            {
              goalText: 'Achieve medication adherence rate above 80%',
              goalType: 'behavioral',
              targetValue: '> 80%',
              measurementUnit: '%',
              priority: 'high',
            },
          ],
          interventions: [
            {
              interventionText: 'Amlodipine 5mg once daily',
              interventionType: 'medication',
              frequency: 'Once daily',
              duration: 'Ongoing',
              responsibleRole: 'doctor',
            },
            {
              interventionText: 'DASH diet education',
              interventionType: 'education',
              frequency: 'Monthly',
              duration: '3 months',
              responsibleRole: 'nurse',
            },
            {
              interventionText: 'Regular aerobic exercise - 150 minutes per week',
              interventionType: 'lifestyle',
              frequency: 'Weekly',
              duration: 'Ongoing',
              responsibleRole: 'patient',
            },
            {
              interventionText: 'Home blood pressure monitoring',
              interventionType: 'monitoring',
              frequency: 'Daily',
              duration: 'Ongoing',
              responsibleRole: 'patient',
            },
            {
              interventionText: 'Monthly BP check and medication review',
              interventionType: 'monitoring',
              frequency: 'Monthly',
              duration: 'Ongoing',
              responsibleRole: 'doctor',
            },
          ],
        },
      },
      {
        name: 'Post-Surgery Recovery Plan',
        description: 'Comprehensive recovery plan following surgical procedures',
        category: 'post_surgery',
        condition_code: null,
        condition_name: 'Post-Surgical Care',
        template_data: {
          name: 'Post-Surgery Recovery Plan',
          description: 'Comprehensive recovery plan following surgical procedures',
          category: 'post_surgery',
          goals: [
            {
              goalText: 'Complete wound healing without infection',
              goalType: 'clinical',
              priority: 'urgent',
            },
            {
              goalText: 'Pain level below 3/10',
              goalType: 'symptom_management',
              targetValue: '< 3',
              measurementUnit: '/10',
              priority: 'high',
            },
            {
              goalText: 'Return to full mobility and activities of daily living',
              goalType: 'functional',
              priority: 'normal',
            },
          ],
          interventions: [
            {
              interventionText: 'Wound care and dressing changes',
              interventionType: 'procedure',
              frequency: 'Daily',
              duration: '2 weeks',
              responsibleRole: 'nurse',
            },
            {
              interventionText: 'Pain medication as prescribed',
              interventionType: 'medication',
              frequency: 'As needed',
              duration: '2 weeks',
              responsibleRole: 'doctor',
            },
            {
              interventionText: 'Physical therapy sessions',
              interventionType: 'therapy',
              frequency: 'Three times per week',
              duration: '6 weeks',
              responsibleRole: 'therapist',
            },
            {
              interventionText: 'Monitor for signs of infection',
              interventionType: 'monitoring',
              frequency: 'Daily',
              duration: '2 weeks',
              responsibleRole: 'nurse',
            },
            {
              interventionText: 'Post-operative follow-up appointments',
              interventionType: 'monitoring',
              frequency: 'Weekly',
              duration: '1 month',
              responsibleRole: 'doctor',
            },
          ],
        },
      },
      {
        name: 'Mental Health Care Plan',
        description: 'Comprehensive mental health support and treatment plan',
        category: 'mental_health',
        condition_code: '35489007',
        condition_name: 'Depression',
        template_data: {
          name: 'Mental Health Care Plan',
          description: 'Comprehensive mental health support and treatment plan',
          category: 'mental_health',
          goals: [
            {
              goalText: 'Reduce depression symptoms by 50%',
              goalType: 'symptom_management',
              targetValue: '50% reduction',
              priority: 'high',
            },
            {
              goalText: 'Improve medication adherence to 100%',
              goalType: 'behavioral',
              targetValue: '100%',
              measurementUnit: '%',
              priority: 'high',
            },
            {
              goalText: 'Attend all scheduled therapy sessions',
              goalType: 'behavioral',
              targetValue: '100%',
              measurementUnit: '%',
              priority: 'normal',
            },
            {
              goalText: 'Develop healthy coping strategies',
              goalType: 'quality_of_life',
              priority: 'normal',
            },
          ],
          interventions: [
            {
              interventionText: 'Sertraline 50mg once daily',
              interventionType: 'medication',
              frequency: 'Once daily',
              duration: '6 months',
              responsibleRole: 'doctor',
            },
            {
              interventionText: 'Cognitive Behavioral Therapy (CBT)',
              interventionType: 'counseling',
              frequency: 'Weekly',
              duration: '12 weeks',
              responsibleRole: 'therapist',
            },
            {
              interventionText: 'Support group participation',
              interventionType: 'counseling',
              frequency: 'Bi-weekly',
              duration: 'Ongoing',
              responsibleRole: 'patient',
            },
            {
              interventionText: 'PHQ-9 depression screening',
              interventionType: 'monitoring',
              frequency: 'Monthly',
              duration: 'Ongoing',
              responsibleRole: 'doctor',
            },
            {
              interventionText: 'Crisis plan and emergency contacts',
              interventionType: 'education',
              frequency: 'One-time',
              duration: 'Initial visit',
              responsibleRole: 'nurse',
            },
          ],
        },
      },
    ];

    // Insert templates
    for (const template of templates) {
      console.log(`Inserting template: ${template.name}...`);
      
      await tenantDataSource.query(
        `INSERT INTO care_plan_templates (
          name, description, category, condition_code, condition_name,
          template_data, is_default, is_active, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        ON CONFLICT DO NOTHING`,
        [
          template.name,
          template.description,
          template.category,
          template.condition_code,
          template.condition_name,
          JSON.stringify(template.template_data),
          true,
          true,
        ]
      );
      
      console.log(`✅ ${template.name}`);
    }

    await tenantDataSource.destroy();
    console.log('\n🎉 All care plan templates seeded successfully!\n');

  } finally {
    await masterClient.end();
  }
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
