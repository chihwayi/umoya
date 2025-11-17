#!/bin/bash

# Script to apply SNOMED CT terminology schema to existing tenant databases
# Usage: ./scripts/apply-snomed-schema.sh

set -e

DB_HOST="${DB_HOST:-postgres-master}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-medicore}"
DB_PASSWORD="${DB_PASSWORD:-medicore_password}"
MASTER_DB="${MASTER_DB:-medicore_master}"

echo "🚀 Applying SNOMED CT Terminology Schema to Existing Databases..."
echo "Fetching list of tenant databases..."

# Get list of tenant databases
TENANT_DBS=$(docker exec medicore-postgres-master psql -U $DB_USER -d $MASTER_DB -t -c "SELECT \"databaseName\" FROM tenants WHERE status IN ('active', 'pending', 'suspended')" | tr -d ' ' | grep -v '^$')

if [ -z "$TENANT_DBS" ]; then
    echo "⚠️  No tenant databases found"
    exit 0
fi

for DB_NAME in $TENANT_DBS; do
    echo ""
    echo "=========================================="
    echo "Applying SNOMED CT schema to: $DB_NAME"
    echo "=========================================="
    
    docker exec medicore-postgres-master psql -U $DB_USER -d $DB_NAME <<EOF
-- SNOMED CT Terminology Service Tables
CREATE TABLE IF NOT EXISTS snomed_search_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_term VARCHAR(255) NOT NULL,
  result_limit INTEGER NOT NULL,
  result_offset INTEGER NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(search_term, result_limit, result_offset)
);

CREATE INDEX IF NOT EXISTS idx_snomed_search_cache_term ON snomed_search_cache(search_term);
CREATE INDEX IF NOT EXISTS idx_snomed_search_cache_created ON snomed_search_cache(created_at);

CREATE TABLE IF NOT EXISTS snomed_concept_cache (
  concept_id VARCHAR(50) PRIMARY KEY,
  concept_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snomed_concept_cache_created ON snomed_concept_cache(created_at);

CREATE TABLE IF NOT EXISTS snomed_mapping_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_code VARCHAR(50) NOT NULL,
  target_code VARCHAR(50) NOT NULL,
  target_system VARCHAR(20) NOT NULL CHECK (target_system IN ('ICD10', 'ICD11', 'LOINC', 'CPT')),
  map_category VARCHAR(100),
  active BOOLEAN NOT NULL DEFAULT true,
  mapping_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(source_code, target_code, target_system)
);

CREATE INDEX IF NOT EXISTS idx_snomed_mapping_source ON snomed_mapping_cache(source_code, target_system);
CREATE INDEX IF NOT EXISTS idx_snomed_mapping_target ON snomed_mapping_cache(target_code, target_system);
CREATE INDEX IF NOT EXISTS idx_snomed_mapping_active ON snomed_mapping_cache(active);

CREATE TABLE IF NOT EXISTS snomed_manual_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_code VARCHAR(50) NOT NULL,
  target_code VARCHAR(50) NOT NULL,
  target_system VARCHAR(20) NOT NULL CHECK (target_system IN ('ICD10', 'ICD11', 'LOINC', 'CPT')),
  map_category VARCHAR(100),
  description TEXT,
  created_by UUID REFERENCES users(id),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(source_code, target_code, target_system)
);

CREATE INDEX IF NOT EXISTS idx_snomed_manual_mapping_source ON snomed_manual_mappings(source_code, target_system);
CREATE INDEX IF NOT EXISTS idx_snomed_manual_mapping_active ON snomed_manual_mappings(active);

-- Extend clinical tables with SNOMED columns
ALTER TABLE problems ADD COLUMN IF NOT EXISTS code_system VARCHAR(50) DEFAULT 'SNOMED_CT';
ALTER TABLE problems ADD COLUMN IF NOT EXISTS snomed_concept_id VARCHAR(50);
ALTER TABLE problems ADD COLUMN IF NOT EXISTS snomed_term TEXT;
ALTER TABLE problems ADD COLUMN IF NOT EXISTS snomed_module_id VARCHAR(50);
ALTER TABLE problems ADD COLUMN IF NOT EXISTS snomed_definition_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_problems_snomed_concept ON problems(snomed_concept_id);

ALTER TABLE allergies ADD COLUMN IF NOT EXISTS allergen_snomed_code VARCHAR(50);
ALTER TABLE allergies ADD COLUMN IF NOT EXISTS allergen_snomed_term TEXT;
ALTER TABLE allergies ADD COLUMN IF NOT EXISTS allergen_snomed_module_id VARCHAR(50);
ALTER TABLE allergies ADD COLUMN IF NOT EXISTS reaction_snomed_code VARCHAR(50);
ALTER TABLE allergies ADD COLUMN IF NOT EXISTS reaction_snomed_term TEXT;
ALTER TABLE allergies ADD COLUMN IF NOT EXISTS severity_snomed_code VARCHAR(50);
ALTER TABLE allergies ADD COLUMN IF NOT EXISTS severity_snomed_term TEXT;
ALTER TABLE allergies ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50);
ALTER TABLE allergies ADD COLUMN IF NOT EXISTS clinical_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_allergies_snomed_allergen ON allergies(allergen_snomed_code);
CREATE INDEX IF NOT EXISTS idx_allergies_reaction_snomed ON allergies(reaction_snomed_code);

ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS snomed_concept_id VARCHAR(50);
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS snomed_term TEXT;
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS snomed_module_id VARCHAR(50);
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS snomed_definition_status VARCHAR(50);
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS loinc_code VARCHAR(50);
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS loinc_long_name TEXT;
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS cpt_code VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_lab_orders_snomed_concept ON lab_orders(snomed_concept_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_loinc_code ON lab_orders(loinc_code);

ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS snomed_concept_id VARCHAR(50);
ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS snomed_term TEXT;
ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS snomed_module_id VARCHAR(50);
ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS snomed_definition_status VARCHAR(50);
ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS cpt_code VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_imaging_orders_snomed_concept ON imaging_orders(snomed_concept_id);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS snomed_concept_id VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS snomed_term TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS snomed_module_id VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS snomed_definition_status VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS external_codes JSONB DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_orders_snomed_concept ON orders(snomed_concept_id);

ALTER TABLE ophthalmology_encounters ADD COLUMN IF NOT EXISTS chief_complaint_snomed_code VARCHAR(50);
ALTER TABLE ophthalmology_encounters ADD COLUMN IF NOT EXISTS chief_complaint_snomed_term TEXT;
ALTER TABLE ophthalmology_encounters ADD COLUMN IF NOT EXISTS chief_complaint_snomed_module_id VARCHAR(50);
ALTER TABLE ophthalmology_encounters ADD COLUMN IF NOT EXISTS chief_complaint_snomed_definition_status VARCHAR(50);
ALTER TABLE ophthalmology_encounters ADD COLUMN IF NOT EXISTS assessment_snomed_code VARCHAR(50);
ALTER TABLE ophthalmology_encounters ADD COLUMN IF NOT EXISTS assessment_snomed_term TEXT;
ALTER TABLE ophthalmology_encounters ADD COLUMN IF NOT EXISTS assessment_snomed_module_id VARCHAR(50);
ALTER TABLE ophthalmology_encounters ADD COLUMN IF NOT EXISTS assessment_snomed_definition_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_ophthalmology_encounters_complaint_snomed ON ophthalmology_encounters(chief_complaint_snomed_code);
CREATE INDEX IF NOT EXISTS idx_ophthalmology_encounters_assessment_snomed ON ophthalmology_encounters(assessment_snomed_code);

ALTER TABLE ophthalmology_slit_lamp_findings ADD COLUMN IF NOT EXISTS structure_snomed_code VARCHAR(50);
ALTER TABLE ophthalmology_slit_lamp_findings ADD COLUMN IF NOT EXISTS structure_snomed_term TEXT;
ALTER TABLE ophthalmology_slit_lamp_findings ADD COLUMN IF NOT EXISTS observation_snomed_code VARCHAR(50);
ALTER TABLE ophthalmology_slit_lamp_findings ADD COLUMN IF NOT EXISTS observation_snomed_term TEXT;

ALTER TABLE ophthalmology_procedures ADD COLUMN IF NOT EXISTS procedure_snomed_code VARCHAR(50);
ALTER TABLE ophthalmology_procedures ADD COLUMN IF NOT EXISTS procedure_snomed_term TEXT;

ALTER TABLE ophthalmology_follow_ups ADD COLUMN IF NOT EXISTS reason_snomed_code VARCHAR(50);
ALTER TABLE ophthalmology_follow_ups ADD COLUMN IF NOT EXISTS reason_snomed_term TEXT;

ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS visit_reason_snomed_code VARCHAR(50);
ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS visit_reason_snomed_term TEXT;
ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS visit_reason_snomed_module_id VARCHAR(50);
ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS visit_reason_snomed_definition_status VARCHAR(50);
ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS opportunistic_infections_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS tb_screening_snomed_code VARCHAR(50);
ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS tb_screening_snomed_term TEXT;
ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS tb_screening_snomed_module_id VARCHAR(50);
ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS tb_screening_snomed_definition_status VARCHAR(50);
ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS tb_investigation_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS arv_reason_snomed_code VARCHAR(50);
ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS arv_reason_snomed_term TEXT;
ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS arv_regimen_snomed_code VARCHAR(50);
ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS arv_regimen_snomed_term TEXT;
ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS arv_regimen_snomed_module_id VARCHAR(50);
ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS arv_regimen_snomed_definition_status VARCHAR(50);
ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS mental_health_result_snomed_code VARCHAR(50);
ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS mental_health_result_snomed_term TEXT;
ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS mental_health_management_snomed_code VARCHAR(50);
ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS mental_health_management_snomed_term TEXT;
ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS adverse_events_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS referral_reason_snomed_code VARCHAR(50);
ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS referral_reason_snomed_term TEXT;
ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS follow_up_actions_snomed JSONB DEFAULT '[]'::jsonb;

ALTER TABLE hiv_eac_sessions ADD COLUMN IF NOT EXISTS adherence_barriers_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE hiv_eac_sessions ADD COLUMN IF NOT EXISTS interventions_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE hiv_eac_sessions ADD COLUMN IF NOT EXISTS adherence_tools_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE hiv_eac_sessions ADD COLUMN IF NOT EXISTS support_systems_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE hiv_eac_sessions ADD COLUMN IF NOT EXISTS follow_up_actions_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE hiv_eac_sessions ADD COLUMN IF NOT EXISTS session_outcome_snomed_code VARCHAR(50);
ALTER TABLE hiv_eac_sessions ADD COLUMN IF NOT EXISTS session_outcome_snomed_term TEXT;

ALTER TABLE tb_screenings ADD COLUMN IF NOT EXISTS screening_reason_snomed_code VARCHAR(50);
ALTER TABLE tb_screenings ADD COLUMN IF NOT EXISTS screening_reason_snomed_term TEXT;
ALTER TABLE tb_screenings ADD COLUMN IF NOT EXISTS screening_result_snomed_code VARCHAR(50);
ALTER TABLE tb_screenings ADD COLUMN IF NOT EXISTS screening_result_snomed_term TEXT;
ALTER TABLE tb_screenings ADD COLUMN IF NOT EXISTS symptom_snomed_codes JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tb_screenings ADD COLUMN IF NOT EXISTS diagnosis_snomed_code VARCHAR(50);
ALTER TABLE tb_screenings ADD COLUMN IF NOT EXISTS diagnosis_snomed_term TEXT;
ALTER TABLE tb_screenings ADD COLUMN IF NOT EXISTS treatment_snomed_code VARCHAR(50);
ALTER TABLE tb_screenings ADD COLUMN IF NOT EXISTS treatment_snomed_term TEXT;

ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS test_snomed_code VARCHAR(50);
ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS test_snomed_term TEXT;
ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS test_snomed_module_id VARCHAR(50);
ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS test_snomed_definition_status VARCHAR(50);
ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS specimen_snomed_code VARCHAR(50);
ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS specimen_snomed_term TEXT;

ALTER TABLE sti_tests ADD COLUMN IF NOT EXISTS infection_snomed_code VARCHAR(50);
ALTER TABLE sti_tests ADD COLUMN IF NOT EXISTS infection_snomed_term TEXT;
ALTER TABLE sti_tests ADD COLUMN IF NOT EXISTS test_snomed_code VARCHAR(50);
ALTER TABLE sti_tests ADD COLUMN IF NOT EXISTS test_snomed_term TEXT;
CREATE INDEX IF NOT EXISTS idx_sti_tests_infection_snomed ON sti_tests(infection_snomed_code);

-- Maternity Module SNOMED columns
ALTER TABLE maternity_enrollments ADD COLUMN IF NOT EXISTS previous_complications_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE maternity_enrollments ADD COLUMN IF NOT EXISTS current_pregnancy_complications_snomed JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_maternity_enrollments_previous_complications_snomed ON maternity_enrollments USING GIN(previous_complications_snomed);
CREATE INDEX IF NOT EXISTS idx_maternity_enrollments_current_complications_snomed ON maternity_enrollments USING GIN(current_pregnancy_complications_snomed);

ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS complications_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS interventions_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS referral_reason_snomed_code VARCHAR(50);
ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS referral_reason_snomed_term TEXT;
ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS referral_reason_snomed_module_id VARCHAR(50);
ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS referral_reason_snomed_definition_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_anc_visits_complications_snomed ON anc_visits USING GIN(complications_snomed);
CREATE INDEX IF NOT EXISTS idx_anc_visits_interventions_snomed ON anc_visits USING GIN(interventions_snomed);
CREATE INDEX IF NOT EXISTS idx_anc_visits_referral_reason_snomed ON anc_visits(referral_reason_snomed_code);

ALTER TABLE ultrasound_scans ADD COLUMN IF NOT EXISTS anomalies_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE ultrasound_scans ADD COLUMN IF NOT EXISTS findings_snomed JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_ultrasound_scans_anomalies_snomed ON ultrasound_scans USING GIN(anomalies_snomed);
CREATE INDEX IF NOT EXISTS idx_ultrasound_scans_findings_snomed ON ultrasound_scans USING GIN(findings_snomed);

ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS maternal_complications_snomed JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_deliveries_maternal_complications_snomed ON deliveries USING GIN(maternal_complications_snomed);

ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS congenital_anomalies_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS neonatal_complications_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS cause_of_death_snomed_code VARCHAR(50);
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS cause_of_death_snomed_term TEXT;
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS cause_of_death_snomed_module_id VARCHAR(50);
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS cause_of_death_snomed_definition_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_birth_outcomes_congenital_anomalies_snomed ON birth_outcomes USING GIN(congenital_anomalies_snomed);
CREATE INDEX IF NOT EXISTS idx_birth_outcomes_neonatal_complications_snomed ON birth_outcomes USING GIN(neonatal_complications_snomed);
CREATE INDEX IF NOT EXISTS idx_birth_outcomes_cause_of_death_snomed ON birth_outcomes(cause_of_death_snomed_code);

ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS newborn_complications_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS family_planning_method_snomed_code VARCHAR(50);
ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS family_planning_method_snomed_term TEXT;
ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS family_planning_method_snomed_module_id VARCHAR(50);
ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS family_planning_method_snomed_definition_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_postnatal_visits_newborn_complications_snomed ON postnatal_visits USING GIN(newborn_complications_snomed);
CREATE INDEX IF NOT EXISTS idx_postnatal_visits_family_planning_snomed ON postnatal_visits(family_planning_method_snomed_code);

ALTER TABLE maternity_risk_factors ADD COLUMN IF NOT EXISTS risk_factor_snomed_code VARCHAR(50);
ALTER TABLE maternity_risk_factors ADD COLUMN IF NOT EXISTS risk_factor_snomed_term TEXT;
ALTER TABLE maternity_risk_factors ADD COLUMN IF NOT EXISTS risk_factor_snomed_module_id VARCHAR(50);
ALTER TABLE maternity_risk_factors ADD COLUMN IF NOT EXISTS risk_factor_snomed_definition_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_maternity_risk_factors_snomed ON maternity_risk_factors(risk_factor_snomed_code);

-- Triage Assessments SNOMED columns
ALTER TABLE triage_assessments ADD COLUMN IF NOT EXISTS chief_complaint_snomed_code VARCHAR(50);
ALTER TABLE triage_assessments ADD COLUMN IF NOT EXISTS chief_complaint_snomed_term TEXT;
ALTER TABLE triage_assessments ADD COLUMN IF NOT EXISTS chief_complaint_snomed_module_id VARCHAR(50);
ALTER TABLE triage_assessments ADD COLUMN IF NOT EXISTS chief_complaint_snomed_definition_status VARCHAR(50);
ALTER TABLE triage_assessments ADD COLUMN IF NOT EXISTS observations_snomed JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_triage_chief_complaint_snomed ON triage_assessments(chief_complaint_snomed_code);
CREATE INDEX IF NOT EXISTS idx_triage_observations_snomed ON triage_assessments USING GIN(observations_snomed);

-- Prescriptions SNOMED columns
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS medication_name_snomed_code VARCHAR(50);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS medication_name_snomed_term TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS medication_name_snomed_module_id VARCHAR(50);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS medication_name_snomed_definition_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_prescriptions_medication_snomed ON prescriptions(medication_name_snomed_code);

-- Nursing Notes SNOMED columns
ALTER TABLE nursing_notes ADD COLUMN IF NOT EXISTS observations_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE nursing_notes ADD COLUMN IF NOT EXISTS interventions_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE nursing_notes ADD COLUMN IF NOT EXISTS outcomes_snomed JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_nursing_notes_observations_snomed ON nursing_notes USING GIN(observations_snomed);
CREATE INDEX IF NOT EXISTS idx_nursing_notes_interventions_snomed ON nursing_notes USING GIN(interventions_snomed);
CREATE INDEX IF NOT EXISTS idx_nursing_notes_outcomes_snomed ON nursing_notes USING GIN(outcomes_snomed);

-- Cervical Cancer Screenings SNOMED columns
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_method_snomed_code VARCHAR(50);
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_method_snomed_term TEXT;
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_method_snomed_module_id VARCHAR(50);
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_method_snomed_definition_status VARCHAR(50);
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_result_snomed_code VARCHAR(50);
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_result_snomed_term TEXT;
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_result_snomed_module_id VARCHAR(50);
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_result_snomed_definition_status VARCHAR(50);
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS via_result_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS pap_result_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS hpv_result_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS colposcopy_result_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS biopsy_result_snomed_code VARCHAR(50);
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS biopsy_result_snomed_term TEXT;
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS biopsy_result_snomed_module_id VARCHAR(50);
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS biopsy_result_snomed_definition_status VARCHAR(50);
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS treatment_provided_snomed JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_cervical_screenings_method_snomed ON cervical_cancer_screenings(screening_method_snomed_code);
CREATE INDEX IF NOT EXISTS idx_cervical_screenings_result_snomed ON cervical_cancer_screenings(screening_result_snomed_code);
CREATE INDEX IF NOT EXISTS idx_cervical_screenings_biopsy_snomed ON cervical_cancer_screenings(biopsy_result_snomed_code);
CREATE INDEX IF NOT EXISTS idx_cervical_screenings_via_result_snomed ON cervical_cancer_screenings USING GIN(via_result_snomed);
CREATE INDEX IF NOT EXISTS idx_cervical_screenings_pap_result_snomed ON cervical_cancer_screenings USING GIN(pap_result_snomed);
CREATE INDEX IF NOT EXISTS idx_cervical_screenings_hpv_result_snomed ON cervical_cancer_screenings USING GIN(hpv_result_snomed);
CREATE INDEX IF NOT EXISTS idx_cervical_screenings_colposcopy_result_snomed ON cervical_cancer_screenings USING GIN(colposcopy_result_snomed);
CREATE INDEX IF NOT EXISTS idx_cervical_screenings_treatment_snomed ON cervical_cancer_screenings USING GIN(treatment_provided_snomed);

SELECT '✅ SNOMED CT tables created/updated successfully for $DB_NAME' as status;
EOF

    echo "✅ Successfully applied SNOMED CT schema to $DB_NAME"
done

echo ""
echo "🎉 SNOMED CT Terminology schema applied to all tenant databases!"


ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS referral_reason_snomed_module_id VARCHAR(50);
ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS referral_reason_snomed_definition_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_anc_visits_complications_snomed ON anc_visits USING GIN(complications_snomed);
CREATE INDEX IF NOT EXISTS idx_anc_visits_interventions_snomed ON anc_visits USING GIN(interventions_snomed);
CREATE INDEX IF NOT EXISTS idx_anc_visits_referral_reason_snomed ON anc_visits(referral_reason_snomed_code);

ALTER TABLE ultrasound_scans ADD COLUMN IF NOT EXISTS anomalies_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE ultrasound_scans ADD COLUMN IF NOT EXISTS findings_snomed JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_ultrasound_scans_anomalies_snomed ON ultrasound_scans USING GIN(anomalies_snomed);
CREATE INDEX IF NOT EXISTS idx_ultrasound_scans_findings_snomed ON ultrasound_scans USING GIN(findings_snomed);

ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS maternal_complications_snomed JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_deliveries_maternal_complications_snomed ON deliveries USING GIN(maternal_complications_snomed);

ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS congenital_anomalies_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS neonatal_complications_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS cause_of_death_snomed_code VARCHAR(50);
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS cause_of_death_snomed_term TEXT;
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS cause_of_death_snomed_module_id VARCHAR(50);
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS cause_of_death_snomed_definition_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_birth_outcomes_congenital_anomalies_snomed ON birth_outcomes USING GIN(congenital_anomalies_snomed);
CREATE INDEX IF NOT EXISTS idx_birth_outcomes_neonatal_complications_snomed ON birth_outcomes USING GIN(neonatal_complications_snomed);
CREATE INDEX IF NOT EXISTS idx_birth_outcomes_cause_of_death_snomed ON birth_outcomes(cause_of_death_snomed_code);

ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS newborn_complications_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS family_planning_method_snomed_code VARCHAR(50);
ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS family_planning_method_snomed_term TEXT;
ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS family_planning_method_snomed_module_id VARCHAR(50);
ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS family_planning_method_snomed_definition_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_postnatal_visits_newborn_complications_snomed ON postnatal_visits USING GIN(newborn_complications_snomed);
CREATE INDEX IF NOT EXISTS idx_postnatal_visits_family_planning_snomed ON postnatal_visits(family_planning_method_snomed_code);

ALTER TABLE maternity_risk_factors ADD COLUMN IF NOT EXISTS risk_factor_snomed_code VARCHAR(50);
ALTER TABLE maternity_risk_factors ADD COLUMN IF NOT EXISTS risk_factor_snomed_term TEXT;
ALTER TABLE maternity_risk_factors ADD COLUMN IF NOT EXISTS risk_factor_snomed_module_id VARCHAR(50);
ALTER TABLE maternity_risk_factors ADD COLUMN IF NOT EXISTS risk_factor_snomed_definition_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_maternity_risk_factors_snomed ON maternity_risk_factors(risk_factor_snomed_code);

-- Triage Assessments SNOMED columns
ALTER TABLE triage_assessments ADD COLUMN IF NOT EXISTS chief_complaint_snomed_code VARCHAR(50);
ALTER TABLE triage_assessments ADD COLUMN IF NOT EXISTS chief_complaint_snomed_term TEXT;
ALTER TABLE triage_assessments ADD COLUMN IF NOT EXISTS chief_complaint_snomed_module_id VARCHAR(50);
ALTER TABLE triage_assessments ADD COLUMN IF NOT EXISTS chief_complaint_snomed_definition_status VARCHAR(50);
ALTER TABLE triage_assessments ADD COLUMN IF NOT EXISTS observations_snomed JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_triage_chief_complaint_snomed ON triage_assessments(chief_complaint_snomed_code);
CREATE INDEX IF NOT EXISTS idx_triage_observations_snomed ON triage_assessments USING GIN(observations_snomed);

-- Prescriptions SNOMED columns
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS medication_name_snomed_code VARCHAR(50);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS medication_name_snomed_term TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS medication_name_snomed_module_id VARCHAR(50);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS medication_name_snomed_definition_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_prescriptions_medication_snomed ON prescriptions(medication_name_snomed_code);

-- Nursing Notes SNOMED columns
ALTER TABLE nursing_notes ADD COLUMN IF NOT EXISTS observations_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE nursing_notes ADD COLUMN IF NOT EXISTS interventions_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE nursing_notes ADD COLUMN IF NOT EXISTS outcomes_snomed JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_nursing_notes_observations_snomed ON nursing_notes USING GIN(observations_snomed);
CREATE INDEX IF NOT EXISTS idx_nursing_notes_interventions_snomed ON nursing_notes USING GIN(interventions_snomed);
CREATE INDEX IF NOT EXISTS idx_nursing_notes_outcomes_snomed ON nursing_notes USING GIN(outcomes_snomed);

-- Cervical Cancer Screenings SNOMED columns
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_method_snomed_code VARCHAR(50);
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_method_snomed_term TEXT;
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_method_snomed_module_id VARCHAR(50);
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_method_snomed_definition_status VARCHAR(50);
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_result_snomed_code VARCHAR(50);
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_result_snomed_term TEXT;
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_result_snomed_module_id VARCHAR(50);
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_result_snomed_definition_status VARCHAR(50);
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS via_result_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS pap_result_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS hpv_result_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS colposcopy_result_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS biopsy_result_snomed_code VARCHAR(50);
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS biopsy_result_snomed_term TEXT;
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS biopsy_result_snomed_module_id VARCHAR(50);
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS biopsy_result_snomed_definition_status VARCHAR(50);
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS treatment_provided_snomed JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_cervical_screenings_method_snomed ON cervical_cancer_screenings(screening_method_snomed_code);
CREATE INDEX IF NOT EXISTS idx_cervical_screenings_result_snomed ON cervical_cancer_screenings(screening_result_snomed_code);
CREATE INDEX IF NOT EXISTS idx_cervical_screenings_biopsy_snomed ON cervical_cancer_screenings(biopsy_result_snomed_code);
CREATE INDEX IF NOT EXISTS idx_cervical_screenings_via_result_snomed ON cervical_cancer_screenings USING GIN(via_result_snomed);
CREATE INDEX IF NOT EXISTS idx_cervical_screenings_pap_result_snomed ON cervical_cancer_screenings USING GIN(pap_result_snomed);
CREATE INDEX IF NOT EXISTS idx_cervical_screenings_hpv_result_snomed ON cervical_cancer_screenings USING GIN(hpv_result_snomed);
CREATE INDEX IF NOT EXISTS idx_cervical_screenings_colposcopy_result_snomed ON cervical_cancer_screenings USING GIN(colposcopy_result_snomed);
CREATE INDEX IF NOT EXISTS idx_cervical_screenings_treatment_snomed ON cervical_cancer_screenings USING GIN(treatment_provided_snomed);

SELECT '✅ SNOMED CT tables created/updated successfully for $DB_NAME' as status;
EOF

    echo "✅ Successfully applied SNOMED CT schema to $DB_NAME"
done

echo ""
echo "🎉 SNOMED CT Terminology schema applied to all tenant databases!"


ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS referral_reason_snomed_module_id VARCHAR(50);
ALTER TABLE anc_visits ADD COLUMN IF NOT EXISTS referral_reason_snomed_definition_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_anc_visits_complications_snomed ON anc_visits USING GIN(complications_snomed);
CREATE INDEX IF NOT EXISTS idx_anc_visits_interventions_snomed ON anc_visits USING GIN(interventions_snomed);
CREATE INDEX IF NOT EXISTS idx_anc_visits_referral_reason_snomed ON anc_visits(referral_reason_snomed_code);

ALTER TABLE ultrasound_scans ADD COLUMN IF NOT EXISTS anomalies_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE ultrasound_scans ADD COLUMN IF NOT EXISTS findings_snomed JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_ultrasound_scans_anomalies_snomed ON ultrasound_scans USING GIN(anomalies_snomed);
CREATE INDEX IF NOT EXISTS idx_ultrasound_scans_findings_snomed ON ultrasound_scans USING GIN(findings_snomed);

ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS maternal_complications_snomed JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_deliveries_maternal_complications_snomed ON deliveries USING GIN(maternal_complications_snomed);

ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS congenital_anomalies_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS neonatal_complications_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS cause_of_death_snomed_code VARCHAR(50);
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS cause_of_death_snomed_term TEXT;
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS cause_of_death_snomed_module_id VARCHAR(50);
ALTER TABLE birth_outcomes ADD COLUMN IF NOT EXISTS cause_of_death_snomed_definition_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_birth_outcomes_congenital_anomalies_snomed ON birth_outcomes USING GIN(congenital_anomalies_snomed);
CREATE INDEX IF NOT EXISTS idx_birth_outcomes_neonatal_complications_snomed ON birth_outcomes USING GIN(neonatal_complications_snomed);
CREATE INDEX IF NOT EXISTS idx_birth_outcomes_cause_of_death_snomed ON birth_outcomes(cause_of_death_snomed_code);

ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS newborn_complications_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS family_planning_method_snomed_code VARCHAR(50);
ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS family_planning_method_snomed_term TEXT;
ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS family_planning_method_snomed_module_id VARCHAR(50);
ALTER TABLE postnatal_visits ADD COLUMN IF NOT EXISTS family_planning_method_snomed_definition_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_postnatal_visits_newborn_complications_snomed ON postnatal_visits USING GIN(newborn_complications_snomed);
CREATE INDEX IF NOT EXISTS idx_postnatal_visits_family_planning_snomed ON postnatal_visits(family_planning_method_snomed_code);

ALTER TABLE maternity_risk_factors ADD COLUMN IF NOT EXISTS risk_factor_snomed_code VARCHAR(50);
ALTER TABLE maternity_risk_factors ADD COLUMN IF NOT EXISTS risk_factor_snomed_term TEXT;
ALTER TABLE maternity_risk_factors ADD COLUMN IF NOT EXISTS risk_factor_snomed_module_id VARCHAR(50);
ALTER TABLE maternity_risk_factors ADD COLUMN IF NOT EXISTS risk_factor_snomed_definition_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_maternity_risk_factors_snomed ON maternity_risk_factors(risk_factor_snomed_code);

-- Triage Assessments SNOMED columns
ALTER TABLE triage_assessments ADD COLUMN IF NOT EXISTS chief_complaint_snomed_code VARCHAR(50);
ALTER TABLE triage_assessments ADD COLUMN IF NOT EXISTS chief_complaint_snomed_term TEXT;
ALTER TABLE triage_assessments ADD COLUMN IF NOT EXISTS chief_complaint_snomed_module_id VARCHAR(50);
ALTER TABLE triage_assessments ADD COLUMN IF NOT EXISTS chief_complaint_snomed_definition_status VARCHAR(50);
ALTER TABLE triage_assessments ADD COLUMN IF NOT EXISTS observations_snomed JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_triage_chief_complaint_snomed ON triage_assessments(chief_complaint_snomed_code);
CREATE INDEX IF NOT EXISTS idx_triage_observations_snomed ON triage_assessments USING GIN(observations_snomed);

-- Prescriptions SNOMED columns
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS medication_name_snomed_code VARCHAR(50);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS medication_name_snomed_term TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS medication_name_snomed_module_id VARCHAR(50);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS medication_name_snomed_definition_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_prescriptions_medication_snomed ON prescriptions(medication_name_snomed_code);

-- Nursing Notes SNOMED columns
ALTER TABLE nursing_notes ADD COLUMN IF NOT EXISTS observations_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE nursing_notes ADD COLUMN IF NOT EXISTS interventions_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE nursing_notes ADD COLUMN IF NOT EXISTS outcomes_snomed JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_nursing_notes_observations_snomed ON nursing_notes USING GIN(observations_snomed);
CREATE INDEX IF NOT EXISTS idx_nursing_notes_interventions_snomed ON nursing_notes USING GIN(interventions_snomed);
CREATE INDEX IF NOT EXISTS idx_nursing_notes_outcomes_snomed ON nursing_notes USING GIN(outcomes_snomed);

-- Cervical Cancer Screenings SNOMED columns
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_method_snomed_code VARCHAR(50);
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_method_snomed_term TEXT;
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_method_snomed_module_id VARCHAR(50);
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_method_snomed_definition_status VARCHAR(50);
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_result_snomed_code VARCHAR(50);
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_result_snomed_term TEXT;
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_result_snomed_module_id VARCHAR(50);
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS screening_result_snomed_definition_status VARCHAR(50);
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS via_result_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS pap_result_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS hpv_result_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS colposcopy_result_snomed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS biopsy_result_snomed_code VARCHAR(50);
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS biopsy_result_snomed_term TEXT;
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS biopsy_result_snomed_module_id VARCHAR(50);
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS biopsy_result_snomed_definition_status VARCHAR(50);
ALTER TABLE cervical_cancer_screenings ADD COLUMN IF NOT EXISTS treatment_provided_snomed JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_cervical_screenings_method_snomed ON cervical_cancer_screenings(screening_method_snomed_code);
CREATE INDEX IF NOT EXISTS idx_cervical_screenings_result_snomed ON cervical_cancer_screenings(screening_result_snomed_code);
CREATE INDEX IF NOT EXISTS idx_cervical_screenings_biopsy_snomed ON cervical_cancer_screenings(biopsy_result_snomed_code);
CREATE INDEX IF NOT EXISTS idx_cervical_screenings_via_result_snomed ON cervical_cancer_screenings USING GIN(via_result_snomed);
CREATE INDEX IF NOT EXISTS idx_cervical_screenings_pap_result_snomed ON cervical_cancer_screenings USING GIN(pap_result_snomed);
CREATE INDEX IF NOT EXISTS idx_cervical_screenings_hpv_result_snomed ON cervical_cancer_screenings USING GIN(hpv_result_snomed);
CREATE INDEX IF NOT EXISTS idx_cervical_screenings_colposcopy_result_snomed ON cervical_cancer_screenings USING GIN(colposcopy_result_snomed);
CREATE INDEX IF NOT EXISTS idx_cervical_screenings_treatment_snomed ON cervical_cancer_screenings USING GIN(treatment_provided_snomed);

SELECT '✅ SNOMED CT tables created/updated successfully for $DB_NAME' as status;
EOF

    echo "✅ Successfully applied SNOMED CT schema to $DB_NAME"
done

echo ""
echo "🎉 SNOMED CT Terminology schema applied to all tenant databases!"

