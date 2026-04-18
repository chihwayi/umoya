# MediCore — Pending Sprints

**Last updated:** 2026-04-18  
**System reference:** See `MEDICORE_REFERENCE.md` for architecture rules, patterns, and file locations.

---

## Status Overview

| Sprint | Title | File | Priority |
|--------|-------|------|----------|
| **S126** | Reporting Completeness | `SPRINT_126_REPORTING_COMPLETENESS.md` | HIGH — compliance + finance |
| **S147** | Maternal Mortality Audit & EmONC | `SPRINT_147_MATERNAL_MORTALITY_EMONC.md` | HIGH — SADC clinical gap |
| **S148** | Diabetic Foot, Wound Care & NCD Complications | `SPRINT_148_NCD_COMPLICATIONS.md` | MEDIUM — NCD suite completion |
| **S150** | Mpox / Ebola / VHF Case Management | `SPRINT_150_MPOX_EBOLA_VHF.md` | CRITICAL — active WHO PHEIC |
| **S151** | Plague / Yellow Fever / Meningitis | `SPRINT_151_PLAGUE_YELLOW_FEVER_MENINGITIS.md` | CRITICAL — epidemic-prone diseases |
| **S152** | SORMAS + IHR Annex 2 Pipeline | `SPRINT_152_SORMAS_IHR_PIPELINE.md` | CRITICAL — WHO notification compliance |
| **S153** | NTD Clinical Depth (Leprosy / Filariasis / Oncho) | `SPRINT_153_NTD_CLINICAL_DEPTH.md` | HIGH — Loa loa safety gate |
| **S154** | CBHI Deep Module | `SPRINT_154_CBHI_DEEP_MODULE.md` | HIGH — Universal Health Coverage |
| **S155** | Language Pack + i18n (8 languages) | `SPRINT_155_LANGUAGE_PACK_I18N.md` | HIGH — Africa multilingual |
| **S156** | TBA + Rural Birth Registration | `SPRINT_156_TBA_RURAL_BIRTH_REGISTRATION.md` | HIGH — CRVS completeness |
| **S157** | DISA + SmartCare Integration | `SPRINT_157_DISA_SMARTCARE_INTEGRATION.md` | HIGH — Mozambique/Zambia interop |
| **S158** | Low-Bandwidth Lite Mode + PWA | `SPRINT_158_LOW_BANDWIDTH_LITE_MODE.md` | HIGH — rural facility connectivity |
| **S159** | Ubuntu Cultural Health | `SPRINT_159_UBUNTU_CULTURAL_HEALTH.md` | MEDIUM — SADC cultural competency |
| **S160** | UHC SCI + SDG Indicators | `SPRINT_160_UHC_SDG_INDICATORS.md` | HIGH — WHO/DHIS2 reporting |
| **S161** | NCID National Client Identification | `SPRINT_161_NCID_NATIONAL_CLIENT_ID.md` | HIGH — deduplication + cross-programme linkage |

---

## Recommended Execution Order

### Immediate / Compliance (do first)
1. **S126** — No new DB entities. Fixes broken compliance reports and real lab turnaround. Unblocks any audit/accreditation work.

### Critical Outbreak (do before any disease surveillance is used)
2. **S150** — Mpox/VHF: active WHO PHEIC 2024. Case definitions, isolation, PPE, contact tracing.
3. **S151** — Plague/Yellow Fever/Meningitis: epidemic-prone protocols.
4. **S152** — SORMAS push + IHR Annex 2: WHO notification pipeline.

### Clinical Gaps
5. **S147** — Maternal Mortality Audit + EmONC. 3 new tables, CDSS, Maternity dashboard tab.
6. **S148** — NCD Complications (diabetic foot, retinopathy, CKD). Completes the S142–S145 NCD suite.
7. **S153** — NTD Clinical Depth. Critical Loa loa MF safety gate.

### Infrastructure / Interoperability
8. **S161** — NCID. Deduplication + cross-programme gap CDSS. Foundation for cross-facility patient matching.
9. **S157** — DISA (Mozambique VL/EID) + SmartCare (Zambia ART) integration.
10. **S158** — Low-bandwidth lite mode + PWA + IndexedDB offline queue.
11. **S155** — i18n: 8 languages (EN/PT/FR/SW/ZU/AF/SN/ND).

### Health Systems / Coverage
12. **S154** — CBHI deep module (household registry, claims adjudication, fraud CDSS).
13. **S160** — UHC SCI + SDG indicators (quarterly analytics, DHIS2 push).
14. **S159** — Ubuntu Cultural Health (SDoH, family consent, psychosocial wellbeing).
15. **S156** — TBA + rural birth registration (CRVS auto-notification).

---

## Rules for Every Sprint (non-negotiable)

Before writing a single line of code, read **`MEDICORE_REFERENCE.md`** fully. Key rules:

1. **DB changes** — every new table needs: (a) TypeORM entity, (b) entity registered in `tenant.service.ts` entities array, (c) provisioning bundle in `database-provisioning.service.ts`, (d) run `./scripts/provision-repair-all.sh`.
2. **AI calls** — all EHR→CDSS calls go through `CdssService`. PHI-touching calls use `callGovernedJson()`. Never call CDSS directly from a controller.
3. **Frontend** — all API calls go through `ehr-frontend/src/services/api.ts`. Tailwind v3 only. `lucide-react` icons. No UI libraries.
4. **Done gate** — `npx tsc --noEmit` zero errors. Lint passes. `provision-repair-all.sh` runs clean. Git commit only after all gates pass.

---

## Completed Sprint History (summary)

| Range | Summary |
|-------|---------|
| S1–S58 | Core EHR platform (multi-tenant, roles, billing, FHIR, HIV, TB, Maternity, Lab, Pharmacy, ED) |
| S59–S95 | 37-sprint AI-First EHR build (proactive AI, care gaps, ambient scribe, specialty modules, federated learning) |
| S96–S102 | World-class gap closure (Radiology AI, real-time alerts, model drift, patient AI, trial matching, supply chain, full CDSS Python) |
| S103 | Autonomous learning loop + model registry |
| S104–S108 | Telemedicine real video (Daily.co), WebSocket gateway, state machine, PostVisit bridge, God Class decomposition |
| S109–S111 | Mobile Expo app, ICD-11/SNOMED, encounter + pharmacy intelligence |
| S112–S118 | P0 safety, UI completeness, clinical RAG/pgvector, denial prediction, risk stratification, registration AI, DICOM viewer, frontend AI transparency |
| S119–S123 | Order set AI, nursing care plan AI, admission/discharge med rec, discharge summary AI, A/B shadow mode + fairness metrics |
| S124–S125 | Mobile point-of-care (8 features) + mobile backend wiring (7 endpoint gaps) |
| **S126** | **PENDING** |
| S127–S128 | Proactive AI Nervous System + AI cohesion |
| S129–S134 | EPI/Immunization, Outbreak surveillance, Mobile money, CHW module, SAM/CMAM nutrition, NHIF/CBHI billing |
| S135–S140 | SA national interop, DHIS2/DATIM, SMS/USSD, OpenMRS FHIR, CRVS, NTD/malaria depth |
| S141–S146 | mhGAP, Cervical cancer + FP, HTN + WHO PEN, Traditional medicine, Sickle cell, Epilepsy, One Health + PACTR |
| **S147** | **PENDING** |
| **S148** | **PENDING** |
| S149 | NHIF/CBHI capitation billing (enhanced) |
| **S150–S161** | **PENDING — Africa coverage + NCID gap sprints** |
