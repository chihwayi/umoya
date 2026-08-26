-- Migration 056: Fix anesthesia_vitals foreign-key column type (text -> uuid)
-- Date: 2026-08-26
-- Scope:
--   Same root cause as migrations 054/055: this table's anesthesia_record_id
--   column was created via TypeORM entity synchronization from a @Column
--   missing `type: 'uuid'`, so it rendered as text despite having a
--   @ManyToOne/@JoinColumn relation to anesthesia_records.id (uuid PK). Any
--   JOIN fails with: operator does not exist: uuid = text. Found by the new
--   static audit (scripts/audit-tenant-fk-drift.mjs), which cross-references
--   every @JoinColumn's own @Column type against its relation target's PK
--   type across all tenant entities.
--
--   Affected (verified as a real relation, tenants created in the older
--   sync-enabled era only — new tenants provision this column as uuid via
--   the database-provisioning-service bundles):
--     anesthesia_vitals: anesthesia_record_id
--
--   Idempotent: only alters the column if it exists and is not already uuid.

DO $$
BEGIN
  IF to_regclass('public.anesthesia_vitals') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'anesthesia_vitals'
      AND column_name = 'anesthesia_record_id'
      AND data_type <> 'uuid'
  ) THEN
    ALTER TABLE anesthesia_vitals
      ALTER COLUMN anesthesia_record_id TYPE uuid
      USING NULLIF(anesthesia_record_id, '')::uuid;
    RAISE NOTICE 'anesthesia_vitals.anesthesia_record_id converted to uuid';
  END IF;
END $$;
