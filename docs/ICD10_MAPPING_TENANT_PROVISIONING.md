# ICD-10 to SNOMED CT Mapping for New Tenants

## Overview

ICD-10 to SNOMED CT mappings are **shared across all tenants** from the master database, just like SNOMED CT itself. New tenants automatically get access to ICD-10 mappings without any additional provisioning.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Master Database                           │
│              (medicore_master)                               │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  ICD-10 Mapping Tables (Shared)                    │    │
│  │  • snomed_icd10_mappings (255,392 mappings)         │    │
│  │  • icd10_mapping_metadata (version tracking)       │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                          ▲
                          │
                          │ (Read-only access)
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Tenant DB 1  │  │ Tenant DB 2  │  │ Tenant DB N  │
│              │  │              │  │              │
│ (No ICD-10   │  │ (No ICD-10   │  │ (No ICD-10   │
│  mapping     │  │  mapping     │  │  mapping     │
│  tables)     │  │  tables)     │  │  tables)     │
└──────────────┘  └──────────────┘  └──────────────┘
```

## How It Works

### 1. **TerminologyService Architecture**

When a tenant requests ICD-10 mappings for a SNOMED concept:

```typescript
// Controller receives tenant database
terminologyService.getIcd10Mappings(req.tenantDb, conceptId, ...)

// But TerminologyService uses master database for ICD-10 mappings
const masterDb = await this.getMasterDb(); // ← Uses master DB!
const rows = await masterDb.query(query, params);
```

**Key Point**: The `tenantDb` parameter is only used as a fallback if master database is unavailable. The actual ICD-10 mapping data comes from the **master database**.

### 2. **New Tenant Creation**

When a new tenant is created:

1. **Tenant Database Created**: Only contains tenant-specific tables
2. **ICD-10 Mapping Access**: Automatically available via master database connection
3. **No Import Needed**: ICD-10 mappings are already in master database
4. **No Configuration**: Works out of the box!

### 3. **Benefits of Shared ICD-10 Mappings**

✅ **Efficient**: One copy of mapping data (not duplicated per tenant)  
✅ **Consistent**: All tenants use the same ICD-10 mapping version  
✅ **Easy Updates**: Update mappings once, all tenants benefit  
✅ **Fast Provisioning**: New tenants ready immediately  
✅ **Storage Efficient**: ~500MB total (not per tenant)  

## Current Status

### Master Database
- ✅ **255,392 ICD-10 mappings** imported
- ✅ **Active mappings**: Available for all tenants
- ✅ **Metadata**: Version tracking in place

### Tenant Databases
- ❌ **No ICD-10 mapping tables** (not needed - uses master)

## Verification

### Check Master Database

```sql
-- Connect to master database
psql -h localhost -U medicore -d medicore_master

-- Verify ICD-10 mapping tables exist
\dt *icd10*

-- Check data
SELECT COUNT(*) FROM snomed_icd10_mappings;        -- Should be ~255,392
SELECT COUNT(*) FROM snomed_icd10_mappings 
WHERE active = true;                                -- Active mappings

-- Check metadata
SELECT * FROM icd10_mapping_metadata;
```

### Test Mapping from Tenant

```bash
# Get ICD-10 mappings for a SNOMED concept (uses master DB internally)
curl -H "X-Tenant-Id: your-tenant-id" \
  "http://localhost:3013/api/terminology/snomed/map/73211009/ICD10"
```

## Database Provisioning

### What Gets Provisioned Per Tenant

✅ **Tenant-Specific Tables**:
- `patients`, `appointments`, `medical_records`
- `prescriptions`, `lab_results`, `vitals`
- All clinical data tables

❌ **NOT Provisioned Per Tenant**:
- `snomed_icd10_mappings` (in master DB only)
- `icd10_mapping_metadata` (in master DB only)

### Database Provisioning Service

The `DatabaseProvisioningService` **still creates** ICD-10 mapping tables in tenant databases for backward compatibility, but:

1. **TerminologyService uses master DB first** - New code path
2. **Falls back to tenant DB** - If master DB unavailable (backward compatibility)
3. **All new tenants** - Will use master DB automatically

**Note**: The `icd10_mapping` bundle in provisioning service can remain for backward compatibility, but new tenants will use master DB mappings.

## Updating ICD-10 Mappings

When new ICD-10 mapping releases come out:

1. **Update Master Database Only**:
   ```bash
   # Import new TSV file to master database
   npx ts-node scripts/import-icd10-mappings-to-postgresql.ts <new-tsv-path>
   ```

2. **All Tenants Automatically Get Updates**:
   - No tenant database updates needed
   - All tenants immediately use new mappings
   - No downtime for tenants

## Summary

✅ **New tenants automatically get ICD-10 mapping access**  
✅ **No provisioning needed for ICD-10 mappings**  
✅ **All tenants share the same mapping data**  
✅ **Efficient and consistent across all tenants**  

Just like SNOMED CT, ICD-10 mappings "just work" for all tenants without any additional setup!


