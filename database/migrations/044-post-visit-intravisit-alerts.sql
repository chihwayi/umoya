-- Sprint C1: Real-time intra-visit alert engine persistence
CREATE TABLE IF NOT EXISTS post_visit_intravisit_alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'confirmed', 'dismissed')),
  alert_type VARCHAR(80) NOT NULL,
  severity VARCHAR(20) NOT NULL
    CHECK (severity IN ('moderate', 'high', 'critical')),
  source VARCHAR(60) NOT NULL DEFAULT 'streamed_transcript',
  transcript_offset_seconds INTEGER,
  signal_text TEXT,
  alert_message TEXT NOT NULL,
  suggested_action TEXT,
  confidence DOUBLE PRECISION,
  trigger_terms JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolution_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS post_visit_intravisit_alert_events
  ADD COLUMN IF NOT EXISTS source VARCHAR(60) NOT NULL DEFAULT 'streamed_transcript',
  ADD COLUMN IF NOT EXISTS transcript_offset_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS signal_text TEXT,
  ADD COLUMN IF NOT EXISTS trigger_terms JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolution_note TEXT;

CREATE INDEX IF NOT EXISTS idx_post_visit_intravisit_alert_session
  ON post_visit_intravisit_alert_events(session_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_visit_intravisit_alert_status
  ON post_visit_intravisit_alert_events(status, severity, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_visit_intravisit_alert_patient
  ON post_visit_intravisit_alert_events(patient_id, detected_at DESC);
