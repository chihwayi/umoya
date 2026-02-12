
-- Create Prescriptions Table if it doesn't exist
CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medical_record_id UUID REFERENCES medical_records(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES users(id),
    medication_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100) NOT NULL,
    frequency VARCHAR(100) NOT NULL,
    duration VARCHAR(100),
    quantity INTEGER,
    instructions TEXT,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    prescribed_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Medication Reminders Table if it doesn't exist
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

-- Indexes for medication_reminders
CREATE INDEX IF NOT EXISTS idx_medication_reminders_patient_id ON medication_reminders(patient_id);
CREATE INDEX IF NOT EXISTS idx_medication_reminders_active ON medication_reminders(is_active);
CREATE INDEX IF NOT EXISTS idx_medication_reminders_prescription ON medication_reminders(prescription_id);

-- Update trigger for medication_reminders
CREATE OR REPLACE FUNCTION update_medication_reminders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_medication_reminders_updated_at ON medication_reminders;
CREATE TRIGGER trigger_medication_reminders_updated_at
    BEFORE UPDATE ON medication_reminders
    FOR EACH ROW
    EXECUTE FUNCTION update_medication_reminders_updated_at();
