-- Add ICD-10 diagnosis codes to billing and medical aid claims tables
-- This allows proper coding for medical aid claims and financial reporting

-- Add diagnosis codes to billing table
ALTER TABLE billing 
ADD COLUMN IF NOT EXISTS diagnosis_codes TEXT[],
ADD COLUMN IF NOT EXISTS primary_diagnosis_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS primary_diagnosis_description TEXT;

-- Add diagnosis codes to medical_aid_claims table
ALTER TABLE medical_aid_claims
ADD COLUMN IF NOT EXISTS diagnosis_codes TEXT[],
ADD COLUMN IF NOT EXISTS primary_diagnosis_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS primary_diagnosis_description TEXT;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_billing_primary_diagnosis_code ON billing(primary_diagnosis_code);
CREATE INDEX IF NOT EXISTS idx_claims_primary_diagnosis_code ON medical_aid_claims(primary_diagnosis_code);
CREATE INDEX IF NOT EXISTS idx_claims_diagnosis_codes ON medical_aid_claims USING GIN(diagnosis_codes);

-- Add comments
COMMENT ON COLUMN billing.diagnosis_codes IS 'Array of ICD-10 diagnosis codes associated with this bill';
COMMENT ON COLUMN billing.primary_diagnosis_code IS 'Primary ICD-10 diagnosis code for this bill';
COMMENT ON COLUMN billing.primary_diagnosis_description IS 'Description of the primary diagnosis';
COMMENT ON COLUMN medical_aid_claims.diagnosis_codes IS 'Array of ICD-10 diagnosis codes for this claim';
COMMENT ON COLUMN medical_aid_claims.primary_diagnosis_code IS 'Primary ICD-10 diagnosis code for this claim';
COMMENT ON COLUMN medical_aid_claims.primary_diagnosis_description IS 'Description of the primary diagnosis';

