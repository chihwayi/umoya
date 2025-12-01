#!/usr/bin/env ts-node

/**
 * Simple script to initialize standard questionnaires directly via SQL
 * Usage: npx ts-node scripts/initialize-pro-questionnaires-simple.ts [tenant_slug]
 */

import { DataSource } from 'typeorm';
import { fileURLToPath } from 'url';
import * as path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_HOST = process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432', 10);
const DB_USER = process.env.DB_USER || process.env.DB_USERNAME || process.env.POSTGRES_USER || 'medicore';
const DB_PASSWORD = process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'medicore_password';
const MASTER_DB = process.env.MASTER_DB || 'medicore_master';

// Standard questionnaires data
const STANDARD_QUESTIONNAIRES = [
  {
    code: 'PHQ9',
    name: 'Patient Health Questionnaire-9',
    description: '9-item depression screening questionnaire',
    category: 'mental_health',
    version: '1.0',
    scoring_algorithm: 'sum',
    min_score: 0,
    max_score: 27,
    questions: JSON.stringify([
      { number: 1, text: 'Little interest or pleasure in doing things', type: 'scale', required: true, options: [{ value: 0, label: 'Not at all' }, { value: 1, label: 'Several days' }, { value: 2, label: 'More than half the days' }, { value: 3, label: 'Nearly every day' }], scoring: { method: 'direct' } },
      { number: 2, text: 'Feeling down, depressed, or hopeless', type: 'scale', required: true, options: [{ value: 0, label: 'Not at all' }, { value: 1, label: 'Several days' }, { value: 2, label: 'More than half the days' }, { value: 3, label: 'Nearly every day' }], scoring: { method: 'direct' } },
      { number: 3, text: 'Trouble falling or staying asleep, or sleeping too much', type: 'scale', required: true, options: [{ value: 0, label: 'Not at all' }, { value: 1, label: 'Several days' }, { value: 2, label: 'More than half the days' }, { value: 3, label: 'Nearly every day' }], scoring: { method: 'direct' } },
      { number: 4, text: 'Feeling tired or having little energy', type: 'scale', required: true, options: [{ value: 0, label: 'Not at all' }, { value: 1, label: 'Several days' }, { value: 2, label: 'More than half the days' }, { value: 3, label: 'Nearly every day' }], scoring: { method: 'direct' } },
      { number: 5, text: 'Poor appetite or overeating', type: 'scale', required: true, options: [{ value: 0, label: 'Not at all' }, { value: 1, label: 'Several days' }, { value: 2, label: 'More than half the days' }, { value: 3, label: 'Nearly every day' }], scoring: { method: 'direct' } },
      { number: 6, text: 'Feeling bad about yourself or that you are a failure or have let yourself or your family down', type: 'scale', required: true, options: [{ value: 0, label: 'Not at all' }, { value: 1, label: 'Several days' }, { value: 2, label: 'More than half the days' }, { value: 3, label: 'Nearly every day' }], scoring: { method: 'direct' } },
      { number: 7, text: 'Trouble concentrating on things, such as reading the newspaper or watching television', type: 'scale', required: true, options: [{ value: 0, label: 'Not at all' }, { value: 1, label: 'Several days' }, { value: 2, label: 'More than half the days' }, { value: 3, label: 'Nearly every day' }], scoring: { method: 'direct' } },
      { number: 8, text: 'Moving or speaking so slowly that other people could have noticed. Or the opposite - being so fidgety or restless that you have been moving around a lot more than usual', type: 'scale', required: true, options: [{ value: 0, label: 'Not at all' }, { value: 1, label: 'Several days' }, { value: 2, label: 'More than half the days' }, { value: 3, label: 'Nearly every day' }], scoring: { method: 'direct' } },
      { number: 9, text: 'Thoughts that you would be better off dead, or of hurting yourself', type: 'scale', required: true, options: [{ value: 0, label: 'Not at all' }, { value: 1, label: 'Several days' }, { value: 2, label: 'More than half the days' }, { value: 3, label: 'Nearly every day' }], scoring: { method: 'direct' } },
    ]),
    scoring_rules: JSON.stringify({
      algorithm: 'sum',
      minScore: 0,
      maxScore: 27,
      thresholds: [
        { label: 'Minimal', min: 0, max: 4, severity: 'low' },
        { label: 'Mild', min: 5, max: 9, severity: 'medium' },
        { label: 'Moderate', min: 10, max: 14, severity: 'high' },
        { label: 'Moderately Severe', min: 15, max: 19, severity: 'high' },
        { label: 'Severe', min: 20, max: 27, severity: 'critical' },
      ],
    }),
    alert_rules: JSON.stringify([
      { name: 'Severe Depression Alert', conditionType: 'score_greater_than', conditionValue: { threshold: 19 }, severity: 'critical', message: 'PHQ-9 score indicates severe depression - immediate clinical attention recommended', notifyRoles: ['doctor', 'nurse'] },
      { name: 'Moderate Depression Alert', conditionType: 'score_between', conditionValue: { min: 10, max: 19 }, severity: 'high', message: 'PHQ-9 score indicates moderate to moderately severe depression', notifyRoles: ['doctor'] },
    ]),
  },
  {
    code: 'GAD7',
    name: 'Generalized Anxiety Disorder-7',
    description: '7-item anxiety screening questionnaire',
    category: 'mental_health',
    version: '1.0',
    scoring_algorithm: 'sum',
    min_score: 0,
    max_score: 21,
    questions: JSON.stringify([
      { number: 1, text: 'Feeling nervous, anxious, or on edge', type: 'scale', required: true, options: [{ value: 0, label: 'Not at all' }, { value: 1, label: 'Several days' }, { value: 2, label: 'More than half the days' }, { value: 3, label: 'Nearly every day' }], scoring: { method: 'direct' } },
      { number: 2, text: 'Not being able to stop or control worrying', type: 'scale', required: true, options: [{ value: 0, label: 'Not at all' }, { value: 1, label: 'Several days' }, { value: 2, label: 'More than half the days' }, { value: 3, label: 'Nearly every day' }], scoring: { method: 'direct' } },
      { number: 3, text: 'Worrying too much about different things', type: 'scale', required: true, options: [{ value: 0, label: 'Not at all' }, { value: 1, label: 'Several days' }, { value: 2, label: 'More than half the days' }, { value: 3, label: 'Nearly every day' }], scoring: { method: 'direct' } },
      { number: 4, text: 'Trouble relaxing', type: 'scale', required: true, options: [{ value: 0, label: 'Not at all' }, { value: 1, label: 'Several days' }, { value: 2, label: 'More than half the days' }, { value: 3, label: 'Nearly every day' }], scoring: { method: 'direct' } },
      { number: 5, text: 'Being so restless that it is hard to sit still', type: 'scale', required: true, options: [{ value: 0, label: 'Not at all' }, { value: 1, label: 'Several days' }, { value: 2, label: 'More than half the days' }, { value: 3, label: 'Nearly every day' }], scoring: { method: 'direct' } },
      { number: 6, text: 'Becoming easily annoyed or irritable', type: 'scale', required: true, options: [{ value: 0, label: 'Not at all' }, { value: 1, label: 'Several days' }, { value: 2, label: 'More than half the days' }, { value: 3, label: 'Nearly every day' }], scoring: { method: 'direct' } },
      { number: 7, text: 'Feeling afraid, as if something awful might happen', type: 'scale', required: true, options: [{ value: 0, label: 'Not at all' }, { value: 1, label: 'Several days' }, { value: 2, label: 'More than half the days' }, { value: 3, label: 'Nearly every day' }], scoring: { method: 'direct' } },
    ]),
    scoring_rules: JSON.stringify({
      algorithm: 'sum',
      minScore: 0,
      maxScore: 21,
      thresholds: [
        { label: 'Minimal', min: 0, max: 4, severity: 'low' },
        { label: 'Mild', min: 5, max: 9, severity: 'medium' },
        { label: 'Moderate', min: 10, max: 14, severity: 'high' },
        { label: 'Severe', min: 15, max: 21, severity: 'critical' },
      ],
    }),
    alert_rules: JSON.stringify([
      { name: 'Severe Anxiety Alert', conditionType: 'score_greater_than', conditionValue: { threshold: 14 }, severity: 'critical', message: 'GAD-7 score indicates severe anxiety - immediate clinical attention recommended', notifyRoles: ['doctor', 'nurse'] },
    ]),
  },
  {
    code: 'PAIN_SCALE',
    name: 'Pain Scale (NRS 0-10)',
    description: 'Numeric Rating Scale for pain assessment',
    category: 'symptom_tracking',
    version: '1.0',
    scoring_algorithm: 'direct',
    min_score: 0,
    max_score: 10,
    questions: JSON.stringify([
      { number: 1, text: 'On a scale of 0 to 10, where 0 is no pain and 10 is the worst pain imaginable, what is your current pain level?', type: 'scale', required: true, min: 0, max: 10, scoring: { method: 'direct' } },
    ]),
    scoring_rules: JSON.stringify({
      algorithm: 'direct',
      minScore: 0,
      maxScore: 10,
      thresholds: [
        { label: 'No Pain', min: 0, max: 0, severity: 'low' },
        { label: 'Mild', min: 1, max: 3, severity: 'low' },
        { label: 'Moderate', min: 4, max: 6, severity: 'medium' },
        { label: 'Severe', min: 7, max: 8, severity: 'high' },
        { label: 'Very Severe', min: 9, max: 10, severity: 'critical' },
      ],
    }),
    alert_rules: JSON.stringify([
      { name: 'Severe Pain Alert', conditionType: 'score_greater_than', conditionValue: { threshold: 8 }, severity: 'critical', message: 'Pain level is severe (8-10) - immediate attention may be needed', notifyRoles: ['doctor', 'nurse'] },
    ]),
  },
];

async function initializeQuestionnaires(tenantSlug: string): Promise<void> {
  // Get the actual database name from master database
  const masterDb = new DataSource({
    type: 'postgres',
    host: DB_HOST,
    port: DB_PORT,
    username: DB_USER,
    password: DB_PASSWORD,
    database: MASTER_DB,
  });

  let dbName: string;
  try {
    await masterDb.initialize();
    const result = await masterDb.query(
      `SELECT "databaseName" FROM tenants WHERE subdomain = $1`,
      [tenantSlug]
    );
    await masterDb.destroy();

    if (!result || result.length === 0) {
      console.error(`❌ Error: Tenant '${tenantSlug}' not found in master database`);
      process.exit(1);
    }

    dbName = result[0].databaseName;
  } catch (error: any) {
    console.error(`❌ Error connecting to master database:`, error.message);
    dbName = `medicore_${tenantSlug.replace(/-/g, '_')}`;
    console.log(`⚠️  Using fallback database name: ${dbName}`);
  }
  
  console.log(`📋 Initializing standard questionnaires for tenant: ${tenantSlug} (database: ${dbName})`);

  const tenantDb = new DataSource({
    type: 'postgres',
    host: DB_HOST,
    port: DB_PORT,
    username: DB_USER,
    password: DB_PASSWORD,
    database: dbName,
  });

  try {
    await tenantDb.initialize();
    console.log(`✓ Connected to ${dbName}`);

    for (const q of STANDARD_QUESTIONNAIRES) {
      // Check if already exists
      const existing = await tenantDb.query(
        `SELECT id FROM questionnaire_templates WHERE code = $1`,
        [q.code]
      );

      if (existing && existing.length > 0) {
        console.log(`⚠️  Questionnaire ${q.code} already exists, skipping`);
        continue;
      }

      // Insert template
      const [template] = await tenantDb.query(
        `INSERT INTO questionnaire_templates (
          code, name, description, category, version, is_active, is_standard,
          scoring_algorithm, min_score, max_score, questions, scoring_rules, alert_rules
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13::jsonb)
        RETURNING id`,
        [
          q.code,
          q.name,
          q.description,
          q.category,
          q.version,
          true,
          true,
          q.scoring_algorithm,
          q.min_score,
          q.max_score,
          q.questions,
          q.scoring_rules,
          q.alert_rules,
        ]
      );

      // Create default alert rules
      const alertRules = JSON.parse(q.alert_rules);
      if (alertRules && alertRules.length > 0) {
        for (const alertRule of alertRules) {
          await tenantDb.query(
            `INSERT INTO pro_alert_rules (
              questionnaire_template_id, rule_name, condition_type, condition_value,
              alert_severity, alert_message, notify_roles, is_active
            ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)`,
            [
              template.id,
              alertRule.name,
              alertRule.conditionType,
              JSON.stringify(alertRule.conditionValue),
              alertRule.severity,
              alertRule.message,
              alertRule.notifyRoles || ['doctor', 'nurse'],
              true,
            ]
          );
        }
      }

      console.log(`✓ Initialized questionnaire: ${q.code} (${q.name})`);
    }

    console.log(`\n✅ Standard questionnaires initialized successfully!`);
    console.log(`   - PHQ-9 (Depression)`);
    console.log(`   - GAD-7 (Anxiety)`);
    console.log(`   - Pain Scale (NRS 0-10)`);

    await tenantDb.destroy();
  } catch (error: any) {
    console.error(`❌ Error initializing questionnaires:`, error.message);
    if (tenantDb.isInitialized) {
      await tenantDb.destroy();
    }
    process.exit(1);
  }
}

async function main() {
  const tenantSlug = process.argv[2];

  if (!tenantSlug) {
    console.error('❌ Error: Tenant slug is required');
    console.log('Usage: npx ts-node --esm scripts/initialize-pro-questionnaires-simple.ts <tenant_slug>');
    process.exit(1);
  }

  await initializeQuestionnaires(tenantSlug);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

