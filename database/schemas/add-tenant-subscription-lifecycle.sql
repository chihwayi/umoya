-- Add demo/paid subscription lifecycle fields for master tenant metadata
-- Run against umoya master database

ALTER TABLE IF EXISTS tenants
  ADD COLUMN IF NOT EXISTS "subscriptionMode" VARCHAR(20) NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS "packagePreset" VARCHAR(20) NOT NULL DEFAULT 'full_ehr',
  ADD COLUMN IF NOT EXISTS "subscriptionState" VARCHAR(20) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "packageName" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "enabledModules" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "billingEndsAt" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "demoExpiresAt" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "graceEndsAt" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "autoDeleteAt" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "suspensionWarningDays" INTEGER NOT NULL DEFAULT 5;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'subscription_mode'
  ) THEN
    EXECUTE 'UPDATE tenants SET "subscriptionMode" = COALESCE("subscriptionMode", subscription_mode)';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'packagePreset'
  ) THEN
    EXECUTE 'UPDATE tenants SET "packagePreset" = COALESCE("packagePreset", ''full_ehr'')';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'package_preset'
  ) THEN
    EXECUTE 'UPDATE tenants SET "packagePreset" = COALESCE("packagePreset", package_preset)';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'subscription_state'
  ) THEN
    EXECUTE 'UPDATE tenants SET "subscriptionState" = COALESCE("subscriptionState", subscription_state)';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'package_name'
  ) THEN
    EXECUTE 'UPDATE tenants SET "packageName" = COALESCE("packageName", package_name)';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'enabled_modules'
  ) THEN
    EXECUTE 'UPDATE tenants SET "enabledModules" = COALESCE("enabledModules", enabled_modules)';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'billing_ends_at'
  ) THEN
    EXECUTE 'UPDATE tenants SET "billingEndsAt" = COALESCE("billingEndsAt", billing_ends_at)';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'demo_expires_at'
  ) THEN
    EXECUTE 'UPDATE tenants SET "demoExpiresAt" = COALESCE("demoExpiresAt", demo_expires_at)';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'grace_ends_at'
  ) THEN
    EXECUTE 'UPDATE tenants SET "graceEndsAt" = COALESCE("graceEndsAt", grace_ends_at)';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'auto_delete_at'
  ) THEN
    EXECUTE 'UPDATE tenants SET "autoDeleteAt" = COALESCE("autoDeleteAt", auto_delete_at)';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'suspension_warning_days'
  ) THEN
    EXECUTE 'UPDATE tenants SET "suspensionWarningDays" = COALESCE("suspensionWarningDays", suspension_warning_days)';
  END IF;
END $$;

UPDATE tenants
SET "enabledModules" = '["finance","nurse_general"]'::jsonb
WHERE "enabledModules" IS NULL OR "enabledModules" = 'null'::jsonb OR "enabledModules" = '[]'::jsonb;

UPDATE tenants
SET "packagePreset" = 'full_ehr'
WHERE "packagePreset" IS NULL OR "packagePreset" = '';

UPDATE tenants
SET "enabledModules" = '["claims"]'::jsonb
WHERE "packagePreset" = 'claims_only';

UPDATE tenants
SET "packageName" = COALESCE(
  NULLIF("packageName", ''),
  CASE
    WHEN "subscriptionMode" = 'demo' THEN 'Guided Demo'
    ELSE 'Module Subscription'
  END
)
WHERE "packageName" IS NULL OR "packageName" = '';

ALTER TABLE IF EXISTS tenants
  DROP CONSTRAINT IF EXISTS tenants_subscription_mode_check;
ALTER TABLE IF EXISTS tenants
  ADD CONSTRAINT tenants_subscription_mode_check
  CHECK ("subscriptionMode" IN ('demo', 'paid'));

ALTER TABLE IF EXISTS tenants
  DROP CONSTRAINT IF EXISTS tenants_subscription_state_check;
ALTER TABLE IF EXISTS tenants
  ADD CONSTRAINT tenants_subscription_state_check
  CHECK ("subscriptionState" IN ('demo', 'active', 'grace', 'suspended', 'expired'));

ALTER TABLE IF EXISTS tenants
  DROP CONSTRAINT IF EXISTS tenants_package_preset_check;
ALTER TABLE IF EXISTS tenants
  ADD CONSTRAINT tenants_package_preset_check
  CHECK ("packagePreset" IN ('full_ehr', 'claims_only'));

ALTER TABLE IF EXISTS tenants
  DROP CONSTRAINT IF EXISTS tenants_suspension_warning_days_check;
ALTER TABLE IF EXISTS tenants
  ADD CONSTRAINT tenants_suspension_warning_days_check
  CHECK ("suspensionWarningDays" >= 1 AND "suspensionWarningDays" <= 30);

CREATE INDEX IF NOT EXISTS idx_tenants_subscription_mode
  ON tenants("subscriptionMode");

CREATE INDEX IF NOT EXISTS idx_tenants_subscription_state
  ON tenants("subscriptionState");

CREATE INDEX IF NOT EXISTS idx_tenants_package_preset
  ON tenants("packagePreset");

CREATE INDEX IF NOT EXISTS idx_tenants_billing_ends_at
  ON tenants("billingEndsAt");

CREATE INDEX IF NOT EXISTS idx_tenants_demo_expires_at
  ON tenants("demoExpiresAt");

CREATE INDEX IF NOT EXISTS idx_tenants_auto_delete_at
  ON tenants("autoDeleteAt");
