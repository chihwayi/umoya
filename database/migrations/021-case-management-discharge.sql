-- Migration 017: Case Management & Discharge Planning
-- Date: December 4, 2025
-- Description: Adds case management workflows, discharge planning, and care coordination.

-- =====================================================================================================================
-- 1. case_management_assessments Table
--    Initial case management assessments
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS case_management_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  admission_id UUID NOT NULL REFERENCES admissions(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  
  -- Assessment
  assessment_date DATE DEFAULT CURRENT_DATE,
  assessment_type VARCHAR(50) CHECK (assessment_type IN ('initial', 'ongoing', 'discharge', 'post_discharge')),
  
  -- Patient Needs
  medical_complexity VARCHAR(50) CHECK (medical_complexity IN ('low', 'moderate', 'high', 'very_high')),
  functional_status VARCHAR(50), -- Independent, assisted, dependent
  cognitive_status VARCHAR(50),
  psychosocial_needs TEXT,
  
  -- Discharge Barriers
  discharge_barriers JSONB DEFAULT '[]'::jsonb, -- Transportation, equipment, home support, etc.
  
  -- Resources Needed
  home_health_needed BOOLEAN DEFAULT false,
  dme_needed BOOLEAN DEFAULT false, -- Durable Medical Equipment
  skilled_nursing_facility BOOLEAN DEFAULT false,
  rehabilitation_needed BOOLEAN DEFAULT false,
  
  -- Social Determinants
  housing_status VARCHAR(100),
  support_system VARCHAR(100),
  financial_concerns BOOLEAN DEFAULT false,
  insurance_issues BOOLEAN DEFAULT false,
  
  -- Readmission Risk
  readmission_risk VARCHAR(50) CHECK (readmission_risk IN ('low', 'moderate', 'high')),
  risk_factors JSONB DEFAULT '[]'::jsonb,
  
  -- Case Manager
  case_manager_id UUID NOT NULL REFERENCES users(id),
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_mgmt_admission ON case_management_assessments(admission_id);
CREATE INDEX IF NOT EXISTS idx_case_mgmt_patient ON case_management_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_case_mgmt_manager ON case_management_assessments(case_manager_id);

-- =====================================================================================================================
-- 2. discharge_plans Table
--    Comprehensive discharge planning
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS discharge_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  admission_id UUID NOT NULL REFERENCES admissions(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  
  -- Target Discharge
  target_discharge_date DATE,
  actual_discharge_date DATE,
  
  -- Disposition
  discharge_disposition VARCHAR(100) CHECK (discharge_disposition IN 
    ('home', 'home_with_services', 'skilled_nursing_facility', 'rehab', 'hospice', 'ama', 'deceased', 'transferred')),
  
  -- Instructions
  discharge_instructions TEXT,
  medication_reconciliation_complete BOOLEAN DEFAULT false,
  follow_up_appointments JSONB DEFAULT '[]'::jsonb, -- Array of {specialty, date, location}
  
  -- Equipment & Services
  dme_orders JSONB DEFAULT '[]'::jsonb, -- Durable medical equipment
  home_health_orders JSONB DEFAULT '[]'::jsonb,
  prescriptions_sent BOOLEAN DEFAULT false,
  
  -- Transportation
  transportation_arranged BOOLEAN DEFAULT false,
  transportation_type VARCHAR(100),
  
  -- Education
  patient_education_completed BOOLEAN DEFAULT false,
  education_topics JSONB DEFAULT '[]'::jsonb,
  education_materials_provided JSONB DEFAULT '[]'::jsonb,
  
  -- Barriers Resolved
  barriers_resolved BOOLEAN DEFAULT false,
  remaining_barriers TEXT,
  
  -- Readmission Prevention
  readmission_prevention_plan TEXT,
  high_risk_follow_up BOOLEAN DEFAULT false,
  
  -- Approvals
  physician_approval BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES users(id),
  approval_date DATE,
  
  -- Case Manager
  case_manager_id UUID REFERENCES users(id),
  
  -- Status
  plan_status VARCHAR(50) DEFAULT 'planning' CHECK (plan_status IN ('planning', 'ready', 'executed', 'delayed')),
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discharge_plans_admission ON discharge_plans(admission_id);
CREATE INDEX IF NOT EXISTS idx_discharge_plans_patient ON discharge_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_discharge_plans_target_date ON discharge_plans(target_discharge_date);

-- =====================================================================================================================
-- 3. utilization_reviews Table
--    Utilization management and continued stay reviews
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS utilization_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  admission_id UUID NOT NULL REFERENCES admissions(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  
  -- Review
  review_date DATE DEFAULT CURRENT_DATE,
  review_type VARCHAR(50) CHECK (review_type IN ('admission', 'continued_stay', 'discharge')),
  
  -- Medical Necessity
  medical_necessity_met BOOLEAN,
  necessity_criteria TEXT,
  
  -- Level of Care
  current_level_of_care VARCHAR(100), -- Inpatient, observation, etc.
  appropriate_level_of_care BOOLEAN,
  recommended_level VARCHAR(100),
  
  -- Length of Stay
  current_los INTEGER, -- Days
  expected_los INTEGER,
  los_variance INTEGER GENERATED ALWAYS AS (current_los - expected_los) STORED,
  
  -- Recommendations
  recommendations TEXT,
  discharge_plan_in_place BOOLEAN DEFAULT false,
  
  -- Next Review
  next_review_date DATE,
  
  -- Reviewer
  reviewed_by UUID NOT NULL REFERENCES users(id),
  
  -- Status
  review_status VARCHAR(50) DEFAULT 'approved' CHECK (review_status IN ('approved', 'denied', 'pending', 'appeal')),
  denial_reason TEXT,
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_util_review_admission ON utilization_reviews(admission_id);
CREATE INDEX IF NOT EXISTS idx_util_review_patient ON utilization_reviews(patient_id);
CREATE INDEX IF NOT EXISTS idx_util_review_date ON utilization_reviews(review_date);

-- Comments
COMMENT ON TABLE case_management_assessments IS 'Case management assessments with social determinants and discharge barriers';
COMMENT ON TABLE discharge_plans IS 'Comprehensive discharge planning with medication reconciliation and follow-up';
COMMENT ON TABLE utilization_reviews IS 'Utilization management and continued stay reviews for medical necessity';

COMMENT ON COLUMN discharge_plans.discharge_disposition IS 'Patient discharge destination';
COMMENT ON COLUMN utilization_reviews.los_variance IS 'Difference between current and expected length of stay';




