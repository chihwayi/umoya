# Coverage and Limits (Sprint F)

What this audit did **not** test, why, and what would be needed. Read with
[EXECUTIVE_SUMMARY.md](./EXECUTIVE_SUMMARY.md) (verdicts) and
[TRACEABILITY_MATRIX.csv](./TRACEABILITY_MATRIX.csv) (claim-by-claim basis).

## 1. UNVERIFIED rollup (all sprints)

These verdicts mean "evidence or it didn't happen" — the claim below each was
left unproven, with the blocker stated. Nothing here is a pass.

| # | Item | Blocker | Needed to close |
|---|---|---|---|
| 1 | R-002 DHIS2 real-mode end-to-end | Sprint C stood up real DHIS2 and exercised push; full bidirectional tracker-matrix with credentials rotation was not completed | MOHCC-style DHIS2 with tracker program + credentialed replay |
| 2 | I-007/I-017 FHIR auth scoping | Resolved by Sprint D (S-001/S-002 proved IDOR live); residual `_history`/`_revinclude` leakage sweep partial | Per-resource authz matrix test on booted stack |
| 3 | S-009 CORS reflection | **Closed by Sprint F self-audit (F-002)**: fail-closed on tested deployment; dev-only latent | Real-origin deployment check pre-prod |
| 4 | S-015 secrets full-history scan | Point-in-time clean only; no gitleaks/trufflehog sweep of full git history | Run history scan in CI; rotate any hit |
| 5 | O-008 BCMA/login offline coverage | Untraced | Airplane-mode device lab on ward hardware |
| 6 | P-010 telemedicine bandwidth/mid-call | Untested | Throttled-network call harness + mid-call order timing |
| 7 | B-017 name-redaction gap | Code-read only | Live redaction probe with named entities |
| 8 | AI-table row 9 grounded-generation live calls | DB-backed policy + tenant ctx blocker in sandbox | Staging tenant with policy rows; run grounded prompts live |
| 9 | Scenario 7 LLM-side effect | Backend (Bedrock/Anthropic) unreachable in sandbox — prompt-boundary proven, model behavior bounded as UNVERIFIED | Staging LLM key + injection benchmark |
| 10 | C-013 nightly care-gap content | Never executed against seeded cohort with hand-verified flags | Seeded panel + expected-flag matrix |
| 11 | C-027 FEFO/cold-chain/stock-balancing | Never tested | Pharmacy-module walkthrough with sensor fixtures |
| 12 | C-042 training role-basis | Content exists; role-scoping/completion evidence untested | LMS walkthrough per department role |
| 13 | C-055/C-056 survey + reminder timing | Never tested | Time-boxed synthetic patient journey |
| 14 | C-060 BLE devices | No physical BLE device | BP/glucometer hardware pair + range-check matrix |
| 15 | F-005 allergy-gate absence | Bounded greps only (confidence medium) | Live order-placement test on allergic synthetic patient |

## 2. Environment limits (apply to the whole audit)

- **No production-scale load test.** REL-001/REL-002 k6 runs were single-host,
  scratch-DB, and low-VU by design; "200 clinicians" readiness is disproven for
  the tested shape but no capacity number is proven for any other shape.
- **No real SMS/payment-provider credentials.** All payment findings (S-012,
  P-005) use sandbox/test keys and forged callbacks against the audit's own
  tenant. Provider-side fraud controls were not evaluated.
- **No physical BLE/wearable hardware.** R-006/P-008 are software-path findings.
- **Throwaway Postgres/Redis, single node.** Failover, backup-restore at scale,
  and multi-AZ behavior untested (the backup drill covered logical dump/restore
  only — and Sprint E's drill left ~7.5 MB dumps in /tmp; delete before closeout).
- **Review depth.** Every sprint PR was independently spot-checked (3–4 highest-
  severity claims each), not fully re-verified. Sprints A and C each had one
  correction; B/D/E passed spot-checks clean — but the bulk of D/E was never
  independently re-verified. The self-audit below weights D/E accordingly.

## 3. Self-audit: 10 places the audit was most likely wrong (Sprint F)

Methodology-rule debts first, then D/E-weighted candidates. Five were
re-tested live this sprint (marked ✅); the rest were re-examined against code
and labeled honestly.

| # | Suspect | Why it smelled | Outcome |
|---|---|---|---|
| 1 | S-009 CORS "reflect-any-origin" | S3 from code-read of `origin: true` fallback | ✅ **Corrected (F-002)**: fail-closed here; dev-only latent. S3→S4 |
| 2 | S-008/I-007 "$batch dead / no $validate handler" | 404s quoted without routing mechanism | ✅ **Mechanism corrected (F-001)**: handlers exist; Express 0.1.13 `$`-anchor makes all three $-routes unmatchable. Verdicts stand, blast radius widened |
| 3 | "$everything exists-but-500" | 500 quoted without root cause | ✅ **Confirmed + root-caused (F-004)**: `patientId` column missing on the no-$ path |
| 4 | B-016 "no clinician sign-off" | Code-read blanket claim, Sprint D never API-tested it | ✅ **Narrowed (F-003)**: doctor/nurse gate enforced live (receptionist 403); gap is countersignature, not sign-off |
| 5 | E2E-007 single-endpoint injection | One probe generalized to a path? (Rule 2) | ✅ **Strengthened (F-005)**: no allergy gate found anywhere on order/pharmacy/CDSS path; BCMA (bypassable) is the only check |
| 6 | O-004/O-007 offline abstain behavior | Code-read where Sprint D required execution | Re-read exact lines (`cdss.ts` catch→ABSTAINED) — quote verified accurate; live network-cut still open (item 15 above). No correction, no upgrade |
| 7 | S-015 "secrets clean" | Point-in-time only, easily over-read as a pass | No correction — correctly labeled UNVERIFIED; must run pre-pilot |
| 8 | REL-001/REL-002 limiter findings | Single-env k6; vendor defaults differ per deploy | No correction — verdicts are about the tested shape and say so; do not generalize to tuned prod |
| 9 | RES-005 "KM correct to 3dp" | Numeric claim resting on one oracle run | Re-examined: lifelines 0.30.3 oracle + NaN-degenerate caveat both recorded; stands as PARTIAL, not a pass |
| 10 | Q-002 suite-red counts | Counts rot fast; could be stale already | Independently confirmed by reviewer pre-merge; stands with its date. Re-run before any release gate |

## 4. Corrections ledger (Sprint F appends to FINDINGS.jsonl)

F-001 (S-008/I-007 mechanism), F-002 (S-009 downgrade), F-003 (B-016
narrowing), F-004 ($everything root cause), F-005 (allergy-gate absence).
Total findings: 106 (101 + 5). No prior row was edited; corrections are
additive so the audit trail stays intact.
