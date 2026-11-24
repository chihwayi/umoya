# 3.1 WHO SMART Guidelines / DAK Conformance

Branch: `audit/b-clinical-dak-ai`. Read-only; no source edited. Evidence from
executed runs (validator_cli 7.0.6, python probes) is quoted verbatim; code-read
claims are labeled as such. Ground-truth DAK versions were fetched from the
live web (not memory); local oracle `who-smart-guidelines-repos/smart-hiv/`
(untracked clone, HEAD `fb133bcb` 2025-12-08) used as the logic reference.

## Step A — Ground truth (web-verified 2026-11-24)

| DAK | Published status | Computable IG | Relevance to Umoya |
|-----|-----------------|---------------|-------------------|
| HIV | DAK 1st ed Jul 2022, 2nd ed Dec 2023; IG `http://smart.who.int/hiv` **v1.0.0, Active 2025-07-08** | `WorldHealthOrganization/smart-hiv` | Core (HIV Centre of Excellence claim) |
| Immunizations | DAK published; IG `smart.who.int/immunizations` **v1.0.0, Active 2026-10-02** | `WorldHealthOrganization/smart-immunizations` | Child-health catch-up claims — **no content in repo** |
| ANC | DAK narrative published; IG only draft CI build v0.3.0 (`smart-anc`), no v1.0.0 | draft only | Maternity module — **no content in repo** |
| TB | IG `smart.who.int/dak-tb` **v1.0.1, Active 2024-06-10** (canonical path is `dak-tb`) | `dak-tb` repo | TB/HIV claims — **no standalone TB DAK in repo** (only HIV.D4 screen-for-TB inside HIV DAK) |
| Family planning | Programme-listed; no IG version verified this pass | — | SRH claims — **no content in repo** |
| Hypertension/diabetes | **No SMART computable IG exists** (HEARTS package is narrative, not computable) | n/a | NCD claims cannot be "DAK-conformant" — no artifact to conform to |

Oracle snapshot: `sushi-config.yaml`/`ig.ini` declare id `smart.who.int.hiv`,
version **0.4.4, status draft, experimental true, releaseLabel ci-build** —
i.e. the local oracle (and the deployed content, both `"version": "0.4.4"`)
sits ~7 months behind published v1.0.0 on upstream QA/release changes.

## Step B.1 — Personas / actors: UNVERIFIED

RBAC roles exist (`roles.guard.ts`, counsellor filter in psychosocial
controller) but no mapping of DAK health-worker/client personas to roles was
found or tested. Blocker: needs seeded role matrix + endpoint walk (Sprint D).

## Step B.2 — Workflows: PARTIAL (forms only, no executable flow)

Deployed PlanDefinitions are 4 workflow containers (HIVARegistration,
HIVBTestingServices, HIVCPrEPVisit, HIVDCareAndTreatmentClinicalVisit) + 7
eca-rule DTs. They are served as form schemas
(`getSmartForm`/`convertQuestionnaireToForm`, service:311-492), never executed
as flows: `getRecommendations` substring-matches titles (service:265-277) and
`isActionApplicable` (service:498-615) evaluates conditions ONLY for
`language === 'text/fhirpath'` (service:519-577); everything else falls through
naive age/gender sniffing (service:580-606) to **`return true` (service:609)**.
Deployed DTs use `language: "text/cql-identifier"` (B9 uses one `text/cql`),
which never matches the fhirpath branch — **DT "logic" always defaults to
applicable**. No `cql-execution` dependency exists. EHR→CDSS enrichment
(`cdss.service.ts:1414-1416,1541-1543`) appends WHO text next to hardcoded
rules. Python CDSS ignores the FHIR content entirely (`clinical_guidelines.py`
hardcoded dict; `hiv_testing_algorithm.py` hand-coded Zimbabwe algorithm).

Verdict: workflow fidelity is form-deep. **PARTIAL**.

## Step B.3 — Core data elements: mapping (HIV DAK, sample)

Oracle data dictionary: 12 section sheets (HIV.A Registration … Surveillance,
Configuration); FSH models: 10 logical models; valuesets: ~268 FSH files.
Umoya capture: `hiv.service.ts` stores `whoSmartFormData` JSON blobs
(:356,:481,:533) — **blobs, never validated against the Questionnaires**.

| DAK element (example) | Umoya field | FHIR path | Code system |
|---|---|---|---|
| HIV.A demographics (name, DOB, sex, contact) | `patients` table columns | `PatientMapper.toFhir` → R4 Patient | identifier systems are facility-local URIs (`http://<tenant>.co.zw`), not WHO values |
| HIV.B7 test kit + result | `hiv_testing` flow (cdss algo in/out) | no TestingAlgorithm FHIR mapping found | kit names are local strings (Determine/Unigold/First Response) |
| HIV.D clinical stage / VL | `hiv_clinical_visits.viral_load`, problems `code LIKE 'C%/I%/J%'` | Observation (generic) | **ICD-10 first-letter sniffing**, not WHO staging ValueSets |
| HIV.H follow-up / HTS partner services | D25 questionnaire present as form | not executed | — |
| 0 of ~268 oracle ValueSets deployed | `valueSets` Map is dead (no files) | `answerValueSet` unresolvable | inline `answerOption` only |

Coverage: forms 1:1 (56/56 Questionnaires, 11/11 PlanDefinitions by filename);
**executable data-dictionary binding ~0%** (no ValueSet, no CQL, no validation).
Full per-element table is Sprint B follow-up work; the pattern is uniform.
**PARTIAL** (structure present, semantics absent).

## Step B.4 — Decision-table oracles: EXECUTED where Umoya has logic

Oracle DT inventory (17 tables in `HIV_DAK_2023-Web_Annex_B…Decision_support_231117_CLEAN.xlsx`):
S.1–S.4, B2, B7, E4, E12, B9, C7, C23, D4, D12, D15, D17, D21.1, D21.2.
Computable upstream: CQL for 8 (B2,B7,B9,C23,C7,D12,D15,D4); PlanDefinition FSH
for 7 (same minus B7); **9 tables have no computable form anywhere**
(S.1–S.4, E4, E12, D17, D21.1, D21.2). Upstream quirk inherited: HIVD15DT's
`library` points at HIVD4DTLogic CQL (`input/fsh/plandefinition/HIVD15DT.fsh:8`).

Umoya-side oracle runs (executed 2026-11-24, `.venv` python):
- **HIV testing (B7-analogous, Zimbabwe algorithm)**: 8/8 correct —
  negative, positive, discordant→indeterminate+refer, tiebreaker ±, invalid→retest,
  wrong-kit-step2 warns-but-resolves-positive, case-insensitive inputs.
  `hiv_testing_algorithm.process_test_sequence` — **VERIFIED** as a rule engine
  (note: Zimbabwe national algorithm, not WHO DAK CQL — alignment is by
  inspection, not derivation).
- **WHO CQL DTs (B2/B9/C7/C23/D4/D12/D15/D21.x)**: **no Umoya implementation to
  test** — CQL absent from deployables, engine absent from code. Mismatch rate
  is undefined, not zero. **ABSENT** (executable form).
- `isActionApplicable` default-true fallthrough: code-read (service:498-615),
  not executed (requires booted nest). Marked UNVERIFIED as behavior, but the
  `return true` at :609 plus zero CQL artifacts is conclusive that DT gating
  cannot depend on DAK logic. Severity S1 (headline "up to date with DAKs"
  implies logic conformance).

## Step B.5 — Indicators: NOT recomputed here (cascade covered in §3.5)

Oracle ships ~90 HIVIND CQL indicators + 90 Measure FSH; Umoya deploys none.
Umoya computes its own cascade (see `05_clinical_modules.md`: deaths/LTFU
included in denominators, strata/headline divergence — S1).

## Step B.6 — Functional/non-functional requirements: UNVERIFIED

Not walked requirement-by-requirement; blocked on booted environment + seeded
roles. The structural findings above already bound the ceiling at PARTIAL.

## Step B.7 — FHIR IG validation: EXECUTED (validator_cli 7.0.6)

- `Questionnaire-HIV.B7TestForHivUsingTestingAlgorithm.json` vs base R4:
  **1 Error** (`sdc-2: version present without versionAlgorithm` — file carries
  `"version": "0.4.4"`), 0 warnings. (Validator auto-applied SDC common profile
  via the file's SDC extension reference.)
- Same file vs published `smart.who.int.hiv#1.0.0`: **0 errors, 0 warnings,
  1 informational** — structurally compatible with v1.0.0.
- `PlanDefinition-HIVD15DT.json` vs v1.0.0 IG: **0 errors, 1 warning**
  (`dom-6` missing narrative — best practice), 4 informational, incl.
  confirmations that `Library/HIVD4DTLogic`-style canonicals
  (`Library/HIVB2DTLogic`, `ActivityDefinition/HIVGuidanceCommunicationRequestActivity`)
  **have no local target** — dangling references as predicted.
- Base-R4 run of `PlanDefinition-HIVB2DT.json`: 0 errors, same dom-6 warning.

So: deployed artifacts are well-formed R4/SDC/CPG-shape resources pinned at
v0.4.4 whose logic references resolve to nothing. Structural pass,
semantic void.

## Step B.8 — CQL/PlanDefinition execution + update process: ABSENT / UNVERIFIED

No CQL engine in either service; no version-pinning or WHO-update ingestion
tooling found (no changelog, no release job, no diff test). "Up to date" is a
snapshot property of v0.4.4 files, not a process. The update path is a human
copying new JSONs into the directory. **ABSENT** as a process; currency
UNVERIFIED beyond the v0.4.4-vs-v1.0.0 gap.

## Step B.9 — Guideline currency (clinical spot-checks)

- TLD-first-line default (`1i` preferred) matches current WHO consolidated
  guidelines. Second-line after NNRTI failure recommends PI-based ATV/r or
  LPV/r (executed — see §3.5/02); WHO 2021+ prefers DTG-based second line
  (DTG + optimized NRTIs) with PI as alternative, and has moved away from
  ATV/r specifically. Dated but inside the alternative set — S2, not S0.
- VL suppression threshold <1000 copies/mL throughout (`hiv.service.ts`
  :4149,:4155; cascade queries) matches WHO monitoring guidance. **VERIFIED** by code-read + execution (cascade probe).
- DTG+rifampicin handled as warn ("protocol-level dosing review") at
  `hiv.service.ts:2724-2738`; WHO requires DTG 50mg BID with rifampicin — no
  BID dosing found in switch outputs. S1 (under-dosed DTG + rifampicin risks
  treatment failure). Code-read; needs dosing-path execution to upgrade.
- Full currency review (ANC 8-contact, IFA, pre-eclampsia; HEARTS thresholds;
  immunization schedule) is out of scope — no corresponding content exists.

## Step B.10 — DAK Conformance Scorecard → see `DAK_SCORECARD.md`

Headline: **HIV forms 100% present at v0.4.4 draft; executable logic 0%;
non-HIV DAKs 0%. "Up to date with the WHO DAKs" is NOT supportable as a logic
claim; supportable only in the narrow sense "ships WHO HIV encuentro forms."**
