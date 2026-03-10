-- Master Database Schema for Tenant Management
-- This schema manages all tenants and their metadata

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenants table
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "clinicName" VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    "databaseName" VARCHAR(100) NOT NULL,
    "connectionString" TEXT,
    "subscriptionTier" VARCHAR(50) DEFAULT 'basic' CHECK ("subscriptionTier" IN ('basic', 'professional', 'enterprise')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'cancelled')),
    "contactEmail" VARCHAR(255) NOT NULL,
    "contactPhone" VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Zimbabwe',
    "logoUrl" VARCHAR(500),
    "featureFlags" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Per-tenant DHIS2 integration settings (tenant -> DHIS2 auth + org mapping)
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

-- Tenant users table (for master database user management)
CREATE TABLE tenant_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "tenantId" UUID REFERENCES tenants(id) ON DELETE CASCADE,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role VARCHAR(50) NOT NULL CHECK (role IN ('tenant_admin', 'doctor', 'nurse', 'nurse_accounts', 'receptionist', 'pharmacist', 'lab_technician', 'accounts', 'radiologist')),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    "licenseNumber" VARCHAR(100),
    specialization VARCHAR(100),
    "lastLogin" TIMESTAMP WITH TIME ZONE,
    "mustChangePassword" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CDSS Admin: System Settings (global)
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CDSS Admin: Audit Logs
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TABLE IF NOT EXISTS cdss_admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CDSS Admin: Encryption key registry (for auditable key rotation metadata)
CREATE TABLE IF NOT EXISTS cdss_encryption_keys (
    key_id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    key_fingerprint TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    rotated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CDSS Admin: Async job orchestration records
CREATE TABLE IF NOT EXISTS cdss_admin_jobs (
    job_id TEXT PRIMARY KEY,
    job_type TEXT NOT NULL,
    status TEXT NOT NULL,
    owner TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    attempt INTEGER NOT NULL DEFAULT 1,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    retry_of TEXT,
    payload JSONB,
    result JSONB,
    message TEXT,
    dead_lettered BOOLEAN NOT NULL DEFAULT FALSE,
    dead_letter_reason TEXT,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    finished_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cdss_admin_jobs_started_at ON cdss_admin_jobs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cdss_admin_jobs_status ON cdss_admin_jobs(status);
CREATE INDEX IF NOT EXISTS idx_cdss_admin_jobs_type ON cdss_admin_jobs(job_type);

-- CDSS Admin: Model registry for versioned AI governance
CREATE TABLE IF NOT EXISTS cdss_model_registry (
    model_id TEXT PRIMARY KEY,
    model_type TEXT NOT NULL,
    provider TEXT NOT NULL,
    version TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cdss_model_registry_status ON cdss_model_registry(status);

-- Tenant analytics table
CREATE TABLE tenant_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "tenantId" UUID REFERENCES tenants(id) ON DELETE CASCADE,
    "totalUsers" INTEGER DEFAULT 0,
    "totalPatients" INTEGER DEFAULT 0,
    "totalAppointments" INTEGER DEFAULT 0,
    "monthlyRevenue" DECIMAL(10,2) DEFAULT 0,
    "storageUsed" BIGINT DEFAULT 0,
    "lastUpdated" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Admin users table (for super admin management)
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'support')),
    "isActive" BOOLEAN DEFAULT true,
    "mustChangePassword" BOOLEAN DEFAULT false,
    "failedLoginAttempts" INTEGER DEFAULT 0,
    "lockedUntil" TIMESTAMP WITH TIME ZONE,
    "lastLogin" TIMESTAMP WITH TIME ZONE,
    "twoFactorSecret" VARCHAR(255),
    "twoFactorEnabled" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID REFERENCES admin_users(id),
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    "resourceId" VARCHAR(255),
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenant_dhis2_config_tenant_id ON tenant_dhis2_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_dhis2_config_enabled ON tenant_dhis2_config(enabled);
CREATE INDEX IF NOT EXISTS idx_tenant_dhis2_config_scheduled_sync_enabled ON tenant_dhis2_config(scheduled_sync_enabled);
CREATE INDEX idx_tenant_users_tenant_id ON tenant_users("tenantId");
CREATE INDEX idx_tenant_users_email ON tenant_users(email);
CREATE INDEX idx_tenant_analytics_tenant_id ON tenant_analytics("tenantId");
CREATE INDEX idx_admin_users_email ON admin_users(email);
CREATE INDEX idx_audit_logs_user_id ON audit_logs("userId");
CREATE INDEX idx_audit_logs_created_at ON audit_logs("createdAt");

-- Insert default super admin user (password: medicore123)
INSERT INTO admin_users (email, "passwordHash", "firstName", "lastName", role, "mustChangePassword")
VALUES (
    'admin@medicore.co.zw',
    '$2b$12$ylEv9v4PCtLxQ6DWSKzPFOvfRAaJiAdnX8JOGOYb6Cd7KCl/RPixG',
    'System',
    'Administrator',
    'super_admin',
    false
) ON CONFLICT (email) DO NOTHING;
