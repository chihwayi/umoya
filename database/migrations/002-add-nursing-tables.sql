-- Add nursing-related tables for vitals, triage, and nursing notes

-- Vitals table
CREATE TABLE IF NOT EXISTS vitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    blood_pressure VARCHAR(20),
    heart_rate INTEGER,
    temperature DECIMAL(4,2),
    oxygen_saturation INTEGER,
    respiratory_rate INTEGER,
    weight DECIMAL(5,2),
    height DECIMAL(5,2),
    bmi DECIMAL(4,2),
    pain_level INTEGER CHECK (pain_level >= 0 AND pain_level <= 10),
    blood_glucose DECIMAL(5,2),
    notes TEXT,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    recorded_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Triage assessments table
CREATE TABLE IF NOT EXISTS triage_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    chief_complaint TEXT NOT NULL,
    onset TEXT,
    pain_score INTEGER CHECK (pain_score >= 0 AND pain_score <= 10),
    allergies TEXT,
    medications TEXT,
    history TEXT,
    observations TEXT,
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    severity_score INTEGER CHECK (severity_score >= 0 AND severity_score <= 10),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    recorded_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Nursing notes table
CREATE TABLE IF NOT EXISTS nursing_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    note_type VARCHAR(50) NOT NULL CHECK (note_type IN ('general', 'assessment', 'intervention', 'evaluation')),
    content TEXT NOT NULL,
    vital_signs TEXT,
    medications TEXT,
    observations TEXT,
    interventions TEXT,
    outcomes TEXT,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    recorded_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_vitals_patient_id ON vitals(patient_id);
CREATE INDEX IF NOT EXISTS idx_vitals_recorded_at ON vitals(recorded_at);
CREATE INDEX IF NOT EXISTS idx_vitals_recorded_by ON vitals(recorded_by);

CREATE INDEX IF NOT EXISTS idx_triage_patient_id ON triage_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_triage_priority ON triage_assessments(priority);
CREATE INDEX IF NOT EXISTS idx_triage_recorded_at ON triage_assessments(recorded_at);
CREATE INDEX IF NOT EXISTS idx_triage_recorded_by ON triage_assessments(recorded_by);

CREATE INDEX IF NOT EXISTS idx_nursing_notes_patient_id ON nursing_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_nursing_notes_note_type ON nursing_notes(note_type);
CREATE INDEX IF NOT EXISTS idx_nursing_notes_recorded_at ON nursing_notes(recorded_at);
CREATE INDEX IF NOT EXISTS idx_nursing_notes_recorded_by ON nursing_notes(recorded_by);

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_vitals_updated_at BEFORE UPDATE ON vitals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_triage_assessments_updated_at BEFORE UPDATE ON triage_assessments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nursing_notes_updated_at BEFORE UPDATE ON nursing_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
