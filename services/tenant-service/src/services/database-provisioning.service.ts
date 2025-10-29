import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseProvisioningService {
  private readonly logger = new Logger(DatabaseProvisioningService.name);

  constructor(private dataSource: DataSource) {}

  async createDatabase(databaseName: string): Promise<string> {
    try {
      this.logger.log(`Creating database: ${databaseName}`);
      
      // Create database
      await this.dataSource.query(`CREATE DATABASE "${databaseName}"`);
      
      // Generate connection string
      const connectionString = this.generateConnectionString(databaseName);
      
      // Run schema migration
      await this.runSchemaMigration(connectionString);
      
      this.logger.log(`Database ${databaseName} created successfully`);
      return connectionString;
      
    } catch (error) {
      this.logger.error(`Failed to create database ${databaseName}:`, error);
      throw error;
    }
  }

  private generateConnectionString(databaseName: string): string {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || '5432';
    const username = process.env.DB_USERNAME || 'medicore';
    const password = process.env.DB_PASSWORD || 'medicore_password';
    
    return `postgresql://${username}:${password}@${host}:${port}/${databaseName}`;
  }

  private async runSchemaMigration(connectionString: string): Promise<void> {
    const tenantDataSource = new DataSource({
      type: 'postgres',
      url: connectionString,
    });

    try {
      await tenantDataSource.initialize();
      
      // Execute clinic template schema
      const statements = this.getClinicSchema();
      
      for (const statement of statements) {
        if (statement.trim()) {
          await tenantDataSource.query(statement);
        }
      }
      
      this.logger.log('Schema migration completed');
      
    } finally {
      await tenantDataSource.destroy();
    }
  }

  private getClinicSchema(): string[] {
    const schema = `
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      
      CREATE TABLE users (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          role VARCHAR(50) NOT NULL CHECK (role IN ('doctor', 'nurse', 'receptionist', 'admin', 'pharmacist')),
          license_number VARCHAR(100),
          specialization VARCHAR(100),
          phone VARCHAR(50),
          is_active BOOLEAN DEFAULT true,
          must_change_password BOOLEAN DEFAULT false,
          password_changed_at TIMESTAMP WITH TIME ZONE,
          last_login TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE TABLE patients (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          patient_number VARCHAR(50) UNIQUE NOT NULL,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          date_of_birth DATE NOT NULL,
          gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
          id_number VARCHAR(50) UNIQUE,
          phone VARCHAR(50),
          email VARCHAR(255),
          address TEXT,
          city VARCHAR(100),
          emergency_contact_name VARCHAR(200),
          emergency_contact_phone VARCHAR(50),
          medical_aid_name VARCHAR(100),
          medical_aid_number VARCHAR(100),
          medical_aid_plan VARCHAR(100),
          blood_type VARCHAR(5),
          allergies TEXT,
          chronic_conditions TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE TABLE appointments (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
          duration_minutes INTEGER DEFAULT 30,
          appointment_type VARCHAR(100) NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show')),
          reason TEXT,
          notes TEXT,
          patient_instructions TEXT,
          priority_level VARCHAR(50) DEFAULT 'normal' CHECK (priority_level IN ('low', 'normal', 'high', 'urgent')),
          virtual_meeting_url VARCHAR(500),
          is_telehealth BOOLEAN DEFAULT false,
          check_in_time TIMESTAMP WITH TIME ZONE,
          actual_start_time TIMESTAMP WITH TIME ZONE,
          actual_end_time TIMESTAMP WITH TIME ZONE,
          wait_time_minutes INTEGER,
          recurring_pattern VARCHAR(100),
          parent_appointment_id UUID REFERENCES appointments(id),
          cancellation_reason TEXT,
          preparation_notes TEXT,
          estimated_cost DECIMAL(10,2),
          insurance_verified BOOLEAN DEFAULT false,
          reminder_sent_count INTEGER DEFAULT 0,
          last_reminder_sent TIMESTAMP WITH TIME ZONE,
          created_by UUID REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE TABLE vitals (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          blood_pressure VARCHAR(20),
          heart_rate INTEGER,
          temperature DECIMAL(4,2),
          oxygen_saturation INTEGER,
          respiratory_rate INTEGER,
          weight DECIMAL(5,2),
          height DECIMAL(5,2),
          bmi DECIMAL(4,2),
          pain_level INTEGER CHECK (pain_level >= 0 AND pain_level <= 10),
          blood_glucose DECIMAL(5,2),
          notes TEXT,
          recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          recorded_by UUID NOT NULL REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE TABLE triage_assessments (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          chief_complaint TEXT NOT NULL,
          onset TEXT,
          pain_score INTEGER CHECK (pain_score >= 0 AND pain_score <= 10),
          allergies TEXT,
          medications TEXT,
          history TEXT,
          observations TEXT,
          priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
          severity_score INTEGER CHECK (severity_score >= 0 AND severity_score <= 10),
          recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          recorded_by UUID NOT NULL REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE TABLE nursing_notes (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          note_type VARCHAR(50) NOT NULL CHECK (note_type IN ('general', 'assessment', 'intervention', 'evaluation')),
          content TEXT NOT NULL,
          vital_signs TEXT,
          medications TEXT,
          observations TEXT,
          interventions TEXT,
          outcomes TEXT,
          recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          recorded_by UUID NOT NULL REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE TABLE orders (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
          doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          order_type VARCHAR(50) NOT NULL CHECK (order_type IN ('medication', 'procedure', 'lab_test', 'imaging', 'consultation', 'diet', 'activity')),
          order_name VARCHAR(255) NOT NULL,
          description TEXT,
          instructions TEXT NOT NULL,
          dosage VARCHAR(100),
          frequency VARCHAR(100),
          duration VARCHAR(100),
          priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
          status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'in_progress', 'completed', 'cancelled', 'rejected')),
          authorized_by UUID REFERENCES users(id),
          authorized_at TIMESTAMP WITH TIME ZONE,
          executed_by UUID REFERENCES users(id),
          executed_at TIMESTAMP WITH TIME ZONE,
          execution_notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE TABLE medical_records (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          record_type VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          file_path VARCHAR(500),
          file_type VARCHAR(100),
          file_size INTEGER,
          created_by UUID NOT NULL REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE TABLE prescriptions (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          medication_name VARCHAR(255) NOT NULL,
          dosage VARCHAR(100) NOT NULL,
          frequency VARCHAR(100) NOT NULL,
          duration VARCHAR(100) NOT NULL,
          instructions TEXT,
          quantity INTEGER,
          refills INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          prescribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE TABLE lab_results (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          test_name VARCHAR(255) NOT NULL,
          test_type VARCHAR(100) NOT NULL,
          result_value VARCHAR(255),
          result_unit VARCHAR(50),
          reference_range VARCHAR(100),
          status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'abnormal', 'critical')),
          notes TEXT,
          ordered_by UUID NOT NULL REFERENCES users(id),
          reviewed_by UUID REFERENCES users(id),
          ordered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          completed_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE TABLE billing (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          appointment_id UUID REFERENCES appointments(id),
          billing_date DATE NOT NULL,
          total_amount DECIMAL(10,2) NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'partial', 'overdue', 'cancelled')),
          payment_method VARCHAR(50),
          payment_reference VARCHAR(255),
          notes TEXT,
          created_by UUID NOT NULL REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE TABLE billing_items (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          billing_id UUID NOT NULL REFERENCES billing(id) ON DELETE CASCADE,
          item_name VARCHAR(255) NOT NULL,
          item_type VARCHAR(100) NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 1,
          unit_price DECIMAL(10,2) NOT NULL,
          total_price DECIMAL(10,2) NOT NULL,
          description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE TABLE medical_aid_claims (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          appointment_id UUID REFERENCES appointments(id),
          claim_number VARCHAR(100) UNIQUE NOT NULL,
          medical_aid_name VARCHAR(100) NOT NULL,
          medical_aid_number VARCHAR(100) NOT NULL,
          claim_amount DECIMAL(10,2) NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'rejected', 'pending')),
          submission_date DATE NOT NULL,
          response_date DATE,
          response_notes TEXT,
          created_by UUID NOT NULL REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE TABLE audit_logs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID REFERENCES users(id),
          action VARCHAR(100) NOT NULL,
          table_name VARCHAR(100) NOT NULL,
          record_id UUID,
          old_values JSONB,
          new_values JSONB,
          ip_address INET,
          user_agent TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Create indexes for performance
      CREATE INDEX idx_appointments_patient_id ON appointments(patient_id);
      CREATE INDEX idx_appointments_doctor_id ON appointments(doctor_id);
      CREATE INDEX idx_appointments_date ON appointments(appointment_date);
      CREATE INDEX idx_appointments_status ON appointments(status);
      CREATE INDEX idx_appointments_parent_id ON appointments(parent_appointment_id);
      CREATE INDEX idx_appointments_priority ON appointments(priority_level);
      CREATE INDEX idx_appointments_telehealth ON appointments(is_telehealth);
      CREATE INDEX idx_appointments_created_by ON appointments(created_by);
      
      CREATE INDEX idx_vitals_patient_id ON vitals(patient_id);
      CREATE INDEX idx_vitals_recorded_at ON vitals(recorded_at);
      CREATE INDEX idx_vitals_recorded_by ON vitals(recorded_by);
      
      CREATE INDEX idx_triage_patient_id ON triage_assessments(patient_id);
      CREATE INDEX idx_triage_priority ON triage_assessments(priority);
      CREATE INDEX idx_triage_recorded_at ON triage_assessments(recorded_at);
      CREATE INDEX idx_triage_recorded_by ON triage_assessments(recorded_by);
      
      CREATE INDEX idx_nursing_notes_patient_id ON nursing_notes(patient_id);
      CREATE INDEX idx_nursing_notes_note_type ON nursing_notes(note_type);
      CREATE INDEX idx_nursing_notes_recorded_at ON nursing_notes(recorded_at);
      CREATE INDEX idx_nursing_notes_recorded_by ON nursing_notes(recorded_by);
      
      CREATE INDEX idx_orders_patient_id ON orders(patient_id);
      CREATE INDEX idx_orders_appointment_id ON orders(appointment_id);
      CREATE INDEX idx_orders_doctor_id ON orders(doctor_id);
      CREATE INDEX idx_orders_status ON orders(status);
      CREATE INDEX idx_orders_type ON orders(order_type);
      CREATE INDEX idx_orders_authorized_by ON orders(authorized_by);
      CREATE INDEX idx_orders_executed_by ON orders(executed_by);
      CREATE INDEX idx_orders_created_at ON orders(created_at);
      
      CREATE INDEX idx_medical_records_patient_id ON medical_records(patient_id);
      CREATE INDEX idx_medical_records_type ON medical_records(record_type);
      
      CREATE INDEX idx_prescriptions_patient_id ON prescriptions(patient_id);
      CREATE INDEX idx_prescriptions_doctor_id ON prescriptions(doctor_id);
      
      CREATE INDEX idx_lab_results_patient_id ON lab_results(patient_id);
      CREATE INDEX idx_lab_results_status ON lab_results(status);
      
      CREATE INDEX idx_billing_patient_id ON billing(patient_id);
      CREATE INDEX idx_billing_status ON billing(status);
      
      CREATE INDEX idx_claims_patient_id ON medical_aid_claims(patient_id);
      CREATE INDEX idx_claims_status ON medical_aid_claims(status);
      
      CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name);
      CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
      
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';
      
      CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      
      CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      
      CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      
      CREATE TRIGGER update_vitals_updated_at BEFORE UPDATE ON vitals
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      
      CREATE TRIGGER update_triage_updated_at BEFORE UPDATE ON triage_assessments
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      
      CREATE TRIGGER update_nursing_notes_updated_at BEFORE UPDATE ON nursing_notes
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      
      CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      
      CREATE TRIGGER update_medical_records_updated_at BEFORE UPDATE ON medical_records
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      
      CREATE TRIGGER update_prescriptions_updated_at BEFORE UPDATE ON prescriptions
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      
      CREATE TRIGGER update_lab_results_updated_at BEFORE UPDATE ON lab_results
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      
      CREATE TRIGGER update_billing_updated_at BEFORE UPDATE ON billing
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      
      CREATE TRIGGER update_medical_aid_claims_updated_at BEFORE UPDATE ON medical_aid_claims
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `;
    
    return schema.split(';').filter(stmt => stmt.trim());
  }

  async deleteDatabase(databaseName: string): Promise<void> {
    try {
      // Terminate connections to the database
      await this.dataSource.query(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = '${databaseName}' AND pid <> pg_backend_pid()
      `);
      
      // Drop database
      await this.dataSource.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      
      this.logger.log(`Database ${databaseName} deleted successfully`);
      
    } catch (error) {
      this.logger.error(`Failed to delete database ${databaseName}:`, error);
      throw error;
    }
  }
}