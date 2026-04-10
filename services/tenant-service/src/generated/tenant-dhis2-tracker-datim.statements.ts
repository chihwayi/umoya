export const TENANT_DHIS2_TRACKER_DATIM_BUNDLE_VERSION = '2026.04.09.8';

export const TENANT_DHIS2_TRACKER_DATIM_STATEMENTS = (): string[] => [
  `CREATE TABLE IF NOT EXISTS datim_indicator_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mer_indicator VARCHAR(50) NOT NULL,
    disaggregate VARCHAR(50) NOT NULL,
    datim_de_uid VARCHAR(50) NOT NULL,
    datim_coc_uid VARCHAR(50) NOT NULL,
    period_type VARCHAR(10) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(mer_indicator, disaggregate)
  )`,
  `CREATE TABLE IF NOT EXISTS datim_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period VARCHAR(10) NOT NULL,
    org_unit_uid VARCHAR(50) NOT NULL,
    indicator_count INTEGER,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    datim_import_summary JSONB,
    submitted_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_datim_mappings_indicator ON datim_indicator_mappings(mer_indicator)`,
  `CREATE INDEX IF NOT EXISTS idx_datim_submissions_period ON datim_submissions(period)`,
];
