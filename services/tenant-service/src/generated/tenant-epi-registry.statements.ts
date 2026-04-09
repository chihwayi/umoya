// S129 — EPI / Immunization Registry
// Provisioning bundle for EPI schedule engine, vaccination records,
// vaccine lot management, cold chain logging, AEFI reporting, and
// DHIS2 Tracker sync log.

export const TENANT_EPI_REGISTRY_BUNDLE_VERSION = '2026.04.09.1';

export const TENANT_EPI_REGISTRY_STATEMENTS: string[] = [
  // EPI schedule definitions (per-country national immunisation programme)
  `CREATE TABLE IF NOT EXISTS epi_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(3) NOT NULL,
  vaccine_name VARCHAR(100) NOT NULL,
  dose_number INTEGER NOT NULL,
  due_age_days INTEGER NOT NULL,
  window_early_days INTEGER DEFAULT 0 NOT NULL,
  window_late_days INTEGER DEFAULT 30 NOT NULL,
  antigen_code VARCHAR(50),
  route VARCHAR(20),
  site VARCHAR(50),
  notes TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
)`,

  // Per-patient vaccination records
  `CREATE TABLE IF NOT EXISTS immunization_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  epi_schedule_id UUID,
  vaccine_name VARCHAR(100) NOT NULL,
  dose_number INTEGER NOT NULL,
  lot_number VARCHAR(50),
  manufacturer VARCHAR(100),
  expiry_date DATE,
  administered_at TIMESTAMP WITH TIME ZONE NOT NULL,
  administered_by UUID,
  site VARCHAR(50),
  route VARCHAR(20),
  dose_ml NUMERIC(5,2),
  facility_id UUID,
  dhis2_event_uid VARCHAR(50),
  status VARCHAR(20) DEFAULT 'given' NOT NULL,
  contraindication_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
)`,

  // Vaccine lot inventory
  `CREATE TABLE IF NOT EXISTS vaccine_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_number VARCHAR(50) NOT NULL,
  vaccine_name VARCHAR(100) NOT NULL,
  manufacturer VARCHAR(100),
  expiry_date DATE NOT NULL,
  quantity_received INTEGER NOT NULL,
  quantity_remaining INTEGER NOT NULL,
  storage_location VARCHAR(100),
  min_temp_celsius NUMERIC(4,1) DEFAULT 2.0 NOT NULL,
  max_temp_celsius NUMERIC(4,1) DEFAULT 8.0 NOT NULL,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
)`,

  // Cold chain temperature logs
  `CREATE TABLE IF NOT EXISTS cold_chain_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vaccine_lot_id UUID,
  storage_location VARCHAR(100) NOT NULL,
  temperature_celsius NUMERIC(4,1) NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
  recorded_by UUID,
  excursion_detected BOOLEAN DEFAULT false NOT NULL,
  excursion_action TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
)`,

  // Adverse Events Following Immunization
  `CREATE TABLE IF NOT EXISTS aefi_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  immunization_record_id UUID,
  event_type VARCHAR(100) NOT NULL,
  onset_date DATE NOT NULL,
  severity VARCHAR(20) NOT NULL,
  outcome VARCHAR(50),
  description TEXT NOT NULL,
  hospitalized BOOLEAN DEFAULT false NOT NULL,
  reported_to_moh BOOLEAN DEFAULT false NOT NULL,
  moh_reference VARCHAR(50),
  reported_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
)`,

  // DHIS2 Tracker sync log for EPI entities
  `CREATE TABLE IF NOT EXISTS dhis2_tracker_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  dhis2_tei_uid VARCHAR(50),
  dhis2_enrollment_uid VARCHAR(50),
  dhis2_event_uid VARCHAR(50),
  program_uid VARCHAR(50),
  org_unit_uid VARCHAR(50),
  sync_status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
)`,

  // Indexes
  `CREATE INDEX IF NOT EXISTS idx_epi_schedules_country ON epi_schedules(country_code)`,
  `CREATE INDEX IF NOT EXISTS idx_immunization_records_patient ON immunization_records(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_immunization_records_status ON immunization_records(status)`,
  `CREATE INDEX IF NOT EXISTS idx_immunization_records_epi_schedule ON immunization_records(epi_schedule_id)`,
  `CREATE INDEX IF NOT EXISTS idx_vaccine_lots_active ON vaccine_lots(is_active)`,
  `CREATE INDEX IF NOT EXISTS idx_cold_chain_logs_lot ON cold_chain_logs(vaccine_lot_id)`,
  `CREATE INDEX IF NOT EXISTS idx_cold_chain_logs_excursion ON cold_chain_logs(excursion_detected)`,
  `CREATE INDEX IF NOT EXISTS idx_aefi_reports_patient ON aefi_reports(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_dhis2_tracker_sync_log_entity ON dhis2_tracker_sync_log(entity_type, entity_id)`,
  `CREATE INDEX IF NOT EXISTS idx_dhis2_tracker_sync_log_status ON dhis2_tracker_sync_log(sync_status)`,
];
