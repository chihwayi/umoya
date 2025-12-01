-- Create bulawayo-general tenant if it doesn't exist
-- Run this script against the medicore_master database

INSERT INTO tenants (
  id,
  "clinicName",
  subdomain,
  "databaseName",
  status,
  "contactEmail",
  "subscriptionTier",
  "createdAt",
  "updatedAt"
)
SELECT 
  gen_random_uuid(),
  'Bulawayo General Clinic',
  'bulawayo-general',
  'medicore_bulawayo_general',
  'active',
  'admin@bulawayo-general.co.zw',
  'professional',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM tenants WHERE subdomain = 'bulawayo-general'
);

-- Verify the tenant was created
SELECT id, "clinicName", subdomain, "databaseName", status 
FROM tenants 
WHERE subdomain = 'bulawayo-general';



