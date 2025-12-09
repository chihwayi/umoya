# SNOMED CT and ICD-10 Code Recommendations for Clinical Documentation

## Overview
This document addresses the question: **"Do we need to add SNOMED/ICD-10 codes on doctor clinical notes when recording diagnosis (both EHR and App)?"**

## Current Implementation Status

### ✅ **Prescriptions** - Already Implemented
- **Backend**: The prescription service (`services/ehr-service/src/services/prescription.service.ts`) already supports SNOMED codes for medications
- **Fields**: `medication_name_snomed_code`, `medication_name_snomed_term`, `medication_name_snomed_module_id`
- **Mobile App**: The new prescription creation screen now includes drug search that can capture SNOMED codes from the drug database

### ⚠️ **Clinical Notes (Diagnosis)** - Not Yet Implemented
- **Current State**: The mobile app's `ClinicalNotesScreen.tsx` only captures free-text diagnosis in the "Clinical Assessment / Diagnosis" field
- **EHR Frontend**: The web EHR frontend (`ehr-frontend/src/components/AppointmentNotes.tsx`) has SNOMED picker functionality and ICD-10 support for diagnosis

## Recommendations

### **YES - SNOMED/ICD-10 codes SHOULD be added for diagnosis**

#### **Why SNOMED CT for Diagnosis?**
1. **Clinical Interoperability**: SNOMED CT is the international standard for clinical terminology
2. **Semantic Precision**: Ensures consistent meaning across different systems and languages
3. **Clinical Decision Support**: Enables better CDSS integration (your system already has CDSS)
4. **Analytics & Reporting**: Structured codes enable better population health analytics
5. **Regulatory Compliance**: Many health systems require standardized coding

#### **Why ICD-10 for Diagnosis?**
1. **Billing & Reimbursement**: Required for insurance claims and billing
2. **Regulatory Requirements**: Many countries mandate ICD-10 for diagnosis reporting
3. **Epidemiology**: Essential for public health reporting and disease surveillance
4. **International Standard**: Widely recognized billing and classification system

### **Implementation Approach**

#### **Option 1: Dual Coding (Recommended)**
- **SNOMED CT**: For clinical meaning and interoperability
- **ICD-10**: For billing and regulatory compliance
- **Both codes**: Stored together with the diagnosis text

#### **Option 2: SNOMED CT Only**
- If billing is handled separately
- Better for clinical decision support
- More flexible for international use

#### **Option 3: ICD-10 Only**
- If billing is the primary concern
- Less flexible for clinical use
- May limit interoperability

## Proposed Implementation

### **Mobile App Changes Needed**

1. **Update `ClinicalNotesScreen.tsx`**:
   - Add diagnosis code search/picker (similar to drug search)
   - Support both SNOMED CT and ICD-10
   - Display selected codes alongside diagnosis text
   - Allow manual code entry if needed

2. **Backend Schema** (if not already present):
   ```sql
   -- In appointments table or clinical_notes table
   diagnosis_snomed_code VARCHAR(50),
   diagnosis_snomed_term VARCHAR(500),
   diagnosis_icd10_code VARCHAR(20),
   diagnosis_icd10_description VARCHAR(500),
   ```

3. **Service Integration**:
   - Create or use existing SNOMED/ICD-10 lookup service
   - Integrate with CDSS for diagnosis suggestions (already exists)
   - Store codes when saving clinical notes

### **Benefits of Implementation**

1. **Better Clinical Decision Support**: Your existing CDSS can use structured codes for better recommendations
2. **Billing Integration**: Easier to generate claims with ICD-10 codes
3. **Analytics**: Better reporting on diagnosis patterns
4. **Interoperability**: Easier data exchange with other systems
5. **Compliance**: Meets international healthcare standards

## Next Steps

1. ✅ **Prescription SNOMED codes** - Already implemented
2. 🔄 **Clinical Notes SNOMED/ICD-10** - Needs implementation
3. 🔄 **Diagnosis code picker UI** - Needs to be added to mobile app
4. 🔄 **Backend API** - Verify/update to support diagnosis codes
5. 🔄 **Integration with CDSS** - Leverage existing diagnostic assistant

## Conclusion

**Recommendation**: **YES, implement SNOMED CT and ICD-10 codes for diagnosis in clinical notes.**

This aligns with:
- International healthcare standards
- Your existing CDSS infrastructure
- Billing and regulatory requirements
- Better clinical decision support
- Improved interoperability

The implementation should follow the pattern already established for prescriptions (drug search with SNOMED codes) and can leverage the existing CDSS diagnostic assistant service.
