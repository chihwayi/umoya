-- A-013: post_visit_sessions.ambient_session_id was referenced by application
-- code (ambient.service.ts's session-linking UPDATE, post-visit-ingestion-cron
-- service's SELECT/WHERE, and the entity's own unit test mocks) but was never
-- actually added to the schema in any prior migration -- the column simply
-- didn't exist, so PostVisitIngestionCronService failed on every cron tick.

ALTER TABLE IF EXISTS post_visit_sessions
  ADD COLUMN IF NOT EXISTS ambient_session_id VARCHAR(100);

COMMENT ON COLUMN post_visit_sessions.ambient_session_id IS
  'Correlates this post-visit session to the ambient-listening session (AmbientService) that captured it, when audio was captured via the ambient-listening flow rather than a direct recording upload.';
