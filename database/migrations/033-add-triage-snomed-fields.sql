-- Migration 033: Add Triage Assessment SNOMED fields
-- Date: February 12, 2026
-- Description: Add SNOMED CT structured data support to triage assessments

ALTER TABLE triage_assessments
ADD COLUMN IF NOT EXISTS chief_complaint_snomed_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS chief_complaint_snomed_term TEXT,
ADD COLUMN IF NOT EXISTS chief_complaint_snomed_module_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS chief_complaint_snomed_definition_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS symptoms TEXT,
ADD COLUMN IF NOT EXISTS symptoms_snomed JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS medications_snomed JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS history_snomed JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS observations_snomed JSONB DEFAULT '[]'::jsonb;

-- Add comments
COMMENT ON COLUMN triage_assessments.symptoms_snomed IS 'Array of SNOMED CT concepts for symptoms';
COMMENT ON COLUMN triage_assessments.medications_snomed IS 'Array of SNOMED CT concepts for current medications';
COMMENT ON COLUMN triage_assessments.history_snomed IS 'Array of SNOMED CT concepts for medical history';
