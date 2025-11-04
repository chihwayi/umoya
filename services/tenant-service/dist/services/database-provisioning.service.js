"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var DatabaseProvisioningService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseProvisioningService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
let DatabaseProvisioningService = DatabaseProvisioningService_1 = class DatabaseProvisioningService {
    constructor(dataSource) {
        this.dataSource = dataSource;
        this.logger = new common_1.Logger(DatabaseProvisioningService_1.name);
    }
    async createDatabase(databaseName) {
        try {
            this.logger.log(`Creating database: ${databaseName}`);
            await this.dataSource.query(`CREATE DATABASE "${databaseName}"`);
            const connectionString = this.generateConnectionString(databaseName);
            await this.applyClinicSchema(connectionString);
            this.logger.log(`Database ${databaseName} created successfully`);
            return connectionString;
        }
        catch (error) {
            this.logger.error(`Failed to create database ${databaseName}:`, error);
            throw error;
        }
    }
    generateConnectionString(databaseName) {
        const host = process.env.DB_HOST || 'localhost';
        const port = process.env.DB_PORT || '5432';
        const username = process.env.DB_USERNAME || 'medicore';
        const password = process.env.DB_PASSWORD || 'medicore_password';
        return `postgresql://${username}:${password}@${host}:${port}/${databaseName}`;
    }
    async applyClinicSchema(connectionString) {
        const tenantDataSource = new typeorm_1.DataSource({
            type: 'postgres',
            url: connectionString,
        });
        try {
            await tenantDataSource.initialize();
            let statements = this.getClinicSchema();
            statements = statements.map((s) => s
                .replace(/CREATE TABLE\s+([^(]+)/gi, (m) => m.replace('CREATE TABLE', 'CREATE TABLE IF NOT EXISTS'))
                .replace(/CREATE INDEX\s+/gi, 'CREATE INDEX IF NOT EXISTS ')
                .replace(/CREATE EXTENSION\s+/gi, 'CREATE EXTENSION IF NOT EXISTS ')
                .replace(/IF NOT EXISTS\s+IF NOT EXISTS/gi, 'IF NOT EXISTS'));
            for (const statement of statements) {
                if (!statement.trim())
                    continue;
                try {
                    await tenantDataSource.query(statement);
                }
                catch (e) {
                    this.logger.warn(`Skipping statement due to error: ${e instanceof Error ? e.message : String(e)}\nSQL: ${statement.substring(0, 200)}...`);
                }
            }
            await tenantDataSource.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ language 'plpgsql';
      `);
            const triggerStatements = this.getTriggerStatements();
            for (const statement of triggerStatements) {
                if (!statement.trim())
                    continue;
                try {
                    await tenantDataSource.query(statement);
                }
                catch (e) {
                    this.logger.warn(`Skipping trigger due to error: ${e instanceof Error ? e.message : String(e)}\nSQL: ${statement.substring(0, 200)}...`);
                }
            }
            try {
                await tenantDataSource.query(`
          ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
        `);
                await tenantDataSource.query(`
          ALTER TABLE users ADD CONSTRAINT users_role_check 
          CHECK (role IN ('doctor', 'nurse', 'receptionist', 'admin', 'pharmacist', 'lab_tech'));
        `);
            }
            catch (e) {
                this.logger.warn(`Skipping constraint update due to error: ${e instanceof Error ? e.message : String(e)}`);
            }
            this.logger.log('Schema migration completed');
        }
        finally {
            await tenantDataSource.destroy();
        }
    }
    getClinicSchema() {
        const schema = `
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      
      CREATE TABLE users (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          role VARCHAR(50) NOT NULL CHECK (role IN ('doctor', 'nurse', 'receptionist', 'admin', 'pharmacist', 'lab_tech')),
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
        let statements = schema.split(';').filter(stmt => stmt.trim());
        statements.push(`CREATE TABLE IF NOT EXISTS problems (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, code VARCHAR(50), description TEXT NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','resolved')), onset_date DATE, resolved_date DATE, notes TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
        statements.push(`CREATE TABLE IF NOT EXISTS allergies (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, allergen VARCHAR(255) NOT NULL, reaction TEXT, severity VARCHAR(20) CHECK (severity IN ('mild','moderate','severe')), recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), recorded_by UUID REFERENCES users(id))`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_problems_patient_id ON problems(patient_id)`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_problems_status ON problems(status)`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_allergies_patient_id ON allergies(patient_id)`);
        statements.push(`CREATE TABLE IF NOT EXISTS lab_orders (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_number VARCHAR(255) NOT NULL, patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, ordering_provider_id UUID NOT NULL REFERENCES users(id), medical_record_id UUID REFERENCES medical_records(id), tests JSONB NOT NULL, priority VARCHAR(20) DEFAULT 'routine' CHECK (priority IN ('routine','urgent','stat')), status VARCHAR(20) DEFAULT 'ordered' CHECK (status IN ('ordered','collected','in_progress','completed','cancelled')), clinical_info TEXT, special_instructions TEXT, scheduled_date_time TIMESTAMP WITH TIME ZONE, collected_at TIMESTAMP WITH TIME ZONE, collected_by_id UUID REFERENCES users(id), results JSONB, interpretation TEXT, reviewed_by_id UUID REFERENCES users(id), reviewed_at TIMESTAMP WITH TIME ZONE, attachments JSONB, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_orders_patient_id ON lab_orders(patient_id)`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_orders_status ON lab_orders(status)`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_orders_ordering_provider_id ON lab_orders(ordering_provider_id)`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_orders_order_number ON lab_orders(order_number)`);
        statements.push(`CREATE TABLE IF NOT EXISTS lab_tests (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), loinc_code VARCHAR(50) UNIQUE, test_name VARCHAR(255) NOT NULL, test_code VARCHAR(50), category VARCHAR(100) NOT NULL, specimen_type VARCHAR(100) NOT NULL, unit VARCHAR(50), reference_range_male VARCHAR(100), reference_range_female VARCHAR(100), reference_range_general VARCHAR(100), critical_high DECIMAL(10,2), critical_low DECIMAL(10,2), description TEXT, instructions TEXT, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_tests_loinc_code ON lab_tests(loinc_code)`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_tests_category ON lab_tests(category)`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_tests_test_code ON lab_tests(test_code)`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_tests_is_active ON lab_tests(is_active)`);
        statements.push(`CREATE TABLE IF NOT EXISTS lab_order_sets (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), set_name VARCHAR(255) NOT NULL, set_code VARCHAR(50) UNIQUE, description TEXT, test_ids JSONB NOT NULL, category VARCHAR(100), is_active BOOLEAN DEFAULT true, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_order_sets_set_code ON lab_order_sets(set_code)`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_order_sets_category ON lab_order_sets(category)`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_lab_order_sets_is_active ON lab_order_sets(is_active)`);
        statements.push(`CREATE TABLE IF NOT EXISTS critical_result_alerts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), lab_order_id UUID NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE, patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, ordering_provider_id UUID NOT NULL REFERENCES users(id), test_code VARCHAR(50) NOT NULL, test_name VARCHAR(255) NOT NULL, result_value VARCHAR(255) NOT NULL, critical_value_type VARCHAR(20) CHECK (critical_value_type IN ('high','low','critical')), alert_message TEXT NOT NULL, status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','acknowledged','dismissed')), acknowledged_by UUID REFERENCES users(id), acknowledged_at TIMESTAMP WITH TIME ZONE, acknowledgment_notes TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_critical_alerts_lab_order_id ON critical_result_alerts(lab_order_id)`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_critical_alerts_patient_id ON critical_result_alerts(patient_id)`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_critical_alerts_ordering_provider_id ON critical_result_alerts(ordering_provider_id)`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_critical_alerts_status ON critical_result_alerts(status)`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_critical_alerts_created_at ON critical_result_alerts(created_at)`);
        statements.push(`CREATE TABLE IF NOT EXISTS drugs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), generic_name VARCHAR(255) NOT NULL, brand_names TEXT[], atc_code VARCHAR(20), drug_class VARCHAR(100), active_ingredients TEXT[], dosage_forms TEXT[], route_of_administration TEXT[], description TEXT, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_generic_name ON drugs(generic_name)`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_atc_code ON drugs(atc_code)`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_drug_class ON drugs(drug_class)`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_is_active ON drugs(is_active)`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_drugs_brand_names ON drugs USING GIN(brand_names)`);
        statements.push(`CREATE TABLE IF NOT EXISTS drug_interactions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), drug1_id UUID NOT NULL REFERENCES drugs(id) ON DELETE CASCADE, drug2_id UUID NOT NULL REFERENCES drugs(id) ON DELETE CASCADE, severity VARCHAR(20) NOT NULL CHECK (severity IN ('minor','moderate','major','contraindicated')), description TEXT NOT NULL, mechanism TEXT, management TEXT, evidence_level VARCHAR(20), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), UNIQUE(drug1_id, drug2_id))`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_drug_interactions_drug1_id ON drug_interactions(drug1_id)`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_drug_interactions_drug2_id ON drug_interactions(drug2_id)`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_drug_interactions_severity ON drug_interactions(severity)`);
        statements.push(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS drug_id UUID REFERENCES drugs(id) ON DELETE SET NULL`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_orders_drug_id ON orders(drug_id) WHERE drug_id IS NOT NULL`);
        statements.push(`CREATE TABLE IF NOT EXISTS hiv_tests (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, test_number VARCHAR(100) UNIQUE NOT NULL, test_date TIMESTAMP WITH TIME ZONE NOT NULL, test_type VARCHAR(50) NOT NULL CHECK (test_type IN ('rapid_antibody', 'elisa', 'pcr', 'viral_load', 'cd4')), test_kit_name VARCHAR(100), test_kit_lot VARCHAR(100), test_kit_expiry DATE, test_result VARCHAR(50) NOT NULL CHECK (test_result IN ('reactive', 'non_reactive', 'invalid', 'indeterminate', 'positive', 'negative', 'pending')), result_value VARCHAR(255), result_unit VARCHAR(50), is_confirmatory BOOLEAN DEFAULT false, confirmatory_test_id UUID REFERENCES hiv_tests(id), testing_algorithm_step INTEGER DEFAULT 1, algorithm_result VARCHAR(50) CHECK (algorithm_result IN ('positive', 'negative', 'indeterminate', 'incomplete')), tested_by UUID NOT NULL REFERENCES users(id), reviewed_by UUID REFERENCES users(id), reviewed_at TIMESTAMP WITH TIME ZONE, notes TEXT, enrolled_in_care BOOLEAN DEFAULT false, enrollment_declined BOOLEAN DEFAULT false, enrollment_declined_reason TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_tests_patient_id ON hiv_tests(patient_id)`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_tests_test_date ON hiv_tests(test_date)`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_tests_test_result ON hiv_tests(test_result)`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_tests_enrolled_in_care ON hiv_tests(enrolled_in_care)`);
        statements.push(`CREATE TABLE IF NOT EXISTS hiv_care_enrollments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, enrollment_date DATE NOT NULL, enrollment_number VARCHAR(100) UNIQUE NOT NULL, enrollment_status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (enrollment_status IN ('active', 'transferred_out', 'lost_to_followup', 'deceased', 'discontinued')), enrollment_facility VARCHAR(255), previous_care_facility VARCHAR(255), previous_care_number VARCHAR(100), date_confirmed_positive DATE, art_start_date DATE, baseline_cd4 INTEGER, baseline_viral_load DECIMAL(10,2), baseline_viral_load_unit VARCHAR(10) DEFAULT 'copies/mL', baseline_clinical_stage VARCHAR(20) CHECK (baseline_clinical_stage IN ('stage1', 'stage2', 'stage3', 'stage4')), baseline_who_stage VARCHAR(20), current_regimen VARCHAR(255), transfer_out_date DATE, transfer_out_facility VARCHAR(255), loss_to_followup_date DATE, loss_to_followup_reason TEXT, deceased_date DATE, cause_of_death TEXT, discontinued_date DATE, discontinued_reason TEXT, enrollment_notes TEXT, created_by UUID NOT NULL REFERENCES users(id), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_enrollments_patient_id ON hiv_care_enrollments(patient_id)`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_enrollments_enrollment_status ON hiv_care_enrollments(enrollment_status)`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_hiv_enrollments_enrollment_number ON hiv_care_enrollments(enrollment_number)`);
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
      arv_status VARCHAR(10) CHECK (arv_status IN ('1', '2', '2b', '3', '4', '5', '6', '7')),
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
      viral_load_test_date DATE,
      viral_load_suppressed BOOLEAN,
      alt_result DECIMAL(10,2),
      creatinine_result DECIMAL(10,2),
      other_diagnostics TEXT,
      
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
        statements.push(`CREATE TABLE IF NOT EXISTS tb_screenings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, screening_date DATE NOT NULL, screening_type VARCHAR(50) NOT NULL CHECK (screening_type IN ('symptom_screen', 'chest_xray', 'sputum_afb', 'gene_xpert', 'culture', 'lpa')), screening_result VARCHAR(50) CHECK (screening_result IN ('negative', 'positive', 'indeterminate', 'pending')), symptom_cough BOOLEAN DEFAULT false, symptom_fever BOOLEAN DEFAULT false, symptom_night_sweats BOOLEAN DEFAULT false, symptom_weight_loss BOOLEAN DEFAULT false, symptom_duration_weeks INTEGER, chest_xray_result VARCHAR(50), sputum_afb_result VARCHAR(50), gene_xpert_result VARCHAR(50), culture_result VARCHAR(50), tb_diagnosed BOOLEAN DEFAULT false, tb_diagnosis_date DATE, tb_treatment_started BOOLEAN DEFAULT false, tb_treatment_start_date DATE, screened_by UUID NOT NULL REFERENCES users(id), notes TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_tb_screenings_patient_id ON tb_screenings(patient_id)`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_tb_screenings_screening_date ON tb_screenings(screening_date)`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_tb_screenings_tb_diagnosed ON tb_screenings(tb_diagnosed)`);
        statements.push(`CREATE TABLE IF NOT EXISTS cervical_cancer_screenings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE, screening_date DATE NOT NULL, screening_method VARCHAR(50) NOT NULL CHECK (screening_method IN ('via', 'pap_smear', 'hpv_test', 'colposcopy')), screening_result VARCHAR(50) CHECK (screening_result IN ('normal', 'abnormal', 'positive', 'negative', 'suspicious', 'pending')), via_result VARCHAR(50), pap_result VARCHAR(50), hpv_result VARCHAR(50), hpv_types TEXT[], colposcopy_result VARCHAR(50), biopsy_required BOOLEAN DEFAULT false, biopsy_result VARCHAR(50), treatment_provided TEXT, treatment_date DATE, next_screening_date DATE, screened_by UUID NOT NULL REFERENCES users(id), reviewed_by UUID REFERENCES users(id), notes TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_cervical_screenings_patient_id ON cervical_cancer_screenings(patient_id)`);
        statements.push(`CREATE INDEX IF NOT EXISTS idx_cervical_screenings_screening_date ON cervical_cancer_screenings(screening_date)`);
        return statements;
    }
    getTriggerStatements() {
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
            `CREATE TRIGGER update_drugs_updated_at BEFORE UPDATE ON drugs
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
            `CREATE TRIGGER update_drug_interactions_updated_at BEFORE UPDATE ON drug_interactions
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
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`
        ];
    }
    async deleteDatabase(databaseName) {
        try {
            await this.dataSource.query(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = '${databaseName}' AND pid <> pg_backend_pid()
      `);
            await this.dataSource.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
            this.logger.log(`Database ${databaseName} deleted successfully`);
        }
        catch (error) {
            this.logger.error(`Failed to delete database ${databaseName}:`, error);
            throw error;
        }
    }
};
exports.DatabaseProvisioningService = DatabaseProvisioningService;
exports.DatabaseProvisioningService = DatabaseProvisioningService = DatabaseProvisioningService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], DatabaseProvisioningService);
//# sourceMappingURL=database-provisioning.service.js.map