-- Migration 023: Advanced Nursing Features
-- Date: December 4, 2025
-- Description: Falls risk, wound care, and pain management.

CREATE TABLE IF NOT EXISTS falls_risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  admission_id UUID REFERENCES admissions(id),
  assessment_date DATE DEFAULT CURRENT_DATE,
  morse_falls_score INTEGER CHECK (morse_falls_score BETWEEN 0 AND 125),
  risk_level VARCHAR(50) CHECK (risk_level IN ('low', 'moderate', 'high')),
  interventions JSONB DEFAULT '[]'::jsonb,
  assessed_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wound_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  admission_id UUID REFERENCES admissions(id),
  wound_location VARCHAR(255) NOT NULL,
  wound_type VARCHAR(100) CHECK (wound_type IN ('pressure_injury', 'surgical', 'traumatic', 'diabetic', 'venous', 'arterial')),
  stage VARCHAR(50),
  length_cm DECIMAL(5, 2),
  width_cm DECIMAL(5, 2),
  depth_cm DECIMAL(5, 2),
  braden_score INTEGER CHECK (braden_score BETWEEN 6 AND 23),
  treatment_plan TEXT,
  assessed_by UUID NOT NULL REFERENCES users(id),
  assessment_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_falls_risk_patient ON falls_risk_assessments(patient_id);
CREATE INDEX idx_wound_patient ON wound_assessments(patient_id);




