# Sprint E — Quality, Tests, Regulatory Posture & Brochure Hygiene (3.13)

## 1. Mutation testing, sampled (executed, source restored byte-identical)

Target: `kaplan-meier.service.ts` (3-test spec, green baseline). Four
hand-applied mutants, spec re-run each, file restored (verified via
`git diff --stat` = clean):

| Mutant | Change | Result |
|---|---|---|
| M1 | Greenwood accumulation `+= 0` (CIs collapse to point estimate) | **SURVIVED** — no test asserts any CI value |
| M2 | Remove CI clamp `[0,1]` | **SURVIVED** — no bounds test |
| M3 | Median `<= 0.5` → `< 0.5` | **SURVIVED** — no S=0.5 boundary test |
| M4 (control) | Break KM product `(+1)` | KILLED (2 failed) |

3/4 non-core mutants survive: the spec pins point estimates only. The
shipped null-CI-on-degenerate-input defect (RES-005) is exactly the class
this spec cannot see. Verdict: mutation-adequate for the happy path,
blind on every safety-relevant edge — consistent with the mortality-spec
finding below.

**Mortality spec locks in the unvalidated formula (code-read + executed
failure).** `mortality-risk.service.spec.ts` hard-codes the point
arithmetic (`age ~76 → 15pts… = 26 → moderate`) — and currently **FAILS**
(`Expected "moderate", Received "low"`): the SQL-substring mocks no
longer match the service's queries, so comorbidity counts come back 0.
The suite that would bless the made-up weights cannot even reproduce
them. (This is also staleness class B below.)

## 2. Test-suite staleness (executed: full 187-suite run, 252 s)

Reproduced exactly: **34 failed suites / 187, 30 failed tests / 1201.**
Four distinct staleness mechanisms demonstrated (one suite each):

- **A. Stale schema in assertions** — `cohort-builder.spec` expects
  `p.sex = $1`; implementation emits `p.gender = $1` (column renamed,
  spec not updated).
- **B. Stale SQL-substring mocks** — `mortality-risk.spec` mocks keyed on
  query fragments (`status = 'chronic'`) the service no longer emits;
  mocks silently return `[]`, scores collapse, bands flip.
- **C. Stale call-shape expectations** — `terminology.controller.spec`
  asserts a service call the controller no longer makes that way
  (1 failed / 8).
- **D. Stale signatures (TS2345, suite won't compile)** —
  `offline-sync.service.spec` calls `processBatch('clinic-a', …)` but the
  service now takes `(tenantDb: DataSource, …)` first. **The idempotency
  path Sprint D verified live (O-003) has zero compiling unit coverage.**

Failing-suite roster clusters on AI/CDS and integration seams
(care-gap, appointment-ai, patient-risk-scoring, telemedicine-video,
terminology ×2, radiology-ai, offline-sync, smart-scheduling,
multilingual-education, supply-chain-ai, …). Characterization: the suite
is not run green before merges — CI's `npm test` gate evidently tolerates
(or never sees) this state, since `ci.yml` runs tests only under the main
`build-and-test` job whose failure would block PRs. Either the gate is red
and routinely overridden, or these suites fail only outside CI's
configuration — both readings mean the suite does not protect merges.
(Which one is CI-side UNVERIFIED; the local red is executed fact.)

## 3. Regulatory posture (broad grep, zero hits)

No `IEC 62304`, `ISO 14971`, `ISO 13485`, `SaMD`, `FDA`, `CE mark`,
`MDR`, clinical-evaluation, or risk-management-file references anywhere
in product code or docs (deps/builds/audit excluded; absence-evidence
rule satisfied: two pattern families, whole tree). For software that
scores mortality, checks interactions, reads radiology, and doses
paediatric ART, there is no visible software-safety classification,
no hazard analysis, and no SaMD determination on file. This is a
pre-pilot gap statement, not legal advice: a regulator or hospital risk
committee will ask for 62304 class + 14971 file + SaMD determination
before clinical use, and none exists to review. (S2 as process gap;
compounds every S0/S1 — harm without a hazard file is undocumented harm.)

## 4. Dead-code / mock hygiene

- `MockEhrModule` reachable **only** via `mock-main.ts` (separate
  bootstrap); production `main.ts` never imports it (positive — Sprint A's
  R-005 concern closed for the boot path).
- `MOCK_VISION_AI=true` in `.env` gates nothing (zero references in src)
  — dead env, S4.
- `dhis2-real.service.ts.example` remains an uncompiled sketch (Sprint C
  context, unchanged).

## 5. Brochure-claim hygiene rollup (all sprints; rewordings are suggestions)

| ID | Claim (short) | Standing | Honest rewording |
|---|---|---|---|
| C-001 | AI-first, FHIR-native, offline, connected | MISLEADING | "Relational EHR with a FHIR façade, store-and-forward offline, AI-assisted features in validation" |
| C-002/C-003 | R4+R5, HIPAA-ready | MISLEADING | "FHIR R4 read/write façade; R5 not negotiated; HIPAA-style controls with listed gaps; CDPA review pending" |
| C-004/C-033 | DHIS2 bidirectional real-time, no spreadsheet | PARTIAL | "DHIS2 aggregate push (mock default; scheduled, not real-time); tracker pull is metadata/config only" |
| C-005 | 8 languages | PARTIAL | "8-locale UI chrome shipped; dosing/allergy vocabulary needs native-speaker review (P-006)" |
| C-006 | Offline-first | PARTIAL | "Queued offline writes with idempotent replay; conflicts last-write-wins silently; interaction checks unavailable offline" |
| C-011 | AI hard-stops | **BROKEN** (B-001) | Remove until sensitivity > bar + enforcement primitive exists |
| C-012 | 30-day mortality badge | MISLEADING (B-005) | "Unvalidated heuristic — do not use for triage" or remove |
| C-015 | Zero rekeying | BROKEN (I-013, P-004b) | "Single entry with targeted re-entry at referral/encounter sync" |
| C-016/C-034 | De-identified cohorts, 18 identifiers scrubbed | **BROKEN** (RES-001/002/003) | Suspend research exports until re-identification chain closed |
| C-017/C-035 | KM + Greenwood | PARTIAL (RES-005) | "KM correct to 3dp, plain Greenwood; no 1e-6 claim; null CIs on degenerate input" |
| C-018/C-036 | VigiBase E2B | **BROKEN** (RES-006) | "Adverse-event register with manual VigiFlow entry" (and stop setting the exported flag) |
| C-019 | 95-95-95 without spreadsheet | BROKEN (B-007, I-012) | Fix denominator + single-computation pipeline first |
| C-020 | Full CDS suite | PARTIAL→BROKEN on dosing/interactions (B-001, B-002 dose traps, B-008) | List validated vs heuristic modules separately |
| C-021 | PDMP | STUB (B-018) | Remove or label roadmap |
| C-024 | BCMA five rights | **BROKEN** (UX-001) | "Barcode capture without cross-checks" until matching is implemented |
| C-025 | HIV centre of excellence | PARTIAL (B-008 S0 regimen blind spot; disclosure S-002 fixed-shape) | Disclose known regimen-switch + disclosure-governance limits |
| C-026 | NCD calculators | PARTIAL (eGFR equation ABSENT B-013; Framingham misuse B-014) | Name the validated calculators actually shipped |
| C-030/C-031 | FHIR-native, referrals/insurers zero-rekey | MISLEADING (R-001, I-001–I-004, S-001) | "FHIR R4 façade over relational store; batch ops unreachable; patient scoping per-tenant only" |
| C-032 | SMART apps | ABSENT (no well-known) | Remove until implemented |
| C-037 | Collaborator access without EHR account | **BROKEN** (RES-007) | "Collaborator tokens (requires EHR JWT pending fix)" — or fix the guard |
| C-040 | Legacy import (meds/history) | PARTIAL (I-014 demographics-only, silent loss) | "Demographics + identifier import; clinical history import lossy" |
| C-043 | Parallel go-live tooling | ABSENT (I-016) | Remove |
| C-046/C-050 | Pre-visit 48h SMS, sync | PARTIAL (P-004 resubmission + dropped fields) | "Single-shot intake; meds/allergies re-confirmed in person" |
| C-047/C-051 | QR check-in | **BROKEN** (P-001) | Remove until redeem works |
| C-048/C-062 | Household privacy-safe | **BROKEN S0** (P-002/P-003) | Suspend household propagation for HIV/STI immediately |
| C-052 | Payments | PARTIAL (S-012 unsigned callbacks; no ZiG FX) | "Provider callbacks accepted without signature verification — hardening in progress" |
| C-053–C-061 | Wearables + 3-reading alerts | PARTIAL (bridge STUB R-006; backend works; P-008 downgrade) | "Alert pipeline functional on ingested data; device sync pending; critical-escalation fix pending" |
| C-057 | E2E telemed | MISLEADING (P-007) | "Encrypted transport + recorded egress; not end-to-end" |
| C-063 | Zero paperwork (pre-visit timing) | OVERSTATED (P-004) | Intake reduces but does not eliminate in-person confirmation |

## Rule-2 rechecks

Mutation: control mutant killed (harness valid); file restored
byte-identical. Staleness: full-suite executed twice (252 s + FAIL-list
run), four classes each shown on a named suite. Regulatory: two grep
families, deps excluded. Mock reachability: import-graph traced.
Brochure rows cite the originating finding ID — no new verdicts invented
here.
