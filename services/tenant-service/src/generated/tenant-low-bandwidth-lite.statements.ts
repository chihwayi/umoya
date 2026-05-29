export const TENANT_LOW_BANDWIDTH_BUNDLE_VERSION = '2026.04.17.1';

export const TENANT_LOW_BANDWIDTH_STATEMENTS: string[] = [

  // ── Offline Sync Queue ─────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS offline_sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL,             -- browser fingerprint or device UUID
    user_id UUID NOT NULL,
    -- Queued operation
    operation_type TEXT NOT NULL,        -- 'create_vitals' | 'create_encounter' | 'create_prescription' | 'update_patient'
    entity_type TEXT NOT NULL,
    local_entity_id TEXT NOT NULL,       -- client-generated UUID before server assignment
    payload JSONB NOT NULL,
    -- Sync status
    sync_status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'synced' | 'conflict' | 'failed'
    server_entity_id UUID,               -- assigned after successful sync
    conflict_details JSONB DEFAULT '{}',
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    -- Timing
    created_offline_at TIMESTAMP NOT NULL,  -- when created on device (may differ from created_at)
    synced_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_offline_queue_device ON offline_sync_queue(device_id)`,
  `CREATE INDEX IF NOT EXISTS idx_offline_queue_user ON offline_sync_queue(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_offline_queue_status ON offline_sync_queue(sync_status)`,

  // ── USSD Data Entry Sessions ────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS ussd_clinical_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Note: basic ussd_sessions table exists from S135. This adds structured clinical data entry.
    session_id TEXT NOT NULL,            -- Africa's Talking session ID
    phone_number TEXT NOT NULL,
    chw_user_id UUID,                    -- if CHW is registered
    entry_type TEXT NOT NULL,            -- 'patient_lookup' | 'vitals_entry' | 'symptom_checklist' | 'referral' | 'drug_dispense'
    patient_id UUID,
    patient_identifier TEXT,             -- NID or Umoya patient number
    -- Entered data (structured from USSD menus)
    data_entered JSONB NOT NULL DEFAULT '{}',
    -- Processing
    processed BOOLEAN NOT NULL DEFAULT false,
    processed_at TIMESTAMP,
    processing_result JSONB DEFAULT '{}',
    error_message TEXT,
    -- Session flow
    menu_state TEXT,                     -- current USSD menu state
    session_complete BOOLEAN NOT NULL DEFAULT false,
    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_ussd_clinical_phone ON ussd_clinical_entries(phone_number)`,
  `CREATE INDEX IF NOT EXISTS idx_ussd_clinical_patient ON ussd_clinical_entries(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ussd_clinical_type ON ussd_clinical_entries(entry_type)`,

];
