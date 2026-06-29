# Umoya EHR — Reporting & M&E Excellence Roadmap

**Created:** 2026-06-26  
**Target:** Raise reporting maturity from 6.2/10 to 9/10  
**Audience:** M&E teams, data managers, PEPFAR/MOH reviewers, district health officers

---

## Objective

The system captures clinical data at world-class depth across 24+ modules. This roadmap closes the gap between *data captured* and *insights delivered* — adding outcome linkage, clinical programme cascades, equity analytics, AI governance, and beautiful reactive reports across web and mobile.

---

## Sprint Map

### TIER 1 — Outcome Linkage & Missing PEPFAR Indicators (Foundational)

| Sprint | Title | What It Delivers | Days |
|---|---|---|---|
| **S230** | [Outcome Linkage Engine](sprints/S230-outcome-linkage-engine.md) | Post-encounter outcome tracking for all modules (delivery→42-day, TB→cure, nutrition→weight-gain, ICU→readmission). Infrastructure every downstream sprint depends on. | 7 |
| **S231** | [Missing DATIM/PEPFAR Indicators](sprints/S231-datim-missing-indicators.md) | TX_TB, TX_TB_D, TB_STAT, TB_ART, TB_PREV, PMTCT_EID, PMTCT_FO, HTS_SELF — completes the 16 standard MER 3.0 indicators. | 4 |
| **S232** | [Cascade Dashboards](sprints/S232-cascade-dashboards.md) | HIV 95-95-95, PMTCT, TB-HIV, NCD Control cascade funnels — web + mobile — with animated funnels, patient recall lists, PDF export. | 8 |
| **S233** | [Nutrition & Lab Quality](sprints/S233-nutrition-lab-quality.md) | Nutrition post-discharge follow-up (relapse tracking, weight-gain velocity). Lab QA (EQA scores, QC failures, repeat-test flags). | 6 |
| **S234** | [Maternal Mortality Audit Dashboard](sprints/S234-maternal-mortality-audit.md) | Full MDSR workflow — three-delay audit, preventability classification, action-item closure loop, MOHCC quarterly report PDF. | 8 |
| **S235** | [Population Health Gap Closure & AI Tracking](sprints/S235-population-health-gap-closure.md) | Care gap lifecycle (detected→outreach→closed). AI prediction recording and monthly outcome verification. | 7 |

---

### TIER 2 — Quality, Equity & DHIS2 Completeness

| Sprint | Title | What It Delivers | Days |
|---|---|---|---|
| **S236** | [Equity Analytics](sprints/S236-equity-analytics.md) | Disaggregate every KPI by age band, sex, location, insurance. Auto-detect disparities. Heat matrix UI. | 7 |
| **S237** | [Multi-Facility Benchmarking](sprints/S237-multi-facility-benchmarking.md) | Compare facility vs district median vs national P75. Percentile gauge widgets. Network league table. | 7 |
| **S238** | [DHIS2 Aggregate Gap Closure](sprints/S238-dhis2-aggregate-gap-closure.md) | Add quality/outcome data to 8 existing DHIS2 profiles — maternal deaths, NCD cascades, ICU quality, lab QA, MTCT rate, neonatal quality, discharge disposition. | 5 |
| **S239** | [Module Report Uplift Pack](sprints/S239-module-report-uplift.md) | Targeted report uplift for 7 low-scoring modules: Oncology (survival cohorts), Blood Bank (TTI/utilisation), Radiology (AI concordance), Dialysis (Kt/V), Dental (DMFT), Aviation Medicine (surveillance), OEM (longitudinal). | 10 |
| **S240** | [Pharmacy Intelligence Reports](sprints/S240-pharmacy-intelligence-reports.md) | Formulary adherence by department, drug waste by class, AMS (DDD/100 bed-days, Watch/Reserve split, carbapenem audit), cost-per-dose trends. | 6 |

---

### TIER 3 — Intelligence Loop & Mobile

| Sprint | Title | What It Delivers | Days |
|---|---|---|---|
| **S241** | [DHIS2 Validation Feedback Loop](sprints/S241-dhis2-validation-feedback-loop.md) | Nightly pull of DHIS2 validation rule violations + outlier detection back into EHR as actionable alerts. DQA score tracked over time. | 5 |
| **S242** | [AI Model Governance Registry](sprints/S242-ai-model-governance-registry.md) | Full AI governance dashboard: AUC trend, calibration plots, fairness checks, formal review workflow, drift alerts, audit trail. | 6 |
| **S243** | [De-identified Research Data Portal](sprints/S243-research-data-portal.md) | Complete research.service.ts: HIPAA Safe Harbor de-id, time-limited token-authenticated exports, researcher self-service portal, full audit log. | 7 |
| **S244** | [Mobile Clinical Reports & Analytics](sprints/S244-mobile-clinical-reports.md) | Full reporting layer in Expo app — cascade funnels, equity heat grids, MDSR summary, DHIS2 alerts, pharmacy reports, lab QA, AI governance on mobile. Share to WhatsApp. | 7 |
| **S245** | [Universal Report Export Engine](sprints/S245-universal-report-export-engine.md) | Branded PDF (pdfmake), XLSX (exceljs), CSV export from every dashboard. Monthly bundle ZIP for district submissions. ExportMenu component wired everywhere. | 7 |

---

## Implementation Order (Recommended)

```
S230 → S231 → S232                 (Week 1–3: foundation must go first)
         ↓         ↓
S233   S234   S235                  (Week 3–5: outcome modules in parallel)
         ↓         ↓
S236   S237   S238                  (Week 5–7: quality & equity)
         ↓         ↓
S239   S240                         (Week 7–9: module uplift, can parallel)
         ↓
S241   S242   S243                  (Week 9–11: intelligence loop)
         ↓
S244   S245                         (Week 11–13: mobile + export, can parallel)
```

Total: ~13 weeks for one full-stack engineer pair. Can be compressed to 8–9 weeks with 2 pairs.

---

## Dependency Map

```
S230 (Outcome Linkage)
 ├── S231 (PMTCT_FO uses encounter_outcomes)
 ├── S232 (cascade rates use outcomes)
 ├── S233 (nutrition follow-up uses schedules)
 ├── S234 (MDSR 42-day tracking)
 ├── S235 (AI prediction verification)
 └── S238 (DHIS2 pushes outcome data)

S231 (DATIM indicators)
 └── S232 (TB-HIV cascade uses new indicators)

S232 (Cascades)
 └── S236 (equity disaggregates cascade metrics)

S233 (Lab QA)
 └── S238 (lab QA pushed to DHIS2)

S234 (MDSR)
 └── S238 (maternal deaths pushed to DHIS2)

S235 (Population Health / AI)
 └── S242 (AI governance extends S235 foundation)

All S230–S242
 └── S244 (mobile uses all endpoints)
 └── S245 (export engine wraps all dashboards)
```

---

## Expected Maturity Improvements After All Sprints

| Module | Before | After |
|---|---|---|
| HIV/ART | 8/10 | 9/10 |
| ICU | 8/10 | 9/10 |
| Maternity/PMTCT | 7/10 | 9/10 |
| Lab | 7/10 | 9/10 |
| Pharmacy | 7/10 | 9/10 |
| TB | 6/10 | 9/10 |
| Radiology | 6/10 | 8/10 |
| NCD/OPD | 5/10 | 8/10 |
| Population Health | 5/10 | 9/10 |
| Nutrition | 5/10 | 8/10 |
| Mental Health | 5/10 | 7/10 |
| Oncology | 4/10 | 7/10 |
| Dialysis | 4/10 | 7/10 |
| Blood Bank | 5/10 | 7/10 |
| OEM | 5/10 | 7/10 |
| Dental | 3/10 | 6/10 |
| Aviation Medicine | 4/10 | 7/10 |
| **Overall** | **6.2/10** | **8.6/10** |

---

## What M&E Teams Will See

| Need | How It's Met |
|---|---|
| Programme cascades (HIV 95-95-95, PMTCT, TB-HIV, NCD) | S232 — animated funnel dashboards + mobile |
| Outcome tracking (was the patient cured/alive?) | S230 — encounter_outcomes across all modules |
| PEPFAR DATIM complete submission (all 16 MER 3.0 indicators) | S231 — TX_TB, TB_STAT, PMTCT_EID, PMTCT_FO added |
| Equity analysis (who is being left behind?) | S236 — age/sex/insurance/location heat matrix |
| Facility benchmarking (how do we rank nationally?) | S237 — percentile gauge vs DHIS2 national data |
| Data quality assurance (is our DHIS2 data right?) | S241 — validation feedback loop, DQA score |
| AI model oversight (do the AI tools work?) | S242 — calibration, fairness, governance trail |
| Research data access (de-identified export) | S243 — HIPAA Safe Harbor portal, token-auth |
| Reports to print for review meetings | S245 — PDF + XLSX with full UMOYA branding |
| Field use on phone | S244 — full mobile reporting suite |
| Maternal mortality accountability | S234 — MDSR workflow + MOHCC report PDF |

---

*Document generated: 2026-06-26 · Umoya EHR Reporting Roadmap v1.0*
