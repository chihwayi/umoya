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
      await this.applyClinicSchema(connectionString);
      
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

  // Make schema application callable and idempotent
  public async applyClinicSchema(connectionString: string): Promise<void> {
    const tenantDataSource = new DataSource({
      type: 'postgres',
      url: connectionString,
    });

    try {
      await tenantDataSource.initialize();
      
      // Execute clinic template schema (idempotent)
      let statements = this.getClinicSchema();
      // Ensure idempotency at runtime without rewriting the whole template
      statements = statements.map((s) =>
        s
          .replace(/CREATE TABLE\s+([^(]+)/gi, (m) => m.replace('CREATE TABLE', 'CREATE TABLE IF NOT EXISTS'))
          .replace(/CREATE INDEX\s+/gi, 'CREATE INDEX IF NOT EXISTS ')
          .replace(/CREATE EXTENSION\s+/gi, 'CREATE EXTENSION IF NOT EXISTS ')
          .replace(/IF NOT EXISTS\s+IF NOT EXISTS/gi, 'IF NOT EXISTS')
      );
      
      for (const statement of statements) {
        if (!statement.trim()) continue;
        try {
          await tenantDataSource.query(statement);
        } catch (e) {
          this.logger.warn(`Skipping statement due to error: ${e instanceof Error ? e.message : String(e)}\nSQL: ${statement.substring(0, 200)}...`);
        }
      }
      
      // Create the update function separately to avoid splitting issues
      await tenantDataSource.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ language 'plpgsql';
      `);
      
      // Create all triggers
      const triggerStatements = this.getTriggerStatements();
      for (const statement of triggerStatements) {
        if (!statement.trim()) continue;
        try {
          await tenantDataSource.query(statement);
        } catch (e) {
          this.logger.warn(`Skipping trigger due to error: ${e instanceof Error ? e.message : String(e)}\nSQL: ${statement.substring(0, 200)}...`);
        }
      }
      
      // Update existing CHECK constraints to include new roles
      try {
        await tenantDataSource.query(`
          ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
        `);
        await tenantDataSource.query(`
          ALTER TABLE users ADD CONSTRAINT users_role_check 
          CHECK (role IN ('doctor', 'nurse', 'receptionist', 'admin', 'pharmacist', 'lab_tech', 'radiologist'));
        `);
      } catch (e) {
        this.logger.warn(`Skipping constraint update due to error: ${e instanceof Error ? e.message : String(e)}`);
      }
      
      // Seed baseline users and clinical catalogs
      await this.seedDefaultUsers(tenantDataSource);
      await this.seedLabCatalog(tenantDataSource);
      await this.seedImagingCatalog(tenantDataSource);
      
      // Seed lookup tables with initial data (HIV, maternity, etc.)
      await this.seedLookupTables(tenantDataSource);
      
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
          role VARCHAR(50) NOT NULL CHECK (role IN ('doctor', 'nurse', 'receptionist', 'admin', 'pharmacist', 'lab_tech', 'radiologist')),
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
          drug_id UUID REFERENCES drugs(id) ON DELETE SET NULL,
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
      
    `;
    
    // Split by semicolon but handle function definitions properly
    let statements = schema.split(';').filter(stmt => stmt.trim());
    
    // Add problems and allergies tables as separate statements (after split)
    statements.push(`CREATE TABLE IF NOT EXISTS problems (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, code VARCHAR(50), description TEXT NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','resolved')), onset_date DATE, resolved_date DATE, notes TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE TABLE IF NOT EXISTS allergies (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, allergen VARCHAR(255) NOT NULL, reaction TEXT, severity VARCHAR(20) CHECK (severity IN ('mild','moderate','severe')), recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), recorded_by UUID REFERENCES users(id))`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_problems_patient_id ON problems(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_problems_status ON problems(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_allergies_patient_id ON allergies(patient_id)`);
    
    // Add lab_orders table
    statements.push(`CREATE TABLE IF NOT EXISTS lab_orders (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_number VARCHAR(255) NOT NULL, patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, ordering_provider_id UUID NOT NULL REFERENCES users(id), medical_record_id UUID REFERENCES medical_records(id), tests JSONB NOT NULL, priority VARCHAR(20) DEFAULT 'routine' CHECK (priority IN ('routine','urgent','stat')), status VARCHAR(20) DEFAULT 'ordered' CHECK (status IN ('ordered','collected','in_progress','completed','cancelled')), clinical_info TEXT, special_instructions TEXT, scheduled_date_time TIMESTAMP WITH TIME ZONE, collected_at TIMESTAMP WITH TIME ZONE, collected_by_id UUID REFERENCES users(id), results JSONB, interpretation TEXT, reviewed_by_id UUID REFERENCES users(id), reviewed_at TIMESTAMP WITH TIME ZONE, attachments JSONB, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_orders_patient_id ON lab_orders(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_orders_status ON lab_orders(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_orders_ordering_provider_id ON lab_orders(ordering_provider_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_orders_order_number ON lab_orders(order_number)`);
    
    // Add lab_tests table (test catalog)
    statements.push(`CREATE TABLE IF NOT EXISTS lab_tests (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), loinc_code VARCHAR(50) UNIQUE, test_name VARCHAR(255) NOT NULL, test_code VARCHAR(50), category VARCHAR(100) NOT NULL, specimen_type VARCHAR(100) NOT NULL, unit VARCHAR(50), reference_range_male VARCHAR(100), reference_range_female VARCHAR(100), reference_range_general VARCHAR(100), critical_high DECIMAL(10,2), critical_low DECIMAL(10,2), description TEXT, instructions TEXT, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_tests_loinc_code ON lab_tests(loinc_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_tests_category ON lab_tests(category)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_tests_test_code ON lab_tests(test_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_tests_is_active ON lab_tests(is_active)`);
    
    // Add lab_order_sets table (predefined test groups)
    statements.push(`CREATE TABLE IF NOT EXISTS lab_order_sets (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), set_name VARCHAR(255) NOT NULL, set_code VARCHAR(50) UNIQUE, description TEXT, test_ids JSONB NOT NULL, category VARCHAR(100), is_active BOOLEAN DEFAULT true, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_order_sets_set_code ON lab_order_sets(set_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_order_sets_category ON lab_order_sets(category)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_order_sets_is_active ON lab_order_sets(is_active)`);
    
    // Add critical_result_alerts table
    statements.push(`CREATE TABLE IF NOT EXISTS critical_result_alerts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), lab_order_id UUID NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE, patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, ordering_provider_id UUID NOT NULL REFERENCES users(id), test_code VARCHAR(50) NOT NULL, test_name VARCHAR(255) NOT NULL, result_value VARCHAR(255) NOT NULL, critical_value_type VARCHAR(20) CHECK (critical_value_type IN ('high','low','critical')), alert_message TEXT NOT NULL, status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','acknowledged','dismissed')), acknowledged_by UUID REFERENCES users(id), acknowledged_at TIMESTAMP WITH TIME ZONE, acknowledgment_notes TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_critical_alerts_lab_order_id ON critical_result_alerts(lab_order_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_critical_alerts_patient_id ON critical_result_alerts(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_critical_alerts_ordering_provider_id ON critical_result_alerts(ordering_provider_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_critical_alerts_status ON critical_result_alerts(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_critical_alerts_created_at ON critical_result_alerts(created_at)`);
    
    // Enhanced LIS: Lab Test Catalog (detailed test definitions)
    statements.push(`CREATE TABLE IF NOT EXISTS lab_test_catalog (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), test_code VARCHAR(50) UNIQUE NOT NULL, loinc_code VARCHAR(50), test_name VARCHAR(255) NOT NULL, category VARCHAR(100) NOT NULL CHECK (category IN ('Hematology','Chemistry','Microbiology','Immunology','Serology','Toxicology','Urinalysis','Cytology','Molecular','Other')), specimen_type VARCHAR(100) NOT NULL, specimen_volume VARCHAR(50), container_type VARCHAR(100), turnaround_time INTEGER, cost DECIMAL(10,2), description TEXT, clinical_significance TEXT, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_test_catalog_test_code ON lab_test_catalog(test_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_test_catalog_loinc_code ON lab_test_catalog(loinc_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_test_catalog_category ON lab_test_catalog(category)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_test_catalog_is_active ON lab_test_catalog(is_active)`);
    
    // Enhanced LIS: Lab Test Components (individual measurable components of a test)
    statements.push(`CREATE TABLE IF NOT EXISTS lab_test_components (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), test_catalog_id UUID NOT NULL REFERENCES lab_test_catalog(id) ON DELETE CASCADE, component_name VARCHAR(255) NOT NULL, component_code VARCHAR(50), loinc_code VARCHAR(50), unit VARCHAR(50), reference_range_min DECIMAL(10,4), reference_range_max DECIMAL(10,4), reference_range_text TEXT, critical_low DECIMAL(10,4), critical_high DECIMAL(10,4), age_specific BOOLEAN DEFAULT false, gender_specific BOOLEAN DEFAULT false, sort_order INTEGER DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_test_components_test_catalog_id ON lab_test_components(test_catalog_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_test_components_component_code ON lab_test_components(component_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_test_components_sort_order ON lab_test_components(sort_order)`);
    
    // Enhanced LIS: Lab Reference Ranges (age/gender specific ranges)
    statements.push(`CREATE TABLE IF NOT EXISTS lab_reference_ranges (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), component_id UUID NOT NULL REFERENCES lab_test_components(id) ON DELETE CASCADE, age_min INTEGER, age_max INTEGER, gender VARCHAR(10) CHECK (gender IN ('male','female','all')), range_min DECIMAL(10,4), range_max DECIMAL(10,4), range_text TEXT, unit VARCHAR(50), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_reference_ranges_component_id ON lab_reference_ranges(component_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_reference_ranges_gender ON lab_reference_ranges(gender)`);
    
    // Enhanced LIS: Lab Order Set Items (junction table for order sets)
    statements.push(`CREATE TABLE IF NOT EXISTS lab_order_set_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_set_id UUID NOT NULL REFERENCES lab_order_sets(id) ON DELETE CASCADE, test_catalog_id UUID NOT NULL REFERENCES lab_test_catalog(id) ON DELETE CASCADE, sort_order INTEGER DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_order_set_items_order_set_id ON lab_order_set_items(order_set_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_order_set_items_test_catalog_id ON lab_order_set_items(test_catalog_id)`);
    
    // Enhanced LIS: Lab Critical Alerts (enhanced version)
    statements.push(`CREATE TABLE IF NOT EXISTS lab_critical_alerts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, lab_order_id UUID REFERENCES lab_orders(id) ON DELETE CASCADE, component_name VARCHAR(255) NOT NULL, result_value VARCHAR(100) NOT NULL, critical_range VARCHAR(100), severity VARCHAR(20) CHECK (severity IN ('critical','panic')) DEFAULT 'critical', alert_status VARCHAR(20) CHECK (alert_status IN ('pending','acknowledged','escalated')) DEFAULT 'pending', alerted_to UUID REFERENCES users(id), alerted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), acknowledged_by UUID REFERENCES users(id), acknowledged_at TIMESTAMP WITH TIME ZONE, acknowledgment_notes TEXT, escalated_to UUID REFERENCES users(id), escalated_at TIMESTAMP WITH TIME ZONE, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_critical_alerts_patient_id ON lab_critical_alerts(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_critical_alerts_lab_order_id ON lab_critical_alerts(lab_order_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_critical_alerts_alert_status ON lab_critical_alerts(alert_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_critical_alerts_alerted_to ON lab_critical_alerts(alerted_to)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_critical_alerts_created_at ON lab_critical_alerts(created_at)`);
    
    // Enhanced LIS: Enhance lab_orders table with new columns
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS order_set_id UUID REFERENCES lab_order_sets(id)`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS test_catalog_id UUID REFERENCES lab_test_catalog(id)`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS ordering_provider UUID REFERENCES users(id)`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS clinical_indication TEXT`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS icd10_codes TEXT[]`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS specimen_collected_at TIMESTAMP WITH TIME ZONE`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS specimen_received_at TIMESTAMP WITH TIME ZONE`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS result_reported_at TIMESTAMP WITH TIME ZONE`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS result_acknowledged BOOLEAN DEFAULT false`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS result_acknowledged_by UUID REFERENCES users(id)`);
    statements.push(`ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS result_acknowledged_at TIMESTAMP WITH TIME ZONE`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_orders_order_set_id ON lab_orders(order_set_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_orders_test_catalog_id ON lab_orders(test_catalog_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_orders_result_acknowledged ON lab_orders(result_acknowledged)`);
    
    // Add drugs table (medication catalog)
    statements.push(`CREATE TABLE IF NOT EXISTS drugs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), generic_name VARCHAR(255) NOT NULL, brand_names TEXT[], atc_code VARCHAR(20), drug_class VARCHAR(100), active_ingredients TEXT[], dosage_forms TEXT[], route_of_administration TEXT[], description TEXT, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_generic_name ON drugs(generic_name)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_atc_code ON drugs(atc_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_drug_class ON drugs(drug_class)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_is_active ON drugs(is_active)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_brand_names ON drugs USING GIN(brand_names)`);
    
    // Add drug_interactions table (many-to-many interactions)
    statements.push(`CREATE TABLE IF NOT EXISTS drug_interactions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), drug1_id UUID NOT NULL REFERENCES drugs(id) ON DELETE CASCADE, drug2_id UUID NOT NULL REFERENCES drugs(id) ON DELETE CASCADE, severity VARCHAR(20) NOT NULL CHECK (severity IN ('minor','moderate','major','contraindicated')), description TEXT NOT NULL, mechanism TEXT, management TEXT, evidence_level VARCHAR(20), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), UNIQUE(drug1_id, drug2_id))`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drug_interactions_drug1_id ON drug_interactions(drug1_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drug_interactions_drug2_id ON drug_interactions(drug2_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_drug_interactions_severity ON drug_interactions(severity)`);
    
    // Add drug_id column to orders table (for linking prescriptions to drugs)
    statements.push(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS drug_id UUID REFERENCES drugs(id) ON DELETE SET NULL`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_orders_drug_id ON orders(drug_id) WHERE drug_id IS NOT NULL`);
    
    // Radiology & Medical Imaging Module
    // Imaging Modalities (X-Ray, CT, MRI, Ultrasound, etc.)
    statements.push(`CREATE TABLE IF NOT EXISTS imaging_modalities (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), modality_code VARCHAR(20) UNIQUE NOT NULL CHECK (modality_code IN ('XR','CT','MRI','US','MG','FL','NM','PET')), modality_name VARCHAR(100) NOT NULL, description TEXT, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_modalities_modality_code ON imaging_modalities(modality_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_modalities_is_active ON imaging_modalities(is_active)`);
    
    // Imaging Study Types (specific procedures)
    statements.push(`CREATE TABLE IF NOT EXISTS imaging_study_types (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), modality_id UUID NOT NULL REFERENCES imaging_modalities(id) ON DELETE CASCADE, study_code VARCHAR(50) UNIQUE NOT NULL, study_name VARCHAR(255) NOT NULL, body_part VARCHAR(100), views TEXT[], typical_images INTEGER DEFAULT 1, contrast_required BOOLEAN DEFAULT false, cost DECIMAL(10,2), description TEXT, preparation_instructions TEXT, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_study_types_modality_id ON imaging_study_types(modality_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_study_types_study_code ON imaging_study_types(study_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_study_types_body_part ON imaging_study_types(body_part)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_study_types_is_active ON imaging_study_types(is_active)`);
    
    // Imaging Orders
    statements.push(`CREATE TABLE IF NOT EXISTS imaging_orders (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, order_number VARCHAR(50) UNIQUE NOT NULL, study_type_id UUID NOT NULL REFERENCES imaging_study_types(id), ordering_provider UUID NOT NULL REFERENCES users(id), clinical_indication TEXT, clinical_history TEXT, suspected_diagnosis TEXT, icd10_codes TEXT[], priority VARCHAR(20) DEFAULT 'routine' CHECK (priority IN ('routine','urgent','stat')), order_status VARCHAR(30) DEFAULT 'ordered' CHECK (order_status IN ('ordered','scheduled','in_progress','awaiting_report','completed','cancelled')), ordered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), scheduled_date TIMESTAMP WITH TIME ZONE, performed_at TIMESTAMP WITH TIME ZONE, cancelled_at TIMESTAMP WITH TIME ZONE, cancellation_reason TEXT, created_by UUID REFERENCES users(id), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_orders_patient_id ON imaging_orders(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_orders_order_number ON imaging_orders(order_number)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_orders_study_type_id ON imaging_orders(study_type_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_orders_ordering_provider ON imaging_orders(ordering_provider)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_orders_order_status ON imaging_orders(order_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_orders_ordered_at ON imaging_orders(ordered_at)`);
    
    // Imaging Studies (actual imaging session)
    statements.push(`CREATE TABLE IF NOT EXISTS imaging_studies (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), imaging_order_id UUID NOT NULL REFERENCES imaging_orders(id) ON DELETE CASCADE, patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, accession_number VARCHAR(50) UNIQUE NOT NULL, study_type_id UUID NOT NULL REFERENCES imaging_study_types(id), study_date DATE NOT NULL, study_time TIME NOT NULL, technologist UUID REFERENCES users(id), radiologist_assigned UUID REFERENCES users(id), study_status VARCHAR(30) DEFAULT 'in_progress' CHECK (study_status IN ('in_progress','awaiting_report','reported','signed','amended')), number_of_images INTEGER DEFAULT 0, study_description TEXT, technique TEXT, contrast_used BOOLEAN DEFAULT false, contrast_type VARCHAR(100), contrast_volume VARCHAR(50), radiation_dose VARCHAR(50), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_studies_imaging_order_id ON imaging_studies(imaging_order_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_studies_patient_id ON imaging_studies(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_studies_accession_number ON imaging_studies(accession_number)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_studies_study_type_id ON imaging_studies(study_type_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_studies_radiologist_assigned ON imaging_studies(radiologist_assigned)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_studies_study_status ON imaging_studies(study_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_studies_study_date ON imaging_studies(study_date)`);
    
    // Imaging Files (images/DICOM files)
    statements.push(`CREATE TABLE IF NOT EXISTS imaging_files (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), imaging_study_id UUID NOT NULL REFERENCES imaging_studies(id) ON DELETE CASCADE, file_name VARCHAR(255) NOT NULL, file_path TEXT NOT NULL, file_type VARCHAR(20) NOT NULL CHECK (file_type IN ('DICOM','JPEG','PNG','PDF','TIFF')), file_size BIGINT, image_number INTEGER, view_position VARCHAR(50), is_primary BOOLEAN DEFAULT false, uploaded_by UUID REFERENCES users(id), uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_files_imaging_study_id ON imaging_files(imaging_study_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_files_is_primary ON imaging_files(is_primary)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_files_uploaded_at ON imaging_files(uploaded_at)`);
    
    // Imaging Reports
    statements.push(`CREATE TABLE IF NOT EXISTS imaging_reports (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), imaging_study_id UUID NOT NULL REFERENCES imaging_studies(id) ON DELETE CASCADE, imaging_order_id UUID NOT NULL REFERENCES imaging_orders(id), patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, report_status VARCHAR(20) DEFAULT 'draft' CHECK (report_status IN ('draft','preliminary','final','amended')), clinical_history TEXT, technique TEXT, findings TEXT NOT NULL, impression TEXT NOT NULL, recommendations TEXT, comparison_studies TEXT, critical_findings TEXT, is_critical BOOLEAN DEFAULT false, drafted_by UUID REFERENCES users(id), drafted_at TIMESTAMP WITH TIME ZONE, signed_by UUID REFERENCES users(id), signed_at TIMESTAMP WITH TIME ZONE, amended_by UUID REFERENCES users(id), amendment_reason TEXT, amended_at TIMESTAMP WITH TIME ZONE, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_reports_imaging_study_id ON imaging_reports(imaging_study_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_reports_patient_id ON imaging_reports(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_reports_report_status ON imaging_reports(report_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_reports_is_critical ON imaging_reports(is_critical)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_reports_drafted_by ON imaging_reports(drafted_by)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_reports_signed_by ON imaging_reports(signed_by)`);
    
    // Imaging Report Templates
    statements.push(`CREATE TABLE IF NOT EXISTS imaging_report_templates (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), modality_id UUID REFERENCES imaging_modalities(id), study_type_id UUID REFERENCES imaging_study_types(id), template_name VARCHAR(255) NOT NULL, template_code VARCHAR(50) UNIQUE NOT NULL, technique_template TEXT, findings_template TEXT, impression_template TEXT, is_default BOOLEAN DEFAULT false, created_by UUID REFERENCES users(id), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_report_templates_modality_id ON imaging_report_templates(modality_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_report_templates_study_type_id ON imaging_report_templates(study_type_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_report_templates_template_code ON imaging_report_templates(template_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_report_templates_is_default ON imaging_report_templates(is_default)`);
    
    // Imaging Annotations (for image markup)
    statements.push(`CREATE TABLE IF NOT EXISTS imaging_annotations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), imaging_file_id UUID NOT NULL REFERENCES imaging_files(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES users(id), annotation_type VARCHAR(50) NOT NULL CHECK (annotation_type IN ('arrow','circle','rectangle','line','text','measurement','freehand')), annotation_data JSONB NOT NULL, annotation_text TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_annotations_imaging_file_id ON imaging_annotations(imaging_file_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_annotations_user_id ON imaging_annotations(user_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_imaging_annotations_annotation_type ON imaging_annotations(annotation_type)`);
    
    // Maternity & Obstetrics Module
    // Maternity Enrollments (Pregnancy Registration)
    statements.push(`CREATE TABLE IF NOT EXISTS maternity_enrollments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, enrollment_number VARCHAR(50) UNIQUE NOT NULL, enrollment_date DATE NOT NULL, expected_delivery_date DATE, edd_method VARCHAR(50) CHECK (edd_method IN ('LMP','Ultrasound','Clinical')), lmp_date DATE, gestational_age_at_enrollment INTEGER, gravida INTEGER, para INTEGER, parity_term INTEGER, parity_preterm INTEGER, parity_abortions INTEGER, parity_living INTEGER, previous_cesarean BOOLEAN DEFAULT false, previous_complications TEXT, current_pregnancy_complications TEXT, risk_category VARCHAR(20) DEFAULT 'low' CHECK (risk_category IN ('low','medium','high')), enrollment_status VARCHAR(30) DEFAULT 'active' CHECK (enrollment_status IN ('active','delivered','transferred_out','pregnancy_loss')), enrolled_by UUID REFERENCES users(id), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_maternity_enrollments_patient_id ON maternity_enrollments(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_maternity_enrollments_enrollment_number ON maternity_enrollments(enrollment_number)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_maternity_enrollments_enrollment_status ON maternity_enrollments(enrollment_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_maternity_enrollments_risk_category ON maternity_enrollments(risk_category)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_maternity_enrollments_expected_delivery_date ON maternity_enrollments(expected_delivery_date)`);
    
    // ANC Visits (WHO 8-visit model)
    statements.push(`CREATE TABLE IF NOT EXISTS anc_visits (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), maternity_enrollment_id UUID NOT NULL REFERENCES maternity_enrollments(id) ON DELETE CASCADE, patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, visit_number INTEGER NOT NULL, visit_date DATE NOT NULL, gestational_age INTEGER, gestational_age_days INTEGER, weight DECIMAL(5,2), height DECIMAL(5,2), bmi DECIMAL(5,2), blood_pressure_systolic INTEGER, blood_pressure_diastolic INTEGER, temperature DECIMAL(4,2), pulse INTEGER, respiratory_rate INTEGER, fundal_height DECIMAL(4,1), fetal_heart_rate INTEGER, fetal_presentation VARCHAR(50), fetal_movement VARCHAR(50), edema VARCHAR(50), edema_location TEXT, proteinuria VARCHAR(50), glucose_urine VARCHAR(50), hemoglobin DECIMAL(4,1), blood_group VARCHAR(10), rhesus VARCHAR(10), vdrl_syphilis VARCHAR(20), hiv_status VARCHAR(20), hep_b_status VARCHAR(20), tetanus_immunization BOOLEAN, ipt_malaria INTEGER, iron_folate BOOLEAN, deworming BOOLEAN, insecticide_treated_net BOOLEAN, danger_signs_discussed BOOLEAN, birth_plan_discussed BOOLEAN, complications_identified TEXT, interventions TEXT, referral_needed BOOLEAN, referral_reason TEXT, referral_facility VARCHAR(255), next_visit_date DATE, provider UUID REFERENCES users(id), notes TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_anc_visits_maternity_enrollment_id ON anc_visits(maternity_enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_anc_visits_patient_id ON anc_visits(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_anc_visits_visit_date ON anc_visits(visit_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_anc_visits_provider ON anc_visits(provider)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_anc_visits_next_visit_date ON anc_visits(next_visit_date)`);
    
    // Ultrasound Scans
    statements.push(`CREATE TABLE IF NOT EXISTS ultrasound_scans (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), maternity_enrollment_id UUID NOT NULL REFERENCES maternity_enrollments(id) ON DELETE CASCADE, patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, scan_date DATE NOT NULL, gestational_age INTEGER, scan_type VARCHAR(50) CHECK (scan_type IN ('dating','anomaly','growth','biophysical','other')), number_of_fetuses INTEGER DEFAULT 1, fetal_viability BOOLEAN, fetal_heartbeat INTEGER, fetal_presentation VARCHAR(50), placenta_position VARCHAR(100), amniotic_fluid VARCHAR(50), afi DECIMAL(4,1), estimated_fetal_weight DECIMAL(6,2), biparietal_diameter DECIMAL(4,1), head_circumference DECIMAL(5,1), abdominal_circumference DECIMAL(5,1), femur_length DECIMAL(4,1), anomalies_detected TEXT, edd_by_ultrasound DATE, findings TEXT, performed_by UUID REFERENCES users(id), image_path TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_ultrasound_scans_maternity_enrollment_id ON ultrasound_scans(maternity_enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_ultrasound_scans_patient_id ON ultrasound_scans(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_ultrasound_scans_scan_date ON ultrasound_scans(scan_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_ultrasound_scans_scan_type ON ultrasound_scans(scan_type)`);
    
    // Deliveries
    statements.push(`CREATE TABLE IF NOT EXISTS deliveries (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), maternity_enrollment_id UUID NOT NULL REFERENCES maternity_enrollments(id) ON DELETE CASCADE, patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, delivery_date DATE NOT NULL, delivery_time TIME NOT NULL, gestational_age_at_delivery INTEGER, gestational_age_days INTEGER, admission_date TIMESTAMP WITH TIME ZONE, delivery_type VARCHAR(50) CHECK (delivery_type IN ('spontaneous_vaginal','assisted_vaginal','cesarean','instrumental')), delivery_method VARCHAR(100), indication_for_intervention TEXT, labor_onset VARCHAR(50), induction_method VARCHAR(100), duration_of_labor_hours DECIMAL(4,1), rupture_of_membranes TIMESTAMP WITH TIME ZONE, membrane_rupture_type VARCHAR(50), anesthesia_type VARCHAR(50), episiotomy BOOLEAN, perineal_tear_degree VARCHAR(20), blood_loss DECIMAL(6,1), placenta_delivery VARCHAR(50), placenta_complete BOOLEAN, maternal_complications TEXT, maternal_outcome VARCHAR(50), attending_provider UUID REFERENCES users(id), assistant_provider UUID REFERENCES users(id), notes TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_deliveries_maternity_enrollment_id ON deliveries(maternity_enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_deliveries_patient_id ON deliveries(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_deliveries_delivery_date ON deliveries(delivery_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_deliveries_delivery_type ON deliveries(delivery_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_deliveries_attending_provider ON deliveries(attending_provider)`);
    
    // Birth Outcomes
    statements.push(`CREATE TABLE IF NOT EXISTS birth_outcomes (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE, birth_order INTEGER DEFAULT 1, birth_outcome VARCHAR(50) CHECK (birth_outcome IN ('live_birth','stillbirth','neonatal_death')), sex VARCHAR(20), birth_weight DECIMAL(5,2), birth_length DECIMAL(4,1), head_circumference DECIMAL(4,1), apgar_1min INTEGER, apgar_5min INTEGER, apgar_10min INTEGER, resuscitation_required BOOLEAN, resuscitation_type TEXT, congenital_anomalies TEXT, neonatal_complications TEXT, breastfeeding_initiated BOOLEAN, breastfeeding_within_1hour BOOLEAN, vitamin_k_given BOOLEAN, eye_prophylaxis_given BOOLEAN, newborn_outcome VARCHAR(50), time_of_death TIMESTAMP WITH TIME ZONE, cause_of_death TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_birth_outcomes_delivery_id ON birth_outcomes(delivery_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_birth_outcomes_birth_outcome ON birth_outcomes(birth_outcome)`);
    
    // Postnatal Visits
    statements.push(`CREATE TABLE IF NOT EXISTS postnatal_visits (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), maternity_enrollment_id UUID NOT NULL REFERENCES maternity_enrollments(id) ON DELETE CASCADE, delivery_id UUID REFERENCES deliveries(id), patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, visit_date DATE NOT NULL, days_postpartum INTEGER, weight DECIMAL(5,2), blood_pressure_systolic INTEGER, blood_pressure_diastolic INTEGER, temperature DECIMAL(4,2), pulse INTEGER, general_condition VARCHAR(50), uterine_involution VARCHAR(50), lochia VARCHAR(50), perineum_condition VARCHAR(50), breast_condition VARCHAR(50), breastfeeding_status VARCHAR(50), breastfeeding_problems TEXT, emotional_status VARCHAR(50), danger_signs TEXT, family_planning_discussed BOOLEAN, family_planning_method VARCHAR(100), newborn_status VARCHAR(50), newborn_complications TEXT, provider UUID REFERENCES users(id), notes TEXT, next_visit_date DATE, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_postnatal_visits_maternity_enrollment_id ON postnatal_visits(maternity_enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_postnatal_visits_patient_id ON postnatal_visits(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_postnatal_visits_visit_date ON postnatal_visits(visit_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_postnatal_visits_provider ON postnatal_visits(provider)`);
    
    // Maternity Risk Factors
    statements.push(`CREATE TABLE IF NOT EXISTS maternity_risk_factors (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), maternity_enrollment_id UUID NOT NULL REFERENCES maternity_enrollments(id) ON DELETE CASCADE, risk_factor VARCHAR(100) NOT NULL, risk_category VARCHAR(20) CHECK (risk_category IN ('medical','obstetric','social')), severity VARCHAR(20) CHECK (severity IN ('low','medium','high')), identified_date DATE NOT NULL, resolved_date DATE, notes TEXT, created_by UUID REFERENCES users(id), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_maternity_risk_factors_maternity_enrollment_id ON maternity_risk_factors(maternity_enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_maternity_risk_factors_risk_category ON maternity_risk_factors(risk_category)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_maternity_risk_factors_severity ON maternity_risk_factors(severity)`);
    
    // HIV/AIDS/TB/Cervical Cancer Tables
    // HIV Test Results Table
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_tests (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, test_number VARCHAR(100) UNIQUE NOT NULL, test_date TIMESTAMP WITH TIME ZONE NOT NULL, test_type VARCHAR(50) NOT NULL CHECK (test_type IN ('rapid_antibody', 'elisa', 'pcr', 'viral_load', 'cd4')), test_kit_name VARCHAR(100), test_kit_lot VARCHAR(100), test_kit_expiry DATE, test_result VARCHAR(50) NOT NULL CHECK (test_result IN ('reactive', 'non_reactive', 'invalid', 'indeterminate', 'positive', 'negative', 'pending')), result_value VARCHAR(255), result_unit VARCHAR(50), is_confirmatory BOOLEAN DEFAULT false, confirmatory_test_id UUID REFERENCES hiv_tests(id), testing_algorithm_step INTEGER DEFAULT 1, algorithm_result VARCHAR(50) CHECK (algorithm_result IN ('positive', 'negative', 'indeterminate', 'incomplete')), tested_by UUID NOT NULL REFERENCES users(id), reviewed_by UUID REFERENCES users(id), reviewed_at TIMESTAMP WITH TIME ZONE, notes TEXT, enrolled_in_care BOOLEAN DEFAULT false, enrollment_declined BOOLEAN DEFAULT false, enrollment_declined_reason TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_tests_patient_id ON hiv_tests(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_tests_test_date ON hiv_tests(test_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_tests_test_result ON hiv_tests(test_result)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_tests_enrolled_in_care ON hiv_tests(enrolled_in_care)`);
    
    // HIV Care Enrollment Table
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_care_enrollments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, enrollment_date DATE NOT NULL, enrollment_number VARCHAR(100) UNIQUE NOT NULL, enrollment_status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (enrollment_status IN ('active', 'transferred_out', 'lost_to_followup', 'deceased', 'discontinued')), enrollment_facility VARCHAR(255), previous_care_facility VARCHAR(255), previous_care_number VARCHAR(100), date_confirmed_positive DATE, art_start_date DATE, baseline_cd4 INTEGER, baseline_viral_load DECIMAL(10,2), baseline_viral_load_unit VARCHAR(10) DEFAULT 'copies/mL', baseline_clinical_stage VARCHAR(20) CHECK (baseline_clinical_stage IN ('stage1', 'stage2', 'stage3', 'stage4')), baseline_who_stage VARCHAR(20), current_regimen VARCHAR(255), transfer_out_date DATE, transfer_out_facility VARCHAR(255), loss_to_followup_date DATE, loss_to_followup_reason TEXT, deceased_date DATE, cause_of_death TEXT, discontinued_date DATE, discontinued_reason TEXT, enrollment_notes TEXT, created_by UUID NOT NULL REFERENCES users(id), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_enrollments_patient_id ON hiv_care_enrollments(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_enrollments_enrollment_status ON hiv_care_enrollments(enrollment_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_enrollments_enrollment_number ON hiv_care_enrollments(enrollment_number)`);
    
    // HIV ART Initiation Details Table - Captures comprehensive registration/initiation data
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_art_initiation_details (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      enrollment_id UUID REFERENCES hiv_care_enrollments(id) ON DELETE CASCADE,
      
      -- OI/ART Number
      oi_art_number VARCHAR(100) UNIQUE,
      
      -- Registration Details
      date_of_registration DATE NOT NULL,
      name_of_registration_health_centre VARCHAR(255),
      age_at_registration INTEGER,
      sex_assigned_at_birth VARCHAR(10) CHECK (sex_assigned_at_birth IN ('Male', 'Female')),
      
      -- Marital Status (multiple checkboxes allowed)
      marital_status_married BOOLEAN DEFAULT false,
      marital_status_never_married BOOLEAN DEFAULT false,
      marital_status_widowed BOOLEAN DEFAULT false,
      marital_status_divorced_separated BOOLEAN DEFAULT false,
      marital_status_living_together BOOLEAN DEFAULT false,
      marital_status_minor BOOLEAN DEFAULT false,
      
      -- Patient Profile (multiple checkboxes allowed)
      patient_profile_general_population BOOLEAN DEFAULT false,
      patient_profile_sex_worker BOOLEAN DEFAULT false,
      patient_profile_msm BOOLEAN DEFAULT false,
      patient_profile_wsw BOOLEAN DEFAULT false,
      patient_profile_pwud BOOLEAN DEFAULT false,
      patient_profile_pwid BOOLEAN DEFAULT false,
      patient_profile_transgender BOOLEAN DEFAULT false,
      patient_profile_others BOOLEAN DEFAULT false,
      patient_profile_others_details VARCHAR(255),
      
      -- Education Level (single selection)
      education_level VARCHAR(20) CHECK (education_level IN ('None', 'Primary', 'Secondary', 'Tertiary')),
      
      -- Contact Information
      physical_address TEXT,
      kraal VARCHAR(255),
      village VARCHAR(255),
      school VARCHAR(255),
      clinic VARCHAR(255),
      telephone VARCHAR(50),
      cellphone VARCHAR(50),
      work_address TEXT,
      work_telephone VARCHAR(50),
      occupation VARCHAR(255),
      
      -- Next of Kin
      next_of_kin_name VARCHAR(255),
      
      -- Linkage Information (multiple checkboxes allowed)
      linkage_from_eid BOOLEAN DEFAULT false,
      linkage_from_hts BOOLEAN DEFAULT false,
      linkage_from_pmtct BOOLEAN DEFAULT false,
      linkage_from_sti BOOLEAN DEFAULT false,
      linkage_from_tb_program BOOLEAN DEFAULT false,
      linkage_from_vmmc BOOLEAN DEFAULT false,
      linkage_from_other BOOLEAN DEFAULT false,
      linkage_from_other_details VARCHAR(255),
      
      -- Orphan Status (for patients <18 years)
      orphan_status_double BOOLEAN DEFAULT false,
      orphan_status_single BOOLEAN DEFAULT false,
      orphan_status_not_orphan BOOLEAN DEFAULT false,
      
      -- HIV Test Details
      date_first_confirmed_hiv_test DATE,
      institution_name_vct_pmtct VARCHAR(255),
      hiv_test_used_antibody BOOLEAN DEFAULT false,
      hiv_test_used_pcr BOOLEAN DEFAULT false,
      
      -- Reason for HIV Test (multiple checkboxes allowed)
      reason_hiv_test_antenatal BOOLEAN DEFAULT false,
      reason_hiv_test_pep BOOLEAN DEFAULT false,
      reason_hiv_test_death_child_spouse BOOLEAN DEFAULT false,
      reason_hiv_test_prep BOOLEAN DEFAULT false,
      reason_hiv_test_hospital_illness BOOLEAN DEFAULT false,
      reason_hiv_test_spouse_child_lt5_art BOOLEAN DEFAULT false,
      reason_hiv_test_occupational BOOLEAN DEFAULT false,
      reason_hiv_test_tb BOOLEAN DEFAULT false,
      reason_hiv_test_vct BOOLEAN DEFAULT false,
      reason_hiv_test_others BOOLEAN DEFAULT false,
      reason_hiv_test_others_details VARCHAR(255),
      
      -- Confirmatory and Retesting
      confirmatory_hiv_test BOOLEAN DEFAULT false,
      retesting_hiv_for_art_initiation BOOLEAN DEFAULT false,
      
      -- Medical Insurance
      medical_insurance_scheme_name VARCHAR(255),
      medical_insurance_policy_number VARCHAR(100),
      medical_insurance_member_name VARCHAR(255),
      medical_insurance_relationship_to_member VARCHAR(100),
      
      -- Consent/Assent
      consent_personal_tracing BOOLEAN DEFAULT false,
      consent_personal_tracing_date DATE,
      consent_index_case_testing BOOLEAN DEFAULT false,
      consent_index_case_testing_date DATE,
      disclosure_hiv_status VARCHAR(10) CHECK (disclosure_hiv_status IN ('Yes', 'No')),
      disclosure_hiv_status_to_whom VARCHAR(255),
      disclosure_hiv_status_final_date DATE,
      disclosure_hiv_status_final_to_whom VARCHAR(255),
      
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_art_initiation_patient_id ON hiv_art_initiation_details(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_art_initiation_enrollment_id ON hiv_art_initiation_details(enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_art_initiation_oi_art_number ON hiv_art_initiation_details(oi_art_number)`);
    
    // HIV Clinical Visits Table - Enhanced with comprehensive data points
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_clinical_visits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      enrollment_id UUID NOT NULL REFERENCES hiv_care_enrollments(id) ON DELETE CASCADE,
      visit_number INTEGER,
      visit_date DATE NOT NULL,
      visit_type VARCHAR(10) NOT NULL CHECK (visit_type IN ('A', 'B', 'C', 'D', 'E', 'F', 'G')),
      provider_id UUID NOT NULL REFERENCES users(id),
      provider_role VARCHAR(50),
      
      -- Vital Signs
      weight_kg DECIMAL(5,2),
      height_cm DECIMAL(5,2),
      bmi DECIMAL(4,2),
      blood_pressure VARCHAR(20),
      
      -- Reproductive Health
      pregnancy_lactating_status VARCHAR(10) CHECK (pregnancy_lactating_status IN ('P', 'L', 'NPL', 'N/A')),
      first_anc_booking_date DATE,
      delivery_date DATE,
      family_planning_status TEXT[],
      
      -- Clinical Status
      functional_status VARCHAR(10) CHECK (functional_status IN ('W', 'A', 'B')),
      who_clinical_stage INTEGER CHECK (who_clinical_stage IN (1, 2, 3, 4)),
      opportunistic_infections TEXT[],
      
      -- TB Status
      tb_screening VARCHAR(10) CHECK (tb_screening IN ('Y', 'S', 'ON', 'N')),
      tb_investigation_result VARCHAR(10) CHECK (tb_investigation_result IN ('1', '2', '3', '4', '5')),
      tb_diagnosed BOOLEAN DEFAULT false,
      tb_diagnosis_date DATE,
      tb_treatment_started BOOLEAN DEFAULT false,
      
      -- TPT (Tuberculosis Preventive Therapy)
      ipt_eligibility VARCHAR(1) CHECK (ipt_eligibility IN ('Y', 'N')),
      tpt_status VARCHAR(10) CHECK (tpt_status IN ('II', 'CI', 'RI', 'IS', 'HPI', 'IC', 'INI', 'NE', 'N/A')),
      tpt_not_started_stopped_reason VARCHAR(10),
      tpt_quantity_dispensed INTEGER,
      tpt_adherence_percentage INTEGER CHECK (tpt_adherence_percentage >= 0 AND tpt_adherence_percentage <= 100),
      
      -- Prophylaxis
      cotrimoxazole_quantity_dispensed INTEGER,
      cotrimoxazole_adherence_percentage INTEGER CHECK (cotrimoxazole_adherence_percentage >= 0 AND cotrimoxazole_adherence_percentage <= 100),
      fluconazole_quantity_prescribed INTEGER,
      fluconazole_quantity_dispensed INTEGER,
      
      -- ARV Status & Regimens
      arv_status VARCHAR(10) CHECK (arv_status IN ('1', '2', '2a', '2b', '3', '4', '5', '6', '7')),
      arv_reason VARCHAR(10),
      arv_regimen_code VARCHAR(10),
      arv_regimen_name VARCHAR(255),
      arv_quantity_prescribed INTEGER,
      arv_quantity_dispensed INTEGER,
      arv_adherence_percentage INTEGER CHECK (arv_adherence_percentage >= 0 AND arv_adherence_percentage <= 100),
      regimen_changed BOOLEAN DEFAULT false,
      regimen_change_approved_by UUID REFERENCES users(id),
      regimen_change_approved_at TIMESTAMP WITH TIME ZONE,
      
      -- Lab Results
      cd4_count INTEGER,
      cd4_percentage DECIMAL(5,2),
      cd4_test_date DATE,
      viral_load DECIMAL(10,2),
      viral_load_unit VARCHAR(10) DEFAULT 'copies/mL',
      viral_load_sample_collected_date DATE,
      viral_load_result_received_date DATE,
      viral_load_test_date DATE,
      viral_load_suppressed BOOLEAN,
      alt_result DECIMAL(10,2),
      creatinine_result DECIMAL(10,2),
      other_diagnostics TEXT,
      
      -- Cryptococcal Status
      cryptococcal_signs_code VARCHAR(10),
      cryptococcal_status_code VARCHAR(10),
      cryptococcal_csf_investigation_done BOOLEAN DEFAULT false,
      cryptococcal_preemptive_treatment_result BOOLEAN,
      cryptococcal_treatment_code VARCHAR(10),
      
      -- Cervical Cancer Screening
      cervical_cancer_hpv_test_result VARCHAR(10) CHECK (cervical_cancer_hpv_test_result IN ('Pos', 'Neg', 'Pending')),
      cervical_cancer_viac_result VARCHAR(10) CHECK (cervical_cancer_viac_result IN ('Pos', 'Neg', 'Pending')),
      cervical_cancer_treatment_code VARCHAR(10),
      
      -- Mental Health
      mental_health_result_code VARCHAR(10),
      mental_health_management_code VARCHAR(10),
      
      -- TB Investigation Details
      tb_investigation_xpert_mtb_rif VARCHAR(50),
      tb_investigation_ultra_lf_lam VARCHAR(50),
      tb_investigation_tst_children VARCHAR(50),
      
      -- ARV Initiation Category
      arv_initiation_category_code VARCHAR(20),
      
      -- ARV Medicine Details
      arv_duration_prescribed VARCHAR(100),
      arv_reason_not_on_code VARCHAR(10),
      arv_reason_start_code VARCHAR(10),
      arv_change_stop_reason_code VARCHAR(10),
      
      -- Adverse Events
      adverse_events_status VARCHAR(50)[],
      
      -- Referrals & Follow-up
      referred_to VARCHAR(10),
      referred_to_details TEXT,
      next_review_date DATE,
      visit_status VARCHAR(10) CHECK (visit_status IN ('E', 'OT', 'L', 'D', 'LO')),
      follow_up_status VARCHAR(10) CHECK (follow_up_status IN ('Tx', 'Miss', 'LTFU', 'TO', 'D', 'OO', 'O')),
      follow_up_details TEXT,
      
      -- Notes & Tracking
      visit_notes TEXT,
      clinician_initials VARCHAR(50),
      pharmacy_dispenser_initials VARCHAR(50),
      
      -- Legacy fields (for backward compatibility)
      visit_type_legacy VARCHAR(50),
      cd4_count_legacy INTEGER,
      viral_load_legacy DECIMAL(10,2),
      viral_load_unit_legacy VARCHAR(10),
      viral_load_suppressed_legacy BOOLEAN,
      weight_legacy DECIMAL(5,2),
      height_legacy DECIMAL(5,2),
      bmi_legacy DECIMAL(4,2),
      blood_pressure_legacy VARCHAR(20),
      adherence_percentage_legacy INTEGER,
      side_effects_legacy TEXT[],
      opportunistic_infections_legacy TEXT[],
      tb_symptoms_legacy VARCHAR(50),
      tb_screened_legacy BOOLEAN,
      tb_screened_result_legacy VARCHAR(50),
      pregnancy_status_legacy VARCHAR(50),
      gestational_age_weeks_legacy INTEGER,
      oi_prophylaxis_legacy TEXT,
      current_regimen_legacy VARCHAR(255),
      regimen_changed_legacy BOOLEAN,
      regimen_change_reason_legacy TEXT,
      next_appointment_date_legacy DATE,
      visit_notes_legacy TEXT,
      
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_visits_enrollment_id ON hiv_clinical_visits(enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_visits_visit_date ON hiv_clinical_visits(visit_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_visits_provider_id ON hiv_clinical_visits(provider_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_visits_viral_load ON hiv_clinical_visits(viral_load)`);
    
    // Enhanced Adherence Counseling (EAC) Table - WHO Guidelines
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_eac_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      enrollment_id UUID NOT NULL REFERENCES hiv_care_enrollments(id) ON DELETE CASCADE,
      session_number INTEGER NOT NULL,
      session_date DATE NOT NULL,
      counselor_id UUID NOT NULL REFERENCES users(id),
      counselor_name VARCHAR(255),
      
      -- Adherence Assessment
      adherence_barriers TEXT[],
      barriers_other_details TEXT,
      adherence_percentage_self_reported INTEGER CHECK (adherence_percentage_self_reported >= 0 AND adherence_percentage_self_reported <= 100),
      adherence_assessment_method VARCHAR(50),
      
      -- Interventions
      interventions_provided TEXT[],
      interventions_other_details TEXT,
      medication_simplification BOOLEAN DEFAULT false,
      adherence_tools_provided TEXT[],
      support_systems_identified TEXT[],
      
      -- Patient Feedback
      patient_feedback TEXT,
      patient_concerns TEXT,
      patient_commitment_level VARCHAR(20) CHECK (patient_commitment_level IN ('High', 'Medium', 'Low')),
      
      -- Follow-up Plan
      next_session_date DATE,
      follow_up_actions TEXT[],
      follow_up_responsible_person VARCHAR(255),
      
      -- Outcome Assessment
      session_outcome VARCHAR(50) CHECK (session_outcome IN ('Completed', 'Partial', 'Missed', 'Rescheduled')),
      outcome_notes TEXT,
      adherence_improvement_observed BOOLEAN DEFAULT false,
      
      -- EAC Program Status
      eac_program_status VARCHAR(50) CHECK (eac_program_status IN ('Active', 'Completed', 'Discontinued', 'Returned to Care')),
      eac_completion_date DATE,
      return_to_conventional_care_date DATE,
      
      -- Viral Load Monitoring During EAC (WHO Guidelines)
      viral_load DECIMAL(10,2),
      viral_load_unit VARCHAR(10) DEFAULT 'copies/mL',
      viral_load_test_date DATE,
      viral_load_suppressed BOOLEAN,
      viral_load_improved BOOLEAN DEFAULT false,
      
      session_notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      
      UNIQUE(enrollment_id, session_number)
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_eac_enrollment_id ON hiv_eac_sessions(enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_eac_session_date ON hiv_eac_sessions(session_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_eac_program_status ON hiv_eac_sessions(eac_program_status)`);
    
    // Referral Management Table
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_referrals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      enrollment_id UUID NOT NULL REFERENCES hiv_care_enrollments(id) ON DELETE CASCADE,
      visit_id UUID REFERENCES hiv_clinical_visits(id) ON DELETE SET NULL,
      referral_date DATE NOT NULL DEFAULT CURRENT_DATE,
      referral_type VARCHAR(10) NOT NULL CHECK (referral_type IN ('P', 'T', 'F', 'D', 'H', 'O')),
      referral_type_details TEXT,
      referred_to_facility VARCHAR(255),
      referred_to_provider VARCHAR(255),
      referral_reason TEXT NOT NULL,
      referral_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (referral_status IN ('pending', 'in_progress', 'completed', 'declined', 'cancelled')),
      referral_priority VARCHAR(20) DEFAULT 'normal' CHECK (referral_priority IN ('urgent', 'high', 'normal', 'low')),
      referred_by UUID NOT NULL REFERENCES users(id),
      referred_by_name VARCHAR(255),
      completed_date DATE,
      completed_by UUID REFERENCES users(id),
      outcome TEXT,
      outcome_notes TEXT,
      follow_up_required BOOLEAN DEFAULT false,
      follow_up_date DATE,
      declined_reason TEXT,
      cancelled_reason TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_referrals_enrollment_id ON hiv_referrals(enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_referrals_visit_id ON hiv_referrals(visit_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_referrals_status ON hiv_referrals(referral_status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_referrals_date ON hiv_referrals(referral_date)`);
    
    // SMS/WhatsApp Reminders Table
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_reminders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      enrollment_id UUID REFERENCES hiv_care_enrollments(id) ON DELETE CASCADE,
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      reminder_type VARCHAR(50) NOT NULL CHECK (reminder_type IN ('appointment', 'viral_load_test', 'cd4_test', 'eac_session', 'medication_refill', 'follow_up')),
      reminder_date DATE NOT NULL,
      reminder_time TIME,
      message TEXT NOT NULL,
      phone_number VARCHAR(20),
      delivery_method VARCHAR(20) NOT NULL DEFAULT 'sms' CHECK (delivery_method IN ('sms', 'whatsapp', 'email')),
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'cancelled')),
      sent_at TIMESTAMP WITH TIME ZONE,
      delivered_at TIMESTAMP WITH TIME ZONE,
      failure_reason TEXT,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_reminders_enrollment_id ON hiv_reminders(enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_reminders_patient_id ON hiv_reminders(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_reminders_status ON hiv_reminders(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_reminders_date ON hiv_reminders(reminder_date)`);
    
    // Medication Stock Management Table
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_medication_stock (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      medication_name VARCHAR(255) NOT NULL,
      medication_code VARCHAR(50),
      medication_type VARCHAR(50) NOT NULL CHECK (medication_type IN ('arv', 'prophylaxis', 'tpt', 'other')),
      unit_of_measure VARCHAR(20) DEFAULT 'tablets',
      current_stock DECIMAL(10,2) NOT NULL DEFAULT 0,
      minimum_stock_level DECIMAL(10,2) NOT NULL DEFAULT 0,
      maximum_stock_level DECIMAL(10,2),
      reorder_level DECIMAL(10,2) NOT NULL DEFAULT 0,
      expiry_date DATE,
      batch_number VARCHAR(100),
      supplier VARCHAR(255),
      last_restocked_date DATE,
      last_restocked_quantity DECIMAL(10,2),
      last_restocked_by UUID REFERENCES users(id),
      notes TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_stock_medication_type ON hiv_medication_stock(medication_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_stock_active ON hiv_medication_stock(is_active)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_stock_expiry ON hiv_medication_stock(expiry_date)`);
    
    // Stock Transaction History
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_stock_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      stock_id UUID NOT NULL REFERENCES hiv_medication_stock(id) ON DELETE CASCADE,
      transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('dispensed', 'restocked', 'adjusted', 'expired', 'returned')),
      quantity DECIMAL(10,2) NOT NULL,
      balance_before DECIMAL(10,2) NOT NULL,
      balance_after DECIMAL(10,2) NOT NULL,
      transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
      reference_type VARCHAR(50),
      reference_id UUID,
      notes TEXT,
      performed_by UUID REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_transactions_stock_id ON hiv_stock_transactions(stock_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_transactions_date ON hiv_stock_transactions(transaction_date)`);
    
    // Audit Trail Table
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      enrollment_id UUID REFERENCES hiv_care_enrollments(id) ON DELETE SET NULL,
      action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('regimen_change', 'arv_status_change', 'enrollment_status_change', 'visit_created', 'visit_modified', 'lab_result_entered', 'referral_created', 'referral_updated', 'eac_session_created', 'tpt_status_change')),
      action_description TEXT NOT NULL,
      old_value JSONB,
      new_value JSONB,
      performed_by UUID NOT NULL REFERENCES users(id),
      performed_by_name VARCHAR(255),
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_audit_enrollment_id ON hiv_audit_log(enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_audit_action_type ON hiv_audit_log(action_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_audit_performed_by ON hiv_audit_log(performed_by)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_audit_created_at ON hiv_audit_log(created_at)`);
    
    // ARV Regimen Change Request Table - For Doctor Approval
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_arv_change_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      enrollment_id UUID NOT NULL REFERENCES hiv_care_enrollments(id) ON DELETE CASCADE,
      request_date DATE NOT NULL DEFAULT CURRENT_DATE,
      requested_by UUID NOT NULL REFERENCES users(id),
      requested_by_name VARCHAR(255),
      
      -- Current Status
      current_regimen_code VARCHAR(10),
      current_regimen_name VARCHAR(255),
      current_viral_load DECIMAL(10,2),
      current_viral_load_date DATE,
      previous_viral_load DECIMAL(10,2),
      previous_viral_load_date DATE,
      
      -- EAC Information
      eac_completed BOOLEAN DEFAULT false,
      eac_sessions_completed INTEGER DEFAULT 0,
      eac_completion_date DATE,
      
      -- Change Request Details
      requested_regimen_code VARCHAR(10) NOT NULL,
      requested_regimen_name VARCHAR(255) NOT NULL,
      change_reason_code VARCHAR(10),
      change_reason_details TEXT,
      clinical_justification TEXT,
      
      -- Approval Status
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
      approved_by UUID REFERENCES users(id),
      approved_by_name VARCHAR(255),
      approval_date DATE,
      approval_notes TEXT,
      rejection_reason TEXT,
      
      -- Visit Linkage
      visit_id UUID REFERENCES hiv_clinical_visits(id),
      visit_recorded BOOLEAN DEFAULT false,
      visit_recorded_date DATE,
      
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_arv_change_enrollment_id ON hiv_arv_change_requests(enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_arv_change_status ON hiv_arv_change_requests(status)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_arv_change_requested_by ON hiv_arv_change_requests(requested_by)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_arv_change_approved_by ON hiv_arv_change_requests(approved_by)`);
    
    // HIV Monitoring Schedules & Alerts
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_monitoring_schedules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      enrollment_id UUID NOT NULL REFERENCES hiv_care_enrollments(id) ON DELETE CASCADE,
      test_type VARCHAR(50) NOT NULL CHECK (test_type IN ('viral_load', 'cd4', 'creatinine', 'alt', 'other')),
      last_test_date DATE,
      last_test_result DECIMAL(10,2),
      next_scheduled_date DATE NOT NULL,
      monitoring_frequency_months INTEGER DEFAULT 3,
      is_overdue BOOLEAN DEFAULT false,
      days_overdue INTEGER DEFAULT 0,
      alert_sent BOOLEAN DEFAULT false,
      alert_sent_date DATE,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(enrollment_id, test_type)
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_monitoring_enrollment_id ON hiv_monitoring_schedules(enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_monitoring_test_type ON hiv_monitoring_schedules(test_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_monitoring_next_scheduled_date ON hiv_monitoring_schedules(next_scheduled_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_monitoring_is_overdue ON hiv_monitoring_schedules(is_overdue)`);
    
    // HIV Clinical Alerts
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_clinical_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      enrollment_id UUID NOT NULL REFERENCES hiv_care_enrollments(id) ON DELETE CASCADE,
      alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('treatment_failure', 'high_vl', 'declining_cd4', 'eac_required', 'ltfu_risk', 'overdue_test', 'adherence_concern', 'side_effects', 'regimen_change_needed', 'pregnancy_risk')),
      severity VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      related_data JSONB,
      is_resolved BOOLEAN DEFAULT false,
      resolved_at TIMESTAMP WITH TIME ZONE,
      resolved_by UUID REFERENCES users(id),
      resolved_notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_alerts_enrollment_id ON hiv_clinical_alerts(enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_alerts_type ON hiv_clinical_alerts(alert_type)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_alerts_severity ON hiv_clinical_alerts(severity)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_alerts_is_resolved ON hiv_clinical_alerts(is_resolved)`);
    // Add unique constraint for active alerts (prevents duplicate unresolved alerts)
    statements.push(`CREATE UNIQUE INDEX IF NOT EXISTS hiv_clinical_alerts_unique_active ON hiv_clinical_alerts(enrollment_id, alert_type) WHERE is_resolved = false`);
    
    // HIV Adherence Tracking
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_adherence_tracking (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      enrollment_id UUID NOT NULL REFERENCES hiv_care_enrollments(id) ON DELETE CASCADE,
      visit_id UUID REFERENCES hiv_clinical_visits(id) ON DELETE SET NULL,
      tracking_date DATE NOT NULL,
      adherence_percentage INTEGER CHECK (adherence_percentage >= 0 AND adherence_percentage <= 100),
      adherence_method VARCHAR(50) CHECK (adherence_method IN ('pill_count', 'self_report', 'pharmacy_refill', 'electronic_monitoring')),
      pills_missed INTEGER DEFAULT 0,
      pills_dispensed INTEGER,
      pills_returned INTEGER,
      missed_doses_count INTEGER DEFAULT 0,
      barriers_to_adherence TEXT[],
      interventions_provided TEXT[],
      notes TEXT,
      recorded_by UUID NOT NULL REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_adherence_enrollment_id ON hiv_adherence_tracking(enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_adherence_tracking_date ON hiv_adherence_tracking(tracking_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_adherence_visit_id ON hiv_adherence_tracking(visit_id)`);
    
    // HIV Regimen History
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_regimen_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      enrollment_id UUID NOT NULL REFERENCES hiv_care_enrollments(id) ON DELETE CASCADE,
      visit_id UUID REFERENCES hiv_clinical_visits(id) ON DELETE SET NULL,
      regimen_code VARCHAR(10),
      regimen_name VARCHAR(255),
      start_date DATE NOT NULL,
      end_date DATE,
      reason_for_change VARCHAR(50),
      reason_details TEXT,
      changed_by UUID REFERENCES users(id),
      viral_load_at_change DECIMAL(10,2),
      cd4_at_change INTEGER,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_regimen_history_enrollment_id ON hiv_regimen_history(enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_regimen_history_start_date ON hiv_regimen_history(start_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_regimen_history_is_active ON hiv_regimen_history(is_active)`);
    
    // HIV Side Effects Tracking
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_side_effects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      enrollment_id UUID NOT NULL REFERENCES hiv_care_enrollments(id) ON DELETE CASCADE,
      visit_id UUID REFERENCES hiv_clinical_visits(id) ON DELETE SET NULL,
      regimen_code VARCHAR(10),
      side_effect_type VARCHAR(100),
      severity VARCHAR(20) CHECK (severity IN ('mild', 'moderate', 'severe')),
      onset_date DATE,
      resolution_date DATE,
      intervention_provided TEXT,
      required_regimen_change BOOLEAN DEFAULT false,
      recorded_by UUID NOT NULL REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_side_effects_enrollment_id ON hiv_side_effects(enrollment_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_side_effects_regimen_code ON hiv_side_effects(regimen_code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_side_effects_visit_id ON hiv_side_effects(visit_id)`);
    
    // HIV Visit Templates
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_visit_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      visit_type VARCHAR(10),
      template_data JSONB NOT NULL,
      is_default BOOLEAN DEFAULT false,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_visit_templates_visit_type ON hiv_visit_templates(visit_type)`);
    
    // TB Screening Table
    statements.push(`CREATE TABLE IF NOT EXISTS tb_screenings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, screening_date DATE NOT NULL, screening_type VARCHAR(50) NOT NULL CHECK (screening_type IN ('symptom_screen', 'chest_xray', 'sputum_afb', 'gene_xpert', 'culture', 'lpa')), screening_result VARCHAR(50) CHECK (screening_result IN ('negative', 'positive', 'indeterminate', 'pending')), symptom_cough BOOLEAN DEFAULT false, symptom_fever BOOLEAN DEFAULT false, symptom_night_sweats BOOLEAN DEFAULT false, symptom_weight_loss BOOLEAN DEFAULT false, symptom_duration_weeks INTEGER, chest_xray_result VARCHAR(50), sputum_afb_result VARCHAR(50), gene_xpert_result VARCHAR(50), culture_result VARCHAR(50), tb_diagnosed BOOLEAN DEFAULT false, tb_diagnosis_date DATE, tb_treatment_started BOOLEAN DEFAULT false, tb_treatment_start_date DATE, screened_by UUID NOT NULL REFERENCES users(id), notes TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_tb_screenings_patient_id ON tb_screenings(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_tb_screenings_screening_date ON tb_screenings(screening_date)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_tb_screenings_tb_diagnosed ON tb_screenings(tb_diagnosed)`);
    
    // Cervical Cancer Screening Table
    statements.push(`CREATE TABLE IF NOT EXISTS cervical_cancer_screenings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, screening_date DATE NOT NULL, screening_method VARCHAR(50) NOT NULL CHECK (screening_method IN ('via', 'pap_smear', 'hpv_test', 'colposcopy')), screening_result VARCHAR(50) CHECK (screening_result IN ('normal', 'abnormal', 'positive', 'negative', 'suspicious', 'pending')), via_result VARCHAR(50), pap_result VARCHAR(50), hpv_result VARCHAR(50), hpv_types TEXT[], colposcopy_result VARCHAR(50), biopsy_required BOOLEAN DEFAULT false, biopsy_result VARCHAR(50), treatment_provided TEXT, treatment_date DATE, next_screening_date DATE, screened_by UUID NOT NULL REFERENCES users(id), reviewed_by UUID REFERENCES users(id), notes TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_cervical_screenings_patient_id ON cervical_cancer_screenings(patient_id)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_cervical_screenings_screening_date ON cervical_cancer_screenings(screening_date)`);
    
    // ============================================
    // HIV VISIT LOOKUP TABLES
    // ============================================
    
    // WHO Clinical Staging - Version 6 (January 2024)
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_who_staging (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      stage INTEGER NOT NULL CHECK (stage IN (1, 2, 3, 4)),
      category VARCHAR(20) NOT NULL CHECK (category IN ('Adults', 'Paediatrics')),
      condition_code VARCHAR(50) UNIQUE NOT NULL,
      condition_name TEXT NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_who_staging_stage ON hiv_who_staging(stage)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_who_staging_category ON hiv_who_staging(category)`);
    
    // Visit Types
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_visit_types (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_visit_types_code ON hiv_visit_types(code)`);
    
    // BMI Classifications (for reference, but can be calculated)
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_bmi_classifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      min_bmi DECIMAL(4,1),
      max_bmi DECIMAL(4,1),
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // Pregnancy/Breastfeeding Status
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_pregnancy_lactating_status (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // Family Planning Methods
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_family_planning_methods (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // Functional Status
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_functional_status (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // TB Screening Status
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_tb_screening_status (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // TB Investigation Results
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_tb_investigation_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // Opportunistic Infections and Other Problems
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_opportunistic_infections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(50),
      description TEXT,
      has_sub_categories BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oi_code ON hiv_opportunistic_infections(code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oi_category ON hiv_opportunistic_infections(category)`);
    
    // OI Sub-categories (for Hypertension, Diabetes, Hepatitis B/C, Cancer)
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_oi_sub_categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      oi_id UUID NOT NULL REFERENCES hiv_opportunistic_infections(id) ON DELETE CASCADE,
      code VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_oi_sub_categories_oi_id ON hiv_oi_sub_categories(oi_id)`);
    
    // Mental Health Screening Results
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_mental_health_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // Mental Health Management Actions
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_mental_health_management (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // TPT Eligibility
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_tpt_eligibility (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_eligible BOOLEAN,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // TPT Status
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_tpt_status (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // Cryptococcal Signs
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_cryptococcal_signs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // Cryptococcal Status
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_cryptococcal_status (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // Cryptococcal Meningitis Treatment
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_cryptococcal_treatment (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // ARV Status
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_arv_status (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // ART Initiation Category
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_art_initiation_category (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // Adverse Events Status
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_adverse_events_status (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      severity VARCHAR(20) CHECK (severity IN ('minor', 'major', 'stopping')),
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // ARV Reasons (Not on ARV)
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_arv_reasons_not_on (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // ARV Reasons (Start ARV)
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_arv_reasons_start (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // Reason for Change/Stop ARV
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_arv_change_stop_reasons (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // Visit Status
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_visit_status (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // Final Outcome
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_final_outcome (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    // ART Regimens - CRITICAL: These change frequently
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_art_regimens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      line VARCHAR(20) NOT NULL CHECK (line IN ('1st Line', '2nd Line', '3rd Line', 'Children 1st Line', 'Children 2nd Line', 'Children 3rd Line')),
      category VARCHAR(50) NOT NULL CHECK (category IN ('Adult', 'Paediatric')),
      components TEXT[] NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      is_preferred BOOLEAN DEFAULT false,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_art_regimens_code ON hiv_art_regimens(code)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_art_regimens_line ON hiv_art_regimens(line)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_art_regimens_category ON hiv_art_regimens(category)`);
    statements.push(`CREATE INDEX IF NOT EXISTS idx_art_regimens_is_active ON hiv_art_regimens(is_active)`);
    
    // Pre-Cancerous Lesion Treatment
    statements.push(`CREATE TABLE IF NOT EXISTS hiv_precancerous_lesion_treatment (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    
    return statements;
  }

  private getTriggerStatements(): string[] {
    return [
      `CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_vitals_updated_at BEFORE UPDATE ON vitals
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_triage_updated_at BEFORE UPDATE ON triage_assessments
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_nursing_notes_updated_at BEFORE UPDATE ON nursing_notes
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_medical_records_updated_at BEFORE UPDATE ON medical_records
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_prescriptions_updated_at BEFORE UPDATE ON prescriptions
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_lab_results_updated_at BEFORE UPDATE ON lab_results
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_billing_updated_at BEFORE UPDATE ON billing
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_medical_aid_claims_updated_at BEFORE UPDATE ON medical_aid_claims
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_problems_updated_at BEFORE UPDATE ON problems
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_lab_orders_updated_at BEFORE UPDATE ON lab_orders
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_lab_tests_updated_at BEFORE UPDATE ON lab_tests
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_lab_order_sets_updated_at BEFORE UPDATE ON lab_order_sets
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_critical_alerts_updated_at BEFORE UPDATE ON critical_result_alerts
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_lab_test_catalog_updated_at BEFORE UPDATE ON lab_test_catalog
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_drugs_updated_at BEFORE UPDATE ON drugs
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_drug_interactions_updated_at BEFORE UPDATE ON drug_interactions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_imaging_modalities_updated_at BEFORE UPDATE ON imaging_modalities
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_imaging_study_types_updated_at BEFORE UPDATE ON imaging_study_types
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_imaging_orders_updated_at BEFORE UPDATE ON imaging_orders
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_imaging_studies_updated_at BEFORE UPDATE ON imaging_studies
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_imaging_reports_updated_at BEFORE UPDATE ON imaging_reports
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_imaging_report_templates_updated_at BEFORE UPDATE ON imaging_report_templates
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_maternity_enrollments_updated_at BEFORE UPDATE ON maternity_enrollments
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_anc_visits_updated_at BEFORE UPDATE ON anc_visits
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_ultrasound_scans_updated_at BEFORE UPDATE ON ultrasound_scans
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_deliveries_updated_at BEFORE UPDATE ON deliveries
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_postnatal_visits_updated_at BEFORE UPDATE ON postnatal_visits
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_tests_updated_at BEFORE UPDATE ON hiv_tests
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_care_enrollments_updated_at BEFORE UPDATE ON hiv_care_enrollments
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_art_initiation_details_updated_at BEFORE UPDATE ON hiv_art_initiation_details
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_clinical_visits_updated_at BEFORE UPDATE ON hiv_clinical_visits
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_tb_screenings_updated_at BEFORE UPDATE ON tb_screenings
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_cervical_cancer_screenings_updated_at BEFORE UPDATE ON cervical_cancer_screenings
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_who_staging_updated_at BEFORE UPDATE ON hiv_who_staging
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_visit_types_updated_at BEFORE UPDATE ON hiv_visit_types
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_bmi_classifications_updated_at BEFORE UPDATE ON hiv_bmi_classifications
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_pregnancy_lactating_status_updated_at BEFORE UPDATE ON hiv_pregnancy_lactating_status
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_family_planning_methods_updated_at BEFORE UPDATE ON hiv_family_planning_methods
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_functional_status_updated_at BEFORE UPDATE ON hiv_functional_status
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_tb_screening_status_updated_at BEFORE UPDATE ON hiv_tb_screening_status
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_tb_investigation_results_updated_at BEFORE UPDATE ON hiv_tb_investigation_results
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_opportunistic_infections_updated_at BEFORE UPDATE ON hiv_opportunistic_infections
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_oi_sub_categories_updated_at BEFORE UPDATE ON hiv_oi_sub_categories
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_mental_health_results_updated_at BEFORE UPDATE ON hiv_mental_health_results
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_mental_health_management_updated_at BEFORE UPDATE ON hiv_mental_health_management
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_tpt_eligibility_updated_at BEFORE UPDATE ON hiv_tpt_eligibility
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_tpt_status_updated_at BEFORE UPDATE ON hiv_tpt_status
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_cryptococcal_signs_updated_at BEFORE UPDATE ON hiv_cryptococcal_signs
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_cryptococcal_status_updated_at BEFORE UPDATE ON hiv_cryptococcal_status
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_cryptococcal_treatment_updated_at BEFORE UPDATE ON hiv_cryptococcal_treatment
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_arv_status_updated_at BEFORE UPDATE ON hiv_arv_status
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_art_initiation_category_updated_at BEFORE UPDATE ON hiv_art_initiation_category
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_adverse_events_status_updated_at BEFORE UPDATE ON hiv_adverse_events_status
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_arv_reasons_not_on_updated_at BEFORE UPDATE ON hiv_arv_reasons_not_on
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_arv_reasons_start_updated_at BEFORE UPDATE ON hiv_arv_reasons_start
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_arv_change_stop_reasons_updated_at BEFORE UPDATE ON hiv_arv_change_stop_reasons
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_visit_status_updated_at BEFORE UPDATE ON hiv_visit_status
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_final_outcome_updated_at BEFORE UPDATE ON hiv_final_outcome
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_art_regimens_updated_at BEFORE UPDATE ON hiv_art_regimens
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_hiv_precancerous_lesion_treatment_updated_at BEFORE UPDATE ON hiv_precancerous_lesion_treatment
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`
    ];
  }

  private async seedLookupTables(tenantDataSource: DataSource): Promise<void> {
    this.logger.log('Seeding HIV lookup tables with initial data...');
    
    try {
      // Seed Visit Types
      await tenantDataSource.query(`
        INSERT INTO hiv_visit_types (code, name, description, display_order) VALUES
        ('A', 'Present Self/conventional care (not in a DSD model)', NULL, 1),
        ('B', 'Sent Care Giver / Treatment Supporter (not in DSD model)', NULL, 2),
        ('C', 'Visit made at another clinic', NULL, 3),
        ('D', 'oMalayitsha / Cross Border Transport', NULL, 4),
        ('E', 'CARG (Family, KPs, General Population)', NULL, 5),
        ('F', 'Clubs (Teen, Carer & Child, Post partum)', NULL, 6),
        ('G', 'Fast Track', NULL, 7),
        ('H', 'Outreach by Facility HCW', NULL, 8),
        ('I', 'Drop in Centre', NULL, 9),
        ('J', 'Out of Facility Community ART Distribution (OFCAD)', NULL, 10),
        ('K', 'Private Pharmacy', NULL, 11),
        ('L', 'Other, Specify', NULL, 12)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed BMI Classifications
      await tenantDataSource.query(`
        INSERT INTO hiv_bmi_classifications (code, name, min_bmi, max_bmi, display_order) VALUES
        ('UW', 'Underweight', 0, 18.4, 1),
        ('NW', 'Normal weight', 18.5, 24.9, 2),
        ('PO', 'Pre-obesity', 25.0, 29.9, 3),
        ('Ob1', 'Obesity class I', 30.0, 34.9, 4),
        ('Ob2', 'Obesity class II', 35.0, 39.9, 5),
        ('Ob3', 'Obesity class III', 40.0, NULL, 6)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed Pregnancy/Lactating Status
      await tenantDataSource.query(`
        INSERT INTO hiv_pregnancy_lactating_status (code, name, display_order) VALUES
        ('P', 'Pregnant', 1),
        ('EFF', 'Exclusive Formula Feeding', 2),
        ('MF', 'Mixed Feeding (Below 6 Months)', 3),
        ('BFCF', 'Breast Feeding & Complementary Feeding', 4),
        ('SBF', 'Stopped Breastfeeding', 5),
        ('NPL', 'Neither Pregnant nor lactating (for women)', 6),
        ('N/A', 'Not Applicable (for men & minors)', 7)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed Family Planning Methods
      await tenantDataSource.query(`
        INSERT INTO hiv_family_planning_methods (code, name, display_order) VALUES
        ('M', 'Implants', 1),
        ('Z', 'Sterilization', 2),
        ('A', 'Abstinence', 3),
        ('C', 'Condom', 4),
        ('O', 'Not using', 5),
        ('T', 'Traditional/Withdrawal', 6),
        ('P', 'Pills', 7),
        ('L', 'IUD', 8),
        ('J', 'Injections (e.g Depo)', 9),
        ('D', 'Dual Method', 10)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed Functional Status
      await tenantDataSource.query(`
        INSERT INTO hiv_functional_status (code, name, display_order) VALUES
        ('W', 'Work/School', 1),
        ('A', 'Ambulatory', 2),
        ('B', 'Bedridden', 3)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed TB Screening Status
      await tenantDataSource.query(`
        INSERT INTO hiv_tb_screening_status (code, name, display_order) VALUES
        ('Y', 'Screened and has no signs', 1),
        ('S', 'Presumptive - if there are signs', 2),
        ('ON', 'On TB Treatment', 3),
        ('N', 'TB status not assessed', 4)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed TB Investigation Results
      await tenantDataSource.query(`
        INSERT INTO hiv_tb_investigation_results (code, name, display_order) VALUES
        ('1', 'Investigated and has Active TB not started on TB treatment', 1),
        ('2', 'Investigated and had active Tuberculosis started TB treatment', 2),
        ('3', 'Investigated and has No Active TB', 3),
        ('4', 'Not Investigated', 4),
        ('5', 'Not Applicable', 5)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed Opportunistic Infections
      await tenantDataSource.query(`
        INSERT INTO hiv_opportunistic_infections (code, name, category, has_sub_categories, display_order) VALUES
        ('Z', 'Zoster', 'OI', false, 1),
        ('P', 'Pneumonia', 'OI', false, 2),
        ('D', 'Dementia/Encephalitis', 'OI', false, 3),
        ('T', 'Thrush: oral/Vaginal', 'OI', false, 4),
        ('U', 'Ulcers: mouth, genital, etc.', 'OI', false, 5),
        ('I', 'IRIS', 'OI', false, 6),
        ('W', 'Weight Loss', 'OI', false, 7),
        ('To', 'Toxoplasmosis', 'OI', false, 8),
        ('STI', 'Sexual Transmitted Infection', 'OI', false, 9),
        ('H', 'Hypertension', 'Other', true, 10),
        ('Cx', 'Cancer', 'Other', false, 11),
        ('DM', 'Diabetes (Screened)', 'Other', true, 12),
        ('HBV', 'Hepatitis B', 'Other', true, 13),
        ('HCV', 'Hepatitis C', 'Other', true, 14),
        ('O', 'Other, specify', 'Other', false, 15)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed OI Sub-categories (after getting OI IDs)
      const hptOi = await tenantDataSource.query(`SELECT id FROM hiv_opportunistic_infections WHERE code = 'H'`);
      const dmOi = await tenantDataSource.query(`SELECT id FROM hiv_opportunistic_infections WHERE code = 'DM'`);
      const hbvOi = await tenantDataSource.query(`SELECT id FROM hiv_opportunistic_infections WHERE code = 'HBV'`);
      const hcvOi = await tenantDataSource.query(`SELECT id FROM hiv_opportunistic_infections WHERE code = 'HCV'`);

      if (hptOi.length > 0) {
        await tenantDataSource.query(`
          INSERT INTO hiv_oi_sub_categories (oi_id, code, name, display_order) VALUES
          ('${hptOi[0].id}', 'HPT 2', 'Diagnosed', 1),
          ('${hptOi[0].id}', 'HPT 3', 'Managed', 2)
          ON CONFLICT (code) DO NOTHING
        `);
      }

      if (dmOi.length > 0) {
        await tenantDataSource.query(`
          INSERT INTO hiv_oi_sub_categories (oi_id, code, name, display_order) VALUES
          ('${dmOi[0].id}', 'D1', 'Screened', 1),
          ('${dmOi[0].id}', 'T1D', 'Diabetes Type I', 2),
          ('${dmOi[0].id}', 'T2D', 'Diabetes Type II', 3),
          ('${dmOi[0].id}', 'D3', 'Managed for Diabetes', 4)
          ON CONFLICT (code) DO NOTHING
        `);
      }

      if (hbvOi.length > 0) {
        await tenantDataSource.query(`
          INSERT INTO hiv_oi_sub_categories (oi_id, code, name, display_order) VALUES
          ('${hbvOi[0].id}', 'HBV 1', 'Tested', 1),
          ('${hbvOi[0].id}', 'HBV 2', 'Positive', 2),
          ('${hbvOi[0].id}', 'HBV 3', 'on a TDF based regimen', 3)
          ON CONFLICT (code) DO NOTHING
        `);
      }

      if (hcvOi.length > 0) {
        await tenantDataSource.query(`
          INSERT INTO hiv_oi_sub_categories (oi_id, code, name, display_order) VALUES
          ('${hcvOi[0].id}', 'HCV 1', 'Tested', 1),
          ('${hcvOi[0].id}', 'HCV 2', 'Positive', 2),
          ('${hcvOi[0].id}', 'HCV 3', 'Treated', 3),
          ('${hcvOi[0].id}', 'HCV 4', 'Cured', 4)
          ON CONFLICT (code) DO NOTHING
        `);
      }

      // Seed Mental Health Results
      await tenantDataSource.query(`
        INSERT INTO hiv_mental_health_results (code, name, display_order) VALUES
        ('N', 'Not screened', 1),
        ('ND', 'No Mental Health Disorders', 2),
        ('D', 'Depression', 3),
        ('A', 'Anxiety', 4),
        ('SA', 'Substance Misuse', 5),
        ('O', 'Other, Specify', 6)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed Mental Health Management
      await tenantDataSource.query(`
        INSERT INTO hiv_mental_health_management (code, name, display_order) VALUES
        ('R', 'Referred', 1),
        ('Rx', 'Treated', 2),
        ('NT', 'Not treated', 3),
        ('N/A', 'Not Applicable', 4)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed TPT Eligibility
      await tenantDataSource.query(`
        INSERT INTO hiv_tpt_eligibility (code, name, is_eligible, display_order) VALUES
        ('Y', 'Eligible for TPT', true, 1),
        ('TB', 'Active TB disease', false, 2),
        ('ON', 'On TB treatment', false, 3),
        ('AL', 'Active Liver disease', false, 4),
        ('AA', 'Heavy Alcohol Abuse', false, 5),
        ('CPT', 'Completed IPT in the past = 3yrs', false, 6),
        ('DDI', 'Drug to Drug interactions', false, 7)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed TPT Status
      await tenantDataSource.query(`
        INSERT INTO hiv_tpt_status (code, name, display_order) VALUES
        ('AT', 'Active TB disease', 1),
        ('II', 'INH Initiated', 2),
        ('3I', '3HP Initiated', 3),
        ('CT', 'Continue INH', 4),
        ('TC', 'INH Completed', 5),
        ('RI', 'Restart INH', 6),
        ('R3', 'Restart 3HP', 7),
        ('TNI', 'TPT Not Initiated due to available regimens', 8),
        ('PN', 'INH Stopped due to Peripheral Neuropathy', 9),
        ('PP', 'Patient Refused INH', 10)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed Cryptococcal Signs
      await tenantDataSource.query(`
        INSERT INTO hiv_cryptococcal_signs (code, name, display_order) VALUES
        ('Y', 'Screened has no signs', 1),
        ('S', 'Presumptive Cryptococcal Signs', 2),
        ('N', 'Not assessed', 3)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed Cryptococcal Status
      await tenantDataSource.query(`
        INSERT INTO hiv_cryptococcal_status (code, name, display_order) VALUES
        ('1', 'Yes (Positive)', 1),
        ('2', 'Yes (Negative)', 2),
        ('3', 'N-Not Assessed', 3)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed Cryptococcal Treatment
      await tenantDataSource.query(`
        INSERT INTO hiv_cryptococcal_treatment (code, name, display_order) VALUES
        ('a', 'Liposomal Amphotericin B, Flucytosine + Fluconazole', 1),
        ('b', 'Liposomal Amphotericin B + Flucytosine', 2),
        ('c', 'Fluconazole + Flucytosine', 3),
        ('d', 'Others Specify', 4)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed ARV Status
      await tenantDataSource.query(`
        INSERT INTO hiv_arv_status (code, name, display_order) VALUES
        ('1', 'No ARV', 1),
        ('2a', 'Start ARV', 2),
        ('2b', 'Start ARV (Pregnant)', 3),
        ('3', 'Continue', 4),
        ('4', 'Change', 5),
        ('5', 'Stop', 6),
        ('6', 'Restart', 7),
        ('7', 'Transfer Out', 8)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed ART Initiation Category
      await tenantDataSource.query(`
        INSERT INTO hiv_art_initiation_category (code, name, display_order) VALUES
        ('N1', 'Newly Initiated ART', 1),
        ('N2.1', 'Re-initiation < 3 months after stopping ART', 2),
        ('N2.2', 'Re-initiation 3-5 months after stopping ART', 3),
        ('N2.3', 'Re-initiation 6+ months after stopping ART', 4),
        ('N3.1', 'Re-engagement <3 months after lost to follow up', 5),
        ('N3.2', 'Re-engagement 3-5 months after lost to follow up', 6),
        ('N3.3', 'Re-engagement 6+ months after lost to follow up', 7),
        ('N4', 'transfer in on ART from the private sector or diaspora', 8)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed Adverse Events Status
      await tenantDataSource.query(`
        INSERT INTO hiv_adverse_events_status (code, name, severity, display_order) VALUES
        ('a', 'INH1-minor adverse events reported on INH', 'minor', 1),
        ('b', 'INH2-stopping INH due to adverse events', 'stopping', 2),
        ('C1', '3HP1-minor adverse events reported on 3HP', 'minor', 3),
        ('C2', '3HP1-stopping 3HP1 due to adverse events', 'stopping', 4),
        ('c', 'CTX1-minor adverse event reported on CTX', 'minor', 5),
        ('d', 'CTX2-stopping CTX due to adverse events', 'stopping', 6),
        ('e', 'Diflucan1-minor adverse events reported on Diflucan', 'minor', 7),
        ('f', 'Diflucan 2-stopping Diflucan due to adverse events', 'stopping', 8),
        ('g', 'ART 1st Line1-minor adverse events reported on 1st Line ART', 'minor', 9),
        ('h', 'ART 1st Line 2-stopping 1st Line ART due to adverse events', 'stopping', 10),
        ('i', 'ART 2nd regimen1-minor adverse events reported on 2-line ART', 'minor', 11),
        ('J', 'ART 2nd regimen2-stopping 2nd-line ART due to adverse events', 'stopping', 12),
        ('k', 'ART 3rd regimen1-minor adverse events reported on Third line ART', 'minor', 13),
        ('l', 'ART 3rd regimen2 - stopping Third line ART due to adverse events', 'stopping', 14)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed ARV Reasons (Not on ARV)
      await tenantDataSource.query(`
        INSERT INTO hiv_arv_reasons_not_on (code, name, display_order) VALUES
        ('11', 'No psychologically ready', 1),
        ('13', 'No ARVs available', 2),
        ('14', 'Not willing', 3),
        ('15', 'On Initial 2 weeks of TB Treatment', 4),
        ('16', 'Awaits Lab results', 5),
        ('17', 'Has OI and is too sick to start', 6),
        ('18', 'No start-other', 7),
        ('19', 'On initial 4 weeks of Cryptococcal Meningitis treatment', 8)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed ARV Reasons (Start ARV)
      await tenantDataSource.query(`
        INSERT INTO hiv_arv_reasons_start (code, name, display_order) VALUES
        ('215', 'Treat all', 1),
        ('216', 'Pregnant women', 2),
        ('217', 'Lactation women', 3),
        ('218', 'Other (Specify)', 4)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed ARV Change/Stop Reasons
      await tenantDataSource.query(`
        INSERT INTO hiv_arv_change_stop_reasons (code, name, display_order) VALUES
        ('401', 'Start TB Rx', 1),
        ('402', 'Nausea/Vomiting', 2),
        ('403', 'Diarrhoea', 3),
        ('404', 'Headache', 4),
        ('405', 'Fever', 5),
        ('406', 'Rash', 6),
        ('407', 'Peripheral Neuropathy', 7),
        ('408', 'Hepatitis', 8),
        ('409', 'Jaundice', 9),
        ('410', 'Dementia', 10),
        ('411', 'Anemia', 11),
        ('413', 'CNS Adverse event', 12),
        ('414', 'Other Adverse event (specify)', 13),
        ('415', 'Treatment Failure, clinical', 14),
        ('416', 'Treatment Failure, immunological', 15),
        ('417', 'Poor Adherence', 16),
        ('418', 'Patient Decision', 17),
        ('421', 'Stock out', 18),
        ('422', 'Other reason (specify)', 19),
        ('424', 'Virological Failure', 20),
        ('425', 'Weight gain>10%', 21),
        ('427', 'Treatment optimization', 22)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed Visit Status
      await tenantDataSource.query(`
        INSERT INTO hiv_visit_status (code, name, display_order) VALUES
        ('E', 'Earlier than review date', 1),
        ('OT', 'On time', 2),
        ('L', 'Late but not defaulter', 3),
        ('D', 'Default<28days', 4)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed Final Outcome
      await tenantDataSource.query(`
        INSERT INTO hiv_final_outcome (code, name, display_order) VALUES
        ('Tx', 'active on treatment', 1),
        ('Miss', '1 or 2 missing Appointments', 2),
        ('LTFU', 'Lost to Follow-up', 3),
        ('TO', 'Transfer Out (specify)', 4),
        ('D', 'Patient Died', 5),
        ('OO', 'Patient Opted Out', 6),
        ('O', 'Other, specify', 7)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed Pre-Cancerous Lesion Treatment
      await tenantDataSource.query(`
        INSERT INTO hiv_precancerous_lesion_treatment (code, name, display_order) VALUES
        ('N', 'No treatment done', 1),
        ('VC', 'VIAC Pos, Cryotherapy Done', 2),
        ('VT', 'VIAC Pos, Thermal Ablation Done', 3),
        ('VL', 'VIAC Pos, LEEP Done', 4),
        ('SC', 'Suspected Cancer', 5),
        ('H', 'Hysterectomy', 6),
        ('R', 'Refer for Further clinical investigation if HPV Neg, but VIAC Pos', 7)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed WHO Staging (Adults)
      const whoStagingAdults = [
        { stage: 1, conditions: ['Asymptomatic', 'Persistent Generalised Lymphadenopathy (PGL)'] },
        { stage: 2, conditions: ['Weight loss, <10% of body weight', 'Recurrent RTI (Respiratory Tract Infection)', 'Herpes Zoster', 'Angular Cheilitis', 'Recurrent ulcerations occurring twice or more then in six months', 'Papular pruritic eruptions', 'Seborrheic dermatitis', 'Fungal nail infections of the fingers'] },
        { stage: 3, conditions: ['Weight loss; >10% of body weight', 'Unexplained chronic diarrhoea >1 month', 'Unexplained prolonged fever >1 month', 'Pulmonary Tuberculosis, current or within the past 2 months or TB adenitis', 'Severe infection including pneumonia, meningitis, bone or joint infection', 'Oral Candidiasis', 'Oral hairy leukoplakia', 'Acute necrotising ulcerative gingivitis or necrotizing ulcerative periodontitis', 'Unexplained anaemia >1 month'] },
        { stage: 4, conditions: ['HIV wasting syndrome', 'Pneumocystis Pneumonia', 'Recurrent severe or radiological bacterial pneumonia (two or more episodes within a year)', 'Cryptococcal meningitis or other extra pulmonary', 'Cryptococcus infections', 'Extra Pulmonary Tuberculosis except TB adenitis', 'Kaposi Sarcoma', 'HIV Encephalopathy', 'Candidiasis of the oesophagus, trachea, bronchi or lungs', 'Chronic Herpes simplex virus (HSV) infection (orolabial, genital or anorectal >1 month, or visceral any duration)', 'Cytomegalovirus (CMV) disease of an organ other than liver, spleen or lymph nodes', 'Progressive Multifocal Leukoencephalopathy (PML)', 'Any disseminated mycosis (e.g. histoplasmosis, coccidioidomycosis, or penicilliosis)', 'Lymphoma (cerebral or B cell non-Hodgkin)', 'Recurrent non typhoidal salmonella septicaemia (2 or more episodes in last year)', 'Invasive cervical cancer', 'Visceral leishmaniosis', 'Cryptosporidiosis with diarrhoea lasting more than 1 month', 'Psoriasis', 'Disseminated non-tuberculous mycobacterial infection', 'CNS toxoplasmosis'] }
      ];

      for (const stageData of whoStagingAdults) {
        let order = 1;
        for (const condition of stageData.conditions) {
          const conditionCode = `ADULT_ST${stageData.stage}_${order}`.replace(/\s+/g, '_').toUpperCase().substring(0, 50);
          await tenantDataSource.query(`
            INSERT INTO hiv_who_staging (stage, category, condition_code, condition_name, display_order)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (condition_code) DO NOTHING
          `, [stageData.stage, 'Adults', conditionCode, condition, order]);
          order++;
        }
      }

      // Seed WHO Staging (Paediatrics)
      const whoStagingPaed = [
        { stage: 1, conditions: ['Asymptomatic', 'PGL'] },
        { stage: 2, conditions: ['Hepatosplenomegaly', 'Papular pruritic eruptions', 'Seborrheic dermatitis', 'Fungal nail infections of the fingers', 'Angular Cheilitis', 'Lineal Gingival erythema (LGE)', 'Human Papilloma Virus infection (extensive facial >5% of body area or disfiguring)', 'Molluscum contagiosum infection (extensive facial >5% of body area or disfiguring)', 'Recurrent ulcerations occurring twice or more then in six months', 'Parotid enlargement', 'Herpes Zoster', 'Recurrent Respiratory Tract Infections (RTI) (twice or more in any six month period)'] },
        { stage: 3, conditions: ['Unexplained malnutrition (very low weight for age; up to 2 standard deviations)', 'Unexplained persistent diarrhoea (> 14 days and above)', 'Unexplained persistent fever (intermittent or constant and for longer than 1 month)', 'Oral Candidiasis (outside first 6 weeks of life)', 'Oral hairy leukoplakia', 'Pulmonary Tuberculosis', 'Severe presumed bacterial pneumonia', 'Acute necrotising ulcerative gingivitis, or stomatitis or acute necrotizing ulcerative periodontitis', 'Symptomatic Lymphocytic Interstitial Pneumonia', 'Chronic HIV associated disease (including bronchiectasis)', 'Unexplained anaemia or neutropenia >1 monthly'] },
        { stage: 4, conditions: ['Unexplained severe wasting or severe malnutrition not adequately responding to standard therapy', 'Pneumocystis Jirovecci Pneumonia (PJP)', 'Recurrent severe presumed bacterial infection (e.g. meningitis, empyema, pyomyocitis bone or joint infection, bacteraemia)', 'Chronic Herpes simplex virus infection (chronic orolabial or intraoral lesions, of more than 1 month or visceral of any duration)', 'Extra pulmonary Tuberculosis', 'Kaposi Sarcoma', 'HIV Encephalopathy', 'Candidiasis of the oesophagus, trachea, bronchi or lungs', 'Cytomegalovirus (CMV) disease of an organ other than liver, spleen or lymph nodes with onset of age >1 month', 'Cryptococcal Meningitis', 'PML', 'Disseminated mycobacteriosis other than TB', 'Any disseminated mycosis (e.g. histoplasmosis, coccidioidomycosis, or penicilliosis)', 'Lymphoma (cerebral or B cell non-Hodgkin)', 'Cryptosporidiosis with diarrhoea lasting more than 1 month', 'Psoriasis', 'CNS toxoplasmosis (outside the neonatal period)', 'Acquired HIV-associated rectal fistula, including rectovaginal fistula', 'HIV associated nephropathy', 'HIV associated cardiomyopathy'] }
      ];

      for (const stageData of whoStagingPaed) {
        let order = 1;
        for (const condition of stageData.conditions) {
          const conditionCode = `PAED_ST${stageData.stage}_${order}`.replace(/\s+/g, '_').toUpperCase().substring(0, 50);
          await tenantDataSource.query(`
            INSERT INTO hiv_who_staging (stage, category, condition_code, condition_name, display_order)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (condition_code) DO NOTHING
          `, [stageData.stage, 'Paediatrics', conditionCode, condition, order]);
          order++;
        }
      }

      // Seed ART Regimens - Adult 1st Line
      await tenantDataSource.query(`
        INSERT INTO hiv_art_regimens (code, name, line, category, components, is_preferred, display_order) VALUES
        ('1c', 'AZT+3TC+NVP', '1st Line', 'Adult', ARRAY['AZT', '3TC', 'NVP'], false, 1),
        ('1d', 'AZT+3TC+EFV', '1st Line', 'Adult', ARRAY['AZT', '3TC', 'EFV'], false, 2),
        ('1e', 'TDF+3TC+NVP', '1st Line', 'Adult', ARRAY['TDF', '3TC', 'NVP'], false, 3),
        ('1f', 'TDF+3TC+EFV', '1st Line', 'Adult', ARRAY['TDF', '3TC', 'EFV'], false, 4),
        ('1g', 'AZT+3TC+EFV400', '1st Line', 'Adult', ARRAY['AZT', '3TC', 'EFV400'], false, 5),
        ('1h', 'TDF+3TC+EFV400', '1st Line', 'Adult', ARRAY['TDF', '3TC', 'EFV400'], false, 6),
        ('1i', 'TDF+3TC+DTG(TLD1)', '1st Line', 'Adult', ARRAY['TDF', '3TC', 'DTG'], true, 7),
        ('1j', 'AZT+3TC+DTG', '1st Line', 'Adult', ARRAY['AZT', '3TC', 'DTG'], false, 8),
        ('1k', 'TDF+FTC+EFV400', '1st Line', 'Adult', ARRAY['TDF', 'FTC', 'EFV400'], false, 9),
        ('1l', 'TAF+FTC+EFV400', '1st Line', 'Adult', ARRAY['TAF', 'FTC', 'EFV400'], false, 10),
        ('1m', 'TDF+FTC+ATC/r', '1st Line', 'Adult', ARRAY['TDF', 'FTC', 'ATC/r'], false, 11),
        ('1n', 'TDF+3TC+ATC/r', '1st Line', 'Adult', ARRAY['TDF', '3TC', 'ATC/r'], false, 12),
        ('1o', 'TDF+3TC+ATV/r', '1st Line', 'Adult', ARRAY['TDF', '3TC', 'ATV/r'], false, 13),
        ('1p', 'TAF+FTC+ATV/r', '1st Line', 'Adult', ARRAY['TAF', 'FTC', 'ATV/r'], false, 14),
        ('1q', 'TAF+3TC+ATV/r', '1st Line', 'Adult', ARRAY['TAF', '3TC', 'ATV/r'], false, 15),
        ('1r', 'ABC+3TC+DTG', '1st Line', 'Adult', ARRAY['ABC', '3TC', 'DTG'], false, 16),
        ('1s', 'Other, Specify', '1st Line', 'Adult', ARRAY['Other'], false, 17)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed ART Regimens - Adult 2nd Line
      await tenantDataSource.query(`
        INSERT INTO hiv_art_regimens (code, name, line, category, components, is_preferred, display_order) VALUES
        ('2a', 'AZT+3TC+ILPV/r', '2nd Line', 'Adult', ARRAY['AZT', '3TC', 'LPV/r'], false, 1),
        ('2b', 'TDF+3TC+LPV/r', '2nd Line', 'Adult', ARRAY['TDF', '3TC', 'LPV/r'], false, 2),
        ('2c', 'ABC+DDI250+LPV/r', '2nd Line', 'Adult', ARRAY['ABC', 'DDI250', 'LPV/r'], false, 3),
        ('2d', 'AZT+3TC+ATV/r', '2nd Line', 'Adult', ARRAY['AZT', '3TC', 'ATV/r'], false, 4),
        ('2e', 'TDF+3TC+ATV/r', '2nd Line', 'Adult', ARRAY['TDF', '3TC', 'ATV/r'], false, 5),
        ('2f', 'ABC+DDI250+ATV/r', '2nd Line', 'Adult', ARRAY['ABC', 'DDI250', 'ATV/r'], false, 6),
        ('2g', 'ABC+DDI400+LPV/r', '2nd Line', 'Adult', ARRAY['ABC', 'DDI400', 'LPV/r'], false, 7),
        ('2h', 'AZT+DDI250+LPV/r', '2nd Line', 'Adult', ARRAY['AZT', 'DDI250', 'LPV/r'], false, 8),
        ('2i', 'AZT+DDI400+LPV/r', '2nd Line', 'Adult', ARRAY['AZT', 'DDI400', 'LPV/r'], false, 9),
        ('2j', 'ABC+DDI400+ATV/r', '2nd Line', 'Adult', ARRAY['ABC', 'DDI400', 'ATV/r'], false, 10),
        ('2k', 'ABC+3TC+DTG', '2nd Line', 'Adult', ARRAY['ABC', '3TC', 'DTG'], false, 11),
        ('2l', 'AZT+3TC+DTG', '2nd Line', 'Adult', ARRAY['AZT', '3TC', 'DTG'], false, 12),
        ('2m', 'TDF+3TC+DTG(TLD2)', '2nd Line', 'Adult', ARRAY['TDF', '3TC', 'DTG'], true, 13),
        ('2n', 'TAF+3TC+DTG', '2nd Line', 'Adult', ARRAY['TAF', '3TC', 'DTG'], false, 14),
        ('2o', 'Other, Specify', '2nd Line', 'Adult', ARRAY['Other'], false, 15)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed ART Regimens - Adult 3rd Line
      await tenantDataSource.query(`
        INSERT INTO hiv_art_regimens (code, name, line, category, components, is_preferred, display_order) VALUES
        ('3a', 'RAL/DRV/RTV', '3rd Line', 'Adult', ARRAY['RAL', 'DRV', 'RTV'], false, 1),
        ('3b', 'Other, Specify', '3rd Line', 'Adult', ARRAY['Other'], false, 2)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed ART Regimens - Children 1st/2nd Line (Codes 4c-4k)
      await tenantDataSource.query(`
        INSERT INTO hiv_art_regimens (code, name, line, category, components, is_preferred, display_order) VALUES
        ('4c', 'AZT+3TC+NVP', 'Children 1st Line', 'Paediatric', ARRAY['AZT', '3TC', 'NVP'], false, 1),
        ('4d', 'AZT+3TC+EFV', 'Children 1st Line', 'Paediatric', ARRAY['AZT', '3TC', 'EFV'], false, 2),
        ('4e', 'AZT+3TC+LPV/r', 'Children 1st Line', 'Paediatric', ARRAY['AZT', '3TC', 'LPV/r'], false, 3),
        ('4f', 'ABC+DDI+LPV/r', 'Children 1st Line', 'Paediatric', ARRAY['ABC', 'DDI', 'LPV/r'], false, 4),
        ('4g', 'ABC+3TC+LPV/r', 'Children 1st Line', 'Paediatric', ARRAY['ABC', '3TC', 'LPV/r'], false, 5),
        ('4h', 'ABC+3TC+EFV', 'Children 1st Line', 'Paediatric', ARRAY['ABC', '3TC', 'EFV'], false, 6),
        ('4i', 'AZT+3TC+RAL', 'Children 1st Line', 'Paediatric', ARRAY['AZT', '3TC', 'RAL'], false, 7),
        ('4j', 'ABC+3TC+DTG', 'Children 1st Line', 'Paediatric', ARRAY['ABC', '3TC', 'DTG'], false, 8),
        ('4k', 'TDF+3TC+DTG', 'Children 1st Line', 'Paediatric', ARRAY['TDF', '3TC', 'DTG'], false, 9)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed ART Regimens - Children 2nd Line (Codes 5a-5m)
      await tenantDataSource.query(`
        INSERT INTO hiv_art_regimens (code, name, line, category, components, is_preferred, display_order) VALUES
        ('5a', 'ABC+DDI+LPV/r', 'Children 2nd Line', 'Paediatric', ARRAY['ABC', 'DDI', 'LPV/r'], false, 1),
        ('5b', 'ABC+3TC+LPV/r', 'Children 2nd Line', 'Paediatric', ARRAY['ABC', '3TC', 'LPV/r'], false, 2),
        ('5c', 'AZT+3TC+NPV', 'Children 2nd Line', 'Paediatric', ARRAY['AZT', '3TC', 'NVP'], false, 3),
        ('5e', 'ABC+DDI+LPV/r', 'Children 2nd Line', 'Paediatric', ARRAY['ABC', 'DDI', 'LPV/r'], false, 4),
        ('5f', 'ABC+3TC+NPV', 'Children 2nd Line', 'Paediatric', ARRAY['ABC', '3TC', 'NVP'], false, 5),
        ('5g', 'ABC+3TC+DTG', 'Children 2nd Line', 'Paediatric', ARRAY['ABC', '3TC', 'DTG'], false, 6),
        ('5h', 'TDF+3TC+ATV/r', 'Children 2nd Line', 'Paediatric', ARRAY['TDF', '3TC', 'ATV/r'], false, 7),
        ('5i', 'TDF+3TC+DTG', 'Children 2nd Line', 'Paediatric', ARRAY['TDF', '3TC', 'DTG'], false, 8),
        ('5j', 'AZT+3TC+DTG', 'Children 2nd Line', 'Paediatric', ARRAY['AZT', '3TC', 'DTG'], false, 9),
        ('5k', 'TDF+3TC+LPV/r', 'Children 2nd Line', 'Paediatric', ARRAY['TDF', '3TC', 'LPV/r'], false, 10),
        ('5l', 'AZT+3TC+LPV/r', 'Children 2nd Line', 'Paediatric', ARRAY['AZT', '3TC', 'LPV/r'], false, 11),
        ('5m', 'Other, Specify', 'Children 2nd Line', 'Paediatric', ARRAY['Other'], false, 12)
        ON CONFLICT (code) DO NOTHING
      `);

      // Seed ART Regimens - Children 3rd Line (Codes 6a-6c)
      await tenantDataSource.query(`
        INSERT INTO hiv_art_regimens (code, name, line, category, components, is_preferred, display_order) VALUES
        ('6a', 'RAL/DRV/RTV', 'Children 3rd Line', 'Paediatric', ARRAY['RAL', 'DRV', 'RTV'], false, 1),
        ('6b', 'DTG+DRV+2NRTIs', 'Children 3rd Line', 'Paediatric', ARRAY['DTG', 'DRV', '2NRTIs'], false, 2),
        ('6c', 'Other, Specify', 'Children 3rd Line', 'Paediatric', ARRAY['Other'], false, 3)
        ON CONFLICT (code) DO NOTHING
      `);

      this.logger.log('HIV lookup tables seeded successfully');
    } catch (error) {
      this.logger.error('Error seeding lookup tables:', error);
      // Don't throw - allow schema to be created even if seeding fails
    }
  }

  private async seedDefaultUsers(tenantDataSource: DataSource): Promise<void> {
    this.logger.log('Seeding default clinical users (doctor, nurse, radiologist)...');

    const defaultPasswordHash = '$2b$10$53yYB1QraHibRFYL1g1Bzu9zRcQ90b5QciaSd9GBmo5laFu8lqVbC'; // Password1#

    await tenantDataSource.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, role, license_number, specialization, phone, must_change_password)
      VALUES
        ('doctor@bulawayo-general.co.zw', '${defaultPasswordHash}', 'Doctor', 'Bulawayo', 'doctor', 'MD-0001', 'Internal Medicine', '+263 77 555 1000', false),
        ('nurse@bulawayo-general.co.zw', '${defaultPasswordHash}', 'Nurse', 'Dube', 'nurse', 'RN-0008', 'Maternal & Child Health', '+263 77 555 2000', false),
        ('radiologist@bulawayo-general.co.zw', '${defaultPasswordHash}', 'Rudo', 'Munyoro', 'radiologist', 'RAD-001234', 'Diagnostic Radiology', '+263 77 555 1212', false)
      ON CONFLICT (email) DO NOTHING;
    `);
  }

  private async seedLabCatalog(tenantDataSource: DataSource): Promise<void> {
    this.logger.log('Seeding baseline laboratory catalog...');

    await tenantDataSource.query(`
      INSERT INTO lab_test_catalog (test_code, loinc_code, test_name, category, specimen_type, specimen_volume, container_type, turnaround_time, cost, description, clinical_significance, is_active)
      VALUES
        ('CBC', '58410-2', 'Complete Blood Count (CBC)', 'Hematology', 'Whole Blood', '3-5 mL', 'EDTA (Purple Top)', 2, 15.00,
         'Comprehensive blood test measuring red and white cells with platelets',
         'Evaluates overall health, detects anemia, infection, and blood disorders', true),
        ('BMP', '51990-0', 'Basic Metabolic Panel', 'Chemistry', 'Serum', '5 mL', 'Red Top or Gold Top', 3, 25.00,
         'Glucose, calcium, electrolytes, and kidney function tests',
         'Evaluates kidney function, electrolyte balance, and blood sugar levels', true),
        ('LIPID', '57698-3', 'Lipid Panel', 'Chemistry', 'Serum', '5 mL', 'Red Top or Gold Top', 4, 30.00,
         'Measures cholesterol and triglycerides to assess cardiovascular risk',
         'Screens for risk of heart disease and stroke', true),
        ('LFT', '24325-3', 'Liver Function Tests', 'Chemistry', 'Serum', '5 mL', 'Red Top or Gold Top', 4, 35.00,
         'Measures liver enzymes and proteins to assess liver function',
         'Detects liver disease, damage, or dysfunction', true),
        ('HBA1C', '4548-4', 'Hemoglobin A1C', 'Chemistry', 'Whole Blood', '2 mL', 'EDTA (Purple Top)', 3, 20.00,
         'Measures average blood glucose control over the past 2-3 months',
         'Monitors long-term diabetes control', true),
        ('MALARIA', NULL, 'Malaria Rapid Test (RDT)', 'Microbiology', 'Whole Blood', '5 µL', 'Capillary or EDTA', 1, 5.00,
         'Rapid diagnostic test for Plasmodium species antigens',
         'Detects active malaria infection', true),
        ('HIV', NULL, 'HIV Rapid Antibody Test', 'Serology', 'Whole Blood or Serum', '50 µL', 'Capillary or Red Top', 1, 8.00,
         'Rapid antibody test for HIV-1 and HIV-2',
         'Screens for HIV infection', true),
        ('VDRL', '5292-8', 'VDRL (Syphilis Screen)', 'Serology', 'Serum', '2 mL', 'Red Top', 2, 10.00,
         'Screening test for syphilis antibodies',
         'Detects active or past syphilis infection', true),
        ('HBSAG', '5196-1', 'Hepatitis B Surface Antigen', 'Serology', 'Serum', '2 mL', 'Red Top', 2, 12.00,
         'Tests for active Hepatitis B infection',
         'Screens for Hepatitis B virus', true),
        ('UA', '24356-8', 'Urinalysis (Complete)', 'Urinalysis', 'Urine', '10-15 mL', 'Sterile Container', 2, 10.00,
         'Complete urinalysis including physical, chemical, and microscopic examination',
         'Screens for urinary tract infections, kidney disease, and metabolic disorders', true),
        ('HCG', '21198-7', 'Pregnancy Test (HCG)', 'Serology', 'Urine or Serum', '5 mL', 'Sterile Container or Red Top', 1, 8.00,
         'Qualitative test for human chorionic gonadotropin',
         'Confirms pregnancy', true)
      ON CONFLICT (test_code) DO NOTHING;
    `);

    await tenantDataSource.query(`
      INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_min, reference_range_max, critical_low, critical_high, gender_specific, sort_order)
      SELECT id, 'Hemoglobin', 'HGB', '718-7', 'g/dL', 12.0, 17.5, 7.0, 20.0, true, 1 FROM lab_test_catalog WHERE test_code = 'CBC'
      ON CONFLICT DO NOTHING;
    `);
    await tenantDataSource.query(`
      INSERT INTO lab_reference_ranges (component_id, age_min, age_max, gender, range_min, range_max, unit)
      SELECT id, 18, 120, 'male', 13.5, 17.5, 'g/dL' FROM lab_test_components WHERE component_code = 'HGB'
      ON CONFLICT DO NOTHING;
    `);
    await tenantDataSource.query(`
      INSERT INTO lab_reference_ranges (component_id, age_min, age_max, gender, range_min, range_max, unit)
      SELECT id, 18, 120, 'female', 12.0, 15.5, 'g/dL' FROM lab_test_components WHERE component_code = 'HGB'
      ON CONFLICT DO NOTHING;
    `);

    await tenantDataSource.query(`
      INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_min, reference_range_max, critical_low, critical_high, sort_order)
      SELECT id, 'White Blood Cell Count', 'WBC', '6690-2', '10^9/L', 4.0, 11.0, 2.0, 30.0, 2 FROM lab_test_catalog WHERE test_code = 'CBC'
      ON CONFLICT DO NOTHING;
    `);
    await tenantDataSource.query(`
      INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_min, reference_range_max, critical_low, critical_high, sort_order)
      SELECT id, 'Platelet Count', 'PLT', '777-3', '10^9/L', 150.0, 400.0, 50.0, 1000.0, 3 FROM lab_test_catalog WHERE test_code = 'CBC'
      ON CONFLICT DO NOTHING;
    `);

    await tenantDataSource.query(`
      INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_min, reference_range_max, critical_low, critical_high, sort_order)
      SELECT id, 'Glucose', 'GLU', '2345-7', 'mg/dL', 70.0, 100.0, 40.0, 500.0, 1 FROM lab_test_catalog WHERE test_code = 'BMP'
      ON CONFLICT DO NOTHING;
    `);
    await tenantDataSource.query(`
      INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_min, reference_range_max, critical_low, critical_high, sort_order)
      SELECT id, 'Sodium', 'NA', '2951-2', 'mmol/L', 135.0, 145.0, 120.0, 160.0, 2 FROM lab_test_catalog WHERE test_code = 'BMP'
      ON CONFLICT DO NOTHING;
    `);
    await tenantDataSource.query(`
      INSERT INTO lab_test_components (test_catalog_id, component_name, component_code, loinc_code, unit, reference_range_min, reference_range_max, critical_low, critical_high, sort_order)
      SELECT id, 'Potassium', 'K', '2823-3', 'mmol/L', 3.5, 5.0, 2.5, 6.5, 3 FROM lab_test_catalog WHERE test_code = 'BMP'
      ON CONFLICT DO NOTHING;
    `);

    await tenantDataSource.query(`
      INSERT INTO lab_order_sets (set_name, set_code, description, test_ids, category, is_active)
      VALUES
        ('Pre-Operative Panel', 'PREOP', 'Standard pre-operative tests', '[]'::jsonb, 'Surgery', true),
        ('Diabetes Monitoring', 'DM', 'Standard diabetes monitoring tests', '[]'::jsonb, 'Endocrinology', true),
        ('Antenatal Panel', 'ANC', 'Standard antenatal care tests', '[]'::jsonb, 'Obstetrics', true),
        ('Cardiac Risk Assessment', 'CARDIAC', 'Cardiovascular risk evaluation', '[]'::jsonb, 'Cardiology', true)
      ON CONFLICT (set_code) DO NOTHING;
    `);

    const labOrderSetLinks = [
      { set: 'PREOP', test: 'CBC', order: 1 },
      { set: 'PREOP', test: 'BMP', order: 2 },
      { set: 'PREOP', test: 'HCG', order: 3 },
      { set: 'DM', test: 'HBA1C', order: 1 },
      { set: 'DM', test: 'BMP', order: 2 },
      { set: 'DM', test: 'LIPID', order: 3 },
      { set: 'ANC', test: 'CBC', order: 1 },
      { set: 'ANC', test: 'HIV', order: 2 },
      { set: 'ANC', test: 'VDRL', order: 3 },
      { set: 'ANC', test: 'HBSAG', order: 4 },
      { set: 'ANC', test: 'UA', order: 5 },
      { set: 'CARDIAC', test: 'LIPID', order: 1 },
      { set: 'CARDIAC', test: 'HBA1C', order: 2 },
      { set: 'CARDIAC', test: 'BMP', order: 3 }
    ];

    for (const link of labOrderSetLinks) {
      await tenantDataSource.query(`
        INSERT INTO lab_order_set_items (order_set_id, test_catalog_id, sort_order)
        SELECT os.id, tc.id, ${link.order}
        FROM lab_order_sets os, lab_test_catalog tc
        WHERE os.set_code = '${link.set}' AND tc.test_code = '${link.test}'
        ON CONFLICT DO NOTHING;
      `);
    }
  }

  private async seedImagingCatalog(tenantDataSource: DataSource): Promise<void> {
    this.logger.log('Seeding baseline imaging catalog...');

    await tenantDataSource.query(`
      INSERT INTO imaging_modalities (modality_code, modality_name, description, is_active)
      VALUES 
        ('XR', 'X-Ray (Radiography)', 'Conventional radiography using ionizing radiation', true),
        ('CT', 'CT Scan (Computed Tomography)', 'Cross-sectional imaging using X-rays and computer processing', true),
        ('MRI', 'MRI (Magnetic Resonance Imaging)', 'Imaging using magnetic fields and radio waves', true),
        ('US', 'Ultrasound', 'Imaging using high-frequency sound waves', true),
        ('MG', 'Mammography', 'Breast imaging using low-dose X-rays', true),
        ('FL', 'Fluoroscopy', 'Real-time X-ray imaging', true),
        ('NM', 'Nuclear Medicine', 'Imaging using radioactive tracers', true),
        ('PET', 'PET Scan', 'Positron emission tomography for metabolic imaging', true)
      ON CONFLICT (modality_code) DO NOTHING;
    `);

    const imagingStudies = [
      { modality: 'XR', code: 'CXR-PA', name: 'Chest X-Ray (PA)', body: 'Chest', views: '{PA}', images: 1, contrast: false, cost: 25.00, prep: 'Remove jewelry and metal. Hold breath when instructed.' },
      { modality: 'XR', code: 'CXR-PA-LAT', name: 'Chest X-Ray (PA & Lateral)', body: 'Chest', views: '{PA,Lateral}', images: 2, contrast: false, cost: 35.00, prep: 'Remove jewelry and metal. Hold breath when instructed.' },
      { modality: 'XR', code: 'SPINE-L', name: 'Lumbar Spine X-Ray', body: 'Lumbar Spine', views: '{AP,Lateral}', images: 2, contrast: false, cost: 45.00, prep: 'Remove metal objects. Stand still during imaging.' },
      { modality: 'CT', code: 'CT-HEAD', name: 'CT Head (Brain)', body: 'Head/Brain', views: NULL, images: 1, contrast: false, cost: 200.00, prep: 'Remove metal from head. Remain still during scan.' },
      { modality: 'CT', code: 'CT-ABD-PELVIS', name: 'CT Abdomen & Pelvis', body: 'Abdomen/Pelvis', views: NULL, images: 1, contrast: true, cost: 300.00, prep: 'NPO 4 hours before scan. Oral contrast may be required.' },
      { modality: 'MRI', code: 'MRI-BRAIN', name: 'MRI Brain', body: 'Brain', views: NULL, images: 1, contrast: false, cost: 400.00, prep: 'Screen for implants. Remove all metal.' },
      { modality: 'MRI', code: 'MRI-SPINE-L', name: 'MRI Lumbar Spine', body: 'Lumbar Spine', views: NULL, images: 1, contrast: false, cost: 450.00, prep: 'Screen for implants. Remove all metal.' },
      { modality: 'US', code: 'US-ABD', name: 'Abdomen Ultrasound', body: 'Abdomen', views: NULL, images: 1, contrast: false, cost: 75.00, prep: 'NPO 6-8 hours before exam.' },
      { modality: 'US', code: 'US-OB', name: 'Obstetric Ultrasound', body: 'Uterus/Fetus', views: NULL, images: 1, contrast: false, cost: 85.00, prep: 'Full bladder recommended for early pregnancy.' },
      { modality: 'US', code: 'US-THYROID', name: 'Thyroid Ultrasound', body: 'Neck/Thyroid', views: NULL, images: 1, contrast: false, cost: 70.00, prep: 'No special preparation required.' },
      { modality: 'MG', code: 'MG-SCREENING', name: 'Screening Mammogram', body: 'Breast', views: '{CC,MLO}', images: 4, contrast: false, cost: 120.00, prep: 'Avoid deodorant/powder on exam day. Wear two-piece clothing.' }
    ];

    for (const study of imagingStudies) {
      await tenantDataSource.query(`
        INSERT INTO imaging_study_types (modality_id, study_code, study_name, body_part, views, typical_images, contrast_required, cost, description, preparation_instructions, is_active)
        SELECT mod.id, '${study.code}', '${study.name.replace(/'/g, "''")}', '${study.body}', ${study.views ? `'${study.views}'::text[]` : 'NULL'}, ${study.images}, ${study.contrast}, ${study.cost.toFixed(2)},
               '${study.name.replace(/'/g, "''")}', ${study.prep ? `'${study.prep.replace(/'/g, "''")}'` : 'NULL'}, true
        FROM imaging_modalities mod
        WHERE mod.modality_code = '${study.modality}'
        ON CONFLICT (study_code) DO NOTHING;
      `);
    }

    await tenantDataSource.query(`
      INSERT INTO imaging_report_templates (modality_id, study_type_id, template_name, template_code, technique_template, findings_template, impression_template, is_default)
      SELECT mod.id, st.id,
             'Chest X-Ray - Normal', 'CXR-NORMAL',
             'PA and lateral chest radiographs were obtained.',
             E'LUNGS: Clear bilaterally. No focal consolidation, pleural effusion, or pneumothorax.\nHEART: Normal size and contour.\nMEDIASTINUM: Normal width. No mediastinal mass.\nBONES: No acute fracture.\nSOFT TISSUES: Unremarkable.',
             'Normal chest radiograph.',
             true
      FROM imaging_modalities mod
      JOIN imaging_study_types st ON st.study_code = 'CXR-PA-LAT'
      WHERE mod.modality_code = 'XR'
      ON CONFLICT (template_code) DO NOTHING;
    `);

    await tenantDataSource.query(`
      INSERT INTO imaging_report_templates (modality_id, study_type_id, template_name, template_code, technique_template, findings_template, impression_template, is_default)
      SELECT mod.id, st.id,
             'Abdomen Ultrasound - Normal', 'US-ABD-NORMAL',
             'Grayscale ultrasound examination of the abdomen.',
             E'LIVER: Normal size, echogenicity, and contour. No focal lesion.\nGALLBLADDER: Normal. No stones or wall thickening.\nKIDNEYS: Normal size and echogenicity. No hydronephrosis or stones.\nSPLEEN: Normal.\nASCITES: None.',
             'Normal abdominal ultrasound.',
             true
      FROM imaging_modalities mod
      JOIN imaging_study_types st ON st.study_code = 'US-ABD'
      WHERE mod.modality_code = 'US'
      ON CONFLICT (template_code) DO NOTHING;
    `);
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
      
      this.logger.log(`