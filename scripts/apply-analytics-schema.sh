#!/bin/bash

# Script to apply analytics schema to all existing tenant databases
# This script should be run after the database-provisioning.service.ts has been updated

DB_USERNAME="${DB_USERNAME:-medicore}"
DB_PASSWORD="${DB_PASSWORD:-medicore}"
CONTAINER_NAME="medicore-postgres-master"

# Get list of tenant databases
echo "📋 Fetching list of tenant databases..."
databases=$(docker exec $CONTAINER_NAME psql -U $DB_USERNAME -d postgres -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'clinic_%' OR datname LIKE 'tenant_%' AND datname != 'tenant_master';")

if [ -z "$databases" ]; then
  echo "❌ No tenant databases found."
  exit 1
fi

# Apply schema to each tenant database
for database in $databases; do
  database=$(echo $database | tr -d '[:space:]')
  echo ""
  echo "=========================================="
  echo "Applying analytics schema to: $database"
  echo "=========================================="
  
  docker exec -i $CONTAINER_NAME psql -U $DB_USERNAME -d "$database" <<'EOF'
-- ===========================================
-- Sprint 10: Advanced Analytics & Reporting
-- ===========================================

-- Report Templates Table
CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('financial', 'clinical', 'operational', 'custom')),
  category VARCHAR(100),
  config JSONB DEFAULT '{}'::jsonb,
  query_config JSONB DEFAULT '{}'::jsonb,
  visualization_config JSONB DEFAULT '{}'::jsonb,
  is_public BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  shared_with_roles TEXT[] DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  last_used TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scheduled Reports Table
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES report_templates(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  schedule_type VARCHAR(50) NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom')),
  schedule_config JSONB DEFAULT '{}'::jsonb,
  recipients TEXT[] DEFAULT '{}',
  recipient_roles TEXT[] DEFAULT '{}',
  format VARCHAR(20) NOT NULL DEFAULT 'pdf' CHECK (format IN ('pdf', 'excel', 'csv', 'json')),
  filters JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  last_run TIMESTAMP WITH TIME ZONE,
  next_run TIMESTAMP WITH TIME ZONE,
  run_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Report Executions Table
CREATE TABLE IF NOT EXISTS report_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_template_id UUID REFERENCES report_templates(id) ON DELETE SET NULL,
  scheduled_report_id UUID REFERENCES scheduled_reports(id) ON DELETE SET NULL,
  execution_type VARCHAR(20) NOT NULL CHECK (execution_type IN ('manual', 'scheduled', 'api')),
  executed_by UUID REFERENCES users(id),
  execution_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  duration_ms INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  filters_applied JSONB DEFAULT '{}'::jsonb,
  result_count INTEGER,
  file_url TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clinical Outcomes Table
CREATE TABLE IF NOT EXISTS clinical_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  outcome_type VARCHAR(50) NOT NULL CHECK (outcome_type IN ('treatment_response', 'readmission', 'complication', 'mortality', 'quality_of_life', 'other')),
  condition VARCHAR(255),
  snomed_code VARCHAR(50),
  baseline_date DATE,
  outcome_date DATE,
  outcome_value DECIMAL(10,2),
  outcome_unit VARCHAR(50),
  outcome_status VARCHAR(50) CHECK (outcome_status IN ('improved', 'stable', 'worsened', 'resolved', 'ongoing')),
  severity VARCHAR(20) CHECK (severity IN ('mild', 'moderate', 'severe', 'critical')),
  related_appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  related_prescription_id UUID REFERENCES prescriptions(id) ON DELETE SET NULL,
  related_lab_order_id UUID REFERENCES lab_orders(id) ON DELETE SET NULL,
  notes TEXT,
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics Metrics Table
CREATE TABLE IF NOT EXISTS analytics_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name VARCHAR(100) NOT NULL,
  metric_category VARCHAR(50) CHECK (metric_category IN ('financial', 'clinical', 'operational')),
  metric_date DATE NOT NULL,
  metric_value DECIMAL(15,2),
  metric_unit VARCHAR(50),
  dimensions JSONB DEFAULT '{}'::jsonb,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  calculation_method VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Report Favorites Table
CREATE TABLE IF NOT EXISTS report_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_template_id UUID NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
  custom_name VARCHAR(255),
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, report_template_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_report_templates_report_type ON report_templates(report_type);
CREATE INDEX IF NOT EXISTS idx_report_templates_category ON report_templates(category);
CREATE INDEX IF NOT EXISTS idx_report_templates_created_by ON report_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_is_active ON scheduled_reports(is_active);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON scheduled_reports(next_run);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_template_id ON scheduled_reports(template_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_executed_by ON report_executions(executed_by);
CREATE INDEX IF NOT EXISTS idx_report_executions_execution_time ON report_executions(execution_time);
CREATE INDEX IF NOT EXISTS idx_report_executions_status ON report_executions(status);
CREATE INDEX IF NOT EXISTS idx_report_executions_template_id ON report_executions(report_template_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_scheduled_id ON report_executions(scheduled_report_id);
CREATE INDEX IF NOT EXISTS idx_clinical_outcomes_patient_id ON clinical_outcomes(patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_outcomes_outcome_type ON clinical_outcomes(outcome_type);
CREATE INDEX IF NOT EXISTS idx_clinical_outcomes_outcome_date ON clinical_outcomes(outcome_date);
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_metric_name ON analytics_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_metric_date ON analytics_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_category ON analytics_metrics(metric_category);
CREATE INDEX IF NOT EXISTS idx_report_favorites_user_id ON report_favorites(user_id);

-- Create trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_report_templates_updated_at ON report_templates;
CREATE TRIGGER update_report_templates_updated_at
  BEFORE UPDATE ON report_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_scheduled_reports_updated_at ON scheduled_reports;
CREATE TRIGGER update_scheduled_reports_updated_at
  BEFORE UPDATE ON scheduled_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_report_executions_updated_at ON report_executions;
CREATE TRIGGER update_report_executions_updated_at
  BEFORE UPDATE ON report_executions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_clinical_outcomes_updated_at ON clinical_outcomes;
CREATE TRIGGER update_clinical_outcomes_updated_at
  BEFORE UPDATE ON clinical_outcomes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_analytics_metrics_updated_at ON analytics_metrics;
CREATE TRIGGER update_analytics_metrics_updated_at
  BEFORE UPDATE ON analytics_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

EOF

  if [ $? -eq 0 ]; then
    echo "✅ Successfully applied analytics schema to $database"
  else
    echo "❌ Failed to apply analytics schema to $database"
  fi
done

echo ""
echo "🎉 Analytics schema application completed!"


