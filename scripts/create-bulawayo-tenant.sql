-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Bulawayo General Tenant
INSERT INTO tenants (
    "clinicName",
    subdomain,
    "databaseName",
    "subscriptionTier",
    status,
    "contactEmail",
    "contactPhone",
    address,
    city,
    country,
    "logoUrl",
    "featureFlags"
) VALUES (
    'Bulawayo General Hospital',
    'bulawayo-general',
    'tenant_bulawayo',
    'enterprise',
    'active',
    'admin@bulawayohospital.co.zw',
    '+263 9 123 456',
    '123 Main Street',
    'Bulawayo',
    'Zimbabwe',
    'https://via.placeholder.com/150',
    '{"enableAi": true, "enableTelemedicine": true}'
)
ON CONFLICT (subdomain) 
DO UPDATE SET 
    "clinicName" = EXCLUDED."clinicName",
    status = 'active',
    "logoUrl" = EXCLUDED."logoUrl";
