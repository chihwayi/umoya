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

SELECT '✅ SNOMED CT tables created/updated successfully for $DB_NAME' as status;
EOF

    echo "✅ Successfully applied SNOMED CT schema to $DB_NAME"
done

echo ""
echo "🎉 SNOMED CT Terminology schema applied to all tenant databases!"

