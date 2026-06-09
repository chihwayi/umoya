-- Migration 051: Fix billing/prescription foreign-key column types (text -> uuid)
-- Date: 2026-06-09
-- Scope:
--   Same root cause as migration 050 (orders): these tables were created via
--   TypeORM entity synchronization, so FK columns with @ManyToOne relations to
--   uuid-PK entities (patients, users, admissions, medical_records) were created
--   as text instead of uuid. Any JOIN fails with: operator does not exist:
--   uuid = text. Identified by scanning all entity @JoinColumn names against the
--   live column types.
--
--   Affected (verified as real relations, all on empty tables):
--     charge_approval_notifications: patient_id, admission_id, created_by, read_by
--     patient_charges:               patient_id, admission_id, ordering_provider,
--                                    captured_by, reviewed_by, approved_by
--     prescriptions:                 medical_record_id
--
--   Idempotent: each column is only altered if it exists and is not already uuid.

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('charge_approval_notifications', 'patient_id'),
      ('charge_approval_notifications', 'admission_id'),
      ('charge_approval_notifications', 'created_by'),
      ('charge_approval_notifications', 'read_by'),
      ('patient_charges', 'patient_id'),
      ('patient_charges', 'admission_id'),
      ('patient_charges', 'ordering_provider'),
      ('patient_charges', 'captured_by'),
      ('patient_charges', 'reviewed_by'),
      ('patient_charges', 'approved_by'),
      ('prescriptions', 'medical_record_id')
    ) AS t(tbl, col)
  LOOP
    IF to_regclass('public.' || rec.tbl) IS NULL THEN
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = rec.tbl AND column_name = rec.col AND data_type <> 'uuid'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ALTER COLUMN %I TYPE uuid USING NULLIF(%I, '''')::uuid',
        rec.tbl, rec.col, rec.col
      );
      RAISE NOTICE '%.% converted to uuid', rec.tbl, rec.col;
    END IF;
  END LOOP;
END $$;
