#!/bin/bash

# Apply Ophthalmology Module schema updates to existing tenant databases
set -e

echo "👁️  Applying ophthalmology schema to tenant databases..."

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5433}"
DB_USER="${DB_USER:-medicore}"
DB_PASSWORD="${DB_PASSWORD:-medicore_password}"

TENANT_DBS=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -t -c "SELECT datname FROM pg_database WHERE (datname LIKE 'tenant_%' OR datname LIKE 'clinic_%');")

if [ -z "$TENANT_DBS" ]; then
  echo "⚠️  No tenant databases found."
  exit 0
fi

for DB in $TENANT_DBS; do
  DB=$(echo "$DB" | xargs)
  [ -z "$DB" ] && continue

  echo "🔧 Updating ophthalmology schema for $DB..."

  PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d "$DB" <<'SQL'
CREATE TABLE IF NOT EXISTS ophthalmology_encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_date TIMESTAMP WITH TIME ZONE NOT NULL,
  encounter_type VARCHAR(50) CHECK (encounter_type IN ('comprehensive_exam','follow_up','pre_op','post_op','emergency','other')),
  ophthalmologist_id UUID REFERENCES users(id),
  chief_complaint TEXT,
  assessment TEXT,
  plan TEXT,
  fee_amount NUMERIC(12,2),
  finance_transaction_id UUID,
  payment_status VARCHAR(50) DEFAULT 'payment_confirmed' CHECK (payment_status IN ('awaiting_payment','payment_confirmed','in_progress','completed','cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ophthalmology_encounters_patient_id ON ophthalmology_encounters(patient_id);
CREATE INDEX IF NOT EXISTS idx_ophthalmology_encounters_date ON ophthalmology_encounters(encounter_date);
CREATE INDEX IF NOT EXISTS idx_ophthalmology_encounters_payment_status ON ophthalmology_encounters(payment_status);
ALTER TABLE ophthalmology_encounters ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(12,2);
ALTER TABLE ophthalmology_encounters ADD COLUMN IF NOT EXISTS finance_transaction_id UUID;
ALTER TABLE ophthalmology_encounters ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50);
UPDATE ophthalmology_encounters SET payment_status = 'payment_confirmed' WHERE payment_status IS NULL OR payment_status = '';
ALTER TABLE ophthalmology_encounters DROP CONSTRAINT IF EXISTS ophthalmology_encounters_payment_status_check;
ALTER TABLE ophthalmology_encounters ADD CONSTRAINT ophthalmology_encounters_payment_status_check CHECK (payment_status IN ('awaiting_payment','payment_confirmed','in_progress','completed','cancelled'));
ALTER TABLE ophthalmology_encounters ALTER COLUMN payment_status SET DEFAULT 'payment_confirmed';

CREATE TABLE IF NOT EXISTS ophthalmology_visual_acuity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES ophthalmology_encounters(id) ON DELETE CASCADE,
  eye VARCHAR(10) CHECK (eye IN ('OD','OS','OU')),
  distance_unaided VARCHAR(20),
  distance_aided VARCHAR(20),
  near_unaided VARCHAR(20),
  near_aided VARCHAR(20),
  pinhole VARCHAR(20),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ophthalmology_visual_acuity_encounter_id ON ophthalmology_visual_acuity(encounter_id);

CREATE TABLE IF NOT EXISTS ophthalmology_refraction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES ophthalmology_encounters(id) ON DELETE CASCADE,
  eye VARCHAR(10) CHECK (eye IN ('OD','OS','OU')),
  sphere NUMERIC(5,2),
  cylinder NUMERIC(5,2),
  axis INTEGER,
  add_power NUMERIC(5,2),
  corrected_va VARCHAR(20),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ophthalmology_refraction_encounter_id ON ophthalmology_refraction(encounter_id);

CREATE TABLE IF NOT EXISTS ophthalmology_slit_lamp_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES ophthalmology_encounters(id) ON DELETE CASCADE,
  structure VARCHAR(100) NOT NULL,
  observation TEXT NOT NULL,
  severity VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ophthalmology_slit_lamp_encounter_id ON ophthalmology_slit_lamp_findings(encounter_id);

CREATE TABLE IF NOT EXISTS ophthalmology_oct_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES ophthalmology_encounters(id) ON DELETE CASCADE,
  imaging_order_id UUID REFERENCES imaging_orders(id),
  eye VARCHAR(10) CHECK (eye IN ('OD','OS','OU')),
  study_date TIMESTAMP WITH TIME ZONE,
  image_reference TEXT,
  interpretation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ophthalmology_oct_encounter_id ON ophthalmology_oct_studies(encounter_id);

CREATE TABLE IF NOT EXISTS ophthalmology_procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_id UUID REFERENCES ophthalmology_encounters(id) ON DELETE SET NULL,
  procedure_name VARCHAR(255) NOT NULL,
  procedure_date DATE NOT NULL,
  eye VARCHAR(10) CHECK (eye IN ('OD','OS','OU')),
  outcome TEXT,
  complications TEXT,
  surgeon_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ophthalmology_procedures_patient_id ON ophthalmology_procedures(patient_id);
CREATE INDEX IF NOT EXISTS idx_ophthalmology_procedures_date ON ophthalmology_procedures(procedure_date);

CREATE TABLE IF NOT EXISTS ophthalmology_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
  reason TEXT,
  priority VARCHAR(20) DEFAULT 'routine' CHECK (priority IN ('urgent','routine','low')),
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  related_encounter_id UUID REFERENCES ophthalmology_encounters(id) ON DELETE SET NULL,
  reminders_sent JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ophthalmology_followups_patient_id ON ophthalmology_follow_ups(patient_id);
CREATE INDEX IF NOT EXISTS idx_ophthalmology_followups_status ON ophthalmology_follow_ups(status);
CREATE INDEX IF NOT EXISTS idx_ophthalmology_followups_scheduled_date ON ophthalmology_follow_ups(scheduled_date);
SQL

  echo "✅ Ophthalmology schema applied to $DB"
done

echo "🎉 Ophthalmology schema updates complete."

