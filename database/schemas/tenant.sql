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
    "featureFlags" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
    role VARCHAR(50) NOT NULL CHECK (role IN ('tenant_admin', 'doctor', 'nurse', 'receptionist', 'pharmacist', 'lab_technician', 'accountant')),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    "licenseNumber" VARCHAR(100),
    specialization VARCHAR(100),
    "lastLogin" TIMESTAMP WITH TIME ZONE,
    "mustChangePassword" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO8O',
    'Super',
    'Admin',
    'super_admin',
    true
);