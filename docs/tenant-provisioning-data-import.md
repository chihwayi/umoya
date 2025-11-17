# Tenant Provisioning: Schema vs Data Import

## What Happens Automatically When Creating a New Tenant

When you create a new tenant via the API (`POST /tenants`), the following happens **automatically**:

### ✅ Schema Provisioning (Automatic)

The `DatabaseProvisioningService.createDatabase()` method automatically applies all provisioning bundles:

1. **Core Bundle** (`core`)
   - Creates all base tables (users, patients, appointments, vitals, etc.)
   - Seeds default users, lab catalog, imaging catalog, lookup tables
   - Sets up triggers and constraints

2. **SNOMED Bundle** (`snomed`)
   - Creates SNOMED cache tables (`snomed_concept_cache`, `snomed_search_cache`)
   - Adds SNOMED columns to existing tables
   - Sets up indexes for SNOMED queries

3. **HIV Testing Bundle** (`hiv_testing`)
   - Creates HIV-related tables (`hiv_enrollments`, `hiv_visits`, `hiv_art_regimens`, etc.)
   - Sets up HIV testing workflow tables

4. **ICD-10 Mapping Bundle** (`icd10_mapping`)
   - Creates `snomed_icd10_mappings` table
   - Creates `icd10_mapping_metadata` table
   - Sets up indexes for mapping lookups

**Result**: The tenant database has all the **schema** (tables, indexes, triggers) ready to use.

### ❌ Data Import (NOT Automatic)

The following data is **NOT** automatically imported:

1. **SNOMED CT Terminology Data**
   - SNOMED concepts, descriptions, relationships
   - This data comes from Snowstorm (external terminology server)
   - The cache tables are empty until concepts are searched/used

2. **ICD-10 Mapping Data**
   - The 255,392 SNOMED → ICD-10 mappings
   - The mapping tables are empty after provisioning

## Why Data Import is Separate

1. **Size**: SNOMED and ICD-10 data is very large (millions of records)
2. **Source**: SNOMED data comes from Snowstorm API, not direct database import
3. **Optional**: Not all tenants may need full terminology data
4. **Performance**: Importing large datasets during tenant creation would slow down provisioning

## How to Import Data for New Tenants

### Option 1: Manual Import Script (Recommended)

Run the import script for the new tenant:

```bash
# Import ICD-10 mappings
npx ts-node scripts/import-icd10-map.ts \
  --zip snowstorm/import/SNOMED_CT_to_ICD-10-CM_Resources_20250901.zip \
  --connection postgresql://user:pass@host:port/new_tenant_db

# SNOMED data is loaded on-demand from Snowstorm when concepts are searched
```

### Option 2: Automated Post-Provisioning Hook

You can extend the tenant creation process to automatically import data:

1. Add a post-provisioning hook in `TenantService.provisionTenantDatabase()`
2. Or create a background job that processes new tenants
3. Or use the `import-icd10-all-tenants.ts` script periodically

### Option 3: On-Demand Loading

- **SNOMED**: Data is loaded automatically from Snowstorm when users search for concepts
- **ICD-10**: Mappings are only needed when users select SNOMED concepts, so you can import on-demand

## Current State

- ✅ **Schema**: Automatically provisioned for all new tenants
- ❌ **SNOMED Data**: Loaded on-demand from Snowstorm (no import needed)
- ❌ **ICD-10 Mappings**: Must be imported manually using `import-icd10-map.ts`

## Recommendations

1. **For Production**: Create a post-provisioning script that automatically imports ICD-10 mappings for new tenants
2. **For Development**: Import mappings manually when needed
3. **For SNOMED**: No action needed - Snowstorm serves the data on-demand

