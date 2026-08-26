-- Migration: Add Patient-Reported Outcomes (PROs) System
-- This migration adds tables for questionnaire templates, patient questionnaires, responses, and scheduling

-- Questionnaire Templates Table
-- Stores standard questionnaires (PHQ-9, GAD-7, PROMIS, etc.)
CREATE TABLE IF NOT EXISTS questionnaire_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'PHQ9', 'GAD7', 'PROMIS29'
    name VARCHAR(255) NOT NULL, -- e.g., 'Patient Health Questionnaire-9'
    description TEXT,
    category VARCHAR(100), -- 'mental_health', 'quality_of_life', 'disease_specific', 'symptom_tracking'
    version VARCHAR(20) DEFAULT '1.0',
    is_active BOOLEAN DEFAULT true,
    is_standard BOOLEAN DEFAULT true, -- Standard questionnaires vs custom
    scoring_algorithm VARCHAR(100), -- 'sum', 'average', 'weighted', 'custom'
    min_score DECIMAL(10,2),
    max_score DECIMAL(10,2),
    questions JSONB NOT NULL, -- Array of question objects
    scoring_rules JSONB, -- Scoring instructions and thresholds
    alert_rules JSONB, -- Rules for generating alerts (e.g., score > 15 = severe)
    metadata JSONB, -- Additional metadata (author, copyright, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Patient Questionnaires Table
-- Tracks which questionnaires have been assigned to patients
CREATE TABLE IF NOT EXISTS patient_questionnaires (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    questionnaire_template_id UUID NOT NULL REFERENCES questionnaire_templates(id),
    appointment_id UUID REFERENCES appointments(id), -- If assigned before appointment
    assigned_by UUID REFERENCES users(id), -- Doctor/nurse who assigned it
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    due_date TIMESTAMP WITH TIME ZONE, -- When patient should complete it
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'expired', 'cancelled')),
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    reminder_sent_count INTEGER DEFAULT 0,
    last_reminder_sent TIMESTAMP WITH TIME ZONE,
    notes TEXT, -- Notes from doctor/nurse
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Questionnaire Responses Table
-- Stores individual question responses
CREATE TABLE IF NOT EXISTS questionnaire_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_questionnaire_id UUID NOT NULL REFERENCES patient_questionnaires(id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL, -- Question index in the template
    question_text TEXT NOT NULL,
    response_value TEXT, -- Can be number, text, or JSON for complex responses
    response_type VARCHAR(50), -- 'number', 'text', 'choice', 'scale', 'boolean'
    response_options JSONB, -- Available options if applicable
    score DECIMAL(10,2), -- Calculated score for this question
    answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Questionnaire Schedules Table
-- For automated/recurring questionnaire assignments
CREATE TABLE IF NOT EXISTS questionnaire_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    questionnaire_template_id UUID NOT NULL REFERENCES questionnaire_templates(id),
    schedule_type VARCHAR(50) NOT NULL CHECK (schedule_type IN ('one_time', 'daily', 'weekly', 'monthly', 'event_triggered')),
    start_date DATE NOT NULL,
    end_date DATE, -- NULL for indefinite
    frequency INTEGER DEFAULT 1, -- Every N days/weeks/months
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
    day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),
    trigger_event VARCHAR(100), -- e.g., 'appointment_scheduled', 'medication_started', 'post_surgery'
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PRO Alert Rules Table
-- Defines when to generate alerts based on PRO scores
CREATE TABLE IF NOT EXISTS pro_alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    questionnaire_template_id UUID NOT NULL REFERENCES questionnaire_templates(id),
    rule_name VARCHAR(255) NOT NULL,
    condition_type VARCHAR(50) NOT NULL CHECK (condition_type IN ('score_greater_than', 'score_less_than', 'score_between', 'score_equals', 'change_greater_than')),
    condition_value JSONB NOT NULL, -- Threshold values
    alert_severity VARCHAR(50) DEFAULT 'medium' CHECK (alert_severity IN ('low', 'medium', 'high', 'critical')),
    alert_message TEXT,
    notify_roles TEXT[], -- Which roles to notify (e.g., ['doctor', 'nurse'])
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PRO Alerts Table
-- Stores generated alerts from PRO responses
CREATE TABLE IF NOT EXISTS pro_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    patient_questionnaire_id UUID NOT NULL REFERENCES patient_questionnaires(id),
    alert_rule_id UUID REFERENCES pro_alert_rules(id),
    alert_severity VARCHAR(50) NOT NULL,
    alert_message TEXT NOT NULL,
    score_value DECIMAL(10,2),
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'dismissed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_patient_questionnaires_patient_id ON patient_questionnaires(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_questionnaires_status ON patient_questionnaires(status);
CREATE INDEX IF NOT EXISTS idx_patient_questionnaires_due_date ON patient_questionnaires(due_date);
CREATE INDEX IF NOT EXISTS idx_patient_questionnaires_appointment_id ON patient_questionnaires(appointment_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_patient_questionnaire_id ON questionnaire_responses(patient_questionnaire_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_schedules_patient_id ON questionnaire_schedules(patient_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_schedules_active ON questionnaire_schedules(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_pro_alerts_patient_id ON pro_alerts(patient_id);
CREATE INDEX IF NOT EXISTS idx_pro_alerts_status ON pro_alerts(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_questionnaire_templates_code ON questionnaire_templates(code);
CREATE INDEX IF NOT EXISTS idx_questionnaire_templates_active ON questionnaire_templates(is_active) WHERE is_active = true;

-- Comments for documentation
COMMENT ON TABLE questionnaire_templates IS 'Standard and custom questionnaire templates (PHQ-9, GAD-7, PROMIS, etc.)';
COMMENT ON TABLE patient_questionnaires IS 'Questionnaires assigned to patients with completion tracking';
COMMENT ON TABLE questionnaire_responses IS 'Individual question responses from patients';
COMMENT ON TABLE questionnaire_schedules IS 'Automated/recurring questionnaire assignments';
COMMENT ON TABLE pro_alert_rules IS 'Rules for generating alerts based on PRO scores';
COMMENT ON TABLE pro_alerts IS 'Generated alerts from PRO responses requiring clinical attention';

