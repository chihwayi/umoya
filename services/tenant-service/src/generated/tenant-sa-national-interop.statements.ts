export const TENANT_SA_NATIONAL_INTEROP_BUNDLE_VERSION = '2026.04.09.7';

export const TENANT_SA_NATIONAL_INTEROP_STATEMENTS = (): string[] => [
  `CREATE TABLE IF NOT EXISTS nhls_lab_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID,
    nhls_patient_id VARCHAR(50),
    nhls_lab_number VARCHAR(50) NOT NULL,
    test_loinc_code VARCHAR(20),
    test_name VARCHAR(100) NOT NULL,
    result_value TEXT,
    result_unit VARCHAR(30),
    reference_range VARCHAR(50),
    abnormal_flag VARCHAR(5),
    result_status VARCHAR(20),
    collected_at TIMESTAMPTZ,
    resulted_at TIMESTAMPTZ,
    hl7_raw TEXT,
    processed BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tier_net_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    export_date DATE NOT NULL,
    export_type VARCHAR(20) NOT NULL,
    export_status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    tier_net_uid VARCHAR(50),
    payload_xml TEXT,
    submitted_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS etr_net_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    tb_case_id UUID,
    notification_date DATE NOT NULL,
    export_status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    etr_reference VARCHAR(50),
    payload_json JSONB,
    submitted_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_nhls_results_patient ON nhls_lab_results(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_nhls_results_lab_number ON nhls_lab_results(nhls_lab_number)`,
  `CREATE INDEX IF NOT EXISTS idx_tier_net_exports_patient ON tier_net_exports(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_etr_net_notif_patient ON etr_net_notifications(patient_id)`,
];
