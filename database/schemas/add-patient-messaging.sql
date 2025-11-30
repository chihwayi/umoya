-- Patient Messaging System
-- Allows patients to communicate with clinic staff

CREATE TABLE IF NOT EXISTS patient_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    patient_id UUID NOT NULL,
    sender_type VARCHAR(50) NOT NULL CHECK (sender_type IN ('patient', 'staff', 'doctor', 'system')),
    sender_id UUID, -- Can be patient_id, user_id, or null for system
    recipient_type VARCHAR(50) NOT NULL CHECK (recipient_type IN ('patient', 'staff', 'doctor', 'system')),
    recipient_id UUID, -- Can be patient_id, user_id, or null for system
    subject VARCHAR(500),
    message TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'general' CHECK (message_type IN ('general', 'appointment', 'lab_results', 'prescription', 'billing', 'urgent')),
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    attachments JSONB, -- Array of attachment metadata
    parent_message_id UUID REFERENCES patient_messages(id) ON DELETE SET NULL, -- For threading/replies
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ, -- Soft delete
    CONSTRAINT fk_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- Indexes for patient_messages
CREATE INDEX IF NOT EXISTS idx_patient_messages_tenant ON patient_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patient_messages_patient ON patient_messages(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_messages_sender ON patient_messages(sender_type, sender_id);
CREATE INDEX IF NOT EXISTS idx_patient_messages_recipient ON patient_messages(recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_patient_messages_read ON patient_messages(patient_id, read);
CREATE INDEX IF NOT EXISTS idx_patient_messages_created ON patient_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_messages_type ON patient_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_patient_messages_parent ON patient_messages(parent_message_id);

-- Patient Notifications System
-- For system notifications like appointment reminders, lab results, etc.

CREATE TABLE IF NOT EXISTS patient_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    patient_id UUID NOT NULL,
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN (
        'appointment_reminder',
        'appointment_confirmed',
        'appointment_cancelled',
        'lab_results_ready',
        'prescription_ready',
        'bill_generated',
        'payment_received',
        'message_received',
        'system_alert',
        'general'
    )),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    action_url VARCHAR(500), -- URL to navigate to when clicked
    action_label VARCHAR(100), -- Label for action button
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- Optional expiration
    metadata JSONB, -- Additional data like appointment_id, bill_id, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_notification_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- Indexes for patient_notifications
CREATE INDEX IF NOT EXISTS idx_patient_notifications_tenant ON patient_notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patient_notifications_patient ON patient_notifications(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_notifications_read ON patient_notifications(patient_id, read);
CREATE INDEX IF NOT EXISTS idx_patient_notifications_type ON patient_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_patient_notifications_sent ON patient_notifications(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_notifications_expires ON patient_notifications(expires_at) WHERE expires_at IS NOT NULL;

-- Comments
COMMENT ON TABLE patient_messages IS 'Patient-clinic messaging system for secure communication';
COMMENT ON TABLE patient_notifications IS 'System notifications for patients (appointments, lab results, etc.)';
COMMENT ON COLUMN patient_messages.sender_type IS 'Type of sender: patient, staff, doctor, or system';
COMMENT ON COLUMN patient_messages.recipient_type IS 'Type of recipient: patient, staff, doctor, or system';
COMMENT ON COLUMN patient_messages.message_type IS 'Category of message for filtering';
COMMENT ON COLUMN patient_notifications.notification_type IS 'Type of notification for categorization';
COMMENT ON COLUMN patient_notifications.action_url IS 'URL to navigate when notification is clicked';
COMMENT ON COLUMN patient_notifications.metadata IS 'Additional JSON data like appointment_id, bill_id, etc.';

