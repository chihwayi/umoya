-- Migration 049: Standardize blood glucose units to mmol/L across the diabetes subsystem
-- Date: 2026-06-09
-- Scope:
--   The system now uses mmol/L as the single source of truth for blood glucose
--   (vitals, display, alerts, CDSS, diabetes module). This migration converts
--   existing data that was stored in mg/dL to mmol/L using the standard molar
--   conversion factor 18.0182 (mg/dL ÷ 18.0182 = mmol/L).
--
-- Conversion notes:
--   * glucose_monitoring.glucose_value  — converted only for rows still tagged 'mg/dL'
--     (idempotent: re-running will not touch rows already at 'mmol/L').
--   * cgm_summary.average_glucose        — a glucose value; converted. The time_in_range_*
--     columns store PERCENTAGES (unit-agnostic) and are intentionally left unchanged; their
--     names (…_70_180 / _180 / _70 / _54) remain conventional shorthand for the standard TIR
--     band, which is the same physiological range as 3.9–10.0 mmol/L.
--   * insulin_regimens.target_glucose    — a glucose value; converted.
--   * insulin_regimens.correction_factor — insulin sensitivity factor (glucose units per unit
--     of insulin); converted. carb_ratio (grams carb per unit insulin) is NOT glucose-unit
--     dependent and is deliberately left unchanged.
--
-- WARNING: cgm_summary and insulin_regimens have no per-row unit column, so the conversions
--   below assume all existing rows are in mg/dL (the previous system-wide default). This is a
--   one-time migration — do not re-run.

BEGIN;

-- 1. Glucose readings explicitly tagged mg/dL
UPDATE glucose_monitoring
SET glucose_value = ROUND((glucose_value / 18.0182)::numeric, 1),
    glucose_unit  = 'mmol/L'
WHERE glucose_unit = 'mg/dL'
  AND glucose_value IS NOT NULL;

-- 2. CGM daily summary average glucose (no unit column — assume legacy mg/dL)
UPDATE cgm_summary
SET average_glucose = ROUND((average_glucose / 18.0182)::numeric, 1)
WHERE average_glucose IS NOT NULL;

-- 3. Insulin regimen target glucose and correction factor (ISF)
UPDATE insulin_regimens
SET target_glucose = ROUND((target_glucose / 18.0182)::numeric, 1)
WHERE target_glucose IS NOT NULL;

UPDATE insulin_regimens
SET correction_factor = ROUND((correction_factor / 18.0182)::numeric, 2)
WHERE correction_factor IS NOT NULL;

COMMIT;
