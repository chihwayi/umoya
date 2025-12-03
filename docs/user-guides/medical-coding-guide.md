# Medical Coding Guide - SNOMED/ICD-10/CPT/CVX

**Purpose**: Understanding why medical coding is critical for EHR systems  
**Implementation**: Integrated into all Tier 1 workflows

---

## 📋 **OVERVIEW**

Medical coding converts clinical information into standardized codes for:
- Insurance billing and reimbursement
- Public health reporting
- Clinical decision support
- Quality measurement
- Research and analytics

---

## 🏥 **CODING SYSTEMS WE USE**

### **1. ICD-10** (International Classification of Diseases)
**Purpose**: Diagnosis coding for billing and mortality statistics  
**Maintained by**: WHO  
**Used for**: Insurance claims, mortality reporting, epidemiology

**Examples**:
```
A09      - Gastroenteritis (infectious)
K35.80   - Acute appendicitis
I21.9    - Acute myocardial infarction
E11.9    - Type 2 diabetes
J18.9    - Pneumonia
```

**Where We Use It**:
- ✅ Discharge diagnoses
- ✅ Admission diagnoses
- ✅ Problem lists
- ✅ Encounter diagnoses
- ✅ ED visit diagnoses

---

### **2. CPT** (Current Procedural Terminology)
**Purpose**: Procedure and service coding for billing  
**Maintained by**: American Medical Association (AMA)  
**Used for**: Procedure billing, physician services

**Examples**:
```
99213    - Office visit, established patient
44950    - Appendectomy
27447    - Total knee arthroplasty
33533    - Coronary artery bypass
10060    - Incision and drainage of abscess
```

**Where We Use It**:
- ✅ Surgical consents
- ✅ Procedure consents
- ✅ Billing invoices
- ✅ Claims submission

---

### **3. SNOMED CT** (Systematized Nomenclature of Medicine - Clinical Terms)
**Purpose**: Comprehensive clinical terminology  
**Maintained by**: SNOMED International  
**Used for**: Clinical documentation, EHR interoperability, CDSS

**Examples**:
```
25374005  - Gastroenteritis
80146002  - Appendectomy
22298006  - Myocardial infarction
73211009  - Diabetes mellitus
233604007 - Pneumonia
```

**Where We Use It**:
- ✅ All clinical documentation
- ✅ Problem lists
- ✅ Procedure documentation
- ✅ Discharge summaries
- ✅ Clinical pathways
- ✅ CDSS rules

---

### **4. CVX** (CDC Vaccine Codes)
**Purpose**: Vaccine identification for immunization tracking  
**Maintained by**: CDC  
**Used for**: Immunization registries, public health reporting

**Examples**:
```
213  - COVID-19 vaccine
141  - Influenza vaccine, seasonal
133  - Pneumococcal conjugate PCV 13
83   - Hepatitis A vaccine
08   - Hepatitis B vaccine, pediatric or pediatric/adolescent
165  - HPV9 (9-valent HPV vaccine)
03   - MMR (measles, mumps, rubella)
115  - Tdap (tetanus, diphtheria, acellular pertussis)
21   - Varicella (chickenpox) vaccine
```

**Where We Use It**:
- ✅ Immunization records
- ✅ Vaccine inventory
- ✅ Public health reporting
- ✅ Immunization registry integration

---

### **5. LOINC** (Logical Observation Identifiers Names and Codes)
**Purpose**: Lab test and observation coding  
**Maintained by**: Regenstrief Institute  
**Used for**: Lab results, vital signs, clinical observations

**Examples**:
```
2160-0   - Serum creatinine
718-7    - Hemoglobin
2345-7   - Glucose
2951-2   - Sodium
8480-6   - Systolic blood pressure
```

**Where We Use It**:
- ✅ Lab test catalog
- ✅ Lab results
- ✅ Vital signs
- ✅ Observations

---

### **6. RxNorm**
**Purpose**: Medication coding  
**Maintained by**: NLM (National Library of Medicine)  
**Used for**: Prescription drugs, medication orders

**Examples**:
```
1049502  - Amoxicillin 500 MG Oral Capsule
310964   - Lisinopril 10 MG Oral Tablet
106500   - Metformin 500 MG Oral Tablet
```

**Where We Use It**:
- ✅ Prescriptions
- ✅ Medication orders
- ✅ Drug-drug interaction checking
- ✅ Formulary management

---

### **7. DRG** (Diagnosis Related Groups)
**Purpose**: Hospital billing and reimbursement  
**Maintained by**: CMS  
**Used for**: Inpatient hospital billing, Medicare reimbursement

**Examples**:
```
470  - Major joint replacement
194  - Simple pneumonia
292  - Heart failure & shock
291  - Heart failure & shock with MCC
```

**Where We Use It**:
- ✅ Admission billing
- ✅ Discharge summaries
- ✅ Hospital reimbursement
- ✅ Case mix index

---

## 🔧 **WHERE CODING IS USED IN MEDICORE**

### **Discharge Workflow** ✅
```
Input Fields:
- Discharge Diagnosis (text)
- ICD-10 Code (e.g., A09)
- SNOMED CT Code (e.g., 25374005)

Why Both Codes:
- ICD-10 → Required for insurance billing
- SNOMED CT → Required for clinical documentation & CDSS

Database:
- discharges.discharge_diagnosis_icd10
- discharges.discharge_diagnosis_snomed
```

### **Vaccine Administration** ✅
```
Input Fields:
- Vaccine Name (e.g., COVID-19 Vaccine)
- CVX Code (e.g., 213) - Auto-filled

Why CVX:
- Required for CDC immunization registry reporting
- Enables vaccine inventory tracking
- Supports public health surveillance

Database:
- immunizations.vaccine_code (stores CVX)
```

### **Surgical/Procedure Consents** ✅
```
Input Fields (shown only for surgery/procedure types):
- CPT Code (e.g., 44950 - Appendectomy)
- SNOMED CT Code (e.g., 80146002)
- Diagnosis ICD-10 (e.g., K35.80 - Appendicitis)
- Diagnosis SNOMED CT (e.g., 74400008)

Why All Four:
- CPT → Required for procedure billing
- ICD-10 → Required for diagnosis billing
- SNOMED CT → Clinical documentation & interoperability

Database:
- patient_consents.procedure_cpt_code
- patient_consents.procedure_snomed_code
- patient_consents.diagnosis_icd10
- patient_consents.diagnosis_snomed
```

### **Admissions** ✅
```
Database Fields Available:
- admissions.admitting_diagnosis_icd10
- admissions.admitting_diagnosis_snomed
- admissions.primary_diagnosis (text)

Used For:
- DRG calculation
- Case mix index
- Hospital billing
```

### **ED Visits** ✅
```
Database Fields Available:
- ed_visits.chief_complaint_snomed
- ed_visits.chief_complaint_icd10
- ed_dispositions.discharge_diagnosis_icd10
- ed_dispositions.discharge_diagnosis_snomed

Used For:
- ED billing (higher rates for specific diagnoses)
- Public health surveillance
- Quality measures
```

---

## 💰 **WHY THIS MATTERS FOR BILLING**

### **Insurance Claims Require**:
```
1. ICD-10 diagnosis code (what's wrong)
2. CPT procedure code (what you did)
3. Correct pairing (medical necessity)

Without Proper Codes:
❌ Claims rejected
❌ No reimbursement
❌ Revenue loss
❌ Compliance issues
```

### **Example: Appendectomy Claim**
```
✅ CORRECT:
Diagnosis: K35.80 (Acute appendicitis)
Procedure: 44950 (Appendectomy)
Result: Claim approved, $15,000 reimbursement

❌ INCORRECT:
Diagnosis: Missing
Procedure: 44950 (Appendectomy)
Result: Claim denied - "Medical necessity not established"
```

---

## 📊 **PUBLIC HEALTH REPORTING**

### **CDC Immunization Registry**:
```
Requires:
- CVX code (vaccine type)
- NDC code (specific product)
- Lot number
- Administration date

Without CVX:
❌ Can't report to state immunization registry
❌ Miss public health alerts
❌ Can't track vaccination rates
```

### **Disease Surveillance**:
```
Using ICD-10/SNOMED:
- Track disease outbreaks
- Monitor chronic disease trends
- Support epidemiological research
- Enable population health management
```

---

## 🧠 **CLINICAL DECISION SUPPORT**

### **SNOMED CT Enables**:
```
✅ Drug-allergy checking
   - Patient allergic to Penicillin (SNOMED: 7980000)
   - System alerts if prescribing Amoxicillin (SNOMED: 372687004)

✅ Contraindication alerts
   - Patient has Pregnancy (SNOMED: 77386006)
   - System blocks Methotrexate (SNOMED: 387381009)

✅ Clinical pathway matching
   - Diagnosis: Sepsis (SNOMED: 91302008)
   - System suggests "Sepsis Management Pathway"

✅ Drug-drug interaction
   - Patient on Warfarin (RxNorm: 11289)
   - Alert if prescribing Aspirin (RxNorm: 1191)
```

---

## 📈 **QUALITY MEASURES & REPORTING**

### **CMS Quality Measures**:
```
Example: Diabetes HbA1c Testing
- Requires: E11.9 (Type 2 diabetes)
- Requires: LOINC 4548-4 (HbA1c test)
- Result: Quality measure calculated

Without Codes:
❌ Can't calculate quality measures
❌ Miss value-based payments
❌ No quality improvement data
```

### **Hospital Compare**:
```
Publicly Reported Measures:
- 30-day readmission rates
- Mortality rates by condition
- Patient safety indicators

All Require:
- Accurate ICD-10 diagnosis codes
- Accurate ICD-10 procedure codes
- Proper DRG assignment
```

---

## 🌐 **INTEROPERABILITY**

### **FHIR Resources Require**:
```
Condition Resource:
- code: SNOMED CT (required)
- code: ICD-10 (optional but recommended)

Procedure Resource:
- code: SNOMED CT (required)
- code: CPT (for billing)

Immunization Resource:
- vaccineCode: CVX (required)
- lotNumber: (required)
```

### **Without Proper Codes**:
```
❌ Can't share data with other hospitals
❌ Can't participate in HIE (Health Information Exchange)
❌ Can't send referrals electronically
❌ Can't receive lab results via HL7
```

---

## ✅ **IMPLEMENTATION IN MEDICORE**

### **Database Schema** (Migration 008):
```
✅ 50+ SNOMED CT fields added
✅ 25+ ICD-10 fields added
✅ 15+ CPT fields added
✅ 10+ LOINC fields added
✅ 8+ RxNorm fields added
✅ 5+ CVX fields added
✅ 3+ DRG fields added
```

### **User Interface**:
```
✅ Discharge form: ICD-10 + SNOMED CT
✅ Vaccine form: CVX code (auto-filled)
✅ Consent form: CPT + SNOMED CT + ICD-10
✅ Helper text explaining each code type
✅ Educational tooltips
```

### **Indexing**:
```
✅ All code fields indexed for fast lookup
✅ Enables efficient reporting
✅ Supports real-time CDSS
```

---

## 📚 **CODING BEST PRACTICES**

### **For Doctors**:
```
1. Always code discharge diagnoses (ICD-10 + SNOMED CT)
2. Include procedure codes for surgeries (CPT)
3. Use specific codes (not "unspecified")
4. Document medical necessity
```

### **For Nurses**:
```
1. Use correct CVX codes for vaccines
2. Record lot numbers (for recalls)
3. Report adverse events
4. Update immunization registry
```

### **For Billers**:
```
1. Verify ICD-10/CPT pairing (medical necessity)
2. Check for more specific codes
3. Use primary/secondary diagnoses correctly
4. Follow CMS billing guidelines
```

---

## 🎯 **QUICK REFERENCE**

### **When Discharging Patient**:
```
Required:
✅ Discharge diagnosis (text)
✅ ICD-10 code (for billing)
Recommended:
✅ SNOMED CT code (for CDSS & interoperability)
```

### **When Recording Vaccine**:
```
Required:
✅ Vaccine name
✅ CVX code (auto-filled from selection)
✅ Administration date
✅ Site
```

### **When Getting Surgical Consent**:
```
Required:
✅ Procedure name
Recommended:
✅ CPT code (for billing forecast)
✅ SNOMED CT code (for procedure)
✅ ICD-10 code (for diagnosis)
```

---

## 📊 **BUSINESS VALUE**

### **Financial Impact**:
```
With Proper Coding:
✅ 95%+ claim acceptance rate
✅ Faster reimbursement (7-14 days)
✅ Higher reimbursement rates
✅ Reduced claim denials

Without Proper Coding:
❌ 40-60% claim rejection rate
❌ Delayed payments (45-90 days)
❌ Revenue loss (15-25%)
❌ Compliance penalties
```

### **Quality & Accreditation**:
```
With Proper Coding:
✅ Accurate quality measure calculation
✅ Better Star Ratings
✅ Value-based payment bonuses
✅ Accreditation compliance

Without Proper Coding:
❌ Inaccurate quality scores
❌ Lower Star Ratings
❌ Miss bonus payments
❌ Accreditation issues
```

---

## 🔍 **COMMON CODING SCENARIOS**

### **Scenario 1: Diabetic Patient with Foot Ulcer**
```
Discharge Coding:
- Primary Diagnosis: E11.621 (Type 2 diabetes with foot ulcer)
- Secondary Diagnosis: L97.519 (Non-pressure chronic ulcer)
- SNOMED CT: 421326000 (Diabetic foot ulcer)

Result:
✅ Higher DRG reimbursement
✅ Triggers diabetic foot care pathway
✅ Enables quality measure tracking
```

### **Scenario 2: Pneumonia Admission**
```
Admission Coding:
- Admitting Diagnosis: J18.9 (Pneumonia, unspecified)
- SNOMED CT: 233604007 (Pneumonia)
- DRG: 193 (Simple pneumonia)

Result:
✅ DRG-based payment: $5,500
✅ Expected LOS: 3-5 days
✅ Quality measure tracking
```

### **Scenario 3: COVID-19 Vaccination**
```
Immunization Coding:
- Vaccine: COVID-19 Vaccine (Pfizer)
- CVX Code: 213
- NDC: 59267-1000-01
- Lot Number: EL1234

Result:
✅ Reported to state registry
✅ Patient gets QR code certificate
✅ Supports booster recommendations
```

---

## ⚠️ **REGULATORY REQUIREMENTS**

### **HIPAA Transactions (837/835)**:
```
Required Codes:
- ICD-10 diagnosis (all claims)
- CPT procedure (professional claims)
- HCPCS (supplies/DME)

Without These:
❌ Claims transmission fails
❌ HIPAA non-compliance
❌ Payer rejection
```

### **Meaningful Use / Promoting Interoperability**:
```
Required:
- SNOMED CT for problems
- RxNorm for medications
- LOINC for lab results
- CVX for vaccines

Without These:
❌ Fail Meaningful Use attestation
❌ Lose incentive payments
❌ Penalties applied
```

---

## 💡 **TIPS FOR ACCURATE CODING**

### **Use Code Lookup Tools**:
```
ICD-10: https://www.icd10data.com
CPT: AMA CPT code search
SNOMED CT: SNOMED Browser
CVX: CDC vaccine codes table
```

### **Document Specificity**:
```
❌ BAD: J18.9 (Pneumonia, unspecified)
✅ GOOD: J18.1 (Lobar pneumonia)

Why: More specific codes = higher reimbursement
```

### **Code to Highest Specificity**:
```
Example: Diabetes
❌ E11.9 (Type 2 diabetes without complications) - $2,500 DRG
✅ E11.65 (Type 2 diabetes with hyperglycemia) - $3,800 DRG

Difference: $1,300 per admission!
```

---

## 📋 **CODING WORKFLOW IN MEDICORE**

### **1. Admission**:
```
Nurse admits patient
↓
Doctor enters admitting diagnosis
↓
System prompts for:
- ICD-10 code
- SNOMED CT code
↓
Codes saved to admissions table
↓
DRG calculated (if applicable)
```

### **2. During Stay**:
```
Nurses record vitals
↓
Doctors order treatments
↓
All orders include relevant codes
↓
Enables real-time clinical decision support
```

### **3. Discharge**:
```
Doctor completes discharge form
↓
System requires:
- Discharge diagnosis (text)
- ICD-10 code
- SNOMED CT code (recommended)
↓
Codes saved to discharges table
↓
Claim generated automatically
↓
Sent to payer with proper codes
```

---

## ✅ **VERIFICATION**

### **Check Your Coding**:
```sql
-- Discharge diagnoses with codes
SELECT 
  discharge_diagnosis,
  discharge_diagnosis_icd10,
  discharge_diagnosis_snomed
FROM discharges
WHERE discharge_date >= CURRENT_DATE - INTERVAL '30 days';

-- Vaccines with CVX codes
SELECT 
  vaccine_name,
  vaccine_code as cvx_code,
  COUNT(*) as administrations
FROM immunizations
WHERE administration_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY vaccine_name, vaccine_code;

-- Procedures with billing codes
SELECT 
  title,
  procedure_cpt_code,
  procedure_snomed_code,
  diagnosis_icd10
FROM patient_consents
WHERE consent_type IN ('surgery', 'procedure')
  AND created_at >= CURRENT_DATE - INTERVAL '30 days';
```

---

## 🎯 **SUMMARY**

**Medical coding is NOT optional** - it's essential for:

```
✅ Getting paid (billing & claims)
✅ Regulatory compliance (HIPAA, Meaningful Use)
✅ Public health (CDC reporting)
✅ Patient safety (CDSS alerts)
✅ Quality improvement (CMS measures)
✅ Interoperability (FHIR/HL7)
✅ Research & analytics
```

**MediCore Implementation**:
```
✅ All required code fields in database
✅ All forms include code entry
✅ Helper text explains each code type
✅ Auto-fill where possible (CVX)
✅ Indexes for performance
✅ Ready for claims submission
```

---

**For more details**: See `docs/architecture/data-model.md` for complete field mappings

**Migration Reference**: `008-add-terminology-coding.sql` (116 code fields added)

