# Sprint 151 — Plague, Yellow Fever & Meningitis Protocols

**Sprint**: S151  
**Module**: Plague Case Management, Yellow Fever Surveillance, Bacterial Meningitis Protocol  
**Bundle version**: `2026.04.17.1`  
**Bundle ID**: `sprint151_plague_yfm_protocols`

## Objectives
Implement specialized clinical depth for endemic outbreaks, focusing on WHO 2021 Plague guidelines, Yellow Fever severity scoring, and Bacterial Meningitis pediatric/adult protocols.

---

## 1. Database & Provisioning
- [x] Register `sprint151_plague_yfm_protocols` in `database-provisioning.service.ts`
- [x] Create TypeORM Entities:
  - `PlagueCase`: bubonic/pneumonic flags, rodent/flea exposure, bubo size, gentamicin/doxy dosing logs.
  - `YellowFeverCase`: jaundice onset, haemorrhage sites, renal/hepatic failure markers (bilirubin/ALT/AST), WHO severity score.
  - `MeningitisCase`: CSF appearance/glucose/WBC, GCS score, purpura status, steroid/antibiotic timing.
- [x] Register entities in `TenantService` (ehr-service).

## 2. CDSS Intelligence (services/cdss-service)
- [x] Implement `/cdss/outbreak/plague-treatment`:
  - WHO 2021 guidelines: Gentamicin first-line, Ciprofloxacin for CNS/pneumonic depth.
  - Pregnancy/pediatric adjustments.
- [x] Implement `/cdss/outbreak/meningitis-management`:
  - Age-stratified antibiotic selection (Ceftriaxone vs. Cefotaxime/Ampicillin).
  - Steroid indication (Dexamethasone timing).
  - Fluid restriction vs. shock resuscitation logic.
- [x] Implement `/cdss/outbreak/yellow-fever-severity`:
  - Severity classification: Mild, Moderate, Severe/Malignant.
  - Risk of renal failure prediction.

## 3. EHR Backend (services/ehr-service)
- [x] Create `OutbreakProtocolService`:
  - Handle Plague, YF, and Meningitis case persistence.
  - Multi-tenant data isolation.
- [x] Create `OutbreakProtocolController`:
  - `POST /outbreak/plague`, `POST /outbreak/yellow-fever`, `POST /outbreak/meningitis`.
  - `GET /outbreak/...` list by patient.
- [x] Register `OutbreakProtocolModule` in `ehr.module.ts`.

## 4. Frontend Integration (ehr-frontend)
- [x] Update `api.ts` with `outbreakApi` methods.
- [x] Create `OutbreakProtocolDashboard` component:
  - Protocol-specific status badges.
  - High-vigilance "Amber Alerts" for S151 diseases.
- [x] Integrate "Protocols (S151)" tab into main Outbreak Surveillance dashboard.

---

## Final Validation Checklist
- [x] CDSS models pass Pydantic validation
- [x] Frontend Lucide icons consistent with EHR theme
- [x] CDSS abstention handled (amber banner)
- [x] `provision-repair-all.sh` clean
- [x] `npx tsc --noEmit` — 0 errors
- [x] `npm run lint` — 0 errors
- [ ] Git committed: `feat: implement Sprint 151 — Plague, Yellow Fever, Meningitis protocols`
