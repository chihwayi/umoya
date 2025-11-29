# SNOMED CT for New Tenants - How It Works

## Overview

SNOMED CT is **shared across all tenants** from the master database. New tenants automatically get access to SNOMED CT search without any additional provisioning.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Master Database                           │
│              (medicore_master)                               │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  SNOMED CT Tables (Shared)                          │    │
│  │  • snomed_concepts (527,191 concepts)              │    │
│  │  • snomed_descriptions (1,686,474 descriptions)    │    │
│  │  • snomed_search_view (1,008,243 entries)         │    │
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
│ (No SNOMED   │  │ (No SNOMED   │  │ (No SNOMED   │
│  tables)     │  │  tables)     │  │  tables)     │
└──────────────┘  └──────────────┘  └──────────────┘
```

## How It Works

### 1. **TerminologyService Architecture**

When a tenant searches for SNOMED CT concepts:

```typescript
// Controller receives tenant database
terminologyService.searchConcepts(req.tenantDb, term, ...)

// But TerminologyService uses master database for SNOMED
if (this.usePostgres && this.postgresService) {
  const masterDb = await this.getMasterDb(); // ← Uses master DB!
  return await this.postgresService.searchConcepts(masterDb, term, ...);
}
```

**Key Point**: The `tenantDb` parameter is only used for:
- Caching search results (optional)
- Fallback to Snowstorm API (if PostgreSQL fails)

The actual SNOMED CT data comes from the **master database**.

### 2. **New Tenant Creation**

When a new tenant is created:

1. **Tenant Database Created**: Only contains tenant-specific tables (patients, appointments, etc.)
2. **SNOMED CT Access**: Automatically available via master database connection
3. **No Import Needed**: SNOMED CT is already in master database
4. **No Configuration**: Works out of the box!

### 3. **Benefits of Shared SNOMED CT**

✅ **Efficient**: One copy of SNOMED CT data (not duplicated per tenant)  
✅ **Consistent**: All tenants use the same SNOMED CT version  
✅ **Easy Updates**: Update SNOMED CT once, all tenants benefit  
✅ **Fast Provisioning**: New tenants ready immediately  
✅ **Storage Efficient**: ~2-3GB total (not per tenant)  

## Verification

### Check Master Database

```sql
-- Connect to master database
psql -h localhost -U medicore -d medicore_master

-- Verify SNOMED CT tables exist
\dt snomed*

-- Check data
SELECT COUNT(*) FROM snomed_concepts;        -- Should be ~527,191
SELECT COUNT(*) FROM snomed_descriptions;    -- Should be ~1,686,474
SELECT COUNT(*) FROM snomed_search_view;     -- Should be ~1,008,243
```

### Check Tenant Database

```sql
-- Connect to any tenant database
psql -h localhost -U medicore -d clinic_your-tenant_db

-- Verify NO SNOMED tables (they shouldn't exist)
\dt snomed*
-- Should return: "Did not find any relation named snomed*"
```

### Test Search from Tenant

```bash
# Search from any tenant (uses master DB internally)
curl -H "X-Tenant-Id: your-tenant-id" \
  "http://localhost:3013/api/terminology/snomed/search?term=diabetes&limit=10"
```

## Database Provisioning

### What Gets Provisioned Per Tenant

✅ **Tenant-Specific Tables**:
- `patients`, `appointments`, `medical_records`
- `prescriptions`, `lab_results`, `vitals`
- `nursing_notes`, `triage_assessments`
- All clinical data tables

❌ **NOT Provisioned Per Tenant**:
- `snomed_concepts` (in master DB only)
- `snomed_descriptions` (in master DB only)
- `snomed_relationships` (in master DB only)
- `snomed_search_view` (in master DB only)

### Database Provisioning Service

The `DatabaseProvisioningService` does **NOT** create SNOMED tables in tenant databases because:

1. SNOMED CT is shared from master database
2. No tenant-specific SNOMED data exists
3. All tenants use the same terminology

## Updating SNOMED CT

When new SNOMED CT releases come out:

1. **Update Master Database Only**:
   ```bash
   # Import new RF2 files to master database
   ts-node scripts/import-snomed-to-postgresql.ts <new-rf2-path>
   ```

2. **All Tenants Automatically Get Updates**:
   - No tenant database updates needed
   - All tenants immediately use new SNOMED CT version
   - No downtime for tenants

## Troubleshooting

### Issue: Tenant can't search SNOMED CT

**Check**:
1. Master database has SNOMED tables:
   ```sql
   SELECT COUNT(*) FROM medicore_master.snomed_concepts;
   ```

2. EHR service can connect to master:
   ```bash
   docker logs medicore-ehr-service | grep "Master database connected"
   ```

3. Environment variable is set:
   ```bash
   echo $SNOMED_USE_POSTGRES  # Should be "true"
   ```

### Issue: Search returns no results

**Check**:
1. Materialized view is refreshed:
   ```sql
   REFRESH MATERIALIZED VIEW CONCURRENTLY snomed_search_view;
   ```

2. Search term is valid:
   ```sql
   SELECT * FROM snomed_search_view 
   WHERE term ILIKE '%diabetes%' 
   LIMIT 10;
   ```

## Summary

✅ **New tenants automatically get SNOMED CT access**  
✅ **No provisioning needed for SNOMED CT**  
✅ **All tenants share the same SNOMED CT data**  
✅ **Efficient and consistent across all tenants**  

The system is designed so that SNOMED CT "just works" for all tenants without any additional setup!


