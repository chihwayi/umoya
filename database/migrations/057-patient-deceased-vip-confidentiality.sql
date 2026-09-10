-- Migration 057: Patient deceased status, VIP flag, confidentiality tier
-- Date: 2026-09-06
-- Scope (A-005/MOAS-08):
--   The Patient entity had no way to represent deceased status, VIP status,
--   or confidentiality tiering (used for HIV/mental-health/minor record
--   protection) — Programme FLOW-030 (deceased patient handling) and §13/§51
--   (VIP/confidentiality) were structurally not implementable. Adds the
--   columns only; business rules (comms suppression on deceased, tier-aware
--   read gating) are enforced in application code, not the schema. Idempotent.
--   Deliberately does NOT add a blanket record lock on deceased patients —
--   that needs a clinical-governance decision on how amendments/corrections
--   to a deceased patient's record should still work, which is out of scope
--   for this migration.

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS deceased_at TIMESTAMPTZ NULL;

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS vip_flag BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS confidentiality_tier VARCHAR(20) NOT NULL DEFAULT 'standard';

ALTER TABLE patients
  DROP CONSTRAINT IF EXISTS patients_confidentiality_tier_check;

ALTER TABLE patients
  ADD CONSTRAINT patients_confidentiality_tier_check
  CHECK (confidentiality_tier IN ('standard', 'restricted', 'confidential'));

CREATE INDEX IF NOT EXISTS idx_patients_deceased_at ON patients (deceased_at) WHERE deceased_at IS NOT NULL;
