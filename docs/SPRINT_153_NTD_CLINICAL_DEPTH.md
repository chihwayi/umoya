# Sprint 153 — NTD Clinical Depth: Leprosy MDT, Onchocerciasis, Filariasis

**Sprint**: S153  
**Module**: Leprosy MDT Programme, Onchocerciasis MDA, Lymphatic Filariasis/Loiasis  
**Bundle version**: `2026.04.17.1`  
**Bundle ID**: `sprint153_ntd_clinical_depth`

## Objectives
Enhance clinical depth for Neglected Tropical Diseases (NTDs) by implementing specialized management for Leprosy MDT, Onchocerciasis MDA tracking, and critical safety protocols for Filariasis in Loa loa co-endemic regions.

---

## 1. Database & Provisioning
- [x] Create `tenant-ntd-clinical-depth.statements.ts` with schemas for:
  - `leprosy_cases`: WHO classification (PB/MB), Ridley-Jopling, Disability Grading (0/1/2), MDT dosing logs, lepra reactions.
  - `onchocerciasis_cases`: Ov16 serology, microfilaria density, ocular involvement, ivermectin MDA rounds.
  - `filariasis_cases`: MF count (Loa loa threshold), lymphoedema staging (Dreyer 0-7), treatment safety flags.
- [x] Register `sprint153_ntd_clinical_depth` in `database-provisioning.service.ts`.
- [x] Create TypeORM Entities in `services/ehr-service/src/ntd/entities/`:
  - `LeprosyCase`, `OnchocerciasisCase`, `FilariasisCase`.
- [x] Register entities in `TenantService`.

## 2. CDSS Intelligence (services/cdss-service)
- [x] Implement `/cdss/ntd/leprosy-mdt`:
  - Guidance on MDT blister pack selection based on PB/MB status.
  - Prednisolone tapering logic for Type 1 & Type 2 lepra reactions.
- [x] Implement `/cdss/ntd/filariasis-safety`:
  - **CRITICAL**: Loa loa MF count > 8000/mL check to block DEC/Ivermectin (encephalopathy risk).
  - Lymphoedema hygiene management suggestions.

## 3. EHR Backend (services/ehr-service)
- [x] Create `NtdService`:
  - Persistence logic for Leprosy, Onchocerciasis, and Filariasis.
  - Automatic CDSS safety check on Filariasis case creation.
- [x] Create `NtdController`:
  - REST endpoints for NTD clinical records and CDSS guidance.
- [x] Register `NtdModule` in `ehr.module.ts`.

## 4. Frontend Integration (ehr-frontend)
- [x] Update `api.ts` with `ntdApi` for case management and safety checks.
- [x] Create `NtdDashboard` component:
  - Specialized tabs for Leprosy, Oncho, and Filariasis.
  - "Unsafe" treatment warning badges for high Loa loa counts.
- [x] Integrate "Clinical Depth (S153)" tab into the main NTD Programs page.

---

## Final Validation Checklist
- [x] CDSS Loa loa safety logic blocks treatment if MF > 8000
- [x] Disability grading (0/1/2) labels match WHO standard
- [x] ESPEN MDA round tracking functional
- [x] `provision-repair-all.sh` clean; all tables exist
- [x] `npx tsc --noEmit` — 0 errors
- [x] `npm run lint` — 0 errors
- [ ] Git committed: `feat: implement Sprint 153 — NTD clinical depth (leprosy MDT, onchocerciasis, filariasis)`
