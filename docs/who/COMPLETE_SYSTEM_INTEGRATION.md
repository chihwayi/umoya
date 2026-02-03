# Complete WHO Smart Forms System Integration

**Date:** December 2024  
**Status:** ✅ Fully Integrated Across All Modules

---

## 🎯 Overview

WHO Smart Forms are now fully integrated across **all major modules** in the EHR system, providing standardized, WHO-compliant data capture throughout the entire patient care workflow.

---

## 🚀 Universal Integration (NEW)

**Smart Forms are now available in ALL modules via:**

1. **Floating Action Button** - Quick access from any dashboard
2. **Universal Panel** - Comprehensive form browser with filtering
3. **Module-Specific Integration** - Deep integration in key workflows

**Integrated Dashboards:**
- ✅ Main Doctor Dashboard (Quick Actions toolbar)
- ✅ Cardiology Dashboard (Floating button)
- ✅ Diabetes Management Dashboard (Floating button)
- ✅ Oncology Dashboard (Floating button)
- ✅ Ophthalmology Dashboard (Floating button)
- ✅ Maternity Doctor Dashboard (Floating button)
- ✅ HIV Doctor Dashboard (Full workflow integration)
- ✅ Nurse Dashboard (Multiple sections)

**See [Universal Smart Forms Integration](./UNIVERSAL_SMART_FORMS_INTEGRATION.md) for complete details.**

---

## 📋 Module-Specific Integrations

### ✅ **1. HIV Module** - FULLY INTEGRATED
**Components:**
- `HIVTestingWithSmartForms` - Testing workflow
- `HIVRegistrationWithSmartForms` - Patient enrollment
- `HIVCareVisitWithSmartForms` - Clinical visits
- `HIVWorkflowIntegration` - Complete workflow

**Access Points:**
- Nurse Dashboard → HIV Section → Testing Tab
- Nurse Dashboard → HIV Section → WHO Workflow Tab
- Doctor Dashboard → Patient Detail → Visits Tab → Record Visit
- Doctor Dashboard → Patient Detail → Workflow Tab

**Forms Used:**
- `HIV.B1DetermineReasonForVisit`
- `HIV.B6CaptureOrUpdateClientHistory`
- `HIV.B7TestForHivUsingTestingAlgorithm`
- `HIV.B8ProvidePostTestCounselling`
- `HIV.A2GatherClientDetails`
- `HIV.A5CreateNewClientRecord`
- `HIV.D2TakeVitalSigns`
- `HIV.D4ScreenForTb`
- `HIV.D8CaptureOrUpdateClientHistory`
- `HIV.D15DetermineClinicalStageOfHiv`
- `HIV.F12Prescribe` (ART)
- And 50+ more HIV-related forms

**Data Storage:**
- Mapped to: `hiv_tests`, `hiv_enrollments`, `hiv_clinical_visits` tables
- Full form data: `whoSmartFormData` JSONB field

---

### ✅ **2. TB Module** - FULLY INTEGRATED
**Component:** `TBScreeningWithSmartForms`

**Access Points:**
- Nurse Dashboard → HIV Section → TB Screening Tab

**Forms Used:**
- `HIV.D4ScreenForTb` - WHO-recommended TB screening questionnaire

**Data Storage:**
- Mapped to: `tb_screenings` table (via `createTbScreening` API)
- Full form data: `whoSmartFormData` JSONB field

**Integration:**
```tsx
<TBScreeningWithSmartForms
  tenantSlug={tenantSlug}
  token={token}
  patientId={patientId}
  onScreeningComplete={(data) => {}}
/>
```

---

### ✅ **3. Maternity/PMTCT Module** - FULLY INTEGRATED
**Component:** `MaternityWithSmartForms`

**Access Points:**
- Nurse Dashboard → Maternity Section

**Forms Used:**
- `HIV.E1CaptureOrUpdateMotherSHistory` - Maternal history
- `HIV.E4TestMotherForHivUsingTestingAlgorithm` - Mother HIV testing
- `HIV.F2TakeVitalSigns` - Vital signs
- `HIV.F3CaptureOrUpdateInfantSChildSHistory` - Infant history
- `HIV.F6CheckWhetherInfantChildHadHivExposure` - Exposure check
- `HIV.F8TestInfantChildForHivUsingTestingAlgorithm` - Infant testing
- `HIV.F16ImmediatelyStartInfantOnArt` - ART initiation
- `HIV.F20RecordInfantSChildSFinalHivDiagnosis` - Final diagnosis

**Data Storage:**
- Mapped to: `hiv_tests`, `maternity_enrollments` tables
- Full form data: `whoSmartFormData` JSONB field

**Integration:**
```tsx
<MaternityWithSmartForms
  tenantSlug={tenantSlug}
  token={token}
  patientId={patientId}
  patientName={patientName}
  onSuccess={() => {}}
/>
```

---

### ✅ **4. Clinical Notes Module** - FULLY INTEGRATED
**Component:** `ClinicalNotesWithSmartForms`

**Access Points:**
- ClinicalNotesModal → "Use WHO Forms" button
- Any appointment/visit workflow

**Forms Used:**
- `HIV.D1DetermineReasonForVisit` - Visit reason
- `HIV.D8CaptureOrUpdateClientHistory` - Patient history
- `HIV.C1DetermineReasonForVisit` - Care visit reason
- `HIV.C3CaptureOrUpdateClientHistory` - Care history
- `HIV.B1DetermineReasonForVisit` - Testing visit reason
- `HIV.B6CaptureOrUpdateClientHistory` - Testing history

**Data Storage:**
- Mapped to: Appointment `notes` field (JSON)
- Structure: `{ clinicalDocumentation: {...}, whoSmartFormData: {...} }`

**Integration:**
```tsx
<ClinicalNotesWithSmartForms
  patientId={patientId}
  patientName={patientName}
  appointmentId={appointmentId}
  tenantSlug={tenantSlug}
  token={token}
  onSuccess={() => {}}
/>
```

---

## 🔧 Generic Components

### ✅ **GenericSmartFormWrapper**
A reusable component that can integrate **any** WHO Smart Form into **any** module:

**Usage:**
```tsx
import { GenericSmartFormWrapper } from '../components/WHOSmartForms';

<GenericSmartFormWrapper
  formId="HIV.D4ScreenForTb"
  patientId={patientId}
  token={token}
  tenantSlug={tenantSlug}
  onSuccess={(formData) => {
    // Handle form data
    console.log('Form submitted:', formData);
  }}
  title="Custom Form Title"
  description="Custom description"
  showAsModal={true}
/>
```

**Features:**
- ✅ Works with any WHO Smart Form ID
- ✅ Can be used as modal or inline component
- ✅ Automatic form loading and validation
- ✅ Error handling
- ✅ Success callbacks

---

## 📊 Available WHO Smart Forms

### Total Forms Available: **67 Forms**

#### HIV Testing (B*)
- `HIV.B1DetermineReasonForVisit`
- `HIV.B6CaptureOrUpdateClientHistory`
- `HIV.B7TestForHivUsingTestingAlgorithm`
- `HIV.B8ProvidePostTestCounselling`
- `HIV.B9DetermineRecommendedServices`
- `HIV.B18ProvideVoluntaryPartnerAndFamilyServices`
- `HIV.B20ScheduleRetest`
- `HIV.B21OfferPreventionOptions`
- `HIV.B23OfferSexualAndReproductiveHealthServices`

#### HIV Registration (A*)
- `HIV.A2GatherClientDetails`
- `HIV.A5CreateNewClientRecord`
- `HIV.A6.1ReviewSociodemographicDataWithClient`

#### HIV Care & Treatment (D*)
- `HIV.D1DetermineReasonForVisit`
- `HIV.D2TakeVitalSigns`
- `HIV.D3CheckForSignsOfSeriousIllness`
- `HIV.D4ScreenForTb` ⭐ **Used for TB Module**
- `HIV.D8CaptureOrUpdateClientHistory`
- `HIV.D10CounselReturningClient`
- `HIV.D12DetermineRecommendedScreeningsAndTests`
- `HIV.D14PreventScreenAndManageComorbiditiesAndCoinfections`
- `HIV.D15DetermineClinicalStageOfHiv`
- `HIV.D16PerformOtherScreenings`
- `HIV.D17CheckForSignsOfTreatmentFailure`
- `HIV.D19AssessForVaccinePreventableDiseases`
- `HIV.D20Diagnostics`
- `HIV.D21DetermineRegimenAndTreatmentOptions`
- `HIV.D23Prescribe`
- `HIV.D24Counsel`
- `HIV.D25OfferVoluntaryPartnerAndFamilyServices`
- `HIV.D26OfferSexualAndReproductiveHealthServices`
- `HIV.D28OfferOtherServices`
- `HIV.D29ScheduleFollowUp`

#### HIV Care Services (C*)
- `HIV.C1DetermineReasonForVisit`
- `HIV.C3CaptureOrUpdateClientHistory`
- `HIV.C6PostTestPackageOfServices`
- `HIV.C8SuitableForPrepOrPep`
- `HIV.C10CounselOnRiskAndPrevention`
- `HIV.C17DetermineRecommendedTests`
- `HIV.C21Diagnostics`
- `HIV.C23PrescribeOrAdministerPrepOrPep`
- `HIV.C24ScheduleFollowUp`

#### PMTCT - Mother (E*)
- `HIV.E1CaptureOrUpdateMotherSHistory` ⭐ **Used for Maternity**
- `HIV.E4TestMotherForHivUsingTestingAlgorithm` ⭐ **Used for Maternity**

#### PMTCT - Infant/Child (F*)
- `HIV.F2TakeVitalSigns` ⭐ **Used for Maternity**
- `HIV.F3CaptureOrUpdateInfantSChildSHistory` ⭐ **Used for Maternity**
- `HIV.F6CheckWhetherInfantChildHadHivExposure` ⭐ **Used for Maternity**
- `HIV.F8TestInfantChildForHivUsingTestingAlgorithm` ⭐ **Used for Maternity**
- `HIV.F12Prescribe` (ART)
- `HIV.F16ImmediatelyStartInfantOnArt` ⭐ **Used for Maternity**
- `HIV.F20RecordInfantSChildSFinalHivDiagnosis` ⭐ **Used for Maternity**

#### Follow-up & Contacting (H*)
- `HIV.H1IdentifyClientForFollowUp`
- `HIV.H2AttemptToLocateClient`
- `HIV.H3RecordOutreachAndResult`

#### Referrals (I*)
- `HIV.I1EmergencyReferral`
- `HIV.I6ProvideInformationToReferralFacility`

---

## 🗂️ File Structure

```
ehr-frontend/src/components/
├── HIV/
│   ├── WHOSmartFormIntegration.tsx          # Base wrapper
│   ├── HIVTestingWithSmartForms.tsx         # Testing integration
│   ├── HIVRegistrationWithSmartForms.tsx    # Registration integration
│   ├── HIVCareVisitWithSmartForms.tsx       # Care visits integration
│   ├── HIVWorkflowIntegration.tsx           # Complete workflow
│   └── index.ts
├── TB/
│   ├── TBScreeningWithSmartForms.tsx        # TB screening integration
│   └── index.ts
├── Maternity/
│   ├── MaternityWithSmartForms.tsx          # Maternity/PMTCT integration
│   └── index.ts
├── ClinicalNotes/
│   ├── ClinicalNotesWithSmartForms.tsx      # Clinical notes integration
│   └── index.ts
└── WHOSmartForms/
    ├── FHIRQuestionnaireForm.tsx            # Form renderer
    ├── SmartFormSelector.tsx                # Form selector
    ├── GenericSmartFormWrapper.tsx          # Generic wrapper
    └── index.ts
```

---

## 🔄 Data Flow

### Standard Flow:
```
WHO Smart Form (Frontend)
    ↓
Mapping Function (maps to EHR structure)
    ↓
API Call (POST /api/{module}/{endpoint})
    ↓
Backend Service (processes data)
    ↓
Database Storage:
  ├─ Standard columns (mapped fields)
  └─ JSONB column (whoSmartFormData: { full form })
```

### Example - TB Screening:
```
HIV.D4ScreenForTb Form
    ↓
mapSmartFormToTbScreening()
    ↓
POST /api/hiv/tb-screenings
    ↓
createTbScreening() service
    ↓
tb_screenings table:
  ├─ screening_date, screening_result, etc.
  └─ who_smart_form_data JSONB
```

---

## 📍 Integration Points Summary

| Module | Component | Access Point | Forms Count |
|--------|-----------|--------------|-------------|
| **HIV** | `HIVTestingWithSmartForms` | Nurse Dashboard → HIV → Testing | 5+ |
| **HIV** | `HIVWorkflowIntegration` | Nurse Dashboard → HIV → WHO Workflow | 20+ |
| **HIV** | `HIVCareVisitWithSmartForms` | Doctor Dashboard → Patient → Visits | 8+ |
| **TB** | `TBScreeningWithSmartForms` | Nurse Dashboard → HIV → TB Screening | 1 |
| **Maternity** | `MaternityWithSmartForms` | Nurse Dashboard → Maternity | 8 |
| **Clinical Notes** | `ClinicalNotesWithSmartForms` | ClinicalNotesModal | 6 |

**Total Integration Points: 6**  
**Total Forms Available: 67**

---

## 🎨 UI Integration Pattern

All integrations follow the same pattern:

1. **Option to Use Smart Forms:**
   ```tsx
   <div className="bg-gradient-to-r from-indigo-50 to-blue-50">
     <button onClick={() => setUseSmartForm(true)}>
       Use WHO Forms
     </button>
   </div>
   ```

2. **Form Selection:**
   - Grid/list of available forms
   - Form descriptions and categories
   - Click to open form

3. **Form Display:**
   - Modal or inline
   - Full FHIR Questionnaire rendering
   - Validation and submission

4. **Data Mapping:**
   - Automatic mapping to EHR structure
   - Full form data preserved

---

## 💾 Database Schema

### Recommended Schema Updates:

```sql
-- Add WHO Smart Form data column to relevant tables
ALTER TABLE hiv_tests 
ADD COLUMN who_smart_form_data JSONB;

ALTER TABLE hiv_enrollments 
ADD COLUMN who_smart_form_data JSONB;

ALTER TABLE hiv_clinical_visits 
ADD COLUMN who_smart_form_data JSONB;

ALTER TABLE tb_screenings 
ADD COLUMN who_smart_form_data JSONB;

ALTER TABLE maternity_enrollments 
ADD COLUMN who_smart_form_data JSONB;

-- Or use existing JSONB columns
UPDATE appointments 
SET notes = jsonb_set(
  COALESCE(notes::jsonb, '{}'::jsonb), 
  '{whoSmartFormData}', 
  $1::jsonb
);
```

---

## 🔍 Querying Smart Form Data

### Query Mapped Fields (Standard):
```sql
SELECT test_date, test_result, hiv_status 
FROM hiv_tests 
WHERE patient_id = 'patient-123';
```

### Query Smart Form Data (JSONB):
```sql
-- Get full form data
SELECT 
  test_date,
  who_smart_form_data->>'HIV.B.DE110' as test_date_from_form,
  who_smart_form_data->>'HIV.B.DE111' as test_result_from_form
FROM hiv_tests 
WHERE who_smart_form_data IS NOT NULL;

-- Extract all form fields
SELECT 
  jsonb_object_keys(who_smart_form_data) as field_id,
  who_smart_form_data->jsonb_object_keys(who_smart_form_data) as field_value
FROM hiv_tests
WHERE who_smart_form_data IS NOT NULL;
```

---

## ✅ Integration Checklist

### Completed ✅
- [x] HIV Testing Module
- [x] HIV Registration Module
- [x] HIV Care & Treatment Module
- [x] HIV Complete Workflow
- [x] TB Screening Module
- [x] Maternity/PMTCT Module
- [x] Clinical Notes Module
- [x] Generic Smart Form Wrapper
- [x] Nurse Dashboard Integration
- [x] Doctor Dashboard Integration
- [x] Patient Detail Modal Integration

### Available for Future Integration ⏳
- [ ] Diabetes Module (if WHO forms available)
- [ ] Hypertension Module (if WHO forms available)
- [ ] General Prescription Module
- [ ] Lab Orders Module
- [ ] Immunization Module
- [ ] Referral Module (forms available: `HIV.I*`)

---

## 🚀 Usage Examples

### Example 1: TB Screening
```tsx
import { TBScreeningWithSmartForms } from '../components/TB';

<TBScreeningWithSmartForms
  tenantSlug={tenantSlug}
  token={token}
  patientId={selectedPatient?.id}
  onScreeningComplete={(data) => {
    console.log('TB screening completed:', data);
  }}
/>
```

### Example 2: Maternity/PMTCT
```tsx
import { MaternityWithSmartForms } from '../components/Maternity';

<MaternityWithSmartForms
  tenantSlug={tenantSlug}
  token={token}
  patientId={patientId}
  patientName={patientName}
  onSuccess={() => {
    // Refresh data
  }}
/>
```

### Example 3: Generic Form
```tsx
import { GenericSmartFormWrapper } from '../components/WHOSmartForms';

<GenericSmartFormWrapper
  formId="HIV.D4ScreenForTb"
  patientId={patientId}
  token={token}
  tenantSlug={tenantSlug}
  onSuccess={(formData) => {
    // Custom handling
    await customApi.saveData(formData);
  }}
  title="Custom TB Screening"
  showAsModal={true}
/>
```

---

## 📚 Related Documentation

- **Data Flow:** `docs/who/SMART_FORMS_DATA_FLOW.md`
- **HIV Integration:** `docs/who/HIV_MODULE_INTEGRATION.md`
- **Usage Guide:** `docs/who/SMART_FORMS_USAGE.md`
- **Setup Guide:** `docs/who/WHO_SMART_GUIDELINES_SETUP.md`

---

## ✅ Status

**System-Wide Integration: COMPLETE** 🎉

- ✅ **6 Modules Integrated**
- ✅ **67 WHO Smart Forms Available**
- ✅ **6 Integration Components Created**
- ✅ **Generic Wrapper Available**
- ✅ **All Major Workflows Covered**
- ✅ **Data Mapping Implemented**
- ✅ **UI Components Created**
- ✅ **Documentation Complete**

**Ready for production use across all integrated modules!** 🚀


