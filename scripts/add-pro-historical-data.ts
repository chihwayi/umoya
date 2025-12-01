import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

const PATIENT_ID = '5c643267-233f-4c95-b978-835ec9b59cea';
const DOCTOR_ID = 'f1777fa7-cf07-4c87-9c5e-4da405129512';

async function addHistoricalData() {
  console.log('📊 Adding historical PRO data for trends...\n');

  try {
    // Get questionnaire template IDs
    const templatesCmd = `docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -t -c "SELECT id, code FROM questionnaire_templates WHERE code IN ('PHQ9', 'GAD7', 'PROMIS29') ORDER BY code;"`;
    const { stdout: templatesResult } = await execPromise(templatesCmd);
    const templates = templatesResult.trim().split('\n').filter(line => line.trim()).map(line => {
      const parts = line.trim().split('|').map(p => p.trim());
      return { id: parts[0], code: parts[1] };
    });

    console.log(`✅ Found ${templates.length} questionnaire templates\n`);

    // Create historical data points (2 weeks ago, 1 month ago, 2 months ago)
    const historicalDates = [
      { daysAgo: 14, label: '2 weeks ago' },
      { daysAgo: 30, label: '1 month ago' },
      { daysAgo: 60, label: '2 months ago' },
    ];

    for (const template of templates) {
      for (const dateInfo of historicalDates) {
        const completedDate = new Date();
        completedDate.setDate(completedDate.getDate() - dateInfo.daysAgo);
        completedDate.setHours(10, 0, 0, 0); // Set to 10 AM

        // Assign different scores to show trends
        let score = 0;
        switch (template.code) {
          case 'PHQ9':
            // Show improvement: 25 (2 months ago) -> 22 (1 month ago) -> 19 (2 weeks ago) -> 19 (today)
            if (dateInfo.daysAgo === 60) score = 25;
            else if (dateInfo.daysAgo === 30) score = 22;
            else if (dateInfo.daysAgo === 14) score = 19;
            break;
          case 'GAD7':
            // Show improvement: 12 -> 10 -> 8 -> 8
            if (dateInfo.daysAgo === 60) score = 12;
            else if (dateInfo.daysAgo === 30) score = 10;
            else if (dateInfo.daysAgo === 14) score = 8;
            break;
          case 'PROMIS29':
            // Show slight improvement: 95 -> 90 -> 87 -> 87
            if (dateInfo.daysAgo === 60) score = 95;
            else if (dateInfo.daysAgo === 30) score = 90;
            else if (dateInfo.daysAgo === 14) score = 87;
            break;
        }

        // Check if this historical entry already exists
        const checkCmd = `docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -t -c "SELECT id FROM patient_questionnaires WHERE patient_id = '${PATIENT_ID}' AND questionnaire_template_id = '${template.id}' AND completed_at::date = '${completedDate.toISOString().split('T')[0]}' LIMIT 1;"`;
        const { stdout: existing } = await execPromise(checkCmd);

        if (existing.trim()) {
          console.log(`  ℹ️  ${template.code} already exists for ${dateInfo.label}, skipping...`);
          continue;
        }

        // Insert historical questionnaire completion
        const insertCmd = `docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "INSERT INTO patient_questionnaires (patient_id, questionnaire_template_id, status, completed_at, completion_percentage, assigned_by, created_at, updated_at) VALUES ('${PATIENT_ID}', '${template.id}', 'completed', '${completedDate.toISOString()}', 100, '${DOCTOR_ID}', NOW(), NOW()) RETURNING id;"`;
        const { stdout: insertResult } = await execPromise(insertCmd);
        
        const match = insertResult.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
        if (match) {
          const questionnaireId = match[0];
          
          // Add total_score column if it doesn't exist
          try {
            await execPromise(`docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "ALTER TABLE patient_questionnaires ADD COLUMN IF NOT EXISTS total_score DECIMAL(10,2);"`);
          } catch (e) {
            // Column might already exist, ignore
          }

          // Update total_score
          await execPromise(`docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "UPDATE patient_questionnaires SET total_score = ${score} WHERE id = '${questionnaireId}';"`);

          // Create a dummy response for completeness
          await execPromise(`docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "INSERT INTO questionnaire_responses (patient_questionnaire_id, question_number, question_text, response_value, response_type, score, answered_at) VALUES ('${questionnaireId}', 1, 'Historical Question 1', '${score}', 'number', ${score}, '${completedDate.toISOString()}') ON CONFLICT DO NOTHING;"`);

          console.log(`  ✅ Added ${template.code} (Score: ${score}) for ${dateInfo.label}`);
        }
      }
    }

    console.log('\n✅ Historical PRO data added successfully!');
    console.log('\n📊 Trends Summary:');
    console.log('  PHQ-9: 25 → 22 → 19 → 19 (showing improvement)');
    console.log('  GAD-7: 12 → 10 → 8 → 8 (showing improvement)');
    console.log('  PROMIS-29: 95 → 90 → 87 → 87 (showing improvement)');
    console.log('\n🎯 The trends section should now display meaningful data!');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

addHistoricalData();

