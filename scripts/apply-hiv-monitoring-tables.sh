#!/bin/bash

# Script to apply HIV monitoring and tracking tables to existing tenant databases
# This adds tables for monitoring schedules, alerts, adherence tracking, regimen history, etc.

echo "🚀 Applying HIV Monitoring & Tracking Tables to Existing Databases..."

DB_USERNAME="${DB_USERNAME:-medicore}"
DB_PASSWORD="${DB_PASSWORD:-medicore_password}"
CONTAINER_NAME="${CONTAINER_NAME:-medicore-postgres-master}"

# Get list of tenant databases
echo "Fetching list of tenant databases..."
databases=$(docker exec $CONTAINER_NAME psql -U $DB_USERNAME -d postgres -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%' AND datname != 'tenant_master';")

if [ -z "$databases" ]; then
  echo "No tenant databases found."
  exit 1
fi

# Apply schema to each tenant database
for database in $databases; do
  database=$(echo $database | tr -d '[:space:]')
  echo ""
  echo "=========================================="
  echo "Applying HIV Monitoring tables to: $database"
  echo "=========================================="
  
  docker exec -i $CONTAINER_NAME psql -U $DB_USERNAME -d "$database" <<EOF
-- HIV Nurse Intake records captured by nursing staff
CREATE TABLE IF NOT EXISTS hiv_nurse_intakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  intake_date DATE,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  form JSONB NOT NULL DEFAULT '{}'::jsonb,
  vitals JSONB DEFAULT '{}'::jsonb,
  adherence_percentage INTEGER CHECK (adherence_percentage >= 0 AND adherence_percentage <= 100),
  regimen TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hiv_nurse_intakes_patient_id ON hiv_nurse_intakes(patient_id);
CREATE INDEX IF NOT EXISTS idx_hiv_nurse_intakes_appointment_id ON hiv_nurse_intakes(appointment_id);
CREATE INDEX IF NOT EXISTS idx_hiv_nurse_intakes_recorded_at ON hiv_nurse_intakes(recorded_at);

-- HIV Monitoring Schedules & Alerts
CREATE TABLE IF NOT EXISTS hiv_monitoring_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES hiv_care_enrollments(id) ON DELETE CASCADE,
  test_type VARCHAR(50) NOT NULL CHECK (test_type IN ('viral_load', 'cd4', 'creatinine', 'alt', 'other')),
  last_test_date DATE,
  last_test_result DECIMAL(10,2),
  next_scheduled_date DATE NOT NULL,
  monitoring_frequency_months INTEGER DEFAULT 3,
  is_overdue BOOLEAN DEFAULT false,
  days_overdue INTEGER DEFAULT 0,
  alert_sent BOOLEAN DEFAULT false,
  alert_sent_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(enrollment_id, test_type)
);

CREATE INDEX IF NOT EXISTS idx_monitoring_enrollment_id ON hiv_monitoring_schedules(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_test_type ON hiv_monitoring_schedules(test_type);
CREATE INDEX IF NOT EXISTS idx_monitoring_next_scheduled_date ON hiv_monitoring_schedules(next_scheduled_date);
CREATE INDEX IF NOT EXISTS idx_monitoring_is_overdue ON hiv_monitoring_schedules(is_overdue);

-- HIV Clinical Alerts
CREATE TABLE IF NOT EXISTS hiv_clinical_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES hiv_care_enrollments(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('treatment_failure', 'high_vl', 'declining_cd4', 'eac_required', 'ltfu_risk', 'overdue_test', 'adherence_concern', 'side_effects', 'regimen_change_needed', 'pregnancy_risk')),
  severity VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  related_data JSONB,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES users(id),
  resolved_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint for active alerts (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hiv_clinical_alerts_unique_active'
  ) THEN
    ALTER TABLE hiv_clinical_alerts 
    ADD CONSTRAINT hiv_clinical_alerts_unique_active 
    UNIQUE (enrollment_id, alert_type) 
    WHERE is_resolved = false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_alerts_enrollment_id ON hiv_clinical_alerts(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON hiv_clinical_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON hiv_clinical_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_is_resolved ON hiv_clinical_alerts(is_resolved);

-- HIV Adherence Tracking
CREATE TABLE IF NOT EXISTS hiv_adherence_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES hiv_care_enrollments(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES hiv_clinical_visits(id) ON DELETE SET NULL,
  tracking_date DATE NOT NULL,
  adherence_percentage INTEGER CHECK (adherence_percentage >= 0 AND adherence_percentage <= 100),
  adherence_method VARCHAR(50) CHECK (adherence_method IN ('pill_count', 'self_report', 'pharmacy_refill', 'electronic_monitoring')),
  pills_missed INTEGER DEFAULT 0,
  pills_dispensed INTEGER,
  pills_returned INTEGER,
  missed_doses_count INTEGER DEFAULT 0,
  barriers_to_adherence TEXT[],
  interventions_provided TEXT[],
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adherence_enrollment_id ON hiv_adherence_tracking(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_adherence_tracking_date ON hiv_adherence_tracking(tracking_date);
CREATE INDEX IF NOT EXISTS idx_adherence_visit_id ON hiv_adherence_tracking(visit_id);

-- HIV Regimen History
CREATE TABLE IF NOT EXISTS hiv_regimen_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES hiv_care_enrollments(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES hiv_clinical_visits(id) ON DELETE SET NULL,
  regimen_code VARCHAR(10),
  regimen_name VARCHAR(255),
  start_date DATE NOT NULL,
  end_date DATE,
  reason_for_change VARCHAR(50),
  reason_details TEXT,
  changed_by UUID REFERENCES users(id),
  viral_load_at_change DECIMAL(10,2),
  cd4_at_change INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_regimen_history_enrollment_id ON hiv_regimen_history(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_regimen_history_start_date ON hiv_regimen_history(start_date);
CREATE INDEX IF NOT EXISTS idx_regimen_history_is_active ON hiv_regimen_history(is_active);

-- HIV Side Effects Tracking
CREATE TABLE IF NOT EXISTS hiv_side_effects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES hiv_care_enrollments(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES hiv_clinical_visits(id) ON DELETE SET NULL,
  regimen_code VARCHAR(10),
  side_effect_type VARCHAR(100),
  severity VARCHAR(20) CHECK (severity IN ('mild', 'moderate', 'severe')),
  onset_date DATE,
  resolution_date DATE,
  intervention_provided TEXT,
  required_regimen_change BOOLEAN DEFAULT false,
  recorded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_side_effects_enrollment_id ON hiv_side_effects(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_side_effects_regimen_code ON hiv_side_effects(regimen_code);
CREATE INDEX IF NOT EXISTS idx_side_effects_visit_id ON hiv_side_effects(visit_id);

-- HIV Visit Templates
CREATE TABLE IF NOT EXISTS hiv_visit_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  visit_type VARCHAR(10),
  template_data JSONB NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visit_templates_visit_type ON hiv_visit_templates(visit_type);

SELECT '✅ Tables created/updated successfully for $database' as status;
EOF

  if [ $? -eq 0 ]; then
    echo "✅ Successfully applied tables to $database"
  else
    echo "❌ Failed to apply tables to $database"
  fi
done

echo ""
echo "🎉 HIV Monitoring & Tracking tables applied to all tenant databases!"
