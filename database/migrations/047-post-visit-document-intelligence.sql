-- Sprint B1: Post-visit document intelligence (OCR -> structured extraction -> FHIR)
CREATE TABLE IF NOT EXISTS post_visit_document_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES post_visit_sessions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  document_type VARCHAR(40) NOT NULL
    CHECK (document_type IN ('lab_report', 'prescription', 'imaging_report', 'discharge_summary', 'other')),
  document_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120),
  file_size INTEGER,
  file_sha256 VARCHAR(128) NOT NULL,
  duplicate_of_document_id UUID REFERENCES post_visit_document_intelligence(id) ON DELETE SET NULL,
  duplicate_similarity DOUBLE PRECISION,
  extraction_status VARCHAR(20) NOT NULL DEFAULT 'processed'
    CHECK (extraction_status IN ('processed', 'failed', 'duplicate')),
  ocr_engine VARCHAR(120),
  ocr_confidence DOUBLE PRECISION,
  extracted_text TEXT,
  structured_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  fhir_resources JSONB NOT NULL DEFAULT '[]'::jsonb,
  critical_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  critical_detected BOOLEAN NOT NULL DEFAULT FALSE,
  critical_routed BOOLEAN NOT NULL DEFAULT FALSE,
  escalation_event_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS post_visit_document_intelligence
  ADD COLUMN IF NOT EXISTS duplicate_of_document_id UUID REFERENCES post_visit_document_intelligence(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS duplicate_similarity DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS extraction_status VARCHAR(20) NOT NULL DEFAULT 'processed'
    CHECK (extraction_status IN ('processed', 'failed', 'duplicate')),
  ADD COLUMN IF NOT EXISTS ocr_engine VARCHAR(120),
  ADD COLUMN IF NOT EXISTS ocr_confidence DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS extracted_text TEXT,
  ADD COLUMN IF NOT EXISTS structured_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS fhir_resources JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS critical_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS critical_detected BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS critical_routed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS escalation_event_id UUID,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_post_visit_doc_intelligence_session
  ON post_visit_document_intelligence(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_visit_doc_intelligence_hash
  ON post_visit_document_intelligence(session_id, file_sha256);

CREATE INDEX IF NOT EXISTS idx_post_visit_doc_intelligence_critical
  ON post_visit_document_intelligence(session_id, critical_detected, created_at DESC);
