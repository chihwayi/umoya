#!/bin/bash

# Script to apply nursing tables to all existing tenant databases
# This ensures all tenants have the vitals, triage, and nursing_notes tables

set -e

# Database connection details
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="medicore"
DB_PASSWORD="medicore_password"
MASTER_DB="medicore_master"

# Get list of all tenant databases
TENANT_DBS=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $MASTER_DB -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'clinic_%';" | tr -d ' ')

echo "Found tenant databases:"
echo "$TENANT_DBS"

# SQL to create nursing tables
NURSING_TABLES_SQL="
-- Create vitals table
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

-- Create triage_assessments table
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

-- Create nursing_notes table
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

-- Create indexes
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
"

# Apply to each tenant database
for tenant_db in $TENANT_DBS; do
    if [ ! -z "$tenant_db" ]; then
        echo "Applying nursing tables to: $tenant_db"
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d "$tenant_db" -c "$NURSING_TABLES_SQL"
        echo "✅ Completed: $tenant_db"
    fi
done

echo "🎉 All tenant databases updated with nursing tables!"
