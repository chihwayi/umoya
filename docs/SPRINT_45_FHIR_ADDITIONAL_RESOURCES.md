# Sprint 45: FHIR Additional Core Resources

## 📊 Sprint 44 Status: ✅ COMPLETE

### Completed Resources:
- ✅ **Patient Resource** - Full CRUD + Search with all FHIR search parameters
- ✅ **Encounter Resource** - Search from Appointments & Admissions with date range queries
- ✅ **Observation Resource** - Search from Vitals & Lab Orders with date range queries
- ✅ **FHIR Validation Service** - Basic validation for all resources
- ✅ **Capability Statement** - FHIR metadata endpoint
- ✅ **All endpoints tested and working** - 14/14 endpoints passing

---

## 🎯 Sprint 45 Goals (2 Weeks)

### Week 1: Complete Partially Implemented Resources
### Week 2: Add New Core Resources + Bundle Operations

---

## 📋 Detailed Tasks

### **Day 1-3: Complete MedicationRequest Resource**

#### Current Status:
- ✅ Endpoint exists: `GET /fhir/MedicationRequest`
- ✅ Basic search implemented (by patient)
- ❌ Missing: Full FHIR mapping, status mapping, date range queries
- ❌ Missing: Create/Update/Delete operations

#### Tasks:
- [ ] Create `MedicationRequestMapper` class
- [ ] Map from `Prescription` entity to FHIR MedicationRequest
- [ ] Implement all FHIR search parameters:
  - `patient` ✅ (done)
  - `status` (scheduled, active, completed, cancelled)
  - `medication` (by drug name/code)
  - `date` (date range queries)
  - `intent` (order, plan, proposal)
- [ ] Add `POST /fhir/MedicationRequest` (create)
- [ ] Add `PUT /fhir/MedicationRequest/:id` (update)
- [ ] Add `DELETE /fhir/MedicationRequest/:id` (cancel)
- [ ] Add unit tests

#### Implementation Notes:
```typescript
// Map Prescription status to FHIR MedicationRequest status
const statusMap = {
  'pending': 'active',
  'dispensed': 'completed',
  'cancelled': 'cancelled',
  'expired': 'stopped',
};
```

---

### **Day 4-5: Complete DiagnosticReport Resource**

#### Current Status:
- ✅ Endpoint exists: `GET /fhir/DiagnosticReport`
- ✅ Basic search implemented (by patient)
- ❌ Missing: Full FHIR mapping, proper result references
- ❌ Missing: Create/Update operations

#### Tasks:
- [ ] Create `DiagnosticReportMapper` class
- [ ] Map from `LabOrder` entity to FHIR DiagnosticReport
- [ ] Implement all FHIR search parameters:
  - `patient` ✅ (done)
  - `status` (registered, partial, preliminary, final, amended, corrected, appended, cancelled)
  - `date` (date range queries)
  - `code` (by LOINC code)
- [ ] Link to Observation resources for results
- [ ] Add `POST /fhir/DiagnosticReport` (create)
- [ ] Add `PUT /fhir/DiagnosticReport/:id` (update)
- [ ] Add unit tests

---

### **Day 6-7: Implement Condition Resource (NEW)**

#### Current Status:
- ❌ Endpoint does not exist
- ❌ No implementation

#### Tasks:
- [ ] Create `ConditionMapper` class
- [ ] Map from `Problem` entity to FHIR Condition
- [ ] Create `GET /fhir/Condition` endpoint
- [ ] Create `GET /fhir/Condition/:id` endpoint
- [ ] Create `POST /fhir/Condition` endpoint
- [ ] Create `PUT /fhir/Condition/:id` endpoint
- [ ] Implement FHIR search parameters:
  - `patient` (required)
  - `category` (problem-list-item, encounter-diagnosis)
  - `clinical-status` (active, recurrence, relapse, inactive, remission, resolved)
  - `severity` (mild, moderate, severe)
  - `onset-date` (date range)
- [ ] Add unit tests

#### FHIR Condition Structure:
```typescript
{
  resourceType: 'Condition',
  id: problem.id,
  clinicalStatus: {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
      code: 'active', // or 'resolved', 'inactive'
    }],
  },
  category: [{
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/condition-category',
      code: 'problem-list-item',
    }],
  }],
  code: {
    coding: [{
      system: 'http://snomed.info/sct',
      code: problem.snomedCode,
      display: problem.diagnosis,
    }],
  },
  subject: {
    reference: `Patient/${problem.patientId}`,
  },
  onsetDateTime: problem.onsetDate?.toISOString(),
  recordedDate: problem.createdAt.toISOString(),
}
```

---

### **Day 8-9: Implement Medication Resource (NEW)**

#### Current Status:
- ❌ Endpoint does not exist
- ❌ No implementation

#### Tasks:
- [ ] Create `MedicationMapper` class
- [ ] Map from `Drug` entity to FHIR Medication
- [ ] Create `GET /fhir/Medication` endpoint
- [ ] Create `GET /fhir/Medication/:id` endpoint
- [ ] Create `POST /fhir/Medication` endpoint
- [ ] Create `PUT /fhir/Medication/:id` endpoint
- [ ] Implement FHIR search parameters:
  - `code` (by drug code/name)
  - `status` (active, inactive, entered-in-error)
  - `form` (tablet, capsule, injection, etc.)
  - `ingredient` (active ingredient search)
- [ ] Add unit tests

---

### **Day 10-11: Complete Procedure Resource**

#### Current Status:
- ✅ Endpoint exists: `GET /fhir/Procedure`
- ❌ Returns empty bundle (stub implementation)
- ❌ No mapping from actual procedures

#### Tasks:
- [ ] Create `ProcedureMapper` class
- [ ] Map from `MedicalRecord` (type='procedure') or create `Procedure` entity
- [ ] Implement full search functionality
- [ ] Map procedure codes (CPT/SNOMED)
- [ ] Link to Encounter resources
- [ ] Add `POST /fhir/Procedure` endpoint
- [ ] Add `PUT /fhir/Procedure/:id` endpoint
- [ ] Implement FHIR search parameters:
  - `patient` (required)
  - `date` (date range)
  - `code` (procedure code)
  - `status` (preparation, in-progress, not-done, on-hold, stopped, completed, entered-in-error, unknown)
  - `encounter` (link to encounter)
- [ ] Add unit tests

---

### **Day 12-13: Complete Immunization Resource**

#### Current Status:
- ✅ Endpoint exists: `GET /fhir/Immunization`
- ❌ Returns empty bundle (stub implementation)
- ❌ No mapping from actual immunizations

#### Tasks:
- [ ] Create `ImmunizationMapper` class
- [ ] Map from `MedicalRecord` (type='immunization') or create `Immunization` entity
- [ ] Implement full search functionality
- [ ] Map vaccine codes (CVX codes)
- [ ] Add `POST /fhir/Immunization` endpoint
- [ ] Add `PUT /fhir/Immunization/:id` endpoint
- [ ] Implement FHIR search parameters:
  - `patient` (required)
  - `date` (date range)
  - `vaccine-code` (CVX code)
  - `status` (completed, entered-in-error, not-done)
  - `lot-number` (vaccine lot number)
- [ ] Add unit tests

---

### **Day 14: Bundle Operations**

#### Tasks:
- [ ] Implement `POST /fhir` (Bundle transaction)
  - Process multiple resources in single request
  - Support create, update, delete operations
  - Return bundle with results
- [ ] Implement `POST /fhir` (Bundle batch)
  - Similar to transaction but independent operations
- [ ] Add validation for bundle entries
- [ ] Add error handling for partial failures
- [ ] Add unit tests

#### Bundle Transaction Example:
```typescript
POST /fhir
{
  "resourceType": "Bundle",
  "type": "transaction",
  "entry": [
    {
      "request": {
        "method": "POST",
        "url": "Patient"
      },
      "resource": { /* Patient resource */ }
    },
    {
      "request": {
        "method": "POST",
        "url": "Encounter"
      },
      "resource": { /* Encounter resource */ }
    }
  ]
}
```

---

## 🧪 Testing Requirements

### Unit Tests
- [ ] MedicationRequestMapper.toFhir() - all fields mapped correctly
- [ ] DiagnosticReportMapper - proper result references
- [ ] ConditionMapper - status and category mapping
- [ ] MedicationMapper - drug code mapping
- [ ] ProcedureMapper - procedure code mapping
- [ ] ImmunizationMapper - vaccine code mapping
- [ ] Bundle transaction processing

### Integration Tests
- [ ] GET /fhir/MedicationRequest - returns valid FHIR Bundle
- [ ] POST /fhir/MedicationRequest - creates and returns FHIR resource
- [ ] GET /fhir/DiagnosticReport - returns valid FHIR Bundle
- [ ] GET /fhir/Condition - returns valid FHIR Bundle
- [ ] POST /fhir/Condition - creates condition
- [ ] GET /fhir/Medication - returns valid FHIR Bundle
- [ ] GET /fhir/Procedure - returns valid FHIR Bundle (not empty)
- [ ] GET /fhir/Immunization - returns valid FHIR Bundle (not empty)
- [ ] POST /fhir (Bundle transaction) - processes multiple resources

### FHIR Compliance Tests
- [ ] All resources pass FHIR validation
- [ ] All search parameters work as specified
- [ ] Resource references are valid
- [ ] Bundle operations follow FHIR spec

---

## 📊 Success Criteria

### Week 1
- ✅ MedicationRequest fully functional (CRUD + Search)
- ✅ DiagnosticReport fully functional (CRUD + Search)
- ✅ Condition resource fully functional (CRUD + Search)
- ✅ Medication resource fully functional (CRUD + Search)

### Week 2
- ✅ Procedure resource fully functional (not empty)
- ✅ Immunization resource fully functional (not empty)
- ✅ Bundle operations working (transaction + batch)
- ✅ All integration tests passing

---

## 🚀 Next Steps After Sprint 45

**Sprint 46: Advanced FHIR Features**
- FHIR Subscriptions (WebHooks/WebSockets)
- FHIR History (version tracking)
- FHIR Operations (custom operations)
- SMART on FHIR authentication
- FHIR Bulk Data Export

---

## 📚 Resources

- **FHIR R4 Specification**: https://www.hl7.org/fhir/R4/
- **FHIR MedicationRequest**: https://www.hl7.org/fhir/R4/medicationrequest.html
- **FHIR DiagnosticReport**: https://www.hl7.org/fhir/R4/diagnosticreport.html
- **FHIR Condition**: https://www.hl7.org/fhir/R4/condition.html
- **FHIR Medication**: https://www.hl7.org/fhir/R4/medication.html
- **FHIR Procedure**: https://www.hl7.org/fhir/R4/procedure.html
- **FHIR Immunization**: https://www.hl7.org/fhir/R4/immunization.html
- **FHIR Bundle**: https://www.hl7.org/fhir/R4/bundle.html

---

**Ready to start Sprint 45? Let's begin with Day 1-3: Complete MedicationRequest Resource!**

