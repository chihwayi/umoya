-- Migration 036: Post-Visit AI Companion Review + Rule Citation Persistence (Sprint 2)
-- Date: March 5, 2026
-- Description:
--   Adds doctor review action persistence and normalized guideline-citation mapping per recommendation rule.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS post_visit_review_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
  artifact_id UUID REFERENCES post_visit_draft_artifacts(id) ON DELETE SET NULL,
  artifact_type VARCHAR(50) NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('accept','edit','reject')),
  review_reason TEXT,
  review_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  before_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  source VARCHAR(80) NOT NULL DEFAULT 'post_visit_review',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_visit_rule_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
  artifact_type VARCHAR(50) NOT NULL DEFAULT 'recommendation_bundle',
  recommendation_id VARCHAR(120),
  rule_id VARCHAR(120) NOT NULL,
  guideline_id VARCHAR(120) NOT NULL,
  citation_label VARCHAR(255) NOT NULL,
  citation_source VARCHAR(255) NOT NULL,
  citation_url TEXT,
  evidence_excerpt TEXT,
  confidence DOUBLE PRECISION,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_visit_review_actions_session
  ON post_visit_review_actions(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_visit_review_actions_artifact
  ON post_visit_review_actions(artifact_type, action);

CREATE INDEX IF NOT EXISTS idx_post_visit_rule_citations_session
  ON post_visit_rule_citations(session_id, rule_id);
CREATE INDEX IF NOT EXISTS idx_post_visit_rule_citations_guideline
  ON post_visit_rule_citations(guideline_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_post_visit_review_actions_updated_at ON post_visit_review_actions;
CREATE TRIGGER update_post_visit_review_actions_updated_at
BEFORE UPDATE ON post_visit_review_actions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_post_visit_rule_citations_updated_at ON post_visit_rule_citations;
CREATE TRIGGER update_post_visit_rule_citations_updated_at
BEFORE UPDATE ON post_visit_rule_citations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
