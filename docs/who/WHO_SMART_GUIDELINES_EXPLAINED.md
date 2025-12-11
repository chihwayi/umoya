# WHO Smart Guidelines Explained
## Digital-Ready Guidelines for EHR Integration

**Last Updated:** December 2024

---

## 🤔 WHO Smart Guidelines vs Regular WHO Guidelines

### Regular WHO Guidelines
- 📄 **Format:** PDF documents
- 📖 **Content:** Text-based recommendations
- ❌ **Integration:** Manual reading, copy-paste
- ❌ **Digital:** Not machine-readable
- ❌ **EHR Integration:** Difficult/impossible

**Example:** WHO HIV Treatment Guidelines PDF (2021)

### WHO Smart Guidelines ✅
- 💻 **Format:** FHIR-based structured data
- 🔧 **Content:** Machine-readable, computable
- ✅ **Integration:** Direct EHR integration via SDK/API
- ✅ **Digital:** Designed for digital health systems
- ✅ **EHR Integration:** Built-in support

**Example:** WHO Smart Guidelines FHIR SDK for Android

---

## 🎯 What Are WHO Smart Guidelines?

WHO Smart Guidelines are **digital, structured, machine-readable** versions of WHO clinical guidelines designed specifically for integration into Electronic Health Records (EHR) and other digital health systems.

### Key Features:
1. **FHIR-Based:** Uses HL7 FHIR standards
2. **Structured Data:** Machine-readable format
3. **SDK Available:** Android SDK for integration
4. **Questionnaires:** HL7 FHIR SDC (Structured Data Capture)
5. **Interoperable:** Works with any FHIR-compliant EHR

---

## 🔧 How to Use WHO Smart Guidelines

### Option 1: WHO Smart Guidelines SDK (Recommended)
**For:** Android/Mobile apps

**What it provides:**
- Local storage
- Data access APIs
- Search functionality
- Synchronization APIs
- FHIR Questionnaire rendering

**How to get:**
- Contact: `SMART_DAKS@who.int`
- Join weekly working group calls
- Access Android SDK from WHO

**Integration:**
```kotlin
// Android SDK usage
val smartGuidelines = SmartGuidelinesSDK.initialize(context)
val hivGuidelines = smartGuidelines.getGuidelines("HIV")
val questionnaire = hivGuidelines.getQuestionnaire("ART_Initiation")
```

### Option 2: FHIR Resources (For Web/Backend)
**For:** Web applications, backend services

**What it provides:**
- FHIR PlanDefinition resources
- FHIR ActivityDefinition resources
- FHIR Questionnaire resources
- FHIR Library resources

**How to get:**
- Download from WHO FHIR repository
- Use FHIR server with WHO resources
- Parse FHIR JSON/XML

**Integration:**
```typescript
// Backend integration
import { PlanDefinition, Questionnaire } from 'fhir/r4';

// Load WHO Smart Guidelines FHIR resources
const hivPlanDefinition: PlanDefinition = await loadFHIRResource(
  'https://who.int/fhir/PlanDefinition/hiv-care-2021'
);

// Render questionnaire
const questionnaire: Questionnaire = await loadFHIRResource(
  'https://who.int/fhir/Questionnaire/art-initiation'
);
```

### Option 3: WHO Smart Guidelines API (If Available)
**For:** Direct API integration

**Status:** Check with WHO for API availability
**Contact:** `SMART_DAKS@who.int`

---

## 🏗️ Implementation Architecture

### For Your EHR System

```
┌─────────────────────────────────────────┐
│         WHO Smart Guidelines             │
│         (FHIR Resources)                 │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│      FHIR Parser/Processor               │
│  • Parse PlanDefinition                  │
│  • Extract recommendations               │
│  • Generate Smart Forms                  │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│      CDSS Integration Layer             │
│  • Guideline matching                    │
│  • Recommendation engine                 │
│  • Alert generation                     │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│         EHR Frontend                     │
│  • Smart Forms (from Questionnaires)     │
│  • Guideline recommendations            │
│  • Alerts and reminders                 │
└─────────────────────────────────────────┘
```

---

## 📋 Implementation Steps

### Step 1: Get WHO Smart Guidelines Resources
1. Contact WHO: `SMART_DAKS@who.int`
2. Request access to FHIR resources
3. Download FHIR PlanDefinition/Questionnaire files
4. Or use Android SDK if building mobile app

### Step 2: Set Up FHIR Processing
1. Install FHIR library (HAPI FHIR for Java/TypeScript)
2. Create FHIR parser service
3. Load WHO Smart Guidelines resources
4. Extract structured data

### Step 3: Integrate with CDSS
1. Map WHO guidelines to CDSS engine
2. Create guideline matching logic
3. Generate recommendations from guidelines
4. Add guideline adherence checking

### Step 4: Build Smart Forms
1. Parse FHIR Questionnaires
2. Generate dynamic forms
3. Add validation rules
4. Integrate with EHR UI

---

## 🎯 Recommended Approach for Your System

### Since You're Using Web (React) + Backend (NestJS):

**Best Option:** Use FHIR Resources directly

1. **Download WHO Smart Guidelines FHIR resources**
   - PlanDefinition (care plans)
   - Questionnaire (forms)
   - Library (logic)

2. **Parse with HAPI FHIR (TypeScript)**
   ```typescript
   import { PlanDefinition } from 'fhir/r4';
   
   // Load WHO Smart Guidelines
   const hivGuidelines = await loadPlanDefinition(
     'who-smart-guidelines/hiv-care-2021.json'
   );
   ```

3. **Integrate with CDSS**
   ```typescript
   // Extract recommendations
   const recommendations = extractRecommendations(hivGuidelines);
   
   // Match to patient
   const matchedGuidelines = matchGuidelines(patient, recommendations);
   ```

4. **Generate Smart Forms**
   ```typescript
   // Render FHIR Questionnaire as React form
   const form = renderFHIRQuestionnaire(questionnaire);
   ```

---

## 📚 Resources

### WHO Smart Guidelines
- **Main Site:** https://www.who.int/teams/digital-health-and-innovation/smart-guidelines
- **FHIR SDK:** https://www.who.int/teams/digital-health-and-innovation/smart-guidelines/fhir-based-smart-guidelines
- **Contact:** SMART_DAKS@who.int

### FHIR Libraries
- **HAPI FHIR (Java/TypeScript):** https://hapifhir.io/
- **FHIR.js (JavaScript):** https://github.com/FHIR/fhir.js
- **FHIR R4 Spec:** https://www.hl7.org/fhir/

### Integration Examples
- WHO provides working group calls (weekly)
- Join to see real-world implementations
- Get SDK documentation and examples

---

## ✅ Next Steps

1. **Contact WHO** (`SMART_DAKS@who.int`) to:
   - Get access to FHIR resources
   - Join working group calls
   - Get SDK/documentation

2. **Set up FHIR processing** in your backend:
   - Install HAPI FHIR or similar
   - Create FHIR parser service
   - Load WHO Smart Guidelines

3. **Integrate with CDSS:**
   - Map guidelines to CDSS engine
   - Add guideline matching
   - Generate recommendations

4. **Build Smart Forms:**
   - Parse FHIR Questionnaires
   - Generate dynamic forms
   - Add to EHR UI

---

## 🎯 Summary

**WHO Smart Guidelines = Digital-Ready WHO Guidelines**

- ✅ Machine-readable (FHIR format)
- ✅ Direct EHR integration
- ✅ SDK available (Android)
- ✅ FHIR resources available
- ✅ Designed for digital health systems

**NOT the same as regular WHO guidelines (PDFs)**

- Regular guidelines = PDF documents
- Smart Guidelines = Structured, computable, digital format

**For your system:** Use FHIR resources directly (best for web/backend)
