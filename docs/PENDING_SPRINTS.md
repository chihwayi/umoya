# MediCore — Pending Sprints

**Last updated:** 2026-04-16  
**Sprint series:** Three identified gaps in the sprint numbering (S126, S147, S148)  
**System reference:** See `MEDICORE_REFERENCE.md` for architecture rules, patterns, and file locations.

---

## Status Overview

| Sprint | Title | File | Priority |
|--------|-------|------|----------|
| **S126** | Reporting Completeness | `SPRINT_126_REPORTING_COMPLETENESS.md` | HIGH — compliance + finance |
| **S147** | Maternal Mortality Audit & EmONC | `SPRINT_147_MATERNAL_MORTALITY_EMONC.md` | HIGH — SADC clinical gap |
| **S148** | Diabetic Foot, Wound Care & NCD Complications | `SPRINT_148_NCD_COMPLICATIONS.md` | MEDIUM — NCD suite completion |

---

## Recommended Execution Order

1. **S126** — No new DB entities. Fixes broken compliance reports and adds real lab turnaround. Unblocks any audit/accreditation work.
2. **S147** — New DB tables, CDSS endpoint, and Maternity dashboard tab. EmONC tracking is a WHO SADC requirement.
3. **S148** — New DB tables, CDSS endpoint, and NCD dashboard tab. Completes the S142–S145 NCD suite.

---

## Rules for Every Sprint (non-negotiable)

Before writing a single line of code, read **`MEDICORE_REFERENCE.md`** fully. Key rules:

1. **DB changes** — every new table needs: (a) TypeORM entity, (b) entity registered in `tenant.service.ts` entities array, (c) provisioning bundle in `database-provisioning.service.ts`, (d) run `./scripts/provision-repair-all.sh`.
2. **AI calls** — all EHR→CDSS calls go through `CdssService`. PHI-touching calls use `callGovernedJson()`. Never call CDSS directly from a controller.
3. **Frontend** — all API calls go through `ehr-frontend/src/services/api.ts`. Tailwind v3 only. `lucide-react` icons. No UI libraries.
4. **Done gate** — `npx tsc --noEmit` zero errors. Lint passes. `provision-repair-all.sh` runs clean.

---

## Completed Sprint History (summary)

All sprints from S1 through S149 are complete except S126, S147, and S148.

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
| **S126** | **PENDING — see SPRINT_126_REPORTING_COMPLETENESS.md** |
| S127–S128 | Proactive AI Nervous System + AI cohesion |
| S129–S134 | EPI/Immunization, Outbreak surveillance, Mobile money, CHW module, SAM/CMAM nutrition, NHIF/CBHI billing |
| S135–S140 | SA national interop, DHIS2/DATIM, SMS/USSD, OpenMRS FHIR, CRVS, NTD/malaria depth |
| S141–S146 | mhGAP, Cervical cancer + FP, HTN + WHO PEN, Traditional medicine, Sickle cell, Epilepsy, One Health + PACTR |
| **S147** | **PENDING — see SPRINT_147_MATERNAL_MORTALITY_EMONC.md** |
| **S148** | **PENDING — see SPRINT_148_NCD_COMPLICATIONS.md** |
| S149 | NHIF/CBHI capitation billing (enhanced) |
