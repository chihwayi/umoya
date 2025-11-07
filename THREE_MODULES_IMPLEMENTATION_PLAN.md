# Three Specialist Modules Implementation Plan
## Enhanced LIS, Radiology, and Maternity - Complete Workflows

**Date**: November 2025  
**Goal**: Build rock-solid foundations with 100% workflow coverage and comprehensive test cases  
**Strategy**: Perfect functionality first, AI integration later

---

## 📋 **MODULE 1: Enhanced Laboratory Information System (LIS)**

### **Database Schema Requirements**

#### **1. lab_test_catalog** (New Table)
```sql
- id: UUID PRIMARY KEY
- tenant_id: UUID (for multi-tenant)
- test_code: VARCHAR(50) UNIQUE -- e.g., "CBC", "HBA1C"
- loinc_code: VARCHAR(50) -- Standard LOINC coding
- test_name: VARCHAR(255) -- e.g., "Complete Blood Count"
- category: VARCHAR(100) -- e.g., "Hematology", "Chemistry", "Microbiology"
- specimen_type: VARCHAR(100) -- e.g., "Blood", "Urine", "Sputum"
- specimen_volume: VARCHAR(50) -- e.g., "5mL"
- container_type: VARCHAR(100) -- e.g., "EDTA tube", "Plain tube"
- turnaround_time: INTEGER -- Expected TAT in hours
- cost: DECIMAL(10,2)
- description: TEXT
- clinical_significance: TEXT
- is_active: BOOLEAN DEFAULT true
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### **2. lab_test_components** (New Table)
```sql
- id: UUID PRIMARY KEY
- test_catalog_id: UUID REFERENCES lab_test_catalog(id)
- component_name: VARCHAR(255) -- e.g., "Hemoglobin", "WBC Count"
- component_code: VARCHAR(50)
- loinc_code: VARCHAR(50)
- unit: VARCHAR(50) -- e.g., "g/dL", "10^9/L"
- reference_range_min: DECIMAL(10,4)
- reference_range_max: DECIMAL(10,4)
- reference_range_text: TEXT -- e.g., "Negative", "Not Detected"
- critical_low: DECIMAL(10,4) -- Critical low value
- critical_high: DECIMAL(10,4) -- Critical high value
- age_specific: BOOLEAN DEFAULT false
- gender_specific: BOOLEAN DEFAULT false
- sort_order: INTEGER
```

#### **3. lab_reference_ranges** (New Table)
```sql
- id: UUID PRIMARY KEY
- component_id: UUID REFERENCES lab_test_components(id)
- age_min: INTEGER -- Age in years (null = no minimum)
- age_max: INTEGER -- Age in years (null = no maximum)
- gender: VARCHAR(10) -- 'male', 'female', 'all'
- range_min: DECIMAL(10,4)
- range_max: DECIMAL(10,4)
- range_text: TEXT
- unit: VARCHAR(50)
```

#### **4. lab_order_sets** (New Table)
```sql
- id: UUID PRIMARY KEY
- tenant_id: UUID
- set_name: VARCHAR(255) -- e.g., "Basic Metabolic Panel", "Lipid Panel"
- set_code: VARCHAR(50)
- category: VARCHAR(100)
- description: TEXT
- is_default: BOOLEAN DEFAULT false
- created_by: UUID
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### **5. lab_order_set_items** (New Table)
```sql
- id: UUID PRIMARY KEY
- order_set_id: UUID REFERENCES lab_order_sets(id)
- test_catalog_id: UUID REFERENCES lab_test_catalog(id)
- sort_order: INTEGER
```

#### **6. lab_critical_alerts** (New Table)
```sql
- id: UUID PRIMARY KEY
- tenant_id: UUID
- patient_id: UUID
- lab_order_id: UUID
- component_name: VARCHAR(255)
- result_value: VARCHAR(100)
- critical_range: VARCHAR(100) -- e.g., "<50" or ">500"
- severity: VARCHAR(20) -- 'critical', 'panic'
- alert_status: VARCHAR(20) -- 'pending', 'acknowledged', 'escalated'
- alerted_to: UUID -- User ID who was alerted
- alerted_at: TIMESTAMP
- acknowledged_by: UUID
- acknowledged_at: TIMESTAMP
- acknowledgment_notes: TEXT
- escalated_to: UUID
- escalated_at: TIMESTAMP
- created_at: TIMESTAMP
```

#### **7. Enhance Existing: lab_orders table**
```sql
ADD COLUMN order_set_id: UUID REFERENCES lab_order_sets(id)
ADD COLUMN test_catalog_id: UUID REFERENCES lab_test_catalog(id)
ADD COLUMN ordering_provider: UUID -- User ID
ADD COLUMN clinical_indication: TEXT
ADD COLUMN icd10_codes: TEXT[] -- Array of diagnosis codes
ADD COLUMN specimen_collected_at: TIMESTAMP
ADD COLUMN specimen_received_at: TIMESTAMP
ADD COLUMN result_reported_at: TIMESTAMP
ADD COLUMN result_acknowledged: BOOLEAN DEFAULT false
ADD COLUMN result_acknowledged_by: UUID
ADD COLUMN result_acknowledged_at: TIMESTAMP
```

---

### **API Endpoints (Backend)**

#### **Test Catalog Management**
```
GET    /api/lab/test-catalog              - List all tests
GET    /api/lab/test-catalog/:id          - Get test details with components
POST   /api/lab/test-catalog              - Create new test (admin only)
PATCH  /api/lab/test-catalog/:id          - Update test
DELETE /api/lab/test-catalog/:id          - Deactivate test
GET    /api/lab/test-catalog/search?q=    - Search tests by name/code
GET    /api/lab/test-catalog/category/:category - Get tests by category
```

#### **Order Sets**
```
GET    /api/lab/order-sets                - List all order sets
GET    /api/lab/order-sets/:id            - Get order set with tests
POST   /api/lab/order-sets                - Create order set
PATCH  /api/lab/order-sets/:id            - Update order set
DELETE /api/lab/order-sets/:id            - Delete order set
```

#### **Enhanced Order Management**
```
POST   /api/lab/orders/from-set           - Create orders from order set
GET    /api/lab/orders/:id/status         - Get real-time order status
PATCH  /api/lab/orders/:id/acknowledge    - Acknowledge critical results
GET    /api/lab/orders/patient/:patientId/comparison - Compare results over time
```

#### **Critical Alerts**
```
GET    /api/lab/critical-alerts           - Get all pending critical alerts
GET    /api/lab/critical-alerts/my-alerts - Get alerts for current user
POST   /api/lab/critical-alerts/:id/acknowledge - Acknowledge alert
POST   /api/lab/critical-alerts/:id/escalate - Escalate unacknowledged alert
```

---

### **Frontend Components**

#### **1. TestCatalogManager.tsx** (Admin Component)
- Test catalog CRUD interface
- Component management
- Reference range configuration
- Bulk import from CSV

#### **2. OrderSetManager.tsx** (Admin/Doctor Component)
- Create/edit order sets
- Drag-drop test selection
- Favorite order sets

#### **3. EnhancedLabOrderModal.tsx** (Doctor Component)
- Search/autocomplete for tests
- Quick access to order sets
- Clinical indication entry
- ICD-10 code linking

#### **4. CriticalResultAlertPanel.tsx** (Doctor/Nurse Component)
- Real-time alert notifications
- Acknowledgment workflow
- Alert history

#### **5. AdvancedResultComparison.tsx** (Doctor Component)
- Side-by-side result comparison
- Trend graphs with reference ranges
- Delta check highlighting
- Historical result table

#### **6. LabWorklist.tsx** (Enhanced - Lab Technician)
- Advanced filtering (date, test type, priority)
- Batch result entry
- Turnaround time tracking

---

### **Test Cases for Enhanced LIS**

#### **Test Suite 1: Test Catalog Management**
```
✓ TC-LIS-001: Create new lab test with components
✓ TC-LIS-002: Add age-specific reference ranges
✓ TC-LIS-003: Add gender-specific reference ranges
✓ TC-LIS-004: Set critical values for components
✓ TC-LIS-005: Search tests by name/code
✓ TC-LIS-006: Filter tests by category
✓ TC-LIS-007: Deactivate/reactivate test
```

#### **Test Suite 2: Order Sets**
```
✓ TC-LIS-008: Create order set with multiple tests
✓ TC-LIS-009: Order entire panel with one click
✓ TC-LIS-010: Set default order sets
✓ TC-LIS-011: Update order set membership
✓ TC-LIS-012: Delete order set
```

#### **Test Suite 3: Enhanced Ordering**
```
✓ TC-LIS-013: Order test with autocomplete search
✓ TC-LIS-014: Order from predefined set (e.g., "CBC")
✓ TC-LIS-015: Add clinical indication and ICD-10 codes
✓ TC-LIS-016: Prevent duplicate orders within 24 hours
✓ TC-LIS-017: Schedule future lab orders
```

#### **Test Suite 4: Critical Result Alerts**
```
✓ TC-LIS-018: Generate critical alert when result exceeds threshold
✓ TC-LIS-019: Alert appears in doctor's alert panel
✓ TC-LIS-020: Doctor acknowledges critical result
✓ TC-LIS-021: Escalate unacknowledged alert after 30 minutes
✓ TC-LIS-022: Alert history tracking
✓ TC-LIS-023: Email/SMS notification for critical results
```

#### **Test Suite 5: Result Comparison**
```
✓ TC-LIS-024: View current vs previous results side-by-side
✓ TC-LIS-025: Highlight significant changes (delta check)
✓ TC-LIS-026: Display trend graph with reference ranges
✓ TC-LIS-027: Show all historical results for a component
✓ TC-LIS-028: Export comparison as PDF
```

#### **Test Suite 6: Lab Technician Workflow**
```
✓ TC-LIS-029: Filter orders by date range
✓ TC-LIS-030: Filter by test category
✓ TC-LIS-031: Track turnaround time for orders
✓ TC-LIS-032: Alert for overdue orders
✓ TC-LIS-033: Batch result entry for multiple tests
✓ TC-LIS-034: Result verification workflow for critical values
```

---

## 📋 **MODULE 2: Radiology & Medical Imaging**

### **Database Schema Requirements**

#### **1. imaging_modalities** (New Table)
```sql
- id: UUID PRIMARY KEY
- tenant_id: UUID
- modality_code: VARCHAR(20) -- 'XR', 'CT', 'MRI', 'US', 'MG'
- modality_name: VARCHAR(100) -- 'X-Ray', 'CT Scan', 'MRI', 'Ultrasound'
- description: TEXT
- is_active: BOOLEAN DEFAULT true
```

#### **2. imaging_study_types** (New Table)
```sql
- id: UUID PRIMARY KEY
- tenant_id: UUID
- modality_id: UUID REFERENCES imaging_modalities(id)
- study_code: VARCHAR(50) -- e.g., "CHEST-PA-LAT", "ABDUS"
- study_name: VARCHAR(255) -- e.g., "Chest X-Ray PA & Lateral"
- body_part: VARCHAR(100) -- e.g., "Chest", "Abdomen", "Brain"
- views: TEXT[] -- e.g., ['PA', 'Lateral'] for X-rays
- typical_images: INTEGER -- Expected number of images
- cost: DECIMAL(10,2)
- description: TEXT
- preparation_instructions: TEXT
- is_active: BOOLEAN DEFAULT true
```

#### **3. imaging_orders** (New Table)
```sql
- id: UUID PRIMARY KEY
- tenant_id: UUID
- patient_id: UUID REFERENCES patients(id)
- order_number: VARCHAR(50) UNIQUE
- study_type_id: UUID REFERENCES imaging_study_types(id)
- ordering_provider: UUID REFERENCES users(id)
- clinical_indication: TEXT
- clinical_history: TEXT
- suspected_diagnosis: TEXT
- icd10_codes: TEXT[]
- priority: VARCHAR(20) -- 'routine', 'urgent', 'stat'
- order_status: VARCHAR(30) -- 'ordered', 'scheduled', 'in_progress', 'completed', 'cancelled'
- ordered_at: TIMESTAMP
- scheduled_date: TIMESTAMP
- performed_at: TIMESTAMP
- cancelled_at: TIMESTAMP
- cancellation_reason: TEXT
- created_by: UUID
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### **4. imaging_studies** (New Table)
```sql
- id: UUID PRIMARY KEY
- tenant_id: UUID
- imaging_order_id: UUID REFERENCES imaging_orders(id)
- patient_id: UUID REFERENCES patients(id)
- accession_number: VARCHAR(50) UNIQUE
- study_type_id: UUID REFERENCES imaging_study_types(id)
- study_date: DATE
- study_time: TIME
- technologist: UUID REFERENCES users(id)
- radiologist_assigned: UUID REFERENCES users(id)
- study_status: VARCHAR(30) -- 'in_progress', 'awaiting_report', 'reported', 'signed'
- number_of_images: INTEGER
- study_description: TEXT
- technique: TEXT
- contrast_used: BOOLEAN DEFAULT false
- contrast_type: VARCHAR(100)
- contrast_volume: VARCHAR(50)
- radiation_dose: VARCHAR(50) -- For CT/X-ray
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### **5. imaging_files** (New Table)
```sql
- id: UUID PRIMARY KEY
- tenant_id: UUID
- imaging_study_id: UUID REFERENCES imaging_studies(id)
- file_name: VARCHAR(255)
- file_path: TEXT -- S3/local storage path
- file_type: VARCHAR(20) -- 'DICOM', 'JPEG', 'PNG', 'PDF'
- file_size: BIGINT -- bytes
- image_number: INTEGER -- For multi-image studies
- view_position: VARCHAR(50) -- e.g., 'PA', 'Lateral', 'Axial'
- is_primary: BOOLEAN DEFAULT false
- uploaded_by: UUID
- uploaded_at: TIMESTAMP
```

#### **6. imaging_reports** (New Table)
```sql
- id: UUID PRIMARY KEY
- tenant_id: UUID
- imaging_study_id: UUID REFERENCES imaging_studies(id)
- imaging_order_id: UUID REFERENCES imaging_orders(id)
- patient_id: UUID REFERENCES patients(id)
- report_status: VARCHAR(20) -- 'draft', 'preliminary', 'final', 'amended'
- clinical_history: TEXT
- technique: TEXT
- findings: TEXT
- impression: TEXT
- recommendations: TEXT
- comparison_studies: TEXT -- Reference to previous studies
- critical_findings: TEXT
- is_critical: BOOLEAN DEFAULT false
- drafted_by: UUID REFERENCES users(id) -- Radiologist
- drafted_at: TIMESTAMP
- signed_by: UUID REFERENCES users(id)
- signed_at: TIMESTAMP
- amended_by: UUID REFERENCES users(id)
- amendment_reason: TEXT
- amended_at: TIMESTAMP
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### **7. imaging_report_templates** (New Table)
```sql
- id: UUID PRIMARY KEY
- tenant_id: UUID
- modality_id: UUID REFERENCES imaging_modalities(id)
- study_type_id: UUID REFERENCES imaging_study_types(id)
- template_name: VARCHAR(255)
- template_code: VARCHAR(50)
- technique_template: TEXT
- findings_template: TEXT
- impression_template: TEXT
- created_by: UUID
- is_default: BOOLEAN DEFAULT false
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### **8. imaging_annotations** (New Table)
```sql
- id: UUID PRIMARY KEY
- imaging_file_id: UUID REFERENCES imaging_files(id)
- user_id: UUID REFERENCES users(id)
- annotation_type: VARCHAR(50) -- 'arrow', 'circle', 'rectangle', 'text', 'measurement'
- annotation_data: JSONB -- Coordinates, measurements, etc.
- annotation_text: TEXT
- created_at: TIMESTAMP
```

---

### **API Endpoints (Backend)**

#### **Study Type Management**
```
GET    /api/imaging/modalities             - List all imaging modalities
GET    /api/imaging/study-types            - List all study types
GET    /api/imaging/study-types/:modalityId - Get studies by modality
POST   /api/imaging/study-types            - Create study type (admin)
PATCH  /api/imaging/study-types/:id        - Update study type
```

#### **Order Management**
```
POST   /api/imaging/orders                 - Create imaging order
GET    /api/imaging/orders                 - List orders (filtered)
GET    /api/imaging/orders/:id             - Get order details
PATCH  /api/imaging/orders/:id/schedule    - Schedule order
PATCH  /api/imaging/orders/:id/cancel      - Cancel order
GET    /api/imaging/orders/patient/:patientId - Get patient's imaging orders
```

#### **Study Management**
```
POST   /api/imaging/studies                - Create study from order
GET    /api/imaging/studies                - List studies (worklist)
GET    /api/imaging/studies/:id            - Get study details with images
PATCH  /api/imaging/studies/:id/assign     - Assign radiologist
POST   /api/imaging/studies/:id/images     - Upload images
GET    /api/imaging/studies/:id/images     - Get study images
DELETE /api/imaging/studies/:id/images/:imageId - Delete image
```

#### **Report Management**
```
POST   /api/imaging/reports                - Create report (draft)
GET    /api/imaging/reports/:id            - Get report
PATCH  /api/imaging/reports/:id            - Update report
POST   /api/imaging/reports/:id/sign       - Sign report (finalize)
POST   /api/imaging/reports/:id/amend      - Amend signed report
GET    /api/imaging/reports/templates      - Get report templates
```

#### **Image Viewing**
```
GET    /api/imaging/files/:id/view         - Get image file
GET    /api/imaging/files/:id/thumbnail    - Get thumbnail
POST   /api/imaging/files/:id/annotations  - Add annotation
GET    /api/imaging/files/:id/annotations  - Get annotations
```

---

### **Frontend Components**

#### **1. ImagingOrderModal.tsx** (Doctor Component)
- Search/select study types by modality
- Clinical indication and history entry
- Priority selection
- Schedule future imaging

#### **2. RadiologistWorklist.tsx** (Radiologist Dashboard)
- List of studies awaiting report
- Filter by modality, date, priority
- Assign studies to self
- Quick access to study viewer

#### **3. ImagingViewer.tsx** (Core Viewer Component)
- Display images (DICOM, JPEG, PNG)
- Zoom, pan, window/level controls
- Multi-image carousel for series
- Side-by-side comparison with previous studies
- Annotation tools (arrows, circles, measurements)

#### **4. ReportingInterface.tsx** (Radiologist Component)
- Split view: images on left, report on right
- Report templates dropdown
- Structured reporting fields (technique, findings, impression)
- Critical finding checkbox
- Save draft / Sign report

#### **5. ImagingResultsViewer.tsx** (Doctor Component)
- View completed studies and reports
- Compare with previous imaging
- Acknowledge critical findings
- Print/export reports

#### **6. ImagingDashboard.tsx** (Admin Component)
- Study type management
- Report template management
- Turnaround time metrics
- Radiologist productivity

---

### **Test Cases for Radiology Module**

#### **Test Suite 1: Order Creation**
```
✓ TC-RAD-001: Order chest X-ray with clinical indication
✓ TC-RAD-002: Order CT scan with contrast
✓ TC-RAD-003: Order stat imaging study
✓ TC-RAD-004: Schedule future imaging appointment
✓ TC-RAD-005: Cancel imaging order
✓ TC-RAD-006: View all orders for a patient
```

#### **Test Suite 2: Technologist Workflow**
```
✓ TC-RAD-007: Create study from order
✓ TC-RAD-008: Upload multiple images to study
✓ TC-RAD-009: Mark study as complete
✓ TC-RAD-010: Record contrast administration
✓ TC-RAD-011: Record radiation dose
```

#### **Test Suite 3: Radiologist Workflow**
```
✓ TC-RAD-012: View worklist of unreported studies
✓ TC-RAD-013: Assign study to self
✓ TC-RAD-014: Open study in viewer
✓ TC-RAD-015: View all images in study
✓ TC-RAD-016: Compare with previous study side-by-side
```

#### **Test Suite 4: Image Viewing & Annotation**
```
✓ TC-RAD-017: View DICOM images
✓ TC-RAD-018: Zoom and pan image
✓ TC-RAD-019: Adjust window/level (brightness/contrast)
✓ TC-RAD-020: Add arrow annotation
✓ TC-RAD-021: Add measurement annotation
✓ TC-RAD-022: Save annotations
```

#### **Test Suite 5: Report Generation**
```
✓ TC-RAD-023: Create report from template
✓ TC-RAD-024: Fill structured report fields
✓ TC-RAD-025: Mark critical findings
✓ TC-RAD-026: Save draft report
✓ TC-RAD-027: Sign and finalize report
✓ TC-RAD-028: Amend signed report with reason
```

#### **Test Suite 6: Doctor Results Viewing**
```
✓ TC-RAD-029: View completed imaging reports
✓ TC-RAD-030: View images from report
✓ TC-RAD-031: Acknowledge critical findings
✓ TC-RAD-032: Compare with previous imaging
✓ TC-RAD-033: Print report as PDF
```

#### **Test Suite 7: Workflow & Notifications**
```
✓ TC-RAD-034: Real-time status updates (ordered → in-progress → reported)
✓ TC-RAD-035: Notification when report is signed
✓ TC-RAD-036: Critical finding alert to ordering doctor
✓ TC-RAD-037: Track turnaround time from order to report
```

---

## 📋 **MODULE 3: Maternity & Obstetrics**

### **Database Schema Requirements**

#### **1. maternity_enrollments** (New Table)
```sql
- id: UUID PRIMARY KEY
- tenant_id: UUID
- patient_id: UUID REFERENCES patients(id)
- enrollment_number: VARCHAR(50) UNIQUE
- enrollment_date: DATE
- expected_delivery_date: DATE -- EDD
- edd_method: VARCHAR(50) -- 'LMP', 'Ultrasound', 'Clinical'
- lmp_date: DATE -- Last Menstrual Period
- gestational_age_at_enrollment: INTEGER -- weeks
- gravida: INTEGER -- Total pregnancies
- para: INTEGER -- Deliveries >20 weeks
- parity_term: INTEGER -- Full term deliveries
- parity_preterm: INTEGER -- Preterm deliveries
- parity_abortions: INTEGER -- Spontaneous/induced abortions
- parity_living: INTEGER -- Living children
- previous_cesarean: BOOLEAN DEFAULT false
- previous_complications: TEXT
- current_pregnancy_complications: TEXT
- risk_category: VARCHAR(20) -- 'low', 'medium', 'high'
- enrollment_status: VARCHAR(30) -- 'active', 'delivered', 'transferred_out', 'pregnancy_loss'
- enrolled_by: UUID REFERENCES users(id)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### **2. anc_visits** (New Table)
```sql
- id: UUID PRIMARY KEY
- tenant_id: UUID
- maternity_enrollment_id: UUID REFERENCES maternity_enrollments(id)
- patient_id: UUID REFERENCES patients(id)
- visit_number: INTEGER -- 1-8 (WHO 8-visit model)
- visit_date: DATE
- gestational_age: INTEGER -- weeks
- gestational_age_days: INTEGER -- days
- weight: DECIMAL(5,2) -- kg
- height: DECIMAL(5,2) -- cm (first visit only)
- bmi: DECIMAL(5,2)
- blood_pressure_systolic: INTEGER
- blood_pressure_diastolic: INTEGER
- temperature: DECIMAL(4,2)
- pulse: INTEGER
- respiratory_rate: INTEGER
- fundal_height: DECIMAL(4,1) -- cm
- fetal_heart_rate: INTEGER -- bpm
- fetal_presentation: VARCHAR(50) -- 'cephalic', 'breech', 'transverse'
- fetal_movement: VARCHAR(50) -- 'active', 'reduced', 'absent'
- edema: VARCHAR(50) -- 'none', 'mild', 'moderate', 'severe'
- edema_location: TEXT
- proteinuria: VARCHAR(50) -- 'negative', 'trace', '1+', '2+', '3+', '4+'
- glucose_urine: VARCHAR(50)
- hemoglobin: DECIMAL(4,1) -- g/dL
- blood_group: VARCHAR(10)
- rhesus: VARCHAR(10) -- 'positive', 'negative'
- vdrl_syphilis: VARCHAR(20) -- 'non-reactive', 'reactive'
- hiv_status: VARCHAR(20) -- 'negative', 'positive', 'unknown'
- hep_b_status: VARCHAR(20)
- tetanus_immunization: BOOLEAN
- ipt_malaria: INTEGER -- Number of IPT doses
- iron_folate: BOOLEAN
- deworming: BOOLEAN
- insecticide_treated_net: BOOLEAN
- danger_signs_discussed: BOOLEAN
- birth_plan_discussed: BOOLEAN
- complications_identified: TEXT
- interventions: TEXT
- referral_needed: BOOLEAN
- referral_reason: TEXT
- referral_facility: VARCHAR(255)
- next_visit_date: DATE
- provider: UUID REFERENCES users(id)
- notes: TEXT
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### **3. ultrasound_scans** (New Table)
```sql
- id: UUID PRIMARY KEY
- tenant_id: UUID
- maternity_enrollment_id: UUID REFERENCES maternity_enrollments(id)
- patient_id: UUID REFERENCES patients(id)
- scan_date: DATE
- gestational_age: INTEGER -- weeks
- scan_type: VARCHAR(50) -- 'dating', 'anomaly', 'growth', 'biophysical'
- number_of_fetuses: INTEGER
- fetal_viability: BOOLEAN
- fetal_heartbeat: INTEGER -- bpm
- fetal_presentation: VARCHAR(50)
- placenta_position: VARCHAR(100) -- e.g., 'anterior', 'posterior', 'fundal', 'low-lying'
- amniotic_fluid: VARCHAR(50) -- 'normal', 'oligohydramnios', 'polyhydramnios'
- afi: DECIMAL(4,1) -- Amniotic Fluid Index
- estimated_fetal_weight: DECIMAL(6,2) -- grams
- biparietal_diameter: DECIMAL(4,1) -- mm
- head_circumference: DECIMAL(5,1) -- mm
- abdominal_circumference: DECIMAL(5,1) -- mm
- femur_length: DECIMAL(4,1) -- mm
- anomalies_detected: TEXT
- edd_by_ultrasound: DATE
- findings: TEXT
- performed_by: UUID REFERENCES users(id)
- image_path: TEXT
- created_at: TIMESTAMP
```

#### **4. deliveries** (New Table)
```sql
- id: UUID PRIMARY KEY
- tenant_id: UUID
- maternity_enrollment_id: UUID REFERENCES maternity_enrollments(id)
- patient_id: UUID REFERENCES patients(id)
- delivery_date: DATE
- delivery_time: TIME
- gestational_age_at_delivery: INTEGER -- weeks
- gestational_age_days: INTEGER
- admission_date: TIMESTAMP
- delivery_type: VARCHAR(50) -- 'spontaneous_vaginal', 'assisted_vaginal', 'cesarean', 'instrumental'
- delivery_method: VARCHAR(100) -- e.g., 'forceps', 'vacuum', 'emergency_cs', 'elective_cs'
- indication_for_intervention: TEXT
- labor_onset: VARCHAR(50) -- 'spontaneous', 'induced'
- induction_method: VARCHAR(100)
- duration_of_labor_hours: DECIMAL(4,1)
- rupture_of_membranes: TIMESTAMP
- membrane_rupture_type: VARCHAR(50) -- 'spontaneous', 'artificial'
- anesthesia_type: VARCHAR(50) -- 'none', 'epidural', 'spinal', 'general'
- episiotomy: BOOLEAN
- perineal_tear_degree: VARCHAR(20) -- 'none', 'first', 'second', 'third', 'fourth'
- blood_loss: DECIMAL(6,1) -- mL
- placenta_delivery: VARCHAR(50) -- 'spontaneous', 'manual_removal'
- placenta_complete: BOOLEAN
- maternal_complications: TEXT
- maternal_outcome: VARCHAR(50) -- 'alive_well', 'alive_complications', 'deceased'
- attending_provider: UUID REFERENCES users(id)
- assistant_provider: UUID
- notes: TEXT
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### **5. birth_outcomes** (New Table)
```sql
- id: UUID PRIMARY KEY
- delivery_id: UUID REFERENCES deliveries(id)
- birth_order: INTEGER -- For multiple births (1, 2, 3...)
- birth_outcome: VARCHAR(50) -- 'live_birth', 'stillbirth', 'neonatal_death'
- sex: VARCHAR(20)
- birth_weight: DECIMAL(5,2) -- kg
- birth_length: DECIMAL(4,1) -- cm
- head_circumference: DECIMAL(4,1) -- cm
- apgar_1min: INTEGER
- apgar_5min: INTEGER
- apgar_10min: INTEGER
- resuscitation_required: BOOLEAN
- resuscitation_type: TEXT
- congenital_anomalies: TEXT
- neonatal_complications: TEXT
- breastfeeding_initiated: BOOLEAN
- breastfeeding_within_1hour: BOOLEAN
- vitamin_k_given: BOOLEAN
- eye_prophylaxis_given: BOOLEAN
- newborn_outcome: VARCHAR(50) -- 'alive_well', 'alive_complications', 'neonatal_death'
- time_of_death: TIMESTAMP
- cause_of_death: TEXT
- created_at: TIMESTAMP
```

#### **6. postnatal_visits** (New Table)
```sql
- id: UUID PRIMARY KEY
- tenant_id: UUID
- maternity_enrollment_id: UUID REFERENCES maternity_enrollments(id)
- delivery_id: UUID REFERENCES deliveries(id)
- patient_id: UUID REFERENCES patients(id)
- visit_date: DATE
- days_postpartum: INTEGER
- weight: DECIMAL(5,2)
- blood_pressure_systolic: INTEGER
- blood_pressure_diastolic: INTEGER
- temperature: DECIMAL(4,2)
- pulse: INTEGER
- general_condition: VARCHAR(50) -- 'good', 'fair', 'poor'
- uterine_involution: VARCHAR(50) -- 'normal', 'subinvolution'
- lochia: VARCHAR(50) -- 'normal', 'excessive', 'offensive'
- perineum_condition: VARCHAR(50) -- 'intact', 'healing_well', 'infected'
- breast_condition: VARCHAR(50) -- 'normal', 'engorged', 'mastitis', 'abscess'
- breastfeeding_status: VARCHAR(50) -- 'exclusive', 'mixed', 'formula_only'
- breastfeeding_problems: TEXT
- emotional_status: VARCHAR(50) -- 'normal', 'baby_blues', 'possible_ppd'
- danger_signs: TEXT
- family_planning_discussed: BOOLEAN
- family_planning_method: VARCHAR(100)
- newborn_status: VARCHAR(50) -- 'well', 'complications', 'deceased'
- newborn_complications: TEXT
- provider: UUID REFERENCES users(id)
- notes: TEXT
- next_visit_date: DATE
- created_at: TIMESTAMP
```

#### **7. maternity_risk_factors** (New Table)
```sql
- id: UUID PRIMARY KEY
- maternity_enrollment_id: UUID REFERENCES maternity_enrollments(id)
- risk_factor: VARCHAR(100) -- e.g., 'advanced_maternal_age', 'previous_cesarean', 'hypertension'
- risk_category: VARCHAR(20) -- 'medical', 'obstetric', 'social'
- severity: VARCHAR(20) -- 'low', 'medium', 'high'
- identified_date: DATE
- resolved_date: DATE
- notes: TEXT
- created_by: UUID
- created_at: TIMESTAMP
```

---

### **API Endpoints (Backend)**

#### **Enrollment Management**
```
POST   /api/maternity/enrollments          - Enroll patient in maternity care
GET    /api/maternity/enrollments          - List all maternity patients
GET    /api/maternity/enrollments/:id      - Get enrollment details
PATCH  /api/maternity/enrollments/:id      - Update enrollment
GET    /api/maternity/enrollments/patient/:patientId - Get patient's maternity history
```

#### **ANC Visits**
```
POST   /api/maternity/anc-visits           - Record ANC visit
GET    /api/maternity/anc-visits/enrollment/:enrollmentId - Get all ANC visits
GET    /api/maternity/anc-visits/:id       - Get visit details
PATCH  /api/maternity/anc-visits/:id       - Update visit
```

#### **Ultrasound Scans**
```
POST   /api/maternity/ultrasound-scans     - Record ultrasound
GET    /api/maternity/ultrasound-scans/enrollment/:enrollmentId - Get all scans
PATCH  /api/maternity/ultrasound-scans/:id - Update scan
```

#### **Delivery Management**
```
POST   /api/maternity/deliveries           - Record delivery
GET    /api/maternity/deliveries/:id       - Get delivery details
PATCH  /api/maternity/deliveries/:id       - Update delivery
POST   /api/maternity/deliveries/:id/birth-outcomes - Record birth outcomes
```

#### **Postnatal Care**
```
POST   /api/maternity/postnatal-visits     - Record postnatal visit
GET    /api/maternity/postnatal-visits/enrollment/:enrollmentId - Get all visits
PATCH  /api/maternity/postnatal-visits/:id - Update visit
```

#### **Reporting & Analytics**
```
GET    /api/maternity/indicators           - Get maternal health indicators
GET    /api/maternity/deliveries/summary   - Delivery outcomes dashboard
GET    /api/maternity/anc-coverage         - ANC coverage rates
GET    /api/maternity/high-risk-pregnancies - List high-risk patients
```

---

### **Frontend Components**

#### **1. MaternityEnrollmentModal.tsx**
- Patient enrollment form
- LMP/EDD calculation
- Gravida/Para recording
- Risk assessment

#### **2. ANCVisitForm.tsx**
- WHO 8-visit structured form
- Vitals and measurements
- Lab results entry
- Risk factor identification
- Next visit scheduling

#### **3. UltrasoundRecordForm.tsx**
- Scan type selection
- Biometric measurements
- Findings documentation
- Image upload

#### **4. DeliveryRecordForm.tsx**
- Labor progress tracking
- Delivery details
- Maternal complications
- Birth outcome recording (multiple births support)

#### **5. PostnatalVisitForm.tsx**
- Postpartum assessment
- Breastfeeding support
- Family planning counseling
- Newborn status

#### **6. MaternityDashboard.tsx**
- Active pregnancies list
- ANC visit schedule
- High-risk pregnancy alerts
- Delivery outcomes
- Postnatal follow-up reminders

#### **7. MaternityPatientSummary.tsx**
- Complete pregnancy journey view
- ANC visit timeline
- Ultrasound history
- Risk factors
- Delivery and postnatal summary

---

### **Test Cases for Maternity Module**

#### **Test Suite 1: Enrollment**
```
✓ TC-MAT-001: Enroll pregnant woman with LMP
✓ TC-MAT-002: Calculate EDD from LMP
✓ TC-MAT-003: Record gravida/para history
✓ TC-MAT-004: Identify high-risk pregnancy at enrollment
✓ TC-MAT-005: Update EDD from ultrasound
```

#### **Test Suite 2: ANC Visits**
```
✓ TC-MAT-006: Record first ANC visit (complete assessment)
✓ TC-MAT-007: Record subsequent ANC visits
✓ TC-MAT-008: Track gestational age calculation
✓ TC-MAT-009: Record danger signs
✓ TC-MAT-010: Schedule next ANC visit
✓ TC-MAT-011: Record referral for complications
```

#### **Test Suite 3: Risk Assessment**
```
✓ TC-MAT-012: Identify hypertension risk (BP >140/90)
✓ TC-MAT-013: Flag anemia (Hb <11 g/dL)
✓ TC-MAT-014: Detect proteinuria (pre-eclampsia risk)
✓ TC-MAT-015: Track high-risk pregnancy list
✓ TC-MAT-016: Update risk category when complications arise
```

#### **Test Suite 4: Ultrasound Tracking**
```
✓ TC-MAT-017: Record dating scan (first trimester)
✓ TC-MAT-018: Record anomaly scan (20 weeks)
✓ TC-MAT-019: Record growth scan (third trimester)
✓ TC-MAT-020: Update EDD based on ultrasound
✓ TC-MAT-021: Upload ultrasound images
```

#### **Test Suite 5: Delivery Management**
```
✓ TC-MAT-022: Record spontaneous vaginal delivery
✓ TC-MAT-023: Record cesarean section with indication
✓ TC-MAT-024: Record birth outcomes (single birth)
✓ TC-MAT-025: Record birth outcomes (twins)
✓ TC-MAT-026: Record APGAR scores
✓ TC-MAT-027: Document maternal complications
✓ TC-MAT-028: Record stillbirth
```

#### **Test Suite 6: Postnatal Care**
```
✓ TC-MAT-029: Record day 1 postnatal visit
✓ TC-MAT-030: Record week 1 postnatal visit
✓ TC-MAT-031: Record 6-week postnatal visit
✓ TC-MAT-032: Track breastfeeding status
✓ TC-MAT-033: Screen for postpartum depression
✓ TC-MAT-034: Provide family planning counseling
```

#### **Test Suite 7: Indicators & Reporting**
```
✓ TC-MAT-035: Calculate ANC coverage rate (4+ visits)
✓ TC-MAT-036: Track institutional delivery rate
✓ TC-MAT-037: Monitor cesarean section rate
✓ TC-MAT-038: Track postnatal care coverage
✓ TC-MAT-039: Generate delivery outcomes report
✓ TC-MAT-040: Identify overdue ANC appointments
```

---

## 🎯 **Implementation Strategy**

### **Phase 1: Enhanced LIS (Weeks 1-3)**
- Week 1: Database schema + seed data (test catalog)
- Week 2: Backend APIs + critical alert system
- Week 3: Frontend components + testing

### **Phase 2: Radiology Module (Weeks 4-7)**
- Week 4: Database schema + basic APIs
- Week 5: Image upload/storage + viewer component
- Week 6: Report generation + workflow
- Week 7: Testing + refinement

### **Phase 3: Maternity Module (Weeks 8-11)**
- Week 8: Database schema + enrollment APIs
- Week 9: ANC visit forms + tracking
- Week 10: Delivery + postnatal care
- Week 11: Dashboard + indicators + testing

### **Phase 4: Integration & Polish (Week 12)**
- Cross-module testing
- Performance optimization
- Documentation
- User training materials

---

## ✅ **Success Criteria**

Each module must pass:
1. **All test cases pass** (100% workflow coverage)
2. **No critical bugs** in production scenarios
3. **Performance benchmarks** met (page load <2s, API response <500ms)
4. **User acceptance** from clinical staff
5. **Complete documentation** (API docs, user guides)

---

## 📚 **Documentation Requirements**

For each module:
1. **Database ERD** (entity relationship diagram)
2. **API Documentation** (Swagger/OpenAPI)
3. **User Guide** (with screenshots)
4. **Test Results** (all test cases executed)
5. **Deployment Guide**

---

*Ready to begin implementation! Starting with Enhanced LIS database schema...*

