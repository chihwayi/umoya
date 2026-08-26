-- Migration 019: Respiratory Therapy
-- Date: December 4, 2025

CREATE TABLE IF NOT EXISTS respiratory_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  admission_id UUID REFERENCES admissions(id),
  order_type VARCHAR(100) NOT NULL CHECK (order_type IN ('oxygen', 'nebulizer', 'ventilator', 'cpap', 'bipap', 'chest_pt')),
  oxygen_flow_rate VARCHAR(50),
  fio2 DECIMAL(3, 2),
  ordered_by UUID NOT NULL REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_resp_orders_patient ON respiratory_orders(patient_id);




