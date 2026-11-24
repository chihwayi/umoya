# Executive Summary — Umoya Adversarial Audit (Sprints A–F)

106 findings (101 domain + 5 Sprint F self-audit corrections). All verdicts
evidence-backed; 15 items remain UNVERIFIED with stated blockers (see
[COVERAGE_AND_LIMITS.md](./COVERAGE_AND_LIMITS.md)). Full mapping:
[TRACEABILITY_MATRIX.csv](./TRACEABILITY_MATRIX.csv).

## Claim Honesty Score (51 ledger claims)

| Verdict | Count | Share |
|---|---|---|
| BROKEN | 21 | 41% |
| PARTIAL | 17 | 33% |
| UNVERIFIED (never tested) | 6 | 12% |
| MISLEADING | 4 | 8% |
| ABSENT | 2 | 4% |
| STUB | 1 | 2% |
| VERIFIED | 0 | 0% |

Zero of 51 brochure claims verified as stated. The two brightest spots are
component-level: SNOMED CT genuinely loaded (I-009) and the HIV testing
algorithm 8/8 correct (B-015) — neither rescues the claim built on it.

## Top 10 S0 risks (ranked by exploitability × harm)

| # | Risk | Why this rank |
|---|---|---|
| 1 | UX-001 BCMA bypass | Wrong-patient/wrong-drug passes; bedside, routine, lethal |
| 2 | S-001 horizontal IDOR | Any tenant token reads any patient; enables 4, 6, 9 |
| 3 | P-002 household HIV broadcast | Named diagnosis to any role via changed-ID; unconsented disclosure at scale |
| 4 | RES-001/002 re-identification chain | 12/18 identifiers leak + computable default salts |
| 5 | B-001 interaction gap (sens. 0.301) | TB/HIV cornerstones invisible; rifampicin-DTG missed |
| 6 | B-008 DTG contradiction | Treatment failure told "continue, risk is low" |
| 7 | B-002 creatinine unit trap | 10× dosing error from µmol/L→mg/dL |
| 8 | E2E-003 compound | Allergy revert + unit trap + false-negative herb in one patient |
| 9 | B-011/S-002 disclosure role gap | Receptionist reads/writes adolescent HIV disclosure |
| 10 | E2E-001 scenario chain | Proves 1–9 compound instead of merely coexisting |

## 10 brochure claims that must change or be built

| # | Claim | Change |
|---|---|---|
| 1 | AI-first (C-001) | "Rules-based CDS with governed LLM drafting in validation" |
| 2 | FHIR R4/R5, HIPAA-ready (C-002/3) | "R4 façade; R5 not negotiated; HIPAA-style controls with listed gaps" |
| 3 | DHIS2 real-time two-way (C-004) | "Scheduled aggregate push (mock default); not real-time" |
| 4 | Interaction hard-stops (C-011) | Remove until sensitivity bar + enforcement exist |
| 5 | Mortality badge (C-012) | "Unvalidated heuristic — do not use for triage" or remove |
| 6 | De-identified cohorts (C-016/34) | Suspend exports until re-identification chain closed |
| 7 | VigiBase E2B (C-018/36) | "Adverse-event register, manual VigiFlow entry"; stop setting exported flag |
| 8 | BCMA five rights (C-024) | "Barcode capture without cross-checks" until matching ships |
| 9 | Household privacy-safe (C-062) | Suspend HIV/STI propagation immediately |
| 10 | SMART apps / parallel go-live (C-032/43) | Remove until implemented |

## Go / No-Go

| Gate | Verdict | Condition |
|---|---|---|
| Scripted demo (synthetic) | **GO** | Seeded data only; do not demo BCMA, payments, or live DHIS2 push |
| Synthetic-data pilot | **CONDITIONAL GO** | Sandbox tenants; DHIS2 mock labeled; callbacks unsigned-by-test |
| Real-patient pilot | **NO-GO** | BCMA bypass alone hard-blocks; + IDOR, P-002, B-001/B-008 |
| Production at scale | **NO-GO** | Above + limiter (REL-001), no erasure (E2E-008), audit fail-open (S-007), 33 open advisories (S-013), no SaMD classification (Q-003) |

## 30/60/90-day roadmap (effort in dev-weeks)

**30 days (~10 wks):** enforce BCMA five-rights (4); close IDOR + disclosure
gates (3); suspend household HIV propagation (1); fix interaction sensitivity
floor + offline abstain message (3). Exit: real-patient pilot unblocked
subject to re-test.
**60 days (~12 wks):** single cascade-computation pipeline (3); DTG/dosing
logic fixes + caps (3); `$`-route + $everything repair (2); payment signature
verification + ZiG FX (2); erasure pipeline design (2).
**90 days (~8 wks):** alert-fatigue + critical-escalation redesign (3);
VigiBase real E2B or claim removal (2); history secrets scan + dependency
triage (1); SaMD determination + hazard file (2). Exit: production-readiness
re-audit of the S0 set.

## Self-audit note

Five live re-tests this sprint corrected two findings' mechanisms (F-001
Express `$`-anchor; F-004 `patientId` column), narrowed one (F-003 discharge
gate exists; countersignature missing), downgraded one (F-002 CORS S3→S4),
and strengthened one (F-005 no Rx-path allergy gate). Ten likely-wrong
spot-checks, method, and residual UNVERIFIED items:
[COVERAGE_AND_LIMITS.md §3](./COVERAGE_AND_LIMITS.md#3-self-audit-10-places-the-audit-was-most-likely-wrong-sprint-f).
