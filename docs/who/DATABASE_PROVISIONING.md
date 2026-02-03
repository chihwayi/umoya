# WHO Smart Forms Database Provisioning

**Date:** December 2024  
**Status:** ✅ Required - Migration Available

---

## Overview

To fully support WHO Smart Forms data storage, you need to add JSONB columns to relevant database tables. This allows storing the complete Smart Forms data alongside the mapped fields.

---

## ✅ What We Did Today

Today we integrated WHO Smart Forms across all modules, but **we did NOT add database columns yet**. The forms work and data is mapped to existing fields, but the complete Smart Forms data is not being stored.

---

## 🔧 Database Changes Required

### Migration File

**Location:** `database/migrations/032-add-who-smart-forms-data-columns.sql`

**What It Does:**
- Adds `who_smart_form_data JSONB` column to:
  - `hiv_tests`
  - `hiv_care_enrollments`
  - `hiv_clinical_visits`
  - `tb_screenings`
  - `appointments`
  - `medical_records`
- Creates GIN indexes for efficient JSONB queries
- Adds helpful comments

---

## 📋 How to Apply

### Option 1: Manual SQL Execution

```bash
# Connect to your tenant database
psql -d medicore_master -U your_user

# Or for a specific tenant
psql -d tenant_bulawayo_general -U your_user

# Run the migration
\i database/migrations/032-add-who-smart-forms-data-columns.sql
```

### Option 2: Via Database Provisioning Service

The migration is automatically included in the provisioning bundles. When you provision a new tenant or update an existing one, the columns will be added.

**To manually trigger:**
```typescript
// In your backend service
await databaseProvisioningService.applyProvisioningBundle(
  tenantDb,
  'who_smart_forms_data'
);
```

### Option 3: Add to Provisioning Bundles

Add this to `services/tenant-service/src/services/database-provisioning.service.ts`:

```typescript
{
  id: 'who_smart_forms_data',
  label: 'WHO Smart Forms Data Storage',
  version: '2024.12.09',
  description: 'Adds JSONB columns to store complete WHO Smart Forms data',
  statements: () => [
    `ALTER TABLE hiv_tests ADD COLUMN IF NOT EXISTS who_smart_form_data JSONB`,
    `ALTER TABLE hiv_care_enrollments ADD COLUMN IF NOT EXISTS who_smart_form_data JSONB`,
    `ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS who_smart_form_data JSONB`,
    `ALTER TABLE tb_screenings ADD COLUMN IF NOT EXISTS who_smart_form_data JSONB`,
    `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS who_smart_form_data JSONB`,
    `ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS who_smart_form_data JSONB`,
    // ... indexes ...
  ],
}
```

---

## 📊 Current Status

### ✅ What Works Now (Without Migration)

1. **Smart Forms Integration:**
   - Forms load and display correctly
   - Users can fill out forms
   - Data is mapped to existing database fields
   - Forms submit successfully

2. **Data Storage:**
   - Mapped fields are saved to standard columns
   - Example: `test_date`, `test_result`, `hiv_status` in `hiv_tests` table

### ⚠️ What's Missing (Requires Migration)

1. **Complete Form Data:**
   - Full Smart Forms data is NOT being stored
   - Only mapped fields are saved
   - Original form answers are lost

2. **Audit Trail:**
   - Cannot verify what was actually entered in the form
   - Cannot reconstruct the original form submission
   - Limited compliance/audit capabilities

---

## 🔄 After Migration

### Backend Changes Needed

Once columns are added, update backend services to store Smart Forms data:

**Example: `hiv.service.ts`**
```typescript
async createHivTest(body: any, tenantDb: DataSource) {
  const { whoSmartFormData, ...mappedFields } = body;
  
  const insertResult = await tenantDb.query(
    `
    INSERT INTO hiv_tests (
      patient_id,
      test_date,
      test_result,
      who_smart_form_data,  -- Add this
      ...
    )
    VALUES ($1, $2, $3, $4::jsonb, ...)
    `,
    [
      patientId,
      testDate,
      testResult,
      JSON.stringify(whoSmartFormData), // Add this
      ...
    ]
  );
}
```

**Frontend Already Sends It:**
The frontend components already include `whoSmartFormData` in the payload:
```typescript
const mappedData = {
  ...mappedFields,
  whoSmartFormData: formData, // Already included!
};
```

---

## 📋 Tables That Need Columns

| Table | Column | Purpose |
|-------|--------|---------|
| `hiv_tests` | `who_smart_form_data` | Store complete HIV testing form data |
| `hiv_care_enrollments` | `who_smart_form_data` | Store enrollment form data |
| `hiv_clinical_visits` | `who_smart_form_data` | Store clinical visit form data |
| `tb_screenings` | `who_smart_form_data` | Store TB screening form data |
| `appointments` | `who_smart_form_data` | Store clinical notes form data |
| `medical_records` | `who_smart_form_data` | Store general documentation form data |

---

## 🔍 Verification

After running the migration, verify columns exist:

```sql
-- Check if columns exist
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE column_name = 'who_smart_form_data'
ORDER BY table_name;

-- Check indexes
SELECT 
  tablename,
  indexname
FROM pg_indexes
WHERE indexname LIKE '%who_smart_form%';
```

---

## 📝 Summary

**Do You Need Database Provisioning?**

✅ **YES** - To store complete Smart Forms data

**What's Required:**
1. ✅ Run migration `032-add-who-smart-forms-data-columns.sql`
2. ✅ Update backend services to save `whoSmartFormData` (frontend already sends it)
3. ✅ Verify columns exist

**Current Status:**
- ✅ Smart Forms work and save mapped data
- ⚠️ Complete form data is NOT stored yet (needs migration)
- ✅ Migration file is ready to apply

---

## 🚀 Next Steps

1. **Apply Migration:**
   ```bash
   psql -d tenant_bulawayo_general -f database/migrations/032-add-who-smart-forms-data-columns.sql
   ```

2. **Update Backend Services:**
   - Update `hiv.service.ts` to save `whoSmartFormData`
   - Update `tb.service.ts` (if exists) to save `whoSmartFormData`
   - Update appointment service to save `whoSmartFormData` in notes

3. **Test:**
   - Submit a Smart Form
   - Verify `who_smart_form_data` column has data
   - Query the JSONB data to verify structure

4. **Document:**
   - Update API documentation
   - Add examples of querying JSONB data

---

## Related Documentation

- [Smart Forms Data Flow](./SMART_FORMS_DATA_FLOW.md)
- [Complete System Integration](./COMPLETE_SYSTEM_INTEGRATION.md)
- [Universal Integration](./UNIVERSAL_SMART_FORMS_INTEGRATION.md)


