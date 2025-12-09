-- Migration 030: Add SNOMED and ICD-10 diagnosis codes to appointments table
-- Purpose: Enable structured diagnosis coding in appointment clinical notes

-- Add SNOMED CT diagnosis fields
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS diagnosis_snomed_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS diagnosis_snomed_term TEXT;

-- Add primary diagnosis code if not exists (may already exist)
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS primary_diagnosis_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS primary_diagnosis_description TEXT;

-- Add diagnosis codes array if not exists (may already exist)
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS diagnosis_codes TEXT[];

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_appointments_diagnosis_snomed ON appointments(diagnosis_snomed_code);
CREATE INDEX IF NOT EXISTS idx_appointments_primary_diagnosis_code ON appointments(primary_diagnosis_code);
CREATE INDEX IF NOT EXISTS idx_appointments_diagnosis_codes ON appointments USING GIN(diagnosis_codes);

-- Add comments
COMMENT ON COLUMN appointments.diagnosis_snomed_code IS 'SNOMED CT concept code for primary diagnosis';
COMMENT ON COLUMN appointments.diagnosis_snomed_term IS 'SNOMED CT preferred term for primary diagnosis';
COMMENT ON COLUMN appointments.primary_diagnosis_code IS 'Primary ICD-10 diagnosis code for billing';
COMMENT ON COLUMN appointments.primary_diagnosis_description IS 'Description of primary diagnosis';
COMMENT ON COLUMN appointments.diagnosis_codes IS 'Array of ICD-10 diagnosis codes (primary and secondary)';

