-- Migration 025: Quality Reporting & Core Measures
-- Date: December 4, 2025

CREATE TABLE IF NOT EXISTS quality_measures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  measure_code VARCHAR(50) NOT NULL,
  measure_name VARCHAR(255) NOT NULL,
  measure_type VARCHAR(50) CHECK (measure_type IN ('cms_core', 'hedis', 'jci', 'custom')),
  numerator_criteria TEXT,
  denominator_criteria TEXT,
  target_percentage DECIMAL(5, 2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quality_measure_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  measure_id UUID NOT NULL REFERENCES quality_measures(id),
  reporting_period_start DATE NOT NULL,
  reporting_period_end DATE NOT NULL,
  numerator_count INTEGER DEFAULT 0,
  denominator_count INTEGER DEFAULT 0,
  compliance_percentage DECIMAL(5, 2) GENERATED ALWAYS AS ((numerator_count::decimal / NULLIF(denominator_count, 0)) * 100) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_quality_results_measure ON quality_measure_results(measure_id);
CREATE INDEX idx_quality_results_period ON quality_measure_results(reporting_period_start, reporting_period_end);




