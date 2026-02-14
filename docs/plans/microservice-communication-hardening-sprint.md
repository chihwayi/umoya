# Microservice Communication Hardening Sprint (2 Weeks)

## Objective

Harden cross-service communication across:

- `web-app` -> `tenant-service`, `ehr-service`, `cdss-service`
- `ehr-frontend` -> `tenant-service`, `ehr-service`, `cdss-service`
- `patient-portal` -> `ehr-service`
- `ehr-service` -> `cdss-service`

Primary outcomes:

- lower latency variance
- predictable failure handling
- traceable end-to-end requests
- contract-safe integrations

## Scope

In scope:

- request correlation IDs
- timeout/retry/circuit-breaker policy
- consistent error envelope
- tenant context validation
- async admin jobs for long-running CDSS operations
- dependency SLO metrics and alerts
- startup config validation

Out of scope:

- full service mesh adoption
- deep auth redesign beyond current JWT/owner checks
- major domain refactors unrelated to communication

## Week 1 (Reliability + Observability Foundation)

### 1) Correlation ID Propagation

- Add `X-Request-ID` generation/forwarding in frontend API clients.
- Propagate from entry service to downstream service calls.
- Include request ID in all service logs and error payloads.

Files to touch:

- `web-app/src/services/api.ts`
- `ehr-frontend/src/services/api.ts`
- `patient-portal/src/services/api.ts`
- `services/ehr-service/src/main.ts`
- `services/tenant-service/src/main.ts`
- `services/cdss-service/main.py`

Acceptance criteria:

- One user action has one ID traceable across frontend + all backend logs.

### 2) HTTP Client Policy (Timeout/Retry/Circuit)

- Centralize EHR->CDSS HTTP behavior.
- Apply per-endpoint timeout defaults.
- Retry only idempotent/read-safe operations.
- Add circuit-breaker fallback for CDSS dependency errors.

Files to touch:

- `services/ehr-service/src/services/cdss.service.ts`

Acceptance criteria:

- CDSS slow/down state does not block EHR requests indefinitely.
- EHR returns controlled degraded response when CDSS is unavailable.

### 3) Unified Error Envelope

- Standardize backend errors:
  - `code`
  - `message`
  - `details`
  - `requestId`
  - `timestamp`

Files to touch:

- `services/ehr-service/src/filters/http-exception.filter.ts`
- `services/tenant-service/src/filters/sentry.filter.ts` (or additional global filter)
- `services/cdss-service/main.py` (global exception handlers)

Acceptance criteria:

- Frontends can parse and display errors uniformly across services.

### 4) Tenant Context Hardening

- Enforce strict `X-Tenant-ID` validation in EHR entry path.
- Fail fast for missing/invalid/inactive tenant context.

Files to touch:

- EHR tenant middleware/guard files (existing tenant resolution path)
- `ehr-frontend/src/services/api.ts`
- `patient-portal/src/services/api.ts`

Acceptance criteria:

- No EHR tenant data route executes without validated tenant context.

## Week 2 (Contract Safety + Async Workflows + SLOs)

### 5) Contract-First CDSS Integrations

- Freeze/update CDSS OpenAPI contract.
- Validate EHR-side response shape usage against contract.
- Add regression test for contract drift.

Files to touch:

- `services/cdss-service/main.py` (schema fidelity)
- `services/ehr-service/src/services/cdss.service.ts`
- `docs/cdss/api-reference.md`

Acceptance criteria:

- Contract mismatch fails in CI/tests, not silently in production.

### 6) Async Jobs for CDSS Admin Heavy Actions

- Convert long operations to job model:
  - `ingest`
  - `reindex`
  - `cache flush` (if heavy)
- Return `jobId`, expose status endpoint, poll from UI.

Files to touch:

- `services/cdss-service/main.py`
- `web-app/src/services/api.ts`
- `web-app/src/components/CdssAdmin.tsx`

Acceptance criteria:

- CDSS admin UI operations no longer depend on long blocking requests.

### 7) Service Dependency SLO Metrics + Alerts

- Add metrics for EHR->CDSS:
  - total calls
  - failures
  - timeouts
  - retries
  - latency p50/p95
- Surface in Prometheus/Grafana; add alert threshold.

Files to touch:

- `services/ehr-service/src/services/cdss.service.ts`
- `monitoring/prometheus/prometheus.yml`
- `monitoring/grafana/dashboards/medicore-overview.json`

Acceptance criteria:

- Dashboard shows dependency health.
- Alert triggers on sustained CDSS failure/timeout rate.

### 8) Config Validation and Drift Control

- Validate required service URLs/secrets on startup.
- Fail fast in non-dev for invalid/missing critical config.
- Align `.env.example` with actual runtime requirements.

Files to touch:

- `packages/config/src/env.ts`
- `.env.example`

Acceptance criteria:

- Misconfigured environments fail at startup with explicit message.

## Mandatory Validation Suite

- CDSS dependency down test: EHR degrades gracefully.
- Timeout test: no indefinite waits; bounded retries.
- Request ID trace test: consistent correlation across logs.
- Contract regression test: schema drift is caught.
- Tenant isolation test: invalid tenant context is rejected.

## Delivery Strategy

Recommended PR order:

1. Correlation IDs + error envelope
2. Timeout/retry/circuit-breaker in EHR->CDSS
3. Tenant context hardening
4. Async CDSS admin jobs + UI polling
5. Metrics/alerts + config validation

## Definition of Done

- All acceptance criteria above pass.
- No new high-severity communication regressions in smoke tests.
- Updated docs merged:
  - this file
  - `docs/plans/microservice-communication-task-board.md`

