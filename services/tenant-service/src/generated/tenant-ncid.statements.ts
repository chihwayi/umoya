export const TENANT_NCID_BUNDLE_VERSION = '2026.04.18.1';

export const TENANT_NCID_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS ncid_registrations (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id                UUID NOT NULL,
    country_code              CHAR(2) NOT NULL,
    id_type                   TEXT NOT NULL,
    id_number                 TEXT NOT NULL,
    id_number_hash            TEXT NOT NULL,
    id_number_formatted       TEXT,
    verified                  BOOLEAN NOT NULL DEFAULT false,
    verification_method       TEXT,
    verified_by               UUID,
    verified_at               TIMESTAMPTZ,
    biometric_hash            TEXT,
    biometric_captured_at     TIMESTAMPTZ,
    national_registry_synced  BOOLEAN NOT NULL DEFAULT false,
    national_registry_ref     TEXT,
    national_registry_synced_at TIMESTAMPTZ,
    national_registry_response JSONB DEFAULT '{}',
    is_primary                BOOLEAN NOT NULL DEFAULT false,
    is_active                 BOOLEAN NOT NULL DEFAULT true,
    notes                     TEXT,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ncid_hash_type UNIQUE (id_number_hash, id_type, country_code)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_ncid_patient    ON ncid_registrations (patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ncid_hash       ON ncid_registrations (id_number_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_ncid_country    ON ncid_registrations (country_code, id_type)`,

  `CREATE TABLE IF NOT EXISTS ncid_duplicate_flags (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id_a              UUID NOT NULL,
    patient_id_b              UUID NOT NULL,
    match_score               DECIMAL(4,3) NOT NULL,
    match_method              TEXT NOT NULL,
    match_fields              JSONB DEFAULT '[]',
    cdss_recommendation       TEXT,
    cdss_confidence           DECIMAL(4,3),
    cdss_reasoning            TEXT,
    resolution_status         TEXT NOT NULL DEFAULT 'pending',
    resolved_by               UUID,
    resolved_at               TIMESTAMPTZ,
    merged_into_patient_id    UUID,
    resolution_notes          TEXT,
    detected_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS uq_ncid_dup_pair ON ncid_duplicate_flags (
    LEAST(patient_id_a::text, patient_id_b::text),
    GREATEST(patient_id_a::text, patient_id_b::text)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_dup_patient_a   ON ncid_duplicate_flags (patient_id_a)`,
  `CREATE INDEX IF NOT EXISTS idx_dup_patient_b   ON ncid_duplicate_flags (patient_id_b)`,
  `CREATE INDEX IF NOT EXISTS idx_dup_status      ON ncid_duplicate_flags (resolution_status)`,
  `CREATE INDEX IF NOT EXISTS idx_dup_score       ON ncid_duplicate_flags (match_score DESC)`,

  `CREATE TABLE IF NOT EXISTS ncid_programme_linkages (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id                UUID NOT NULL,
    programme                 TEXT NOT NULL,
    programme_number          TEXT,
    enrolled_at               DATE,
    discharged_at             DATE,
    active                    BOOLEAN NOT NULL DEFAULT true,
    facility_enrolled         TEXT,
    shared_to_national        BOOLEAN NOT NULL DEFAULT false,
    notes                     TEXT,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_prog_linkage UNIQUE (patient_id, programme)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_prog_patient    ON ncid_programme_linkages (patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_prog_programme  ON ncid_programme_linkages (programme)`,
  `CREATE INDEX IF NOT EXISTS idx_prog_active     ON ncid_programme_linkages (patient_id, active)`,
];
