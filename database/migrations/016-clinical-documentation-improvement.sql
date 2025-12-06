-- Migration 016: Clinical Documentation Improvement (CDI)
-- Date: December 4, 2025
-- Description: Adds CDI workflow with physician queries, DRG impact analysis, and documentation completeness tracking.

-- =====================================================================================================================
-- 1. cdi_reviews Table
--    CDI specialist reviews of clinical documentation
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS cdi_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  admission_id UUID NOT NULL REFERENCES admissions(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  
  -- Review Details
  review_date DATE DEFAULT CURRENT_DATE,
  review_type VARCHAR(50) CHECK (review_type IN ('concurrent', 'retrospective', 'post_discharge')),
  
  -- DRG Analysis
  current_drg VARCHAR(10),
  current_drg_weight DECIMAL(6, 4),
  potential_drg VARCHAR(10),
  potential_drg_weight DECIMAL(6, 4),
  potential_impact DECIMAL(10, 2), -- Additional revenue potential
  
  -- Documentation Issues
  documentation_issues JSONB DEFAULT '[]'::jsonb, -- List of missing/unclear documentation
  severity_of_illness VARCHAR(20) CHECK (severity_of_illness IN ('minor', 'moderate', 'major', 'extreme')),
  risk_of_mortality VARCHAR(20) CHECK (risk_of_mortality IN ('minor', 'moderate', 'major', 'extreme')),
  
  -- CC/MCC Opportunities
  cc_mcc_opportunities JSONB DEFAULT '[]'::jsonb, -- Potential complications/comorbidities to document
  
  -- Query Needed
  query_needed BOOLEAN DEFAULT false,
  query_reason TEXT,
  
  -- CDI Specialist
  reviewed_by UUID NOT NULL REFERENCES users(id),
  
  -- Status
  review_status VARCHAR(50) DEFAULT 'in_progress' CHECK (review_status IN 
    ('in_progress', 'query_sent', 'query_answered', 'completed', 'no_action_needed')),
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cdi_reviews_admission ON cdi_reviews(admission_id);
CREATE INDEX IF NOT EXISTS idx_cdi_reviews_patient ON cdi_reviews(patient_id);
CREATE INDEX IF NOT EXISTS idx_cdi_reviews_status ON cdi_reviews(review_status);
CREATE INDEX IF NOT EXISTS idx_cdi_reviews_date ON cdi_reviews(review_date);

-- =====================================================================================================================
-- 2. physician_queries Table
--    Queries sent to physicians for documentation clarification
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS physician_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_number VARCHAR(50) UNIQUE NOT NULL,
  
  admission_id UUID NOT NULL REFERENCES admissions(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  cdi_review_id UUID REFERENCES cdi_reviews(id),
  
  -- Query Details
  query_type VARCHAR(50) CHECK (query_type IN ('clinical_clarification', 'documentation_improvement', 'coding_question', 'conflicting_documentation')),
  query_text TEXT NOT NULL,
  clinical_indicators TEXT, -- Lab values, vitals, etc. supporting the query
  
  -- Target
  physician_id UUID NOT NULL REFERENCES users(id),
  query_date DATE DEFAULT CURRENT_DATE,
  
  -- Priority
  priority VARCHAR(20) CHECK (priority IN ('routine', 'urgent', 'stat')),
  due_date DATE,
  
  -- Impact
  potential_drg_change VARCHAR(10),
  financial_impact DECIMAL(10, 2),
  
  -- Response
  response_text TEXT,
  response_date DATE,
  response_action VARCHAR(50) CHECK (response_action IN ('documented', 'not_clinically_present', 'unable_to_determine', 'no_response')),
  
  -- Outcome
  query_status VARCHAR(50) DEFAULT 'sent' CHECK (query_status IN ('draft', 'sent', 'answered', 'closed', 'escalated')),
  documentation_improved BOOLEAN DEFAULT false,
  drg_changed BOOLEAN DEFAULT false,
  
  -- Created By
  created_by UUID NOT NULL REFERENCES users(id),
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_physician_queries_admission ON physician_queries(admission_id);
CREATE INDEX IF NOT EXISTS idx_physician_queries_physician ON physician_queries(physician_id);
CREATE INDEX IF NOT EXISTS idx_physician_queries_status ON physician_queries(query_status);
CREATE INDEX IF NOT EXISTS idx_physician_queries_date ON physician_queries(query_date);

-- =====================================================================================================================
-- 3. documentation_completeness Table
--    Tracking of documentation completeness for admissions
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS documentation_completeness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  admission_id UUID NOT NULL REFERENCES admissions(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  
  -- Completeness Scores (0-100%)
  history_physical_score INTEGER CHECK (history_physical_score BETWEEN 0 AND 100),
  progress_notes_score INTEGER CHECK (progress_notes_score BETWEEN 0 AND 100),
  discharge_summary_score INTEGER CHECK (discharge_summary_score BETWEEN 0 AND 100),
  procedure_notes_score INTEGER CHECK (procedure_notes_score BETWEEN 0 AND 100),
  overall_score INTEGER CHECK (overall_score BETWEEN 0 AND 100),
  
  -- Missing Elements
  missing_elements JSONB DEFAULT '[]'::jsonb, -- List of missing documentation
  
  -- Diagnosis Documentation
  principal_diagnosis_documented BOOLEAN DEFAULT false,
  secondary_diagnoses_count INTEGER DEFAULT 0,
  procedures_documented_count INTEGER DEFAULT 0,
  
  -- Present on Admission (POA)
  poa_indicators_complete BOOLEAN DEFAULT false,
  
  -- Discharge
  discharge_disposition VARCHAR(100),
  discharge_summary_complete BOOLEAN DEFAULT false,
  discharge_summary_date DATE,
  
  -- Compliance
  compliant_with_cms BOOLEAN DEFAULT false,
  compliance_issues JSONB DEFAULT '[]'::jsonb,
  
  -- Last Checked
  last_checked_date DATE DEFAULT CURRENT_DATE,
  checked_by UUID REFERENCES users(id),
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_completeness_admission ON documentation_completeness(admission_id);
CREATE INDEX IF NOT EXISTS idx_doc_completeness_patient ON documentation_completeness(patient_id);
CREATE INDEX IF NOT EXISTS idx_doc_completeness_score ON documentation_completeness(overall_score);

-- =====================================================================================================================
-- 4. cdi_opportunities Table
--    Potential documentation improvement opportunities
-- =====================================================================================================================
CREATE TABLE IF NOT EXISTS cdi_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  admission_id UUID NOT NULL REFERENCES admissions(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  
  -- Opportunity Details
  opportunity_type VARCHAR(100) CHECK (opportunity_type IN ('cc_mcc', 'soi_rom', 'poa_indicator', 'principal_diagnosis', 'secondary_diagnosis', 'procedure_documentation')),
  opportunity_description TEXT NOT NULL,
  
  -- Clinical Support
  supporting_data JSONB, -- Lab values, vitals, medications, etc.
  icd10_code_suggested VARCHAR(10),
  
  -- Impact
  estimated_impact DECIMAL(10, 2),
  impact_type VARCHAR(50) CHECK (impact_type IN ('drg_change', 'case_mix_index', 'severity_adjustment', 'documentation_quality')),
  
  -- Status
  status VARCHAR(50) DEFAULT 'identified' CHECK (status IN ('identified', 'query_sent', 'documented', 'declined', 'not_applicable')),
  
  -- Detected
  detected_by VARCHAR(50) DEFAULT 'system' CHECK (detected_by IN ('system', 'cdi_specialist', 'coder')),
  detected_date DATE DEFAULT CURRENT_DATE,
  
  -- Resolution
  resolved_date DATE,
  resolution_notes TEXT,
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cdi_opportunities_admission ON cdi_opportunities(admission_id);
CREATE INDEX IF NOT EXISTS idx_cdi_opportunities_status ON cdi_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_cdi_opportunities_type ON cdi_opportunities(opportunity_type);

-- Comments
COMMENT ON TABLE cdi_reviews IS 'CDI specialist reviews with DRG impact analysis';
COMMENT ON TABLE physician_queries IS 'Queries sent to physicians for documentation clarification';
COMMENT ON TABLE documentation_completeness IS 'Documentation completeness tracking for CMS compliance';
COMMENT ON TABLE cdi_opportunities IS 'Potential documentation improvement opportunities with financial impact';

COMMENT ON COLUMN physician_queries.query_type IS 'clinical_clarification: Clarify diagnosis, documentation_improvement: Add detail, coding_question: Coding clarification, conflicting_documentation: Resolve conflicts';
COMMENT ON COLUMN cdi_reviews.potential_impact IS 'Additional revenue if documentation improved and DRG optimized';




