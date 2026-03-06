-- Migration 038: Post-Visit AI Companion Patient Messaging + Escalations (Sprint 4)
-- Date: March 5, 2026
-- Description:
--   Adds patient companion thread/message persistence, acknowledgements,
--   and escalation detection/routing event storage with SLA timestamps.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS post_visit_companion_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','closed')),
  message_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMP WITH TIME ZONE,
  last_patient_message_at TIMESTAMP WITH TIME ZONE,
  last_clinician_message_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, patient_id)
);

CREATE TABLE IF NOT EXISTS post_visit_companion_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES post_visit_companion_threads(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  sender_type VARCHAR(20) NOT NULL
    CHECK (sender_type IN ('patient','clinician','system')),
  sender_id UUID,
  message_type VARCHAR(30) NOT NULL DEFAULT 'question'
    CHECK (message_type IN ('question','answer','summary','checklist','alert','system')),
  message_text TEXT NOT NULL,
  grounded_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  escalation_detected BOOLEAN NOT NULL DEFAULT FALSE,
  escalation_event_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_visit_escalation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES post_visit_companion_threads(id) ON DELETE SET NULL,
  message_id UUID REFERENCES post_visit_companion_messages(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','acknowledged','resolved','dismissed')),
  severity VARCHAR(20) NOT NULL
    CHECK (severity IN ('low','moderate','high','critical')),
  route_target VARCHAR(20) NOT NULL
    CHECK (route_target IN ('emergency','doctor','nurse')),
  trigger_type VARCHAR(50) NOT NULL DEFAULT 'symptom_keyword',
  trigger_terms JSONB NOT NULL DEFAULT '[]'::jsonb,
  signal_text TEXT,
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  sla_due_at TIMESTAMP WITH TIME ZONE,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolution_note TEXT,
  workflow_key VARCHAR(160),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_visit_companion_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  acknowledgement_type VARCHAR(60) NOT NULL
    CHECK (acknowledgement_type IN ('teach_back','medication_adherence','follow_up_commitment','warning_sign_understanding')),
  acknowledged BOOLEAN NOT NULL DEFAULT TRUE,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_visit_companion_threads_session
  ON post_visit_companion_threads(session_id, status);
CREATE INDEX IF NOT EXISTS idx_post_visit_companion_threads_patient
  ON post_visit_companion_threads(patient_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_visit_companion_messages_session
  ON post_visit_companion_messages(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_visit_companion_messages_thread
  ON post_visit_companion_messages(thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_post_visit_companion_messages_patient
  ON post_visit_companion_messages(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_visit_companion_messages_escalation
  ON post_visit_companion_messages(escalation_detected, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_visit_escalation_events_session
  ON post_visit_escalation_events(session_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_visit_escalation_events_status
  ON post_visit_escalation_events(status, severity, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_visit_escalation_events_route
  ON post_visit_escalation_events(route_target, status, sla_due_at);
CREATE INDEX IF NOT EXISTS idx_post_visit_escalation_events_patient
  ON post_visit_escalation_events(patient_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_visit_companion_ack_session
  ON post_visit_companion_acknowledgements(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_visit_companion_ack_patient
  ON post_visit_companion_acknowledgements(patient_id, acknowledgement_type);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_post_visit_companion_threads_updated_at ON post_visit_companion_threads;
CREATE TRIGGER update_post_visit_companion_threads_updated_at
BEFORE UPDATE ON post_visit_companion_threads
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_post_visit_companion_messages_updated_at ON post_visit_companion_messages;
CREATE TRIGGER update_post_visit_companion_messages_updated_at
BEFORE UPDATE ON post_visit_companion_messages
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_post_visit_escalation_events_updated_at ON post_visit_escalation_events;
CREATE TRIGGER update_post_visit_escalation_events_updated_at
BEFORE UPDATE ON post_visit_escalation_events
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_post_visit_companion_acknowledgements_updated_at ON post_visit_companion_acknowledgements;
CREATE TRIGGER update_post_visit_companion_acknowledgements_updated_at
BEFORE UPDATE ON post_visit_companion_acknowledgements
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
