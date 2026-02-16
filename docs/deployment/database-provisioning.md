# Database Provisioning

**Last Updated**: December 3, 2025  
**Includes**: Sprints 1-25 (All Tier 1 features) Guide

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
- ARV drug catalog
- WHO staging
- Viral load tracking

### Tier 1 Critical Features Bundle (Sprints 21-25)
- **E-Consent Management**: Digital consent forms, e-signatures, version control, audit trails
- **Immunization Registry**: CDC vaccine schedules, inventory, public health reporting
- **Bed Management & ADT**: Real-time bed tracking, admissions, discharges, transfers
- **Emergency Department**: ESI triage, ED tracking board, wait time management
- **Clinical Pathways**: Evidence-based care protocols, adherence tracking

**Migrations Applied**:
- `003-sprint21-econsent-management.sql` - Consent templates, patient consents, signatures
- `004-sprint22-immunization-registry.sql` - Immunizations, schedules, inventory
- `005-sprint23-bed-management-adt.sql` - Beds, admissions, discharges, transfers
- `006-sprint24-emergency-department.sql` - ED visits, triage, dispositions
- `007-sprint25-clinical-pathways.sql` - Pathways, enrollments, adherence
- `008-add-terminology-coding.sql` - SNOMED/ICD-10/CPT/LOINC/RxNorm/CVX codes
- `009-complete-tier1-seed-data.sql` - Default templates and seed data

**Total Tables Added**: 29 tables  
**Total Seed Records**: 109 records
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

### Document Management Bundle (Sprint 19)
- **Bundle ID**: `sprint19_documents`
- **Script**: `scripts/provision-sprint19-documents.ts`
- **Tables**:
  - `documents` - Main document storage
  - `document_versions` - Version history
  - `document_sharing` - Sharing permissions
  - `document_tags` - Tag organization
  - `document_access_log` - Audit trail
- **Features**:
  - File upload and storage
  - Version control
  - Document sharing with permissions
  - Tag-based organization
  - Complete audit logging
- **Provisioning**:
  ```bash
  npm run ts-node scripts/provision-sprint19-documents.ts
  ```

### Provider Messaging Bundle (Sprint 20)
- **Bundle ID**: `sprint20_provider_messaging`
- **Script**: `scripts/provision-sprint20-messaging.ts`
- **Tables**:
  - `provider_messages` - Message storage
  - `message_threads` - Thread management
  - `message_read_receipts` - Read tracking
  - `message_attachments` - File attachments
  - `message_tasks` - Task assignment
  - `message_templates` - Reusable templates
- **Features**:
  - Secure provider-to-provider messaging
  - Message threading
  - Priority levels and message types
  - Read receipts
  - Task assignment
  - Template system
- **Provisioning**:
  ```bash
  npm run ts-node scripts/provision-sprint20-messaging.ts
  ```
- **Seed Data**:
  ```bash
  npm run ts-node scripts/seed-message-templates.ts
  ```

### Nurse Copilot Persistence Bundle (Sprint 46 / Wave 6)
- **Bundle ID**: `sprint46_nurse_copilot`
- **Script**: `scripts/provision-sprint46-nurse-copilot.ts`
- **Migration**: `database/migrations/034-nurse-copilot-persistence.sql`
- **Tables**:
  - `nurse_copilot_task_events` - server-scoped task completion state
  - `nurse_copilot_alert_events` - server-scoped alert acknowledgement state
  - `nurse_handoff_workflow_state` - handoff finalize/review/share lifecycle state
- **Indexes**:
  - user/status and patient indexes for task and alert event lookup
  - handoff status/finalized/shared timestamp indexes
- **Provisioning (existing tenants)**:
  ```bash
  npx ts-node scripts/provision-sprint46-nurse-copilot.ts
  ```
- **Provisioning (new tenants)**:
  - Applied automatically through `DatabaseProvisioningService` bundle list.

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

// Apply Sprint 19 (Document Management)
await provisioningService.applyClinicSchema(connectionString, {
  bundles: ['sprint19_documents'],
  appliedBy: 'admin',
});

// Apply Sprint 20 (Provider Messaging)
await provisioningService.applyClinicSchema(connectionString, {
  bundles: ['sprint20_provider_messaging'],
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

# Wave 6 nurse copilot provisioning across existing tenants
npx ts-node scripts/provision-sprint46-nurse-copilot.ts
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
