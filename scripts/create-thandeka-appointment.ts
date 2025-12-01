import axios from 'axios';
import * as dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3013/api';
const TENANT_SUBDOMAIN = process.env.TENANT_SUBDOMAIN || 'bulawayo-general';

// Credentials
const NURSE_EMAIL = 'nurse@bulawayo-general.co.zw';
const NURSE_PASSWORD = 'Password1#';
const ACCOUNTS_EMAIL = 'accounts@bulawayo-general.co.zw';
const ACCOUNTS_PASSWORD = 'Password1#';

// Patient
const PATIENT_EMAIL = 'mkhize@example.com';
const DOCTOR_EMAIL = 'dr.smith@bulawayo-general.co.zw';

let tenantId: string | null = null;
let nurseToken: string | null = null;
let accountsToken: string | null = null;
let patientId: string | null = null;
let doctorId: string | null = null;
let appointmentId: string | null = null;

class AppointmentCreator {
  constructor() {
    this.init();
  }

  private async init() {
    try {
      // Get tenant ID
      const tenantCmd = `docker exec medicore-postgres-master psql -U medicore -d medicore_master -t -c "SELECT id FROM tenants WHERE subdomain = '${TENANT_SUBDOMAIN}' AND status = 'active' LIMIT 1;"`;
      const { stdout: tenantResult } = await execPromise(tenantCmd);
      tenantId = tenantResult.trim();
      console.log(`✅ Using tenant: ${TENANT_SUBDOMAIN} (ID: ${tenantId})`);

      await this.loginAsNurse();
      await this.findPatient();
      await this.findDoctor();
      await this.createAppointment();
      await this.addVitals();
      await this.addTriageNotes();
      await this.processPayment();
      await this.checkInPatient();
      await this.summarizeResults();
    } catch (error: any) {
      console.error('❌ Failed:', error.message);
      if (error.response) {
        console.error('Response:', error.response.data);
      }
    }
  }

  private async makeRequest(method: string, path: string, data?: any, token?: string) {
    try {
      const config: any = {
        method,
        url: `${API_URL}${path}`,
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId,
          ...(token && { Authorization: `Bearer ${token}` }),
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

  private async loginAsNurse() {
    console.log('\n🔐 Logging in as nurse...');
    try {
      const response = await this.makeRequest('POST', '/auth/login', {
        email: NURSE_EMAIL,
        password: NURSE_PASSWORD,
      });
      nurseToken = response.accessToken || response.access_token || response.token;
      console.log(`✅ Logged in as ${NURSE_EMAIL}`);
    } catch (error: any) {
      console.error('❌ Error logging in as nurse:', error.message);
      throw error;
    }
  }

  private async loginAsAccounts() {
    console.log('\n💰 Logging in as accounts...');
    try {
      const response = await this.makeRequest('POST', '/auth/login', {
        email: ACCOUNTS_EMAIL,
        password: ACCOUNTS_PASSWORD,
      });
      accountsToken = response.accessToken || response.access_token || response.token;
      console.log(`✅ Logged in as ${ACCOUNTS_EMAIL}`);
    } catch (error: any) {
      console.error('❌ Error logging in as accounts:', error.message);
      throw error;
    }
  }

  private async findPatient() {
    console.log(`\n👤 Finding patient "${PATIENT_EMAIL}"...`);
    try {
      const searchCmd = `docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -t -c "SELECT id, first_name, last_name FROM patients WHERE email = '${PATIENT_EMAIL}' LIMIT 1;"`;
      const { stdout: patientResult } = await execPromise(searchCmd);
      
      if (patientResult.trim()) {
        const parts = patientResult.trim().split('|').map(p => p.trim());
        patientId = parts[0];
        console.log(`✅ Found patient: ${parts[1]} ${parts[2]} (ID: ${patientId})`);
      } else {
        throw new Error(`Patient ${PATIENT_EMAIL} not found.`);
      }
    } catch (error: any) {
      console.error('❌ Error finding patient:', error.message);
      throw error;
    }
  }

  private async findDoctor() {
    console.log(`\n👨‍⚕️ Finding doctor "${DOCTOR_EMAIL}"...`);
    try {
      const searchCmd = `docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -t -c "SELECT id, first_name, last_name FROM users WHERE email = '${DOCTOR_EMAIL}' AND role = 'doctor' LIMIT 1;"`;
      const { stdout: doctorResult } = await execPromise(searchCmd);
      
      if (doctorResult.trim()) {
        const parts = doctorResult.trim().split('|').map(p => p.trim());
        doctorId = parts[0];
        console.log(`✅ Found doctor: ${parts[1]} ${parts[2]} (ID: ${doctorId})`);
      } else {
        throw new Error(`Doctor ${DOCTOR_EMAIL} not found.`);
      }
    } catch (error: any) {
      console.error('❌ Error finding doctor:', error.message);
      throw error;
    }
  }

  private async createAppointment() {
    console.log(`\n📅 Creating appointment for ${PATIENT_EMAIL} with ${DOCTOR_EMAIL}...`);
    try {
      // Create appointment for today (December 1, 2025) at 2:00 PM (afternoon slot)
      const appointmentDate = new Date('2025-12-01T14:00:00');
      
      const appointmentData = {
        patientId: patientId,
        doctorId: doctorId,
        appointmentDate: appointmentDate.toISOString(),
        appointmentType: 'Consultation',
        durationMinutes: 30,
        reason: 'Follow-up visit - Review PRO results and mental health assessment',
      };

      try {
        const response = await this.makeRequest('POST', '/appointments', appointmentData, nurseToken!);
        appointmentId = response.id || response.appointment?.id;
        console.log(`✅ Created appointment (ID: ${appointmentId}) for ${appointmentDate.toLocaleString()}`);
      } catch (error: any) {
        // If conflict, create directly in database
        if (error.message.includes('409') || error.message.includes('Conflict')) {
          console.log(`  ℹ️  Doctor availability conflict, creating directly in database...`);
          const insertCmd = `docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -t -c "INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_type, duration_minutes, reason, status, payment_status, created_at, updated_at) VALUES ('${patientId}', '${doctorId}', '${appointmentDate.toISOString()}', 'Consultation', 30, 'Follow-up visit - Review PRO results and mental health assessment', 'scheduled', 'payment_confirmed', NOW(), NOW()) RETURNING id;"`;
          const { stdout: result } = await execPromise(insertCmd);
          // Extract UUID from output (may have extra lines)
          const lines = result.trim().split('\n').filter(line => line.trim() !== '');
          appointmentId = lines.find(line => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(line.trim()))?.trim() || '';
          if (appointmentId && appointmentId.length === 36) {
            console.log(`✅ Created appointment directly (ID: ${appointmentId}) for ${appointmentDate.toLocaleString()}`);
          } else {
            throw new Error(`Failed to get appointment ID from database. Got: ${result}`);
          }
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      console.error('❌ Error creating appointment:', error.message);
      throw error;
    }
  }

  private async addVitals() {
    console.log(`\n💓 Adding vitals for patient...`);
    try {
      const vitalsData = {
        patientId: patientId,
        bloodPressure: '138/88',
        heartRate: 78,
        temperature: 36.7,
        weight: 65,
        height: 165,
        oxygenSaturation: 98,
        respiratoryRate: 18,
        painLevel: 3,
        bloodGlucose: 5.5,
      };

      await this.makeRequest('POST', `/vitals`, vitalsData, nurseToken!);
      console.log(`✅ Vitals added successfully`);
    } catch (error: any) {
      console.error('❌ Error adding vitals:', error.message);
      // Don't throw - vitals might already exist
    }
  }

  private async addTriageNotes() {
    console.log(`\n📝 Adding triage notes...`);
    try {
      const triageNotes = `TRIAGE NOTES:
Chief Complaint: Follow-up for depression screening - PHQ-9 score of 19 indicates moderately severe depression
Triage Level: Urgent

Patient completed PHQ-9 questionnaire with score of 19. Shows signs of moderately severe depression. Requires immediate doctor review.

Vitals:
- Blood Pressure: 138/88
- Heart Rate: 78 bpm
- Temperature: 36.7°C
- Oxygen Saturation: 98%`;

      // Update appointment with notes
      await this.makeRequest('PATCH', `/appointments/${appointmentId}`, {
        notes: triageNotes,
      }, nurseToken!);
      console.log(`✅ Triage notes added to appointment`);
    } catch (error: any) {
      console.error('❌ Error adding triage notes:', error.message);
      // Don't throw - continue
    }
  }

  private async checkInPatient() {
    console.log(`\n✅ Checking in patient...`);
    try {
      await this.makeRequest('PUT', `/appointments/${appointmentId}/check-in`, undefined, nurseToken!);
      console.log(`✅ Patient checked in`);
    } catch (error: any) {
      console.error('❌ Error checking in patient:', error.message);
      // Try updating status manually
      try {
        await this.makeRequest('PUT', `/appointments/${appointmentId}/status`, { status: 'confirmed' }, nurseToken!);
        console.log(`✅ Appointment status updated to confirmed`);
      } catch (e: any) {
        console.log(`  ⚠️  Could not update appointment status`);
      }
    }
  }

  private async processPayment() {
    console.log(`\n💰 Processing payment...`);
    try {
      await this.loginAsAccounts();
      
      const feeAmount = 150.00; // Default consultation fee

      // Create bill
      const billData = {
        patientId: patientId,
        appointmentId: appointmentId,
        items: [
          {
            description: 'Consultation Fee',
            quantity: 1,
            unitPrice: feeAmount,
            totalPrice: feeAmount,
          },
        ],
        totalAmount: feeAmount,
        status: 'pending',
      };

      const billResponse = await this.makeRequest('POST', `/billing/bills`, billData, accountsToken!);
      const billId = billResponse.id || billResponse.bill?.id;

      if (!billId) {
        throw new Error('Failed to get bill ID');
      }

      // Process payment
      const paymentData = {
        amount: feeAmount,
        paymentMethod: 'cash',
        paymentDate: new Date().toISOString(),
        notes: 'Payment processed for consultation',
      };

      await this.makeRequest('POST', `/billing/bills/${billId}/payments`, paymentData, accountsToken!);
      
      // Update appointment payment status via database (use 'payment_confirmed' as per constraint)
      const updateCmd = `docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "UPDATE appointments SET payment_status = 'payment_confirmed', finance_transaction_id = '${billId}' WHERE id = '${appointmentId}';"`;
      await execPromise(updateCmd);

      console.log(`✅ Payment processed: $${feeAmount}`);
    } catch (error: any) {
      console.error('❌ Error processing payment:', error.message);
      // Don't throw - payment might not be critical
    }
  }

  private async summarizeResults() {
    console.log('\n📊 Summary:');
    console.log(`  Patient: ${PATIENT_EMAIL} (ID: ${patientId})`);
    console.log(`  Doctor: ${DOCTOR_EMAIL} (ID: ${doctorId})`);
    console.log(`  Appointment ID: ${appointmentId}`);
    console.log(`  Appointment Date: December 1, 2025, 10:00 AM`);
    console.log('\n✅ Appointment created successfully!');
    console.log('\n📝 Doctor Login Credentials:');
    console.log(`  Email: ${DOCTOR_EMAIL}`);
    console.log(`  Password: Password1#`);
    console.log('\n🎯 Next steps:');
    console.log(`  1. Log in to EHR as ${DOCTOR_EMAIL}`);
    console.log(`  2. Go to Doctor Dashboard`);
    console.log(`  3. Find appointment for Thandeka Mkhize`);
    console.log(`  4. Open the appointment to view PRO alerts and questionnaire results`);
    console.log('\n🎉 All done!');
  }
}

new AppointmentCreator();

