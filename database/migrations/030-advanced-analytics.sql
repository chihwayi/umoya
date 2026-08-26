-- Migration 026: Advanced Analytics & Business Intelligence
-- Date: December 4, 2025

CREATE TABLE IF NOT EXISTS analytics_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_name VARCHAR(255) NOT NULL,
  report_type VARCHAR(100) CHECK (report_type IN ('operational', 'financial', 'clinical', 'quality')),
  report_query TEXT NOT NULL,
  parameters JSONB DEFAULT '{}'::jsonb,
  schedule VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS executive_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE DEFAULT CURRENT_DATE,
  total_admissions INTEGER DEFAULT 0,
  total_discharges INTEGER DEFAULT 0,
  average_los DECIMAL(5, 2),
  bed_occupancy_rate DECIMAL(5, 2),
  total_surgeries INTEGER DEFAULT 0,
  total_ed_visits INTEGER DEFAULT 0,
  total_revenue DECIMAL(12, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_exec_metrics_date ON executive_metrics(metric_date);




