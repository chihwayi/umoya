-- Adds object storage metadata columns for imaging files
ALTER TABLE imaging_files
  ADD COLUMN IF NOT EXISTS object_key TEXT;

ALTER TABLE imaging_files
  ADD COLUMN IF NOT EXISTS content_type VARCHAR(100);

ALTER TABLE imaging_files
  ADD COLUMN IF NOT EXISTS storage_mode VARCHAR(10) DEFAULT 'db' CHECK (storage_mode IN ('db','object'));

ALTER TABLE imaging_files
  ADD COLUMN IF NOT EXISTS file_checksum VARCHAR(128);

ALTER TABLE imaging_files
  ALTER COLUMN file_path DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_imaging_files_object_key ON imaging_files(object_key);

UPDATE imaging_files SET storage_mode = 'db' WHERE storage_mode IS NULL;

