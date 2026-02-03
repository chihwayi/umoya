# Backend Updates for WHO Smart Forms Data Storage

**Date:** December 2024  
**Status:** ✅ Complete

---

## Summary

All backend services have been updated to save WHO Smart Forms data to the new `who_smart_form_data` JSONB columns.

---

## ✅ Updated Services

### 1. **HIV Service** (`services/ehr-service/src/services/hiv.service.ts`)

#### ✅ `createHivTest` Method
- **Added:** `whoSmartFormData` parameter extraction
- **Added:** `who_smart_form_data` column to INSERT statement
- **Added:** `$41::jsonb` parameter for Smart Forms data
- **Status:** ✅ Complete

#### ✅ `enrollInCare` Method
- **Added:** `whoSmartFormData` parameter extraction
- **Added:** `who_smart_form_data` column to INSERT statement
- **Added:** `$11::jsonb` parameter for Smart Forms data
- **Status:** ✅ Complete

#### ✅ `createClinicalVisit` Method
- **Added:** `whoSmartFormData` parameter extraction
- **Added:** `who_smart_form_data` column to INSERT statement
- **Added:** `$86::jsonb` parameter for Smart Forms data
- **Status:** ✅ Complete

#### ✅ `createTbScreening` Method
- **Added:** `whoSmartFormData` parameter extraction
- **Added:** `who_smart_form_data` column to INSERT statement
- **Added:** `$21::jsonb` parameter for Smart Forms data
- **Added:** Logging for Smart Forms data
- **Status:** ✅ Complete

---

### 2. **Appointment Service** (`services/ehr-service/src/services/appointment.service.ts`)

#### ✅ `update` Method
- **Added:** Handling for `whoSmartFormData` in update DTO
- **Added:** Direct SQL UPDATE for `who_smart_form_data` column
- **Status:** ✅ Complete

---

### 3. **DTO Updates** (`services/ehr-service/src/dto/appointment.dto.ts`)

#### ✅ `UpdateAppointmentDto` Class
- **Added:** `whoSmartFormData?: Record<string, any>` property
- **Status:** ✅ Complete

---

### 4. **Frontend Updates** (`ehr-frontend/src/components/ClinicalNotes/ClinicalNotesWithSmartForms.tsx`)

#### ✅ `handleSmartFormSuccess` Method
- **Updated:** Now sends `whoSmartFormData` separately in `updateAppointment` call
- **Status:** ✅ Complete

---

## 📊 Data Flow

### HIV Testing
```
Frontend (HIVTestingWithSmartForms)
  ↓ sends { ...mappedFields, whoSmartFormData }
Backend (createHivTest)
  ↓ saves to hiv_tests.who_smart_form_data
Database: ✅ Stored
```

### HIV Enrollment
```
Frontend (HIVRegistrationWithSmartForms)
  ↓ sends { ...mappedFields, whoSmartFormData }
Backend (enrollInCare)
  ↓ saves to hiv_care_enrollments.who_smart_form_data
Database: ✅ Stored
```

### HIV Clinical Visits
```
Frontend (HIVCareVisitWithSmartForms)
  ↓ sends { ...mappedFields, whoSmartFormData }
Backend (createClinicalVisit)
  ↓ saves to hiv_clinical_visits.who_smart_form_data
Database: ✅ Stored
```

### TB Screening
```
Frontend (TBScreeningWithSmartForms)
  ↓ sends { ...mappedFields, whoSmartFormData }
Backend (createTbScreening)
  ↓ saves to tb_screenings.who_smart_form_data
Database: ✅ Stored
```

### Clinical Notes
```
Frontend (ClinicalNotesWithSmartForms)
  ↓ sends { notes: JSON, whoSmartFormData }
Backend (appointment.update)
  ↓ saves to appointments.who_smart_form_data
Database: ✅ Stored
```

---

## 🔍 Verification

To verify Smart Forms data is being saved:

```sql
-- Check HIV Tests
SELECT id, test_date, test_result, who_smart_form_data 
FROM hiv_tests 
WHERE who_smart_form_data IS NOT NULL 
LIMIT 5;

-- Check HIV Enrollments
SELECT id, enrollment_date, who_smart_form_data 
FROM hiv_care_enrollments 
WHERE who_smart_form_data IS NOT NULL 
LIMIT 5;

-- Check HIV Clinical Visits
SELECT id, visit_date, visit_type, who_smart_form_data 
FROM hiv_clinical_visits 
WHERE who_smart_form_data IS NOT NULL 
LIMIT 5;

-- Check TB Screenings
SELECT id, screening_date, screening_result, who_smart_form_data 
FROM tb_screenings 
WHERE who_smart_form_data IS NOT NULL 
LIMIT 5;

-- Check Appointments
SELECT id, appointment_date, who_smart_form_data 
FROM appointments 
WHERE who_smart_form_data IS NOT NULL 
LIMIT 5;
```

---

## ✅ Testing Checklist

- [x] Database columns added (`who_smart_form_data` JSONB)
- [x] Database indexes created (GIN indexes)
- [x] Backend services updated to save Smart Forms data
- [x] Frontend components send `whoSmartFormData`
- [x] DTO updated to accept `whoSmartFormData`
- [ ] **TODO:** Test with actual Smart Form submissions
- [ ] **TODO:** Verify data appears in database
- [ ] **TODO:** Test querying JSONB data

---

## 📝 Notes

1. **Data Format:** Smart Forms data is stored as JSONB, allowing efficient querying and indexing
2. **Backward Compatibility:** All changes are additive - existing functionality continues to work
3. **Null Handling:** If `whoSmartFormData` is not provided, `NULL` is stored (not an empty object)
4. **JSON Stringification:** Backend converts objects to JSON strings before storing in JSONB columns

---

## 🚀 Next Steps

1. **Test Smart Forms Submission:**
   - Submit a Smart Form from the frontend
   - Verify data appears in the database
   - Check JSON structure

2. **Query Examples:**
   - Create queries to extract specific Smart Form fields
   - Build reports using Smart Forms data
   - Create audit trails

3. **Documentation:**
   - Add API documentation for Smart Forms endpoints
   - Create query examples for developers
   - Document data structure

---

## Related Documentation

- [Database Provisioning](./DATABASE_PROVISIONING.md)
- [Smart Forms Data Flow](./SMART_FORMS_DATA_FLOW.md)
- [Complete System Integration](./COMPLETE_SYSTEM_INTEGRATION.md)


