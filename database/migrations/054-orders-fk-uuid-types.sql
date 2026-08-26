-- Migration 050: Fix orders foreign-key column types (text -> uuid)
-- Date: 2026-06-09
-- Scope:
--   On tenant databases whose `orders` table was created via TypeORM entity
--   synchronization, the FK columns (patient_id, doctor_id, appointment_id,
--   authorized_by, executed_by, drug_id) were created as text/varchar because
--   the entity did not declare `type: 'uuid'`. The referenced primary keys
--   (patients.id, users.id, appointments.id, drugs.id) are uuid, so any JOIN
--   fails with: operator does not exist: uuid = text — breaking the nurse
--   "authorized orders" worklist endpoint.
--
--   This widens the text FK columns to uuid. Idempotent: each column is only
--   altered if it exists and is not already uuid. NULLIF guards empty strings.

DO $$
DECLARE
  col text;
BEGIN
  IF to_regclass('public.orders') IS NULL THEN
    RAISE NOTICE 'orders table not present; skipping';
    RETURN;
  END IF;

  FOREACH col IN ARRAY ARRAY[
    'patient_id', 'appointment_id', 'doctor_id',
    'authorized_by', 'executed_by', 'drug_id'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = col AND data_type <> 'uuid'
    ) THEN
      EXECUTE format(
        'ALTER TABLE orders ALTER COLUMN %I TYPE uuid USING NULLIF(%I, '''')::uuid',
        col, col
      );
      RAISE NOTICE 'orders.% converted to uuid', col;
    END IF;
  END LOOP;
END $$;
