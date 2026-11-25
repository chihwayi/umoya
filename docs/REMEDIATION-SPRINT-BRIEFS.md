# UMOYA Remediation — Delegation Sprints (R0–R11)

This is the execution plan for fixing the 106 findings from the adversarial audit
(`./audit/`). The master rules of engagement live in
`docs/UMOYA_REMEDIATION_PROMPT.md` — read that in full once, it is not repeated
here. This document is the sprint breakdown: who does what, in what order, and
how each piece gets delegated and reviewed.

## What this plan adopts from `UMOYA_REMEDIATION_PROMPT.md`, unchanged

- All twelve rules of engagement in its Section 0 (test-first with red→green
  proof, never weaken an existing test, one finding/group per branch, no
  invented clinical content, fail closed, DB changes only through the
  provisioning-bundle path, synthetic data only, the audit trail stays
  immutable, the honest status vocabulary, prefer withdrawing a false claim
  over shipping a stub, the stop-and-ask list, and the parallel-subagent rule).
- The five-phase shape: Baseline/Triage → Foundation → Patient-Safety/Legal
  fixes → WHO DAK work → Claims/Collateral → Verification.
- The FX-### fix groupings and their required outcomes/acceptance tests
  (Sections 2–6 of that document) — this plan maps sprints onto those
  groupings rather than re-deriving them.
- The exit criteria in its Section 8 (every S0 `FIXED_VERIFIED` or
  `CLAIM_REMOVED` and surviving an independent bypass attempt before the
  real-patient-pilot gate opens).

## Two decisions this plan makes that the suggestions document left open

1. **Phase 2 is split into ten sequential sprints (R2–R9 below), not one.**
   106 findings touching authentication, prescribing logic, payments,
   de-identification, and interop in a live medical record system is not one
   reviewable PR. Each sprint below is scoped to what one reviewer can
   independently verify — re-running the exact audit reproduction plus the
   new regression tests — before merging, the same discipline used across the
   whole audit.
2. **Authorization and disclosure (R2) is moved immediately after Foundation
   (R1), ahead of BCMA/critical-results/payments (R3).** The suggestions
   document listed BCMA first. Reordering it: almost every later sprint's
   acceptance test is a role-gate test ("receptionist gets 403", "pharmacist
   cannot read adolescent disclosure"), and those tests are meaningless
   against a system where `getPatientById` has no scoping at all (`S-001`).
   Fixing the authorization layer first means every subsequent sprint's tests
   are checking something real.

## Standing workflow (identical to the audit's delegate → verify → merge rhythm)

1. Give Muse Spark one sprint's brief below, verbatim.
2. Muse works on its own branch, opens a PR, does not merge to `main`.
3. Every fix is independently re-verified before merge: re-run the original
   audit reproduction (it must now fail to reproduce, or the finding's
   reclassification must be justified with new evidence), re-run the new
   regression test myself, and spot-check the surrounding regression suite.
   Trust nothing a report claims "FIXED_VERIFIED" without re-deriving it —
   the same discipline that caught real errors in Sprints A and C of the
   audit applies here, with higher stakes, since this phase ships code.
4. Sprints run **sequentially**, not in parallel — unlike the audit's
   mostly-independent domain reports, these fixes touch shared modules
   (guards, the patient service, the provisioning bundles), so parallel
   branches risk silent merge conflicts and masked regressions.
5. Move to the next sprint only once the current one is merged and the full
   regression suite is confirmed clean (no new failures vs the Sprint R0
   baseline).

**Standing reminder carried into every sprint below:** every database schema
change goes through `database-provisioning.service.ts` plus a forward
migration — never a hand-run `CREATE TABLE`/`ALTER TABLE` against the real
tenant or master databases. Synthetic data only, no real patient data, no
production credentials, nothing pushed to a shared environment.

---

## R0 — Baseline & Triage (Phase 0)

Scope: `UMOYA_REMEDIATION_PROMPT.md` Section 1 in full. This sprint produces
no fixes — it produces the foundation everything else depends on.

Branch: `remediation/r0-baseline-triage`. Do not merge to `main` without review
(this one is low-risk — report/analysis only, similar to the audit sprints —
but still goes through a PR).

Deliverables, all under `./remediation/`:
- `BASELINE.md` — build/tsc/lint status and full test-suite pass/fail counts
  on a freshly checked-out branch from the audited commit (record the SHA).
  This is the number every later sprint's "no new failures" claim gets
  checked against.
- `DRIFT_ANALYSIS.md` — for every entity column referenced in code but absent
  from a provisioning bundle or migration, list it. This resolves the
  schema-drift question (`S-003`) that explains several "live 500" findings
  across the audit (`P-001`, `P-003`, `RES-003`, `RES-004`, `RES-007`,
  `S-005`, `F-004`) as one root cause, not five separate bugs.
- `FIX_PLAN.md` — every finding in `audit/FINDINGS.jsonl` mapped to a fix ID
  (use the FX-### scheme from `UMOYA_REMEDIATION_PROMPT.md` where it already
  covers the finding; assign a new ID for anything it missed), sprint
  (R1–R9 below), test type, dependency on other fixes, and effort estimate.
- Re-run every S0/S1 audit reproduction once, unchanged, on the clean
  baseline. Record which still reproduce. Anything that no longer reproduces
  on a correctly provisioned tenant gets reclassified with evidence in this
  document — not silently dropped from the plan.

---

## R1 — Foundation (Phase 1, blocks everything else)

Depends on R0. Scope: `FX-001` (schema drift), `FX-002` (encryption column
overflow), `FX-003` (offline poison-item handling), `FX-004` (`$`-route
reachability).

Branch: `remediation/r1-foundation`.

Required outcomes (full detail in `UMOYA_REMEDIATION_PROMPT.md` Section 2):
- Bundles, migrations, and entities provably in sync, with a CI check that
  fails on any future drift. A freshly provisioned tenant must serve a
  patient read, patient intake, QR check-in, and research export without a
  schema-mismatch 500.
- `id_number`/`phone` columns sized for ciphertext; the app refuses to start
  in non-dev without a valid 32-byte `ENCRYPTION_KEY` — no silent
  plaintext-PHI fallback (closes `S-004`).
- Offline poison items (permanently-invalid sync payloads) reach a terminal,
  visible failure state instead of retrying forever and blocking the queue
  (closes `O-002`).
- `$batch`, `$transaction`, `$validate`, and `Patient/:id/$everything` are
  reachable at runtime (the Express `$`-anchor bug from the audit's own
  self-audit, `F-001`) and the CapabilityStatement is trimmed to only what's
  actually implemented (no XML claim unless a serializer exists).

Exit gate: every schema-drift-class finding reproduces as passing on a freshly
provisioned tenant, and the drift CI check is live before R2 starts.

---

## R2 — Authorization & Disclosure (S0)

Depends on R1. Scope: `FX-011` (patient-level authorization / horizontal
IDOR) and `FX-012` (disclosure and household privacy).

Branch: `remediation/r2-authz-disclosure`.

Required outcomes:
- A single authorization layer (care-team assignment / treating relationship
  / facility scope / break-glass) enforced on `getPatientById`, every REST
  and FHIR patient-returning route (`read/search/_include/_revinclude/
  $everything/_history`), census search, exports, and websockets. Default
  deny. Break-glass requires a reason, is time-boxed, and is audited.
  Produce `remediation/AUTHZ_MATRIX.md`, generated from the test run itself,
  not written by hand.
- HIV/STI (and other sensitive-condition) household propagation requires
  explicit, recorded, revocable patient consent per disclosure — not
  automatic. Role+age gating on every disclosure endpoint. `MINOR_ASSENT`
  actually linked at the call site (it exists in the consent model but
  nothing used it). Disclosure records removed from the offline sync
  allowlist unless a specific justification is documented. Notification/SMS
  previews scrubbed of diagnosis content. A safeguarding flag
  ("unsafe/do not notify") on household links.
- Tests: the exact audit cases reproduced as permanent regression tests —
  receptionist/pharmacist/nurse reading any patient by ID (`S-001`),
  receptionist/pharmacist reading or writing adolescent disclosure
  (`S-002`/`B-011`), and the abuser-linked-as-household HIV-broadcast
  scenario (`P-002`) — all must now fail for the unauthorized role.

This is the sprint the exit criteria in Section 8 of
`UMOYA_REMEDIATION_PROMPT.md` treats as non-negotiable before any
real-patient pilot — `S-001`, `S-002`, and `P-002` are three of the audit's
13 S0 findings.

---

## R3 — Bedside & Financial Safety (S0/S1)

Depends on R1 (not R2 — these are independent of the general patient-authz
layer, though BCMA should be re-tested after R2 lands to confirm the two
layers compose correctly). Scope: `FX-010` (BCMA five-rights), `FX-018`
(critical-result acknowledgment and escalation), `FX-019` (payment callback
verification).

Branch: `remediation/r3-bedside-payments`.

Required outcomes:
- BCMA actually verifies patient ↔ active prescription ↔ drug ↔ dose ↔ route
  ↔ time window, with expired-item and duplicate-scan checks. The `failures`
  array must actually populate — the audit found it was declared and never
  written to (`UX-001`). Wrong patient, wrong drug, wrong dose, wrong route,
  outside window, expired, or already-given is a hard block; override
  requires role + reason + audit entry. Offline BCMA fails closed or uses a
  verified cached MAR with a staleness limit.
- Only the ordering clinician or on-duty covering role can acknowledge a
  critical result; automatic time-based escalation with off-shift routing;
  unacknowledged alerts re-surface (`UX-002`/`UX-003`).
- Every payment-provider callback (M-Pesa, MTN, EcoCash, Airtel, Flutterwave)
  is verified — signature, OAuth query-back, or the provider's documented
  mechanism — before a pending transaction is credited. Per-tenant callback
  secrets, replay protection, idempotency. A provider that cannot be verified
  yet is disabled behind a default-OFF flag rather than left open (`S-012`).
- Tests: the audit's exact BCMA bypass case (patient A's wristband + warfarin
  + patient B's prescription ID / a nil UUID / a garbage string) must now be
  rejected in all three forms; the forged Daraja callback from the audit must
  now fail for all five providers; replay and duplicate-callback idempotency
  tests.

---

## R4 — Prescribing Safety I: Interactions & Allergies (S0/S1)

Depends on R1 (not R2/R3). Scope: `FX-013` (interaction engine) and `FX-014`
(allergy gate on the prescribing path).

Branch: `remediation/r4-interactions-allergies`.

Required outcomes:
- Replace or substantially augment the interaction engine with a licensed or
  legally-shippable curated interaction knowledge base — list the licensing
  options in `remediation/DECISIONS_NEEDED.md` if a real choice is required,
  do not silently pick one with unclear licensing. Normalize drug names
  (INN/brand/salt/combination) through a terminology layer before matching.
  Implement a first-class hard-stop primitive: a contraindicated-severity
  interaction blocks the order unless a role-checked, reasoned, audited
  override is given — enforced server-side on every prescribing path
  (direct API, order sets, telemedicine mid-call Rx, refills, pharmacy
  substitution, offline sync replay).
- Acceptance: re-run the audit's 153-pair gold set, extended and reviewed by
  a clinician/pharmacist (record the reviewer's name) — contraindicated-class
  sensitivity ≥ 0.95. The audit's named cornerstone pairs (rifampicin +
  dolutegravir, rifampicin + hormonal contraception, sildenafil + nitrates,
  linezolid + SSRIs, QT-prolonging combinations) must all be flagged. Bypass
  attempts across every prescribing path listed above must all be blocked.
- Mandatory allergy-contraindication check (including cross-reactivity
  classes, e.g. beta-lactams) in the order/pharmacy/dispense pipeline, using
  the same allergy store BCMA reads from R3 — not a separate, divergent
  store. Unknown allergy status is an explicit prompt, not a silent pass.
  Fix the `allergy:null` drop found in the audit's end-to-end scenario
  (`E2E-003`/`F-005`).
- Tests: a live order placed for a penicillin-allergic synthetic patient is
  blocked; the override path is audited.

This is clinically the highest-stakes sprint in the whole remediation — the
audit's rifampicin+DTG and linezolid+SSRI misses are both named S0 risks in
the executive summary's top-10 ranking.

---

## R5 — Prescribing Safety II: Renal Dosing & ART Logic (S0/S1/S2)

Depends on R4 (shares the terminology/dosing infrastructure; sequencing
avoids rebuilding the same normalization layer twice). Scope: `FX-015`
(renal dosing and units), `FX-016` (ART regimen-switch logic), `FX-017`
(mortality badge).

Branch: `remediation/r5-renal-art-mortality`.

Required outcomes:
- Creatinine canonicalized to one unit at ingestion, stored with its unit,
  converted at every boundary, out-of-range values rejected. This closes the
  audit's reproduced bug where a µmol/L value fed into the mg/dL-expecting
  Cockcroft-Gault formula returned a dialysis-range result for a normal
  patient (`B-002`).
- Renal function unknown for a renally-cleared drug returns no dose
  (explicit override path, fail closed — not the audit's confirmed
  fail-open behavior, `B-003`). Weight/age plausibility bounds, a sourced
  per-drug max-daily-dose table, Child-Pugh-aware hepatic handling,
  paediatric mg/kg dosing with caps (`B-004`). Implement CKD-EPI 2021
  (race-free) and Schwartz (paediatric) eGFR with correct unit handling,
  replacing the uncomputed `egfr_equation` label the audit found (`B-013`).
- `recommend-regimen` computes the resistance assessment server-side (not
  from a client-supplied body), requires renal/pregnancy/TB inputs, and
  enforces the same EAC gate the change-request flow already has — never
  defaulting creatinine to 1.0 (`B-009`).
- DTG-aware (and INSTI-class generally) treatment-failure handling — the
  default branch must echo the actually-assessed risk and never hard-code
  "low" (the audit's confirmed `B-008` contradiction: a DTG-failing patient
  was told "continue, risk is low"). Second-line recommendations aligned
  with current WHO consolidated guidance, with the version/date cited.
  DTG 50mg BID dosing output implemented for the rifampicin co-administration
  case. Anything that can't be sourced goes to
  `remediation/NEEDS_CLINICAL_REVIEW.md` with safe-fail behavior (specialist
  referral prompt), not a guess.
- Mortality badge: either implement and validate a published, appropriately
  labeled score (NEWS2, LACE, qSOFA) exactly to spec with reference-vector
  unit tests, or rename to "unvalidated composite — not for triage" and add
  a genuine insufficient-data state (never "low" on missing data, closing
  `B-005`). Fix "ICU status = any medical-records row" and the ICD-first-letter
  severity proxy.
- Tests: the audit's 88.4 µmol/L regression (must now return ≈97 mL/min, not
  ≈1.1); published eGFR reference values within tolerance; 700kg weight and
  10× overdose both rejected; the audit's exact DTG/18-month/VL-7000/M184V
  case must no longer say "low"; rifampicin+DTG yields the BID dose; a
  no-vitals/no-labs patient returns "insufficient data," not a numeric score.

---

## R6 — De-identification & Research Platform (S0/S1)

Depends on R2 (reuses the authorization layer for the cohort-builder and
collaborator-token role gating). Scope: `FX-020`.

Branch: `remediation/r6-research-deidentification`.

Required outcomes:
- Safe Harbor: remove or transform all 18 identifier classes in structured
  fields and free text. Build a free-text NLP scrubber with measured recall
  on a seeded PHI battery — if recall falls below an agreed target, free-text
  export is suspended entirely rather than shipped leaky (closes the audit's
  confirmed `RES-001`, where 12 of 18 categories leaked through both live
  de-identification paths). Dates truncated, geography generalized per rule,
  ages >89 capped, device/URL/IP/biometric/photo references dropped.
- No default salts anywhere — the app fails closed at boot if a salt env var
  is unset, with per-tenant secrets from a real secret store. Pseudo-IDs are
  not linkable across exports unless explicitly requested and approved. This
  closes the audit's confirmed `RES-002` finding, where the default salt was
  reproduced bit-for-bit in a clean room and chains directly with the R2
  patient-census fix to form a complete re-identification path.
- Cohort builder returns no identified rows (no names, no raw DOB) and is
  role-gated (closes `RES-004`, which the audit found returning identified
  rows to any authenticated role).
- VigiBase: either implement real ICH E2B(R3) ICSR XML, schema-validated,
  with MedDRA coding and WHO-UMC causality categories and a documented
  submission path — or relabel the feature honestly as "adverse-event
  register, manual VigiFlow entry" and stop setting the `vigibase_exported`
  flag on data that was never actually submitted (the audit found this flag
  set regardless of real delivery).
- External collaborator tokens: scoped, expiring, revocable (add a real
  revocation endpoint), never carried in URLs, audited.
- Tests: the audit's seeded 18-identifier battery returns zero residual
  identifiers after the fix (automated scan plus a reported free-text recall
  metric); salt-unset boot failure; E2B XML schema validation; token
  expiry/revocation tested including a clock-manipulation replay attempt.

---

## R7 — Interop Integrity: FHIR / HL7 / DHIS2 / Consent / Erasure (S1/S2)

Depends on R1 (route reachability) and R2 (consent-enforcement point needs
the authz layer). Scope: `FX-022` in full — this is a large, multi-part
sprint; if it proves too large for one PR once underway, split it into
R7a (FHIR mapper round-trip fidelity + HL7v2 fixes) and R7b (DHIS2
canonicalization + consent enforcement + DSR/erasure pipeline + MPI fix),
but plan for one first and only split if the diff genuinely becomes
unreviewable.

Branch: `remediation/r7-interop-integrity`.

Required outcomes:
- FHIR mappers: lossless round trips for `MedicationRequest` (preserve the
  real dosage text and patient instructions separately — the audit found
  patient instructions silently overwritten by generated dosage text),
  allergy severity (the audit found moderate silently downgrading through
  criticality and back to mild), code-system normalization (strip
  hyphens/case before matching — the audit found a hyphenated 'ICD-10'
  string silently dropping the code entirely, while the canonical 'ICD10'
  string worked correctly). Emit the standard BP panel pattern for vitals.
  Validate with the HL7 FHIR Validator in CI going forward.
- Inbound FHIR: idempotent upsert with real unique constraints and genuine
  conflict detection; per-resource status that never reports success for a
  skipped, failed, or dropped resource (the audit found silent success
  reporting across multiple resource types).
- HL7v2: handle CR/LF/CRLF segment termination correctly (the audit found
  the parser only split on `\n`, so standards-compliant CR-only messages
  produced ghost patients with every field null); fix the double-split bug
  that dropped every first and middle name; require a PID segment to exist;
  generate real ACK/NACK responses.
- DHIS2: an explicit `MODE=REAL|MOCK` banner with an alert if mock mode is
  active outside dev; one canonical cascade-computation service used by both
  the clinical dashboard and the DHIS2 push (the audit found these were two
  different computations producing two different 95-95-95 numbers for the
  same concept); exclusions (deaths/LTFU/discontinued/transferred) applied
  consistently per a documented standard, with a hand-verified cohort
  regression test; a consent gate before any DHIS2 push.
- A central consent-enforcement point (not just consent recording) applied
  at read, export, DHIS2 push, interop pull, and LLM-call boundaries.
- A real data-subject-request/erasure pipeline — or, if infeasible this
  pass, a written technical/legal retention design filed in
  `remediation/DECISIONS_NEEDED.md` — covering the database, search indexes,
  object storage, caches, logs, LLM-provider-side data, research datasets,
  DHIS2 (note its limits explicitly), and backup retention. The audit found
  "delete" was deactivate-only with residue across 8+ stores (`E2E-008`).
- MPI: fix the OR/AND operator-precedence bug, add a trigram index for
  fuzzy name matching, regression-test with Shona/Ndebele name variants and
  DOB-swap cases.
- Tests: every audit reproduction in this area becomes a permanent
  regression test, not just a one-time fix.

---

## R8 — Security & Audit Hardening + Offline Concurrency (S1/S2)

Depends on R1/R2 (builds on the authz layer and the now-trustworthy audit
log). Scope: `FX-021` (audit/security hardening) and `FX-023` (concurrency
and offline).

Branch: `remediation/r8-security-concurrency`.

Required outcomes:
- Audit logging never silently drops a write — durable dead-letter plus
  alerting on audit-write failure.
- Server-side sanitization of clinical free text; tightened CSP; the
  `CORS_ORIGINS` interpolation bug fixed, with effective origins logged.
- Rate limiting keyed by authenticated user/tenant plus a trusted-proxy-aware
  IP extraction — not an arbitrary, attacker-controllable `X-Forwarded-For`
  header (the audit demonstrated the login brute-force throttle falling to a
  rotated header, `REL-001`/`REL-002`). Per-account login throttling
  independent of IP.
- Dependency remediation: patch the critical and high-severity advisories
  from the audit's `npm audit` baseline by actual reachability (not a blind
  version bump sweep), with a dependency-audit gate added to CI going
  forward. Run gitleaks/trufflehog across the full git history; rotate
  anything found.
- MFA policy fails closed when it cannot be loaded — remove the
  `mfaVerified` default-true the audit found.
- Optimistic concurrency (version/ETag, 409 + merge UI) on clinical writes
  — allergies, medications, problems — closing the audit's confirmed silent
  last-write-wins that reverted an allergy entry (`O-001`). Offline abstain
  state rendered honestly as "could not check" rather than "none" when
  interaction checking can't run offline. Backlog caps with visible overflow
  and a duplicate-registration review queue for offline-created patients.
- Tests: the audit's X-Forwarded-For rotation brute-force attempt is now
  throttled; an audit-log-write-failure test; an MFA-fail-closed test; the
  audit's two-device allergy-overwrite scenario now yields a 409/merge, never
  a silent loss.

---

## R9 — Remaining Clinical/Safety Items (S1/S2/S3)

Depends on R2–R8 landing (this sprint is intentionally last among the
code-fix sprints — it's the grab-bag of smaller, less interdependent items
the suggestions document grouped as `FX-024`, and doing it last avoids
rework if an earlier sprint's fix touches the same file).

Branch: `remediation/r9-remaining-safety-items`.

Required outcomes (each independently testable, see
`UMOYA_REMEDIATION_PROMPT.md`'s `FX-024` paragraph for full detail):
- Discharge countersignature / author-cannot-equal-signer rule.
- Transfusion consent gate with emergency-override capture.
- Look-alike/sound-alike drug rendering (tall-man lettering) and a
  dispense-time check.
- Wearable critical-value flagging includes a `flag_reason` and an allowlist
  of reading types (the audit found the wearable bridge itself is a stub
  with no native implementation — this fix applies once R1-era infra work or
  a product decision addresses that separately; note the dependency rather
  than silently skipping it).
- Pre-visit intake gets a single-submission guard; patient-entered
  allergies/medications propagate into the encounter explicitly marked
  "patient-reported/unverified," never silently merged with verified data.
- Queue-display minimization (don't show other patients' identifying info).
- Database-outage handling fails fast with an honest readiness probe,
  instead of hanging callers (the audit's confirmed `REL-003`).
- A dead-man-switch and alerting on nightly scheduled jobs so a silently
  skipped run (e.g., care-gap detection) is visible, not silent.
- LLM hardening: pin model IDs, extend PHI redaction to cover person names
  specifically, add a consent/in-region data-processing gate, scrub error
  tracker (Sentry) payloads of PHI.
- Prompt-injection hardening across every LLM call site: treat all free text
  as untrusted data (not instructions), use clear delimiters, validate
  output against an expected schema, and never let model output trigger a
  tool call or action directly (closes the audit's confirmed
  receptionist-authored prompt injection reaching the LLM prompt verbatim,
  `E2E-007`).
- Translation: native-speaker review of Ndebele/Zulu/Shona clinical
  vocabulary, with a CI lexicon check specifically for dosing-instruction
  fields going forward.

---

## R10 — WHO DAK Work (Phase 3, honest scope)

Can start any time after R1 (route reachability) — does not depend on the
clinical-logic sprints, since it's about the DAK content pipeline and
decision-table execution specifically. Scope: `UMOYA_REMEDIATION_PROMPT.md`
Section 4 in full.

Branch: `remediation/r10-who-dak`.

Required outcomes, each independently shippable in order:
1. Version-pin and update pipeline: upgrade the deployed HIV DAK artifacts
   from the audit-confirmed draft v0.4.4 to the current published IG
   release; a script that fetches a pinned IG version, diffs against what's
   deployed, runs the HL7 validator, and fails CI on drift. Surface the
   version in an API endpoint and the UI "About" screen.
2. A committed data-element mapping table (DAK data dictionary → Umoya field
   → FHIR path → ValueSet); coded capture using the DAK's own ValueSets
   instead of the audit-found ICD-letter-sniffing proxy for WHO staging.
3. Decision logic: adopt a CQL engine to execute the DAK's Libraries
   directly, or hand-port the decision tables with oracle tests built from
   the DAK's own published test cases. Any expression that can't be
   evaluated must default to NOT applicable — fail safe, never fail open.
   Start with the tables that have oracle CQL available.
4. Indicators: implement the HIVIND measures DHIS2/PEPFAR reporting actually
   needs, computed from R7's canonical cascade service, validated against
   hand-computed cohorts.
5. Other DAKs (ANC, TB, NCD, immunization, family planning): do not claim
   them in any collateral until content, logic, and tests all exist for a
   given one. Add incrementally, never retroactively justify a claim already
   made.

If steps 3–5 can't complete in this pass, they're marked `DEFERRED` with a
reason, and every piece of collateral is updated to say exactly what the
audit found supportable: "HIV visit forms derived from the WHO SMART HIV
DAK (version X); clinical logic hand-coded separately."

---

## R11 — Claims & Collateral (Phase 4)

Depends on R2 through R10 all being merged — this sprint writes down what's
actually true after the fixes, so it has to come after the fixes exist.

Branch: `remediation/r11-claims-collateral`.

Required outcomes:
- `remediation/BROCHURE_REWRITE.md` — for every one of the 51 ledger claims,
  either (a) the evidence now genuinely supports the original wording, (b)
  new defensible wording, or (c) the claim is removed. At minimum, apply the
  executive summary's top-10 rewording guidance for "AI-first," "FHIR
  R4/R5," "DHIS2 real-time," "hard-stops," "mortality score," "de-identified
  cohorts," "VigiBase E2B," "BCMA five rights," "privacy-safe household,"
  and "SMART apps/parallel go-live" — rewrite or remove each unless the
  corresponding fix sprint re-verified it.
- Update every in-app string, store listing, and doc that repeats a removed
  claim — this is not just a marketing document edit.
- `docs/SAFETY_CASE_STARTER.md` — intended use statement, a seeded hazard
  log from the S0/S1 findings, and the open regulatory-classification
  question (SaMD status, IEC 62304, ISO 14971) flagged explicitly as needing
  qualified regulatory/legal review — this plan does not and cannot resolve
  that question; it only frames it honestly.

---

## R12 — Verification & Re-Audit (Phase 5, the part that proves it)

Depends on all prior remediation sprints merged. This is the final sprint —
it reuses the same audit methodology from `docs/UMOYA_AUDIT_PROMPT.md`
rather than inventing new verification criteria, so the "before" and "after"
numbers are directly comparable.

Branch: `remediation/r12-verification-reaudit`.

Required outcomes:
- Full regression: build, tsc, lint, the entire test suite, reported against
  the R0 baseline — target is no new failures, every stale suite actually
  repaired (not skipped or weakened), and a coverage report for the
  safety-critical modules touched by R2–R10.
- Every original audit reproduction re-run and scripted into
  `remediation/reaudit/` — for each, record still-reproduces /
  no-longer-reproduces / changed-behavior.
- Re-run the load test, the security tooling (semgrep, a full-history
  gitleaks pass, a ZAP baseline scan, `npm audit`), the FHIR validator over
  exported bundles, and the three audit gold sets (interactions, dosing/
  de-identification battery, the hand-verified cascade cohort, KM vs
  `lifelines`).
- A mutation-testing sample on the CDS, dosing, eGFR, Kaplan-Meier, and
  cascade modules specifically — any surviving mutant in safety-critical
  code gets a new test before this sprint closes.
- An independent reviewer pass: a sub-agent that has not seen any of R2–R10's
  reasoning, given only the finding plus the diff plus the new tests, trying
  to bypass each S0/S1 fix through an alternative path (direct API, offline
  replay, telemedicine, bulk operations, order sets). Any bypass found
  reopens that finding — it is not a new finding, it's the same finding
  still open.
- A fresh self-audit: list the 10 fixes most likely to be incomplete or to
  have introduced a regression, and actually re-test at least 3 of them
  more deeply, the same discipline Sprint F of the original audit used on
  itself.
- `remediation/REAUDIT_REPORT.md` with an updated Claim Honesty Score — the
  same 51 claims, new verdicts, each with evidence — directly comparable to
  the original `audit/EXECUTIVE_SUMMARY.md`'s 0%-verified baseline.
- `remediation/EXECUTIVE_SUMMARY_REMEDIATION.md` (≤2 pages): findings
  fixed-and-verified vs mitigated vs deferred vs claim-removed; the S0 count
  before and after; an updated Go/No-Go for demo, synthetic pilot,
  real-patient pilot, and production, with any remaining blockers stated
  explicitly. The real-patient-pilot gate only opens if every exit criterion
  in `UMOYA_REMEDIATION_PROMPT.md` Section 8 holds, with evidence — otherwise
  this report says NO-GO and lists exactly what remains, the same honesty
  standard the original audit held the product to.
