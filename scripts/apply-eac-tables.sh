#!/bin/bash

# Script to apply EAC and ARV Change Request tables to existing tenant databases
# This script should be run after the database-provisioning.service.ts has been updated

DB_USERNAME="${DB_USERNAME:-medicore}"
DB_PASSWORD="${DB_PASSWORD:-medicore}"
CONTAINER_NAME="medicore-postgres-master"

# Get list of tenant databases
echo "Fetching list of tenant databases..."
databases=$(docker exec $CONTAINER_NAME psql -U $DB_USERNAME -d postgres -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%' AND datname != 'tenant_master';")

if [ -z "$databases" ]; then
  echo "No tenant databases found."
  exit 1
fi

# Apply schema to each tenant database
for database in $databases; do
  database=$(echo $database | tr -d '[:space:]')
  echo ""
  echo "=========================================="
  echo "Applying EAC tables to: $database"
  echo "=========================================="
  
  docker exec -i $CONTAINER_NAME psql -U $DB_USERNAME -d "$database" <<EOF
-- ===========================================
-- EAC (Enhanced Adherence Counseling) Table
-- ===========================================

CREATE TABLE IF NOT EXISTS hiv_eac_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES hiv_care_enrollments(id) ON DELETE CASCADE,
  session_number INTEGER NOT NULL,
  session_date DATE NOT NULL,
  counselor_id UUID NOT NULL REFERENCES users(id),
  counselor_name VARCHAR(255),
  
  -- Adherence Assessment
  adherence_barriers TEXT[],
  barriers_other_details TEXT,
  adherence_percentage_self_reported INTEGER CHECK (adherence_percentage_self_reported >= 0 AND adherence_percentage_self_reported <= 100),
  adherence_assessment_method VARCHAR(50),
  
  -- Interventions
  interventions_provided TEXT[],
  interventions_other_details TEXT,
  medication_simplification BOOLEAN DEFAULT false,
  adherence_tools_provided TEXT[],
  support_systems_identified TEXT[],
  
  -- Patient Feedback
  patient_feedback TEXT,
  patient_concerns TEXT,
  patient_commitment_level VARCHAR(20) CHECK (patient_commitment_level IN ('High', 'Medium', 'Low')),
  
  -- Follow-up Plan
  next_session_date DATE,
  follow_up_actions TEXT[],
  follow_up_responsible_person VARCHAR(255),
  
  -- Outcome Assessment
  session_outcome VARCHAR(50) CHECK (session_outcome IN ('Completed', 'Partial', 'Missed', 'Rescheduled')),
  outcome_notes TEXT,
  adherence_improvement_observed BOOLEAN DEFAULT false,
  
  -- EAC Program Status
  eac_program_status VARCHAR(50) CHECK (eac_program_status IN ('Active', 'Completed', 'Discontinued', 'Returned to Care')),
  eac_completion_date DATE,
  return_to_conventional_care_date DATE,
  
  session_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(enrollment_id, session_number)
);

CREATE INDEX IF NOT EXISTS idx_eac_enrollment_id ON hiv_eac_sessions(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_eac_session_date ON hiv_eac_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_eac_program_status ON hiv_eac_sessions(eac_program_status);

-- ===========================================
-- ARV Regimen Change Request Table
-- ===========================================

CREATE TABLE IF NOT EXISTS hiv_arv_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES hiv_care_enrollments(id) ON DELETE CASCADE,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  requested_by UUID NOT NULL REFERENCES users(id),
  requested_by_name VARCHAR(255),
  
  -- Current Status
  current_regimen_code VARCHAR(10),
  current_regimen_name VARCHAR(255),
  current_viral_load DECIMAL(10,2),
  current_viral_load_date DATE,
  previous_viral_load DECIMAL(10,2),
  previous_viral_load_date DATE,
  
  -- EAC Information
  eac_completed BOOLEAN DEFAULT false,
  eac_sessions_completed INTEGER DEFAULT 0,
  eac_completion_date DATE,
  
  -- Change Request Details
  requested_regimen_code VARCHAR(10) NOT NULL,
  requested_regimen_name VARCHAR(255) NOT NULL,
  change_reason_code VARCHAR(10),
  change_reason_details TEXT,
  clinical_justification TEXT,
  
  -- Approval Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by UUID REFERENCES users(id),
  approved_by_name VARCHAR(255),
  approval_date DATE,
  approval_notes TEXT,
  rejection_reason TEXT,
  
  -- Visit Linkage
  visit_id UUID REFERENCES hiv_clinical_visits(id),
  visit_recorded BOOLEAN DEFAULT false,
  visit_recorded_date DATE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arv_change_enrollment_id ON hiv_arv_change_requests(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_arv_change_status ON hiv_arv_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_arv_change_requested_by ON hiv_arv_change_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_arv_change_approved_by ON hiv_arv_change_requests(approved_by);

-- Create triggers for updated_at
CREATE TRIGGER update_hiv_eac_sessions_updated_at BEFORE UPDATE ON hiv_eac_sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hiv_arv_change_requests_updated_at BEFORE UPDATE ON hiv_arv_change_requests
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

EOF

  if [ $? -eq 0 ]; then
    echo "✓ Successfully applied EAC tables to $database"
  else
    echo "✗ Failed to apply EAC tables to $database"
  fi
done

echo ""
echo "=========================================="
echo "EAC tables application complete!"
echo "=========================================="

