# New Modules: Data Capture & Workflow Integration

## Overview
This document explains which new modules capture information, which are display-only, and how they're integrated into the Doctor/Nurse workflow.

---

## 📊 Module Classification

### ✅ **Data Capture Modules** (Have Forms/Inputs)

These modules allow users to CREATE, UPDATE, and INPUT data:

#### 1. **Blood Bank Dashboard** 🩸
- **Location**: `/ehr/{tenant}/blood-bank`
- **Data Capture**:
  - ✅ Register blood donors (`POST /blood-bank/donors`)
  - ✅ Reserve blood inventory (`POST /blood-bank/inventory/:id/reserve`)
  - ✅ Create transfusions (`POST /blood-bank/transfusions`)
  - ✅ Start transfusions (`POST /blood-bank/transfusions/:id/start`)
  - ✅ Record transfusion vitals (`POST /blood-bank/transfusions/:id/vitals`)
  - ✅ Complete transfusions (`POST /blood-bank/transfusions/:id/complete`)
- **Display**: Inventory levels, active transfusions, donor history
- **Who Uses**: Nurses, Lab Techs, Doctors (for ordering)

#### 2. **MAR (Medication Administration Record) Dashboard** 💊
- **Location**: `/ehr/{tenant}/mar`
- **Data Capture**:
  - ✅ Issue wristbands (`POST /bcma/wristband/issue`)
  - ✅ Verify 5 Rights (`POST /bcma/verify-5-rights`)
  - ✅ Administer medications (`POST /bcma/administer`)
  - ✅ Hold medications (`POST /bcma/mar/:id/hold`)
  - ✅ Refuse medications (`POST /bcma/mar/:id/refuse`)
  - ✅ Acknowledge alerts (`POST /bcma/alerts/:id/acknowledge`)
- **Display**: MAR schedule, medication alerts, administration history
- **Who Uses**: Nurses (primary), Doctors (view only)

#### 3. **Infection Control Dashboard** 🦠
- **Location**: `/ehr/{tenant}/infection-control`
- **Data Capture**:
  - ✅ Create infection surveillance records (`POST /infection-control/infections`)
  - ✅ Create isolation precautions (`POST /infection-control/isolation`)
  - ✅ Discontinue isolation (`POST /infection-control/isolation/:id/discontinue`)
  - ✅ Create antimicrobial stewardship records (`POST /infection-control/antimicrobial`)
  - ✅ Review antimicrobials (`PUT /infection-control/antimicrobial/:id/review`)
- **Display**: HAI rates, isolation census, antimicrobial usage
- **Who Uses**: Infection Control Nurses, Doctors, Epidemiologists

#### 4. **Sepsis Management Dashboard** 🚨
- **Location**: `/ehr/{tenant}/sepsis`
- **Data Capture**:
  - ✅ Create sepsis screenings (`POST /sepsis/screenings`)
  - ✅ Create sepsis bundles (`POST /sepsis/bundles`)
  - ✅ Update bundle elements (`PUT /sepsis/bundles/:id/element`)
- **Display**: SEP-1 compliance, sepsis alerts, bundle completion rates
- **Who Uses**: Nurses (screening), Doctors (bundle completion)

#### 5. **Revenue Cycle Dashboard** 💰
- **Location**: `/ehr/{tenant}/revenue-cycle`
- **Data Capture**:
  - ✅ Create charge master items (`POST /revenue-cycle/charge-master`)
  - ✅ Create patient charges (`POST /revenue-cycle/charges`)
- **Display**: Charge capture rates, DRG assignments, missed charges
- **Who Uses**: Billing Staff, Accounts, Doctors (view charges)

#### 6. **CDI (Clinical Documentation Improvement) Dashboard** 📝
- **Location**: `/ehr/{tenant}/cdi`
- **Data Capture**:
  - ✅ Create CDI reviews (`POST /cdi/reviews`)
  - ✅ Create physician queries (`POST /cdi/queries`)
  - ✅ Answer queries (`PUT /cdi/queries/:id/answer`)
- **Display**: Query status, DRG impact, documentation completeness
- **Who Uses**: CDI Specialists, Doctors (answer queries)

#### 7. **Case Management Dashboard** 🏠
- **Location**: `/ehr/{tenant}/case-management`
- **Data Capture**:
  - ✅ Create case management assessments (`POST /case-management/assessments`)
  - ✅ Create discharge plans (`POST /case-management/discharge-plans`)
- **Display**: Pending discharges, utilization reviews, discharge readiness
- **Who Uses**: Case Managers, Social Workers, Doctors

#### 8. **Operating Room Dashboard** 🏥
- **Location**: `/ehr/{tenant}/operating-room`
- **Data Capture**:
  - ✅ Schedule surgical cases (`POST /operating-room/cases`)
  - ✅ Update case status (`PUT /operating-room/cases/:id/status`)
  - ✅ Update documentation (`PUT /operating-room/cases/:id/documentation`)
  - ✅ Cancel cases (`POST /operating-room/cases/:id/cancel`)
  - ✅ Record surgical implants (`POST /operating-room/implants`)
- **Display**: OR schedule, case status, room availability
- **Who Uses**: Surgeons, OR Nurses, Scheduling Staff

#### 9. **PACU Dashboard** 🛏️
- **Location**: `/ehr/{tenant}/pacu`
- **Data Capture**:
  - ✅ Admit to PACU (`POST /anesthesia/pacu/admit`)
  - ✅ Update Aldrete score (`PUT /anesthesia/pacu/:id/aldrete`)
  - ✅ Discharge from PACU (`POST /anesthesia/pacu/:id/discharge`)
- **Display**: Active PACU patients, recovery status, discharge readiness
- **Who Uses**: PACU Nurses, Anesthesiologists

---

### 📊 **Display-Only Modules** (View/Read Only)

These modules primarily DISPLAY data but may have minimal input:

#### 1. **Emergency Department Dashboard** 🚑
- **Location**: `/ehr/{tenant}/emergency-department`
- **Data Capture**:
  - ✅ Register ED visits (`POST /ed/visits`)
  - ✅ Perform triage (`POST /ed/visits/:id/triage`)
  - ✅ Update visit status (`POST /ed/visits/:id/status`)
- **Display**: ED tracking board, wait times, ESI levels, metrics
- **Who Uses**: ED Nurses, Doctors, Triage Staff

---

## 🔗 Workflow Integration

### **Doctor Dashboard Integration**

Doctors can access new modules via **"Advanced Modules"** section:

```typescript
// Located in DoctorDashboard.tsx around line 350-450
{
  title: 'Operating Room',
  description: 'Surgical case scheduling & OR management.',
  route: tenantPath('/operating-room'),
},
{
  title: 'PACU Recovery Unit',
  description: 'Post-anesthesia care monitoring.',
  route: tenantPath('/pacu'),
},
{
  title: 'MAR (BCMA)',
  description: 'Barcode medication administration & safety.',
  route: tenantPath('/mar'),
},
{
  title: 'Blood Bank Management',
  description: 'Blood inventory, type & screen, crossmatch orders & transfusion administration.',
  route: tenantPath('/blood-bank'),
},
{
  title: 'Sepsis Management',
  description: 'SEP-1 bundle tracking, qSOFA & SIRS screening for early sepsis detection & compliance.',
  route: tenantPath('/sepsis'),
},
{
  title: 'Infection Control',
  description: 'HAI surveillance, isolation precautions & antimicrobial stewardship.',
  route: tenantPath('/infection-control'),
},
{
  title: 'Revenue Cycle & Billing',
  description: 'Charge capture, DRG assignment, missed charges detection & revenue optimization.',
  route: tenantPath('/revenue-cycle'),
},
{
  title: 'CDI Program',
  description: 'Physician queries, DRG optimization & documentation improvement.',
  route: tenantPath('/cdi'),
}
```

### **Nurse Dashboard Integration**

Nurses can access new modules via **"Quick Actions"** section:

```typescript
// Located in NurseDashboard.tsx around line 556-562
{ 
  icon: Activity, 
  label: 'Operating Room', 
  desc: 'OR scheduling & surgical cases', 
  action: () => navigate(`/ehr/${tenantSlug}/operating-room`) 
},
{ 
  icon: Bed, 
  label: 'PACU', 
  desc: 'Post-anesthesia care unit', 
  action: () => navigate(`/ehr/${tenantSlug}/pacu`) 
},
{ 
  icon: Package, 
  label: 'MAR (BCMA)', 
  desc: 'Barcode medication administration', 
  action: () => navigate(`/ehr/${tenantSlug}/mar`) 
},
{ 
  icon: Droplets, 
  label: 'Blood Bank', 
  desc: 'Blood inventory & transfusions', 
  action: () => navigate(`/ehr/${tenantSlug}/blood-bank`) 
},
{ 
  icon: AlertTriangle, 
  label: 'Sepsis Management', 
  desc: 'SEP-1 bundle & screening', 
  action: () => navigate(`/ehr/${tenantSlug}/sepsis`) 
},
{ 
  icon: Shield, 
  label: 'Infection Control', 
  desc: 'HAI surveillance & isolation', 
  action: () => navigate(`/ehr/${tenantSlug}/infection-control`) 
}
```

---

## 🔄 Typical Workflows

### **Workflow 1: Surgical Patient Journey**
1. **Doctor** → Operating Room Dashboard → Schedule surgery
2. **OR Staff** → OR Dashboard → Prepare OR, assign team
3. **Anesthesiologist** → Anesthesia Module → Pre-assessment
4. **OR Nurse** → OR Dashboard → Start case, document
5. **PACU Nurse** → PACU Dashboard → Admit patient, monitor
6. **PACU Nurse** → PACU Dashboard → Update Aldrete, discharge

### **Workflow 2: Medication Administration**
1. **Doctor** → Prescription → Create medication order
2. **Nurse** → MAR Dashboard → View scheduled medications
3. **Nurse** → MAR Dashboard → Scan wristband, verify 5 Rights
4. **Nurse** → MAR Dashboard → Administer medication
5. **System** → MAR Dashboard → Record administration, update schedule

### **Workflow 3: Blood Transfusion**
1. **Doctor** → Order → Request blood transfusion
2. **Lab Tech** → Blood Bank Dashboard → Type & screen, crossmatch
3. **Nurse** → Blood Bank Dashboard → Reserve blood unit
4. **Nurse** → Blood Bank Dashboard → Start transfusion, record vitals
5. **Nurse** → Blood Bank Dashboard → Complete transfusion

### **Workflow 4: Sepsis Detection**
1. **Nurse** → Sepsis Dashboard → Perform screening (qSOFA/SIRS)
2. **System** → Sepsis Dashboard → Alert if positive
3. **Doctor** → Sepsis Dashboard → Initiate SEP-1 bundle
4. **Nurse** → Sepsis Dashboard → Complete bundle elements
5. **System** → Sepsis Dashboard → Track compliance

### **Workflow 5: Infection Control**
1. **Nurse** → Infection Control Dashboard → Report infection
2. **Infection Control** → Dashboard → Create surveillance record
3. **Infection Control** → Dashboard → Initiate isolation precautions
4. **Nurse** → Dashboard → Monitor isolation compliance
5. **Doctor** → Dashboard → Review antimicrobial stewardship

---

## 📋 Data Flow Summary

### **Input → Storage → Display**

1. **User Input** (Forms/Modals in Dashboards)
   ↓
2. **API Endpoints** (POST/PUT/PATCH in Controllers)
   ↓
3. **Service Layer** (Business Logic)
   ↓
4. **Database** (TypeORM Entities → PostgreSQL Tables)
   ↓
5. **Display** (GET endpoints → Dashboard Views)

---

## 🎯 Key Points

1. **All new modules are accessible** from both Doctor and Nurse dashboards
2. **Most modules have data capture** - they're not just display-only
3. **Workflow integration** - modules work together (OR → PACU, Prescription → MAR)
4. **Role-based access** - Some modules are primary for specific roles (MAR for nurses, OR for surgeons)
5. **Real-time updates** - Dashboards refresh to show latest data
6. **Back navigation** - All modules have back buttons to return to main dashboard

---

## 🔍 Missing Integration Points

Currently, these modules are **standalone** but could be better integrated:

1. **Patient Context** - Modules don't always show which patient you're working with
2. **Cross-Module Navigation** - Can't jump from OR to PACU for same patient
3. **Unified Patient View** - No single view showing all module data for one patient
4. **Notifications** - No alerts when actions are needed across modules

---

## 📝 Recommendations

1. **Add patient context** to all module headers
2. **Create patient-centric view** linking all module data
3. **Add notifications** for pending actions across modules
4. **Improve cross-module navigation** (e.g., "View in PACU" from OR)
5. **Add quick actions** from patient detail pages to relevant modules

---

*Last Updated: December 5, 2025*


