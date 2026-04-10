export const TENANT_AT_MESSAGING_BUNDLE_VERSION = '2026.04.09.9';

export const TENANT_AT_MESSAGING_STATEMENTS = (): string[] => [
  `CREATE TABLE IF NOT EXISTS at_message_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID,
    channel VARCHAR(20) NOT NULL,
    direction VARCHAR(10) NOT NULL,
    phone_number VARCHAR(30) NOT NULL,
    message_text TEXT NOT NULL,
    message_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'sent' NOT NULL,
    at_message_id VARCHAR(100),
    failure_reason TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ussd_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID,
    session_id VARCHAR(100) NOT NULL UNIQUE,
    phone_number VARCHAR(30) NOT NULL,
    service_code VARCHAR(20),
    current_menu VARCHAR(50),
    session_state JSONB DEFAULT '{}' NOT NULL,
    ended BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key VARCHAR(80) NOT NULL UNIQUE,
    channel VARCHAR(20) NOT NULL,
    language VARCHAR(10) DEFAULT 'en' NOT NULL,
    subject VARCHAR(200),
    body_template TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_at_logs_patient ON at_message_logs(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_at_logs_sent_at ON at_message_logs(sent_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_ussd_sessions_phone ON ussd_sessions(phone_number)`,
];
