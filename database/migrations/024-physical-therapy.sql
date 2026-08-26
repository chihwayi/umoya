-- Migration 020: Physical Therapy
-- Date: December 4, 2025

CREATE TABLE IF NOT EXISTS therapy_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  admission_id UUID REFERENCES admissions(id),
  therapy_type VARCHAR(50) CHECK (therapy_type IN ('PT', 'OT', 'speech')),
  frequency VARCHAR(100),
  ordered_by UUID NOT NULL REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_therapy_orders_patient ON therapy_orders(patient_id);




