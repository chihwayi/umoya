-- Migration: Add WHO Smart Forms Data Storage Columns
-- Date: 2024-12-09
-- Description: Adds JSONB columns to store complete WHO Smart Forms data for audit and data integrity

-- HIV Tests Table
ALTER TABLE hiv_tests 
ADD COLUMN IF NOT EXISTS who_smart_form_data JSONB;

CREATE INDEX IF NOT EXISTS idx_hiv_tests_who_smart_form_data 
ON hiv_tests USING GIN(who_smart_form_data);

-- HIV Enrollments Table
ALTER TABLE hiv_care_enrollments 
ADD COLUMN IF NOT EXISTS who_smart_form_data JSONB;

CREATE INDEX IF NOT EXISTS idx_hiv_enrollments_who_smart_form_data 
ON hiv_care_enrollments USING GIN(who_smart_form_data);

-- HIV Clinical Visits Table
ALTER TABLE hiv_clinical_visits 
ADD COLUMN IF NOT EXISTS who_smart_form_data JSONB;

CREATE INDEX IF NOT EXISTS idx_hiv_clinical_visits_who_smart_form_data 
ON hiv_clinical_visits USING GIN(who_smart_form_data);

-- TB Screenings Table
ALTER TABLE tb_screenings 
ADD COLUMN IF NOT EXISTS who_smart_form_data JSONB;

CREATE INDEX IF NOT EXISTS idx_tb_screenings_who_smart_form_data 
ON tb_screenings USING GIN(who_smart_form_data);

-- Appointments Table (for Clinical Notes Smart Forms)
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS who_smart_form_data JSONB;

CREATE INDEX IF NOT EXISTS idx_appointments_who_smart_form_data 
ON appointments USING GIN(who_smart_form_data);

-- Medical Records Table (for general clinical documentation)
ALTER TABLE medical_records 
ADD COLUMN IF NOT EXISTS who_smart_form_data JSONB;

CREATE INDEX IF NOT EXISTS idx_medical_records_who_smart_form_data 
ON medical_records USING GIN(who_smart_form_data);

-- Comments
COMMENT ON COLUMN hiv_tests.who_smart_form_data IS 'Complete WHO Smart Forms data (FHIR QuestionnaireResponse) stored as JSONB for audit trail and data integrity';
COMMENT ON COLUMN hiv_care_enrollments.who_smart_form_data IS 'Complete WHO Smart Forms data from enrollment forms';
COMMENT ON COLUMN hiv_clinical_visits.who_smart_form_data IS 'Complete WHO Smart Forms data from clinical visit forms';
COMMENT ON COLUMN tb_screenings.who_smart_form_data IS 'Complete WHO Smart Forms data from TB screening forms';
COMMENT ON COLUMN appointments.who_smart_form_data IS 'Complete WHO Smart Forms data from clinical notes/documentation forms';
COMMENT ON COLUMN medical_records.who_smart_form_data IS 'Complete WHO Smart Forms data from general clinical documentation forms';


