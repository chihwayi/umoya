import axios from 'axios';
import * as dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as bcrypt from 'bcrypt';

const execPromise = promisify(exec);

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3013/api';
const TENANT_SUBDOMAIN = process.env.TENANT_SUBDOMAIN || 'bulawayo-general';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@bulawayo-general.co.zw';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Password1#';

// Patient for questionnaires
const TARGET_PATIENT_EMAIL = process.env.TARGET_PATIENT_EMAIL || 'mkhize@example.com';

// Doctor credentials (will be created or found)
const DOCTOR_EMAIL = 'dr.smith@bulawayo-general.co.zw';
const DOCTOR_PASSWORD = 'Password1#';
const DOCTOR_FIRST_NAME = 'John';
const DOCTOR_LAST_NAME = 'Smith';

let authToken: string | null = null;
let tenantId: string | null = null;
let patientId: string | null = null;
let doctorId: string | null = null;

class ProDataSeeder {
  constructor() {
    this.init();
  }

  private async init() {
    try {
      // Fetch tenant ID directly from database
      const tenantCmd = `docker exec medicore-postgres-master psql -U medicore -d medicore_master -t -c "SELECT id FROM tenants WHERE subdomain = '${TENANT_SUBDOMAIN}' AND status = 'active' LIMIT 1;"`;
      const { stdout: tenantResult } = await execPromise(tenantCmd);
      tenantId = tenantResult.trim();
      if (!tenantId) {
        throw new Error(`Tenant with subdomain ${TENANT_SUBDOMAIN} not found.`);
      }
      console.log(`✅ Using tenant: ${TENANT_SUBDOMAIN} (ID: ${tenantId})`);

      await this.login();
      await this.findOrCreatePatient();
      await this.findOrCreateDoctor();
      await this.initializeQuestionnaires();
      await this.assignQuestionnaires();
      await this.completeQuestionnaires();
      await this.summarizeResults();
    } catch (error: any) {
      console.error('❌ Seeding failed:', error.message);
      if (error.response) {
        console.error('Response:', error.response.data);
      }
    }
  }

  private async makeRequest(method: string, path: string, data?: any, headers?: any, useAuth: boolean = true) {
    try {
      const config: any = {
        method,
        url: `${API_URL}${path}`,
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId,
          ...(useAuth && authToken && { Authorization: `Bearer ${authToken}` }),
          ...headers,
        },
      };
      if (data) {
        config.data = data;
      }
      const response = await axios(config);
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(`API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  private async login() {
    console.log('\n🔐 Logging in as admin...');
    try {
      const response = await this.makeRequest('POST', '/auth/login', {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      }, null, false);
      authToken = response.accessToken || response.access_token || response.token;
      if (!authToken) {
        throw new Error('No token received from login');
      }
      console.log(`✅ Logged in as ${ADMIN_EMAIL}`);
    } catch (error: any) {
      console.error('❌ Error POST /auth/login:', error.message);
      throw error;
    }
  }

  private async findOrCreatePatient() {
    console.log(`\n👤 Finding patient "${TARGET_PATIENT_EMAIL}"...`);
    try {
      const searchCmd = `docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -t -c "SELECT id, first_name, last_name FROM patients WHERE email = '${TARGET_PATIENT_EMAIL}' LIMIT 1;"`;
      const { stdout: patientResult } = await execPromise(searchCmd);
      
      if (patientResult.trim()) {
        const parts = patientResult.trim().split('|').map(p => p.trim());
        patientId = parts[0];
        console.log(`✅ Found patient: ${parts[1]} ${parts[2]} (ID: ${patientId})`);
      } else {
        throw new Error(`Patient ${TARGET_PATIENT_EMAIL} not found. Please run seed-thandeka-data.ts first.`);
      }
    } catch (error: any) {
      console.error('❌ Error finding patient:', error.message);
      throw error;
    }
  }

  private async findOrCreateDoctor() {
    console.log(`\n👨‍⚕️ Finding or creating doctor "${DOCTOR_EMAIL}"...`);
    try {
      // Try to find existing doctor
      const searchCmd = `docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -t -c "SELECT id, email FROM users WHERE email = '${DOCTOR_EMAIL}' LIMIT 1;"`;
      const { stdout: existingDoctor } = await execPromise(searchCmd);

      if (existingDoctor.trim()) {
        const parts = existingDoctor.trim().split('|').map(p => p.trim());
        doctorId = parts[0];
        console.log(`✅ Found existing doctor: ${DOCTOR_EMAIL} (ID: ${doctorId})`);
      } else {
        // Create new doctor
        const hashedPassword = await bcrypt.hash(DOCTOR_PASSWORD, 10);
        const createCmd = `docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, created_at, updated_at) VALUES ('${DOCTOR_EMAIL}', '${hashedPassword}', '${DOCTOR_FIRST_NAME}', '${DOCTOR_LAST_NAME}', 'doctor', true, NOW(), NOW()) RETURNING id;"`;
        const { stdout: createResult } = await execPromise(createCmd);
        
        const match = createResult.match(/([0-9a-fA-F-]{36})/);
        if (match) {
          doctorId = match[0];
          console.log(`✅ Created doctor: ${DOCTOR_FIRST_NAME} ${DOCTOR_LAST_NAME} (ID: ${doctorId})`);
        } else {
          throw new Error('Failed to get doctor ID after creation');
        }
      }
    } catch (error: any) {
      console.error('❌ Error finding/creating doctor:', error.message);
      throw error;
    }
  }

  private async initializeQuestionnaires() {
    console.log('\n📋 Ensuring questionnaires are initialized...');
    try {
      await this.makeRequest('POST', '/patient-portal/questionnaires/initialize');
      console.log('✅ Questionnaires initialized');
    } catch (error: any) {
      if (error.response?.status === 409) {
        console.log('ℹ️  Questionnaires already initialized.');
      } else {
        console.error('❌ Error initializing questionnaires:', error.response?.data || error.message);
        throw error;
      }
    }
  }

  private async assignQuestionnaires() {
    console.log(`\n📝 Assigning questionnaires to patient ${TARGET_PATIENT_EMAIL} (ID: ${patientId}) by doctor ${DOCTOR_EMAIL} (ID: ${doctorId})...`);

    const templatesResponse = await this.makeRequest('GET', `/patient-portal/questionnaires/available`);
    const templates = Array.isArray(templatesResponse) ? templatesResponse : (templatesResponse.templates || templatesResponse.data || []);
    if (!templates || templates.length === 0) {
      console.log('⚠️  No questionnaire templates available.');
      return;
    }

    const questionnairesToAssign = [
      { code: 'PHQ9', name: 'Patient Health Questionnaire-9' },
      { code: 'GAD7', name: 'Generalized Anxiety Disorder-7' },
      { code: 'PROMIS29', name: 'PROMIS-29 Profile v2.1' },
    ];

    for (const q of questionnairesToAssign) {
      const template = templates.find((t: any) =>
        t.code?.toUpperCase() === q.code.toUpperCase() ||
        t.name?.toLowerCase().includes(q.name.toLowerCase())
      );

      if (template) {
        try {
          // Check if already assigned
          const checkCmd = `docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -t -c "SELECT id FROM patient_questionnaires WHERE patient_id = '${patientId}' AND questionnaire_template_id = '${template.id}' AND status IN ('pending', 'in_progress') LIMIT 1;"`;
          const { stdout: existing } = await execPromise(checkCmd);

          if (existing.trim()) {
            console.log(`  ℹ️  ${template.name} already assigned.`);
            continue;
          }

          // Calculate due date (3 days from now)
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 3);

          // Insert directly into patient_questionnaires table with doctor as assigned_by
          const insertCmd = `docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "INSERT INTO patient_questionnaires (patient_id, questionnaire_template_id, status, due_date, assigned_by, created_at, updated_at) VALUES ('${patientId}', '${template.id}', 'pending', '${dueDate.toISOString()}', '${doctorId}', NOW(), NOW()) RETURNING id;"`;
          const { stdout: result } = await execPromise(insertCmd);

          if (result.includes('INSERT') || result.includes('id')) {
            console.log(`  ✅ Assigned: ${template.name} (Due: ${dueDate.toISOString().split('T')[0]})`);
          }
        } catch (error: any) {
          console.log(`  ⚠️  Error assigning ${template.name}:`, error.message);
        }
      }
    }
  }

  private async completeQuestionnaires() {
    console.log(`\n✅ Completing questionnaires for ${TARGET_PATIENT_EMAIL}...`);

    // Get pending questionnaires
    const pendingCmd = `docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -t -c "SELECT pq.id, qt.code, qt.name, qt.questions FROM patient_questionnaires pq JOIN questionnaire_templates qt ON pq.questionnaire_template_id = qt.id WHERE pq.patient_id = '${patientId}' AND pq.status = 'pending' LIMIT 3;"`;
    const { stdout: pendingResult } = await execPromise(pendingCmd);

    const lines = pendingResult.trim().split('\n').filter(line => line.trim() !== '');
    
    for (const line of lines) {
      const parts = line.split('|').map(p => p.trim());
      const questionnaireId = parts[0];
      const code = parts[1];
      const name = parts[2];
      const questionsJson = parts[3];

      if (!questionsJson) continue;

      try {
        const questions = JSON.parse(questionsJson);
        
        // Generate responses and insert directly into database
        let totalScore = 0;

        if (code === 'PHQ9') {
          // PHQ-9: Generate a score of 18 (moderately severe depression) to trigger alert
          for (let idx = 0; idx < questions.length; idx++) {
            const q = questions[idx];
            let value = 0;
            if (idx < 2) value = 2; // First 2 questions: "More than half the days"
            else if (idx < 5) value = 3; // Next 3: "Nearly every day"
            else if (idx < 7) value = 2; // Next 2: "More than half the days"
            else value = 1; // Last 2: "Several days"
            
            totalScore += value;
            
            // Insert response directly
            const insertCmd = `docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "INSERT INTO questionnaire_responses (patient_questionnaire_id, question_number, question_text, response_value, response_type, score, answered_at) VALUES ('${questionnaireId}', ${q.number}, '${q.text.replace(/'/g, "''")}', '${value}', '${q.type || 'scale'}', ${value}, NOW()) ON CONFLICT DO NOTHING;"`;
            await execPromise(insertCmd);
          }
        } else if (code === 'GAD7') {
          // GAD-7: Generate a score of 12 (moderate anxiety)
          for (let idx = 0; idx < questions.length; idx++) {
            const q = questions[idx];
            let value = idx < 3 ? 2 : (idx < 5 ? 1 : 0);
            totalScore += value;
            
            const insertCmd = `docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "INSERT INTO questionnaire_responses (patient_questionnaire_id, question_number, question_text, response_value, response_type, score, answered_at) VALUES ('${questionnaireId}', ${q.number}, '${q.text.replace(/'/g, "''")}', '${value}', '${q.type || 'scale'}', ${value}, NOW()) ON CONFLICT DO NOTHING;"`;
            await execPromise(insertCmd);
          }
        } else {
          // PROMIS-29: Generate moderate scores
          for (const q of questions) {
            const value = q.type === 'scale' ? 3 : (q.type === 'number' ? 5 : 0);
            totalScore += value;
            
            const insertCmd = `docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "INSERT INTO questionnaire_responses (patient_questionnaire_id, question_number, question_text, response_value, response_type, score, answered_at) VALUES ('${questionnaireId}', ${q.number}, '${q.text.replace(/'/g, "''")}', '${value}', '${q.type || 'scale'}', ${value}, NOW()) ON CONFLICT DO NOTHING;"`;
            await execPromise(insertCmd);
          }
        }

        // Update questionnaire status (total_score is calculated from responses)
        const updateCmd = `docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "UPDATE patient_questionnaires SET status = 'completed', completed_at = NOW(), completion_percentage = 100, updated_at = NOW() WHERE id = '${questionnaireId}';"`;
        await execPromise(updateCmd);

        // Trigger alert check by calling the service method (we'll do this via a simple SQL trigger or manually)
        // For now, we'll manually create an alert for PHQ-9 if score >= 15
        if (code === 'PHQ9' && totalScore >= 15) {
          const alertCmd = `docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "INSERT INTO pro_alerts (patient_id, patient_questionnaire_id, alert_severity, alert_message, score_value, status, created_at) VALUES ('${patientId}', '${questionnaireId}', 'high', 'PHQ-9 Score ${totalScore} indicates moderately severe depression', ${totalScore}, 'active', NOW()) ON CONFLICT DO NOTHING;"`;
          await execPromise(alertCmd);
        }

        console.log(`  ✅ Completed: ${name} (Score: ${totalScore})`);
      } catch (error: any) {
        console.log(`  ⚠️  Error completing ${name}:`, error.message);
      }
    }
  }

  private async summarizeResults() {
    console.log('\n📊 Summary:');
    console.log(`  Patient ID: ${patientId}`);
    console.log(`  Patient Email: ${TARGET_PATIENT_EMAIL}`);
    console.log(`  Doctor ID: ${doctorId}`);
    console.log(`  Doctor Email: ${DOCTOR_EMAIL}`);
    console.log(`  Doctor Password: ${DOCTOR_PASSWORD}`);
    console.log('\n✅ PRO data seeding complete!');
    console.log('\n📝 Doctor Login Credentials:');
    console.log(`  Email: ${DOCTOR_EMAIL}`);
    console.log(`  Password: ${DOCTOR_PASSWORD}`);
    console.log('\n🎯 Next steps:');
    console.log(`  1. Log in to EHR as ${DOCTOR_EMAIL}`);
    console.log(`  2. Open an appointment for ${TARGET_PATIENT_EMAIL}`);
    console.log(`  3. Check the "Patient-Reported Outcomes" section`);
    console.log(`  4. View PRO alerts and questionnaire history`);
    console.log('\n🎉 All done!');
  }
}

new ProDataSeeder();

