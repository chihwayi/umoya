# WHO Smart Forms Availability by Module

## Current Status

**Important**: We currently have **56 WHO Smart Forms**, all from the **WHO Smart Guidelines for HIV**. However, many of these forms are general enough to be used across different clinical specialties.

---

## Forms Available

### ✅ **HIV Module** - Full Coverage
**Forms Available**: All 56 forms
- Testing: `HIV.B7TestForHivUsingTestingAlgorithm`, `HIV.B1DetermineReasonForVisit`
- Registration: `HIV.A2GatherClientDetails`, `HIV.A5CreateNewClientRecord`
- Care & Treatment: `HIV.D2TakeVitalSigns`, `HIV.D15DetermineClinicalStageOfHiv`, `HIV.D23Prescribe`
- History: `HIV.D1DetermineReasonForVisit`, `HIV.D8CaptureOrUpdateClientHistory`
- And 40+ more HIV-specific forms

**Access**: HIV Doctor Dashboard, Nurse Dashboard HIV Section

---

### ✅ **Maternity/PMTCT Module** - Full Coverage
**Forms Available**: 8 maternity-specific forms
- `HIV.E1CaptureOrUpdateMotherSHistory` - Maternal history
- `HIV.E4TestMotherForHivUsingTestingAlgorithm` - Mother HIV testing
- `HIV.F2TakeVitalSigns` - Vital signs for mother/infant
- `HIV.F3CaptureOrUpdateInfantSChildSHistory` - Infant history
- `HIV.F6CheckWhetherInfantChildHadHivExposure` - Exposure check
- `HIV.F8TestInfantChildForHivUsingTestingAlgorithm` - Infant testing
- `HIV.F16ImmediatelyStartInfantOnArt` - ART initiation
- `HIV.F20RecordInfantSChildSFinalHivDiagnosis` - Final diagnosis

**Plus General Clinical Forms**:
- `HIV.D2TakeVitalSigns` - Universal vital signs
- `HIV.D20Diagnostics` - Lab orders and diagnostics
- `HIV.D23Prescribe` - Prescriptions
- `HIV.D29ScheduleFollowUp` - Follow-up scheduling

**Access**: Maternity Doctor Dashboard (filtered to maternity + clinical forms)

---

### ⚠️ **Diabetes Module** - General Clinical Forms Only
**Forms Available**: General clinical forms (not diabetes-specific)

**Why?** WHO has not yet released Smart Guidelines specifically for diabetes. However, we can use general clinical forms:

- `HIV.D14PreventScreenAndManageComorbiditiesAndCoinfections` - **Perfect for diabetes!**
  - Screens for comorbidities (diabetes, hypertension, etc.)
  - Manages existing comorbidities
  - Can be used for diabetes care planning

- `HIV.D16PerformOtherScreenings` - General health screenings
- `HIV.D20Diagnostics` - Lab orders (HbA1c, glucose, etc.)
- `HIV.D21DetermineRegimenAndTreatmentOptions` - Treatment planning
- `HIV.D23Prescribe` - Medication prescriptions
- `HIV.D24Counsel` - Patient counseling
- `HIV.D29ScheduleFollowUp` - Follow-up appointments
- `HIV.D1DetermineReasonForVisit` - Visit documentation
- `HIV.D8CaptureOrUpdateClientHistory` - History taking
- `HIV.D2TakeVitalSigns` - Vital signs monitoring

**Access**: Diabetes Management Dashboard (filtered to clinical forms)

**Note**: While these forms have "HIV" in their ID, `D14` specifically covers comorbidities including diabetes, making it highly relevant for diabetes care.

---

### ⚠️ **Cardiology Module** - General Clinical Forms Only
**Forms Available**: General clinical forms

- `HIV.D14PreventScreenAndManageComorbiditiesAndCoinfections` - Cardiovascular risk factors
- `HIV.D16PerformOtherScreenings` - Cardiac screenings
- `HIV.D20Diagnostics` - ECG, echo, lab orders
- `HIV.D21DetermineRegimenAndTreatmentOptions` - Treatment planning
- `HIV.D23Prescribe` - Cardiac medications
- `HIV.D24Counsel` - Lifestyle counseling
- `HIV.D1DetermineReasonForVisit` - Visit documentation
- `HIV.D2TakeVitalSigns` - BP, heart rate monitoring
- `HIV.D8CaptureOrUpdateClientHistory` - Cardiac history

**Access**: Cardiology Dashboard (filtered to clinical forms)

---

### ⚠️ **Oncology Module** - General Clinical Forms Only
**Forms Available**: General clinical forms

- `HIV.D20Diagnostics` - Lab orders, imaging, biopsies
- `HIV.D21DetermineRegimenAndTreatmentOptions` - Treatment planning
- `HIV.D23Prescribe` - Chemotherapy, supportive care
- `HIV.D24Counsel` - Patient counseling
- `HIV.D29ScheduleFollowUp` - Follow-up scheduling
- `HIV.D1DetermineReasonForVisit` - Visit documentation
- `HIV.D2TakeVitalSigns` - Vital signs monitoring
- `HIV.D8CaptureOrUpdateClientHistory` - History taking

**Access**: Oncology Dashboard (filtered to clinical forms)

---

### ⚠️ **Ophthalmology Module** - General Clinical Forms Only
**Forms Available**: General clinical forms

- `HIV.D16PerformOtherScreenings` - Eye screenings
- `HIV.D20Diagnostics` - Eye exams, imaging
- `HIV.D23Prescribe` - Eye medications
- `HIV.D24Counsel` - Patient education
- `HIV.D1DetermineReasonForVisit` - Visit documentation
- `HIV.D2TakeVitalSigns` - Vital signs
- `HIV.D8CaptureOrUpdateClientHistory` - History taking

**Access**: Ophthalmology Dashboard (filtered to clinical forms)

---

### ✅ **TB Module** - Specific Form Available
**Forms Available**: 
- `HIV.D4ScreenForTb` - WHO-recommended TB screening questionnaire

**Plus General Clinical Forms**:
- `HIV.D20Diagnostics` - TB diagnostics (sputum, X-ray, etc.)
- `HIV.D23Prescribe` - TB medications
- `HIV.D29ScheduleFollowUp` - Follow-up scheduling

**Access**: Nurse Dashboard TB Screening Tab

---

### ✅ **Clinical Notes (General)** - Full Coverage
**Forms Available**: All general clinical documentation forms

- `HIV.D1DetermineReasonForVisit` - Chief complaint
- `HIV.D8CaptureOrUpdateClientHistory` - History of present illness
- `HIV.C1DetermineReasonForVisit` - Care visit reason
- `HIV.C3CaptureOrUpdateClientHistory` - Care history
- `HIV.B1DetermineReasonForVisit` - Testing visit reason
- `HIV.B6CaptureOrUpdateClientHistory` - Testing history

**Access**: Clinical Notes Modal → "Use WHO Forms" button

---

## Form Categories Explained

### Universal Forms (All Modules)
These forms can be used across **all specialties**:

- **D2**: `TakeVitalSigns` - Universal vital signs (BP, HR, temp, etc.)
- **D20**: `Diagnostics` - Lab orders, imaging (universal)
- **D23**: `Prescribe` - Medication prescriptions (universal)
- **D24**: `Counsel` - Patient counseling (universal)
- **D29**: `ScheduleFollowUp` - Follow-up scheduling (universal)

### Specialty-Specific Forms

- **HIV**: All 56 forms (full coverage)
- **Maternity**: E* and F* series (8 forms)
- **TB**: D4 (1 specific form)
- **Diabetes/Cardiology/Oncology/Ophthalmology**: D14, D16, D20, D21, D23, D24, D29 (general clinical forms)

---

## Future Enhancements

### When WHO Releases Additional Smart Guidelines:

1. **Diabetes Smart Guidelines** (if/when released)
   - Clone from WHO GitHub repository
   - Extract forms using same process
   - Add to `who-smart-guidelines/` directory
   - Forms will automatically appear in Diabetes Dashboard

2. **Cardiology Smart Guidelines** (if/when released)
   - Same process as above

3. **Other Condition-Specific Guidelines**
   - Same process applies

### Current Workaround:

For modules without specific WHO Smart Guidelines:
- Use general clinical forms (D14, D16, D20, D21, D23, D24, D29)
- These forms are structured and evidence-based
- They capture structured data that can be mapped to specialty-specific workflows
- Full form data is preserved in `whoSmartFormData` JSONB field for future use

---

## Summary Table

| Module | Specific Forms | General Forms | Total Available |
|--------|---------------|---------------|-----------------|
| HIV | 56 forms | All | 56 |
| Maternity | 8 forms (E*, F*) | + General clinical | ~15 |
| TB | 1 form (D4) | + General clinical | ~10 |
| Diabetes | 0 (none yet) | General clinical | ~10 |
| Cardiology | 0 (none yet) | General clinical | ~10 |
| Oncology | 0 (none yet) | General clinical | ~10 |
| Ophthalmology | 0 (none yet) | General clinical | ~10 |
| Clinical Notes | 0 (none yet) | General clinical | ~6 |

**Note**: "General clinical" forms are shared across all modules and are highly useful for structured documentation.

---

## Recommendations

1. **For Diabetes Module**: 
   - Use `HIV.D14PreventScreenAndManageComorbiditiesAndCoinfections` as primary form
   - Supplement with D20 (diagnostics), D23 (prescriptions), D29 (follow-up)

2. **For All Modules**:
   - Use D2 (vital signs) for all patient encounters
   - Use D20 (diagnostics) for lab/imaging orders
   - Use D23 (prescriptions) for medications
   - Use D29 (follow-up) for scheduling

3. **When WHO Releases New Guidelines**:
   - Follow the same cloning/extraction process
   - Forms will automatically integrate into the system

---

## Related Documentation

- [Universal Smart Forms Integration](./UNIVERSAL_SMART_FORMS_INTEGRATION.md)
- [Complete System Integration](./COMPLETE_SYSTEM_INTEGRATION.md)
- [Smart Forms Usage Guide](./SMART_FORMS_USAGE.md)


