-- Migration 035: Post-Visit AI Companion Core (Sprint 1)
-- Date: March 5, 2026
-- Description:
--   Adds core persistence for post-visit sessions, transcript segments,
--   extracted entities, and draft artifacts.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS post_visit_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(100),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  consultation_id UUID REFERENCES telemedicine_consultations(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'captured'
    CHECK (status IN ('captured','processing','draft_ready','doctor_reviewed','published','closed')),
  source_type VARCHAR(20) NOT NULL DEFAULT 'in_person'
    CHECK (source_type IN ('in_person','telemedicine','hybrid')),
  language VARCHAR(10) DEFAULT 'en',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  safety_level VARCHAR(20),
  risk_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_visit_transcript_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
  segment_order INTEGER NOT NULL,
  start_second DOUBLE PRECISION NOT NULL,
  end_second DOUBLE PRECISION NOT NULL,
  text TEXT NOT NULL,
  confidence DOUBLE PRECISION,
  language VARCHAR(10),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_visit_extracted_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
  entity_type VARCHAR(60) NOT NULL,
  entity_value TEXT NOT NULL,
  normalized_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence DOUBLE PRECISION,
  source_start_second DOUBLE PRECISION,
  source_end_second DOUBLE PRECISION,
  source_origin VARCHAR(30) NOT NULL DEFAULT 'transcript',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_visit_draft_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
  artifact_type VARCHAR(50) NOT NULL,
  artifact_status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (artifact_status IN ('draft','reviewed','published')),
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence DOUBLE PRECISION,
  generated_by VARCHAR(80) NOT NULL DEFAULT 'post_visit_pipeline',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, artifact_type)
);

CREATE INDEX IF NOT EXISTS idx_post_visit_sessions_patient_id ON post_visit_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_post_visit_sessions_doctor_id ON post_visit_sessions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_post_visit_sessions_status ON post_visit_sessions(status);
CREATE INDEX IF NOT EXISTS idx_post_visit_sessions_started_at ON post_visit_sessions(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_visit_transcript_segments_session
  ON post_visit_transcript_segments(session_id, segment_order);

CREATE INDEX IF NOT EXISTS idx_post_visit_extracted_entities_session
  ON post_visit_extracted_entities(session_id, entity_type);

CREATE INDEX IF NOT EXISTS idx_post_visit_draft_artifacts_session
  ON post_visit_draft_artifacts(session_id, artifact_type);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_post_visit_sessions_updated_at ON post_visit_sessions;
CREATE TRIGGER update_post_visit_sessions_updated_at
BEFORE UPDATE ON post_visit_sessions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_post_visit_transcript_segments_updated_at ON post_visit_transcript_segments;
CREATE TRIGGER update_post_visit_transcript_segments_updated_at
BEFORE UPDATE ON post_visit_transcript_segments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_post_visit_extracted_entities_updated_at ON post_visit_extracted_entities;
CREATE TRIGGER update_post_visit_extracted_entities_updated_at
BEFORE UPDATE ON post_visit_extracted_entities
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_post_visit_draft_artifacts_updated_at ON post_visit_draft_artifacts;
CREATE TRIGGER update_post_visit_draft_artifacts_updated_at
BEFORE UPDATE ON post_visit_draft_artifacts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
