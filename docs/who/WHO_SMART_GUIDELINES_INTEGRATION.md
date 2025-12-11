# WHO Smart Guidelines Integration Guide
## Digital-Ready Guidelines for Your EHR

**Last Updated:** December 2024

---

## ✅ Yes! Use Global WHO Smart Guidelines

**WHO Smart Guidelines ARE digital-ready!** They're specifically designed for EHR integration, not PDF documents.

---

## 🎯 What Are WHO Smart Guidelines?

### Regular WHO Guidelines (PDFs)
- 📄 Text documents
- ❌ Not machine-readable
- ❌ Manual integration

### WHO Smart Guidelines ✅
- 💻 **FHIR-based structured data**
- ✅ **Machine-readable**
- ✅ **Direct EHR integration**
- ✅ **SDK available**
- ✅ **Digital-ready**

---

## 🔧 How to Get WHO Smart Guidelines

### Option 1: Contact WHO Directly (Recommended)
**Email:** `SMART_DAKS@who.int`

**What to request:**
1. Access to FHIR resources (PlanDefinition, Questionnaire)
2. Join weekly working group calls
3. SDK documentation (if using Android)
4. Implementation examples

### Option 2: Use FHIR Resources Directly
**For:** Web/Backend applications (your case)

**Resources available:**
- PlanDefinition (care plans)
- Questionnaire (forms)
- Library (logic)
- ActivityDefinition (activities)

**Format:** FHIR R4 JSON/XML

---

## 🏗️ Integration Architecture

```
WHO Smart Guidelines (FHIR Resources)
    │
    ▼
FHIR Parser Service (HAPI FHIR)
    │
    ├─→ Extract Guidelines ──→ CDSS Engine
    │
    └─→ Extract Questionnaires ──→ Smart Forms UI
```

---

## 📋 Implementation Steps

### Step 1: Get FHIR Resources
1. Contact WHO: `SMART_DAKS@who.int`
2. Request FHIR resources for:
   - HIV/AIDS care
   - TB care
   - Maternal health
   - Child health
   - Malaria
   - NCDs

### Step 2: Set Up FHIR Processing
```typescript
// services/ehr-service/src/services/who-smart-guidelines.service.ts

import { PlanDefinition, Questionnaire } from 'fhir/r4';
import * as fs from 'fs';

@Injectable()
export class WhoSmartGuidelinesService {
  private guidelines: Map<string, PlanDefinition> = new Map();
  private questionnaires: Map<string, Questionnaire> = new Map();

  async loadGuidelines() {
    // Load FHIR resources
    const hivGuidelines = JSON.parse(
      fs.readFileSync('who-smart-guidelines/hiv-care-2021.json', 'utf8')
    ) as PlanDefinition;
    
    this.guidelines.set('hiv', hivGuidelines);
  }

  async getRecommendations(condition: string, patientData: any) {
    const guideline = this.guidelines.get(condition);
    if (!guideline) return null;

    // Extract recommendations from PlanDefinition
    return this.extractRecommendations(guideline, patientData);
  }

  async getSmartForm(formId: string) {
    const questionnaire = this.questionnaires.get(formId);
    if (!questionnaire) return null;

    // Convert FHIR Questionnaire to form structure
    return this.convertToForm(questionnaire);
  }
}
```

### Step 3: Integrate with CDSS
```typescript
// services/ehr-service/src/services/cdss.service.ts

async getGuidelines(condition: string, patientData?: any) {
  // Try WHO Smart Guidelines first
  const whoGuidelines = await this.whoSmartGuidelinesService
    .getRecommendations(condition, patientData);
  
  if (whoGuidelines) {
    return {
      source: 'who_smart_guidelines',
      ...whoGuidelines
    };
  }
  
  // Fallback to existing CDSS guidelines
  return this.cdssClient.post('/guidelines/check', {...});
}
```

### Step 4: Build Smart Forms
```typescript
// ehr-frontend/src/components/WHOSmartForms/FHIRQuestionnaireForm.tsx

const FHIRQuestionnaireForm: React.FC<Props> = ({ questionnaire }) => {
  // Render FHIR Questionnaire as React form
  // Handle validation, conditional logic, etc.
  return (
    <Form>
      {questionnaire.item.map(item => (
        <FormField key={item.linkId} item={item} />
      ))}
    </Form>
  );
};
```

---

## 🎯 Recommended Approach

### For Your System (React + NestJS):

1. **Get FHIR Resources from WHO**
   - Contact: `SMART_DAKS@who.int`
   - Download PlanDefinition/Questionnaire files
   - Store in `who-smart-guidelines/` directory

2. **Parse with HAPI FHIR (TypeScript)**
   - Install: `npm install fhir/r4`
   - Parse FHIR resources
   - Extract guidelines and forms

3. **Integrate with CDSS**
   - Map WHO guidelines to CDSS engine
   - Add guideline matching
   - Generate recommendations

4. **Build Smart Forms**
   - Parse FHIR Questionnaires
   - Generate dynamic React forms
   - Add validation and conditional logic

---

## 📚 Resources

- **WHO Smart Guidelines:** https://www.who.int/teams/digital-health-and-innovation/smart-guidelines
- **FHIR SDK:** https://www.who.int/teams/digital-health-and-innovation/smart-guidelines/fhir-based-smart-guidelines
- **Contact:** SMART_DAKS@who.int
- **HAPI FHIR:** https://hapifhir.io/ (TypeScript/JavaScript)

---

## ✅ Next Steps

1. **Email WHO** (`SMART_DAKS@who.int`) to get FHIR resources
2. **Set up FHIR parsing** in backend
3. **Integrate with CDSS**
4. **Build Smart Forms UI**

---

## 🎯 Summary

- ✅ **WHO Smart Guidelines = Digital-ready**
- ✅ **Use global WHO Smart Guidelines** (they're digital!)
- ✅ **FHIR-based, machine-readable**
- ✅ **Direct EHR integration**
- ✅ **Contact WHO to get resources**

**NOT the same as PDF guidelines** - Smart Guidelines are structured, computable, digital format designed for EHR integration!
