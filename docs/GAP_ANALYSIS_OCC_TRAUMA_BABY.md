# Umoya EHR — Gap Analysis: Occupational Medicine, Trauma Centre Borrowdale & World-Class Baby Clinic

**Prepared:** 2026-06-23  
**Scope:** Three capability audits against external benchmarks, with AI/CDSS enhancement mapping and sprint-readiness notes for every gap  
**Based on:** Research from ACOEM, US News pediatric rankings, AAP 2026 guidelines, and traumazim.com live content

---

## How to Read This Document

Each gap entry follows this pattern:

| Field | Meaning |
|---|---|
| **Status** | `MISSING` = not in system at all; `PARTIAL` = some foundation exists but key workflows are absent |
| **New Module?** | Whether a new `enabledModules` key and dedicated controller/service are required |
| **AI/CDSS Opportunity** | How the CDSS service and clinical LLM layer can make this feature excellent, not just adequate |
| **Sprint Weight** | Estimated sprint count (1 sprint ≈ 1 focused implementation week) |

---

---

# PART 1 — OCCUPATIONAL MEDICINE

## Background

Occupational and Environmental Medicine (OEM) is a distinct clinical specialty focused on the prevention and management of work-related injuries, illnesses, and exposures. It bridges public health, clinical medicine, regulatory compliance (OSHA, DOT, national labour law), and employer–employee relationships. No OEM capability currently exists anywhere in Umoya — there is no module key, no controller, no provisioning bundle, and no CDSS logic for it.

For Zimbabwe this maps directly to NSSA (National Social Security Authority) obligations, ZIMS (Zimbabwe Integrated Management System) injury reporting, the Factories and Works Act, and emerging corporate health programmes at mining, agriculture, and manufacturing companies — a large, billable enterprise market segment.

---

## Gap 1.1 — Occupational Medicine Core Module

**Status:** `MISSING`  
**New Module?** Yes — `occupational_medicine`

### What Is Missing

A dedicated Occupational Medicine module must be created as a first-class citizen in the system. It must manage:

- **Employer / Corporate Client Register** — companies that send employees for medical services. Each employer record holds: company name, industry sector, NSSA employer number, contact persons, contracted services, billing arrangements, and linked employees.
- **Employee–Patient Linkage** — a patient can simultaneously be a regular patient and an employer-linked employee, with separate consent scopes for employer-visible vs. clinically confidential data.
- **Pre-Employment Physicals** — structured encounter type: vision, hearing, musculoskeletal screen, cardiovascular screen, substance screen, work-specific task capacity tests. Produces a standardised fitness certificate.
- **Periodic Medical Surveillance** — repeat physicals at defined intervals (6-monthly, annually) per hazard class. System auto-schedules and alerts when an employee is overdue.
- **Fitness-for-Duty (FFD) Evaluations** — rapid, structured assessment of whether a specific employee can return to a specific job after illness, injury, or absence. Outputs a tiered certificate: `Fit`, `Fit with restrictions`, `Temporarily unfit`, `Permanently unfit`. Restrictions are job-task-specific (e.g., no heights, no vibrating tools, limited lifting).
- **Functional Capacity Evaluation (FCE)** — detailed musculoskeletal and strength testing protocol, typically performed by physiotherapy in collaboration with occupational medicine.
- **Aviation Medicine / Aeromedical Certification** — full Class 1, Class 2, and LAPL (Light Aircraft Pilot Licence) medical examination workflows per CAAZ (Civil Aviation Authority of Zimbabwe) and ICAO requirements: ECG, spirometry, vision/colour perception, ENT, cardiovascular, urinalysis, and certificate issuance. (Also relevant for TraumaZim — see Part 2.)
- **DOT / Transport Physicals** — examinations for commercial drivers (heavy vehicles, PSVs), operators of heavy machinery, train drivers. Produces compliance certificates linked to licence renewal.

### AI/CDSS Opportunities

- **CDSS: Hazard-Specific Risk Flags** — when an employee with silica exposure presents with respiratory symptoms, the CDSS should automatically surface a "Consider silicosis / pneumoconiosis surveillance pathway" alert before the clinician orders generic chest imaging.
- **CDSS: Fitness Certificate Decision Support** — given structured exam findings (spirometry values, audiogram thresholds, BP, BMI, grip strength), the CDSS suggests the appropriate fitness category and flags borderline results that require specialist referral before certification.
- **AI: Employer Cohort Analytics** — LLM-generated narrative health summaries per employer cohort ("Mine A workforce: 23% hypertension prevalence, hearing loss trend worsening in drilling crews year-on-year, recommend engineering noise controls").
- **AI: Exposure–Symptom Pattern Recognition** — cluster detection across employees of the same employer flagging potential shared occupational exposure events (e.g., three workers from the same shift with similar respiratory symptoms in 48 hours).

---

## Gap 1.2 — Workplace Exposure Monitoring & Medical Surveillance

**Status:** `MISSING`  
**New Module?** Part of `occupational_medicine` module

### What Is Missing

- **Exposure Register** — per-employee log of occupational exposures: chemical agents (with CAS numbers), physical hazards (noise, vibration, radiation, heat), biological hazards (bloodborne, agricultural). Each entry records exposure type, duration, concentration/level where known, PPE used, and linked MSDS/SDS documents.
- **OSHA-Equivalent Surveillance Protocols** — Zimbabwe-adapted from OSHA 29 CFR standards: hearing conservation programme (annual audiometry), respiratory surveillance (spirometry for chemical/dust exposures), biological monitoring (blood lead, urine arsenic, cholinesterase for pesticide workers).
- **Surveillance Scheduling Engine** — auto-schedules follow-up tests based on exposure type and last test date. Sends reminders to clinic coordinator, employee, and employer.
- **Group/Cohort Surveillance Views** — employer dashboard showing which employees are overdue for which surveillance test, with bulk scheduling capability.
- **Incident / Near-Miss Register** — record workplace injuries, near-misses, occupational disease incidents. Supports NSSA Form 6 (Zimbabwe: Accident/Disease Notification) generation.

### AI/CDSS Opportunities

- **CDSS: Exposure-Adjusted Reference Ranges** — audiogram interpretation automatically compares to age/exposure-adjusted baselines (NIOSH/ISO 1999) rather than generic normal ranges.
- **AI: Early Trend Detection** — cohort-level trend analysis identifies hearing threshold shifts or spirometry decline across a workgroup before individual thresholds are crossed, enabling proactive intervention.
- **AI: NSSA Reporting Automation** — auto-populate NSSA notification forms from structured encounter data.

---

## Gap 1.3 — Return-to-Work (RTW) Coordination

**Status:** `MISSING`  
**New Module?** Part of `occupational_medicine` module

### What Is Missing

- **RTW Case Management** — structured case file linking an injury/illness encounter to a return-to-work plan. Tracks: injury date, treating clinician, rehabilitation milestones, restrictions timeline, employer communication, and final closure.
- **Work Restrictions Communication** — a structured, time-bound restrictions document sent to the employer that lists what the employee cannot do and for how long. This must be distinct from the clinical medical record to respect confidentiality.
- **Graduated RTW Plans** — step-up plans where an employee starts on light/modified duties and progressively returns to full duty. The system tracks each phase and auto-prompts the next clinical review.
- **Workers' Compensation Billing** — NSSA or insurer-linked billing for work-injury consultations, separate from standard medical aid billing.
- **Employer Communication Portal** — secure, role-limited view for HR departments to see only the fitness status and work restrictions (not clinical details) of their employees.

### AI/CDSS Opportunities

- **CDSS: RTW Readiness Scoring** — based on diagnosis, functional test results, and job demands profile, the CDSS scores readiness for return and flags cases where returning too early creates re-injury risk.
- **AI: RTW Timeline Prediction** — based on injury type, treatment adherence, and comorbidities, predict expected RTW date to help employers plan.

---

## Gap 1.4 — Drug & Alcohol Testing Management

**Status:** `MISSING`  
**New Module?** Part of `occupational_medicine` module

### What Is Missing

- **Drug & Alcohol Screen Ordering** — panel selection (urine drug screen, breathalyser, hair follicle), chain-of-custody documentation, MRO (Medical Review Officer) workflow.
- **Random Pool Management** — maintain employer-defined random testing pools, auto-select random samples, track completion.
- **Result Recording & Certificate** — structured result recording, pass/fail certificate generation, employer notification with appropriate privacy controls.
- **Positive Result Protocol** — structured follow-up workflow: confirmatory testing (GC-MS), MRO review, employee counselling referral, SAP (Substance Abuse Professional) referral tracking.

### AI/CDSS Opportunities

- **AI: Substance Abuse Pattern Flags** — across multiple testing events, identify patterns consistent with substance dependence and prompt counselling referral.

---

## Gap 1.5 — Job Hazard Analysis (JHA) Library

**Status:** `MISSING`  
**New Module?** Part of `occupational_medicine` module

### What Is Missing

- **JHA Templates** — pre-built JHA forms for common Zimbabwean industries: mining, farming/agriculture, construction, manufacturing, healthcare workers.
- **Hazard-to-Surveillance Mapping** — when a JHA links an employee to specific hazards (e.g., silica, noise, solvents), the system automatically recommends the corresponding surveillance protocols.
- **PPE Requirement Tracking** — record recommended PPE per job role, audit compliance at each medical visit.

---

---

# PART 2 — TRAUMA CENTRE BORROWDALE (traumazim.com)

## Background

Trauma Centre Borrowdale is Zimbabwe's leading private hospital, notable for housing the country's first CathLab, an aviation medicine clinic, hyperbaric oxygen therapy, Ottobock prosthetics, five levels of critical care (ICU/SICU/MICU/NICU/HDU), and a regenerative medicine unit. Matching this facility's capability in Umoya requires several entirely new clinical modules.

---

## Gap 2.1 — Cardiac Catheterisation Lab (CathLab)

**Status:** `MISSING` (Cardiology module exists but has no cath-specific workflows)  
**New Module?** Yes — `cathlab` (or extend `cardiology` with a `cathlab` sub-module)

### What Is Missing

The existing cardiology module does not cover procedural interventional cardiology. A CathLab module must include:

- **Cath Procedure Scheduling** — dedicated booking system for elective and urgent cath cases. Captures indication, referring cardiologist, procedure type (diagnostic angiography, PCI/stenting, PTCA, pacemaker implant, EP study), priority (elective, urgent, STEMI primary PCI).
- **Pre-Procedure Checklist** — consent status, creatinine/eGFR (contrast nephropathy risk), INR, allergy check (contrast media), NPO status, antiplatelet medication review, access site preparation.
- **Procedure Record** — structured cath report: access site (radial/femoral), catheter type, coronary anatomy description (vessel-by-vessel: LAD, LCX, RCA, diagonal, marginal branches), lesion characteristics (% stenosis, length, calcification, bifurcation involvement), TIMI flow pre/post intervention, stent type and size (bare metal vs DES), contrast volume, fluoroscopy time, complications.
- **IVUS / OCT Integration** — intravascular imaging findings recorded alongside angiographic data.
- **Hemodynamic Monitoring** — capture intra-procedure measurements: aortic pressure, LVEDP, coronary fractional flow reserve (FFR), pullback gradients.
- **Post-Procedure Monitoring** — sheath removal protocol, vascular complication checks, post-PCI troponin, discharge criteria.
- **STEMI Protocol Integration** — door-to-balloon (D2B) time tracking, auto-alert to cath lab team on STEMI activation from Emergency, D2B dashboard for quality metrics.
- **Medication Management** — dual antiplatelet therapy (DAPT) prescription at discharge linked to pharmacy module.
- **Cath Lab Utilisation Reports** — case volume, D2B times, complication rates, stent type breakdown, contrast use.

### AI/CDSS Opportunities

- **CDSS: STEMI Recognition & Activation** — when Emergency uploads an ECG, the AI interprets ST-elevation pattern, auto-generates a STEMI alert, and triggers the cath lab activation workflow with D2B timer start.
- **CDSS: Contrast Nephropathy Risk Score** — Mehran risk score computed automatically from structured pre-procedure data; flags high-risk patients for pre-hydration and reduced contrast protocols.
- **CDSS: Syntax Score Calculation** — AI-assisted Syntax score from angiographic lesion description to guide PCI vs. CABG decision.
- **AI: Coronary Report Narrative Generation** — LLM drafts the coronary anatomy narrative from structured lesion data, clinician edits and signs.
- **AI: DAPT Duration Recommendation** — based on stent type, indication, bleeding risk (HAS-BLED), and ischaemic risk (PRECISE-DAPT), suggest optimal DAPT duration.

---

## Gap 2.2 — Intensive Care Unit (ICU) Management

**Status:** `PARTIAL` (Ward round module exists for general inpatient but has no ICU-specific workflows)  
**New Module?** Yes — `intensive_care`

### What Is Missing

The existing `ward_round` bundle covers general inpatient SOAP notes and orders. ICU care requires a dedicated, far more granular layer:

- **ICU Bed Registry** — per-ICU-type bed management: General ICU, Surgical ICU, Medical ICU, Neonatal ICU, High Dependency Unit. Each bed has real-time status (occupied, vacant, cleaning, blocked), ventilator assignment, and isolation flag.
- **Ventilator Management Record** — structured ventilator settings at each charting interval: mode (A/C, SIMV, CPAP, BiPAP, PSV), FiO2, PEEP, tidal volume, rate, plateau pressure, compliance, driving pressure. Auto-flags potentially harmful ventilation (Vt > 8 mL/kg IBW, plateau > 30 cmH2O, driving pressure > 15 cmH2O).
- **Continuous Vital Signs Charting** — high-frequency vital sign capture (every 15 or 30 minutes): HR, BP (arterial line), MAP, SpO2, CVP, PAOP (if Swan-Ganz present), temperature, urine output, GCS.
- **Fluid Balance Sheet** — running 24-hour fluid balance: all inputs (IV fluids, medications, enteral nutrition, oral) and outputs (urine, drain, vomitus, stool), net balance, cumulative balance.
- **Vasopressor / Inotrope Titration** — structured infusion orders for noradrenaline, adrenaline, dobutamine, dopamine, vasopressin. Records rate changes with clinical rationale.
- **Sedation & Analgesia Protocol** — RASS/CPOT scoring at every assessment, sedation targets, analgesic ladders, daily sedation hold documentation.
- **Nutrition in ICU** — NRS-2002 / NUTRIC score, enteral/parenteral nutrition goals, daily delivery vs. goal, GI tolerance assessment.
- **Daily ICU Goals Checklist** — structured daily checklist: DVT prophylaxis, stress ulcer prophylaxis, line days (PICC, CVL, arterial line) with infection risk flags, ETT or tracheostomy days, Foley catheter days, spontaneous breathing trial eligibility, bed elevation ≥30°, delirium assessment (CAM-ICU).
- **ICU Scoring** — APACHE II, SOFA, SAPS II, Glasgow Coma Scale auto-computed from structured data.
- **ICU Quality Metrics Dashboard** — ICU-acquired infection rates (VAP, CAUTI, CLABSI), average length of stay, mortality vs. predicted mortality (SMR), ventilator-free days, readmission within 48 hours.

### AI/CDSS Opportunities

- **CDSS: ICU Deterioration Early Warning** — continuous SOFA trend analysis; if SOFA increases by ≥2 points over 24 hours, auto-alert to ICU team.
- **CDSS: Lung-Protective Ventilation Guard** — real-time check of ventilator settings; if driving pressure > 15 or plateau > 30, generate hard-stop alert with recommendation to reduce tidal volume.
- **CDSS: Vasopressor Escalation Protocol** — when MAP <65 mmHg despite initial vasopressor, CDSS suggests escalation steps per Surviving Sepsis Campaign bundle.
- **AI: Daily ICU Summary Generation** — LLM generates overnight event summary and current status narrative from structured data (vitals, labs, medication changes) for morning handover.
- **AI: Weaning Readiness Assessment** — based on P/F ratio, RSBI, PEEP requirement, haemodynamic stability, and neurological status, generate SBT eligibility recommendation.

---

## Gap 2.3 — Neonatal ICU (NICU)

**Status:** `MISSING` (Growth measurements exist in ANC/paediatric bundle but no NICU workflows)  
**New Module?** Yes — part of `intensive_care` or standalone `nicu` (see also Part 3)

### What Is Missing

- **NICU Admission Register** — gestational age, birth weight, Apgar scores, reason for admission (prematurity, RDS, sepsis, HIE, congenital anomaly, surgical).
- **Incubator / Radiant Warmer Management** — temperature regulation targets, humidity settings, daily incubator position/hygiene log.
- **Neonatal Ventilator Settings** — neonatal-specific: HFOV, nCPAP, nHFNC, conventional ventilation with weight-adjusted tidal volumes.
- **Phototherapy** — hyperbilirubinemia management: total bilirubin tracking on Bhutani nomogram, phototherapy initiation/cessation thresholds by gestational age and age in hours, exchange transfusion thresholds.
- **Neonatal Feeds** — colostrum initiation time, maternal breast milk vs. donor milk vs. formula, enteral feed advancement protocol (mL/kg/day increments), fortification, parenteral nutrition composition.
- **Neonatal Drug Orders** — weight-based dosing with double-verification alerts; common NICU drugs: caffeine, surfactant, prostaglandin E1, indomethacin/ibuprofen (PDA closure), gentamicin, vancomycin with trough-guided dosing.
- **Kangaroo Mother Care (KMC) Records** — KMC session log (start/end time, mother's name, skin-to-skin hours), temperature during KMC, feeding during KMC. Critical for Zimbabwe context where KMC is a WHO-recommended standard for low-resource settings.
- **Neonatal Screening Results** — newborn metabolic screen (heel prick), hearing screen (OAE/AABR), critical CHD pulse oximetry screen, eye exam for ROP (retinopathy of prematurity).
- **NICU Discharge Planning** — discharge criteria checklist (weight threshold, temperature regulation, feeding tolerance, car seat test), parent discharge education, follow-up schedule.

### AI/CDSS Opportunities

- **CDSS: Neonatal Sepsis Early Warning** — combination of temperature instability + glucose instability + feed intolerance + CRP trend triggers a neonatal sepsis alert with recommended workup (blood culture, FBC, CRP, LP consideration).
- **CDSS: Phototherapy Threshold Calculator** — automatic Bhutani nomogram plotting with gestational-age and hour-of-life specific thresholds; escalation to exchange transfusion if rate of rise is critical.
- **CDSS: Apnoea of Prematurity Management** — caffeine dose weight-based calculator with therapeutic range and toxicity alerts.

---

## Gap 2.4 — Aviation Medicine / Aeromedical Module

**Status:** `MISSING`  
**New Module?** Yes — part of `occupational_medicine` or standalone `aviation_medicine`

### What Is Missing

- **Class 1, 2, LAPL Medical Examination Records** — structured CAAZ-compliant aviation medical examination form covering: cardiovascular (ECG, BP), respiratory (spirometry), ENT and audiometry, ophthalmology (visual acuity, colour vision, visual fields), neurology, psychiatry/psychological assessment, urinalysis, serology.
- **Aviation Medical Certificate Generation** — structured PDF certificate with examination date, certificate class, validity period, OML (Operational Multi-crew Limitation) flags, renal/cardiovascular limitations.
- **AME (Authorised Medical Examiner) Registry** — register of CAAZ-approved AMEs with licence numbers and examination privileges.
- **Certificate Renewal Scheduling** — automated renewal reminders to pilots based on certificate class (Class 1: annual under 40 / 6-monthly over 40).
- **Aeromedical Incident Register** — record of aviation personnel who had medical incapacitation events, grounding decisions, and return-to-flying assessments.

### AI/CDSS Opportunities

- **CDSS: Aeromedical Risk Flags** — when a pilot presents with a new cardiac diagnosis, the CDSS automatically flags the CAAZ reporting obligation and recommends grounding pending specialist review.
- **AI: Aviation Medical Summary** — LLM drafts the AME narrative from structured examination findings.

---

## Gap 2.5 — Hyperbaric Oxygen Therapy (HBOT)

**Status:** `MISSING`  
**New Module?** Yes — standalone `hyperbaric` or part of a future `regenerative_medicine` module

### What Is Missing

- **HBOT Indication Register** — approved HBOT indications: wound hypoxia/diabetic foot ulcer, osteomyelitis, radiation tissue injury, CO poisoning, decompression sickness, necrotising soft tissue infections, gas embolism.
- **Chamber Scheduling** — multi-place or mono-place chamber session booking, number of sessions per treatment course (typically 20–40 sessions for wound healing).
- **Session Record** — date/time, treatment depth (ATA, typically 2.0–2.4 ATA), duration at pressure (60–90 min), mask/hood use, oxygen breaks, any adverse events (oxygen toxicity seizure, middle ear barotrauma).
- **Contraindication Screening** — active pneumothorax, uncontrolled COPD (air trapping risk), certain chemotherapy agents (bleomycin, doxorubicin), claustrophobia check.
- **Wound Progress Tracking** — linked to wound care module: photograph series, wound dimensions at each visit, response assessment at mid-course (typically session 10–15).

### AI/CDSS Opportunities

- **CDSS: HBOT Contraindication Screen** — when HBOT is ordered, cross-check current medication list and diagnoses for absolute/relative contraindications and generate a flagged pre-treatment checklist.
- **AI: Treatment Response Assessment** — compare wound photograph series using vision-enabled AI to quantify wound area reduction and predict remaining course length.

---

## Gap 2.6 — Prosthetics & Orthotics Module

**Status:** `MISSING`  
**New Module?** Yes — `prosthetics_orthotics`

### What Is Missing

- **Amputee / Orthotics Patient Register** — amputation level (transtibial, transfemoral, transradial, etc.), amputation date, aetiology (trauma, DM vascular, congenital), stump health assessments.
- **Device Prescription & Fitting** — prosthetic/orthotic device type (KAFO, AFO, below-knee prosthesis, above-knee prosthesis, upper limb), socket design, suspension type, foot/knee component specification, fitting date.
- **Rehabilitation Progress** — gait training sessions, K-level functional assessment (K0–K4), balance and fall risk assessments, community ambulation distance.
- **Device Maintenance & Repair Log** — scheduled maintenance dates, repairs required, replacement schedule.
- **Supply Chain Integration** — link to storeroom module for prosthetic component inventory (Ottobock or local equivalent parts).
- **Outcomes Tracking** — SF-36 quality of life, PLUS-M (Prosthetic Limb Users Survey), TAPES (Trinity Amputation and Prosthesis Experience Scales).

### AI/CDSS Opportunities

- **CDSS: Diabetic Amputation Prevention** — when a patient with DM receives a first forefoot amputation, the CDSS generates a high-priority alert for intensive diabetic foot care to prevent contralateral limb loss.
- **AI: Gait Analysis Pattern Recognition** — video-based gait analysis AI (future capability) to detect compensatory gait patterns and recommend physiotherapy adjustments.

---

## Gap 2.7 — Dialysis / Renal Replacement Therapy Module

**Status:** `MISSING`  
**New Module?** Yes — `dialysis`

### What Is Missing

- **Dialysis Patient Register** — modality (haemodialysis, peritoneal dialysis, CRRT for ICU), CKD stage at initiation, primary renal diagnosis.
- **Haemodialysis Session Log** — per-session record: date, access type (AVF, AVG, tunnelled catheter), pre/post weight, blood flow rate, dialysate flow rate, dialyser type, anticoagulation (heparin dose), session duration, Kt/V or URR calculation, intradialytic complications (hypotension, cramps, access issues).
- **Vascular Access Management** — AVF maturation assessments, access surveillance (flow/recirculation), access complications log (stenosis, thrombosis, infection).
- **Dialysis Prescription Management** — weekly adequacy targets, Kt/V trend graphs, prescription adjustment notes.
- **Peritoneal Dialysis Records** — exchange type (CAPD/CCPD), dwell time, glucose concentration, effluent appearance, peritonitis episode log.
- **CRRT Records** — for ICU patients: mode (CVVH, CVVHD, CVVHDF), filter type, replacement fluid, anticoagulation (citrate/heparin), effluent volume, filter life.
- **Dry Weight / Fluid Management** — dry weight target, interdialytic weight gain, blood pressure trends, antihypertensive medication adjustments.

### AI/CDSS Opportunities

- **CDSS: Dialysis Adequacy Alert** — if Kt/V <1.2 for three consecutive sessions, generate a prescription review alert.
- **CDSS: Access Surveillance Trigger** — if access flow declines >25% from baseline on two consecutive measurements, flag for fistulogram referral.
- **AI: Fluid Status Prediction** — using bioimpedance data and interdialytic patterns, predict ideal dry weight adjustment.

---

## Gap 2.8 — Aesthetics & Regenerative Medicine Module

**Status:** `MISSING`  
**New Module?** Yes — `aesthetics_regenerative`

### What Is Missing

- **Treatment Menu & Consent** — structured list of aesthetic procedures (Botulinum toxin, dermal fillers, chemical peels, laser, PRP, thread lifts) with specific risks/benefits consent templates linked to the existing `digital_consent` system.
- **Photo Documentation** — pre/post treatment standardised photography with structured annotation, consent for photograph use.
- **Treatment Record** — product used (brand, batch number, volume), injection sites (facial zone mapping), technique, dilution, any adverse events.
- **PRP/Regenerative Protocol Tracking** — platelet-rich plasma preparation notes, centrifugation parameters, treatment area, session number.
- **Recall & Follow-Up Schedule** — procedure-specific follow-up: Botox (2-week review), filler (4-week), PRP (monthly × 3).
- **Hyperbaric Wellness Tracking** — link to HBOT module for wellness (non-medical) indications ("Jet Fuel" programme as branded by TraumaZim).

### AI/CDSS Opportunities

- **AI: Before/After Assessment** — vision AI analysis of standardised facial photographs to quantify treatment response.
- **CDSS: Contraindication Screen** — cross-check for absolute contraindications (autoimmune disease + fillers, pregnancy + Botox) before treatment booking.

---

## Gap 2.9 — Ambulance & Patient Transport Management

**Status:** `MISSING`  
**New Module?** Yes — `patient_transport`

### What Is Missing

- **Fleet Register** — ambulance vehicles (BLS, ALS, neonatal transport), crew assignment, equipment on board, last service date.
- **Dispatch Console** — emergency call log, GPS dispatch, ETA tracking, crew communication log.
- **Patient Handover Record** — structured pre-hospital to ED handover (MIST: Mechanism, Injuries, Signs, Treatment given en route).
- **Inter-Facility Transfer** — structured transfer record for sending patients to a higher-level facility, includes referring clinician, diagnosis, vitals trend, medications given, transport monitoring.
- **Billing Integration** — ambulance call-out fees linked to medical aid claims.

### AI/CDSS Opportunities

- **AI: Dispatch Priority Scoring** — based on call description, auto-triage priority (P1/P2/P3) and recommend BLS vs ALS crew.
- **AI: ETA–Capacity Matching** — predict hospital bay availability based on incoming ambulance ETA and current ED census.

---

## Gap 2.10 — High Dependency Unit (HDU) Differentiation

**Status:** `PARTIAL` (Ward round covers inpatient but HDU is clinically distinct from both general ward and ICU)

### What Is Missing

The `ward_round` module needs HDU-specific configuration:
- HDU bed designation separate from general ward and ICU beds
- Step-down criteria documentation (from ICU to HDU; from HDU to ward)
- Intermediate monitoring charting frequency (1–2 hourly vs ICU every 15 minutes)
- HDU nursing ratio tracking

---

---

# PART 3 — WORLD-CLASS BABY CLINIC

## Background

Based on AAP 2026 guidelines, US News Best Children's Hospitals rankings, and standards from Boston Children's, Texas Children's, and Children's National Hospital, a world-class baby clinic operates across neonatal critical care, developmental paediatrics, immunisation, nutrition, family support, and technology-enabled home follow-up. The current system has only rudimentary paediatric support (growth measurements within the ANC/paediatric bundle, EID scheduling for HIV-exposed infants). A dedicated, comprehensive baby clinic module is needed.

---

## Gap 3.1 — Well-Baby Clinic (WBC) Module

**Status:** `MISSING`  
**New Module?** Yes — `well_baby_clinic`

### What Is Missing

- **Well-Baby Visit Schedule** — WHO/Zimbabwe MNCH schedule: birth, 6 weeks, 10 weeks, 14 weeks, 6 months, 9 months, 12 months, 18 months, 24 months, 3 years, 5 years. System auto-schedules and reminds parents.
- **Structured Well-Baby Encounter Form** — age-specific structured assessment covering: weight, length/height, head circumference, nutrition (breastfeeding, complementary feeding), development screen (MILESTONE by domain), parental concerns, social determinants screen.
- **Growth Chart Module** — WHO 2006 Child Growth Standards for weight-for-age, length/height-for-age, weight-for-length, head circumference-for-age, and BMI-for-age. Charts display percentile bands (3rd, 15th, 50th, 85th, 97th) and z-scores. Flag faltering growth (<-2 SD on weight-for-age or drop across 2 centile bands).
- **Nutritional Assessment** — breastfeeding adequacy assessment, complementary food introduction counselling, micronutrient supplementation tracking (Vitamin A, iron, zinc), malnutrition classification (SAM/MAM/mild) and management protocol.
- **Developmental Milestone Tracker** — domain-by-domain milestone documentation: gross motor, fine motor, language/communication, social/emotional, cognitive. Tools: Ages & Stages Questionnaire (ASQ-3) integrated form.
- **Red Flag Developmental Alert System** — automatic alert when a child fails to achieve key milestones by critical age limits (e.g., no social smile by 3 months, no words by 18 months, regression at any age).
- **Parent Education Library** — age-appropriate breastfeeding guidance, safe sleep (Back to Sleep), responsive parenting, injury prevention (falls, burns, poisoning), SIDS risk reduction.

### AI/CDSS Opportunities

- **CDSS: Growth Faltering Alert** — when weight crosses downward across 2 WHO percentile bands between visits, auto-generate a clinical alert with differential diagnosis guidance (poor feeding, infection, malabsorption, HIV, abuse) and structured management plan.
- **CDSS: Developmental Concern Triage** — based on ASQ-3 scores, CDSS classifies concern level (monitor/refer/urgent) and suggests referral pathway (speech therapy, occupational therapy, developmental paediatrician, neurology).
- **AI: Parental Q&A Bot** — patient portal chatbot answers common infant care questions ("Is this normal for a 6-week-old?") using AAP-vetted knowledge base.

---

## Gap 3.2 — Expanded Programme on Immunisation (EPI) / Vaccination Management

**Status:** `MISSING` as a dedicated, schedule-driven module (some vaccination recording may exist but no full EPI management)  
**New Module?** Yes — `immunisation` (or extend `well_baby_clinic`)

### What Is Missing

- **National EPI Schedule** — Zimbabwe MOHCC schedule: BCG, OPV, IPV, DPT-HepB-Hib (pentavalent), PCV10, Rota, MR, Yellow Fever (endemic areas), HPV (girls age 10), Tetanus (mothers antenatal), and any catch-up schedules.
- **Vaccination Record** — per-dose recording: vaccine name, batch number, expiry date, site given (left/right, deltoid/thigh), dose volume, administering clinician. Produces an updated child health card / digital vaccination booklet.
- **Missed Dose / Defaulter Management** — when a due date passes without a vaccination recorded, auto-generate outreach task and SMS reminder to parent.
- **Cold Chain Compliance** — record vaccine storage temperatures for each batch received, flag temperature excursions that may compromise vaccine potency.
- **Coverage Reporting** — facility-level EPI coverage report: percentage of children completing each vaccine on time within the catchment area.
- **Adverse Event Following Immunisation (AEFI)** — structured AEFI report form linked to MOHCC/WHO reporting requirements.

### AI/CDSS Opportunities

- **CDSS: Contraindication Screen** — at vaccination encounter, check for live vaccine contraindications (immunosuppression, HIV status, recent immunoglobulin), defer live vaccines appropriately.
- **AI: Coverage Prediction** — predict which families are at risk of dropping out of the vaccination schedule based on prior appointment adherence and social determinants data.
- **AI: AEFI Signal Detection** — cluster analysis of AEFI reports across facilities to detect potential safety signals above background rates.

---

## Gap 3.3 — Neonatal Screening Programme

**Status:** `MISSING`  
**New Module?** Part of `well_baby_clinic` or `nicu`

### What Is Missing

- **Newborn Blood Spot (NBS) Screening** — heel prick at 48–72 hours: PKU, congenital hypothyroidism (CH), galactosaemia, sickle cell disease. Record sample collection, transport to laboratory, result receipt, and follow-up action for positive screens.
- **Hearing Screening** — OAE (Otoacoustic Emission) at birth, AABR (Automated Auditory Brainstem Response) for refer cases. Record result, refer pathway, audiology follow-up scheduling.
- **Critical Congenital Heart Disease (CCHD) Screen** — pulse oximetry on right hand and right foot at 24 hours. Structured pass/fail/refer criteria. Refer pathway to paediatric cardiology.
- **Newborn Eye Examination** — red reflex examination at birth (cataracts, glaucoma, retinoblastoma). Retinopathy of Prematurity (ROP) screening schedule for premature infants.
- **Bilirubin / Jaundice Management** — transcutaneous or total serum bilirubin at defined time points, plotted on Bhutani nomogram, phototherapy initiation and cessation thresholds.
- **Hip Dysplasia Screening** — clinical Barlow/Ortolani examination, risk factor flag (breech, family history), hip ultrasound referral pathway.

### AI/CDSS Opportunities

- **CDSS: NBS Positive Alert** — when a positive PKU or CH result is received from the laboratory, immediately generate an alert to the clinician and parent contact task with protocol-driven follow-up steps.
- **CDSS: CCHD Screen Integration** — when pulse oximetry screen is failed on two readings, CDSS generates urgent paediatric cardiology referral recommendation.

---

## Gap 3.4 — Neonatal / Paediatric Nutrition & Lactation

**Status:** `PARTIAL` (Nutritional fields exist but no dedicated feeding programme)  
**New Module?** Part of `well_baby_clinic` or `nicu`

### What Is Missing

- **Lactation Consultant Module** — breastfeeding assessment forms (latch assessment, nipple trauma, milk transfer, maternal milk supply concerns), lactation consultant session notes, management plans.
- **Feeding Disorder Clinic** — structured assessment for infants/toddlers with oral aversion, dysphagia, or failure to thrive. Multidisciplinary team: speech therapist, dietitian, occupational therapist.
- **Neonatal Parenteral Nutrition (PN) Calculator** — weight-based fluid and nutrient targets (GIR for glucose, amino acids mL/kg/day, lipid mL/kg/day), total fluid allowance, osmolarity check (should not exceed peripheral line limits without central access).
- **Breast Milk Tracking (NICU)** — maternal expressed breast milk (EBM) log: expressed volume per session, freezer stock, daily intake vs. target. Donor milk consent and traceability.
- **Complementary Feeding Programme** — age-appropriate food introduction guides, iron-rich foods emphasis (relevant for Zimbabwe where iron deficiency anaemia is common), texture progression.

### AI/CDSS Opportunities

- **CDSS: PN Safety Check** — when a PN order is placed, verify glucose infusion rate (GIR) is within safe range for gestational age (<12 mg/kg/min for premature, ≤18 for term), flag calcium/phosphate compatibility, flag high osmolarity for peripheral line.
- **AI: Breastfeeding Support Bot** — patient portal AI that provides lactation guidance and helps mothers troubleshoot common breastfeeding difficulties, reducing unnecessary clinic visits.

---

## Gap 3.5 — Perinatal and Infant Mental Health

**Status:** `MISSING`  
**New Module?** Part of `well_baby_clinic` or extend `maternity`

### What Is Missing

- **Edinburgh Postnatal Depression Scale (EPDS)** — digital EPDS administered at 6-week postnatal visit and at every well-baby visit up to 6 months per AAP 2026 guidance. Auto-scores and risk-stratifies (low/moderate/high risk), generates referral pathway for high-risk scores.
- **Mother–Infant Bonding Assessment** — structured observation of bonding, skin-to-skin contact quality, parental responsiveness to infant cues.
- **Parental Mental Health Referral Pathway** — integrated pathway to psychosocial services for mothers/fathers with identified mental health needs.
- **Infant-Directed Abuse/Neglect Safeguarding** — structured child safeguarding screening, unexplained injury flag, referral to social work.

### AI/CDSS Opportunities

- **CDSS: EPDS Threshold Alert** — when EPDS ≥10 (suggestive of PND) or question 10 (self-harm) is scored ≥1, generate immediate clinical alert and suggested action (counselling referral, psychiatric review for severe cases).
- **AI: EPDS Trend Analysis** — track EPDS scores longitudinally and alert when a previously low-scoring mother shows a rising trend.

---

## Gap 3.6 — Post-NICU / Developmental Follow-Up Clinic

**Status:** `MISSING`  
**New Module?** Part of `well_baby_clinic`

### What Is Missing

- **High-Risk Infant Follow-Up Register** — register of premature infants (<32 weeks GA), VLBW (<1500g), HIE infants, infants with major congenital anomalies requiring neurodevelopmental tracking.
- **Corrected Age Calculator** — automatic computation of corrected gestational age for developmental milestone assessment (premature infants are assessed at corrected, not chronological age).
- **Neurodevelopmental Assessment Schedule** — Bayley Scales of Infant and Toddler Development (Bayley-4) or equivalent at 6, 12, 18, 24 months corrected age. Documents cognitive, language, motor composite scores.
- **ROP (Retinopathy of Prematurity) Follow-Up** — scheduled fundoscopy examinations per ICROP3 guidelines until ROP resolves or retinal vasculature is mature. Record International Classification of ROP stage, zone, plus disease, treatment (if laser photocoagulation or bevacizumab).
- **HIE Follow-Up** — structured follow-up for infants who had hypoxic-ischaemic encephalopathy: head MRI result at term, Prechtl general movements assessment, EEG results, physiotherapy/OT referral tracking.
- **Neurodevelopmental Outcome Dashboard** — cohort-level tracking of outcomes for NICU graduates, benchmarked against national and international data.

### AI/CDSS Opportunities

- **CDSS: ROP Screening Calendar** — automatically schedule ROP examinations from birth date and gestational age per ICROP3 guidelines.
- **AI: Developmental Outcome Prediction** — based on gestational age, birth weight, MRI findings, and early Bayley scores, provide a probabilistic developmental trajectory for counselling parents.

---

## Gap 3.7 — Paediatric Cardiology Integration

**Status:** `MISSING` (Cardiology module exists for adults, no paediatric-specific workflows)

### What Is Missing

- **Congenital Heart Disease (CHD) Register** — structural diagnoses (VSD, ASD, PDA, ToF, TGA, HLHS), haemodynamic data, surgical/catheter intervention history.
- **Paediatric Echo Templates** — structured echocardiography report templates with paediatric normal reference ranges.
- **Innocent Murmur vs Pathological Murmur Decision Support** — CDSS logic for new paediatric murmur workup.
- **SBE Prophylaxis Management** — tracking of patients requiring antibiotic prophylaxis before dental or surgical procedures.

### AI/CDSS Opportunities

- **CDSS: Innocent vs Pathological Murmur Algorithm** — based on murmur characteristics (Still's, vibratory, systolic vs diastolic, radiation, variation with position), generate probability assessment and echo referral recommendation.

---

## Gap 3.8 — Home Monitoring & Remote Baby Care

**Status:** `PARTIAL` (Wearable sync module exists for general patients)  
**New Module?** Extend wearable + patient portal

### What Is Missing

- **Parent Home Monitoring App** — parent-facing mobile features: daily weight entry, feeding log (breast/formula/volume/frequency), stool/urine output tracking (wet nappy count), temperature log. Clinician dashboard aggregates this data.
- **Remote Jaundice Monitoring** — smartphone camera-based bilirubin estimation (validated tools exist) as an adjunct between clinical visits for at-risk newborns.
- **Virtual Well-Baby Consultation** — extend telemedicine module with infant-specific encounter templates, allowing remote visual assessment of rash, jaundice, feeding technique (via video).
- **Grow@Home Programme** — structured NICU discharge follow-up where parents submit daily weight + intake data via the patient portal/mobile app, NICU team reviews remotely and advises on feed adjustments.

### AI/CDSS Opportunities

- **AI: Feeding Pattern Anomaly Detection** — if a parent logs a 30%+ drop in intake over 24 hours, the AI flags this for clinical review.
- **AI: Jaundice Risk Prediction** — from birth risk factors (gestational age, blood group, prior sibling jaundice, time to first stool), predict bilirubin rise risk and auto-schedule early bilirubin check.

---

---

# PART 4 — CROSS-CUTTING GAPS & MODULE SUMMARY

## 4.1 Missing Module Keys (enabledModules)

The following new module keys need to be added to the valid module registry in `tenant.service.ts` and corresponding provisioning bundles in `database-provisioning.service.ts`:

| New Module Key | Covers |
|---|---|
| `occupational_medicine` | Employer register, fitness-for-work, exposure monitoring, RTW, drug testing, JHA |
| `aviation_medicine` | CAAZ/ICAO aeromedical examinations and certificates (can be sub-module of occupational_medicine) |
| `cathlab` | Interventional cardiology: coronary angiography, PCI, STEMI pathway, D2B metrics |
| `intensive_care` | General ICU, SICU, MICU with ventilator management, ICU scoring, fluid balance, sedation |
| `nicu` | Neonatal ICU, incubator management, phototherapy, KMC, neonatal drug orders, NICU discharge |
| `dialysis` | Haemodialysis, peritoneal dialysis, CRRT, vascular access, Kt/V, adequacy reports |
| `hyperbaric` | HBOT scheduling, session records, contraindication screening, wound progress tracking |
| `prosthetics_orthotics` | Amputee register, device prescription, rehabilitation progress, K-level assessments |
| `aesthetics_regenerative` | Aesthetic procedures, photo documentation, PRP tracking, consent integration |
| `patient_transport` | Ambulance fleet, dispatch, pre-hospital handover, inter-facility transfer |
| `well_baby_clinic` | Well-baby visits, growth charts, developmental screening, ASQ-3, parental education |
| `immunisation` | EPI schedule, vaccination records, cold chain, AEFI, defaulter management |
| `neonatal_screening` | NBS heel prick, hearing screen, CCHD screen, ROP, bilirubin/jaundice management |
| `lactation_nutrition` | Lactation consultant, feeding disorder clinic, PN calculator, breast milk tracking |
| `perinatal_mental_health` | EPDS, mother–infant bonding, parental mental health referral, safeguarding |
| `nicu_followup` | Post-NICU register, corrected age, Bayley assessments, ROP follow-up, HIE tracking |
| `paediatric_cardiology` | CHD register, paediatric echo templates, murmur decision support, SBE prophylaxis |

---

## 4.2 AI/CDSS Integration Summary

The following table maps every new module to its highest-value AI/CDSS integration, using capabilities already present in the system (CDSS safety governor, clinical LLM backend, wearable sync, patient portal chatbot potential):

| Module | Top CDSS Capability | Top AI Capability |
|---|---|---|
| Occupational Medicine | Hazard-specific risk flags; FFD certificate decision support | Employer cohort health narrative; exposure cluster detection |
| Aviation Medicine | Grounding obligation flag on new cardiac diagnosis | AME examination narrative auto-draft |
| CathLab | STEMI ECG recognition → D2B timer; Mehran contrast risk score; Syntax score | Coronary anatomy narrative generation; DAPT duration recommendation |
| ICU | SOFA deterioration alert; lung-protective ventilation guard; vasopressor protocol | Overnight handover summary; SBT weaning readiness |
| NICU | Neonatal sepsis early warning; phototherapy Bhutani calculator; caffeine dosing | Growth trajectory prediction; KMC adherence coaching via parent app |
| Dialysis | Kt/V adequacy alert; access flow surveillance trigger | Dry weight optimisation from bioimpedance; fluid status prediction |
| HBOT | Contraindication screen; chamber pressure protocol alert | Wound photograph area quantification |
| Prosthetics | Diabetic amputation prevention (contralateral limb) | Gait pattern analysis (future video AI) |
| Well-Baby Clinic | Growth faltering alert; developmental concern triage | Parental Q&A chatbot; feeding anomaly detection |
| Immunisation | Live vaccine contraindication screen | Coverage prediction; AEFI cluster signal detection |
| Neonatal Screening | NBS positive result alert; CCHD screen referral | Bilirubin rise risk prediction from birth factors |
| Lactation/Nutrition | PN safety check (GIR, Ca/PO4, osmolarity) | Breastfeeding support bot in patient portal |
| Perinatal Mental Health | EPDS threshold alert (score ≥10 or Q10 ≥1) | EPDS longitudinal trend analysis |
| NICU Follow-Up | ROP screening calendar auto-generation | Developmental outcome probability for counselling |
| Paediatric Cardiology | Innocent vs. pathological murmur algorithm | Paediatric echo interpretation assistance |

---

## 4.3 Existing System Strengths (Do Not Rebuild)

The following capabilities are already strong and should be extended/integrated rather than rebuilt:

- **Emergency module** — already covers 24-hour trauma unit workflows
- **Cardiology module** — existing adult cardiology extends to CathLab (don't replace, extend)
- **Theatre/OR module** — extend for open heart surgery theatre tracking within CathLab sprint
- **Maternity / WHO Partograph** — solid foundation; extend for NICU admission at birth
- **Orthopaedics module** — covers trauma fracture register relevant to TraumaZim emergency orthopaedics
- **ENT module** — audiogram records exist; extend for full audiology/hearing aid workflows in baby clinic
- **Storeroom module** — prosthetic component inventory, HBOT gas supply, and dialysis consumables can all live here
- **Physiotherapy module** — already handles rehab referrals; extend for amputee gait training
- **Digital consent** — already exists; extend templates for HBOT, cath lab, aesthetics, and NICU procedures
- **Medical aid claims / AHFoZ** — extend tariff code library to cover cath lab procedures, dialysis, and HBOT CIMAS codes
- **Notification centre** — extend trigger configs for NICU feeding reminders, vaccination due dates, HBOT session reminders
- **Patient portal / mobile** — extend for Grow@Home NICU programme and parent vaccination booklet

---

## 4.4 Sprint Readiness Notes

This document is intended as the founding input for sprint planning. The following sprint groupings are suggested:

| Sprint Group | Module(s) | Estimated Sprint Count |
|---|---|---|
| **S-OCC-1** | Occupational Medicine core (employer, FFD, exposure, RTW) | 3 sprints |
| **S-OCC-2** | Aviation medicine, drug testing, JHA library | 2 sprints |
| **S-CTH-1** | CathLab: procedure record, scheduling, hemodynamics, STEMI pathway | 3 sprints |
| **S-CTH-2** | CathLab: AI STEMI ECG, Mehran score, DAPT, D2B dashboard | 2 sprints |
| **S-ICU-1** | ICU management: beds, ventilator, vital charting, fluid balance | 3 sprints |
| **S-ICU-2** | ICU: sedation/analgesia, daily goals, ICU scoring, AI handover | 2 sprints |
| **S-NCU-1** | NICU: admission, incubator, phototherapy, feeds, KMC | 3 sprints |
| **S-NCU-2** | NICU: drug orders, screening results, discharge planning, AI sepsis | 2 sprints |
| **S-DIA-1** | Dialysis: session logs, vascular access, Kt/V, PN calculator | 2 sprints |
| **S-HYP-1** | Hyperbaric: scheduling, session records, contraindication screen | 1 sprint |
| **S-PRT-1** | Prosthetics & orthotics: register, prescription, rehab, outcomes | 2 sprints |
| **S-WBC-1** | Well-baby clinic: visits, growth charts, milestones, ASQ-3 | 3 sprints |
| **S-EPI-1** | Immunisation: EPI schedule, vaccination records, cold chain, AEFI | 2 sprints |
| **S-NBS-1** | Neonatal screening: NBS, hearing, CCHD, ROP, bilirubin | 2 sprints |
| **S-LAC-1** | Lactation, nutrition, PN calculator, feeding disorder clinic | 2 sprints |
| **S-PMH-1** | Perinatal mental health: EPDS, bonding, safeguarding | 1 sprint |
| **S-NCU-3** | NICU follow-up: register, Bayley, ROP follow-up, HIE tracking | 2 sprints |
| **S-PCR-1** | Paediatric cardiology: CHD register, echo templates, murmur CDSS | 2 sprints |
| **S-TRS-1** | Patient transport: fleet, dispatch, pre-hospital handover | 1 sprint |
| **S-AES-1** | Aesthetics & regenerative medicine, HBOT wellness | 1 sprint |
| **S-HDU-1** | HDU differentiation within ward round module | 1 sprint |

**Total estimated: ~42 sprint-weeks of implementation work**

---

## 4.5 Zimbabwe-Specific Context Notes

Every module must be adapted for the Zimbabwean healthcare environment:

- **Occupational Medicine** — NSSA (not Workers' Comp) integration; Factories and Works Act compliance; ZAMOHS (Zimbabwe Association of Mine Owners and House Surgeons) coordination for mining sector.
- **CathLab** — TraumaZim is the only facility with CathLab in Zimbabwe; this module positions Umoya as the definitive system for the country's most advanced cardiac care.
- **NICU / Well-Baby** — Kangaroo Mother Care is particularly important given a significant proportion of care delivered with limited incubator availability. KMC records must be a first-class feature.
- **Dialysis** — Zimbabwe has very limited dialysis capacity; this module supports advocacy for renal services expansion.
- **Immunisation** — Zimbabwe MOHCC EPI schedule differs from WHO standard schedule on some vaccines; must implement local schedule, not just WHO.
- **Occupational Medicine — Mining** — Zimbabwe's mining sector (platinum, gold, chrome, coal) creates significant pneumoconiosis, noise-induced hearing loss, and heat stress burdens. Silicosis and NIHL surveillance are priority features.

---

*This document was generated from live web research (traumazim.com, AAP 2026 EPI schedule, ACOEM OEHR guidance, US News Best Hospitals 2025–26 rankings) and a full audit of the Umoya ARCHITECTURE.md, provisioning bundles, and registered controllers as of 2026-06-23. It supersedes no prior document — it is a new founding reference for gap-closure sprint planning.*
