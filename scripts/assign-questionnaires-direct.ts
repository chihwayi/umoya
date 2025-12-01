/**
 * Directly assign questionnaires to patient by creating patient_questionnaires records
 * This script creates the actual assignments (not just schedules)
 */

import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const API_BASE_URL = process.env.API_URL || 'http://localhost:3013';
const TENANT_SUBDOMAIN = process.env.TENANT_SUBDOMAIN || 'bulawayo-general';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@bulawayo-general.co.zw';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Password1#';
const PATIENT_ID = process.env.PATIENT_ID || 'eab5ad32-599f-49a5-a94f-bb5134c1655a'; // Thandeka's ID

async function assignQuestionnairesDirectly() {
  let authToken = '';
  
  // Login
  console.log('🔐 Logging in...');
  const loginResponse = await axios.post(
    `${API_BASE_URL}/api/auth/login`,
    { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    { headers: { 'X-Tenant-Key': TENANT_SUBDOMAIN, 'X-Tenant-ID': TENANT_SUBDOMAIN } }
  );
  authToken = loginResponse.data.access_token || loginResponse.data.token;
  console.log('✅ Logged in');

  // Get questionnaire templates
  console.log('\n📋 Getting questionnaire templates...');
  const templatesResponse = await axios.get(
    `${API_BASE_URL}/api/patient-portal/questionnaires/available`,
    { headers: { 'Authorization': `Bearer ${authToken}`, 'X-Tenant-Key': TENANT_SUBDOMAIN } }
  );
  const templates = templatesResponse.data.templates || templatesResponse.data || [];
  console.log(`✅ Found ${templates.length} templates`);

  // Get template IDs for PHQ9, GAD7, PROMIS29, PAIN_SCALE
  const templateIds: any[] = [];
  const codes = ['PHQ9', 'GAD7', 'PROMIS29', 'PAIN_SCALE'];
  
  for (const code of codes) {
    const template = templates.find((t: any) => t.code?.toUpperCase() === code.toUpperCase());
    if (template) {
      templateIds.push({ id: template.id, code: template.code, name: template.name });
    }
  }

  console.log(`\n📝 Assigning ${templateIds.length} questionnaires directly...`);

  // Create patient_questionnaires records via direct SQL execution
  // Since there's no direct API endpoint, we'll use a workaround
  // We'll call the assignQuestionnaire service method if we can find an endpoint
  
  // For now, let's use the database directly via a helper script
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);

  for (const template of templateIds) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    
    try {
      // Try to use an internal service endpoint if available
      // Otherwise, we'll note that manual SQL is needed
      console.log(`  📋 Assigning: ${template.name}...`);
      
      // Check if already assigned
      const checkQuery = `docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -t -c "SELECT id FROM patient_questionnaires WHERE patient_id = '${PATIENT_ID}' AND questionnaire_template_id = '${template.id}' AND status IN ('pending', 'in_progress') LIMIT 1;"`;
      const { stdout: existing } = await execPromise(checkQuery);
      
      if (existing.trim()) {
        console.log(`    ℹ️  Already assigned`);
        continue;
      }

      // Create patient_questionnaire
      const insertQuery = `docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "INSERT INTO patient_questionnaires (patient_id, questionnaire_template_id, status, due_date, created_at, updated_at) VALUES ('${PATIENT_ID}', '${template.id}', 'pending', '${dueDate.toISOString()}', NOW(), NOW()) RETURNING id;"`;
      const { stdout: result } = await execPromise(insertQuery);
      
      if (result.includes('INSERT')) {
        console.log(`    ✅ Assigned: ${template.name}`);
      }
    } catch (error: any) {
      console.log(`    ⚠️  Error assigning ${template.name}:`, error.message);
    }
  }

  console.log('\n✅ Questionnaire assignment complete!');
  console.log('\n📊 Verification:');
  
  const verifyQuery = `docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "SELECT qt.name, pq.status, pq.due_date FROM patient_questionnaires pq JOIN questionnaire_templates qt ON qt.id = pq.questionnaire_template_id WHERE pq.patient_id = '${PATIENT_ID}' AND pq.status = 'pending' ORDER BY pq.created_at DESC;"`;
  const { stdout: verify } = await execPromise(verifyQuery);
  console.log(verify);
}

assignQuestionnairesDirectly().catch(console.error);

