# Inpatient vs Outpatient Workflow Analysis

**Critical Issue Identified**: Admitted patients shouldn't be in appointment queue

---

## 🏥 **HOW REAL HOSPITALS WORK**

### **OUTPATIENT (Clinic/Office Visits)**
```
Patient Flow:
1. Patient schedules appointment
2. Patient arrives on appointment day
3. Patient pays (pay-per-visit model) ✅ WE HAVE THIS
4. Doctor sees patient in time slot
5. Treatment during appointment
6. Patient leaves
7. Next appointment scheduled if needed

Billing:
- Fee-for-service (per visit)
- Pay-per-visit model ✅ WE IMPLEMENTED THIS
- Appointment-based
- CPT codes for procedures
- ICD-10 for diagnoses

EHR Workflow:
- Appointment schedule
- Daily schedule view
- Time slots
- Patient queue for waiting patients
```

### **INPATIENT (Hospital Admission)**
```
Patient Flow:
1. Patient admitted to hospital
2. Bed assigned
3. Doctor assigned as "Attending Physician"
4. Patient stays 1-10+ days
5. Doctor does daily rounds (NOT appointments)
6. Nurses provide 24/7 care
7. Patient discharged
8. One bill for entire stay

Billing:
- NOT appointment-based
- Billed by admission/stay
- Payment models:
  a) Per Diem: $X per day
  b) DRG (Diagnosis Related Group): Flat fee per diagnosis
  c) Case Rate: Flat fee for procedure
- One payment at discharge
- Covers entire hospitalization

EHR Workflow:
- Census list (all admitted patients)
- Rounds list (my patients)
- NOT in appointment schedule
- NOT time-slot based
- Direct patient access
```

---

## 🏢 **HOW EPIC & CERNER DO IT**

### **Epic EHR**:

**Outpatient** (Ambulatory module):
```
- Appointment schedule
- Time slots
- Patient check-in
- Office visit workflow
```

**Inpatient** (Inpatient module):
```
- "My Patients" list for attending physician
- Census view (all admitted patients)
- Rounds list
- NOT appointment-based
- Direct access to any patient you're attending
```

**Key Feature**: **SEPARATE MODULES**
- Ambulatory ≠ Inpatient
- Different workflows
- Different billing
- Different UI

### **Cerner EHR**:

**PowerChart** (Inpatient):
```
- Census list
- Patient list by attending physician
- Ward/Unit view
- Direct patient access
```

**Millennium** (Outpatient):
```
- Appointment schedule
- Check-in workflow
```

---

## ❌ **OUR CURRENT PROBLEM**

### **Issue**:
```
❌ Admitted patients need appointments for doctor to see them
❌ Mixing inpatient and outpatient workflows
❌ Payment confusion (admission already paid vs per-visit)
❌ No "My Admitted Patients" view for doctors
❌ Nurses assign beds but doctors can't find patients
```

### **Root Cause**:
```
We built:
✅ Great outpatient system (appointments, pay-per-visit)
✅ Great bed management (nurses assign beds)
❌ But: No connection between bed assignment and doctor access
❌ But: No inpatient-specific doctor workflow
```

---

## ✅ **SOLUTION: CREATE INPATIENT MODULE**

### **New View Needed**: "My Admitted Patients" for Doctors

**Location**: Doctor Dashboard → New tab "My Patients"

**Shows**:
```
List of all patients where:
- Doctor is the attending physician
- Patient is currently admitted (status = 'active')
- Grouped by ward/unit

For Each Patient:
- Name, age, admission date
- Bed assignment
- Days admitted
- Latest vitals
- Primary diagnosis
- Quick action buttons
```

**No Appointments Needed**:
```
✅ Doctor clicks patient from "My Patients" list
✅ Same treatment panel opens
✅ Write progress notes
✅ Prescribe medications
✅ Order labs/imaging
✅ All without appointment
```

---

## 💰 **BILLING MODELS**

### **Outpatient** (Already Implemented):
```
✅ Pay-Per-Visit model
✅ Patient pays at each appointment
✅ Fee-for-service
✅ Appointment-based billing
```

### **Inpatient** (Needs Implementation):
```
Option A: Per Diem
- $500 per day (example)
- Calculated at discharge
- Days admitted × daily rate

Option B: DRG-Based
- Flat fee by diagnosis
- Pneumonia = $5,500
- Appendectomy = $12,000
- Regardless of length of stay

Option C: Case Rate
- Flat fee for procedure
- Includes all costs
- Common for surgeries

Recommendation: DRG-Based (most common globally)
```

---

## 🔧 **IMPLEMENTATION PLAN**

### **Phase 1: Database** (Already Done ✅)
```
✅ admissions table exists
✅ attending_provider field exists
✅ admission_status field exists
✅ All we need is there
```

### **Phase 2: Doctor View** (Need to Create)
```
1. Add "My Patients" tab to Doctor Dashboard
2. Query:
   SELECT * FROM admissions 
   WHERE attending_provider = {doctorId}
     AND admission_status = 'active'
   ORDER BY admission_date DESC

3. Display as cards/list
4. Click patient → Open treatment panel
5. Same "Current Appointment" style panel
6. All treatment functions available
```

### **Phase 3: Billing** (Need to Implement)
```
1. Admission creates one bill
2. All charges added to admission bill:
   - Daily room charges
   - Procedures
   - Medications
   - Lab tests
   - Imaging
3. Final bill calculated at discharge
4. DRG code determines reimbursement
5. One payment at discharge
```

### **Phase 4: Connect Workflows**
```
Admission Process:
1. Nurse admits patient
2. Assigns bed
3. Selects attending physician
4. Patient appears in doctor's "My Patients"
5. Doctor sees patient without appointment
6. Treatment continues daily
7. Discharge → Final bill generated
```

---

## 🎯 **RECOMMENDED SOLUTION**

### **Short Term** (1-2 hours):
Create "My Admitted Patients" view in Doctor Dashboard:
```typescript
// New tab in Doctor Dashboard
<Tab name="My Patients">
  {admittedPatients.map(patient => (
    <PatientCard
      onClick={() => openTreatmentPanel(patient)}
      name={patient.name}
      bed={patient.bed}
      daysAdmitted={patient.days}
      diagnosis={patient.diagnosis}
    />
  ))}
</Tab>
```

### **Medium Term** (Future Sprint):
Implement DRG-based billing:
```
- Calculate DRG at discharge
- All charges roll up to admission bill
- One payment at discharge
- Separate from outpatient billing
```

---

## 📊 **COMPARISON**

| Feature | Outpatient | Inpatient |
|---------|-----------|-----------|
| **Access Method** | Appointment schedule | Patient list/Census |
| **Time-Based** | Yes (time slots) | No (anytime access) |
| **Billing** | Per visit | Per admission |
| **Payment** | At arrival | At discharge |
| **Doctor Assignment** | Scheduled | Attending physician |
| **Duration** | 15-60 minutes | 1-10+ days |
| **Location** | Clinic | Hospital bed |

---

## ✅ **WHAT TO BUILD NEXT**

### **Priority 1: "My Admitted Patients" View**
```
Location: Doctor Dashboard → New tab
Query: All active admissions for this doctor
Display: Card/list view
Click: Opens treatment panel (no appointment needed)
Time: 1-2 hours to implement
```

### **Priority 2: Assign Attending Physician**
```
Location: Admission workflow
Field: Select attending physician
Result: Patient appears in that doctor's list
Time: 30 minutes
```

### **Priority 3: Inpatient Billing**
```
Model: DRG-based or per diem
Calculation: At discharge
Payment: One bill for entire stay
Time: 2-3 hours (future sprint)
```

---

## 🎯 **IMMEDIATE ACTION**

**Remove the confusing note** from the patient page and implement "My Patients" view instead!

---

Should I proceed with implementing the "My Admitted Patients" view for doctors? This will solve the workflow confusion and align with how real hospital EHRs work.

