-- Add per-tenant DHIS2 scheduler and alert controls
-- Run against umoya master database

ALTER TABLE IF EXISTS tenant_dhis2_config
  ADD COLUMN IF NOT EXISTS scheduled_sync_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS tenant_dhis2_config
  ADD COLUMN IF NOT EXISTS scheduled_retry_limit INTEGER NOT NULL DEFAULT 20;

ALTER TABLE IF EXISTS tenant_dhis2_config
  ADD COLUMN IF NOT EXISTS alert_lookback_hours INTEGER NOT NULL DEFAULT 24;

ALTER TABLE IF EXISTS tenant_dhis2_config
  ADD COLUMN IF NOT EXISTS alert_error_threshold INTEGER NOT NULL DEFAULT 10;

ALTER TABLE IF EXISTS tenant_dhis2_config
  ADD COLUMN IF NOT EXISTS alert_webhook_url TEXT;

ALTER TABLE IF EXISTS tenant_dhis2_config
  DROP CONSTRAINT IF EXISTS tenant_dhis2_config_scheduled_retry_limit_check;
ALTER TABLE IF EXISTS tenant_dhis2_config
  ADD CONSTRAINT tenant_dhis2_config_scheduled_retry_limit_check
  CHECK (scheduled_retry_limit >= 1 AND scheduled_retry_limit <= 200);

ALTER TABLE IF EXISTS tenant_dhis2_config
  DROP CONSTRAINT IF EXISTS tenant_dhis2_config_alert_lookback_hours_check;
ALTER TABLE IF EXISTS tenant_dhis2_config
  ADD CONSTRAINT tenant_dhis2_config_alert_lookback_hours_check
  CHECK (alert_lookback_hours >= 1 AND alert_lookback_hours <= 720);

ALTER TABLE IF EXISTS tenant_dhis2_config
  DROP CONSTRAINT IF EXISTS tenant_dhis2_config_alert_error_threshold_check;
ALTER TABLE IF EXISTS tenant_dhis2_config
  ADD CONSTRAINT tenant_dhis2_config_alert_error_threshold_check
  CHECK (alert_error_threshold >= 1 AND alert_error_threshold <= 10000);

CREATE INDEX IF NOT EXISTS idx_tenant_dhis2_config_scheduled_sync_enabled
  ON tenant_dhis2_config(scheduled_sync_enabled);
