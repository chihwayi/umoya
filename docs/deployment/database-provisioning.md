# Database Provisioning Guide

## Overview
MediCore uses a multi-tenant architecture where each clinic has its own isolated database. This guide covers database provisioning and schema management.

## Architecture

### Master Database
- **Purpose**: Stores tenant metadata and configuration
- **Database**: `medicore_master`
- **Tables**: `tenants`, `tenant_schema_versions`, `schema_bundles`

### Tenant Databases
- **Naming**: `clinic_{subdomain}_db`
- **Isolation**: Complete data isolation per tenant
- **Schema**: Identical schema across all tenants

## Provisioning Process

### Automatic Provisioning
When a new tenant registers:
1. Tenant record created in master database
2. New database created: `clinic_{subdomain}_db`
3. Core schema applied
4. Optional bundles applied based on subscription
5. Initial data seeded (if configured)

### Manual Provisioning
```bash
# Provision specific tenant
POST /tenants/provision-database/:tenantId

# Provision with specific bundles
POST /tenants/provision-database/:tenantId/:bundleId
```

## Schema Bundles

### Core Bundle
- Base clinic schema
- Users, patients, appointments
- Medical records, prescriptions
- Billing, payments

### SNOMED Bundle
- SNOMED CT terminology tables
- Concept mappings
- Search indexes

### HIV Bundle
- HIV-specific tables
- ART tracking
- Viral load monitoring

### ICD-10 Bundle
- ICD-10 mapping tables
- SNOMED to ICD-10 mappings

### Patient Portal Bundle
- Patient portal tables
- Health goals
- PRO questionnaires
- Vitals submission

### Billing Bundle
- Financial transactions
- Tax configurations
- Payment reconciliations

### Claims Bundle
- Medical aid claims
- Pre-authorizations
- Status history
- API configurations

## Schema Versioning

### Version Tracking
- Each bundle has a version
- Applied versions tracked in `tenant_schema_versions`
- Prevents duplicate application
- Enables rollback

### Applying Updates
```typescript
// Example: Apply new bundle version
await provisioningService.applyClinicSchema(connectionString, {
  bundles: ['sprint14_2_claims_enhancement'],
  appliedBy: 'admin',
});
```

## Migration Scripts

### Creating Migration Scripts
```bash
# Location: scripts/provision-*.ts
# Example: scripts/provision-sprint14-2-claims.ts

import { DatabaseProvisioningService } from '../services/...';

async function provision() {
  // Connect to master DB
  // Get all active tenants
  // Apply bundle to each tenant
}
```

### Running Migrations
```bash
# Run specific migration
npm run provision:sprint14-2

# Run all pending migrations
npm run provision:all
```

## Best Practices

### Schema Changes
- Always use `IF NOT EXISTS` for tables
- Use `ALTER TABLE` with existence checks
- Test on development tenant first
- Backup before applying to production

### Bundle Management
- Keep bundles focused and modular
- Version all bundles
- Document bundle dependencies
- Test bundle combinations

### Performance
- Apply indexes after table creation
- Use transactions for atomic operations
- Batch operations when possible
- Monitor provisioning duration

## Troubleshooting

### Provisioning Failures
```bash
# Check tenant status
SELECT * FROM tenants WHERE id = '<tenant-id>';

# Check schema versions
SELECT * FROM tenant_schema_versions WHERE tenant_id = '<tenant-id>';

# Check database exists
SELECT datname FROM pg_database WHERE datname = 'clinic_<subdomain>_db';
```

### Rollback
```bash
# Remove bundle version
DELETE FROM tenant_schema_versions 
WHERE tenant_id = '<tenant-id>' AND bundle_id = '<bundle-id>';

# Re-run provisioning
POST /tenants/provision-database/:tenantId/:bundleId
```

## Monitoring

### Metrics
- Provisioning duration
- Bundle application success rate
- Schema version distribution
- Database size per tenant

### Alerts
- Provisioning failures
- Long-running provisioning
- Schema version mismatches
- Database connection issues

