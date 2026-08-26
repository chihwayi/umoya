-- Migration 047: Persist CDSS insights + structured clinical observations on vitals
-- Date: 2026-06-07
-- Scope:
--   1) Store the full CDSS copilot insight payload computed at save time so the
--      interpretation can be re-displayed per vital record after the pane closes.
--   2) Store structured SNOMED clinical observations captured with the vitals so
--      they can be fed into the CDSS risk engine and surfaced per record.
--   Change is additive and idempotent (no destructive operations).

ALTER TABLE vitals
  ADD COLUMN IF NOT EXISTS cdss_insights JSONB,
  ADD COLUMN IF NOT EXISTS clinical_observations JSONB;
