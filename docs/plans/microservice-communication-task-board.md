# Microservice Communication Hardening Task Board

Use this as the execution board for the communication hardening sprint.

## Board Columns

- `Now`: active sprint tasks
- `Next`: queued tasks after `Now`
- `Later`: backlog candidates
- `Blocked`: tasks waiting on external dependency
- `Done`: completed and verified tasks

## Labels

- `area:frontend`
- `area:ehr-service`
- `area:tenant-service`
- `area:cdss-service`
- `area:monitoring`
- `type:reliability`
- `type:observability`
- `type:contract`
- `type:security`
- `type:tech-debt`
- `priority:p0`
- `priority:p1`
- `priority:p2`

## NOW (Week 1)

- [x] **P0** Implement timeout + retry + circuit-breaker policy for EHR->CDSS  
Owner: Backend  
Files: `services/ehr-service/src/services/cdss.service.ts`  
Done when: slow/down CDSS does not block EHR indefinitely.

- [x] **P1** Standardize error envelope across services  
Owner: Backend  
Files: `services/ehr-service/src/filters/http-exception.filter.ts`, `services/tenant-service/src/filters/sentry.filter.ts`, `services/cdss-service/main.py`  
Done when: all services return `code/message/details/requestId/timestamp`.

- [x] **P0** Harden tenant context validation in EHR entry path  
Owner: Backend  
Files: tenant middleware/guard in EHR service  
Done when: requests missing/invalid `X-Tenant-ID` fail fast with consistent 4xx.

## NEXT (Week 2)

- [x] **P0** Freeze/update CDSS OpenAPI contract and EHR usage alignment  
Owner: Backend  
Files: `services/cdss-service/main.py`, `services/ehr-service/src/services/cdss.service.ts`, `services/ehr-service/src/services/cdss-contract.spec.ts`, `docs/cdss/api-reference.md`  
Done when: integration tests fail on contract drift.

- [x] **P1** Add dependency SLO metrics (EHR->CDSS)  
Owner: Backend  
Files: `services/ehr-service/src/services/cdss.service.ts`, `services/ehr-service/src/services/metrics.service.ts`  
Done when: call counts/failures/timeouts/retries/latency metrics are emitted.

- [x] **P1** Add dashboard and alert rules for CDSS dependency health  
Owner: Observability  
Files: `monitoring/prometheus/prometheus.yml`, `monitoring/prometheus/alerts/cdss-dependency-alerts.yml`, `monitoring/grafana/dashboards/medicore-overview.json`  
Done when: p95 latency and error-rate alerting is visible and tested.

- [x] **P1** Add startup config validation + fail-fast for critical envs  
Owner: Platform  
Files: `packages/config/src/env.ts`, `.env.example`  
Done when: invalid required config fails startup in non-dev.

## LATER (Backlog)

- [ ] Add idempotency keys for critical mutation endpoints.
- [ ] Introduce dead-letter queue for failed async jobs.
- [ ] Add load-test profile focused on inter-service saturation.
- [ ] Add synthetic canary checks for CDSS dependency path.
- [ ] Evaluate service mesh only if traffic/complexity justifies it.

## BLOCKED

- [ ] _(empty)_

## DONE

- [x] **P0** Add `X-Request-ID` generation and forwarding in frontend API clients  
Owner: Frontend  
Files: `web-app/src/services/api.ts`, `ehr-frontend/src/services/api.ts`, `patient-portal/src/services/api.ts`  
Done when: all outgoing requests include request ID.

- [x] **P0** Add request ID middleware/interceptor in EHR service  
Owner: Backend  
Files: `services/ehr-service/src/main.ts` and logging/interceptor files  
Done when: EHR logs and error responses include request ID.

- [x] **P0** Add request ID middleware/filter in tenant service  
Owner: Backend  
Files: `services/tenant-service/src/main.ts`, `services/tenant-service/src/filters/sentry.filter.ts`  
Done when: tenant-service logs/errors include request ID.

- [x] **P0** Add request ID propagation + error handlers in CDSS  
Owner: Backend  
Files: `services/cdss-service/main.py`  
Done when: CDSS logs/errors include request ID and incoming ID is propagated.

- [x] **P1** Standardize error envelope across services  
Owner: Backend  
Files: `services/ehr-service/src/filters/http-exception.filter.ts`, `services/tenant-service/src/filters/sentry.filter.ts`, `services/cdss-service/main.py`  
Done when: all services return `code/message/details/requestId/timestamp`.

- [x] **P0** Harden tenant context validation in EHR entry path  
Owner: Backend  
Files: tenant middleware/guard in EHR service  
Done when: requests missing/invalid `X-Tenant-ID` fail fast with consistent 4xx.

- [x] **P0** Convert CDSS admin heavy ops to async jobs (`jobId` + status)  
Owner: Backend  
Files: `services/cdss-service/main.py`  
Done when: ingest/reindex/cache ops are non-blocking and status is queryable.

- [x] **P0** Update CDSS Admin UI for async job polling  
Owner: Frontend  
Files: `web-app/src/services/api.ts`, `web-app/src/components/CdssAdmin.tsx`  
Done when: UI shows pending/running/success/failure states by job ID.

- [x] **P0** Implement timeout + retry + circuit-breaker policy for EHR->CDSS  
Owner: Backend  
Files: `services/ehr-service/src/services/cdss.service.ts`  
Done when: slow/down CDSS does not block EHR indefinitely.

- [x] **P0** Freeze/update CDSS OpenAPI contract and EHR usage alignment  
Owner: Backend  
Files: `services/cdss-service/main.py`, `services/ehr-service/src/services/cdss.service.ts`, `services/ehr-service/src/services/cdss-contract.spec.ts`, `docs/cdss/api-reference.md`  
Done when: integration tests fail on contract drift.

- [x] **P1** Add dependency SLO metrics (EHR->CDSS)  
Owner: Backend  
Files: `services/ehr-service/src/services/cdss.service.ts`, `services/ehr-service/src/services/metrics.service.ts`  
Done when: call counts/failures/timeouts/retries/latency metrics are emitted.

- [x] **P1** Add dashboard and alert rules for CDSS dependency health  
Owner: Observability  
Files: `monitoring/prometheus/prometheus.yml`, `monitoring/prometheus/alerts/cdss-dependency-alerts.yml`, `monitoring/grafana/dashboards/medicore-overview.json`  
Done when: p95 latency and error-rate alerting is visible and tested.

- [x] **P1** Add startup config validation + fail-fast for critical envs  
Owner: Platform  
Files: `packages/config/src/env.ts`, `.env.example`  
Done when: invalid required config fails startup in non-dev.

## Suggested GitHub Issue Template (Copy/Paste)

```md
## Summary
Short description of communication hardening task.

## Scope
- [ ] Implementation
- [ ] Tests
- [ ] Docs

## Files
- path/to/file1
- path/to/file2

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Validation
- [ ] Unit test updated/added
- [ ] Integration test updated/added
- [ ] Manual verification completed

## Risk
Potential regressions and rollback approach.
```

## Tracking

- Sprint Plan: `docs/plans/microservice-communication-hardening-sprint.md`
