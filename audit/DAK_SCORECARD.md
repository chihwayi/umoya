# DAK Conformance Scorecard (Sprint B, §3.1 Step B.10)

Oracle: `who-smart-guidelines-repos/smart-hiv/` (v0.4.4 draft, HEAD fb133bcb)
vs published WHO SMART HIV IG **v1.0.0 (Active 2025-07-08)**.
Deployed: `services/ehr-service/who-smart-guidelines/` (67 files, v0.4.4).
Validation: HL7 validator_cli 7.0.6 (base R4 + smart.who.int.hiv#1.0.0).

| Dimension | Score | Basis |
|---|---|---|
| Deployed artifact presence (HIV forms/workflows) | **100%** (67/67 by filename) | 11 PlanDefinition + 56 Questionnaire, 1:1 vs oracle FSH |
| Version currency | **STALE** | v0.4.4 draft vs published v1.0.0 (~7 mo upstream QA/release gap) |
| Data elements → Umoya fields → FHIR → codesystems | **~5%** | Blobs stored, no ValueSet (0/268), no validation, facility-local identifier systems, ICD-letter sniffing instead of WHO staging values |
| Decision tables, executable | **0/17** | 9 DAK tables have no computable form anywhere (even upstream); 8 have oracle CQL, 0 deployed; engine absent; `isActionApplicable` defaults applicable |
| Decision tables, form coverage | **~50%** | 7–8/17 tables have a Questionnaire/PD shell; S.1–S.4/E4/E12/D17/D21.1/D21.2/B7 have forms at best |
| Indicators (HIVIND/Measure) | **0%** | ~90 oracle Measures; 0 deployed; Umoya computes its own cascade (with wrong denominators — see §3.5) |
| FHIR profile validation (structure) | **PASS** | Q B7 vs v1.0.0 IG: 0E/0W; PD D15 vs IG: 0E/1W (narrative); PD B2 vs R4: 0E/1W; dangling Library/ActivityDefinition canonicals confirmed |
| Workflow fidelity | **Form-deep only** | Containers served as schemas; no flow execution, no state machine |
| Personas/RBAC mapping | **UNVERIFIED** | Blocker: seeded role matrix + endpoint walk |
| CQL/PlanDefinition execution | **ABSENT** | No engine, no Library content |
| Update process (new WHO release → deployed) | **ABSENT** | Manual file copy; no pinning/changelog/diff test |
| Non-HIV DAKs (immunizations v1.0.0, TB dak-tb v1.0.1, ANC draft, FP) | **0%** | No content, no consumers |

**Honest statement:** Umoya ships the WHO SMART HIV *encounter forms* at a
pre-release snapshot. Nothing resembling DAK decision support, coded data
capture, indicator computation, or multi-DAK coverage exists. "Up to date
with the WHO DAKs" is **not supportable** — not as logic (nothing executes),
not as content (draft-behind-release, HIV-only), and not as process (no update
path). The supportable sentence is: "HIV visit forms derived from the WHO
SMART HIV DAK (draft v0.4.4 snapshot) are available in the EHR; clinical logic
is hand-coded separately and was not derived from DAK artifacts."
