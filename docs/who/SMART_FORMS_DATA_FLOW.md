# WHO Smart Forms Data Flow & Storage

**Date:** December 2024

---

## 📊 Where Does Smart Forms Data Go?

### Data Storage Architecture

WHO Smart Forms data is saved in **two ways**:

#### 1. **Mapped to Standard EHR Fields** ✅
The Smart Form answers are automatically mapped to your existing EHR database structure:

**HIV Testing:**
- **API Endpoint:** `POST /api/hiv/tests`
- **Database Table:** `hiv_tests`
- **Mapped Fields:**
  - `test_date` ← `HIV.B.DE110`
  - `test_result` ← `HIV.B.DE111`
  - `hiv_status` ← `HIV.B.DE115`
  - `test_type` ← `HIV.B.DE81`
  - `assay_number` ← `HIV.B.DE88`
  - `test_result1`, `test_result2`, `test_result3` ← Algorithm results
- **Storage:** Standard columns in `hiv_tests` table

**Patient Registration/Enrollment:**
- **API Endpoint:** `POST /api/hiv/enrollments`
- **Database Table:** `hiv_enrollments`
- **Mapped Fields:**
  - `enrollment_date` ← Form date
  - `date_confirmed_positive` ← Confirmation date
  - `baseline_cd4` ← Baseline CD4 count
  - `baseline_viral_load` ← Baseline viral load
  - `baseline_clinical_stage` ← WHO clinical stage
- **Storage:** Standard columns in `hiv_enrollments` table

**Clinical Visits:**
- **API Endpoint:** `POST /api/hiv/visits`
- **Database Table:** `hiv_clinical_visits`
- **Mapped Fields:**
  - `visit_date` ← Visit date
  - `visit_type` ← Visit type
  - `weight_kg` ← Weight from vitals form
  - `height_cm` ← Height from vitals form
  - `blood_pressure` ← BP from vitals form
  - `who_clinical_stage` ← WHO staging form
  - `tb_screening` ← TB screening form
- **Storage:** Standard columns in `hiv_clinical_visits` table

#### 2. **Complete Form Data Preserved** ✅
**All original Smart Form data is preserved** in a JSONB field:

- **Field Name:** `whoSmartFormData` (or `who_smart_form_data` in database)
- **Storage Type:** JSONB (PostgreSQL) or JSON column
- **Content:** Complete form answers with all field IDs and values
- **Purpose:** 
  - Audit trail
  - Data integrity verification
  - Future analysis
  - Compliance reporting

**Example Structure:**
```json
{
  "whoSmartFormData": {
    "HIV.B.DE110": "2024-12-09",
    "HIV.B.DE111": "reactive",
    "HIV.B.DE115": "positive",
    "HIV.B.DE81": "rapid_antibody",
    "HIV.B.DE88": "KIT-12345",
    "_metadata": {
      "formId": "HIV.B7TestForHivUsingTestingAlgorithm",
      "patientId": "patient-123",
      "submittedAt": "2024-12-09T10:30:00Z",
      "source": "who_smart_guidelines"
    }
  }
}
```

---

## 🔄 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    WHO Smart Form                           │
│         (FHIR Questionnaire - Frontend)                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ User fills form
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Data Mapping Layer                             │
│  (HIVTestingWithSmartForms.mapSmartFormToHivTest)          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Maps to EHR structure
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              API Request                                    │
│  POST /api/hiv/tests                                        │
│  Body: {                                                    │
│    testDate: "2024-12-09",                                 │
│    testResult: "reactive",                                  │
│    whoSmartFormData: { ... full form data ... }            │
│  }                                                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Backend processes
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Database Storage                                │
│  ┌──────────────────────────────────────┐                │
│  │ hiv_tests table                        │                │
│  │ ├─ test_date (DATE)                   │                │
│  │ ├─ test_result (VARCHAR)              │                │
│  │ ├─ hiv_status (VARCHAR)                │                │
│  │ └─ who_smart_form_data (JSONB) ◄──────┼─ Full form     │
│  └──────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Can You Replace Entire Modules with Smart Forms?

### **Short Answer:** Yes, but with considerations

### **Current Implementation Strategy:**

#### ✅ **Hybrid Approach (Recommended)**
Smart Forms work **alongside** your existing forms:

1. **Option to Use Smart Forms:**
   - Users can choose "Use WHO Forms" button
   - Or use standard forms
   - Both save to the same database tables

2. **Data Compatibility:**
   - Smart Forms map to your existing database schema
   - No database changes required
   - Existing reports/queries still work

3. **Gradual Migration:**
   - Start with Smart Forms as optional
   - Monitor usage and feedback
   - Gradually make Smart Forms default
   - Eventually deprecate old forms

#### ⚠️ **Considerations Before Full Replacement:**

1. **Data Mapping Completeness:**
   - Current mapping is **simplified** (covers main fields)
   - Some Smart Form fields may not map to your schema
   - Need to review and enhance mapping functions

2. **Custom Business Logic:**
   - Your existing forms may have custom validations
   - Business rules specific to your facility
   - Workflow steps not in WHO forms
   - **Solution:** Keep custom logic, enhance Smart Forms integration

3. **User Training:**
   - Staff familiar with current forms
   - WHO forms may have different field names
   - Need training on new forms

4. **Reporting & Analytics:**
   - Existing reports use current field names
   - Smart Forms use WHO field IDs (e.g., `HIV.B.DE110`)
   - **Solution:** Reports can use mapped fields OR `whoSmartFormData` JSONB

---

## 📋 Implementation Status by Module

### ✅ **HIV Module** - Fully Integrated
- **Testing:** ✅ Smart Forms available
- **Registration:** ✅ Smart Forms available
- **ART Initiation:** ✅ Smart Forms available
- **Care Visits:** ✅ Smart Forms available
- **Data Storage:** ✅ Mapped + JSONB preserved

### ⏳ **Other Modules** - Not Yet Integrated
- **TB Module:** Can integrate Smart Forms
- **Maternity Module:** Can integrate Smart Forms
- **General Clinical Notes:** Can integrate Smart Forms
- **Any Module:** Can integrate Smart Forms

---

## 🔧 How to Integrate Smart Forms into Other Modules

### Step 1: Identify Your Module's Forms
```typescript
// Example: TB Module
const TB_FORMS = [
  { id: 'TB.A1ScreenForTb', title: 'TB Screening' },
  { id: 'TB.B2DiagnoseTb', title: 'TB Diagnosis' },
  // ... more forms
];
```

### Step 2: Create Mapping Function
```typescript
const mapSmartFormToTbScreening = (formData: Record<string, any>) => {
  return {
    patientId: patientId,
    screeningDate: formData['TB.A.DE10'],
    screeningResult: formData['TB.A.DE15'],
    // Map to your existing TB screening structure
    whoSmartFormData: formData, // Preserve full form
  };
};
```

### Step 3: Create Integration Component
```typescript
export const TBScreeningWithSmartForms: React.FC<Props> = ({ ... }) => {
  const handleSmartFormSuccess = async (formData: Record<string, any>) => {
    const mappedData = mapSmartFormToTbScreening(formData);
    await ehrApi.createTbScreening(mappedData, token, tenantSlug);
  };
  
  return (
    <WHOSmartFormIntegration
      formId="TB.A1ScreenForTb"
      onSuccess={handleSmartFormSuccess}
      // ... other props
    />
  );
};
```

### Step 4: Update Backend (if needed)
```typescript
// Add JSONB column to store Smart Form data
ALTER TABLE tb_screenings 
ADD COLUMN who_smart_form_data JSONB;

// Or use existing JSONB column
UPDATE tb_screenings 
SET form_data = jsonb_set(form_data, '{whoSmartFormData}', $1::jsonb);
```

---

## 💾 Database Schema Recommendations

### Option 1: Add Dedicated Column (Recommended)
```sql
-- For each table that uses Smart Forms
ALTER TABLE hiv_tests 
ADD COLUMN who_smart_form_data JSONB;

ALTER TABLE hiv_enrollments 
ADD COLUMN who_smart_form_data JSONB;

ALTER TABLE hiv_clinical_visits 
ADD COLUMN who_smart_form_data JSONB;
```

### Option 2: Use Existing JSONB Column
```sql
-- If you already have a JSONB column for form data
UPDATE hiv_tests 
SET form_data = jsonb_set(
  COALESCE(form_data, '{}'::jsonb), 
  '{whoSmartFormData}', 
  $1::jsonb
);
```

---

## 📊 Querying Smart Form Data

### Query Mapped Fields (Standard)
```sql
-- Standard queries work as before
SELECT test_date, test_result, hiv_status 
FROM hiv_tests 
WHERE patient_id = 'patient-123';
```

### Query Smart Form Data (JSONB)
```sql
-- Access full Smart Form data
SELECT 
  test_date,
  test_result,
  who_smart_form_data->>'HIV.B.DE110' as test_date_from_form,
  who_smart_form_data->>'HIV.B.DE111' as test_result_from_form,
  who_smart_form_data->>'_metadata' as form_metadata
FROM hiv_tests 
WHERE who_smart_form_data IS NOT NULL;
```

### Extract All Form Fields
```sql
-- Get all Smart Form fields
SELECT 
  jsonb_object_keys(who_smart_form_data) as field_id,
  who_smart_form_data->jsonb_object_keys(who_smart_form_data) as field_value
FROM hiv_tests
WHERE who_smart_form_data IS NOT NULL;
```

---

## ✅ Benefits of Current Approach

1. **✅ No Database Migration Required**
   - Uses existing tables and columns
   - Adds JSONB field for full form data (optional)

2. **✅ Backward Compatible**
   - Existing forms still work
   - Existing reports still work
   - No breaking changes

3. **✅ Data Integrity**
   - Mapped fields ensure data consistency
   - Full form data preserved for audit
   - Can verify mapping accuracy

4. **✅ Flexibility**
   - Can use Smart Forms or standard forms
   - Gradual migration possible
   - Easy to rollback if needed

---

## 🚀 Next Steps

1. **Review Current Mapping:**
   - Check if all important fields are mapped
   - Identify missing mappings
   - Enhance mapping functions

2. **Add Database Column (Optional):**
   - Add `who_smart_form_data JSONB` to relevant tables
   - Or use existing JSONB columns

3. **Enhance Reporting:**
   - Update reports to use mapped fields
   - Add Smart Form data queries if needed

4. **Expand to Other Modules:**
   - TB Module
   - Maternity Module
   - General Clinical Notes
   - Any other module

---

## 📝 Summary

**Where Data Goes:**
- ✅ Mapped to standard EHR database fields
- ✅ Full form data preserved in JSONB column (`whoSmartFormData`)

**Can You Replace Entire Modules?**
- ✅ Yes, but use hybrid approach initially
- ✅ Smart Forms work alongside existing forms
- ✅ Gradual migration recommended
- ✅ Both save to same database tables

**Current Status:**
- ✅ HIV Module fully integrated
- ⏳ Other modules can be integrated using same pattern


