-- Sprint A2: escalation confidence scoring v2 metadata columns
ALTER TABLE IF EXISTS post_visit_escalation_events
  ADD COLUMN IF NOT EXISTS classification_confidence DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS classification_temporality VARCHAR(20)
    CHECK (classification_temporality IN ('current','historical','unclear')),
  ADD COLUMN IF NOT EXISTS classification_source VARCHAR(30),
  ADD COLUMN IF NOT EXISTS classification_reason TEXT,
  ADD COLUMN IF NOT EXISTS classification_stage VARCHAR(20) NOT NULL DEFAULT 'v1';

CREATE INDEX IF NOT EXISTS idx_post_visit_escalation_confidence
  ON post_visit_escalation_events(classification_confidence DESC);

CREATE INDEX IF NOT EXISTS idx_post_visit_escalation_temporality
  ON post_visit_escalation_events(classification_temporality, status, detected_at DESC);
