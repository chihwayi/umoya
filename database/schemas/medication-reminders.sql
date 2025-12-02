-- Medication Reminders Table
CREATE TABLE IF NOT EXISTS medication_reminders (
    id SERIAL PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    prescription_id UUID REFERENCES prescriptions(id) ON DELETE CASCADE,
    medication_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100),
    frequency VARCHAR(100),
    reminder_time TIME NOT NULL,
    reminder_days INTEGER[] DEFAULT '{1,2,3,4,5,6,7}', -- Days of week (1=Monday, 7=Sunday)
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    last_sent_at TIMESTAMP,
    next_reminder_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_medication_reminders_patient_id ON medication_reminders(patient_id);
CREATE INDEX IF NOT EXISTS idx_medication_reminders_active ON medication_reminders(is_active);
-- CREATE INDEX IF NOT EXISTS idx_medication_reminders_next_reminder ON medication_reminders(next_reminder_at);
CREATE INDEX IF NOT EXISTS idx_medication_reminders_prescription ON medication_reminders(prescription_id);

-- Update trigger
CREATE OR REPLACE FUNCTION update_medication_reminders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_medication_reminders_updated_at
    BEFORE UPDATE ON medication_reminders
    FOR EACH ROW
    EXECUTE FUNCTION update_medication_reminders_updated_at();