# 💉 Sprint 27: Anesthesia Module

**Duration:** 3 weeks (120 hours)  
**Priority:** CRITICAL 🔴  
**Dependencies:** Sprint 26 (OR Management)  
**Target:** Complete anesthesia documentation from pre-op to PACU

---

## 📋 Sprint Goals

1. Pre-anesthesia patient assessment
2. Anesthesia plan & consent
3. Intraoperative anesthesia record (real-time charting)
4. Post-anesthesia care unit (PACU) documentation
5. Anesthesia billing (ASA physical status, time units)

---

## 🗄️ STAGE 1: Database Schema (Week 1, Day 1)

### **Migration: 011-anesthesia-module.sql**

```sql
-- Pre-Anesthesia Assessment
CREATE TABLE IF NOT EXISTS pre_anesthesia_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgical_case_id UUID NOT NULL REFERENCES surgical_cases(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  
  -- ASA Physical Status Classification
  asa_status VARCHAR(10) CHECK (asa_status IN ('I', 'II', 'III', 'IV', 'V', 'VI', 'E')),
  asa_modifier VARCHAR(10), -- E = Emergency
  
  -- Airway Assessment
  mallampati_score INTEGER CHECK (mallampati_score BETWEEN 1 AND 4),
  mouth_opening VARCHAR(20),
  neck_mobility VARCHAR(50),
  thyromental_distance VARCHAR(20),
  dentition VARCHAR(100),
  airway_risk VARCHAR(20) CHECK (airway_risk IN ('low', 'moderate', 'high')),
  
  -- Cardiovascular
  cardiac_history TEXT,
  cardiac_exam_findings TEXT,
  ecg_findings TEXT,
  recent_ecg_date DATE,
  
  -- Respiratory
  respiratory_history TEXT,
  respiratory_exam_findings TEXT,
  chest_xray_findings TEXT,
  recent_cxr_date DATE,
  
  -- Lab Values
  hemoglobin DECIMAL(4, 1),
  platelet_count INTEGER,
  inr DECIMAL(3, 2),
  creatinine DECIMAL(4, 2),
  glucose INTEGER,
  recent_labs_date DATE,
  
  -- Allergies & Medications
  drug_allergies JSONB DEFAULT '[]'::jsonb,
  current_medications JSONB DEFAULT '[]'::jsonb,
  last_oral_intake TIMESTAMP WITH TIME ZONE,
  npo_status BOOLEAN DEFAULT false,
  
  -- Anesthesia Plan
  planned_anesthesia_type VARCHAR(50) CHECK (planned_anesthesia_type IN 
    ('general', 'regional', 'spinal', 'epidural', 'MAC', 'local', 'combined')),
  planned_airway VARCHAR(50) CHECK (planned_airway IN 
    ('ETT', 'LMA', 'spontaneous', 'mask', 'nasal_cannula')),
  special_considerations TEXT,
  
  -- Risk Assessment
  anesthesia_risk VARCHAR(20) CHECK (anesthesia_risk IN ('low', 'moderate', 'high', 'very_high')),
  risk_factors TEXT,
  
  -- Consent
  anesthesia_consent_obtained BOOLEAN DEFAULT false,
  consent_obtained_by UUID REFERENCES users(id),
  consent_obtained_at TIMESTAMP WITH TIME ZONE,
  
  -- Assessment
  assessed_by UUID NOT NULL REFERENCES users(id),
  assessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Intraoperative Anesthesia Record
CREATE TABLE IF NOT EXISTS anesthesia_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgical_case_id UUID NOT NULL REFERENCES surgical_cases(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  
  -- Times
  anesthesia_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  anesthesia_end_time TIMESTAMP WITH TIME ZONE,
  surgery_start_time TIMESTAMP WITH TIME ZONE,
  surgery_end_time TIMESTAMP WITH TIME ZONE,
  
  -- Anesthesia Type
  anesthesia_type VARCHAR(50) NOT NULL,
  airway_management VARCHAR(50),
  ett_size VARCHAR(10),
  ett_depth VARCHAR(10),
  
  -- Induction
  induction_medications JSONB DEFAULT '[]'::jsonb,
  induction_notes TEXT,
  
  -- Maintenance
  maintenance_technique VARCHAR(50) CHECK (maintenance_technique IN 
    ('inhalational', 'TIVA', 'balanced', 'regional')),
  maintenance_agents JSONB DEFAULT '[]'::jsonb,
  
  -- Monitoring
  monitors_used JSONB DEFAULT '["ECG", "NIBP", "SpO2", "EtCO2", "Temp"]'::jsonb,
  
  -- Medications Given (detailed)
  medications_administered JSONB DEFAULT '[]'::jsonb,
  /* Format: [{
    time: "10:30",
    medication: "Fentanyl",
    dose: "100",
    unit: "mcg",
    route: "IV",
    givenBy: "userId"
  }] */
  
  -- Fluids
  crystalloids_ml INTEGER DEFAULT 0,
  colloids_ml INTEGER DEFAULT 0,
  blood_products JSONB DEFAULT '[]'::jsonb,
  
  -- Blood Loss & Output
  estimated_blood_loss INTEGER, -- mL
  urine_output INTEGER, -- mL
  drain_output INTEGER, -- mL
  
  -- Ventilation
  ventilation_mode VARCHAR(50),
  fio2 DECIMAL(3, 2),
  tidal_volume INTEGER,
  respiratory_rate INTEGER,
  peep INTEGER,
  
  -- Events & Complications
  intraop_events JSONB DEFAULT '[]'::jsonb,
  complications TEXT,
  
  -- Emergence
  emergence_time TIMESTAMP WITH TIME ZONE,
  extubation_time TIMESTAMP WITH TIME ZONE,
  emergence_medications JSONB DEFAULT '[]'::jsonb,
  emergence_notes TEXT,
  
  -- Staff
  anesthesiologist_id UUID NOT NULL REFERENCES users(id),
  crna_id UUID REFERENCES users(id), -- Certified Registered Nurse Anesthetist
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Anesthesia Vitals (Real-time charting)
CREATE TABLE IF NOT EXISTS anesthesia_vitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anesthesia_record_id UUID NOT NULL REFERENCES anesthesia_records(id) ON DELETE CASCADE,
  
  chart_time TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Cardiovascular
  heart_rate INTEGER,
  blood_pressure_systolic INTEGER,
  blood_pressure_diastolic INTEGER,
  blood_pressure_mean INTEGER,
  
  -- Respiratory
  respiratory_rate INTEGER,
  spo2 INTEGER, -- SpO2 percentage
  etco2 INTEGER, -- End-tidal CO2
  
  -- Temperature
  temperature DECIMAL(4, 2),
  
  -- Anesthesia Depth
  bis_value INTEGER, -- Bispectral Index (0-100)
  mac DECIMAL(3, 2), -- Minimum Alveolar Concentration
  
  -- Notes
  notes TEXT,
  
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(anesthesia_record_id, chart_time)
);

-- PACU (Post-Anesthesia Care Unit)
CREATE TABLE IF NOT EXISTS pacu_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgical_case_id UUID NOT NULL REFERENCES surgical_cases(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  anesthesia_record_id UUID REFERENCES anesthesia_records(id),
  
  -- Arrival
  arrival_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  arrival_from VARCHAR(50) DEFAULT 'OR',
  
  -- Aldrete Score (0-10, ≥9 for discharge)
  aldrete_score_admission INTEGER CHECK (aldrete_score_admission BETWEEN 0 AND 10),
  aldrete_score_discharge INTEGER CHECK (aldrete_score_discharge BETWEEN 0 AND 10),
  
  /* Aldrete Components (each 0-2):
     - Activity (muscle movement)
     - Respiration
     - Circulation (BP)
     - Consciousness
     - O2 Saturation
  */
  aldrete_components JSONB,
  
  -- Pain Assessment
  pain_score_admission INTEGER CHECK (pain_score_admission BETWEEN 0 AND 10),
  pain_score_discharge INTEGER CHECK (pain_score_discharge BETWEEN 0 AND 10),
  pain_management JSONB DEFAULT '[]'::jsonb,
  
  -- Nausea/Vomiting
  ponv_score INTEGER CHECK (ponv_score BETWEEN 0 AND 3), -- Post-op nausea/vomiting
  antiemetics_given JSONB DEFAULT '[]'::jsonb,
  
  -- Complications
  complications TEXT,
  interventions JSONB DEFAULT '[]'::jsonb,
  
  -- Discharge
  discharge_time TIMESTAMP WITH TIME ZONE,
  discharged_to VARCHAR(50) CHECK (discharged_to IN ('floor', 'icu', 'stepdown', 'home', 'observation')),
  discharge_criteria_met BOOLEAN DEFAULT false,
  
  -- Staff
  pacu_nurse_id UUID REFERENCES users(id),
  discharge_approved_by UUID REFERENCES users(id),
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Anesthesia Billing
CREATE TABLE IF NOT EXISTS anesthesia_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgical_case_id UUID NOT NULL REFERENCES surgical_cases(id),
  anesthesia_record_id UUID REFERENCES anesthesia_records(id),
  
  -- Billing Codes
  base_units INTEGER NOT NULL, -- ASA base units for procedure
  time_units DECIMAL(4, 2) NOT NULL, -- 15-minute increments
  modifying_units INTEGER DEFAULT 0, -- Physical status, emergency, etc.
  total_units DECIMAL(5, 2) GENERATED ALWAYS AS (base_units + time_units + modifying_units) STORED,
  
  -- CPT Codes
  anesthesia_cpt_code VARCHAR(10),
  modifiers VARCHAR(20), -- e.g., "P3, 23" (Physical status 3, Unusual anesthesia)
  
  -- Time Calculations
  anesthesia_start TIMESTAMP WITH TIME ZONE NOT NULL,
  anesthesia_end TIMESTAMP WITH TIME ZONE NOT NULL,
  total_minutes INTEGER GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (anesthesia_end - anesthesia_start))/60
  ) STORED,
  
  -- Additional Services
  additional_procedures JSONB DEFAULT '[]'::jsonb, -- Central lines, arterial lines, etc.
  
  -- Billing
  conversion_factor DECIMAL(8, 2) DEFAULT 22.00, -- $ per unit
  total_charge DECIMAL(10, 2) GENERATED ALWAYS AS (
    (base_units + time_units + modifying_units) * conversion_factor
  ) STORED,
  
  billed_at TIMESTAMP WITH TIME ZONE,
  billed_by UUID REFERENCES users(id),
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_preanesthesia_case ON pre_anesthesia_assessments(surgical_case_id);
CREATE INDEX idx_preanesthesia_patient ON pre_anesthesia_assessments(patient_id);
CREATE INDEX idx_preanesthesia_assessor ON pre_anesthesia_assessments(assessed_by);

CREATE INDEX idx_anesthesia_record_case ON anesthesia_records(surgical_case_id);
CREATE INDEX idx_anesthesia_record_patient ON anesthesia_records(patient_id);
CREATE INDEX idx_anesthesia_record_provider ON anesthesia_records(anesthesiologist_id);

CREATE INDEX idx_anesthesia_vitals_record ON anesthesia_vitals(anesthesia_record_id);
CREATE INDEX idx_anesthesia_vitals_time ON anesthesia_vitals(chart_time);

CREATE INDEX idx_pacu_case ON pacu_records(surgical_case_id);
CREATE INDEX idx_pacu_patient ON pacu_records(patient_id);
CREATE INDEX idx_pacu_nurse ON pacu_records(pacu_nurse_id);

CREATE INDEX idx_anesthesia_billing_case ON anesthesia_billing(surgical_case_id);

-- Comments
COMMENT ON TABLE pre_anesthesia_assessments IS 'Pre-operative anesthesia evaluation and planning';
COMMENT ON TABLE anesthesia_records IS 'Intraoperative anesthesia documentation';
COMMENT ON TABLE anesthesia_vitals IS 'Real-time vitals charting during anesthesia (every 5 minutes)';
COMMENT ON TABLE pacu_records IS 'Post-anesthesia care unit documentation with Aldrete scoring';
COMMENT ON TABLE anesthesia_billing IS 'Anesthesia billing with ASA base units and time units';

COMMENT ON COLUMN pre_anesthesia_assessments.asa_status IS 'ASA Physical Status: I=Normal, II=Mild systemic disease, III=Severe systemic disease, IV=Severe systemic disease that is constant threat to life, V=Moribund, VI=Brain dead, E=Emergency modifier';
COMMENT ON COLUMN pacu_records.aldrete_score_discharge IS 'Aldrete Score ≥9 required for PACU discharge';
```

### **Seed Data:**
```sql
-- Sample ASA classification reference
-- Will be used in UI as tooltips/guidance
```

**✅ COMMIT:** `feat(sprint27): Add anesthesia database schema`

---

## 🔧 STAGE 2: Backend Development (Week 1-2)

### **Files to Create:**

#### **1. services/anesthesia.service.ts**

**Key Methods:**
- `createPreAnesthesiaAssessment()` - Pre-op evaluation
- `getPreAnesthesiaAssessment()` - Retrieve assessment
- `startAnesthesiaRecord()` - Begin intraop documentation
- `recordVitals()` - Chart vitals every 5 minutes
- `updateAnesthesiaRecord()` - Update medications, events
- `completeAnesthesiaRecord()` - End anesthesia
- `admitToPACU()` - Transfer to PACU
- `updateAldrete Score()` - PACU recovery scoring
- `dischargePACU()` - Discharge from PACU
- `calculateAnesthesiaBilling()` - ASA billing calculation

#### **2. controllers/anesthesia.controller.ts**

**API Endpoints:**
```
POST   /api/anesthesia/pre-assessment - Create pre-op assessment
GET    /api/anesthesia/pre-assessment/:caseId - Get assessment
PUT    /api/anesthesia/pre-assessment/:id - Update assessment

POST   /api/anesthesia/record/start - Start anesthesia record
PUT    /api/anesthesia/record/:id - Update record
POST   /api/anesthesia/record/:id/vitals - Chart vitals
POST   /api/anesthesia/record/:id/medication - Record medication
POST   /api/anesthesia/record/:id/event - Record event
POST   /api/anesthesia/record/:id/complete - Complete anesthesia

POST   /api/anesthesia/pacu/admit - Admit to PACU
GET    /api/anesthesia/pacu/:id - Get PACU record
PUT    /api/anesthesia/pacu/:id/aldrete - Update Aldrete score
POST   /api/anesthesia/pacu/:id/discharge - Discharge from PACU

GET    /api/anesthesia/billing/:caseId - Get billing calculation
```

**✅ COMMIT:** `feat(sprint27): Add anesthesia backend service & controller`

---

## 🎨 STAGE 3: Frontend Development (Week 2-3)

### **Files to Create:**

#### **1. components/PreAnesthesiaAssessmentModal.tsx**

**Features:**
- ASA physical status selector (I-VI with descriptions)
- Airway assessment (Mallampati, mouth opening, etc.)
- Cardiac review
- Respiratory review
- Lab values
- Allergies & medications
- NPO status
- Anesthesia plan
- Risk assessment
- ICD10Picker for comorbidities

**UI Design:**
```
┌────────────────────────────────────────┐
│ 💉 Pre-Anesthesia Assessment          │
├────────────────────────────────────────┤
│ Patient: John Doe (45M)                │
│ Procedure: Laparoscopic Cholecystectomy│
├────────────────────────────────────────┤
│ ASA Physical Status: [Select ▼]       │
│ ○ ASA I - Normal healthy patient      │
│ ○ ASA II - Mild systemic disease      │
│ ● ASA III - Severe systemic disease   │
│ ○ ASA IV - Constant threat to life    │
│ □ Emergency modifier (E)               │
├────────────────────────────────────────┤
│ Airway Assessment:                     │
│ Mallampati: [Class II ▼]              │
│ Mouth Opening: [>3 finger breadths]   │
│ Airway Risk: [🟡 Moderate]            │
├────────────────────────────────────────┤
│ Comorbidities:                         │
│ [Search ICD-10...] 🔍                 │
│ ✓ I10 - Essential hypertension        │
│ ✓ E11.9 - Type 2 diabetes             │
├────────────────────────────────────────┤
│ Anesthesia Plan:                       │
│ Type: [General ▼]                      │
│ Airway: [ETT (Endotracheal tube) ▼]   │
│ Special Considerations: [...]          │
├────────────────────────────────────────┤
│ [Cancel] [Save Assessment]             │
└────────────────────────────────────────┘
```

**✅ COMMIT:** `feat(sprint27): Add pre-anesthesia assessment with ICD10Picker`

#### **2. components/AnesthesiaRecordModal.tsx**

**Features:**
- **Real-time vitals charting** (every 5 min)
- Medication administration log
- Fluid balance tracking
- Event timeline
- Anesthesia depth monitoring
- Quick medication buttons (common drugs)

**UI Design:**
```
┌──────────────────────────────────────────────────┐
│ 💉 Intraoperative Anesthesia Record             │
│ Case: SUR-2025-000123 | Time: 2h 15min          │
├──────────────────────────────────────────────────┤
│ VITALS CHART (Auto-refresh every 5 min)         │
│ ┌──────────────────────────────────────────┐   │
│ │     HR    BP      SpO2   EtCO2   Temp    │   │
│ │ 09:00 75  120/80   98%    35     36.5°C  │   │
│ │ 09:05 78  125/82   99%    36     36.6°C  │   │
│ │ 09:10 80  122/80   98%    35     36.7°C  │   │
│ │ [Add Vitals] [View Graph]                │   │
│ └──────────────────────────────────────────┘   │
├──────────────────────────────────────────────────┤
│ QUICK MEDICATIONS:                               │
│ [Fentanyl] [Propofol] [Rocuronium] [Atropine]  │
│ [Ephedrine] [Glycopyrrolate] [+ Custom]         │
│                                                  │
│ Recent Medications:                              │
│ • 09:05 - Fentanyl 100mcg IV                    │
│ • 09:00 - Propofol 200mg IV                     │
│ • 08:55 - Rocuronium 50mg IV                    │
├──────────────────────────────────────────────────┤
│ FLUID BALANCE:                                   │
│ Crystalloids: 1500mL | Colloids: 0mL            │
│ Blood Loss: 150mL | Urine: 200mL                │
│ [Record Fluids] [Record Blood Loss]             │
├──────────────────────────────────────────────────┤
│ EVENTS:                                          │
│ • 09:10 - Hypotension, gave ephedrine 10mg      │
│ • 08:55 - Intubation successful, ETT 7.5mm      │
│ [+ Add Event]                                    │
├──────────────────────────────────────────────────┤
│ [End Anesthesia] [Print Record]                 │
└──────────────────────────────────────────────────┘
```

**Features:**
- Auto-refresh vitals every 5 min
- Graph view of trends
- Quick medication buttons
- Event timeline
- Fluid balance calculator

**✅ COMMIT:** `feat(sprint27): Add intraoperative anesthesia record with real-time charting`

#### **3. components/PACUDashboard.tsx**

**Features:**
- PACU bed board (like OR board)
- Patient cards with Aldrete scores
- Pain scores
- Quick actions (medications, discharge)
- Color-coded by readiness

**UI Design:**
```
┌─────────────────────────────────────────┐
│ 🛏️ PACU Dashboard                       │
├─────────────────────────────────────────┤
│ Beds: 4 Occupied / 6 Total              │
├─────────────────────────────────────────┤
│ PACU-1 [Occupied - Ready]               │
│ │ John Doe (45M)                        │
│ │ Post-op: Cholecystectomy              │
│ │ Aldrete: 10/10 ✅                     │
│ │ Pain: 2/10                            │
│ │ Time in PACU: 45 min                  │
│ │ [Discharge] [Vitals] [Meds]          │
│                                          │
│ PACU-2 [Occupied - Monitoring]          │
│ │ Jane Smith (62F)                      │
│ │ Post-op: Total Knee                   │
│ │ Aldrete: 8/10 ⚠️                      │
│ │ Pain: 6/10 🔴                         │
│ │ Time in PACU: 25 min                  │
│ │ [Vitals] [Pain Meds] [O2]            │
└─────────────────────────────────────────┘
```

**✅ COMMIT:** `feat(sprint27): Add PACU dashboard with Aldrete scoring`

#### **4. components/AnesthesiaBillingView.tsx**

**Features:**
- ASA base units calculation
- Time units calculation (15-min increments)
- Modifying units (physical status, emergency)
- Total units & charges
- CPT codes
- Auto-calculation from anesthesia record

**UI Design:**
```
┌──────────────────────────────────────────┐
│ 💰 Anesthesia Billing                    │
├──────────────────────────────────────────┤
│ Case: SUR-2025-000123                    │
│ Procedure: Laparoscopic Cholecystectomy  │
├──────────────────────────────────────────┤
│ CPT Code: 00790                          │
│ Base Units: 7                            │
│                                          │
│ Anesthesia Time:                         │
│ Start: 09:00  End: 11:30                │
│ Duration: 150 minutes                    │
│ Time Units: 10 (150min ÷ 15min)         │
│                                          │
│ Modifying Units:                         │
│ ✓ P3 (ASA III): +2 units                │
│ □ Emergency: +2 units                    │
│ Total Modifying: 2                       │
│                                          │
│ TOTAL UNITS: 19                          │
│ × Conversion Factor: $22.00              │
│ = TOTAL CHARGE: $418.00                  │
├──────────────────────────────────────────┤
│ [Generate Bill] [Export]                 │
└──────────────────────────────────────────┘
```

**✅ COMMIT:** `feat(sprint27): Add anesthesia billing with ASA units calculation`

---

## 🧪 STAGE 4: Testing (Week 3)

### **Test Scenarios:**

#### **Test 1: Pre-Anesthesia Assessment**
```
1. Open scheduled surgical case
2. Click "Pre-Anesthesia Assessment"
3. Select ASA status: III (Severe systemic disease)
4. Mallampati: Class II
5. Add comorbidities using ICD10Picker:
   - Search "hypertension" → Select I10
   - Search "diabetes" → Select E11.9
6. Enter airway assessment
7. Plan: General anesthesia, ETT
8. Click "Save Assessment"
✅ Assessment saved
✅ Visible in case detail
✅ ICD-10 codes saved
```

#### **Test 2: Intraoperative Anesthesia Record**
```
1. In OR, click "Start Anesthesia"
2. Confirm start time
3. Record induction medications:
   - Propofol 200mg IV at 09:00
   - Fentanyl 100mcg IV at 09:00
   - Rocuronium 50mg IV at 09:01
4. Chart vitals at 09:05:
   - HR: 75, BP: 120/80, SpO2: 98%, EtCO2: 35
5. Add event: "Intubation successful, ETT 7.5mm"
6. Record fluids: 500mL LR
7. At 09:10, chart next vitals
8. Click "End Anesthesia" at 11:30
✅ Complete anesthesia record
✅ All vitals timestamped
✅ Medications logged
✅ Duration calculated
```

#### **Test 3: PACU Admission**
```
1. Click "Admit to PACU"
2. Arrival Aldrete score: 8/10
3. Pain score: 6/10
4. Record pain medication: Morphine 4mg IV
5. Chart PACU vitals every 15 min
6. Update Aldrete score: 10/10 (ready)
7. Pain score: 2/10
8. Click "Discharge to Floor"
✅ PACU record complete
✅ Discharge criteria met
✅ Patient moved to floor
```

#### **Test 4: Anesthesia Billing**
```
1. Open completed case
2. Click "Generate Anesthesia Bill"
3. Verify:
   - Base units: 7 (for cholecystectomy)
   - Time units: 10 (150 min)
   - Modifying units: 2 (ASA III)
   - Total units: 19
   - Total charge: $418.00
4. Click "Generate Bill"
✅ Bill generated
✅ Added to patient account
✅ Ready for claims
```

**✅ COMMIT:** `test(sprint27): Verify complete anesthesia workflow`

---

## 🎨 STAGE 5: UI/UX Polish (Week 3)

### **Design Requirements:**

**Color Scheme:**
- Primary: Purple/Violet (anesthesia theme)
- Success: Green (stable vitals)
- Warning: Yellow (moderate concerns)
- Danger: Red (critical vitals)

**Components:**
- Glassy cards
- Smooth animations
- Real-time updates
- Clear typography
- Medical icons

**Responsive:**
- Works on tablets (OR iPads)
- Works on phones (monitoring)
- Touch-friendly buttons

**Accessibility:**
- Large buttons for OR use
- High contrast vitals
- Audio alerts (optional)

**✅ COMMIT:** `style(sprint27): Polish anesthesia UI with medical theme`

---

## 📊 STAGE 6: Integration (Week 3)

### **Integrate with:**

1. **OR Dashboard**
   - Link to pre-anesthesia assessment
   - Show anesthesia status in case list

2. **Surgical Case**
   - Anesthesia record accessible from case
   - Anesthesiologist assigned to case

3. **Patient Chart**
   - Anesthesia records in patient history
   - Vital signs from anesthesia in trends

4. **Billing**
   - Anesthesia charges auto-posted
   - ASA billing integrated

**✅ COMMIT:** `feat(sprint27): Integrate anesthesia with OR and billing modules`

---

## ✅ Sprint 27 Definition of Done

- [ ] Database schema created & provisioned
- [ ] Applied to tenant_bulawayo_general
- [ ] 5 anesthesia entities created
- [ ] Anesthesia service with 15+ methods
- [ ] Anesthesia controller with 15+ endpoints
- [ ] Registered in ehr.module.ts
- [ ] Pre-anesthesia assessment modal
- [ ] Anesthesia record modal (real-time)
- [ ] PACU dashboard
- [ ] Aldrete scoring component
- [ ] Anesthesia billing calculator
- [ ] All components use axios directly
- [ ] UI polished (purple/medical theme)
- [ ] No lint/syntax errors
- [ ] Integration with OR module
- [ ] Complete workflow tested
- [ ] Documentation complete
- [ ] All stages committed to git

---

## 🎯 Success Metrics

- ✅ Can perform pre-op anesthesia assessment
- ✅ Can chart intraoperative vitals every 5 min
- ✅ Can document medications & events
- ✅ Can calculate Aldrete scores in PACU
- ✅ Can discharge from PACU when ready
- ✅ Can generate anesthesia billing automatically

---

**Next Sprint:** Sprint 28 (BCMA) - Medication Administration Safety

