# UMOYA EHR — REMEDIATION PASS ("REDEMPTION")

You are fixing defects found by the adversarial audit in `./audit/` (FINDINGS.jsonl, CLAIMS_LEDGER.md, EXECUTIVE_SUMMARY.md, COVERAGE_AND_LIMITS.md, DAK_SCORECARD.md, AI_REALITY_TABLE.md, TRACEABILITY_MATRIX.csv, RUNBOOK.md). Read all of them first.

The goal is NOT to make the audit report look better. The goal is that the product becomes safe and truthful, and that every fix is **proven** by a test that failed before and passes after.

---

## 0. RULES OF ENGAGEMENT

1. **Test first, always.** For every finding: (a) write a failing regression test or reproduction script that captures the exact audit evidence, (b) run it and record it FAILING, (c) fix, (d) run it and record it PASSING, (e) run the surrounding suite for regressions. No fix without a prior red test. If a finding genuinely cannot be tested automatically, say why and write a manual verification script instead.
2. **Never weaken, delete, skip or loosen an existing test to get green.** The suite is already red (Q-002: 34/187 suites). Do not mask that. Stale tests get repaired to assert correct behaviour, in their own commits, labeled as such.
3. **One finding (or tightly coupled group) per branch/commit**, message format: `fix(<finding-id>): <what>`; body includes the red/green evidence and the claim IDs affected. Small, reviewable, revertable.
4. **No invented clinical content.** Drug interactions, dosing limits, regimens, thresholds and eGFR/CVD formulas must come from a cited authoritative source (WHO consolidated guidelines, national guidelines, published equations, a licensed interaction database). Put the citation in code comments and in `remediation/CLINICAL_SOURCES.md`. Anything clinical you cannot source: implement the safe-fail behaviour (block/abstain/flag for clinician) and list it under `NEEDS_CLINICAL_REVIEW`. Do not guess.
5. **Fail closed in clinical and privacy paths.** When data is missing, a dependency is down, or a check errors: block, abstain visibly, or require explicit override with audit. Never silently proceed, never default to "low risk" or "no interactions".
6. **Database changes go through the sanctioned provisioning-bundle path** (`database-provisioning.service.ts`) plus a forward migration. Never hand-run DDL against tenant/master DB. Every migration must be idempotent and have a tested rollback or a documented reason it cannot.
7. **Synthetic data only.** Never real patient data. Never production credentials. Do not push, deploy or touch any shared environment.
8. **Do not edit the original audit documents.** Append status to `remediation/STATUS.md` and add new rows to a new `remediation/FIXES.jsonl`. The audit trail stays intact.
9. **Honest status vocabulary only:** `FIXED_VERIFIED` (red→green evidence + regression suite clean), `FIXED_UNVERIFIED` (code changed, could not be proven, state blocker), `MITIGATED` (risk reduced, not eliminated; state residual), `DEFERRED` (with reason and owner needed), `WONT_FIX` (needs written justification), `CLAIM_REMOVED` (brochure/UI claim withdrawn instead of building).
10. **Prefer withdrawing a false claim over shipping a fake feature.** If something cannot be built correctly in this pass, remove or rewrite the claim and disable the code path behind a flag that defaults OFF, rather than leaving a stub that appears to work.
11. **Stop and ask me only for:** credentials/licences you lack, irreversible actions, clinical decisions you cannot source, or product decisions with real tradeoffs (list them in `remediation/DECISIONS_NEEDED.md` and continue with other work).
12. **Sub-agents** may work in parallel only on findings in different files/modules. Each must follow these rules and return red/green evidence. You (the lead) merge and re-run the full suite.

---

## 1. PHASE 0 — BASELINE & TRIAGE (do first)

1. Check out a fresh branch `remediation/main` from the audited commit. Record the commit SHA.
2. Boot the stack per `RUNBOOK.md`. Record: build status, tsc, lint, and the full test-suite pass/fail counts (the Q-002 baseline). Save to `remediation/BASELINE.md`.
3. **Resolve the schema-drift question FIRST (S-003).** Many audit "live 500" results (P-001, P-003, RES-003, RES-004, RES-007, S-005, F-004, S-004 interplay) may stem from provisioning bundles lagging TypeORM entities. Produce `remediation/DRIFT_ANALYSIS.md`: for every entity column referenced in code but absent from bundles/migrations, list it. Decide the single mechanism that keeps bundles, migrations and entities in sync (and a CI check that fails on drift). This is the foundation for everything else.
4. Build `remediation/FIX_PLAN.md`: every finding from FINDINGS.jsonl mapped to a fix ID, phase, owner-module, test type, dependency on other fixes, and effort estimate. Dependencies matter: don't fix a downstream finding before its root cause (e.g. fixing P-003's table name before adding scoping would activate a leak).
5. Re-run each S0/S1 audit reproduction **once, unchanged**, on the clean baseline and record which still reproduce. A finding that no longer reproduces on a correctly provisioned tenant is reclassified (with evidence), not silently dropped.

---

## 2. PHASE 1 — FOUNDATION (blocks everything else)

| Fix | Findings | Required outcome | Acceptance test |
|---|---|---|---|
| FX-001 Schema drift | S-003, S-005, RES-003, RES-004, RES-007, P-001, P-003, F-004, I-015 | Bundles + migrations + entities provably in sync; fresh tenant serves a patient read, intake, check-in, research export | CI drift check (fails on any column mismatch); post-provision smoke test that reads a patient, redeems a QR, runs a cohort query, hits `$everything` |
| FX-002 Encryption column overflow | S-004, O-002 | `id_number`/`phone` columns sized for ciphertext; key validated at boot; app **refuses to start** in non-dev without a valid 32-byte key; no plaintext-PHI fallback | Test: create/update patient with national ID + phone succeeds and stores ciphertext; boot test with missing/invalid key fails fast; backfill migration for existing rows |
| FX-003 Offline poison-item handling | O-002 | Deterministic 4xx/5xx-validation rejections surface as terminal failures to the clinician, not infinite retry | Queue test: poison item reaches terminal state, is visible in UI, does not block the queue |
| FX-004 Route `$` operations | F-001, S-008, I-007, F-004 | `$batch`, `$transaction`, `$validate`, `Patient/:id/$everything` reachable and working at standard paths | Route-reachability test for **every operation advertised in CapabilityStatement**; CapabilityStatement trimmed to what actually works (no XML claim unless serialised) |

Exit gate for Phase 1: the audit's schema-drift-class findings reproduce as passing on a freshly provisioned tenant, and the drift CI check is in place.

---

## 3. PHASE 2 — PATIENT-SAFETY & LEGAL BLOCKERS (S0, then S1)

Order matters. After each fix, re-run the relevant audit reproduction and the full regression suite.

### FX-010 BCMA five-rights (UX-001) — S0
Implement true verification: patient (wristband) ↔ active prescription ↔ drug (barcode/product) ↔ dose ↔ route ↔ time window, with expired-item and duplicate-scan checks. `failures` must actually populate. Wrong patient, wrong drug, wrong dose, wrong route, outside window, expired, already-given → **hard block**; override requires role + reason + audit entry + second-nurse option. Offline: BCMA must fail closed or use a verified cached MAR with staleness limit.
Tests: the exact audit case (patient A wristband + warfarin + B's Rx / nil UUID / garbage → must now be rejected), plus one test per right, plus override audit trail test.

### FX-011 Patient-level authorization (S-001, I-017) — S0
Introduce a single authorization layer (care-team assignment / treating relationship / facility scope / break-glass) used by `getPatientById`, REST, FHIR read/search/`_include`/`_revinclude`/`$everything`/`_history`, census search, exports, and websockets. Break-glass: requires reason, time-boxed, audited, reviewed. Default deny.
Tests: receptionist/pharmacist/nurse matrix across every patient-returning endpoint; changed-ID attempts; census enumeration returns only permitted patients; break-glass audit test. Produce a role × resource × action matrix in `remediation/AUTHZ_MATRIX.md` generated from tests, not prose.

### FX-012 Disclosure & household privacy (B-011, S-002, P-002, P-003) — S0
Remove HIV/STI (and other sensitive conditions) from automatic household propagation. Any family/household disclosure requires explicit, recorded, revocable patient consent per disclosure. Role+age gating on all disclosure endpoints (counsellor/clinician only), MINOR_ASSENT linkage, remove disclosure records from the offline allowlist unless justified, scrub notification previews/SMS content of diagnoses. Add safeguarding option (flag household link as "unsafe/do not notify").
Tests: every role against every disclosure and household endpoint; alert feed never contains condition names without consent; abuser-linked-as-household scenario; adolescent scenario; SMS/push payload content assertions.

### FX-013 Interaction engine (B-001, E2E-001) — S0
Replace/augment with a **licensed or openly sourced curated interaction knowledge base** (e.g. a maintained database you can legally ship; list the options and licensing in DECISIONS_NEEDED if a choice is required). Normalise drug names (INN/brand/salt/combination) through a terminology layer (RxNorm/ATC/SNOMED mapping). Include a first-class **hard-stop primitive** (severity=contraindicated ⇒ order cannot proceed without role-checked, reasoned, audited override) enforced server-side on **every** prescribing path: direct API, order sets, telemedicine mid-call Rx, refills, pharmacy substitution, offline sync replay.
Acceptance: rerun the 153-pair gold set (have a clinician/pharmacist review and extend it; record reviewer) — contraindicated-class sensitivity ≥ 0.95, specificity regression ≤ agreed bound; cornerstone pairs (rifampicin + DTG/hormonal contraception, sildenafil + nitrates, linezolid + SSRIs, QT combos) all flagged. Bypass tests across all prescribing paths.

### FX-014 Allergy gate on the prescribing path (F-005, E2E-003) — S1
Mandatory allergy-contraindication check (including cross-reactivity classes, e.g. beta-lactams) in the order/pharmacy/dispense pipeline using the same allergy store BCMA reads. Unknown allergy status = explicit prompt, not silent pass. Fix the E2E-007 `allergy:null` drop.
Tests: live order placement for a penicillin-allergic synthetic patient is blocked; override audited.

### FX-015 Renal dosing & units (B-002, B-003, B-004, B-009, B-013) — S0/S1
- Canonicalise creatinine to one unit at ingestion; store unit; convert at every boundary; reject out-of-range.
- Renal function unknown for renally-cleared drug ⇒ **no dose returned**, explicit override path (fail closed).
- Add weight/age plausibility bounds, per-drug max daily dose table (sourced), Child-Pugh-aware hepatic handling, paediatric dosing by mg/kg with caps.
- Implement CKD-EPI 2021 (race-free) and Schwartz (paediatrics) eGFR with unit handling; replace the uncomputed `egfr_equation` label.
- `recommend-regimen` endpoint: compute assessment server-side, require renal/pregnancy/TB inputs, enforce EAC gate shared with the change-request flow; never default creatinine to 1.0.
Tests: 88.4 µmol/L regression (CrCl ≈ expected, not ~1); published reference values for eGFR with tolerance; 700 kg weight rejected; 10× overdose rejected; neonate-to-adult dosing sweep.

### FX-016 ART logic (B-008, B-010) — S0/S2
DTG-aware (and INSTI-class) failure handling; the default branch must echo the assessed risk and never hard-code "low". Align second-line recommendations with current WHO consolidated guidance (cite version/date); implement DTG 50 mg BID dosing output with rifampicin. Anything you cannot source goes to `NEEDS_CLINICAL_REVIEW` with safe-fail (specialist referral prompt).
Tests: the audit case (DTG, 18 mo, VL 7000, M184V → must not say "low"); rifampicin + DTG yields BID; pregnancy/TB branches.

### FX-017 Mortality badge (B-005) — S0
Choose one of: (a) implement and **validate** a published score appropriate to the label (NEWS2, LACE, qSOFA etc.) exactly to spec with unit tests against reference vectors, or (b) rename to "unvalidated composite — not for triage" and add an **insufficient-data state** (completeness floor; never "low" on missing data). Fix "ICU = any record" and ICD-first-letter severity. If you keep a 30-day mortality claim, there must be documented validation (AUROC, calibration, Brier) on data you can name, otherwise it is removed.
Tests: no-vitals/no-labs patient → "insufficient data"; monotonicity; NEWS2/LACE reference vectors.

### FX-018 Critical results (UX-002, UX-003) — S1/S2
Only the ordering clinician / on-duty covering role can acknowledge; automatic time-based escalation with off-shift routing; unacknowledged alerts re-surface. Tests: receptionist ack → 403; timer escalation fires; off-shift routing.

### FX-019 Payments (S-012, P-005) — S1
Verify every provider callback (signature, OAuth query-back, certificate or provider-documented mechanism) **before** crediting; per-tenant callback secrets; replay protection; idempotency. Add explicit ZiG/FX handling or document and enforce single-currency per tenant with validation. If a provider cannot be verified yet, disable that provider behind a default-OFF flag.
Tests: the forged Daraja callback from the audit now fails for all five providers; replay rejected; duplicate callback idempotent.

### FX-020 De-identification & research (RES-001, RES-002, RES-006, RES-007, B-… R-003) — S0/S1
- Safe Harbor: remove/transform all 18 identifier classes in structured fields **and** free text (NLP scrubber with measured recall on a seeded PHI battery; if recall < target, **suspend free-text export** rather than ship it), truncate dates, generalise geography per rule, cap ages >89, drop device/URL/IP/biometric/photo refs.
- Salts: no defaults; fail closed at boot if unset; per-tenant secrets from a secret store; pseudo-IDs not linkable across exports unless explicitly requested and approved.
- Cohort builder: no identified rows (no names/DOB); role-gate it.
- VigiBase: either implement real ICH E2B(R3) ICSR XML validated against the schema (with MedDRA coding and WHO-UMC causality; document the submission path) or relabel as "adverse-event register; manual VigiFlow entry" and **stop setting `vigibase_exported` on undelivered data**.
- Collaborator tokens: public-token routes without EHR JWT, scoped, expiring, revocable (add revocation endpoint), not in URLs (header/POST), audited.
Tests: seeded 18-identifier battery → zero residual identifiers (automated scan + free-text recall metric reported); salt-unset boot failure; E2B XML schema validation; token expiry/revocation/clock manipulation.

### FX-021 Audit, security hardening (S-007, S-006, S-009/F-002, REL-001, REL-002, S-013, S-015)
- Audit logging: never silently drop; durable dead-letter + alert on audit-write failure; log malformed/hostile requests with raw identifiers as text.
- Server-side sanitisation of clinical free text; tighten CSP.
- Fix CORS_ORIGINS interpolation; log effective origins.
- Rate limiting: key by authenticated user/tenant + trusted-proxy-aware IP (do **not** trust arbitrary `X-Forwarded-For`); per-account login throttling independent of IP; size limits sensibly for clinic NAT (target: 200 concurrent clinicians pass k6 at agreed rate).
- Dependencies: patch the 5 critical + 28 high advisories by reachability; add audit gate to CI. Run gitleaks/trufflehog over full git history; rotate anything found; record results.
- MFA: fail **closed** when policy cannot be loaded; remove `mfaVerified` default-true.
Tests: XFF-rotation brute-force now throttled; k6 re-run; audit-failure test; MFA fail-closed test.

### FX-022 FHIR/HL7/DHIS2 integrity (I-001…I-006, I-010…I-013, I-018, B-007, I-012, B-012, S-010)
- FHIR mappers: lossless round trips for MedicationRequest (preserve dosage text, patient vs technical instructions), allergy severity, code-system normalisation (strip hyphens/space, warn on unknown); emit BP panel pattern; validate with HL7 validator in CI.
- Inbound: idempotent upsert with unique constraints + real conflict detection + per-resource status (never report SUCCESS for skipped/failed).
- HL7v2: handle CR/LF/CRLF, remove double-split bug, require PID, generate ACK/NACK, return created ID.
- DHIS2: explicit `MODE=REAL|MOCK` banner and alert on mock in non-dev; **one canonical cascade service** used by dashboard and DHIS2 push; exclusions (deaths/LTFU/discontinued/transferred) and strata gating per documented standard; hand-verified cohort regression test; consent gate on push.
- Consent enforcement point: central check (treatment / data-sharing / research / telehealth / AI-processing scopes) applied on read, export, DHIS2 push, interop pulls and LLM calls.
- DSR/erasure pipeline: design and implement (or write the legal/technical retention design and mark DECISIONS_NEEDED), covering DB, search indexes, object storage, caches, logs, LLM-provider hashes, research datasets, DHIS2 (note limits), and backups policy; retention schedule job.
- MPI: parenthesise the OR/AND precedence bug, add trigram GIN index on patient names; regression with Shona/Ndebele name variants and DOB swaps.
Tests: for each, the audit reproduction becomes a permanent test.

### FX-023 Concurrency & offline (O-001, O-004, O-007, O-006)
Optimistic concurrency (version/ETag, 409 + merge UI) on clinical writes (allergies, meds, problems); offline abstain state rendered as "could not check", never "none"; bundle a compact critical-interaction base on-device or hard-block offline high-risk prescribing; backlog caps with visible overflow, priority lanes, duplicate-registration review.
Tests: the two-device allergy overwrite from the audit now yields a 409/merge, never silent loss.

### FX-024 Remaining clinical/safety items
Discharge countersignature or author≠signer rule (F-003/B-016); transfusion consent gate + emergency-override capture (E2E-002); LASA/tall-man rendering and dispense check (UX-004); wearable critical flagging (P-008: include `flag_reason`, allowlist reading types); pre-visit intake single-submit guard + full propagation of allergies/meds into the encounter marked "patient-reported/unverified" (P-004); queue display minimisation (P-009); DB-outage fail-fast with honest readiness (REL-003); dead-man switch + alerting on nightly jobs (REL-004); LLM: pin model IDs, extend redaction to person names, consent + in-region/DPA gate, Sentry `beforeSend` scrub (B-017, S-011); prompt-injection hardening: treat free text as untrusted data in prompts, delimiters, output schema validation, no tool/action execution from model output (E2E-007); translation: native-speaker review of nd/zu/sn clinical vocabulary + CI lexicon check for dosing fields (P-006).

---

## 4. PHASE 3 — WHO DAK WORK (honest scope)

The audit found: HIV forms at draft v0.4.4 vs v1.0.0, 0/17 executable decision tables, no ValueSets, no indicators, no update process, no non-HIV DAKs.

Do this in order, each step independently shippable:
1. **Version pin + update pipeline:** upgrade deployed HIV artifacts to the current published IG release; add a script that fetches a pinned IG version, diffs artifacts vs deployed, runs the HL7 validator, and fails CI on drift. Record version in an API endpoint and the UI "About".
2. **Data element mapping table** (DAK data dictionary → Umoya field → FHIR path → ValueSet) generated and committed; coded capture using the DAK ValueSets (stop ICD-letter sniffing for WHO staging).
3. **Decision logic:** adopt a CQL engine (preferred) to execute the DAK Libraries, or hand-port decision tables with oracle tests built from the DAK's own test cases. `isActionApplicable` must **default to NOT applicable** (fail safe) when an expression can't be evaluated. Start with the 8 tables that have oracle CQL.
4. **Indicators:** implement the HIVIND measures that DHIS2/PEPFAR reporting needs, from the canonical cascade service, validated on hand-computed cohorts.
5. **Other DAKs:** do not claim them. Add only when content + logic + tests exist; otherwise they stay absent in marketing.
If steps 3–5 cannot complete in this pass, mark them DEFERRED and ensure all collateral says: "HIV visit forms derived from the WHO SMART HIV DAK (version X); clinical logic hand-coded separately" (the audit's supportable sentence).

---

## 5. PHASE 4 — CLAIMS & COLLATERAL

Produce `remediation/BROCHURE_REWRITE.md`: for every ledger claim, either (a) evidence now supports the original wording, (b) new defensible wording, or (c) claim removed. Use, at minimum, the executive summary's top-10 rewording guidance:
- "AI-first" → "Rules-based clinical decision support with governed, clinician-reviewed LLM drafting"
- "FHIR R4/R5, HIPAA" → "FHIR R4 interface" (R5 only if built and tested), "HIPAA-style technical controls" with listed gaps, and the CDPA 2021 position stated accurately
- "DHIS2 real-time two-way" → what is actually true after FX-022
- "Hard-stops", "mortality score", "de-identified cohorts", "VigiBase E2B", "BCMA five rights", "privacy-safe household", "SMART apps", "parallel go-live", "no downtime", "zero manual re-entry" → rewrite or remove unless re-verified
- Remove the unsupported "Most clinical staff are confident within two sessions" unless evidence exists.
Also update in-app strings, store listings and docs that repeat removed claims. Add `docs/SAFETY_CASE_STARTER.md`: intended use, regulatory position question (SaMD classification, IEC 62304 / ISO 14971 hazard log seeded from the S0/S1 findings) — flag as needing qualified regulatory/legal review; you are not giving legal advice.

---

## 6. PHASE 5 — VERIFICATION (the part that proves it)

1. **Full regression:** build, tsc, lint, entire test suite. Report new pass/fail vs BASELINE. Target: no new failures; stale suites repaired; coverage report for safety-critical modules.
2. **Re-run the original audit reproductions** for every finding (script them into `remediation/reaudit/`). For each: still reproduces / no longer reproduces / changed behaviour.
3. **Re-run the load test** (k6), **security tools** (semgrep, gitleaks full history, ZAP baseline, npm audit), **FHIR validator** over exported bundles, **gold sets** (interactions, dosing, de-id battery, cascade cohort, KM vs lifelines).
4. **Mutation sample** on CDS, dosing, eGFR, KM, cascade modules; surviving mutants in safety-critical code get new tests.
5. **Independent reviewer pass:** spawn a sub-agent that has NOT seen your fixes' reasoning, give it only the finding + the diff + the tests, and have it try to break each S0/S1 fix (bypass attempts through alternative paths: direct API, offline replay, telemedicine, bulk, order sets). Record results. Any bypass found reopens the finding.
6. **Self-audit:** list the 10 fixes most likely to be incomplete or to have introduced regressions; re-test at least 3 more deeply.

---

## 7. DELIVERABLES (all under `./remediation/`)

- `BASELINE.md`, `DRIFT_ANALYSIS.md`, `FIX_PLAN.md`
- `FIXES.jsonl` — one row per finding: `{finding_id, fix_id, status, branch/commit, red_evidence, green_evidence, regression_suite_result, residual_risk, needs_clinical_review, notes}`
- `STATUS.md` — table of every audit finding → status (vocabulary in §0.9), plus counts
- `AUTHZ_MATRIX.md` (test-generated), `CLINICAL_SOURCES.md`, `NEEDS_CLINICAL_REVIEW.md`, `DECISIONS_NEEDED.md`
- `BROCHURE_REWRITE.md`, `docs/SAFETY_CASE_STARTER.md`
- `reaudit/` scripts and outputs; `REAUDIT_REPORT.md` with an updated **Claim Honesty Score** (same 51 claims, new verdicts, each with evidence)
- `RESIDUAL_RISK.md` — everything still open, ranked
- `EXECUTIVE_SUMMARY_REMEDIATION.md` (≤2 pages): findings fixed-and-verified vs mitigated vs deferred vs claim-removed; S0 count before/after; updated Go/No-Go for demo, synthetic pilot, real-patient pilot and production with explicit remaining blockers.

## 8. EXIT CRITERIA

The real-patient-pilot gate may be declared open only if ALL hold, with evidence:
- Every S0 is `FIXED_VERIFIED` (or `CLAIM_REMOVED` with the code path disabled) and survived the independent bypass attempt.
- Every S1 is `FIXED_VERIFIED`, `MITIGATED` with stated residual, or has a written, accepted deferral.
- Schema drift CI, route-reachability tests, secrets history scan and dependency gate are in CI and green.
- Clinical content that could not be sourced is behind safe-fail behaviour and listed in NEEDS_CLINICAL_REVIEW, **reviewed by a named clinician before pilot** (note this as a human gate; do not self-certify).
- Brochure and in-app claims match the re-verified ledger.
Otherwise report NO-GO and list exactly what remains.

Begin with Phase 0. Report the baseline and the drift analysis before starting any fixes, and do not begin Phase 2 until Phase 1's exit gate is met.
