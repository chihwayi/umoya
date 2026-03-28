-- Migration 046: MAR + Billing schema alignment for module smoke coverage
-- Date: 2026-03-12
-- Scope:
--   1) Align billing table with claims readiness fields expected by EHR service.
--   2) Keep change additive and idempotent (no destructive operations).

ALTER TABLE billing
  ADD COLUMN IF NOT EXISTS diagnosis_codes TEXT[],
  ADD COLUMN IF NOT EXISTS primary_diagnosis_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS primary_diagnosis_description TEXT;

CREATE INDEX IF NOT EXISTS idx_billing_primary_diagnosis_code
  ON billing(primary_diagnosis_code);

