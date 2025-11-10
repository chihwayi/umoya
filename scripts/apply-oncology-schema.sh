#!/bin/bash

# Apply Oncology Module schema updates to existing tenant databases
set -e

echo "🧬 Applying oncology schema to tenant databases..."

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

  echo "🔧 Updating oncology schema for $DB..."

  PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d "$DB" <<'SQL'
CREATE TABLE IF NOT EXISTS oncology_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  primary_diagnosis VARCHAR(255) NOT NULL,
  staging_system VARCHAR(50),
  overall_stage VARCHAR(20),
  stage_at_diagnosis VARCHAR(20),
  diagnosis_date DATE,
  primary_site VARCHAR(100),
  histology VARCHAR(100),
  oncologist_id UUID REFERENCES users(id),
  status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active','in_remission','completed_therapy','follow_up','deceased','transferred_out')),
  care_plan TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oncology_cases_patient_id ON oncology_cases(patient_id);
CREATE INDEX IF NOT EXISTS idx_oncology_cases_status ON oncology_cases(status);

CREATE TABLE IF NOT EXISTS oncology_staging_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oncology_case_id UUID NOT NULL REFERENCES oncology_cases(id) ON DELETE CASCADE,
  staging_system VARCHAR(50) NOT NULL,
  t_stage VARCHAR(10),
  n_stage VARCHAR(10),
  m_stage VARCHAR(10),
  overall_stage VARCHAR(20),
  stage_date DATE NOT NULL,
  performance_status VARCHAR(20),
  notes TEXT,
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oncology_staging_case_id ON oncology_staging_entries(oncology_case_id);
CREATE INDEX IF NOT EXISTS idx_oncology_staging_stage_date ON oncology_staging_entries(stage_date);

CREATE TABLE IF NOT EXISTS oncology_regimens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oncology_case_id UUID NOT NULL REFERENCES oncology_cases(id) ON DELETE CASCADE,
  regimen_name VARCHAR(255) NOT NULL,
  line_of_therapy VARCHAR(50),
  intent VARCHAR(50) CHECK (intent IN ('curative','adjuvant','neoadjuvant','palliative','maintenance','other')),
  cycles_planned INTEGER,
  start_date DATE,
  end_date DATE,
  status VARCHAR(30) DEFAULT 'planned' CHECK (status IN ('planned','active','completed','paused','cancelled')),
  regimen_details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oncology_regimens_case_id ON oncology_regimens(oncology_case_id);
CREATE INDEX IF NOT EXISTS idx_oncology_regimens_status ON oncology_regimens(status);

CREATE TABLE IF NOT EXISTS oncology_infusion_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regimen_id UUID NOT NULL REFERENCES oncology_regimens(id) ON DELETE CASCADE,
  cycle_number INTEGER,
  session_date TIMESTAMP WITH TIME ZONE NOT NULL,
  location VARCHAR(100),
  administered_by UUID REFERENCES users(id),
  vitals JSONB DEFAULT '{}'::jsonb,
  drugs_administered JSONB DEFAULT '[]'::jsonb,
  premedications JSONB DEFAULT '[]'::jsonb,
  toxicities JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oncology_infusion_regimen_id ON oncology_infusion_sessions(regimen_id);
CREATE INDEX IF NOT EXISTS idx_oncology_infusion_session_date ON oncology_infusion_sessions(session_date);

CREATE TABLE IF NOT EXISTS oncology_adverse_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oncology_case_id UUID NOT NULL REFERENCES oncology_cases(id) ON DELETE CASCADE,
  regimen_id UUID REFERENCES oncology_regimens(id) ON DELETE SET NULL,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  event_type VARCHAR(255) NOT NULL,
  grade VARCHAR(10),
  related_to VARCHAR(50),
  action_taken TEXT,
  outcome VARCHAR(100),
  resolved_date DATE,
  notes TEXT,
  reported_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oncology_adverse_events_case_id ON oncology_adverse_events(oncology_case_id);
CREATE INDEX IF NOT EXISTS idx_oncology_adverse_events_event_date ON oncology_adverse_events(event_date);

CREATE TABLE IF NOT EXISTS tumor_board_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_date TIMESTAMP WITH TIME ZONE NOT NULL,
  facilitator UUID REFERENCES users(id),
  location VARCHAR(100),
  agenda TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tumor_board_meetings_date ON tumor_board_meetings(meeting_date);

CREATE TABLE IF NOT EXISTS tumor_board_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES tumor_board_meetings(id) ON DELETE CASCADE,
  oncology_case_id UUID NOT NULL REFERENCES oncology_cases(id) ON DELETE CASCADE,
  recommendation TEXT NOT NULL,
  follow_up_actions TEXT,
  responsible_team VARCHAR(100),
  due_date DATE,
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','declined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tumor_board_recommendations_meeting_id ON tumor_board_recommendations(meeting_id);
CREATE INDEX IF NOT EXISTS idx_tumor_board_recommendations_case_id ON tumor_board_recommendations(oncology_case_id);
CREATE INDEX IF NOT EXISTS idx_tumor_board_recommendations_status ON tumor_board_recommendations(status);
SQL

  echo "✅ Oncology schema applied to $DB"
done

echo "🎉 Oncology schema updates complete."

