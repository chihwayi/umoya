export const TENANT_REPORTING_COMPLETENESS_BUNDLE_VERSION = '2026.04.16.1';

export const TENANT_REPORTING_COMPLETENESS_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS analytics_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    template_type VARCHAR(50) NOT NULL DEFAULT 'custom',
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_templates_name
    ON analytics_templates(name) WHERE is_default = true`,

  `INSERT INTO analytics_templates (name, description, template_type, config, is_default)
  VALUES
  (
    'Monthly Revenue Summary',
    'Total revenue, collections, and outstanding AR for a calendar month',
    'financial',
    '{"metrics":["total_billed","total_collected","ar_balance","collection_rate"],"groupBy":"month","defaultPeriod":"current_month"}',
    true
  )
  ON CONFLICT DO NOTHING`,

  `INSERT INTO analytics_templates (name, description, template_type, config, is_default)
  VALUES
  (
    'AR Aging Report',
    'Accounts receivable aged by 0-30, 31-60, 61-90, 91-120, 120+ days',
    'financial',
    '{"buckets":[30,60,90,120],"groupBy":"payer","showPercentage":true}',
    true
  )
  ON CONFLICT DO NOTHING`,

  `INSERT INTO analytics_templates (name, description, template_type, config, is_default)
  VALUES
  (
    'HIPAA Audit Summary',
    'PHI access events by action type and user role for the selected date range',
    'compliance',
    '{"metrics":["total_accesses","by_action","by_role","high_risk_count"],"defaultPeriod":"last_30_days"}',
    true
  )
  ON CONFLICT DO NOTHING`,

  `INSERT INTO analytics_templates (name, description, template_type, config, is_default)
  VALUES
  (
    'Appointments by Status',
    'Appointment counts grouped by status (scheduled, completed, cancelled, no-show)',
    'operational',
    '{"groupBy":"status","secondaryGroupBy":"doctor","defaultPeriod":"current_month"}',
    true
  )
  ON CONFLICT DO NOTHING`,

  `INSERT INTO analytics_templates (name, description, template_type, config, is_default)
  VALUES
  (
    'Lab Turnaround Time',
    'Average time from lab order to result, grouped by test category',
    'operational',
    '{"metric":"turnaround_hours","groupBy":"test_category","showOutliers":true,"defaultPeriod":"last_30_days"}',
    true
  )
  ON CONFLICT DO NOTHING`,
];
