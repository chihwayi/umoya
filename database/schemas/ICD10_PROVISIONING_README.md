# ICD-10 Terminology Database Provisioning

## Overview

The ICD-10 terminology tables enable searchable ICD-10 diagnosis codes throughout the EHR system, eliminating the need for clinicians to memorize codes.

## Database Tables Created

1. **`icd10_codes`** - Main ICD-10 codes with descriptions
2. **`icd10_search_cache`** - Performance cache for search results
3. **`snomed_to_icd10_map`** - SNOMED CT to ICD-10 mappings

## Provisioning Steps

### 1. Create the Schema

Run the schema file **ON EACH TENANT DATABASE**:

```bash
# For each tenant database
psql -h localhost -U postgres -d medicore_tenant_<tenant_slug> -f database/schemas/icd10-terminology.sql
```

Example:
```bash
psql -h localhost -U postgres -d medicore_tenant_bulawayo_general -f database/schemas/icd10-terminology.sql
```

### 2. Seed Common ED Codes

Load the starter set of common ED diagnosis codes:

```bash
psql -h localhost -U postgres -d medicore_tenant_<tenant_slug> -f database/seeds/icd10-common-ed-codes.sql
```

Example:
```bash
psql -h localhost -U postgres -d medicore_tenant_bulawayo_general -f database/seeds/icd10-common-ed-codes.sql
```

### 3. Verify Installation

Check that codes were inserted:

```sql
SELECT COUNT(*) FROM icd10_codes;
-- Should return 50+ codes

-- Test search function
SELECT * FROM search_icd10_codes('chest pain', 10, 0, true);
-- Should return R07.9 and related codes
```

## Current Code Coverage

The starter seed includes **50+ common ED diagnoses**:
- Cardiovascular (MI, angina, heart failure)
- Respiratory (pneumonia, COPD, asthma)
- Neurological (stroke, seizure, headache)
- Gastrointestinal (GI bleed, appendicitis)
- Trauma (fractures, concussion)
- Infectious diseases (sepsis, UTI, cellulitis)
- Common symptoms (chest pain, fever, nausea)

## Expanding the Database

### Option 1: Add More Codes Manually

Insert additional codes as needed:

```sql
INSERT INTO icd10_codes (code, description, category, category_description, billable, valid_for_coding)
VALUES 
('M79.3', 'Panniculitis, unspecified', 'M79', 'Other soft tissue disorders', true, true),
('S52.501A', 'Unspecified fracture of lower end of right radius, initial encounter', 'S52', 'Fracture of forearm', true, true);
```

### Option 2: Import Full ICD-10-CM Database

For complete ICD-10-CM coverage (70,000+ codes):

1. Download ICD-10-CM from CMS: https://www.cms.gov/medicare/coding-billing/icd-10-codes
2. Parse the data files
3. Bulk insert into `icd10_codes` table

Example bulk insert script (pseudocode):
```sql
COPY icd10_codes (code, description, category, category_description, billable, valid_for_coding)
FROM '/path/to/icd10_parsed.csv'
DELIMITER ','
CSV HEADER;
```

## API Endpoints

After provisioning, these endpoints become available:

- **`GET /api/terminology/icd10/search?term=chest pain`** - Search codes
- **`GET /api/terminology/icd10/code/:code`** - Get code details
- **`GET /api/terminology/icd10/category/:category`** - Get codes by category

## Frontend Integration

The `ICD10Picker` component automatically uses the database:

```tsx
<ICD10Picker
  value={icd10Code}
  onChange={(code, description) => {
    setIcd10Code(code);
    setIcd10Description(description);
  }}
  token={token}
  tenantSlug={tenantSlug}
  required={true}
/>
```

## User Experience

**Before (Hard-coded):**
- ❌ Limited to ~40 pre-defined codes
- ❌ No updates without code changes
- ❌ Cannot add custom codes

**After (Database):**
- ✅ Searchable by description: "heart attack" → finds I21.0
- ✅ Searchable by code: "I21" → finds all MI codes
- ✅ Easily expandable
- ✅ Full-text search with ranking
- ✅ Billable flag enforced
- ✅ Performance caching
- ✅ Can add custom codes per tenant

## Maintenance

### Cache Cleanup

Run periodically to clean old cache entries:

```sql
SELECT cleanup_icd10_cache();
```

### Update Codes

ICD-10 codes are updated annually by CMS (October 1st). To update:

1. Download new code set
2. Mark old codes as `valid_for_coding = false`
3. Insert new codes
4. Update changed descriptions

```sql
-- Example: Mark old code as invalid
UPDATE icd10_codes SET valid_for_coding = false WHERE code = 'OLD.CODE';

-- Insert replacement
INSERT INTO icd10_codes (code, description, ...) VALUES ('NEW.CODE', 'New description', ...);
```

## Troubleshooting

### Issue: "Function search_icd10_codes does not exist"
**Solution:** Run the schema file (`icd10-terminology.sql`) on the tenant database.

### Issue: "No ICD-10 codes found"
**Solution:** Run the seed file (`icd10-common-ed-codes.sql`) to populate initial codes.

### Issue: Search is slow
**Solution:** Ensure indexes are created:
```sql
CREATE INDEX IF NOT EXISTS idx_icd10_description_fulltext ON icd10_codes USING gin(to_tsvector('english', description));
```

## Next Steps

1. ✅ Provision schema on all tenant databases
2. ✅ Seed common ED codes
3. 🔄 Consider importing full ICD-10-CM dataset
4. 🔄 Add SNOMED to ICD-10 mappings for automated suggestions
5. 🔄 Implement periodic cache cleanup job

## Contact

For questions or issues with ICD-10 provisioning, contact the development team.

