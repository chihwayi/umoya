-- Sprint A3: post-visit diarization review/signoff schema
ALTER TABLE IF EXISTS post_visit_transcript_segments
  ADD COLUMN IF NOT EXISTS speaker_label VARCHAR(60),
  ADD COLUMN IF NOT EXISTS speaker_role VARCHAR(20) NOT NULL DEFAULT 'unknown'
    CHECK (speaker_role IN ('doctor','patient','unknown')),
  ADD COLUMN IF NOT EXISTS diarization_confidence DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS speaker_assignment_status VARCHAR(20) NOT NULL DEFAULT 'unresolved'
    CHECK (speaker_assignment_status IN ('auto','confirmed','reassigned','unresolved')),
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_post_visit_transcript_needs_review
  ON post_visit_transcript_segments(session_id, needs_review, segment_order);

CREATE INDEX IF NOT EXISTS idx_post_visit_transcript_speaker_role
  ON post_visit_transcript_segments(session_id, speaker_role, segment_order);
