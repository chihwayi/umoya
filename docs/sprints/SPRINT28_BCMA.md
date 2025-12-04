# 💊 Sprint 28: Barcode Medication Administration (BCMA)

**Duration:** 3 weeks (120 hours)  
**Priority:** CRITICAL 🔴 (Patient Safety)  
**Dependencies:** Prescriptions, Pharmacy, Inpatient  
**Target:** Prevent medication errors with barcode verification

---

## 📋 Sprint Goals

Implement the "5 Rights" of medication administration:
1. **Right Patient** - Barcode scan verification
2. **Right Drug** - Barcode scan verification
3. **Right Dose** - Auto-verification
4. **Right Route** - Verification prompt
5. **Right Time** - Scheduled time checking

**Impact:** Reduce medication errors by 85% (per research)

---

## 🗄️ STAGE 1: Database Schema (Week 1, Day 1)

### **Migration: 012-bcma-medication-administration.sql**

```sql
-- Medication Administration Records (MAR)
CREATE TABLE IF NOT EXISTS medication_administrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Prescription Info
  prescription_id UUID NOT NULL REFERENCES prescriptions(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  admission_id UUID REFERENCES admissions(id),
  
  -- Medication
  medication_name VARCHAR(255) NOT NULL,
  medication_barcode VARCHAR(100), -- NDC or hospital barcode
  dose VARCHAR(100) NOT NULL,
  route VARCHAR(50) NOT NULL,
  frequency VARCHAR(100),
  
  -- Scheduled vs Actual
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  administered_time TIMESTAMP WITH TIME ZONE,
  
  -- Administration Status
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'administered', 'held', 'refused', 'missed', 'cancelled'
  )),
  
  -- Verification (5 Rights)
  patient_barcode_scanned VARCHAR(100),
  medication_barcode_scanned VARCHAR(100),
  verification_passed BOOLEAN DEFAULT false,
  verification_failures JSONB DEFAULT '[]'::jsonb,
  
  -- Override
  verification_override BOOLEAN DEFAULT false,
  override_reason TEXT,
  override_by UUID REFERENCES users(id),
  
  -- Administration Details
  administered_by UUID REFERENCES users(id),
  witnessed_by UUID REFERENCES users(id),
  administration_site VARCHAR(100),
  
  -- Patient Response
  patient_response VARCHAR(50) CHECK (patient_response IN ('tolerated', 'adverse_reaction', 'refused', 'not_assessed')),
  adverse_reaction_notes TEXT,
  
  -- Reasons for Hold/Refuse/Miss
  hold_reason TEXT,
  refusal_reason TEXT,
  missed_reason TEXT,
  
  -- Documentation
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Patient Barcodes/Wristbands
CREATE TABLE IF NOT EXISTS patient_wristbands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  admission_id UUID REFERENCES admissions(id),
  
  barcode VARCHAR(100) UNIQUE NOT NULL,
  barcode_type VARCHAR(50) DEFAULT 'CODE128',
  
  -- Wristband Info
  wristband_number VARCHAR(50),
  printed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  printed_by UUID REFERENCES users(id),
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  deactivated_at TIMESTAMP WITH TIME ZONE,
  deactivation_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Medication Barcodes (Hospital Drug Library)
CREATE TABLE IF NOT EXISTS medication_barcodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  medication_name VARCHAR(255) NOT NULL,
  generic_name VARCHAR(255),
  brand_name VARCHAR(255),
  
  -- Barcodes
  ndc VARCHAR(20), -- National Drug Code
  hospital_barcode VARCHAR(100),
  upc VARCHAR(20),
  
  -- Details
  strength VARCHAR(100),
  dosage_form VARCHAR(100),
  route VARCHAR(50),
  manufacturer VARCHAR(255),
  
  -- Inventory
  is_available BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(ndc)
);

-- BCMA Alerts & Events
CREATE TABLE IF NOT EXISTS bcma_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_administration_id UUID REFERENCES medication_administrations(id),
  
  alert_type VARCHAR(50) CHECK (alert_type IN (
    'wrong_patient', 'wrong_medication', 'wrong_dose', 'wrong_route', 'wrong_time',
    'high_alert_drug', 'allergy_interaction', 'duplicate_dose', 'early_dose', 'late_dose'
  )),
  severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  alert_message TEXT NOT NULL,
  
  -- Response
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  action_taken TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MAR (Medication Administration Record) - Historical View
CREATE TABLE IF NOT EXISTS mar_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  admission_id UUID REFERENCES admissions(id),
  
  medication_name VARCHAR(255) NOT NULL,
  dose VARCHAR(100),
  route VARCHAR(50),
  
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  administered_time TIMESTAMP WITH TIME ZONE,
  administered_by_name VARCHAR(255),
  status VARCHAR(50),
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_med_admin_prescription ON medication_administrations(prescription_id);
CREATE INDEX idx_med_admin_patient ON medication_administrations(patient_id);
CREATE INDEX idx_med_admin_scheduled ON medication_administrations(scheduled_time);
CREATE INDEX idx_med_admin_status ON medication_administrations(status);
CREATE INDEX idx_med_admin_nurse ON medication_administrations(administered_by);

CREATE INDEX idx_wristband_patient ON patient_wristbands(patient_id);
CREATE INDEX idx_wristband_barcode ON patient_wristbands(barcode);
CREATE INDEX idx_wristband_active ON patient_wristbands(is_active);

CREATE INDEX idx_med_barcode_ndc ON medication_barcodes(ndc);
CREATE INDEX idx_med_barcode_name ON medication_barcodes(medication_name);

CREATE INDEX idx_bcma_alert_med_admin ON bcma_alerts(medication_administration_id);
CREATE INDEX idx_bcma_alert_type ON bcma_alerts(alert_type);
CREATE INDEX idx_bcma_alert_severity ON bcma_alerts(severity);

-- Comments
COMMENT ON TABLE medication_administrations IS 'Barcode-verified medication administration records';
COMMENT ON TABLE patient_wristbands IS 'Patient identification wristbands with barcodes';
COMMENT ON TABLE medication_barcodes IS 'Hospital medication library with NDC/barcode mapping';
COMMENT ON TABLE bcma_alerts IS 'Real-time medication administration alerts and warnings';

COMMENT ON COLUMN medication_administrations.verification_passed IS 'True if all 5 Rights verified via barcode scanning';
COMMENT ON COLUMN medication_administrations.verification_override IS 'True if nurse overrode verification failures (requires documentation)';
```

### **Seed Data:**
```sql
-- Sample medication barcodes (common hospital drugs)
INSERT INTO medication_barcodes (medication_name, generic_name, ndc, strength, dosage_form, route) VALUES
('Tylenol', 'Acetaminophen', '50580-0488-01', '325mg', 'Tablet', 'PO'),
('Morphine Sulfate', 'Morphine', '00409-1234-01', '10mg/mL', 'Injectable', 'IV'),
('Normal Saline', 'Sodium Chloride 0.9%', '00338-0048-04', '1000mL', 'IV Bag', 'IV'),
('Vancomycin', 'Vancomycin', '00409-4455-02', '1g', 'IV Solution', 'IV'),
('Insulin Regular', 'Insulin Human', '00002-8215-01', '100 units/mL', 'Injectable', 'SubQ')
ON CONFLICT (ndc) DO NOTHING;
```

**✅ COMMIT:** `feat(sprint28): Add BCMA database schema with 5 Rights verification`

---

## 🔧 STAGE 2: Backend Development (Week 1)

### **Files to Create:**

#### **1. services/bcma.service.ts**

**Key Methods:**
```typescript
async generatePatientWristband(patientId, admissionId, userId, tenantDb) {
  // Generate unique barcode
  // Print wristband
  // Return barcode for scanning
}

async scanPatientWristband(barcode, tenantDb) {
  // Verify patient identity
  // Return patient details
}

async verifyMedication(patientBarcode, medicationBarcode, prescriptionId, tenantDb) {
  // Verify 5 Rights:
  // 1. Right Patient (barcode match)
  // 2. Right Medication (barcode match)
  // 3. Right Dose (prescription match)
  // 4. Right Route (prescription match)
  // 5. Right Time (within window)
  
  // Return verification result + any alerts
}

async recordAdministration(administrationData, userId, tenantDb) {
  // Save administration record
  // Update prescription status
  // Log to MAR
}

async getMARForPatient(patientId, date, tenantDb) {
  // Get Medication Administration Record for date
  // Group by scheduled times
  // Show status (given, held, refused, missed)
}

async handleMissedDose(administrationId, reason, userId, tenantDb) {
  // Mark as missed
  // Alert prescriber
  // Document reason
}
```

#### **2. controllers/bcma.controller.ts**

**API Endpoints:**
```
POST   /api/bcma/wristband/generate - Generate patient wristband
POST   /api/bcma/scan/patient - Scan patient barcode
POST   /api/bcma/scan/medication - Scan medication barcode
POST   /api/bcma/verify - Verify 5 Rights
POST   /api/bcma/administer - Record administration
GET    /api/bcma/mar/:patientId - Get MAR for patient
PUT    /api/bcma/administration/:id/hold - Hold medication
PUT    /api/bcma/administration/:id/refuse - Patient refused
PUT    /api/bcma/administration/:id/missed - Mark as missed
GET    /api/bcma/alerts/:patientId - Get active alerts
GET    /api/bcma/due-medications - Get due medications (dashboard)
```

**✅ COMMIT:** `feat(sprint28): Add BCMA backend with verification logic`

---

## 🎨 STAGE 3: Frontend Development (Week 2)

### **Files to Create:**

#### **1. pages/BCMADashboard.tsx**

**Features:**
- List of patients with due medications
- Filter by ward/unit
- Highlight overdue medications (red)
- Click patient → open MAR

**UI Design:**
```
┌──────────────────────────────────────────┐
│ 💊 Medication Administration            │
├──────────────────────────────────────────┤
│ Ward: [ICU ▼] Time: 11:00 AM            │
│ Due Now: 12 | Overdue: 3 🔴             │
├──────────────────────────────────────────┤
│ 🔴 OVERDUE (30+ min)                    │
│ │ John Doe - ICU-01                     │
│ │ └ Vancomycin 1g IV (Due: 10:00)      │
│ │ [Administer Now]                      │
│                                          │
│ 🟡 DUE SOON (Next 30 min)               │
│ │ Jane Smith - ICU-02                   │
│ │ └ Morphine 4mg IV (Due: 11:15)       │
│ │ [Prepare]                             │
│                                          │
│ 🟢 UPCOMING                              │
│ │ Bob Johnson - ICU-03                  │
│ │ └ Insulin 10u SubQ (Due: 12:00)      │
└──────────────────────────────────────────┘
```

**✅ COMMIT:** `feat(sprint28): Add BCMA dashboard with due medications list`

#### **2. components/MedicationAdministrationModal.tsx**

**Features:**
- **STEP 1: Scan Patient Wristband**
  - Barcode scanner input
  - Manual entry fallback
  - Patient verification display
  
- **STEP 2: Scan Medication**
  - Medication barcode input
  - Medication details display
  - 5 Rights verification checkboxes
  
- **STEP 3: Administer**
  - Administration site
  - Witness (if required)
  - Patient response
  - Notes

**UI Design:**
```
┌──────────────────────────────────────────┐
│ 💊 Administer Medication                │
├──────────────────────────────────────────┤
│ STEP 1: Scan Patient                     │
│ ┌────────────────────────────────────┐  │
│ │ 📷 [Scan Barcode]                  │  │
│ │ Or enter manually: [________]      │  │
│ └────────────────────────────────────┘  │
│                                          │
│ ✅ Patient Verified:                    │
│ Name: John Doe                           │
│ DOB: 01/15/1980                          │
│ MRN: 12345                               │
├──────────────────────────────────────────┤
│ STEP 2: Scan Medication                 │
│ ┌────────────────────────────────────┐  │
│ │ 📷 [Scan Medication Barcode]       │  │
│ └────────────────────────────────────┘  │
│                                          │
│ ✅ Medication Verified:                 │
│ Vancomycin 1g in NS 250mL                │
│ NDC: 00409-4455-02                       │
├──────────────────────────────────────────┤
│ 5 RIGHTS VERIFICATION:                   │
│ ✅ Right Patient: John Doe               │
│ ✅ Right Medication: Vancomycin 1g       │
│ ✅ Right Dose: 1g (matches order)        │
│ ✅ Right Route: IV (matches order)       │
│ ✅ Right Time: Due 11:00 (Now: 11:05)    │
│                                          │
│ ✅ All verifications passed!             │
├──────────────────────────────────────────┤
│ Administration Site: [Left AC ▼]        │
│ Patient Response: [Tolerated ▼]         │
│ Notes: [Optional...]                     │
│                                          │
│ [Cancel] [Administer Medication] ✅      │
└──────────────────────────────────────────┘
```

**Alert Examples:**
```
🔴 CRITICAL ALERT:
Wrong Patient!
Barcode: 12345 (Jane Smith)
Expected: 67890 (John Doe)
[Cannot Proceed]

⚠️ WARNING:
Medication Due: 10:00 AM
Current Time: 11:30 AM
This dose is 90 minutes late!
Continue? [Yes] [No]

🟡 CAUTION:
High-Alert Medication: Insulin
Double-check dose with witness
Witness Name: [_______]
[Proceed with Witness]
```

**✅ COMMIT:** `feat(sprint28): Add medication administration modal with 5 Rights verification`

#### **3. components/MARSheet.tsx** (Medication Administration Record)

**Features:**
- Grid view of all scheduled medications
- Rows = medications
- Columns = times (08:00, 12:00, 16:00, 20:00, etc.)
- Click cell to administer
- Color coding:
  - White = scheduled
  - Green = administered on time
  - Yellow = administered late
  - Red = missed
  - Gray = held

**UI Design:**
```
┌────────────────────────────────────────────────────────────┐
│ Medication Administration Record (MAR)                     │
│ Patient: John Doe | Date: Dec 4, 2025                      │
├────────────────────────────────────────────────────────────┤
│ Medication       | 08:00 | 12:00 | 16:00 | 20:00 | Notes  │
├────────────────────────────────────────────────────────────┤
│ Vancomycin 1g IV │  ✅   │  ✅   │  ⏰   │  📅  │        │
│                  │  JD   │  JD   │       │       │        │
│                  │ 08:05 │ 12:10 │       │       │        │
├────────────────────────────────────────────────────────────┤
│ Morphine 4mg IV  │  ✅   │  ❌   │       │       │ Held   │
│ PRN              │  JD   │  JD   │       │       │ Pain 2/10│
│                  │ 08:30 │ Held  │       │       │        │
├────────────────────────────────────────────────────────────┤
│ Insulin 10u SubQ │  ✅   │       │  ✅   │       │        │
│ AC + HS          │  JD   │       │  JD   │       │        │
│                  │ 08:00 │       │ 16:05 │       │        │
└────────────────────────────────────────────────────────────┘

Legend:
✅ = Administered on time
⏰ = Due now
📅 = Scheduled
❌ = Held/Refused
🔴 = Missed
```

**✅ COMMIT:** `feat(sprint28): Add MAR sheet with grid view`

#### **4. components/WristbandGenerator.tsx**

**Features:**
- Generate barcode for patient
- Print wristband
- Barcode preview
- Expiration date
- Deactivate old bands

**UI Design:**
```
┌──────────────────────────────────┐
│ 🏷️ Generate Patient Wristband   │
├──────────────────────────────────┤
│ Patient: John Doe                │
│ MRN: 12345                       │
│ DOB: 01/15/1980                  │
│ Admission: ADM-2025-000456       │
├──────────────────────────────────┤
│ Barcode:                         │
│ ┌──────────────────────────────┐│
│ │ ||||| |||| ||||| |||| |||||  ││
│ │     PAT-202512040001          ││
│ └──────────────────────────────┘│
│                                  │
│ Expires: Dec 4, 2025 (Discharge) │
│                                  │
│ Previous Wristbands:             │
│ • PAT-202512030001 (Deactivated) │
│                                  │
│ [Print Wristband] [Generate New] │
└──────────────────────────────────┘
```

**✅ COMMIT:** `feat(sprint28): Add patient wristband generator with barcode`

#### **5. components/BarcodeScanner.tsx** (Reusable Component)

**Features:**
- Camera access for scanning
- Manual entry fallback
- Beep/vibration on success
- Works on mobile devices
- Quick scan mode

**Props:**
```typescript
interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  placeholder?: string;
  type: 'patient' | 'medication' | 'generic';
  autoFocus?: boolean;
}
```

**✅ COMMIT:** `feat(sprint28): Add barcode scanner component (camera + manual)`

---

## 🧪 STAGE 4: Testing (Week 3)

### **Test Scenarios:**

#### **Test 1: Generate Wristband**
```
1. Admit patient to ICU
2. Click "Generate Wristband"
3. Barcode generated: PAT-202512040001
4. Click "Print"
5. Wristband sent to printer
✅ Barcode stored in database
✅ Ready for scanning
```

#### **Test 2: Successful Administration**
```
1. Open BCMA Dashboard
2. See "Vancomycin 1g IV - Due: 11:00"
3. Click "Administer"
4. Scan patient wristband: PAT-202512040001
5. ✅ Patient verified: John Doe
6. Scan medication: NDC 00409-4455-02
7. ✅ Medication verified: Vancomycin 1g
8. ✅ All 5 Rights verified
9. Select IV site: "Left AC"
10. Click "Administer"
11. Record patient response: "Tolerated"
✅ Medication marked as administered
✅ MAR updated (green checkmark)
✅ Next dose scheduled
```

#### **Test 3: Wrong Patient Alert**
```
1. Click "Administer" for John Doe's medication
2. Scan WRONG patient: Jane Smith
3. 🔴 CRITICAL ALERT: Wrong Patient!
4. Barcode: PAT-202512040002 (Jane Smith)
5. Expected: PAT-202512040001 (John Doe)
6. [Cannot Proceed] button disabled
✅ Administration blocked
✅ Alert logged
✅ Near-miss prevented
```

#### **Test 4: Held Medication**
```
1. Click cell in MAR for Morphine 4mg
2. Click "Hold Medication"
3. Select reason: "Pain score <3"
4. Add note: "Patient comfortable, no pain"
5. Click "Hold"
✅ Status: Held
✅ Reason documented
✅ Prescriber notified
```

#### **Test 5: High-Alert Drug**
```
1. Scan patient
2. Scan Insulin barcode
3. ⚠️ HIGH-ALERT MEDICATION
4. "Insulin requires independent double-check"
5. Enter witness nurse name
6. Witness scans their badge
7. Verify dose: 10 units
8. Click "Administer with Witness"
✅ Both nurses documented
✅ Double-check recorded
```

**✅ COMMIT:** `test(sprint28): Verify 5 Rights verification and alerts`

---

## 🎨 STAGE 5: UI/UX Polish (Week 3)

### **Design Requirements:**

**Color Scheme:**
- Primary: Blue (safety/trust)
- Success: Green (verified)
- Warning: Yellow (caution)
- Danger: Red (stop/error)

**Verification UI:**
- Large checkmarks when verified ✅
- Red X when failed ❌
- Animations on scan success
- Haptic feedback (mobile)
- Audio beep on scan

**MAR Sheet:**
- Print-friendly
- Color-coded cells
- Initials in cells
- Hover for details
- Click to administer

**Barcode Scanner:**
- Camera preview
- Scan line animation
- Auto-focus on barcode
- Manual entry always available

**✅ COMMIT:** `style(sprint28): Polish BCMA UI with safety-focused design`

---

## 📊 STAGE 6: Safety Features (Week 3)

### **Implement:**

**1. Alert System:**
```typescript
// High-alert medications
const HIGH_ALERT_DRUGS = [
  'Insulin', 'Heparin', 'Warfarin', 'Potassium Chloride',
  'Opioids', 'Chemotherapy', 'Neuromuscular Blockers'
];

// Automatic alerts
- Allergy check (cross-reference patient allergies)
- Duplicate dose detection (same drug within timeframe)
- Drug-drug interactions (basic)
- Extreme doses (outside normal range)
```

**2. Verification Override:**
```typescript
// If barcode scanner broken
- Allow manual entry with REASON
- Require supervisor approval
- Log as override
- Flag for review
```

**3. Missed Dose Tracking:**
```typescript
// Auto-detect missed medications
- If >30min past due and not given
- Send alert to nurse
- Notify prescriber
- Document reason
```

**✅ COMMIT:** `feat(sprint28): Add safety alerts and override management`

---

## ✅ Sprint 28 Definition of Done

- [ ] Database schema created & provisioned
- [ ] Applied to tenant_bulawayo_general
- [ ] Patient wristband generation working
- [ ] Medication barcode library seeded
- [ ] 5 Rights verification logic implemented
- [ ] BCMA service with 12+ methods
- [ ] BCMA controller with 10+ endpoints
- [ ] Registered in ehr.module.ts
- [ ] BCMA dashboard created
- [ ] MAR sheet component
- [ ] Medication administration modal
- [ ] Barcode scanner component
- [ ] Wristband generator
- [ ] Alert system functional
- [ ] High-alert drug warnings
- [ ] All components use axios directly
- [ ] UI polished (safety-focused)
- [ ] No lint/syntax errors
- [ ] Complete workflow tested
- [ ] Near-miss prevention verified
- [ ] Documentation complete
- [ ] All stages committed to git

---

## 🎯 Success Metrics

### **Safety:**
- ✅ 100% patient verification before administration
- ✅ 100% medication verification
- ✅ Zero wrong-patient administrations
- ✅ All high-alert drugs flagged

### **Efficiency:**
- ✅ Administration time <2 minutes
- ✅ Barcode scan success rate >95%
- ✅ MAR updates in real-time

### **Compliance:**
- ✅ All 5 Rights documented
- ✅ Witness verification for high-alert drugs
- ✅ Complete audit trail

---

## 📦 Deliverables

**Database:**
- `database/migrations/012-bcma-medication-administration.sql`
- `database/seeds/medication-barcode-library.sql`

**Backend:**
- `services/ehr-service/src/services/bcma.service.ts`
- `services/ehr-service/src/controllers/bcma.controller.ts`
- `services/ehr-service/src/entities/medication-administration.entity.ts`
- `services/ehr-service/src/entities/patient-wristband.entity.ts`
- `services/ehr-service/src/dto/bcma.dto.ts`

**Frontend:**
- `ehr-frontend/src/pages/BCMADashboard.tsx`
- `ehr-frontend/src/components/MedicationAdministrationModal.tsx`
- `ehr-frontend/src/components/MARSheet.tsx`
- `ehr-frontend/src/components/WristbandGenerator.tsx`
- `ehr-frontend/src/components/BarcodeScanner.tsx`

---

**Next Sprint:** Sprint 29 (Blood Bank) - Transfusion Safety

