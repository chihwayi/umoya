# R0 Fix Plan — 106 findings → fix IDs, sprints, tests, deps, effort

Conventions: `FX-###` = existing grouping in `UMOYA_REMEDIATION_PROMPT.md`
(§§2–6) / `REMEDIATION-SPRINT-BRIEFS.md` (R1–R12). `FX-025…027` = new IDs
created by R0 (§5). `CLAIM` = no code fix; R11 rewrite/remove. Test types:
U = unit, I = integration (booted stack + synthetic tenant), E = end-to-end /
manual script. Effort: XS <1d, S 1–3d, M 1–2wk, L 3+wk. Dependencies use
"after X" (must land first) or "with X" (same sprint OK).

## R1 — Foundation (FX-001…004)

| Finding | Sev | Fix | Test | Dep | Effort | Note |
|---|---|---|---|---|---|---|
| S-003 patients VIP cols | S1 | FX-001 | I | — | S | Class A drift; add cols via bundle+patch |
| S-005 mfaRequired | S2 | FX-001 then FX-021 | I+U | bundle col first, then fail-closed | S | Class B + MFA default-true |
| RES-003 deid_export_log cols | S1 | FX-001 | I | — | XS | Class C INSERT mismatch |
| RES-004 cohort broken | S1 | FX-001 (tables) then FX-020 | I | with R6 role-gate | S | drift half + authz half |
| RES-007 q.tenant_id | S1 | FX-001 then FX-020 | I | col first, then token guard fix | S | + class-level JwtAuthGuard removal |
| P-001 mrn | S1 | FX-001 | I | — | XS | raw SQL `mrn`→`patient_number`; add regression |
| P-003 diagnoses table | S2 | FX-001 then FX-012 | I | table/cols first — **do NOT expose panel before FX-012 gates land** | S | masked by 500 today; reachable = leak |
| F-004 medical_records camelCase | S2 | FX-001 (CI rule) + FX-004 | I | — | S | fix query + raw-SQL CI parse |
| S-004/VARCHAR(50) overflow | S1 | FX-002 | I+U | — | S | widen + key check + backfill |
| O-002 poison queue | S1 | FX-002/FX-003 | I | after FX-002 (distinguish 4xx-valid vs 5xx-drift) | S | terminal state + UI |
| S-008/I-007/F-001 $-routes | S2 | FX-004 | I | — | S | escape `$` / custom matcher; reachability test per CapabilityStatement op |
| I-015 MPI precedence | S2 | FX-022 (R7) | U+I | — | XS | parenthesize; NOT drift (code bug) — listed here only to avoid misrouting to FX-001 |

## R2 — Authorization & Disclosure (FX-011/012)

| Finding | Sev | Fix | Test | Dep | Effort | Note |
|---|---|---|---|---|---|---|
| S-001 IDOR | S0 | FX-011 | I | **after R1** (needs readable patients) | M | single authz layer; matrix generated from tests |
| I-017 patient scoping | S1 | FX-011 | I | with S-001 | S | same layer |
| B-011 disclosure gates | S0 | FX-012 | I | after R1; with FX-011 layer | M | role×age gates; MINOR_ASSENT linkage |
| S-002 disclosure IDOR | S0 | FX-012 | I | with B-011 | S | same endpoints, runtime proof exists |
| P-002 household broadcast | S0 | FX-012 | I | after R1 (P-003 table must exist first, **gated**) | M | remove auto-propagation; consent per disclosure; unsafe-link flag |
| E2E-004 insider/VIP | S2 | FX-011 + FX-021 | I | vip_flag col (FX-001) first | S | scoping + unmonitored-access alerting |
| E2E-006 bulk exfil | S2 | FX-011 + FX-021 | I | with R2/R8 | M | bulk-export authz + rate limits + detection |

## R3 — Bedside & Financial (FX-010/018/019)

| Finding | Sev | Fix | Test | Dep | Effort | Note |
|---|---|---|---|---|---|---|
| UX-001 BCMA bypass | S0 | FX-010 | I+E | after R1 (wristband FK drift); re-test after R2 | L | all 7 rights + override audit; cached-MAR staleness |
| UX-002 critical ack | S1 | FX-018 | I | — | M | ordering/on-duty only; escalation timers |
| UX-003 escalation | S2 | FX-018 | I | with UX-002 | S | off-shift routing; re-surface |
| S-012 payment forgery | S1 | FX-019 | I | — | M | verify-all-5 + replay + idempotency; default-OFF per provider |
| P-005 ZiG/FX | S1 | FX-019 | U+I | with S-012 | S | currency layer or single-currency enforcement |

## R4 — Interactions & Allergies (FX-013/014)

| Finding | Sev | Fix | Test | Dep | Effort | Note |
|---|---|---|---|---|---|---|
| B-001 sensitivity 0.301 | S0 | FX-013 | U+I | after R1 (terminology tables provisioned) | L | licensed/curated KB (DECISIONS_NEEDED if licensing); ≥0.95 contraindicated recall on extended gold set |
| E2E-001 scenario chain | S0 | FX-013 + FX-014 + FX-012 | I | with R2/R4/R5 | S | compound proof; re-run whole chain |
| E2E-003 compound | S0 | FX-014 + FX-015 + FX-023 | I | with R4/R5/R8 | S | allergy revert + unit trap + false-negative herb |
| F-005 no Rx allergy gate | S1 | FX-014 | I | — | M | same store BCMA reads; unknown = prompt |
| E2E-007 allergy:null drop | S1 | FX-014 (drop) + FX-024 (injection) | I | — | M | fix drop in FX-014; prompt-boundary in R9 |

## R5 — Renal/ART/Mortality/CVD (FX-015/016/017 + new)

| Finding | Sev | Fix | Test | Dep | Effort | Note |
|---|---|---|---|---|---|---|
| B-002 unit trap | S0 | FX-015 | U | — | S | canonicalize + store unit; 88.4 regression |
| B-003 fail-open renal | S1 | FX-015 | U | — | S | unknown = no dose + override |
| B-004 no caps | S1 | FX-015 | U | — | M | weight/age bounds, per-drug max, Child-Pugh, mg/kg |
| B-009 regimen endpoint | S1 | FX-015 | U+I | — | M | server-side assessment; EAC gate; no default Cr |
| B-013 no eGFR fn | S1 | FX-015 | U | — | M | CKD-EPI 2021 + Schwartz vs published refs |
| B-008 DTG contradiction | S0 | FX-016 | U | — | M | cite WHO version/date; BID with rifampicin |
| B-010 2nd-line dated | S2 | FX-016 | U | with B-008 | S | same guidance update |
| B-005 mortality badge | S0 | FX-017 | U | — | M | validated score or rename + insufficient-data state |
| B-014 Framingham dual | S2 | **FX-027 (new, R5)** | U | — | M | one validated impl; remove dead cap; no CVD claim until validated |

## R6 — Research (FX-020 + new)

| Finding | Sev | Fix | Test | Dep | Effort | Note |
|---|---|---|---|---|---|---|
| RES-001 18-identifier leak | S0 | FX-020 | U+I | after R1 (export must run to test scrubber) | L | structured + free-text NLP scrubber with measured recall; suspend free-text if below target |
| RES-002 default salts | S0 | FX-020 | I | — | S | fail closed at boot; per-tenant secrets |
| R-003 default salt (recon) | S2 | FX-020 | I | with RES-002 | XS | same fix, recon-side evidence |
| RES-006 VigiBase | S1 | FX-020 | U+I | — | M | real E2B(R3) or relabel + stop flag |
| RES-005 KM/Greenwood | S3 | **FX-025 (new, R6)** | U | — | S | 3dp claim + NaN-CI guard; mutation-harden KM svc |
| RES-004 role gate half | S1 | FX-020 | I | after R1 + with R2 layer | S | no identified rows; role-gate |

## R7 — Interop (FX-022)

| Finding | Sev | Fix | Test | Dep | Effort | Note |
|---|---|---|---|---|---|---|
| I-001 code-system norm | S2 | FX-022 | U | — | XS | strip hyphen/case; warn unknown |
| I-002 dose mangling | S1 | FX-022 | U+I | — | M | preserve dosage text + patient instructions |
| I-003 allergy downgrade | S1 | FX-022 | U+I | — | S | severity round-trip |
| I-004 inbound success-lies | S1 | FX-022 | I | after R1 | M | idempotent upsert + per-resource status |
| I-005 HL7v2 ghosts | S1 | FX-022 | U+I | — | M | CR/LF/CRLF, PID required, ACK/NACK |
| I-006 BP panel | S2 | FX-022 | U | — | XS | standard panel pattern |
| I-010/I-011 mock/real-time | S2 | FX-022 | I | — | S | MODE banner + alert; schedule honestly |
| B-007 cascade denominators | S1 | FX-022 | U+I | after R1 | M | exclusions per standard; hand-verified cohort |
| I-012 dashboard≠DHIS2 | S1 | FX-022 | I | with B-007 | M | **one canonical cascade service** |
| I-013 zero-rekeying | S1 | FX-022 | I+E | — | M | per-leg proof or claim removal |
| I-018 consent on push | S1 | FX-022 | I | with R2 layer | S | push-time gate |
| B-012 CDPA gaps | S1 | FX-022 | I | — | M | erasure pipeline or written design → DECISIONS_NEEDED |
| E2E-008 deactivation | S1 | FX-022 | I | with B-012 | M | per-store purge or documented limits |
| S-010 consent unenforced | S2 | FX-022 | I | with R2 layer | M | central enforcement point |
| I-014 migration loss | S2 | FX-022 | I | — | M | closest fit: import integrity + transaction |
| E2E-005 rekey chain | S2 | FX-022 | I+E | — | S | same legs as I-013 |
| F-003 sign-off half | S1 | FX-022? No → **FX-024 (R9)** | I | — | S | author≠signer rule (see R9) |

## R8 — Security & Concurrency (FX-021/023)

| Finding | Sev | Fix | Test | Dep | Effort | Note |
|---|---|---|---|---|---|---|
| S-006 stored XSS | S2 | FX-021 | U+I | — | S | server-side sanitization + CSP |
| S-007 audit drops | S2 | FX-021 | I | — | M | dead-letter + alert; log hostile raw |
| S-009/F-002 CORS | S4 | FX-021 | I | — | XS | fix interpolation; log effective origins |
| REL-001 limiter | S1 | FX-021 | I | — | M | user/tenant keying; 200-clinician k6 |
| REL-002 XFF bypass | S1 | FX-021 | I | with REL-001 | S | trusted-proxy IP; per-account login throttle |
| S-013 dependencies | S2 | FX-021 | I | — | M | reachability-triaged; CI gate |
| S-015 history scan | S3 | FX-021 | manual | — | S | gitleaks full history; rotate; record |
| O-001 silent LWW | S1 | FX-023 | I | — | M | version/ETag + 409/merge on clinical writes |
| O-004 herb unknown | S2 | FX-023 | I | — | S | "could not check", never "none" |
| O-007 offline interactions | S2 | FX-023 | I | with R4 KB | M | bundle compact base or hard-block offline high-risk Rx |
| O-006 backlog caps | S3 | FX-023 | I | — | S | overflow visible; duplicate-review queue |
| O-008 BCMA offline (unverified) | S4 | FX-023/FX-010 | E | with R3 | S | device-lab coverage |

## R9 — Remaining safety (FX-024 + new)

| Finding | Sev | Fix | Test | Dep | Effort | Note |
|---|---|---|---|---|---|---|
| B-016/F-003 countersignature | S1 | FX-024 | I | — | S | signer≠author or countersignature |
| E2E-002 transfusion/override | S2 | FX-024 | I | — | S | consent gate + emergency capture |
| UX-004 LASA | S3 | FX-024 | U+I | — | S | tall-man + dispense check |
| P-008 wearable flags | S2 | FX-024 | U | R1 infra note | S | flag_reason + allowlist (bridge stub is product decision) |
| R-006 wearable stub | S2 | FX-024 + CLAIM | E/manual | product decision first | S | build bridge or remove claim |
| P-004 pre-visit overwrite | S2 | FX-024 | I | — | M | single-submit + patient-reported marking |
| P-009 queue names | S4 | FX-024 | I | with R2 | XS | minimisation |
| REL-003 DB fail-fast | S2 | FX-024 | I | — | S | honest readiness |
| REL-004 cron watchdog | S3 | FX-024 | I | — | S | dead-man switch + alerting |
| B-017 model pins/redaction | S2 | FX-024 | I | — | M | pin IDs; name redaction; Sentry scrub |
| S-011 region/Sentry | S2 | FX-024 | I | — | M | consent/DPA gate; scrub payloads |
| E2E-007 injection boundary | S1 | FX-024 | I | — | M | delimiters, schema validation, no tool-from-output |
| P-006 translations | S3 | FX-024 | manual | — | M | native-speaker review + CI lexicon |
| P-007 E2EE wording | S3 | FX-024 + CLAIM | manual | product decision | S | E2EE or honest "transport + recorded egress" |
| P-010 bandwidth (unverified) | S4 | FX-024 | E | — | S | throttled-call harness |
| FX-026 (new, R9) mock EHR module | S1 | R-005 disposition | I | — | S | remove from prod build or gate default-OFF |

## R10 — DAK (Phase 3) / R11 — Claims / R12 — Verification

| Finding | Sev | Fix | Test | Dep | Note |
|---|---|---|---|---|---|
| B-006 decision tables | S1 | R10 step 3 | U | after FX-022 terminology | default NOT applicable; oracle CQL first |
| B-015 HIV testing 8/8 | S3 | R10 (lock-in) | U | — | VERIFIED finding → convert to permanent oracle regression, not a fix |
| R-004 DAK content | S3 | R10 steps 1–2 | I | — | pin + update pipeline; data-element map |
| R-001 FHIR-façade wording | S3 | CLAIM (R11) | — | FX-022 done | rewrite, not build |
| I-008 R4/R5 wording | S2 | CLAIM (R11) | — | — | remove R5 until negotiated |
| I-016 parallel go-live | S2 | CLAIM (R11) + DECISION | — | product decision | remove until tooling exists |
| Q-003 SaMD | S2 | R11 safety case | manual | qualified review | not legal advice; hazard log from S0/S1 |
| Q-001 mutation sample | S3 | R12 | U | — | surviving mutants → new tests |
| Q-002 red suite | S2 | every sprint + R12 | full suite | R0 baseline above | repair-only commits; never weaken |
| S-014 SQLi (PASS) | S4 | R12 reaudit | I | — | positive control; keep probe |
| O-003/O-005 (PASS) | S4 | R12 reaudit | I | FX-023 must not regress | positive controls |
| I-009 SNOMED (VERIFIED) | S3 | R12 reaudit | I | licence check | positive control |

## New IDs created by R0 (3)

- **FX-025** (R6): KM/Greenwood numeric validation + NaN-CI guard + KM mutation hardening. (RES-005 had no FX home.)
- **FX-026** (R9): mock EHR module disposition — remove from production build or default-OFF gate + reachability test. (R-005 had no FX home.)
- **FX-027** (R5): single validated CVD/Framingham implementation; remove dead risk-map cap. (B-014 had no FX home — FX-015 is renal-only.)

## Coverage: 106/106 mapped, 0 unmapped

## §B — S0/S1 re-run log (R0, clean baseline, 2026-11-25)

Stack: audit-D-pg/redis, ehr dist rebuilt from this HEAD, synthetic tenant
`audit-clinic`. `services/` tree bit-identical to audited commit (only
`remediation/` untracked). "Code-identical" below means: same file+line as the
audit cites, verified by read on this HEAD.

**Reproduces exactly as described (live):** S-001 (receptionist GET patient →
200 PHI); I-017 (same via FHIR); S-002-read (disclosure 200); P-002
(household alerts 200 with `condition_name HIV`); S-012 (forged mpesa
callback → 200 Accepted); UX-001a/b (nil-UUID + garbage prescription →
`verified:true`); UX-002-ack (receptionist acknowledges K+ 6.8 alert → 200);
B-001 (rifampicin+DTG, sildenafil+nitrate, linezolid+SSRI → all `[]`);
B-002 (CrCl(88.4) = 1.0998 vs 97.2 at 1.0 mg/dL); B-008 (DTG/VL7000/M184V →
"Resistance risk is low… Continue current regimen"); B-004 (vancomycin
700 kg → 10500 mg, no cap); O-001 (nurse high → admin low, read-back silent,
also showing I-003 live: read-back severity "mild"); I-002 (MedReq "Take at
night" → "once daily" on live round trip); E2E-007 (array-shaped problem
stores injection verbatim with `codeSystem SNOMED_CT`, null concept);
S-006 (nursing note stores `<img onerror>` raw); E2E-006 (pharmacist bulk
list → 200 full rows); RES-007-drift (`q.tenant_id` 500 with JWT; 401-guard
fires first without JWT); REL-002 (12× rotating XFF → all 401; same IP →
429 after 3); REL-001 (own k6 blast throttled ALL traffic incl. single curls
for the window; 200 after ~70 s); F-003a/b (403 + 404-encounter, as Sprint F).

**Reproduces as broken, different specifics:** S-003/S-004 (any create with
nationalId+phone → 500 `varchar(50)` — S-004 blocks ALL registration; seeded
reads still 200, so the "cannot read" half is create-masked); S-002-write
(500 on my minimal payload — needs full DTO; read leg is the proven half);
RES-003 (500 `map of undefined`, not INSERT-cols — export broken either way);
RES-004-run (500 `map of undefined` as receptionist — broken + ungated);
RES-006-export (`{"exported":0,"records":[]}` — no seed; flag-assertion path
code-verified at controller line 143); I-005 (ADT 500 `split of undefined`);
I-003-live (criticality "high" preserved; mapper-level moderate→mild stands
on code identity); I-013 (referral 500 `referringFacilityName`); B-007 +
KM-live (500 `relation hiv_enrollments does not exist` — bundle has
`hiv_care_envelopes`/`hiv_care_enrollments`; canonical-service work must use
the real name); E2E-002 (nurse 403 holds; doctor path needs inventory
reservation — consent is downstream flag only, code-verified); RES-007
portal (401 without JWT confirms guard half).

**Code-identical, stands (no live change possible/needed):** B-003 (renal
unknown → dose None + "monitor closely" — ehr-side handling is the FX-015
question); B-005 (missing→0→band low, plus `medical_records.patient_id`
snake_case — note F-004's camelCase is the outlier); B-006 (no-condition →
applicable); B-009 (`creatinine ?? 1.0` in controller signature);
B-010/B-014/B-016/B-018/B-013/RES-002/RES-005-oracle/I-006/O-007/S-007
("Never fail the main operation…", logger only)/S-011 (no beforeSend
scrub)/F-005/I-014/I-018-note/S-010-shape/E2E-001-composition/E2E-003-legs.

**New R0 observations for later sprints:** (1) `Content-Type:
application/fhir+json` bodies are silently unparsed (Express default) — every
$-less FHIR create must use `application/json`; add a 415 or parser fix in
R7. (2) S-004 blocks ALL patient registration on fresh tenants — S-003+S-004
are one compound blocker. (3) `hiv_enrollments` vs bundle's
`hiv_care_enrollments` naming split hits cascade + KM + (likely) DHIS2.

**Seed pollution (synthetic tenant only):** seeded patient allergy overwritten
(Penicillin/low); problems replaced then cleared to []; one XSS nursing note
left (no DELETE route); one MedReq + one AllergyIntolerance created. Noted so
R1's fresh-tenant smoke test starts from repairTenants, not this state.

**Not re-executed, with reason:** I-014 full 100k import (cost; code
identical); B-012 CDPA process gaps (no single probe; code identical);
P-004 pre-visit chain (needs intake flow; code identical); P-005 ZiG (no
provider; code has no FX layer — grep-verified); S-010 enforcement matrix
(needs R2 layer to mean anything; D-proof stands); B-015/I-009 positives
(no repro needed — lock in as R10/R12 oracles).

43 S0/S1 re-run results: §B below.
