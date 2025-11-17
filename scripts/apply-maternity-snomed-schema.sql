-- Maternity Module SNOMED CT Schema Migration
-- Run this script against your tenant database to add SNOMED columns
-- Usage: psql -U medicore -d <tenant_database_name> -f scripts/apply-maternity-snomed-schema.sql

-- Maternity Enrollments
ALTER TABLE maternity_enrollments ADD COLUMN IF NOT EXISTS previous_complications_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE maternity_enrollments ADD COLUMN IF NOT EXISTS current_pregnancy_complications_snomed JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_maternity_enrollments_previous_complications_snomed ON maternity_enrollments USING GIN(previous_complications_snomed);
CREATE INDEX IF NOT EXISTS idx_maternity_enrollments_current_complications_snomed ON maternity_enrollments USING GIN(current_pregnancy_complications_snomed);

-- ANC Visits
ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS complications_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS interventions_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS referral_reason_snomed_code VARCHAR(50);
ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS referral_reason_snomed_term TEXT;
ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS referral_reason_snomed_module_id VARCHAR(50);
ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS referral_reason_snomed_definition_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_anc_visits_complications_snomed ON anc_visits USING GIN(complications_snomed);
CREATE INDEX IF NOT EXISTS idx_anc_visits_interventions_snomed ON anc_visits USING GIN(interventions_snomed);
CREATE INDEX IF NOT EXISTS idx_anc_visits_referral_reason_snomed ON anc_visits(referral_reason_snomed_code);

-- Ultrasound Scans
ALTER TABLE ultrasound_scans ADD COLUMN IF NOT EXISTS anomalies_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE ultrasound_scans ADD COLUMN IF NOT EXISTS findings_snomed JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_ultrasound_scans_anomalies_snomed ON ultrasound_scans USING GIN(anomalies_snomed);
CREATE INDEX IF NOT EXISTS idx_ultrasound_scans_findings_snomed ON ultrasound_scans USING GIN(findings_snomed);

-- Deliveries
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS maternal_complications_snomed JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_deliveries_maternal_complications_snomed ON deliveries USING GIN(maternal_complications_snomed);

-- Birth Outcomes
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS congenital_anomalies_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS neonatal_complications_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS cause_of_death_snomed_code VARCHAR(50);
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS cause_of_death_snomed_term TEXT;
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS cause_of_death_snomed_module_id VARCHAR(50);
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS cause_of_death_snomed_definition_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_birth_outcomes_congenital_anomalies_snomed ON birth_outcomes USING GIN(congenital_anomalies_snomed);
CREATE INDEX IF NOT EXISTS idx_birth_outcomes_neonatal_complications_snomed ON birth_outcomes USING GIN(neonatal_complications_snomed);
CREATE INDEX IF NOT EXISTS idx_birth_outcomes_cause_of_death_snomed ON birth_outcomes(cause_of_death_snomed_code);

-- Postnatal Visits
ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS newborn_complications_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS family_planning_method_snomed_code VARCHAR(50);
ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS family_planning_method_snomed_term TEXT;
ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS family_planning_method_snomed_module_id VARCHAR(50);
ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS family_planning_method_snomed_definition_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_postnatal_visits_newborn_complications_snomed ON postnatal_visits USING GIN(newborn_complications_snomed);
CREATE INDEX IF NOT EXISTS idx_postnatal_visits_family_planning_snomed ON postnatal_visits(family_planning_method_snomed_code);

-- Maternity Risk Factors
ALTER TABLE maternity_risk_factors ADD COLUMN IF NOT EXISTS risk_factor_snomed_code VARCHAR(50);
ALTER TABLE maternity_risk_factors ADD COLUMN IF NOT EXISTS risk_factor_snomed_term TEXT;
ALTER TABLE maternity_risk_factors ADD COLUMN IF NOT EXISTS risk_factor_snomed_module_id VARCHAR(50);
ALTER TABLE maternity_risk_factors ADD COLUMN IF NOT EXISTS risk_factor_snomed_definition_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_maternity_risk_factors_snomed ON maternity_risk_factors(risk_factor_snomed_code);

SELECT '✅ Maternity SNOMED CT schema applied successfully!' as status;

-- Run this script against your tenant database to add SNOMED columns
-- Usage: psql -U medicore -d <tenant_database_name> -f scripts/apply-maternity-snomed-schema.sql

-- Maternity Enrollments
ALTER TABLE maternity_enrollments ADD COLUMN IF NOT EXISTS previous_complications_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE maternity_enrollments ADD COLUMN IF NOT EXISTS current_pregnancy_complications_snomed JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_maternity_enrollments_previous_complications_snomed ON maternity_enrollments USING GIN(previous_complications_snomed);
CREATE INDEX IF NOT EXISTS idx_maternity_enrollments_current_complications_snomed ON maternity_enrollments USING GIN(current_pregnancy_complications_snomed);

-- ANC Visits
ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS complications_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS interventions_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS referral_reason_snomed_code VARCHAR(50);
ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS referral_reason_snomed_term TEXT;
ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS referral_reason_snomed_module_id VARCHAR(50);
ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS referral_reason_snomed_definition_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_anc_visits_complications_snomed ON anc_visits USING GIN(complications_snomed);
CREATE INDEX IF NOT EXISTS idx_anc_visits_interventions_snomed ON anc_visits USING GIN(interventions_snomed);
CREATE INDEX IF NOT EXISTS idx_anc_visits_referral_reason_snomed ON anc_visits(referral_reason_snomed_code);

-- Ultrasound Scans
ALTER TABLE ultrasound_scans ADD COLUMN IF NOT EXISTS anomalies_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE ultrasound_scans ADD COLUMN IF NOT EXISTS findings_snomed JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_ultrasound_scans_anomalies_snomed ON ultrasound_scans USING GIN(anomalies_snomed);
CREATE INDEX IF NOT EXISTS idx_ultrasound_scans_findings_snomed ON ultrasound_scans USING GIN(findings_snomed);

-- Deliveries
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS maternal_complications_snomed JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_deliveries_maternal_complications_snomed ON deliveries USING GIN(maternal_complications_snomed);

-- Birth Outcomes
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS congenital_anomalies_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS neonatal_complications_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS cause_of_death_snomed_code VARCHAR(50);
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS cause_of_death_snomed_term TEXT;
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS cause_of_death_snomed_module_id VARCHAR(50);
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS cause_of_death_snomed_definition_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_birth_outcomes_congenital_anomalies_snomed ON birth_outcomes USING GIN(congenital_anomalies_snomed);
CREATE INDEX IF NOT EXISTS idx_birth_outcomes_neonatal_complications_snomed ON birth_outcomes USING GIN(neonatal_complications_snomed);
CREATE INDEX IF NOT EXISTS idx_birth_outcomes_cause_of_death_snomed ON birth_outcomes(cause_of_death_snomed_code);

-- Postnatal Visits
ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS newborn_complications_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS family_planning_method_snomed_code VARCHAR(50);
ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS family_planning_method_snomed_term TEXT;
ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS family_planning_method_snomed_module_id VARCHAR(50);
ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS family_planning_method_snomed_definition_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_postnatal_visits_newborn_complications_snomed ON postnatal_visits USING GIN(newborn_complications_snomed);
CREATE INDEX IF NOT EXISTS idx_postnatal_visits_family_planning_snomed ON postnatal_visits(family_planning_method_snomed_code);

-- Maternity Risk Factors
ALTER TABLE maternity_risk_factors ADD COLUMN IF NOT EXISTS risk_factor_snomed_code VARCHAR(50);
ALTER TABLE maternity_risk_factors ADD COLUMN IF NOT EXISTS risk_factor_snomed_term TEXT;
ALTER TABLE maternity_risk_factors ADD COLUMN IF NOT EXISTS risk_factor_snomed_module_id VARCHAR(50);
ALTER TABLE maternity_risk_factors ADD COLUMN IF NOT EXISTS risk_factor_snomed_definition_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_maternity_risk_factors_snomed ON maternity_risk_factors(risk_factor_snomed_code);

SELECT '✅ Maternity SNOMED CT schema applied successfully!' as status;

-- Run this script against your tenant database to add SNOMED columns
-- Usage: psql -U medicore -d <tenant_database_name> -f scripts/apply-maternity-snomed-schema.sql

-- Maternity Enrollments
ALTER TABLE maternity_enrollments ADD COLUMN IF NOT EXISTS previous_complications_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE maternity_enrollments ADD COLUMN IF NOT EXISTS current_pregnancy_complications_snomed JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_maternity_enrollments_previous_complications_snomed ON maternity_enrollments USING GIN(previous_complications_snomed);
CREATE INDEX IF NOT EXISTS idx_maternity_enrollments_current_complications_snomed ON maternity_enrollments USING GIN(current_pregnancy_complications_snomed);

-- ANC Visits
ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS complications_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS interventions_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS referral_reason_snomed_code VARCHAR(50);
ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS referral_reason_snomed_term TEXT;
ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS referral_reason_snomed_module_id VARCHAR(50);
ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS referral_reason_snomed_definition_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_anc_visits_complications_snomed ON anc_visits USING GIN(complications_snomed);
CREATE INDEX IF NOT EXISTS idx_anc_visits_interventions_snomed ON anc_visits USING GIN(interventions_snomed);
CREATE INDEX IF NOT EXISTS idx_anc_visits_referral_reason_snomed ON anc_visits(referral_reason_snomed_code);

-- Ultrasound Scans
ALTER TABLE ultrasound_scans ADD COLUMN IF NOT EXISTS anomalies_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE ultrasound_scans ADD COLUMN IF NOT EXISTS findings_snomed JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_ultrasound_scans_anomalies_snomed ON ultrasound_scans USING GIN(anomalies_snomed);
CREATE INDEX IF NOT EXISTS idx_ultrasound_scans_findings_snomed ON ultrasound_scans USING GIN(findings_snomed);

-- Deliveries
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS maternal_complications_snomed JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_deliveries_maternal_complications_snomed ON deliveries USING GIN(maternal_complications_snomed);

-- Birth Outcomes
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS congenital_anomalies_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS neonatal_complications_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS cause_of_death_snomed_code VARCHAR(50);
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS cause_of_death_snomed_term TEXT;
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS cause_of_death_snomed_module_id VARCHAR(50);
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS cause_of_death_snomed_definition_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_birth_outcomes_congenital_anomalies_snomed ON birth_outcomes USING GIN(congenital_anomalies_snomed);
CREATE INDEX IF NOT EXISTS idx_birth_outcomes_neonatal_complications_snomed ON birth_outcomes USING GIN(neonatal_complications_snomed);
CREATE INDEX IF NOT EXISTS idx_birth_outcomes_cause_of_death_snomed ON birth_outcomes(cause_of_death_snomed_code);

-- Postnatal Visits
ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS newborn_complications_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS family_planning_method_snomed_code VARCHAR(50);
ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS family_planning_method_snomed_term TEXT;
ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS family_planning_method_snomed_module_id VARCHAR(50);
ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS family_planning_method_snomed_definition_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_postnatal_visits_newborn_complications_snomed ON postnatal_visits USING GIN(newborn_complications_snomed);
CREATE INDEX IF NOT EXISTS idx_postnatal_visits_family_planning_snomed ON postnatal_visits(family_planning_method_snomed_code);

-- Maternity Risk Factors
ALTER TABLE maternity_risk_factors ADD COLUMN IF NOT EXISTS risk_factor_snomed_code VARCHAR(50);
ALTER TABLE maternity_risk_factors ADD COLUMN IF NOT EXISTS risk_factor_snomed_term TEXT;
ALTER TABLE maternity_risk_factors ADD COLUMN IF NOT EXISTS risk_factor_snomed_module_id VARCHAR(50);
ALTER TABLE maternity_risk_factors ADD COLUMN IF NOT EXISTS risk_factor_snomed_definition_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_maternity_risk_factors_snomed ON maternity_risk_factors(risk_factor_snomed_code);

SELECT '✅ Maternity SNOMED CT schema applied successfully!' as status;




