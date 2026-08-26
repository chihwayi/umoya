-- Migration 024: Patient Safety Reporting
-- Date: December 4, 2025

CREATE TABLE IF NOT EXISTS safety_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_number VARCHAR(50) UNIQUE NOT NULL,
  patient_id UUID REFERENCES patients(id),
  incident_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  incident_type VARCHAR(100) CHECK (incident_type IN ('medication_error', 'fall', 'pressure_injury', 'wrong_site', 'device_malfunction', 'other')),
  severity VARCHAR(50) CHECK (severity IN ('minor', 'moderate', 'severe', 'catastrophic')),
  description TEXT NOT NULL,
  harm_occurred BOOLEAN DEFAULT false,
  reported_by UUID NOT NULL REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'reported' CHECK (status IN ('reported', 'investigating', 'resolved', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_safety_incidents_date ON safety_incidents(incident_date);
CREATE INDEX idx_safety_incidents_type ON safety_incidents(incident_type);




