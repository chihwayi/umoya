# Sprint 226 — Specialty Modules & CDSS Depth Improvements

**Date:** 2026-06-12  
**Status:** Implemented & type-checked ✅

---

## Overview

Full Zimbabwe specialty service gap analysis led to:
1. **9 new specialty modules** (17 new entities, 9 services, 9 controllers)
2. **ECG wiring** into existing Cardiology module
3. **CDSS depth improvements** to Family Planning, Pediatrics, and Triage
4. **Database provisioning bundle** (`sprint226_specialty_modules`) for all 17 new tables

---

## New Specialty Modules

### Orthopaedics
**Files:** `entities/orthopaedic-register.entity.ts`, `fracture-record.entity.ts`, `joint-replacement-record.entity.ts`  
**Service:** `services/orthopaedics.service.ts` | **Controller:** `controllers/orthopaedics.controller.ts`  
**Endpoints:**
- `POST/GET /orthopaedics/register` — fracture/trauma patient register
- `POST/GET/PATCH /orthopaedics/fractures` — fracture records with Gustilo-Anderson urgency
- `POST/GET/PATCH /orthopaedics/joint-replacement` — THA/TKA tracking with outcome scores
- `POST /orthopaedics/cdss/rehab-plan` — THA/TKA/fracture rehab phases
- `POST /orthopaedics/cdss/dvt-risk` — Wells DVT score calculation

**CDSS:** Gustilo-Anderson urgency, Wells DVT (local), + CDSS service overlay

---

### ENT (Ear, Nose & Throat)
**Files:** `entities/ent-visit.entity.ts`, `audiogram-record.entity.ts`  
**Service:** `services/ent.service.ts` | **Controller:** `controllers/ent.controller.ts`  
**Endpoints:**
- `POST/GET/PATCH /ent/visits` — ENT visits with tympanic/nasal/tonsil findings
- `POST/GET /ent/audiograms` — pure-tone audiometry with auto-computed PTA + classification
- `POST /ent/cdss/tonsillitis-triage` — Centor score (Strep throat vs viral)
- `POST /ent/cdss/rhinosinusitis-triage` — sinusitis classification

**CDSS:** Centor score, PTA auto-classification (normal/mild/moderate/severe/profound)

---

### Gastroenterology
**Files:** `entities/gastro-register.entity.ts`, `endoscopy-record.entity.ts`  
**Service:** `services/gastroenterology.service.ts` | **Controller:** `controllers/gastroenterology.controller.ts`  
**Endpoints:**
- `POST/GET/PATCH /gastroenterology/register`
- `POST/GET/PATCH /gastroenterology/endoscopy`
- `POST /gastroenterology/cdss/upper-gi-bleed-risk` — Rockall score
- `POST /gastroenterology/cdss/cirrhosis-risk` — Child-Pugh classification
- `POST /gastroenterology/cdss/dyspepsia` — H.pylori/GERD/alarm feature guidance

**CDSS:** Rockall score, Child-Pugh (A/B/C), dyspepsia management algorithm

---

### Rheumatology
**Files:** `entities/rheumatology-register.entity.ts`, `joint-assessment.entity.ts`, `dmard-record.entity.ts`  
**Service:** `services/rheumatology.service.ts` | **Controller:** `controllers/rheumatology.controller.ts`  
**Endpoints:**
- `POST/GET/PATCH /rheumatology/register`
- `POST/GET /rheumatology/assessments` — DAS28-ESR auto-computed on each assessment
- `POST/GET /rheumatology/dmards`, `PATCH /rheumatology/dmards/:id/stop`
- `POST /rheumatology/cdss/treat-to-target` — DAS28-based step-up strategy
- `POST /rheumatology/cdss/gout` — uric acid + colchicine/allopurinol protocol
- `POST /rheumatology/cdss/biologic-safety` — TB screening mandatory pre-biologic (Zimbabwe-specific)

**CDSS:** DAS28-ESR, SDAI/CDAI, treat-to-target algorithm, biologic pre-screen (TB mandatory in ZW high-burden setting)

---

### Haematology
**Files:** `entities/haematology-register.entity.ts`  
**Service:** `services/haematology.service.ts` | **Controller:** `controllers/haematology.controller.ts`  
**Endpoints:**
- `POST/GET/PATCH /haematology/register`
- `POST /haematology/cdss/anaemia-workup` — MCV morphology-based classification
- `POST /haematology/cdss/transfusion-trigger` — restrictive strategy (Hb <7 g/dL)
- `POST /haematology/cdss/lymphoma-staging` — Ann Arbor staging

**CDSS:** MCV-based anaemia tree, restrictive transfusion threshold, Ann Arbor staging

---

### Urology
**Files:** `entities/urology-register.entity.ts`  
**Service:** `services/urology.service.ts` | **Controller:** `controllers/urology.controller.ts`  
**Endpoints:**
- `POST/GET/PATCH /urology/register`
- `POST /urology/cdss/bph` — IPSS-based BPH management (watchful waiting / medication / TURP)
- `POST /urology/cdss/renal-stone` — size + infection → ESWL/URS/PCN/PCNL guidance
- `POST /urology/cdss/psa` — age-adjusted PSA interpretation

**CDSS:** IPSS score, stone management algorithm, PSA age-adjusted thresholds

---

### Physiotherapy & Rehabilitation
**Files:** `entities/physio-referral.entity.ts`, `physio-session.entity.ts`  
**Service:** `services/physiotherapy.service.ts` | **Controller:** `controllers/physiotherapy.controller.ts`  
**Endpoints:**
- `POST/GET /physiotherapy/referrals` — cross-specialty referrals (Physiotherapy/OT/Speech/Cardiac/Pulmonary rehab)
- `PATCH /physiotherapy/referrals/:id/accept`, `/discharge`
- `POST/GET /physiotherapy/referrals/:id/sessions` — session tracking (pain score, ROM, MRC, functional outcome)
- `GET /physiotherapy/patient/:id/referrals`, `/sessions`
- `POST /physiotherapy/cdss/stroke-rehab` — Barthel-stratified stroke rehab plan
- `POST /physiotherapy/cdss/cardiac-rehab` — 4-phase cardiac rehab (LVEF-aware)

**CDSS:** Stroke rehab (Barthel index), cardiac rehab phases (LVEF <40 HFrEF variant)

---

### Endocrinology
**Files:** `entities/endocrine-register.entity.ts`  
**Service:** `services/endocrinology.service.ts` | **Controller:** `controllers/endocrinology.controller.ts`  
**Endpoints:**
- `POST/GET/PATCH /endocrinology/register`
- `POST /endocrinology/cdss/thyroid` — TSH/FT4-based thyroid management algorithm
- `POST /endocrinology/cdss/adrenal-crisis` — 6-step emergency protocol (hydrocortisone IV)
- `POST /endocrinology/cdss/levothyroxine-dose` — 1.6 µg/kg/day ± cardiac/age adjustments

**CDSS:** Thyroid algorithm (hypothyroid/hyperthyroid/subclinical), adrenal crisis management (TB as most common precipitant in ZW), levothyroxine dosing formula

---

### NCD Comorbidity Profile (Cross-Module Bridge)
**Files:** `entities/ncd-comorbidity-profile.entity.ts`  
**Service:** `services/ncd-comorbidity.service.ts` | **Controller:** `controllers/ncd-comorbidity.controller.ts`  
**Endpoints:**
- `GET /ncd-comorbidity/patient/:id` — unified NCD profile
- `PATCH /ncd-comorbidity/patient/:id`
- `POST /ncd-comorbidity/patient/:id/sync` — cross-module aggregation from `diabetes_registry`, `vitals`, `ckd_assessment`, `retinopathy_screening`, `diabetes_care_bundle`
- `POST /ncd-comorbidity/cdss/cvd-risk` — Framingham CVD risk (sex-stratified)

**Purpose:** Solves data fragmentation — DM ↔ CKD ↔ CVD ↔ retinopathy in one profile. Alerts generated on sync.

---

## Cardiology ECG Depth Improvement

**Modified:** `services/cardiology.service.ts`, `controllers/cardiology.controller.ts`  
**Entity:** `entities/ecg-record.entity.ts` (previously created, now wired)

**New endpoints:**
- `POST /cardiology/ecg` — record ECG with auto ACS flagging + CDSS overlay
- `GET /cardiology/ecg/patient/:id` — patient ECG history
- `GET /cardiology/ecg/:id` — single ECG record
- `POST /cardiology/cdss/ecg-interpret` — standalone interpretation (QTc, rhythm, LBBB, ACS)

**Local algorithm:** Flags ACS features, QTc >500 ms, VT, new LBBB (STEMI equivalent), LVH, tachycardia/bradycardia

---

## Existing Module Depth Improvements

### Family Planning — WHO MEC Counselling
**Modified:** `services/family-planning.service.ts`, `controllers/family-planning.controller.ts`

**New endpoints:**
- `POST /family-planning/cdss/method-counselling` — WHO MEC 4th Ed: COC/POP/DMPA/IUCD/implant eligibility factoring HIV status, ARV type (EFV/NVP reduces implant efficacy 40-50%), hypertension, migraine with aura, DVT history, liver disease, breastfeeding
- `POST /family-planning/cdss/missed-method` — COC/DMPA/POP missed dose protocol with EC trigger logic
- `POST /family-planning/cdss/postpartum-contraception` — LAM criteria + timing for hormonal methods post-delivery

---

### Pediatrics — IMCI + Zimbabwe EPI Schedule
**Modified:** `services/pediatrics.service.ts`, `controllers/pediatrics.controller.ts`

**New endpoints:**
- `POST /pediatrics/cdss/imci` — WHO IMCI full classification: pneumonia (fast breathing thresholds by age), dehydration grading, fever/malaria pathway (RDT-triggered ACT), severe malnutrition (MUAC/WHZ → SAM/MAM), general danger signs → urgent referral
- `POST /pediatrics/cdss/epi-schedule` — Zimbabwe NIP schedule (BCG through HPV), age-based due vaccines, catch-up guidance, contraindications

---

### Triage — SATS + NEWS2 + Code Blue
**Modified:** `services/triage.service.ts`, `controllers/triage.controller.ts`

**New endpoints:**
- `POST /triage/cdss/sats-score` — South African Triage Scale (Trauma Injury Score: GCS + RR + SBP) + clinical discriminators (SpO2<90, haemorrhage, stroke, eclampsia) → RED/ORANGE/YELLOW/GREEN/BLUE
- `POST /triage/cdss/news-score` — NEWS2 (7 components: RR, SpO2, supplemental O2, SBP, HR, temperature, consciousness) → LOW/MEDIUM/HIGH with escalation actions
- `POST /triage/cdss/code-blue` — ALS algorithm: shockable (VF/VT: defibrillation + amiodarone) vs non-shockable (asystole/PEA: adrenaline + 4H/4T), post-ROSC management, drug dosing table

---

## Database Provisioning

**Bundle ID:** `sprint226_specialty_modules`  
**File:** `services/tenant-service/src/services/database-provisioning.service.ts`  
**Version:** `2026.06.12.0`

Creates all 17 tables with correct indexes. Applied to existing tenants by running:
```bash
cd services/tenant-service
npm run repair-tenants
# or
npx ts-node src/scripts/repairTenants.ts
```

---

## Module Registration

All entities, services, and controllers registered in:
- `services/ehr-service/src/services/tenant.service.ts` — entities array in `createTenantConnection()`
- `services/ehr-service/src/ehr.module.ts` — controllers[] and providers[]

---

## Completion Status

All S226 deliverables are implemented and committed (`a223a4fa`).

| Area | Item | Status |
|------|------|--------|
| Frontend | UI for 9 new specialty modules | ✅ Done |
| Frontend | NCD comorbidity dashboard (DM↔CKD↔CVD triad view) | ✅ Done |
| Triage UI | `[object Object]` in Top Reason — nurse-friendly copilot panel | ✅ Done |
| Triage UI | Duplicate search boxes removed, cancel wired | ✅ Done |
| Malaria | ACT weight-based dosing table | ✅ Done |
| DB | Provisioning bundle `sprint226_specialty_modules` | ✅ Done |

## Future Sprints — Completed in S228/S229

| Area | Item | Status |
|------|------|--------|
| Maternity | Digital WHO partograph — `partograph_entries` table, CDSS alerts (FHR/BP/liquor/moulding), SVG cervicogram chart, `PartographChart` component in `MaternityEnrollmentDetailModal` | ✅ S228 Done |
| Traditional Medicine | Herb-drug interaction checker | ✅ Already implemented (S226) |
| Radiology | Structured report → ordering provider notification on `signReport()` via `NotificationCenterService`; `radiology_report_ready` trigger config seeded | ✅ S229 Done |
