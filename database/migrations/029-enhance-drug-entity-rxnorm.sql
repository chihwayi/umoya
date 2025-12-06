-- Migration: Enhance Drug Entity with RxNorm and FHIR Fields
-- Date: 2025-12-06
-- Purpose: Add RxNorm codes, SNOMED codes, NDC, strength, unit, and status fields for FHIR Medication resource support

-- Add RxNorm fields
ALTER TABLE drugs ADD COLUMN IF NOT EXISTS rxnorm_code VARCHAR(20);
ALTER TABLE drugs ADD COLUMN IF NOT EXISTS rxnorm_name TEXT;
ALTER TABLE drugs ADD COLUMN IF NOT EXISTS rxnorm_tty VARCHAR(10); -- Term Type (SCD, SCDC, etc.)

-- Add SNOMED CT fields
ALTER TABLE drugs ADD COLUMN IF NOT EXISTS snomed_code VARCHAR(50);
ALTER TABLE drugs ADD COLUMN IF NOT EXISTS snomed_term TEXT;

-- Add NDC (National Drug Code) field
ALTER TABLE drugs ADD COLUMN IF NOT EXISTS ndc_code VARCHAR(20);

-- Add strength and unit fields
ALTER TABLE drugs ADD COLUMN IF NOT EXISTS strength VARCHAR(50);
ALTER TABLE drugs ADD COLUMN IF NOT EXISTS unit VARCHAR(20);

-- Add status field (FHIR standard: active, inactive, entered-in-error)
ALTER TABLE drugs ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_drugs_rxnorm_code ON drugs(rxnorm_code);
CREATE INDEX IF NOT EXISTS idx_drugs_rxnorm_name ON drugs USING gin(to_tsvector('english', rxnorm_name));
CREATE INDEX IF NOT EXISTS idx_drugs_snomed_code ON drugs(snomed_code);
CREATE INDEX IF NOT EXISTS idx_drugs_ndc_code ON drugs(ndc_code);
CREATE INDEX IF NOT EXISTS idx_drugs_status ON drugs(status);

-- Add comments
COMMENT ON COLUMN drugs.rxnorm_code IS 'RxNorm Concept Unique Identifier (RXCUI)';
COMMENT ON COLUMN drugs.rxnorm_name IS 'RxNorm preferred name or normalized drug name';
COMMENT ON COLUMN drugs.rxnorm_tty IS 'RxNorm Term Type (SCD=Semantic Clinical Drug, SCDC=Semantic Clinical Drug Component)';
COMMENT ON COLUMN drugs.snomed_code IS 'SNOMED CT concept code for medication';
COMMENT ON COLUMN drugs.snomed_term IS 'SNOMED CT preferred term';
COMMENT ON COLUMN drugs.ndc_code IS 'National Drug Code (US FDA)';
COMMENT ON COLUMN drugs.strength IS 'Drug strength (e.g., "500", "10mg")';
COMMENT ON COLUMN drugs.unit IS 'Unit of measurement (e.g., "mg", "ml", "tablet")';
COMMENT ON COLUMN drugs.status IS 'FHIR Medication status: active, inactive, entered-in-error';

