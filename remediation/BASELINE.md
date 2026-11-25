# R0 Baseline (branch `remediation/r0-baseline-triage`)

Audited commit (main HEAD at branch cut): `0429ada77f29cfc3a4acd057a18f66a27c1f0adb`
(`docs: fold completed audit into README, plan remediation (R0-R12)`;
parent `de79cfeb` = merge of audit Sprint F, PR #17).
Date: 2026-11-25. All runs on this checkout; no source edits.

## Stack (per audit/RUNBOOK.md scratch pattern)

- `audit-D-pg` / `audit-D-redis` (throwaway Docker, ports 55440/56379): UP.
- `d2-cluster-2400-*` (DHIS2 2.40.0 from Sprint C): UP (not exercised in R0).
- ehr-service (dist rebuilt this sprint, `npm run build` exit 0): UP on
  127.0.0.1:3013, `GET /api/checkin/queue` → 200 (synthetic tenant
  `audit-clinic`, harness-signed JWT).
- `tests/e2e` referenced by root `test:e2e` does not exist — not runnable.

## Build / typecheck / lint

| Check | Result |
|---|---|
| `tsc --noEmit` tenant-service | exit 0 |
| `tsc --noEmit` ehr-service | exit 0 |
| `npm run build` ehr-service (tsc + loinc-map copy) | exit 0 |
| `npm run build` tenant-service | exit 0 |
| `npm run lint` web-app | 0 errors, 10 warnings |
| `npm run lint` ehr-frontend | 0 errors, 791 warnings |
| `npm run lint` patient-portal | clean (0 problems) |
| mobile lint | no `lint` script (`--if-present` = silent skip) |
| medical-aid-demo-service | no build/test/lint scripts (plain `node src/server.js`) |

## Test suites (re-run, not cited)

| Suite | Suites pass/fail | Tests pass/fail | Time |
|---|---|---|---|
| ehr-service jest | 153 / **34 failed** (187) | 1171 / **30 failed** (1201) | ~142 s |
| tenant-service jest | 10 / 0 | 33 / 0 | ~10 s |
| cdss-service pytest (project `.venv`) | n/a (files) | **114 pass / 1 fail** (115 collected) | ~36 s |
| mobile jest | 3 / 0 | 13 / 0 | <1 s |
| web-app (craco) | 1 / **1 failed** (2) | 3 / **1 failed** (4) | — |
| ehr-frontend | 15 / **1 failed** (16) | 51 / **1 failed** (52) | — |
| patient-portal | 1 / 0 | 1 / 0 | — |

Failure detail (for R12 "no new failures" comparison):
- ehr-service: 34 suites / 30 tests — matches audit Q-002 (34/187, 30/1201)
  exactly; TS compile errors from stale call sites per audit §13.
- cdss: `test_llm_provider_governance.py::test_generate_response_allows_registered_policy`
  FAILS. Env note: the committed `.venv` was missing uvicorn/numpy/jwt/
  cryptography/boto3/statsmodels/sklearn/lifelines/psycopg2/redis/asyncpg;
  installed into the project-local venv (env setup, not a repo change).
  pandas 2.1.3 (pinned) cannot build on Python 3.14 — any pandas-dependent
  test module stays uncollectible here; the 115 collected exclude those paths.
- web-app: `CdssAdmin.test.tsx` (1 test) fails.
- ehr-frontend: `TriageQueue.test.tsx` (1 test) fails.

## Regression gate for later sprints

"Clean" = no new failures vs the table above on the same commands, plus the
failing entries above fixed only by repair commits (never by weakening).
