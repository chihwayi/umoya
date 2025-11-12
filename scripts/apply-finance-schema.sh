#!/bin/bash

set -e

echo "💰 Applying finance schema to tenant databases..."

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-medicore}"
DB_PASSWORD="${DB_PASSWORD:-medicore_password}"

TENANT_DBS=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%' OR datname LIKE 'clinic_%';")

if [ -z "$TENANT_DBS" ]; then
  echo "⚠️  No tenant databases found."
  exit 0
fi

for DB in $TENANT_DBS; do
  DB=$(echo "$DB" | xargs)
  [ -z "$DB" ] && continue

  echo "🔧 Updating finance schema for $DB..."

  PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d "$DB" <<'SQL'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('doctor','nurse','receptionist','admin','pharmacist','lab_tech','radiologist','accounts'));

CREATE TABLE IF NOT EXISTS financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  payer_type VARCHAR(30) DEFAULT 'self' CHECK (payer_type IN ('self','medical_aid','corporate')),
  source_module VARCHAR(50),
  source_reference_id UUID,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'USD',
  payment_status VARCHAR(30) DEFAULT 'pending' CHECK (payment_status IN ('pending','partially_paid','paid','written_off')),
  due_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financial_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES financial_transactions(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  billing_code VARCHAR(50),
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financial_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES financial_transactions(id) ON DELETE CASCADE,
  payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('cash','card','mobile_money','bank_transfer','medical_aid','write_off')),
  payment_reference VARCHAR(100),
  gateway_reference VARCHAR(150),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) DEFAULT 'completed' CHECK (status IN ('pending','completed','failed','refunded')),
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_by UUID REFERENCES users(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financial_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES financial_transactions(id) ON DELETE CASCADE,
  claim_number VARCHAR(100),
  payer_name VARCHAR(255),
  submission_date TIMESTAMP WITH TIME ZONE,
  amount_submitted NUMERIC(12,2),
  amount_approved NUMERIC(12,2),
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending','submitted','approved','rejected','paid')),
  response_code VARCHAR(50),
  response_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financial_reconciliation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES financial_transactions(id) ON DELETE SET NULL,
  payment_reference VARCHAR(150),
  payment_method VARCHAR(30),
  amount NUMERIC(12,2),
  status VARCHAR(30) DEFAULT 'unmatched' CHECK (status IN ('unmatched','matched','partial','disputed')),
  reconciliation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source_filename VARCHAR(255),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_patient ON financial_transactions(patient_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_status ON financial_transactions(payment_status);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_module ON financial_transactions(source_module);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_due_date ON financial_transactions(due_date);

CREATE INDEX IF NOT EXISTS idx_financial_line_items_transaction ON financial_line_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_financial_line_items_code ON financial_line_items(billing_code);

CREATE INDEX IF NOT EXISTS idx_financial_payments_transaction ON financial_payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_financial_payments_method ON financial_payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_financial_payments_status ON financial_payments(status);

CREATE INDEX IF NOT EXISTS idx_financial_claims_transaction ON financial_claims(transaction_id);
CREATE INDEX IF NOT EXISTS idx_financial_claims_status ON financial_claims(status);
CREATE INDEX IF NOT EXISTS idx_financial_claims_number ON financial_claims(claim_number);

CREATE INDEX IF NOT EXISTS idx_financial_reconciliation_status ON financial_reconciliation_logs(status);
CREATE INDEX IF NOT EXISTS idx_financial_reconciliation_reference ON financial_reconciliation_logs(payment_reference);

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(12,2);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS finance_transaction_id UUID;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50);
UPDATE appointments SET payment_status = 'payment_confirmed' WHERE payment_status IS NULL OR payment_status = '';

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_status_check CHECK (status IN ('awaiting_payment','scheduled','confirmed','in_progress','in-progress','completed','cancelled','no_show','no-show'));

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_payment_status_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_payment_status_check CHECK (payment_status IN ('awaiting_payment','payment_confirmed','in_progress','completed','cancelled'));

ALTER TABLE appointments ALTER COLUMN payment_status SET DEFAULT 'payment_confirmed';

CREATE INDEX IF NOT EXISTS idx_appointments_payment_status ON appointments(payment_status);

ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(12,2);
ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS finance_transaction_id UUID;
ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50);
UPDATE imaging_orders SET payment_status = 'payment_confirmed' WHERE payment_status IS NULL OR payment_status = '';

ALTER TABLE imaging_orders DROP CONSTRAINT IF EXISTS imaging_orders_order_status_check;
ALTER TABLE imaging_orders ADD CONSTRAINT imaging_orders_order_status_check CHECK (order_status IN ('awaiting_payment','ordered','scheduled','in_progress','awaiting_report','completed','cancelled'));

ALTER TABLE imaging_orders DROP CONSTRAINT IF EXISTS imaging_orders_payment_status_check;
ALTER TABLE imaging_orders ADD CONSTRAINT imaging_orders_payment_status_check CHECK (payment_status IN ('awaiting_payment','payment_confirmed','in_progress','completed','cancelled'));

ALTER TABLE imaging_orders ALTER COLUMN payment_status SET DEFAULT 'payment_confirmed';

CREATE INDEX IF NOT EXISTS idx_imaging_orders_payment_status ON imaging_orders(payment_status);

ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(12,2);
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS finance_transaction_id UUID;
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50);
UPDATE lab_orders SET payment_status = 'payment_confirmed' WHERE payment_status IS NULL OR payment_status = '';

ALTER TABLE lab_orders DROP CONSTRAINT IF EXISTS lab_orders_status_check;
ALTER TABLE lab_orders ADD CONSTRAINT lab_orders_status_check CHECK (status IN ('awaiting_payment','ordered','collected','in_progress','completed','cancelled'));

ALTER TABLE lab_orders DROP CONSTRAINT IF EXISTS lab_orders_payment_status_check;
ALTER TABLE lab_orders ADD CONSTRAINT lab_orders_payment_status_check CHECK (payment_status IN ('awaiting_payment','payment_confirmed','in_progress','completed','cancelled'));

ALTER TABLE lab_orders ALTER COLUMN payment_status SET DEFAULT 'payment_confirmed';

CREATE INDEX IF NOT EXISTS idx_lab_orders_payment_status ON lab_orders(payment_status);

ALTER TABLE oncology_infusion_sessions ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(12,2);
ALTER TABLE oncology_infusion_sessions ADD COLUMN IF NOT EXISTS finance_transaction_id UUID;
ALTER TABLE oncology_infusion_sessions ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50);
UPDATE oncology_infusion_sessions SET payment_status = 'payment_confirmed' WHERE payment_status IS NULL OR payment_status = '';
ALTER TABLE oncology_infusion_sessions DROP CONSTRAINT IF EXISTS oncology_infusion_sessions_status_check;
ALTER TABLE oncology_infusion_sessions ADD CONSTRAINT oncology_infusion_sessions_status_check CHECK (status IN ('awaiting_payment','scheduled','in_progress','completed','cancelled'));
ALTER TABLE oncology_infusion_sessions DROP CONSTRAINT IF EXISTS oncology_infusion_sessions_payment_status_check;
ALTER TABLE oncology_infusion_sessions ADD CONSTRAINT oncology_infusion_sessions_payment_status_check CHECK (payment_status IN ('awaiting_payment','payment_confirmed','in_progress','completed','cancelled'));
ALTER TABLE oncology_infusion_sessions ALTER COLUMN payment_status SET DEFAULT 'payment_confirmed';
CREATE INDEX IF NOT EXISTS idx_oncology_infusion_payment_status ON oncology_infusion_sessions(payment_status);

ALTER TABLE ophthalmology_encounters ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(12,2);
ALTER TABLE ophthalmology_encounters ADD COLUMN IF NOT EXISTS finance_transaction_id UUID;
ALTER TABLE ophthalmology_encounters ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50);
UPDATE ophthalmology_encounters SET payment_status = 'payment_confirmed' WHERE payment_status IS NULL OR payment_status = '';
ALTER TABLE ophthalmology_encounters DROP CONSTRAINT IF EXISTS ophthalmology_encounters_payment_status_check;
ALTER TABLE ophthalmology_encounters ADD CONSTRAINT ophthalmology_encounters_payment_status_check CHECK (payment_status IN ('awaiting_payment','payment_confirmed','in_progress','completed','cancelled'));
ALTER TABLE ophthalmology_encounters ALTER COLUMN payment_status SET DEFAULT 'payment_confirmed';
CREATE INDEX IF NOT EXISTS idx_ophthalmology_encounters_payment_status ON ophthalmology_encounters(payment_status);

CREATE TABLE IF NOT EXISTS cardiology_encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_date TIMESTAMP WITH TIME ZONE NOT NULL,
  encounter_type VARCHAR(50) CHECK (encounter_type IN ('clinic_visit','diagnostic_test','heart_failure_review','telecardiology','rehabilitation','other')),
  cardiologist_id UUID REFERENCES users(id),
  visit_reason TEXT,
  presenting_symptoms TEXT,
  hemodynamics JSONB DEFAULT '{}'::jsonb,
  diagnostic_tests JSONB DEFAULT '[]'::jsonb,
  care_plan TEXT,
  follow_up_plan TEXT,
  risk_score VARCHAR(20) CHECK (risk_score IN ('low','moderate','high','critical')),
  care_status VARCHAR(30) DEFAULT 'scheduled' CHECK (care_status IN ('awaiting_payment','scheduled','in_progress','completed','cancelled')),
  fee_amount NUMERIC(12,2),
  finance_transaction_id UUID,
  payment_status VARCHAR(50) DEFAULT 'payment_confirmed' CHECK (payment_status IN ('awaiting_payment','payment_confirmed','in_progress','completed','cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cardiology_encounters_patient_id ON cardiology_encounters(patient_id);
CREATE INDEX IF NOT EXISTS idx_cardiology_encounters_date ON cardiology_encounters(encounter_date);
CREATE INDEX IF NOT EXISTS idx_cardiology_encounters_payment_status ON cardiology_encounters(payment_status);
CREATE INDEX IF NOT EXISTS idx_cardiology_encounters_care_status ON cardiology_encounters(care_status);
CREATE INDEX IF NOT EXISTS idx_cardiology_encounters_risk_score ON cardiology_encounters(risk_score);

ALTER TABLE cardiology_encounters ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(12,2);
ALTER TABLE cardiology_encounters ADD COLUMN IF NOT EXISTS finance_transaction_id UUID;
ALTER TABLE cardiology_encounters ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'payment_confirmed';
ALTER TABLE cardiology_encounters ADD COLUMN IF NOT EXISTS care_status VARCHAR(30) DEFAULT 'scheduled';
ALTER TABLE cardiology_encounters DROP CONSTRAINT IF EXISTS cardiology_encounters_payment_status_check;
ALTER TABLE cardiology_encounters ADD CONSTRAINT cardiology_encounters_payment_status_check CHECK (payment_status IN ('awaiting_payment','payment_confirmed','in_progress','completed','cancelled'));
ALTER TABLE cardiology_encounters DROP CONSTRAINT IF EXISTS cardiology_encounters_care_status_check;
ALTER TABLE cardiology_encounters ADD CONSTRAINT cardiology_encounters_care_status_check CHECK (care_status IN ('awaiting_payment','scheduled','in_progress','completed','cancelled'));


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE event_object_table = 'financial_transactions' 
      AND trigger_name = 'update_financial_transactions_updated_at'
  ) THEN
    CREATE TRIGGER update_financial_transactions_updated_at BEFORE UPDATE ON financial_transactions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE event_object_table = 'financial_line_items' 
      AND trigger_name = 'update_financial_line_items_updated_at'
  ) THEN
    CREATE TRIGGER update_financial_line_items_updated_at BEFORE UPDATE ON financial_line_items
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE event_object_table = 'financial_payments' 
      AND trigger_name = 'update_financial_payments_updated_at'
  ) THEN
    CREATE TRIGGER update_financial_payments_updated_at BEFORE UPDATE ON financial_payments
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE event_object_table = 'financial_claims' 
      AND trigger_name = 'update_financial_claims_updated_at'
  ) THEN
    CREATE TRIGGER update_financial_claims_updated_at BEFORE UPDATE ON financial_claims
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE event_object_table = 'financial_reconciliation_logs' 
      AND trigger_name = 'update_financial_reconciliation_logs_updated_at'
  ) THEN
    CREATE TRIGGER update_financial_reconciliation_logs_updated_at BEFORE UPDATE ON financial_reconciliation_logs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;
SQL

  echo "✅ Finance schema applied to $DB"
done

echo "🎉 Finance schema updates complete."

