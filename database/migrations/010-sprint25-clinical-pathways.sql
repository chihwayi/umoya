-- Sprint 25: Clinical Pathways & Protocols
-- Date: December 3, 2025
-- Description: Evidence-based care pathways with adherence tracking and quality measurement

-- Clinical Pathways Table
CREATE TABLE IF NOT EXISTS clinical_pathways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pathway_code VARCHAR(100) NOT NULL UNIQUE,
  pathway_name VARCHAR(255) NOT NULL,
  pathway_version VARCHAR(20) NOT NULL,
  condition VARCHAR(255) NOT NULL, -- CHF, Pneumonia, Stroke, etc.
  condition_codes JSONB DEFAULT '[]'::jsonb, -- ICD-10 codes
  specialty VARCHAR(100),
  evidence_level VARCHAR(20), -- Grade A, B, C
  guideline_source VARCHAR(255), -- AHA, ACC, WHO, etc.
  guideline_url TEXT,
  pathway_type VARCHAR(50) CHECK (pathway_type IN (
    'diagnostic',
    'treatment',
    'prevention',
    'management',
    'discharge'
  )),
  target_population TEXT,
  inclusion_criteria TEXT,
  exclusion_criteria TEXT,
  pathway_duration_days INTEGER,
  expected_outcomes TEXT,
  description TEXT,
  objectives TEXT,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  effective_date DATE NOT NULL,
  review_date DATE,
  last_reviewed_by UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinical_pathways_code ON clinical_pathways(pathway_code);
CREATE INDEX IF NOT EXISTS idx_clinical_pathways_condition ON clinical_pathways(condition);
CREATE INDEX IF NOT EXISTS idx_clinical_pathways_specialty ON clinical_pathways(specialty);
CREATE INDEX IF NOT EXISTS idx_clinical_pathways_active ON clinical_pathways(is_active);

-- Pathway Steps Table
CREATE TABLE IF NOT EXISTS pathway_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pathway_id UUID NOT NULL REFERENCES clinical_pathways(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  step_name VARCHAR(255) NOT NULL,
  step_type VARCHAR(50) CHECK (step_type IN (
    'assessment',
    'diagnostic_test',
    'medication',
    'procedure',
    'consultation',
    'education',
    'monitoring',
    'decision_point'
  )),
  timing VARCHAR(100), -- Day 1, Hour 0-6, etc.
  timing_from_start_hours INTEGER,
  description TEXT,
  instructions TEXT,
  required_actions JSONB DEFAULT '[]'::jsonb,
  decision_criteria TEXT,
  decision_branches JSONB, -- If decision point
  is_required BOOLEAN DEFAULT true,
  is_parallel BOOLEAN DEFAULT false, -- Can be done simultaneously
  depends_on_step INTEGER, -- Must complete this step first
  expected_duration_minutes INTEGER,
  documentation_required TEXT,
  quality_measure BOOLEAN DEFAULT false,
  order_sets JSONB DEFAULT '[]'::jsonb, -- Pre-configured orders
  alerts JSONB DEFAULT '[]'::jsonb, -- Warnings if not completed on time
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pathway_steps_pathway ON pathway_steps(pathway_id);
CREATE INDEX IF NOT EXISTS idx_pathway_steps_number ON pathway_steps(step_number);
CREATE INDEX IF NOT EXISTS idx_pathway_steps_type ON pathway_steps(step_type);

-- Pathway Enrollments Table
CREATE TABLE IF NOT EXISTS pathway_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_number VARCHAR(50) UNIQUE NOT NULL,
  patient_id UUID NOT NULL REFERENCES patients(id),
  pathway_id UUID NOT NULL REFERENCES clinical_pathways(id),
  admission_id UUID REFERENCES admissions(id),
  enrolled_date TIMESTAMP WITH TIME ZONE NOT NULL,
  enrolled_by UUID NOT NULL REFERENCES users(id),
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  expected_end_date TIMESTAMP WITH TIME ZONE,
  actual_end_date TIMESTAMP WITH TIME ZONE,
  enrollment_status VARCHAR(50) DEFAULT 'active' CHECK (enrollment_status IN (
    'active',
    'completed',
    'discontinued',
    'suspended',
    'transferred'
  )),
  discontinuation_reason TEXT,
  discontinued_date TIMESTAMP WITH TIME ZONE,
  discontinued_by UUID REFERENCES users(id),
  primary_provider UUID REFERENCES users(id),
  coordinator UUID REFERENCES users(id),
  current_step INTEGER,
  completion_percentage DECIMAL(5,2),
  adherence_score DECIMAL(5,2), -- 0-100
  variance_count INTEGER DEFAULT 0,
  outcomes JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pathway_enrollments_patient ON pathway_enrollments(patient_id);
CREATE INDEX IF NOT EXISTS idx_pathway_enrollments_pathway ON pathway_enrollments(pathway_id);
CREATE INDEX IF NOT EXISTS idx_pathway_enrollments_status ON pathway_enrollments(enrollment_status);
CREATE INDEX IF NOT EXISTS idx_pathway_enrollments_admission ON pathway_enrollments(admission_id);
CREATE INDEX IF NOT EXISTS idx_pathway_enrollments_date ON pathway_enrollments(enrolled_date);

-- Pathway Adherence Table
CREATE TABLE IF NOT EXISTS pathway_adherence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES pathway_enrollments(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES pathway_steps(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  due_date TIMESTAMP WITH TIME ZONE,
  completed_date TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
    'pending',
    'completed',
    'overdue',
    'skipped',
    'not_applicable'
  )),
  on_time BOOLEAN,
  delay_hours INTEGER,
  completion_notes TEXT,
  variance_documented BOOLEAN DEFAULT false,
  variance_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pathway_adherence_enrollment ON pathway_adherence(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_pathway_adherence_step ON pathway_adherence(step_id);
CREATE INDEX IF NOT EXISTS idx_pathway_adherence_patient ON pathway_adherence(patient_id);
CREATE INDEX IF NOT EXISTS idx_pathway_adherence_status ON pathway_adherence(status);
CREATE INDEX IF NOT EXISTS idx_pathway_adherence_due_date ON pathway_adherence(due_date);

-- Pathway Variances Table
CREATE TABLE IF NOT EXISTS pathway_variances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES pathway_enrollments(id) ON DELETE CASCADE,
  step_id UUID REFERENCES pathway_steps(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  variance_date TIMESTAMP WITH TIME ZONE NOT NULL,
  variance_type VARCHAR(50) NOT NULL CHECK (variance_type IN (
    'omission',
    'delay',
    'modification',
    'substitution',
    'addition',
    'contraindication'
  )),
  variance_category VARCHAR(100), -- Clinical, operational, patient-related
  description TEXT NOT NULL,
  rationale TEXT NOT NULL,
  clinical_justification TEXT,
  documented_by UUID NOT NULL REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  impact_on_outcome VARCHAR(50), -- None, minor, moderate, significant
  corrective_action TEXT,
  requires_review BOOLEAN DEFAULT false,
  reviewed_by UUID REFERENCES users(id),
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pathway_variances_enrollment ON pathway_variances(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_pathway_variances_patient ON pathway_variances(patient_id);
CREATE INDEX IF NOT EXISTS idx_pathway_variances_type ON pathway_variances(variance_type);
CREATE INDEX IF NOT EXISTS idx_pathway_variances_date ON pathway_variances(variance_date);

-- Pathway Outcomes Table
CREATE TABLE IF NOT EXISTS pathway_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES pathway_enrollments(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id),
  outcome_date TIMESTAMP WITH TIME ZONE NOT NULL,
  outcome_type VARCHAR(100) NOT NULL, -- Clinical, functional, quality of life
  outcome_measure VARCHAR(255) NOT NULL,
  baseline_value VARCHAR(100),
  target_value VARCHAR(100),
  actual_value VARCHAR(100),
  measurement_date DATE,
  goal_achieved BOOLEAN,
  documented_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pathway_outcomes_enrollment ON pathway_outcomes(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_pathway_outcomes_patient ON pathway_outcomes(patient_id);
CREATE INDEX IF NOT EXISTS idx_pathway_outcomes_type ON pathway_outcomes(outcome_type);
CREATE INDEX IF NOT EXISTS idx_pathway_outcomes_date ON pathway_outcomes(outcome_date);

-- Insert sample clinical pathways
INSERT INTO clinical_pathways (
  pathway_code, pathway_name, pathway_version, condition,
  condition_codes, specialty, evidence_level, guideline_source,
  pathway_type, target_population, effective_date
) VALUES
(
  'CHF_MGMT_V1',
  'Congestive Heart Failure Management',
  '1.0',
  'Congestive Heart Failure',
  '["I50.0", "I50.1", "I50.9"]'::jsonb,
  'cardiology',
  'A',
  'AHA/ACC Heart Failure Guidelines',
  'management',
  'Adult patients with diagnosed CHF',
  CURRENT_DATE
),
(
  'STROKE_ACUTE_V1',
  'Acute Ischemic Stroke Pathway',
  '1.0',
  'Acute Ischemic Stroke',
  '["I63.0", "I63.9"]'::jsonb,
  'neurology',
  'A',
  'AHA/ASA Stroke Guidelines',
  'treatment',
  'Adults presenting within 4.5 hours of symptom onset',
  CURRENT_DATE
),
(
  'PNEUMONIA_CAP_V1',
  'Community-Acquired Pneumonia Protocol',
  '1.0',
  'Community-Acquired Pneumonia',
  '["J18.9", "J15.9"]'::jsonb,
  'pulmonology',
  'A',
  'IDSA/ATS CAP Guidelines',
  'treatment',
  'Adult inpatients with CAP',
  CURRENT_DATE
),
(
  'DKA_MGMT_V1',
  'Diabetic Ketoacidosis Management',
  '1.0',
  'Diabetic Ketoacidosis',
  '["E10.10", "E11.10"]'::jsonb,
  'endocrinology',
  'A',
  'ADA DKA Guidelines',
  'treatment',
  'Patients with DKA',
  CURRENT_DATE
),
(
  'SEPSIS_V1',
  'Severe Sepsis & Septic Shock Protocol',
  '1.0',
  'Sepsis',
  '["A41.9", "R65.20", "R65.21"]'::jsonb,
  'emergency_medicine',
  'A',
  'Surviving Sepsis Campaign',
  'treatment',
  'Patients with suspected or confirmed sepsis',
  CURRENT_DATE
);

-- Add comments
COMMENT ON TABLE clinical_pathways IS 'Evidence-based clinical pathway definitions';
COMMENT ON TABLE pathway_steps IS 'Step-by-step protocol actions';
COMMENT ON TABLE pathway_enrollments IS 'Patient pathway enrollment tracking';
COMMENT ON TABLE pathway_adherence IS 'Adherence to pathway steps';
COMMENT ON TABLE pathway_variances IS 'Documented deviations from pathway';
COMMENT ON TABLE pathway_outcomes IS 'Clinical outcomes measurement';

