-- Sprint A4: post-visit citation quality v2 fields and publish-ack metadata
ALTER TABLE IF EXISTS post_visit_rule_citations
  ADD COLUMN IF NOT EXISTS relevance_score DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS citation_year INTEGER,
  ADD COLUMN IF NOT EXISTS is_superseded BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS superseded_by_guideline_id VARCHAR(120),
  ADD COLUMN IF NOT EXISTS doctor_acknowledged_superseded BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS superseded_acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS superseded_acknowledged_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_post_visit_rule_citations_quality
  ON post_visit_rule_citations(session_id, is_superseded, doctor_acknowledged_superseded, relevance_score DESC);
