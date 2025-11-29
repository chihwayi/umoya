#!/bin/bash

# Script to apply telemedicine schema (Sprint 9) to existing tenant databases
# This script should be run after the database-provisioning.service.ts has been updated

DB_USERNAME="${DB_USERNAME:-medicore}"
DB_PASSWORD="${DB_PASSWORD:-medicore}"
CONTAINER_NAME="medicore-postgres-master"

# Get list of tenant databases
echo "📋 Fetching list of tenant databases..."
databases=$(docker exec $CONTAINER_NAME psql -U $DB_USERNAME -d postgres -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'clinic_%' OR datname LIKE 'tenant_%' AND datname != 'tenant_master' AND datname != 'medicore_master';")

if [ -z "$databases" ]; then
  echo "❌ No tenant databases found."
  exit 1
fi

# Apply schema to each tenant database
for database in $databases; do
  database=$(echo $database | tr -d '[:space:]')
  echo ""
  echo "=========================================="
  echo "Applying telemedicine schema to: $database"
  echo "=========================================="
  
  docker exec -i $CONTAINER_NAME psql -U $DB_USERNAME -d "$database" <<EOF
-- ===========================================
-- Sprint 9: Telemedicine Platform Schema
-- ===========================================

-- Create trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS \$\$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
\$\$ LANGUAGE plpgsql;

-- Telemedicine Consultations Table
CREATE TABLE IF NOT EXISTS telemedicine_consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consultation_type VARCHAR(20) NOT NULL DEFAULT 'video' CHECK (consultation_type IN ('video', 'audio', 'chat', 'hybrid')),
  meeting_room_id VARCHAR(255) UNIQUE,
  meeting_url TEXT,
  meeting_password VARCHAR(100),
  scheduled_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  actual_start_time TIMESTAMP WITH TIME ZONE,
  actual_end_time TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  connection_quality VARCHAR(20) CHECK (connection_quality IN ('excellent', 'good', 'fair', 'poor')),
  doctor_connection_quality VARCHAR(20) CHECK (doctor_connection_quality IN ('excellent', 'good', 'fair', 'poor')),
  patient_joined BOOLEAN DEFAULT false,
  patient_join_time TIMESTAMP WITH TIME ZONE,
  doctor_joined BOOLEAN DEFAULT false,
  doctor_join_time TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'waiting', 'in_progress', 'completed', 'cancelled', 'no_show', 'technical_issue')),
  cancellation_reason TEXT,
  technical_issues TEXT,
  patient_consent BOOLEAN DEFAULT false,
  consent_date TIMESTAMP WITH TIME ZONE,
  recording_enabled BOOLEAN DEFAULT false,
  recording_url TEXT,
  notes TEXT,
  satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
  satisfaction_feedback TEXT,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Telemedicine Devices Table
CREATE TABLE IF NOT EXISTS telemedicine_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  device_type VARCHAR(20) NOT NULL CHECK (device_type IN ('smartphone', 'tablet', 'laptop', 'desktop')),
  device_name VARCHAR(255),
  operating_system VARCHAR(50),
  browser VARCHAR(50),
  browser_version VARCHAR(50),
  internet_connection_type VARCHAR(20) CHECK (internet_connection_type IN ('wifi', 'mobile_data', 'ethernet', 'unknown')),
  average_bandwidth INTEGER,
  last_used TIMESTAMP WITH TIME ZONE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Telemedicine Consents Table
CREATE TABLE IF NOT EXISTS telemedicine_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  consent_type VARCHAR(30) NOT NULL CHECK (consent_type IN ('general_telehealth', 'video_recording', 'data_sharing', 'research')),
  consent_status VARCHAR(20) NOT NULL DEFAULT 'granted' CHECK (consent_status IN ('granted', 'denied', 'expired', 'revoked')),
  consent_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expiry_date TIMESTAMP WITH TIME ZONE,
  revoked_date TIMESTAMP WITH TIME ZONE,
  consent_document_url TEXT,
  ip_address INET,
  user_agent TEXT,
  witnessed_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Telemedicine Technical Logs Table
CREATE TABLE IF NOT EXISTS telemedicine_technical_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID NOT NULL REFERENCES telemedicine_consultations(id) ON DELETE CASCADE,
  log_type VARCHAR(30) NOT NULL CHECK (log_type IN ('connection_issue', 'audio_issue', 'video_issue', 'bandwidth_issue', 'other')),
  severity VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  resolution TEXT,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Remote Patient Monitoring Table
CREATE TABLE IF NOT EXISTS remote_patient_monitoring (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  monitoring_type VARCHAR(30) NOT NULL CHECK (monitoring_type IN ('blood_pressure', 'blood_glucose', 'weight', 'temperature', 'heart_rate', 'oxygen_saturation', 'other')),
  device_name VARCHAR(255),
  device_model VARCHAR(255),
  reading_value DECIMAL(10,2),
  reading_unit VARCHAR(20),
  reading_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  uploaded_by UUID REFERENCES users(id),
  device_synced BOOLEAN DEFAULT false,
  notes TEXT,
  alert_triggered BOOLEAN DEFAULT false,
  alert_severity VARCHAR(20) CHECK (alert_severity IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Telemedicine Prescriptions Table
CREATE TABLE IF NOT EXISTS telemedicine_prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID NOT NULL REFERENCES telemedicine_consultations(id) ON DELETE CASCADE,
  prescription_id UUID REFERENCES prescriptions(id) ON DELETE SET NULL,
  e_signature_patient TEXT,
  e_signature_doctor TEXT,
  signed_by_patient_at TIMESTAMP WITH TIME ZONE,
  signed_by_doctor_at TIMESTAMP WITH TIME ZONE,
  signature_method VARCHAR(20) CHECK (signature_method IN ('digital_pen', 'touch', 'click_to_sign')),
  is_valid BOOLEAN DEFAULT false,
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_telemedicine_consultations_appointment_id ON telemedicine_consultations(appointment_id);
CREATE INDEX IF NOT EXISTS idx_telemedicine_consultations_patient_id ON telemedicine_consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_telemedicine_consultations_doctor_id ON telemedicine_consultations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_telemedicine_consultations_status ON telemedicine_consultations(status);
CREATE INDEX IF NOT EXISTS idx_telemedicine_consultations_scheduled_start_time ON telemedicine_consultations(scheduled_start_time);
CREATE INDEX IF NOT EXISTS idx_telemedicine_consultations_meeting_room_id ON telemedicine_consultations(meeting_room_id);
CREATE INDEX IF NOT EXISTS idx_telemedicine_devices_patient_id ON telemedicine_devices(patient_id);
CREATE INDEX IF NOT EXISTS idx_telemedicine_consents_patient_id ON telemedicine_consents(patient_id);
CREATE INDEX IF NOT EXISTS idx_telemedicine_consents_patient_status ON telemedicine_consents(patient_id, consent_status);
CREATE INDEX IF NOT EXISTS idx_telemedicine_technical_logs_consultation_id ON telemedicine_technical_logs(consultation_id);
CREATE INDEX IF NOT EXISTS idx_remote_patient_monitoring_patient_id ON remote_patient_monitoring(patient_id);
CREATE INDEX IF NOT EXISTS idx_remote_patient_monitoring_patient_date ON remote_patient_monitoring(patient_id, reading_date);
CREATE INDEX IF NOT EXISTS idx_remote_patient_monitoring_type ON remote_patient_monitoring(monitoring_type);
CREATE INDEX IF NOT EXISTS idx_telemedicine_prescriptions_consultation_id ON telemedicine_prescriptions(consultation_id);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_telemedicine_consultations_updated_at ON telemedicine_consultations;
CREATE TRIGGER update_telemedicine_consultations_updated_at
  BEFORE UPDATE ON telemedicine_consultations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_telemedicine_devices_updated_at ON telemedicine_devices;
CREATE TRIGGER update_telemedicine_devices_updated_at
  BEFORE UPDATE ON telemedicine_devices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_telemedicine_consents_updated_at ON telemedicine_consents;
CREATE TRIGGER update_telemedicine_consents_updated_at
  BEFORE UPDATE ON telemedicine_consents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_telemedicine_technical_logs_updated_at ON telemedicine_technical_logs;
CREATE TRIGGER update_telemedicine_technical_logs_updated_at
  BEFORE UPDATE ON telemedicine_technical_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_remote_patient_monitoring_updated_at ON remote_patient_monitoring;
CREATE TRIGGER update_remote_patient_monitoring_updated_at
  BEFORE UPDATE ON remote_patient_monitoring
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_telemedicine_prescriptions_updated_at ON telemedicine_prescriptions;
CREATE TRIGGER update_telemedicine_prescriptions_updated_at
  BEFORE UPDATE ON telemedicine_prescriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

EOF

  if [ $? -eq 0 ]; then
    echo "✅ Successfully applied telemedicine schema to $database"
  else
    echo "❌ Failed to apply telemedicine schema to $database"
    exit 1
  fi
done

echo ""
echo "🎉 Telemedicine schema application completed!"

