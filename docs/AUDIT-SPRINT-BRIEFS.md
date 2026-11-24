# UMOYA Adversarial Audit — Delegation Sprints (A–F)

These are standalone, copy-pasteable briefs for delegating `docs/UMOYA_AUDIT_PROMPT.md` to
Muse Spark in manageable chunks. Each sprint is scoped to a subset of the master prompt's
domains so a single agent run can actually finish it with real evidence, instead of
attempting all 14 domains + E2E scenarios + executive summary in one shot.

**Workflow for every sprint (same discipline as the Clinician Network sprints S285–S289):**
1. Give Muse Spark the sprint's brief text below, verbatim.
2. Muse works on its own branch, opens a PR, does **not** merge to `main`.
3. The repo owner relays the PR back here for independent review — every finding gets
   spot-checked (re-run the claimed command, re-read the claimed file/line), not just
   trusted because the report says "VERIFIED". A domain report that is all `VERIFIED`
   with thin evidence is itself a finding (see Rule 0.1 in the master prompt).
4. Only after review does the PR get merged.
5. Move to the next sprint once the current one is merged (B–D are content-independent
   of each other and *could* run in parallel across multiple Muse sessions if desired —
   default is sequential to keep the single-relay review workflow manageable).

**Standing reminder for every sprint below:** this is a **read-only, report-only** audit.
No source files are edited, no real patient data is used, nothing is fixed. If any test
needs synthetic seed data that requires a **new database table or column**, that table
must go through this repo's normal provisioning-bundle system
(`services/tenant-service/src/services/database-provisioning.service.ts`,
see `docs/PROVISIONING_GUIDE.md`) — never a hand-run `CREATE TABLE` against the real
tenant or master Postgres databases. Prefer a throwaway local Postgres/Docker instance
you stand up and tear down yourself for audit-only scratch data, unless a sprint brief
below explicitly tells you to run against this project's own local dev stack
(`docker-compose.yml`).

---

## Sprint A — Recon + Claims Ledger

Read `docs/UMOYA_AUDIT_PROMPT.md` in full first — it is the master audit spec for this
repo (Umoya, a multi-tenant EHR). Its Section 0 "Rules of Engagement" and verdict/severity
vocabularies apply to **every** audit sprint, not just this one; internalize them before
starting.

**Scope for this sprint only:** Section 1 (Phase 1 — Recon) and Section 2 (Phase 2 — Build
the Claims Ledger). Do not start Section 3 domain audits yet — later sprints cover those.

Work on a new branch `audit/a-recon-ledger`. Do not merge to `main`.

Deliverables (all under `./audit/`):
- `00_recon.md` per Section 1's checklist (repo map, architecture, FHIR storage location,
  auth/RBAC/audit-log/encryption/offline-sync/AI-call-site/DHIS2/telemedicine/payment/
  wearable/i18n inventory, test inventory, install/build/lint/typecheck/test-suite/vuln-scan
  results verbatim, stub/mock/TODO census grep results).
- `RUNBOOK.md` — exact steps to stand up a local environment with synthetic seed data,
  so later sprints (and the human reviewer) can reproduce your environment.
- `CLAIMS_LEDGER.md` — the full table from Section 2, built from the brochure claims list
  in the master prompt (C-001 through C-063), each with `ID | Claim (verbatim) | Where
  implemented | Verdict | Severity | Evidence`. For this sprint, populate "Where
  implemented" and a first-pass verdict based on recon alone (deep testing happens in
  later sprints) — mark anything you haven't verified yet as `UNVERIFIED` rather than
  guessing.
- `FINDINGS.jsonl` — start the ledger (can be sparse this sprint; later sprints append).

Open a PR when done with a summary of what you found, what you could and could not run,
and any environment blockers. Do not merge.

---

## Sprint B — WHO DAK Conformance + AI/CDS + Clinical Modules

Depends on Sprint A's PR being merged first — read its `./audit/CLAIMS_LEDGER.md` and
`./audit/RUNBOOK.md` before starting so you're not re-deriving the environment setup from
scratch.

Read `docs/UMOYA_AUDIT_PROMPT.md` Section 0 (Rules of Engagement — applies to this sprint
too) and this sprint's scope: **Section 3.1** (WHO SMART Guidelines / DAK Conformance),
**Section 3.2** (AI / Clinical Decision Support), **Section 3.5** (HIV, NCD & Specialty
Modules). This is the highest patient-safety-risk sprint in the whole audit — be ruthless,
per Section 3.2's own instruction.

You have internet access for this sprint — Section 3.1 Step A requires fetching the actual
current WHO SMART Guidelines DAK versions from smart.who.int and the WHO GitHub org, not
relying on memory. Do not invent DAK content, versions, or logic.

Work on a new branch `audit/b-clinical-dak-ai`. Do not merge to `main`.

Deliverables (all under `./audit/`):
- `01_who_dak.md`, `02_ai_cds.md`, `05_clinical_modules.md` — full depth per the master
  prompt's instructions for each (DAK data-element mapping tables, decision-table oracle
  comparisons, FHIR IG profile validation, drug-interaction gold-set testing with
  sensitivity/specificity, dosing boundary tests, mortality-score validation, LLM
  hallucination/omission/prompt-injection tests for every LLM feature, ART regimen-switch
  safety checks, CDPA 2021 technical-controls check).
- `DAK_SCORECARD.md` — the per-DAK conformance scorecard from Section 3.1 Step B.9.
- `AI_REALITY_TABLE.md` — the Real ML / Rule-based / LLM / Stub classification from
  Section 3.2.9, for every AI feature found.
- Append your findings to `./audit/FINDINGS.jsonl` in the same schema Sprint A started.

Flag every clinically unsafe finding (wrong drug interaction, wrong dosing, unsafe ART
regimen logic, etc.) as **S0** per the master prompt's severity vocabulary — do not
downgrade severity to avoid an alarming report. Open a PR when done. Do not merge.

---

## Sprint C — FHIR + DHIS2 + Data Migration

Can run independently of Sprint B (different domain), but still read Sprint A's
`CLAIMS_LEDGER.md` and `RUNBOOK.md` first for environment context.

Read `docs/UMOYA_AUDIT_PROMPT.md` Section 0, then this sprint's scope: **Section 3.3**
(FHIR / Interoperability), **Section 3.4** (DHIS2), **Section 3.10** (Data Integrity,
Migration & Interop-with-Legacy).

You have internet and Docker access for this sprint. Section 3.4 requires standing up a
real DHIS2 instance (`docker dhis2/dhis2-core`) to test against. Section 3.3 requires the
HL7 FHIR Validator (`validator_cli.jar`) to validate exported resources against base spec
and relevant IGs. Do not skip these by reasoning about the code only — run them.

Work on a new branch `audit/c-interop-data`. Do not merge to `main`.

Deliverables (all under `./audit/`):
- `03_fhir.md` — canonical storage determination, CapabilityStatement inspection, R4 vs
  R5 genuine-support test, HL7 validator results per resource type, terminology binding
  checks, bidirectional exchange tests (malformed/duplicate/conflicting/large bundles),
  the "zero manual rekeying" claim traced step-by-step and falsified or confirmed, HL7 v2
  message ingestion tests, FHIR API authorization/IDOR tests.
- `04_dhis2.md` — aggregate + tracker tests against the real DHIS2 instance, bidirectional
  claim verification (what's actually pulled vs pushed), latency measurement for the
  "real-time" claim, indicator recomputation (95-95-95, SDG 3, PEPFAR/MOHCC) against
  hand-verified seeded-cohort answers.
- `10_data_migration.md` — messy legacy data import tests (duplicates, bad dates, encoding
  issues, non-standard drug names, 100k-patient scale), parallel-go-live reconciliation
  tooling check, referential/clinical integrity tests, MPI fuzzy-matching tests with
  Shona/Ndebele name variants.
- Append findings to `./audit/FINDINGS.jsonl`.

Open a PR when done, with raw tool output (validator reports, DHIS2 import logs) included
or linked under `./audit/TEST_ARTIFACTS/`. Do not merge.

---

## Sprint D — Security + Offline/Sync + Patient App/Telemedicine

Can run independently of B and C. Read Sprint A's `CLAIMS_LEDGER.md`/`RUNBOOK.md` first.

Read `docs/UMOYA_AUDIT_PROMPT.md` Section 0, then this sprint's scope: **Section 3.7**
(Patient App, Telemedicine, Wearables, Payments), **Section 3.8** (Offline-First & Sync),
**Section 3.9** (Security, Privacy & Compliance).

**Authorization note:** this is the repo owner's own system, and this is authorized
security testing of their own codebase for pre-sales/pilot readiness — not an external
engagement. Use only synthetic data and sandbox/test credentials (never real payment
provider production keys, never real patient data). Treat yourself as a low-privilege
authenticated user, then as unauthenticated, per Section 3.9's framing.

Work on a new branch `audit/d-security-offline-patient`. Do not merge to `main`.

Deliverables (all under `./audit/`):
- `07_patient_ecosystem.md` — pre-visit flow timing, QR check-in payload security
  (replay/tampering/cross-patient leakage), live-queue concurrency/privacy, the 8-language
  claim audited per-language with back-translation of safety-critical instructions,
  telemedicine stack tests under throttled bandwidth, payment integration reality check
  (real EcoCash/Paynow API vs mock), wearable ingestion with the exact "3 consecutive
  abnormal readings in 24h" boundary tests, household-risk disclosure privacy tests
  (explicitly test the abuser-linked-as-household scenario).
- `08_offline_sync.md` — sync model identification, concurrent-offline-edit conflict
  tests (flag any silent last-write-wins on clinical data as S1), offline workflow
  coverage tests with network cut, long-offline/large-backlog sync tests, offline patient
  identity/duplicate-MRN tests.
- `09_security.md` — auth tests (MFA, lockout, JWT weaknesses, token lifecycle), full
  RBAC matrix built and empirically tested (horizontal + vertical escalation, IDOR,
  tenant-isolation — can facility X read facility Y's data), OWASP Top 10 / API Top 10
  sweep, secrets/supply-chain scan (gitleaks/trufflehog across full git history, SCA for
  dependency CVEs), encryption-in-transit/at-rest checks, audit-logging completeness
  check, HIPAA §164.312 technical-safeguards gap analysis, consent-enforcement tests,
  data-residency check (does any PHI leave the region via LLM calls, CDN, analytics?).
- Append findings to `./audit/FINDINGS.jsonl`.

Any auth bypass, cross-tenant data leak, or unconsented HIV/health-status disclosure is
**S0** — do not downgrade. Open a PR when done. Do not merge.

---

## Sprint E — Research Platform + Reliability + UX/Safety + Quality + End-to-End Scenarios

Depends on Sprints B, C, and D being available (ideally merged, or at least their branches
readable) — the E2E scenarios in this sprint trace a patient journey across CDS, FHIR,
DHIS2, security, and offline behavior all at once, so it needs their findings as input to
know what's already broken versus what to newly discover.

Read `docs/UMOYA_AUDIT_PROMPT.md` Section 0, then this sprint's scope: **Section 3.6**
(Research Platform), **Section 3.11** (Reliability, Performance & Operations),
**Section 3.12** (UX, Accessibility & Clinical Safety Human Factors), **Section 3.13**
(Documentation, Tests & Claim Hygiene), and **Section 4** (Cross-Cutting Adversarial
Scenarios — all 8 end-to-end journeys).

You have Docker/load-testing tool access for this sprint. Section 3.11 requires actually
running k6 or Locust load tests, a soak test, and chaos tests (kill DB/queue/LLM
provider/DHIS2/SMS gateway/payment gateway individually and verify graceful degradation).
Section 3.6's Kaplan-Meier validation requires comparing against `lifelines` or R
`survival` on identical synthetic data with 1e-6 tolerance — do not approximate this by
eyeballing the formula.

Work on a new branch `audit/e-research-reliability-e2e`. Do not merge to `main`.

Deliverables (all under `./audit/`):
- `06_research.md` — de-identification test with all 18 HIPAA Safe Harbor identifiers
  embedded in structured fields and free text, cohort-builder correctness vs hand-written
  SQL, Kaplan-Meier numeric validation against `lifelines`/`survival`, VigiBase E2B(R3)
  schema validation if implemented, external-collaborator access token security tests.
- `11_reliability.md` — load test results (p50/p95/p99, error rates), soak test results,
  chaos test results per dependency, backup/restore drill, observability/alerting check,
  low-bandwidth/low-resource device test.
- `12_ux_safety.md` — wrong-patient risk tests, alert-fatigue census, look-alike/sound-alike
  drug safety checks, critical-result lifecycle/escalation test, WCAG 2.2 AA automated +
  manual accessibility check, click-count measurement for the 10 core clinical tasks.
- `13_quality.md` — mutation-testing sample on safety-critical modules (CDS/calculators),
  traceability-matrix gap check, medical-device regulatory-posture check (IEC 62304, ISO
  14971, ISO 13485/SaMD — note absence plainly if none exists), and the full brochure
  marketing-claim hygiene list (every overstated/inconsistent claim, with defensible
  reworded alternatives).
- `14_e2e_scenarios.md` — all 8 scenarios from Section 4, executed end-to-end across
  UI/API/mobile, tracing data through every component and recording every discontinuity.
- Append findings to `./audit/FINDINGS.jsonl`.

Open a PR when done. Do not merge.

---

## Sprint F — Executive Summary, Scorecards & Self-Audit

Depends on Sprints A through E all being merged to `main` first — this sprint consolidates
every prior sprint's `FINDINGS.jsonl` entries and domain reports into the final
deliverables, so it cannot start meaningfully until that evidence exists on `main`.

Read `docs/UMOYA_AUDIT_PROMPT.md` in full (Sections 5 and 6 are this sprint's primary
scope: Phase "Deliverables" and "Execution Guidance").

Work on a new branch `audit/f-executive-summary`. Do not merge to `main`.

Deliverables (all under `./audit/`, consolidating the prior five sprints' work):
- `TRACEABILITY_MATRIX.csv` — claim → code → test → result, built from the full
  `CLAIMS_LEDGER.md` and `FINDINGS.jsonl` accumulated across sprints A–E.
- `COVERAGE_AND_LIMITS.md` — an honest statement of what was **not** tested across all
  five prior sprints and why, so no false assurance is taken from silence.
- `EXECUTIVE_SUMMARY.md` (≤2 pages) — Claim Honesty Score (% of ledger claims by verdict),
  top 10 S0 patient-safety/legal risks ranked, top 10 brochure claims that must change or
  be built before sales/pilot, explicit Go/No-Go readiness for demo / synthetic-data pilot
  / real-patient pilot / production-at-scale with explicit blockers for each, and a
  prioritised 30/60/90-day remediation roadmap with effort estimates.
- **Self-audit step (Section 6):** list the 10 most likely places the audit itself (across
  all sprints) could have been wrong or too lenient, and re-test at least 3 of them before
  finalizing the executive summary.

Open a PR when done. This is the final sprint — when reviewed and merged, the full
adversarial audit closes out.
