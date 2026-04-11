export const TENANT_OPENMRS_MFL_BUNDLE_VERSION = '2026.04.09.10';

export const TENANT_OPENMRS_MFL_STATEMENTS = (): string[] => [
  `CREATE TABLE IF NOT EXISTS openmrs_patient_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    openmrs_uuid VARCHAR(80) UNIQUE NOT NULL,
    openmrs_base_url VARCHAR(255) NOT NULL,
    last_synced_at TIMESTAMPTZ,
    sync_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS mfl_facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mfl_code VARCHAR(20) UNIQUE NOT NULL,
    facility_name VARCHAR(255) NOT NULL,
    county VARCHAR(100),
    sub_county VARCHAR(100),
    facility_type VARCHAR(100),
    ownership VARCHAR(100),
    latitude NUMERIC(10,6),
    longitude NUMERIC(10,6),
    phone VARCHAR(30),
    email VARCHAR(150),
    is_active BOOLEAN DEFAULT TRUE,
    last_synced_at TIMESTAMPTZ,
    raw_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS openmrs_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID,
    openmrs_uuid VARCHAR(80),
    direction VARCHAR(10) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    payload JSONB DEFAULT '{}',
    error_message TEXT,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_openmrs_links_patient ON openmrs_patient_links(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_openmrs_links_uuid ON openmrs_patient_links(openmrs_uuid)`,
  `CREATE INDEX IF NOT EXISTS idx_mfl_facilities_county ON mfl_facilities(county)`,
  `CREATE INDEX IF NOT EXISTS idx_sync_logs_patient ON openmrs_sync_logs(patient_id)`,
];
