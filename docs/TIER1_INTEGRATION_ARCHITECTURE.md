# Tier 1 Integration Architecture 🏗️

**Date**: December 3, 2025  
**Based on**: Current system architecture analysis

---

## 🔍 **CURRENT SYSTEM ARCHITECTURE**

### Routing Pattern:
```
/ehr/:tenantSlug/doctor     → DoctorDashboard (role: doctor)
/ehr/:tenantSlug/nurse      → NurseDashboard (role: nurse)
/ehr/:tenantSlug/lab        → LabDashboard (role: lab_tech)
/ehr/:tenantSlug/pharmacy   → PharmacyDashboard (role: pharmacist)
/ehr/:tenantSlug/oncology   → OncologyDashboard (specialty module)
/ehr/:tenantSlug/cardiology → CardiologyDashboard (specialty module)
/ehr/:tenantSlug/hiv        → HIVDoctorDashboard (specialty module)
/ehr/:tenantSlug/maternity  → MaternityDoctorDashboard (specialty module)
```

### Navigation Pattern:
- **Role Dashboards**: Primary workspace for each role
- **Specialty Modules**: Separate full-page dashboards
- **Patient Features**: Modals/sidebars within patient context

---

## 🎯 **TIER 1 INTEGRATION STRATEGY**

### Based on System Analysis:

## **CATEGORY 1: SEPARATE MODULES** (New Routes)
These are **system-wide operational features** that need dedicated dashboards:

### 1. **Emergency Department (ED)** 🚨
**Type**: Separate Module  
**Route**: `/ehr/:tenantSlug/emergency`  
**Roles**: nurse, doctor, admin  
**Why**: 
- ED is a physical department with its own workflow
- Tracking board needs full-screen real-time view
- Multiple staff work simultaneously
- Similar to Lab or Radiology module

**Component**: `EDDashboard.tsx` (new page)
- Integrates: `EDTrackingBoard.tsx`
- Features: Triage, tracking board, ESI levels, metrics

### 2. **Bed Management & ADT** 🏥  
**Type**: Separate Module  
**Route**: `/ehr/:tenantSlug/bed-management`  
**Roles**: nurse, doctor, admin  
**Why**:
- Hospital-wide operational system
- Real-time bed status board needs full screen
- Used by admissions, nursing supervisors, bed coordinators
- Cross-departmental resource

**Component**: `BedManagementDashboard.tsx` (new page)
- Integrates: `BedManagementBoard.tsx`, `AdmissionWorkflow.tsx`
- Features: Bed status board, admit/discharge/transfer, occupancy stats

---

## **CATEGORY 2: PATIENT-CENTRIC FEATURES** (Integrate into Existing)
These are **patient-specific** and should be in patient workflows:

### 3. **E-Consent Management** 📋
**Type**: Patient Feature  
**Location**: Within patient detail/appointment workflow  
**Add To**:
- DoctorDashboard → Current Appointment section
- PatientDetail page → New "Consents" tab
- Pre-procedure checklist

**Integration**:
```typescript
// In DoctorDashboard.tsx
import ConsentForm from '../components/ConsentForm';
import ConsentLibrary from '../components/ConsentLibrary';
import ConsentViewer from '../components/ConsentViewer';

// Add button in patient actions
<button onClick={() => setShowConsentModal(true)}>
  <FileText className="w-4 h-4" />
  Manage Consents
</button>

// Modal for consent workflow
{showConsentModal && (
  <ConsentLibrary
    patientId={currentAppointment.patientId}
    appointmentId={currentAppointment.id}
    onClose={() => setShowConsentModal(false)}
  />
)}
```

### 4. **Immunization Registry** 💉
**Type**: Patient Feature  
**Location**: Patient record tabs  
**Add To**:
- DoctorDashboard → Patient actions
- NurseDashboard → Patient queue actions
- PatientDetail → "Immunizations" tab

**Integration**:
```typescript
// In DoctorDashboard.tsx
import ImmunizationHistory from '../components/ImmunizationHistory';
import VaccineAdministrationForm from '../components/VaccineAdministrationForm';

// Add to patient actions
<button onClick={() => setShowImmunizationsModal(true)}>
  <Syringe className="w-4 h-4" />
  Immunizations
</button>

// Modal for vaccine management
{showImmunizationsModal && (
  <ImmunizationHistory
    patientId={selectedPatientId}
    onClose={() => setShowImmunizationsModal(false)}
  />
)}
```

### 5. **Clinical Pathways** 📊
**Type**: Patient Feature  
**Location**: Treatment planning section  
**Add To**:
- DoctorDashboard → Treatment section
- PatientDetail → "Pathways" tab
- Care plan integration

**Integration**:
```typescript
// In DoctorDashboard.tsx
import PathwayManagement from '../components/PathwayManagement';

// Add to treatment options
<button onClick={() => setShowPathwaysModal(true)}>
  <Route className="w-4 h-4" />
  Clinical Pathways
</button>

// Modal for pathway enrollment
{showPathwaysModal && (
  <PathwayManagement
    patientId={currentAppointment.patientId}
    onClose={() => setShowPathwaysModal(false)}
  />
)}
```

---

## 📊 **RECOMMENDED INTEGRATION MAP**

| Feature | Integration Type | Primary Location | Secondary Locations |
|---------|------------------|------------------|---------------------|
| **ED Module** | 🆕 Separate Module | `/emergency` | Linked from Nurse Dashboard |
| **Bed Management** | 🆕 Separate Module | `/bed-management` | Linked from Nurse Dashboard |
| **E-Consents** | 📱 Patient Feature | Doctor Dashboard → Patient Actions | PatientDetail page |
| **Immunizations** | 📱 Patient Feature | Doctor/Nurse → Patient Actions | PatientDetail page |
| **Clinical Pathways** | 📱 Patient Feature | Doctor Dashboard → Treatment | PatientDetail page |

---

## 🏥 **PATIENT FLOW ANALYSIS**

### Flow 1: Emergency Department
```
Ambulance arrives → ED Desk → Triage → ED Tracking Board → Treatment → Disposition
```
**Users**: ED nurses, ED physicians, triage nurses  
**Need**: Full-screen tracking board, real-time updates  
**Solution**: Separate ED Module ✅

### Flow 2: Inpatient Admission
```
ED/Clinic → Admission decision → Bed assignment → Ward care → Discharge
```
**Users**: Admissions, floor nurses, charge nurses, case managers  
**Need**: Hospital-wide bed view, ADT workflow  
**Solution**: Separate Bed Management Module ✅

### Flow 3: Outpatient Visit with Consent
```
Appointment → Check-in → Consent signing → See doctor → Treatment → Check-out
```
**Users**: Doctors, nurses (specific patient)  
**Need**: Quick consent access during patient encounter  
**Solution**: Integrate into patient workflow ✅

### Flow 4: Pediatric Well-Child Visit
```
Appointment → Growth check → Immunization review → Vaccines due → Administer → Document
```
**Users**: Pediatricians, nurses (specific patient)  
**Need**: Patient-specific vaccine schedule  
**Solution**: Integrate into patient record ✅

### Flow 5: Chronic Disease Management
```
Patient with CHF → Enroll in pathway → Follow steps → Track adherence → Measure outcomes
```
**Users**: Physicians, care coordinators (specific patient)  
**Need**: Patient-specific pathway tracking  
**Solution**: Integrate into treatment planning ✅

---

## 🎯 **RECOMMENDED ARCHITECTURE**

### Create 2 New Module Dashboards:

#### 1. **EDDashboard.tsx**
**Route**: `/ehr/:tenantSlug/emergency`  
**Access**: Nurses, Doctors, Admin  
**Features**:
- Full-screen ED Tracking Board
- ESI triage levels with color coding
- Real-time patient status
- Wait time monitoring
- ED metrics dashboard

**Navigation**:
- Add to Nurse Dashboard main nav
- Add to Doctor Dashboard nav (optional)
- Emergency button in quick access

#### 2. **BedManagementDashboard.tsx**
**Route**: `/ehr/:tenantSlug/bed-management`  
**Access**: Nurses, Admissions, Admin  
**Features**:
- Real-time bed status board (all 46 beds)
- Ward filtering (ICU, Medical, Surgical, Pediatrics, Maternity)
- Assign/Release/Clean workflows
- ADT (Admit/Discharge/Transfer) 
- Occupancy statistics

**Navigation**:
- Add to Nurse Dashboard main nav
- Add to admin quick access

### Integrate into Existing Pages:

#### 3. **DoctorDashboard.tsx** (Patient Actions)
Add patient-specific features:
- 📋 Manage Consents (ConsentLibrary modal)
- 💉 Immunizations (ImmunizationHistory modal)
- 📊 Clinical Pathways (PathwayManagement modal)

Location: "Current Appointment" section, alongside:
- Documents
- Questionnaires
- Lab Results
- Prescriptions

#### 4. **NurseDashboard.tsx** (Patient Actions)
Add to patient queue actions:
- 💉 Immunizations (for well-child visits)
- 📋 View Consents (if needed for procedures)

---

## 🚀 **IMPLEMENTATION PLAN**

### Phase 1: Create New Module Dashboards (30 min)

**Step 1**: Create `EDDashboard.tsx`
- Full-screen layout
- Integrate EDTrackingBoard component
- Add triage workflow
- Wire up ED API endpoints
- Mobile-responsive

**Step 2**: Create `BedManagementDashboard.tsx`
- Full-screen bed board
- Integrate BedManagementBoard component
- Add ADT workflows (AdmissionWorkflow)
- Wire up bed API endpoints
- Mobile-responsive

**Step 3**: Add routes to `App.tsx`
```typescript
import EDDashboard from './pages/EDDashboard';
import BedManagementDashboard from './pages/BedManagementDashboard';

// Add routes:
<Route path="/ehr/:tenantSlug/emergency" element={<EDDashboard />} />
<Route path="/ehr/:tenantSlug/bed-management" element={<BedManagementDashboard />} />
```

**Step 4**: Add navigation links
- Nurse Dashboard: "Emergency Dept" and "Bed Management" buttons
- Doctor Dashboard: "Emergency Dept" link (optional)

### Phase 2: Integrate Patient Features (20 min)

**Step 5**: DoctorDashboard - Add Consent Management
- Import ConsentLibrary, ConsentForm, ConsentViewer
- Add "Manage Consents" button to patient actions
- Wire up with patient/appointment context

**Step 6**: DoctorDashboard - Add Immunizations
- Import ImmunizationHistory, VaccineAdministrationForm
- Add "Immunizations" button to patient actions
- Show vaccine schedule and history

**Step 7**: DoctorDashboard - Add Clinical Pathways
- Import PathwayManagement
- Add "Clinical Pathways" to treatment section
- Enable pathway enrollment and tracking

**Step 8**: NurseDashboard - Add Quick Access
- Add "Immunizations" to patient queue actions
- Add "View Consents" if needed

### Phase 3: Testing & Polish (15 min)

**Step 9**: Test each module
- ED Dashboard: Create visit, triage, track
- Bed Management: View boards, assign beds, ADT
- Consents: View templates, sign forms
- Immunizations: View schedules, record vaccines
- Pathways: Enroll patients, track steps

**Step 10**: Mobile responsiveness
- Verify all new pages work on mobile
- Test touch interactions
- Ensure layouts responsive

---

## 📱 **MOBILE CONSIDERATIONS**

### ED Dashboard:
- Tracking board: Card layout on mobile (stack vertically)
- ESI levels: Color-coded cards
- Touch-friendly status updates

### Bed Management:
- Bed board: Grid layout on mobile (2 columns)
- Ward filters: Horizontal scroll or dropdown
- Touch-friendly bed interactions

---

## 🎨 **UI/UX CONSISTENCY**

Match existing patterns:
- ✅ Gradient headers (from-blue-500 to-indigo-600)
- ✅ Card-based layouts
- ✅ Mobile-responsive grids
- ✅ Loading states
- ✅ Empty states
- ✅ Error handling
- ✅ Touch-friendly buttons (min 44x44px)

---

## 🔐 **ACCESS CONTROL**

| Feature | Doctor | Nurse | Admin | Lab | Pharmacy |
|---------|--------|-------|-------|-----|----------|
| **ED Dashboard** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Bed Management** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Consents** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Immunizations** | ✅ | ✅ | ❌ | ❌ | ⚠️ (inventory) |
| **Pathways** | ✅ | ⚠️ (view) | ❌ | ❌ | ❌ |

---

## ✅ **RECOMMENDED APPROACH**

### **2 New Separate Modules** + **3 Integrated Features**

**New Modules** (Separate dashboards):
1. 🚨 **ED Dashboard** - System-wide ED operations
2. 🏥 **Bed Management Dashboard** - Hospital-wide bed/ADT management

**Integrated Features** (Patient-specific):
3. 📋 **E-Consents** - In patient workflows (Doctor/Nurse)
4. 💉 **Immunizations** - In patient detail (Doctor/Nurse)
5. 📊 **Pathways** - In treatment section (Doctor)

---

## 🚀 **IMPLEMENTATION ORDER**

1. ✅ Create EDDashboard.tsx
2. ✅ Create BedManagementDashboard.tsx
3. ✅ Add routes to App.tsx
4. ✅ Add navigation links
5. ✅ Integrate patient features into DoctorDashboard
6. ✅ Integrate patient features into NurseDashboard
7. ✅ Test all integrations
8. ✅ Verify mobile responsiveness

**Time**: ~60-75 minutes total  
**Result**: Complete Tier 1 UI integration

---

**Ready to proceed?** This approach matches your existing architecture perfectly! 🎯

