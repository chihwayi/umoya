#!/bin/bash

# Apply Enhanced LIS Schema to Existing Tenant Databases
# This script adds the new lab test catalog, components, and related tables

set -e

echo "🏥 Applying Enhanced LIS Schema to Tenant Databases..."

# Database connection details
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5433}"
DB_USER="${DB_USER:-medicore}"
DB_PASSWORD="${DB_PASSWORD:-medicore_password}"

# Get list of tenant databases
echo "📋 Finding tenant databases..."
TENANT_DBS=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%' OR datname LIKE 'clinic_%';")

if [ -z "$TENANT_DBS" ]; then
  echo "⚠️  No tenant databases found!"
  exit 0
fi

echo "Found tenant databases:"
echo "$TENANT_DBS"
echo ""

# Apply schema to each tenant database
for DB in $TENANT_DBS; do
  DB=$(echo $DB | xargs)  # Trim whitespace
  
  echo "🔧 Applying Enhanced LIS schema to: $DB"
  
  PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB <<EOF
-- Enhanced LIS: Lab Test Catalog (detailed test definitions)
CREATE TABLE IF NOT EXISTS lab_test_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_code VARCHAR(50) UNIQUE NOT NULL,
  loinc_code VARCHAR(50),
  test_name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL CHECK (category IN ('Hematology','Chemistry','Microbiology','Immunology','Serology','Toxicology','Urinalysis','Cytology','Molecular','Other')),
  specimen_type VARCHAR(100) NOT NULL,
  specimen_volume VARCHAR(50),
  container_type VARCHAR(100),
  turnaround_time INTEGER,
  cost DECIMAL(10,2),
  description TEXT,
  clinical_significance TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_test_catalog_test_code ON lab_test_catalog(test_code);
CREATE INDEX IF NOT EXISTS idx_lab_test_catalog_loinc_code ON lab_test_catalog(loinc_code);
CREATE INDEX IF NOT EXISTS idx_lab_test_catalog_category ON lab_test_catalog(category);
CREATE INDEX IF NOT EXISTS idx_lab_test_catalog_is_active ON lab_test_catalog(is_active);

-- Enhanced LIS: Lab Test Components (individual measurable components of a test)
CREATE TABLE IF NOT EXISTS lab_test_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_catalog_id UUID NOT NULL REFERENCES lab_test_catalog(id) ON DELETE CASCADE,
  component_name VARCHAR(255) NOT NULL,
  component_code VARCHAR(50),
  loinc_code VARCHAR(50),
  unit VARCHAR(50),
  reference_range_min DECIMAL(10,4),
  reference_range_max DECIMAL(10,4),
  reference_range_text TEXT,
  critical_low DECIMAL(10,4),
  critical_high DECIMAL(10,4),
  age_specific BOOLEAN DEFAULT false,
  gender_specific BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_test_components_test_catalog_id ON lab_test_components(test_catalog_id);
CREATE INDEX IF NOT EXISTS idx_lab_test_components_component_code ON lab_test_components(component_code);
CREATE INDEX IF NOT EXISTS idx_lab_test_components_sort_order ON lab_test_components(sort_order);

-- Enhanced LIS: Lab Reference Ranges (age/gender specific ranges)
CREATE TABLE IF NOT EXISTS lab_reference_ranges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id UUID NOT NULL REFERENCES lab_test_components(id) ON DELETE CASCADE,
  age_min INTEGER,
  age_max INTEGER,
  gender VARCHAR(10) CHECK (gender IN ('male','female','all')),
  range_min DECIMAL(10,4),
  range_max DECIMAL(10,4),
  range_text TEXT,
  unit VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_reference_ranges_component_id ON lab_reference_ranges(component_id);
CREATE INDEX IF NOT EXISTS idx_lab_reference_ranges_gender ON lab_reference_ranges(gender);

-- Enhanced LIS: Lab Order Set Items (junction table for order sets)
CREATE TABLE IF NOT EXISTS lab_order_set_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_set_id UUID NOT NULL REFERENCES lab_order_sets(id) ON DELETE CASCADE,
  test_catalog_id UUID NOT NULL REFERENCES lab_test_catalog(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_order_set_items_order_set_id ON lab_order_set_items(order_set_id);
CREATE INDEX IF NOT EXISTS idx_lab_order_set_items_test_catalog_id ON lab_order_set_items(test_catalog_id);

-- Enhanced LIS: Lab Critical Alerts (enhanced version)
CREATE TABLE IF NOT EXISTS lab_critical_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  lab_order_id UUID REFERENCES lab_orders(id) ON DELETE CASCADE,
  component_name VARCHAR(255) NOT NULL,
  result_value VARCHAR(100) NOT NULL,
  critical_range VARCHAR(100),
  severity VARCHAR(20) CHECK (severity IN ('critical','panic')) DEFAULT 'critical',
  alert_status VARCHAR(20) CHECK (alert_status IN ('pending','acknowledged','escalated')) DEFAULT 'pending',
  alerted_to UUID REFERENCES users(id),
  alerted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledgment_notes TEXT,
  escalated_to UUID REFERENCES users(id),
  escalated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_critical_alerts_patient_id ON lab_critical_alerts(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_critical_alerts_lab_order_id ON lab_critical_alerts(lab_order_id);
CREATE INDEX IF NOT EXISTS idx_lab_critical_alerts_alert_status ON lab_critical_alerts(alert_status);
CREATE INDEX IF NOT EXISTS idx_lab_critical_alerts_alerted_to ON lab_critical_alerts(alerted_to);
CREATE INDEX IF NOT EXISTS idx_lab_critical_alerts_created_at ON lab_critical_alerts(created_at);

-- Enhanced LIS: Enhance lab_orders table with new columns
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS order_set_id UUID REFERENCES lab_order_sets(id);
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS test_catalog_id UUID REFERENCES lab_test_catalog(id);
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS ordering_provider UUID REFERENCES users(id);
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS clinical_indication TEXT;
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS icd10_codes TEXT[];
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS specimen_collected_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS specimen_received_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS result_reported_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS result_acknowledged BOOLEAN DEFAULT false;
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS result_acknowledged_by UUID REFERENCES users(id);
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS result_acknowledged_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS processing_context JSONB DEFAULT '{}'::jsonb;
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS workflow_events JSONB DEFAULT '[]'::jsonb;
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS handoff_notes JSONB DEFAULT '[]'::jsonb;
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS notification_log JSONB DEFAULT '[]'::jsonb;
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(12,2);
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS finance_transaction_id UUID;
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50);
UPDATE lab_orders SET payment_status = 'payment_confirmed' WHERE payment_status IS NULL OR payment_status = '';
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS snomed_concept_id VARCHAR(50);
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS snomed_term TEXT;
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS snomed_module_id VARCHAR(50);
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS snomed_definition_status VARCHAR(50);
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS loinc_code VARCHAR(50);
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS loinc_long_name TEXT;
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS cpt_code VARCHAR(50);
ALTER TABLE lab_orders DROP CONSTRAINT IF EXISTS lab_orders_status_check;
ALTER TABLE lab_orders ADD CONSTRAINT lab_orders_status_check CHECK (status IN ('awaiting_payment','ordered','collected','in_progress','completed','cancelled'));
ALTER TABLE lab_orders DROP CONSTRAINT IF EXISTS lab_orders_payment_status_check;
ALTER TABLE lab_orders ADD CONSTRAINT lab_orders_payment_status_check CHECK (payment_status IN ('awaiting_payment','payment_confirmed','in_progress','completed','cancelled'));
ALTER TABLE lab_orders ALTER COLUMN payment_status SET DEFAULT 'payment_confirmed';

CREATE INDEX IF NOT EXISTS idx_lab_orders_order_set_id ON lab_orders(order_set_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_test_catalog_id ON lab_orders(test_catalog_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_result_acknowledged ON lab_orders(result_acknowledged);
CREATE INDEX IF NOT EXISTS idx_lab_orders_payment_status ON lab_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_lab_orders_snomed_concept ON lab_orders(snomed_concept_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_loinc_code ON lab_orders(loinc_code);

-- Lab Quality Controls
CREATE TABLE IF NOT EXISTS lab_quality_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analyzer_name VARCHAR(100) NOT NULL,
  test_code VARCHAR(50),
  level VARCHAR(50),
  lot_number VARCHAR(50),
  run_datetime TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  result_value VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','pass','fail','review')),
  comments TEXT,
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_quality_controls_analyzer_name ON lab_quality_controls(analyzer_name);
CREATE INDEX IF NOT EXISTS idx_lab_quality_controls_run_datetime ON lab_quality_controls(run_datetime);
CREATE INDEX IF NOT EXISTS idx_lab_quality_controls_status ON lab_quality_controls(status);

-- Lab Reagent Inventory
CREATE TABLE IF NOT EXISTS lab_reagent_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reagent_name VARCHAR(150) NOT NULL,
  analyzer_name VARCHAR(100),
  lot_number VARCHAR(50),
  quantity_available NUMERIC(10,2) DEFAULT 0,
  unit VARCHAR(20) DEFAULT 'units',
  minimum_threshold NUMERIC(10,2) DEFAULT 0,
  expires_on DATE,
  status VARCHAR(20) DEFAULT 'ok' CHECK (status IN ('ok','warning','critical','expired')),
  notes TEXT,
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_reagent_inventory_reagent_name ON lab_reagent_inventory(reagent_name);
CREATE INDEX IF NOT EXISTS idx_lab_reagent_inventory_status ON lab_reagent_inventory(status);
CREATE INDEX IF NOT EXISTS idx_lab_reagent_inventory_expires_on ON lab_reagent_inventory(expires_on);

-- Add trigger for lab_test_catalog
DROP TRIGGER IF EXISTS update_lab_test_catalog_updated_at ON lab_test_catalog;
CREATE TRIGGER update_lab_test_catalog_updated_at 
  BEFORE UPDATE ON lab_test_catalog
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

\echo '✅ Enhanced LIS schema applied successfully!'
EOF

  if [ $? -eq 0 ]; then
    echo "✅ Schema applied successfully to $DB"
    
    # Now seed the test catalog
    echo "📊 Seeding lab test catalog for $DB..."
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB -f scripts/seed-lab-test-catalog.sql
    
    if [ $? -eq 0 ]; then
      echo "✅ Test catalog seeded successfully for $DB"
    else
      echo "⚠️  Warning: Failed to seed test catalog for $DB"
    fi
  else
    echo "❌ Failed to apply schema to $DB"
  fi
  
  echo ""
done

echo "🎉 Enhanced LIS schema application complete!"
echo ""
echo "📋 Summary:"
echo "  - Added lab_test_catalog table (detailed test definitions)"
echo "  - Added lab_test_components table (test components with reference ranges)"
echo "  - Added lab_reference_ranges table (age/gender specific ranges)"
echo "  - Added lab_order_set_items table (junction for order sets)"
echo "  - Added lab_critical_alerts table (enhanced alert system)"
echo "  - Enhanced lab_orders table with new columns"
echo "  - Seeded common lab tests (CBC, BMP, Lipid, LFT, etc.)"
echo "  - Created order sets (Pre-Op, Diabetes, ANC, Cardiac)"
echo ""
echo "🚀 Next steps:"
echo "  1. Restart ehr-service: docker restart medicore-ehr-service"
echo "  2. Implement backend APIs for test catalog management"
echo "  3. Build frontend components for enhanced lab ordering"

