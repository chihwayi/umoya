# Sprint E — Reliability, Performance & Operations (Section 3.11)

Stack: same Sprint-D scratch stack (ehr-service on :3013, PG :55440,
redis :56379). Harness-signed admin JWTs. k6 v1.x available in sandbox.

## 1. Load test (k6, executed)

Workload: mixed chart reads (`GET /patients/:id`, `GET /fhir/Patient/:id`,
`GET /checkin/queue`, `GET /research/adverse-events/unreported`),
3 synthetic patients, harness JWT.

- **REL-001 (S1, RUNTIME-PROVEN): the global rate limiter, not capacity, is
  the ceiling — and it is shared per source IP.** `main.ts:122-131` caps
  `/api` at **300 req/min per IP** (`trust proxy: 1`, default IP key).
  Measured: 200 VUs (≈760 rps) → 99.3% 429; 40 VUs (≈71 rps) → 91.6%
  429; 4 VUs × 2 req (≈8 rps ≈ 480/min) → 27.7% failed. A whole clinic
  behind one NAT gateway = one IP = 300 req/min shared across every
  staff member, device, and background sync. 200 concurrent clinicians at
  1 request per 30 s each = 400/min → systematic 429s. The "200 concurrent
  clinicians / 50 reads-sec" brochure shape cannot pass the front door.
- True capacity under the cap (2 VUs, ≈2 rps, 120 s, 236 checks, **100%
  pass**): med 12.3 ms, p90 21.7 ms, p95 29.2 ms, max 219 ms on chart
  reads. Per-request serving is healthy; the throttle is the binding
  constraint, and it throttles before saturation, not at it.
- **REL-002 (S1, RUNTIME-PROVEN): the throttle (and the login brute-force
  throttle) is bypassed by rotating `X-Forwarded-For`.** 310 requests with
  one XFF value → 300×200 then 429s (limiter works); a fresh XFF value →
  200 immediately (fresh bucket). Login endpoint: 10 fixed-XFF attempts →
  429s as designed; 12 rotating-XFF attempts → 12×401 with no throttle.
  `trust proxy: 1` trusts the immediate peer, so any direct client is its
  own "proxy". Unlimited login brute force for the cost of incrementing a
  header. Sprint D's login-throttle positive is downgraded accordingly.

## 2. Soak (30 min k6 @ ≈2 rps, background during this section)

Soak outcome (server-side evidence; k6 client summary lost on delivery,
so no client p50 claimed): audit rows grew 4230 → 6755 across the window
(≈2500 served reads, consistent with a full run) — **no crash, no OOM,
pool healthy**. 171 ERROR lines in the window categorize as: 11 known
hostile-input audit drops (S-007 class), 7 `tenantDb undefined`
audit-write failures (new variant of the same audit fragility), 2
drift-column errors, 1 connection failure — background noise from other
probes, not soak-induced degradation. Memory-trend UNVERIFIED (no
baseline); stability rests on uptime + error taxonomy.

## 3. Chaos (executed, all reversible)

| Kill | Core reads | Health signals | Recovery |
|---|---|---|---|
| redis stopped | 200 (unaffected — no ehr-service redis client found; redis serves CDSS queue/LiveKit, neither booted) | `/health` 200 | clean restart |
| PG `docker pause` 20–30 s | **hangs to client timeout** (curl 000 after 20 s; no 503/JSON error) | `/health` 200 (honest liveness); **`/health/ready` hangs 15 s+ with no response** | clean: 200 in ~10 ms after unpause, pool survived |
| LLM backend (ollama default unreachable; Bedrock creds absent) | 200 with rule-based summary in 174 ms | n/a | **graceful degradation PROVEN**: `generate()` returns null → rule sentences used, no hang, no error to caller |
| SMS gateway (disabled: `SMS_ENABLED` unset) | n/a (async) | n/a | **fail-silent**: skip-with-log, no retry, no DLQ — reminders/OTP-adjacent messages lost quietly |
| Payment gateway (empty `MTN_BASE_URL`) | `initiate` returns `pending` immediately | n/a | background dispatch fails **honestly**: row → `failed` + `Invalid URL`. Positive, with the caveat that `pending` misleads non-polling clients |
| DHIS2 down | not executed live (Sprint C covered wire behavior); scheduler disabled by default (I-011) | — | code-read: per-push path, no evidence of backoff/DLQ audit beyond logs |

- **REL-003 (S2, RUNTIME-PROVEN): DB outage hangs callers and the
  readiness probe.** No query timeout surfaces a 503; clients wait for
  their own timeout. `/health/ready` hanging (instead of failing fast)
  will wedge orchestrator rollouts and health-check-driven restarts.
  Recovery itself is clean (pool survives a 30 s pause) — the gap is purely
  detection/signalling.
- 2FA is TOTP (`otplib`), not SMS — no auth dependency on the SMS gateway
  (positive). SMS loss therefore hits reminders/alerts, never logins.

## 4. Backup / restore drill (executed on scratch)

`pg_dump` of master + tenant DBs (7.5 MB tenant dump), restore into a
fresh `restore_verify` database: patients 3/3, users 5/5, audit rows
match modulo soak-test growth during the drill (4230 → 4282, explained by
the concurrent soak run — itself evidence the system kept writing
throughout). Restore path works; RPO/RTO are undeﬁned (no schedule, no
PITR evidence, no documented disaster-recovery runbook found — S3).

## 5. Observability & scheduling

- 20+ `@Cron` services (care-gap 01:00, risk sweep 02:00, mortality 03:00,
  DHIS2 validation 02:00, …). Failure handling observed: per-patient
  try/catch → `logger.warn`, continue. **No dead-man switch, no alerting
  on nightly-job failure** anywhere except the DHIS2 scheduler's optional
  Slack/PagerDuty webhook config. A silently-not-running 3am mortality
  sweep is indistinguishable from a clean night. (code-read, broad; S3)
- Logs are verbose and PHI-bearing (QueryFailedError details include row
  values — interacts with S-011's Sentry note).
- CI (`.github/workflows/ci.yml`) runs build + lint + CDSS gates +
  migration-sequence audit; the ehr-service jest suite is **red locally
  (34 suites / 30 tests, stale-call-signature failures — independently
  confirmed)** yet CI's `npm test` gate evidently doesn't catch it (see
  §13 for the staleness characterization; the reliability angle is that
  the release gate does not gate).

## 6. Billing-lifecycle vs reliability (honest separation)

Subscription lifecycle (`tenant.service.ts` hourly cron): demo expiry →
suspend → auto-delete (3-day buffer); erasure → hard purge on schedule.
EHR tenant resolution requires `status='active'`, so a lapsed/suspended
tenant hard-fails every request with `Invalid tenant`. Scratch tenants are
`paid/active` (verified), so nothing in this sprint's outages is
billing-caused. The operational warning for deployments: **local/dev/demo
tenants can be suspended or deleted by the hourly cron**, which presents
exactly like an outage or data loss. Keep this lifecycle out of
reliability accounting, but document it for pilot ops (it also interacts
with Scenario 8: erasure works via purge, but see §13/§14 for residue).

## 7. Low-bandwidth / low-resource

Measured API payloads are lean (patient GET 1.6 KB, FHIR search 2.4 KB,
mobile en locale 12 KB) — the API layer is not the bandwidth problem.
No 2G/3G throttling rig, no old-Android device, no DICOM upload-burst test
in this sandbox (UNVERIFIED with blocker: needs device lab + PACS).
Charts render from 6-hour caches offline (see 08_offline_sync.md).

## Rule-2 rechecks

Limiter: measured at four rates + XFF rotation on two endpoints (general
API + login). DB chaos: codes captured with `-w`, recovery timed.
Restore: row-count diff explained, not hand-waved. SMS/payment/LLM paths
read at the exact failure branch, two of three executed live.
