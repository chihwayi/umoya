#!/bin/bash

# Apply Radiology Module Schema to Existing Tenant Databases
# This script adds imaging tables for radiology & medical imaging module

set -e

echo "🏥 Applying Radiology Module Schema to Tenant Databases..."

# Database connection details
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5433}"
DB_USER="${DB_USER:-medicore}"
DB_PASSWORD="${DB_PASSWORD:-medicore_password}"

# Get list of tenant databases
echo "📋 Finding tenant databases..."
TENANT_DBS=$(docker exec -i medicore-postgres-master psql -U $DB_USER -d postgres -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%' OR datname LIKE 'clinic_%';")

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
  
  echo "🔧 Applying Radiology schema to: $DB"
  
  cat <<'EOF' | docker exec -i medicore-postgres-master psql -U medicore -d $DB
-- Radiology & Medical Imaging Module
-- Imaging Modalities
CREATE TABLE IF NOT EXISTS imaging_modalities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modality_code VARCHAR(20) UNIQUE NOT NULL CHECK (modality_code IN ('XR','CT','MRI','US','MG','FL','NM','PET')),
  modality_name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_imaging_modalities_modality_code ON imaging_modalities(modality_code);
CREATE INDEX IF NOT EXISTS idx_imaging_modalities_is_active ON imaging_modalities(is_active);

-- Imaging Study Types
CREATE TABLE IF NOT EXISTS imaging_study_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modality_id UUID NOT NULL REFERENCES imaging_modalities(id) ON DELETE CASCADE,
  study_code VARCHAR(50) UNIQUE NOT NULL,
  study_name VARCHAR(255) NOT NULL,
  body_part VARCHAR(100),
  views TEXT[],
  typical_images INTEGER DEFAULT 1,
  contrast_required BOOLEAN DEFAULT false,
  cost DECIMAL(10,2),
  description TEXT,
  preparation_instructions TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_imaging_study_types_modality_id ON imaging_study_types(modality_id);
CREATE INDEX IF NOT EXISTS idx_imaging_study_types_study_code ON imaging_study_types(study_code);
CREATE INDEX IF NOT EXISTS idx_imaging_study_types_body_part ON imaging_study_types(body_part);
CREATE INDEX IF NOT EXISTS idx_imaging_study_types_is_active ON imaging_study_types(is_active);

-- Imaging Orders
CREATE TABLE IF NOT EXISTS imaging_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  study_type_id UUID NOT NULL REFERENCES imaging_study_types(id),
  ordering_provider UUID NOT NULL REFERENCES users(id),
  clinical_indication TEXT,
  clinical_history TEXT,
  suspected_diagnosis TEXT,
  icd10_codes TEXT[],
  priority VARCHAR(20) DEFAULT 'routine' CHECK (priority IN ('routine','urgent','stat')),
  order_status VARCHAR(30) DEFAULT 'ordered' CHECK (order_status IN ('ordered','scheduled','in_progress','awaiting_report','completed','cancelled')),
  ordered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scheduled_date TIMESTAMP WITH TIME ZONE,
  performed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_imaging_orders_patient_id ON imaging_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_imaging_orders_order_number ON imaging_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_imaging_orders_study_type_id ON imaging_orders(study_type_id);
CREATE INDEX IF NOT EXISTS idx_imaging_orders_ordering_provider ON imaging_orders(ordering_provider);
CREATE INDEX IF NOT EXISTS idx_imaging_orders_order_status ON imaging_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_imaging_orders_ordered_at ON imaging_orders(ordered_at);
ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS snomed_concept_id VARCHAR(50);
ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS snomed_term TEXT;
ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS snomed_module_id VARCHAR(50);
ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS snomed_definition_status VARCHAR(50);
ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS cpt_code VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_imaging_orders_snomed_concept ON imaging_orders(snomed_concept_id);

-- Imaging Studies
CREATE TABLE IF NOT EXISTS imaging_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imaging_order_id UUID NOT NULL REFERENCES imaging_orders(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  accession_number VARCHAR(50) UNIQUE NOT NULL,
  study_type_id UUID NOT NULL REFERENCES imaging_study_types(id),
  study_date DATE NOT NULL,
  study_time TIME NOT NULL,
  technologist UUID REFERENCES users(id),
  radiologist_assigned UUID REFERENCES users(id),
  study_status VARCHAR(30) DEFAULT 'in_progress' CHECK (study_status IN ('in_progress','awaiting_report','reported','signed','amended')),
  number_of_images INTEGER DEFAULT 0,
  study_description TEXT,
  technique TEXT,
  contrast_used BOOLEAN DEFAULT false,
  contrast_type VARCHAR(100),
  contrast_volume VARCHAR(50),
  radiation_dose VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_imaging_studies_imaging_order_id ON imaging_studies(imaging_order_id);
CREATE INDEX IF NOT EXISTS idx_imaging_studies_patient_id ON imaging_studies(patient_id);
CREATE INDEX IF NOT EXISTS idx_imaging_studies_accession_number ON imaging_studies(accession_number);
CREATE INDEX IF NOT EXISTS idx_imaging_studies_study_type_id ON imaging_studies(study_type_id);
CREATE INDEX IF NOT EXISTS idx_imaging_studies_radiologist_assigned ON imaging_studies(radiologist_assigned);
CREATE INDEX IF NOT EXISTS idx_imaging_studies_study_status ON imaging_studies(study_status);
CREATE INDEX IF NOT EXISTS idx_imaging_studies_study_date ON imaging_studies(study_date);

-- Imaging Files
CREATE TABLE IF NOT EXISTS imaging_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imaging_study_id UUID NOT NULL REFERENCES imaging_studies(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT,
  file_type VARCHAR(20) NOT NULL CHECK (file_type IN ('DICOM','JPEG','PNG','PDF','TIFF')),
  file_size BIGINT,
  image_number INTEGER,
  view_position VARCHAR(50),
  is_primary BOOLEAN DEFAULT false,
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  object_key TEXT,
  content_type VARCHAR(100),
  storage_mode VARCHAR(10) DEFAULT 'db' CHECK (storage_mode IN ('db','object')),
  file_checksum VARCHAR(128)
);

CREATE INDEX IF NOT EXISTS idx_imaging_files_imaging_study_id ON imaging_files(imaging_study_id);
CREATE INDEX IF NOT EXISTS idx_imaging_files_is_primary ON imaging_files(is_primary);
CREATE INDEX IF NOT EXISTS idx_imaging_files_uploaded_at ON imaging_files(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_imaging_files_object_key ON imaging_files(object_key);
ALTER TABLE imaging_files ALTER COLUMN file_path DROP NOT NULL;

-- Imaging Reports
CREATE TABLE IF NOT EXISTS imaging_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imaging_study_id UUID NOT NULL REFERENCES imaging_studies(id) ON DELETE CASCADE,
  imaging_order_id UUID NOT NULL REFERENCES imaging_orders(id),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  report_status VARCHAR(20) DEFAULT 'draft' CHECK (report_status IN ('draft','preliminary','final','amended')),
  clinical_history TEXT,
  technique TEXT,
  findings TEXT NOT NULL,
  impression TEXT NOT NULL,
  recommendations TEXT,
  comparison_studies TEXT,
  critical_findings TEXT,
  is_critical BOOLEAN DEFAULT false,
  drafted_by UUID REFERENCES users(id),
  drafted_at TIMESTAMP WITH TIME ZONE,
  signed_by UUID REFERENCES users(id),
  signed_at TIMESTAMP WITH TIME ZONE,
  amended_by UUID REFERENCES users(id),
  amendment_reason TEXT,
  amended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_imaging_reports_imaging_study_id ON imaging_reports(imaging_study_id);
CREATE INDEX IF NOT EXISTS idx_imaging_reports_patient_id ON imaging_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_imaging_reports_report_status ON imaging_reports(report_status);
CREATE INDEX IF NOT EXISTS idx_imaging_reports_is_critical ON imaging_reports(is_critical);
CREATE INDEX IF NOT EXISTS idx_imaging_reports_drafted_by ON imaging_reports(drafted_by);
CREATE INDEX IF NOT EXISTS idx_imaging_reports_signed_by ON imaging_reports(signed_by);
ALTER TABLE imaging_reports ADD COLUMN IF NOT EXISTS structured_findings JSONB DEFAULT '{}'::jsonb;
ALTER TABLE imaging_reports ADD COLUMN IF NOT EXISTS severity VARCHAR(20);
ALTER TABLE imaging_reports ADD COLUMN IF NOT EXISTS follow_up_recommended BOOLEAN DEFAULT false;
ALTER TABLE imaging_reports ADD COLUMN IF NOT EXISTS follow_up_interval VARCHAR(100);
ALTER TABLE imaging_reports ADD COLUMN IF NOT EXISTS coded_diagnoses JSONB DEFAULT '[]'::jsonb;

-- Imaging Report Acknowledgements
CREATE TABLE IF NOT EXISTS imaging_report_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imaging_report_id UUID NOT NULL REFERENCES imaging_reports(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  acknowledgment_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(imaging_report_id, doctor_id)
);

CREATE INDEX IF NOT EXISTS idx_imaging_report_acknowledgements_report_id ON imaging_report_acknowledgements(imaging_report_id);
CREATE INDEX IF NOT EXISTS idx_imaging_report_acknowledgements_doctor_id ON imaging_report_acknowledgements(doctor_id);

-- Imaging Report Templates
CREATE TABLE IF NOT EXISTS imaging_report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modality_id UUID REFERENCES imaging_modalities(id),
  study_type_id UUID REFERENCES imaging_study_types(id),
  template_name VARCHAR(255) NOT NULL,
  template_code VARCHAR(50) UNIQUE NOT NULL,
  technique_template TEXT,
  findings_template TEXT,
  impression_template TEXT,
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_imaging_report_templates_modality_id ON imaging_report_templates(modality_id);
CREATE INDEX IF NOT EXISTS idx_imaging_report_templates_study_type_id ON imaging_report_templates(study_type_id);
CREATE INDEX IF NOT EXISTS idx_imaging_report_templates_template_code ON imaging_report_templates(template_code);
CREATE INDEX IF NOT EXISTS idx_imaging_report_templates_is_default ON imaging_report_templates(is_default);

-- Imaging Annotations
CREATE TABLE IF NOT EXISTS imaging_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imaging_file_id UUID NOT NULL REFERENCES imaging_files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  annotation_type VARCHAR(50) NOT NULL CHECK (annotation_type IN ('arrow','circle','rectangle','line','text','measurement','freehand')),
  annotation_data JSONB NOT NULL,
  annotation_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_imaging_annotations_imaging_file_id ON imaging_annotations(imaging_file_id);
CREATE INDEX IF NOT EXISTS idx_imaging_annotations_user_id ON imaging_annotations(user_id);
CREATE INDEX IF NOT EXISTS idx_imaging_annotations_annotation_type ON imaging_annotations(annotation_type);

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_imaging_modalities_updated_at ON imaging_modalities;
CREATE TRIGGER update_imaging_modalities_updated_at 
  BEFORE UPDATE ON imaging_modalities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_imaging_study_types_updated_at ON imaging_study_types;
CREATE TRIGGER update_imaging_study_types_updated_at 
  BEFORE UPDATE ON imaging_study_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_imaging_orders_updated_at ON imaging_orders;
CREATE TRIGGER update_imaging_orders_updated_at 
  BEFORE UPDATE ON imaging_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_imaging_studies_updated_at ON imaging_studies;
CREATE TRIGGER update_imaging_studies_updated_at 
  BEFORE UPDATE ON imaging_studies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_imaging_reports_updated_at ON imaging_reports;
CREATE TRIGGER update_imaging_reports_updated_at 
  BEFORE UPDATE ON imaging_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_imaging_report_acknowledgements_updated_at ON imaging_report_acknowledgements;
CREATE TRIGGER update_imaging_report_acknowledgements_updated_at 
  BEFORE UPDATE ON imaging_report_acknowledgements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_imaging_report_templates_updated_at ON imaging_report_templates;
CREATE TRIGGER update_imaging_report_templates_updated_at 
  BEFORE UPDATE ON imaging_report_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

\echo '✅ Radiology schema applied successfully!'
EOF

  if [ $? -eq 0 ]; then
    echo "✅ Schema applied successfully to $DB"
    
    # Now seed the imaging catalog
    echo "📊 Seeding imaging catalog for $DB..."
    cat scripts/seed-imaging-catalog.sql | docker exec -i medicore-postgres-master psql -U medicore -d $DB
    
    if [ $? -eq 0 ]; then
      echo "✅ Imaging catalog seeded successfully for $DB"
    else
      echo "⚠️  Warning: Failed to seed imaging catalog for $DB"
    fi
  else
    echo "❌ Failed to apply schema to $DB"
  fi
  
  echo ""
done

echo "🎉 Radiology module schema application complete!"
echo ""
echo "📋 Summary:"
echo "  - Added 8 radiology tables"
echo "  - Seeded 8 imaging modalities"
echo "  - Seeded 12+ common imaging study types"
echo "  - Created 4 report templates"
echo ""
echo "🚀 Next steps:"
echo "  1. Restart ehr-service: docker restart medicore-ehr-service"
echo "  2. Implement backend APIs for radiology module"
echo "  3. Build frontend components for imaging workflow"

