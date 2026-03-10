-- Add master-level tenant -> DHIS2 linkage configuration
-- Run against medicore master database

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS tenant_dhis2_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    base_url TEXT NOT NULL,
    api_version VARCHAR(10) DEFAULT '40',
    auth_type VARCHAR(20) NOT NULL DEFAULT 'pat' CHECK (auth_type IN ('pat', 'basic')),
    pat TEXT,
    username VARCHAR(255),
    password TEXT,
    org_unit_id VARCHAR(64) NOT NULL,
    tracked_entity_type_id VARCHAR(64),
    dataset_id VARCHAR(64),
    enabled BOOLEAN NOT NULL DEFAULT true,
    scheduled_sync_enabled BOOLEAN NOT NULL DEFAULT false,
    scheduled_retry_limit INTEGER NOT NULL DEFAULT 20 CHECK (scheduled_retry_limit >= 1 AND scheduled_retry_limit <= 200),
    alert_lookback_hours INTEGER NOT NULL DEFAULT 24 CHECK (alert_lookback_hours >= 1 AND alert_lookback_hours <= 720),
    alert_error_threshold INTEGER NOT NULL DEFAULT 10 CHECK (alert_error_threshold >= 1 AND alert_error_threshold <= 10000),
    alert_webhook_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_dhis2_config_tenant_id ON tenant_dhis2_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_dhis2_config_enabled ON tenant_dhis2_config(enabled);
CREATE INDEX IF NOT EXISTS idx_tenant_dhis2_config_scheduled_sync_enabled ON tenant_dhis2_config(scheduled_sync_enabled);
