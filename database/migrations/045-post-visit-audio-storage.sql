-- Sprint 58: Post-visit audio recording storage
-- Adds columns to post_visit_sessions for persisting recorded audio

ALTER TABLE IF EXISTS post_visit_sessions
  ADD COLUMN IF NOT EXISTS recording_storage_key   VARCHAR(500),
  ADD COLUMN IF NOT EXISTS recording_bucket         VARCHAR(120)  DEFAULT 'post-visit-recordings',
  ADD COLUMN IF NOT EXISTS recording_mime_type       VARCHAR(60),
  ADD COLUMN IF NOT EXISTS recording_size_bytes      BIGINT,
  ADD COLUMN IF NOT EXISTS recording_duration_ms     INTEGER,
  ADD COLUMN IF NOT EXISTS recording_sha256          VARCHAR(64),
  ADD COLUMN IF NOT EXISTS recording_uploaded_at     TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN post_visit_sessions.recording_storage_key IS
  'Object storage key (path) for the recording file, e.g. tenant/<tenantId>/post-visit/<sessionId>/recording.webm';
COMMENT ON COLUMN post_visit_sessions.recording_bucket IS
  'Object storage bucket name';
