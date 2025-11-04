#!/bin/bash

# Script to apply HIV lookup tables to existing tenant databases
# This will create all lookup tables and seed them with initial data

set -e

# Database connection details
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USERNAME="${DB_USERNAME:-medicore}"
DB_PASSWORD="${DB_PASSWORD:-medicore_password}"
MASTER_DB="${MASTER_DB:-medicore_master}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🏥 Applying HIV Lookup Tables to Tenant Databases${NC}"
echo -e "${BLUE}==================================================${NC}"

# Function to get tenant database names
get_tenant_databases() {
    docker exec medicore-postgres-master psql -U $DB_USERNAME -d $MASTER_DB -t -c "
        SELECT \"databaseName\" 
        FROM tenants 
        WHERE status IN ('active', 'pending', 'suspended')
        ORDER BY \"createdAt\";
    " | tr -d ' ' | grep -v '^$'
}

# Function to apply lookup tables to a database
apply_lookup_tables() {
    local database=$1
    echo -e "${YELLOW}📋 Applying lookup tables to: $database${NC}"
    
    # Create lookup tables
    docker exec -i medicore-postgres-master psql -U $DB_USERNAME -d "$database" <<EOF
-- ===========================================
-- HIV VISIT LOOKUP TABLES
-- ===========================================

-- WHO Clinical Staging
CREATE TABLE IF NOT EXISTS hiv_who_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage INTEGER NOT NULL CHECK (stage IN (1, 2, 3, 4)),
  category VARCHAR(20) NOT NULL CHECK (category IN ('Adults', 'Paediatrics')),
  condition_code VARCHAR(50) UNIQUE NOT NULL,
  condition_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_who_staging_stage ON hiv_who_staging(stage);
CREATE INDEX IF NOT EXISTS idx_who_staging_category ON hiv_who_staging(category);

-- Visit Types
CREATE TABLE IF NOT EXISTS hiv_visit_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visit_types_code ON hiv_visit_types(code);

-- BMI Classifications
CREATE TABLE IF NOT EXISTS hiv_bmi_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  min_bmi DECIMAL(4,1),
  max_bmi DECIMAL(4,1),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pregnancy/Lactating Status
CREATE TABLE IF NOT EXISTS hiv_pregnancy_lactating_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Family Planning Methods
CREATE TABLE IF NOT EXISTS hiv_family_planning_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Functional Status
CREATE TABLE IF NOT EXISTS hiv_functional_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TB Screening Status
CREATE TABLE IF NOT EXISTS hiv_tb_screening_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TB Investigation Results
CREATE TABLE IF NOT EXISTS hiv_tb_investigation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Opportunistic Infections
CREATE TABLE IF NOT EXISTS hiv_opportunistic_infections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50),
  description TEXT,
  has_sub_categories BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oi_code ON hiv_opportunistic_infections(code);
CREATE INDEX IF NOT EXISTS idx_oi_category ON hiv_opportunistic_infections(category);

-- OI Sub-categories
CREATE TABLE IF NOT EXISTS hiv_oi_sub_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oi_id UUID NOT NULL REFERENCES hiv_opportunistic_infections(id) ON DELETE CASCADE,
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oi_sub_categories_oi_id ON hiv_oi_sub_categories(oi_id);

-- Mental Health Results
CREATE TABLE IF NOT EXISTS hiv_mental_health_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mental Health Management
CREATE TABLE IF NOT EXISTS hiv_mental_health_management (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TPT Eligibility
CREATE TABLE IF NOT EXISTS hiv_tpt_eligibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_eligible BOOLEAN,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TPT Status
CREATE TABLE IF NOT EXISTS hiv_tpt_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cryptococcal Signs
CREATE TABLE IF NOT EXISTS hiv_cryptococcal_signs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cryptococcal Status
CREATE TABLE IF NOT EXISTS hiv_cryptococcal_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cryptococcal Treatment
CREATE TABLE IF NOT EXISTS hiv_cryptococcal_treatment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ARV Status
CREATE TABLE IF NOT EXISTS hiv_arv_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ART Initiation Category
CREATE TABLE IF NOT EXISTS hiv_art_initiation_category (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adverse Events Status
CREATE TABLE IF NOT EXISTS hiv_adverse_events_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  severity VARCHAR(20) CHECK (severity IN ('minor', 'major', 'stopping')),
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ARV Reasons (Not on ARV)
CREATE TABLE IF NOT EXISTS hiv_arv_reasons_not_on (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ARV Reasons (Start ARV)
CREATE TABLE IF NOT EXISTS hiv_arv_reasons_start (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ARV Change/Stop Reasons
CREATE TABLE IF NOT EXISTS hiv_arv_change_stop_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Visit Status
CREATE TABLE IF NOT EXISTS hiv_visit_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Final Outcome
CREATE TABLE IF NOT EXISTS hiv_final_outcome (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ART Regimens
CREATE TABLE IF NOT EXISTS hiv_art_regimens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  line VARCHAR(20) NOT NULL CHECK (line IN ('1st Line', '2nd Line', '3rd Line', 'Children 1st Line', 'Children 2nd Line', 'Children 3rd Line')),
  category VARCHAR(50) NOT NULL CHECK (category IN ('Adult', 'Paediatric')),
  components TEXT[] NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  is_preferred BOOLEAN DEFAULT false,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_art_regimens_code ON hiv_art_regimens(code);
CREATE INDEX IF NOT EXISTS idx_art_regimens_line ON hiv_art_regimens(line);
CREATE INDEX IF NOT EXISTS idx_art_regimens_category ON hiv_art_regimens(category);
CREATE INDEX IF NOT EXISTS idx_art_regimens_is_active ON hiv_art_regimens(is_active);

-- Pre-Cancerous Lesion Treatment
CREATE TABLE IF NOT EXISTS hiv_precancerous_lesion_treatment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
EOF

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Tables created successfully${NC}"
    else
        echo -e "${RED}❌ Failed to create tables${NC}"
        return 1
    fi

    # Create triggers
    docker exec -i medicore-postgres-master psql -U $DB_USERNAME -d "$database" <<EOF
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS \$\$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
\$\$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_hiv_who_staging_updated_at ON hiv_who_staging;
CREATE TRIGGER update_hiv_who_staging_updated_at BEFORE UPDATE ON hiv_who_staging
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hiv_visit_types_updated_at ON hiv_visit_types;
CREATE TRIGGER update_hiv_visit_types_updated_at BEFORE UPDATE ON hiv_visit_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hiv_bmi_classifications_updated_at ON hiv_bmi_classifications;
CREATE TRIGGER update_hiv_bmi_classifications_updated_at BEFORE UPDATE ON hiv_bmi_classifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hiv_pregnancy_lactating_status_updated_at ON hiv_pregnancy_lactating_status;
CREATE TRIGGER update_hiv_pregnancy_lactating_status_updated_at BEFORE UPDATE ON hiv_pregnancy_lactating_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hiv_family_planning_methods_updated_at ON hiv_family_planning_methods;
CREATE TRIGGER update_hiv_family_planning_methods_updated_at BEFORE UPDATE ON hiv_family_planning_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hiv_functional_status_updated_at ON hiv_functional_status;
CREATE TRIGGER update_hiv_functional_status_updated_at BEFORE UPDATE ON hiv_functional_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hiv_tb_screening_status_updated_at ON hiv_tb_screening_status;
CREATE TRIGGER update_hiv_tb_screening_status_updated_at BEFORE UPDATE ON hiv_tb_screening_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hiv_tb_investigation_results_updated_at ON hiv_tb_investigation_results;
CREATE TRIGGER update_hiv_tb_investigation_results_updated_at BEFORE UPDATE ON hiv_tb_investigation_results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hiv_opportunistic_infections_updated_at ON hiv_opportunistic_infections;
CREATE TRIGGER update_hiv_opportunistic_infections_updated_at BEFORE UPDATE ON hiv_opportunistic_infections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hiv_oi_sub_categories_updated_at ON hiv_oi_sub_categories;
CREATE TRIGGER update_hiv_oi_sub_categories_updated_at BEFORE UPDATE ON hiv_oi_sub_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hiv_mental_health_results_updated_at ON hiv_mental_health_results;
CREATE TRIGGER update_hiv_mental_health_results_updated_at BEFORE UPDATE ON hiv_mental_health_results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hiv_mental_health_management_updated_at ON hiv_mental_health_management;
CREATE TRIGGER update_hiv_mental_health_management_updated_at BEFORE UPDATE ON hiv_mental_health_management
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hiv_tpt_eligibility_updated_at ON hiv_tpt_eligibility;
CREATE TRIGGER update_hiv_tpt_eligibility_updated_at BEFORE UPDATE ON hiv_tpt_eligibility
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hiv_tpt_status_updated_at ON hiv_tpt_status;
CREATE TRIGGER update_hiv_tpt_status_updated_at BEFORE UPDATE ON hiv_tpt_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hiv_cryptococcal_signs_updated_at ON hiv_cryptococcal_signs;
CREATE TRIGGER update_hiv_cryptococcal_signs_updated_at BEFORE UPDATE ON hiv_cryptococcal_signs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hiv_cryptococcal_status_updated_at ON hiv_cryptococcal_status;
CREATE TRIGGER update_hiv_cryptococcal_status_updated_at BEFORE UPDATE ON hiv_cryptococcal_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hiv_cryptococcal_treatment_updated_at ON hiv_cryptococcal_treatment;
CREATE TRIGGER update_hiv_cryptococcal_treatment_updated_at BEFORE UPDATE ON hiv_cryptococcal_treatment
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hiv_arv_status_updated_at ON hiv_arv_status;
CREATE TRIGGER update_hiv_arv_status_updated_at BEFORE UPDATE ON hiv_arv_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hiv_art_initiation_category_updated_at ON hiv_art_initiation_category;
CREATE TRIGGER update_hiv_art_initiation_category_updated_at BEFORE UPDATE ON hiv_art_initiation_category
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hiv_adverse_events_status_updated_at ON hiv_adverse_events_status;
CREATE TRIGGER update_hiv_adverse_events_status_updated_at BEFORE UPDATE ON hiv_adverse_events_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hiv_arv_reasons_not_on_updated_at ON hiv_arv_reasons_not_on;
CREATE TRIGGER update_hiv_arv_reasons_not_on_updated_at BEFORE UPDATE ON hiv_arv_reasons_not_on
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hiv_arv_reasons_start_updated_at ON hiv_arv_reasons_start;
CREATE TRIGGER update_hiv_arv_reasons_start_updated_at BEFORE UPDATE ON hiv_arv_reasons_start
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hiv_arv_change_stop_reasons_updated_at ON hiv_arv_change_stop_reasons;
CREATE TRIGGER update_hiv_arv_change_stop_reasons_updated_at BEFORE UPDATE ON hiv_arv_change_stop_reasons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hiv_visit_status_updated_at ON hiv_visit_status;
CREATE TRIGGER update_hiv_visit_status_updated_at BEFORE UPDATE ON hiv_visit_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hiv_final_outcome_updated_at ON hiv_final_outcome;
CREATE TRIGGER update_hiv_final_outcome_updated_at BEFORE UPDATE ON hiv_final_outcome
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hiv_art_regimens_updated_at ON hiv_art_regimens;
CREATE TRIGGER update_hiv_art_regimens_updated_at BEFORE UPDATE ON hiv_art_regimens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hiv_precancerous_lesion_treatment_updated_at ON hiv_precancerous_lesion_treatment;
CREATE TRIGGER update_hiv_precancerous_lesion_treatment_updated_at BEFORE UPDATE ON hiv_precancerous_lesion_treatment
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EOF

    echo -e "${GREEN}✅ Triggers created successfully${NC}"
}

# Main execution
echo -e "${YELLOW}🔍 Checking for existing tenants...${NC}"

TENANT_DBS=($(get_tenant_databases))

if [ ${#TENANT_DBS[@]} -eq 0 ]; then
    echo -e "${YELLOW}⚠️  No active tenants found.${NC}"
    exit 0
fi

echo -e "${GREEN}📊 Found ${#TENANT_DBS[@]} tenant(s):${NC}"
for db in "${TENANT_DBS[@]}"; do
    echo -e "   - $db"
done
echo ""

SUCCESS_COUNT=0
FAILED_DBS=()

for db in "${TENANT_DBS[@]}"; do
    if apply_lookup_tables "$db"; then
        ((SUCCESS_COUNT++))
        echo -e "${GREEN}✅ Completed: $db${NC}"
    else
        FAILED_DBS+=("$db")
        echo -e "${RED}❌ Failed: $db${NC}"
    fi
    echo ""
done

echo -e "${BLUE}📊 Summary${NC}"
echo -e "${BLUE}=========${NC}"
echo -e "${GREEN}✅ Successfully applied: $SUCCESS_COUNT tenant(s)${NC}"

if [ ${#FAILED_DBS[@]} -gt 0 ]; then
    echo -e "${RED}❌ Failed: ${#FAILED_DBS[@]} tenant(s)${NC}"
    echo -e "${RED}   Failed databases: ${FAILED_DBS[*]}${NC}"
fi

echo ""
echo -e "${YELLOW}📝 Note: Now run the seed script to populate the lookup tables with data${NC}"
echo -e "${YELLOW}   Run: ./scripts/seed-hiv-lookup-data.sh${NC}"
echo ""

