-- Migration 048: Allow persisted in-progress state for nurse copilot tasks
-- Date: 2026-06-08
-- Scope:
--   Widen the nurse_copilot_task_events.status CHECK constraint to allow
--   'in_progress' (previously only 'completed'), so a nurse "Start" action can
--   be persisted server-side and survive reload. Idempotent.

ALTER TABLE nurse_copilot_task_events
  DROP CONSTRAINT IF EXISTS nurse_copilot_task_events_status_check;

ALTER TABLE nurse_copilot_task_events
  ADD CONSTRAINT nurse_copilot_task_events_status_check
  CHECK (status IN ('completed', 'in_progress'));
