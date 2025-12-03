# Patient Portal - Tier 1 Features To-Do

**Date**: December 3, 2025  
**Patient Portal**: ✅ EXISTS at `http://localhost:3015`  
**Status**: 🔴 **TIER 1 FEATURES MISSING**

---

## ✅ **PATIENT PORTAL EXISTS!**

### **Current Features** (What's Already Built)
✅ **Login/Registration** - Working  
✅ **Dashboard** - Working  
✅ **Appointments** - View, request, cancel  
✅ **Medical Records** - View records  
✅ **Lab Results** - View lab reports  
✅ **Prescriptions** - View prescriptions  
✅ **Bills & Payments** - View and pay bills  
✅ **Vitals Monitoring** - View and submit vitals  
✅ **Messages** - Secure messaging with providers  
✅ **Questionnaires** - PRO questionnaires  
✅ **Health Goals** - Track health goals  
✅ **Medication Reminders** - Set reminders  
✅ **Adherence Tracking** - Track medication adherence  
✅ **Export Records** - Download health data  
✅ **Telemedicine** - Video consultations  
✅ **Diabetes Management** - Specialized diabetes tracking  
✅ **Cardiology** - Heart health monitoring  
✅ **Symptom Checker** - AI symptom checker  
✅ **Family Access** - Family member access  
✅ **Fitness Integration** - Connect fitness apps  

**Total Pages**: ~30 pages  
**Total API Methods**: ~50+ methods (1,045 lines)

---

## ❌ **TIER 1 FEATURES MISSING FROM PATIENT PORTAL**

### **1. E-Consent Management (Sprint 21)** 🔴 **CRITICAL**

**What's Missing**:
- ❌ `PatientConsentsPage.tsx` - View pending and signed consents
- ❌ `ConsentSigningPage.tsx` - Sign consents electronically
- ❌ Route: `/:tenantSlug/consents`
- ❌ API methods in patient-portal/src/services/api.ts:
  - `getPatientConsents()`
  - `signConsent()`
  - `declineConsent()`
  - `downloadConsent()`

**Backend Support**: ✅ Ready (patient-portal.controller.ts has consent endpoints)

**What to Build**:
1. Consents list page (pending, signed, declined)
2. Consent detail viewer
3. Electronic signature component (reuse from EHR)
4. Add "Consents" card to dashboard
5. Add route in App.tsx

**Priority**: 🔴 **CRITICAL** - Legal requirement

---

### **2. Immunization Records (Sprint 22)** 🟡 **IMPORTANT**

**What's Missing**:
- ❌ `ImmunizationsPage.tsx` - View vaccine history
- ❌ Route: `/:tenantSlug/immunizations`
- ❌ API methods:
  - `getPatientImmunizations()`
  - `downloadImmunizationRecord()`
  - `getImmunizationForecast()`

**Backend Support**: ✅ Ready (immunization endpoints exist)

**What to Build**:
1. Immunization history page
2. Vaccine timeline visualization
3. Upcoming vaccines widget
4. Download immunization record button
5. Add "Immunizations" card to dashboard
6. Add route in App.tsx

**Priority**: 🟡 **IMPORTANT** - Health education

---

### **3. Clinical Pathways (Sprint 25)** 🔴 **CRITICAL**

**What's Missing**:
- ❌ `MyPathwaysPage.tsx` - View enrolled pathways
- ❌ Route: `/:tenantSlug/pathways`
- ❌ API methods:
  - `getPatientPathways()`
  - `getPathwayProgress()`
  - `updatePathwayStep()`

**Backend Support**: ✅ Ready (pathway enrollment APIs exist)

**What to Build**:
1. My pathways list page
2. Pathway progress viewer (timeline)
3. Step completion checklist
4. Next steps widget
5. Adherence score display
6. Add "My Care Pathways" card to dashboard
7. Add route in App.tsx

**Priority**: 🔴 **CRITICAL** - Patient engagement = better outcomes

---

### **4. Admission Status (Sprint 23)** 🟢 **NICE TO HAVE**

**What's Missing**:
- ❌ `AdmissionStatusPage.tsx` - View current admission
- ❌ Route: `/:tenantSlug/admission`
- ❌ API methods:
  - `getCurrentAdmission()`
  - `getAdmissionDetails()`

**Backend Support**: ✅ Ready (admission/discharge APIs exist)

**What to Build**:
1. Current admission status card
2. Bed/ward information
3. Expected discharge date
4. Discharge instructions viewer
5. Add to dashboard when admitted
6. Add route in App.tsx

**Priority**: 🟢 **NICE TO HAVE** - Only for admitted patients

---

### **5. ED Visit History (Sprint 24)** 🟢 **NICE TO HAVE**

**What's Missing**:
- ❌ `EDVisitsPage.tsx` - View ED visit history
- ❌ Route: `/:tenantSlug/ed-visits`
- ❌ API methods:
  - `getPatientEDVisits()`
  - `getEDVisitDetails()`

**Backend Support**: ✅ Ready (ED visit APIs exist)

**What to Build**:
1. ED visit history page
2. ED discharge summaries
3. Triage assessment viewer
4. Add to dashboard if recent ED visit
5. Add route in App.tsx

**Priority**: 🟢 **NICE TO HAVE** - Historical data

---

## 📋 **IMPLEMENTATION CHECKLIST**

### **Phase 1: Critical (Week 1)**

#### **E-Consent Module** 🔴
- [ ] Create `PatientConsentsPage.tsx`
  - [ ] List pending consents (requires signature)
  - [ ] List signed consents (completed)
  - [ ] List declined consents
  - [ ] Search and filter
  
- [ ] Create `ConsentDetailPage.tsx`
  - [ ] Display consent content (HTML)
  - [ ] Show consent metadata (type, version, date)
  - [ ] Electronic signature pad
  - [ ] Sign/Decline buttons
  - [ ] Download PDF button
  
- [ ] Add API methods to `patient-portal/src/services/api.ts`:
  ```typescript
  getPatientConsents: async (token, tenantSlug, filters?) => {...}
  getConsentById: async (consentId, token, tenantSlug) => {...}
  signConsent: async (consentId, signatureData, token, tenantSlug) => {...}
  declineConsent: async (consentId, reason, token, tenantSlug) => {...}
  downloadConsent: async (consentId, format, token, tenantSlug) => {...}
  ```
  
- [ ] Add dashboard card:
  ```tsx
  {
    icon: FileText,
    label: 'Consents',
    path: '/consents',
    color: 'from-indigo-500 to-purple-500',
    badgeCount: pendingConsentsCount
  }
  ```
  
- [ ] Add route in `App.tsx`:
  ```tsx
  <Route path="/:tenantSlug/consents" element={
    <ProtectedRoute requireLinked>
      <PatientConsentsPage />
    </ProtectedRoute>
  } />
  ```

#### **Clinical Pathways Module** 🔴
- [ ] Create `MyPathwaysPage.tsx`
  - [ ] List enrolled pathways
  - [ ] Show pathway status (active, completed, paused)
  - [ ] Display progress percentage
  - [ ] Quick stats (steps completed, adherence score)
  
- [ ] Create `PathwayDetailPage.tsx`
  - [ ] Pathway overview
  - [ ] Step-by-step timeline
  - [ ] Step completion status
  - [ ] Next steps widget
  - [ ] Adherence tracking
  - [ ] Progress visualization (progress bar)
  
- [ ] Add API methods:
  ```typescript
  getPatientPathways: async (token, tenantSlug) => {...}
  getPathwayProgress: async (enrollmentId, token, tenantSlug) => {...}
  updatePathwayStep: async (enrollmentId, stepId, status, token, tenantSlug) => {...}
  ```
  
- [ ] Add dashboard card:
  ```tsx
  {
    icon: Route,
    label: 'My Care Pathways',
    path: '/pathways',
    color: 'from-blue-500 to-cyan-500',
    badgeCount: activePathwaysCount
  }
  ```
  
- [ ] Add route in `App.tsx`

---

### **Phase 2: Important (Week 2)**

#### **Immunization Module** 🟡
- [ ] Create `ImmunizationsPage.tsx`
  - [ ] Immunization history table
  - [ ] Vaccine cards (visual design)
  - [ ] Upcoming vaccines section
  - [ ] Download immunization record button
  
- [ ] Add API methods:
  ```typescript
  getPatientImmunizations: async (token, tenantSlug) => {...}
  getImmunizationForecast: async (token, tenantSlug) => {...}
  downloadImmunizationRecord: async (format, token, tenantSlug) => {...}
  ```
  
- [ ] Add dashboard card
- [ ] Add route in `App.tsx`

#### **Admission Status Module** 🟡
- [ ] Create `AdmissionStatusPage.tsx`
  - [ ] Current admission card (if admitted)
  - [ ] Bed/ward information
  - [ ] Expected discharge date
  - [ ] Admission timeline
  - [ ] Discharge instructions
  
- [ ] Add API methods:
  ```typescript
  getCurrentAdmission: async (token, tenantSlug) => {...}
  getAdmissionHistory: async (token, tenantSlug) => {...}
  ```
  
- [ ] Conditional dashboard card (show only if admitted)
- [ ] Add route in `App.tsx`

---

### **Phase 3: Nice-to-Have (Week 3)**

#### **ED Visit History** 🟢
- [ ] Create `EDVisitsPage.tsx`
- [ ] Add API methods
- [ ] Add dashboard card
- [ ] Add route

---

## 🎯 **RECOMMENDED PRIORITY**

### **Sprint 26: Patient Portal Tier 1 Integration**

**Week 1**:
1. E-Consent Management 🔴
2. Clinical Pathways 🔴

**Week 2**:
3. Immunization Records 🟡
4. Admission Status 🟡

**Week 3**:
5. ED Visit History 🟢
6. Polish and testing

---

## 📊 **CURRENT STATE**

| Feature | Portal Exists | Tier 1 Integration | Status |
|---------|---------------|-------------------|--------|
| **Login/Auth** | ✅ | N/A | Complete |
| **Dashboard** | ✅ | ⚠️ Missing Tier 1 cards | Needs update |
| **Appointments** | ✅ | N/A | Complete |
| **Records** | ✅ | N/A | Complete |
| **Prescriptions** | ✅ | N/A | Complete |
| **E-Consents** | ❌ | ❌ | **Missing** |
| **Immunizations** | ❌ | ❌ | **Missing** |
| **Pathways** | ❌ | ❌ | **Missing** |
| **Admission** | ❌ | ❌ | **Missing** |
| **ED Visits** | ❌ | ❌ | **Missing** |

---

## ✅ **GOOD NEWS**

The patient portal is **well-built** with:
- ✅ Beautiful UI with gradients
- ✅ ~30 existing pages
- ✅ ~50+ API methods
- ✅ Authentication system
- ✅ Routing framework
- ✅ Component library
- ✅ Notification system

**Adding Tier 1 features will be straightforward!**

---

## 🚀 **NEXT STEPS**

1. Create 5 new pages (Consents, Immunizations, Pathways, Admission, ED Visits)
2. Add API methods to `patient-portal/src/services/api.ts`
3. Add dashboard cards to `PatientDashboard.tsx`
4. Add routes to `App.tsx`
5. Reuse components from EHR where possible

**Estimated Effort**: 2-3 weeks

---

**Total Session Commits**: 91 ✅  
**Discovery**: Patient portal is robust, just needs Tier 1 integration!

