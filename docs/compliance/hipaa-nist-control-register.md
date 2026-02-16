# MediCore HIPAA + NIST Control Register (Initial)

Last updated: 2026-02-14
Owner: Security + Platform
Status: In Progress

## Scope

This register maps current platform controls to HIPAA Security Rule requirements and NIST CSF/NIST 800-53 style control families.  
It is the baseline artifact for `E6-B1` in `docs/plans/ai-ehR-hardening-roadmap.md`.

## Control Register

| Control ID | Domain | HIPAA Security Rule | NIST Family | Current Implementation | Evidence Source | Owner | Status | Gap / Next Action |
|---|---|---|---|---|---|---|---|---|
| AC-01 | Service auth between EHR and CDSS | 164.312(d) Person/Entity Authentication | IA / AC | Shared token + signed service JWT (`iss`/`aud`) with fail-fast config validation and replay protection (`jti`) | `services/ehr-service/src/services/cdss.service.ts`, `services/cdss-service/main.py`, `services/cdss-service/tests/test_service_auth.py` | Platform | Implemented | Rotate to key-managed secret lifecycle |
| AC-02 | Admin auth for CDSS | 164.312(a), 164.312(d) | AC / IA | Owner JWT required for CDSS admin APIs; per-endpoint scope checks with unit-tested scope decision logic | `services/cdss-service/main.py`, `services/cdss-service/service_auth.py`, `services/cdss-service/tests/test_service_auth.py` | CDSS Backend | Implemented | Keep strict scopes enabled in non-dev |
| AC-03 | Tenant isolation | 164.308(a)(4), 164.312(a) | AC / SC | Tenant-scoped cache keys, temp paths, object keys, tenant context propagation | `services/cdss-service/main.py`, `services/cdss-service/ai_models/rag_engine.py` | Platform + Backend | Partial | Add dedicated leakage test suite in CI (cross-tenant fuzzing) |
| SI-01 | PHI minimization for AI prompts | 164.308(a)(1)(ii)(A), 164.312(c) | SI / PL | Prompt redaction + outbound PHI blocking guard | `services/cdss-service/privacy_guard.py`, `services/cdss-service/ai_models/llm_provider.py` | CDSS Backend | Partial | Add policy exception workflow + structured violation audit records |
| SC-01 | Outbound egress restriction | 164.312(e) Transmission Security | SC | Strict outbound allowlist for LLM/terminology calls with deny-path tests | `services/cdss-service/outbound_guard.py`, `services/cdss-service/tests/test_outbound_guard.py` | Platform | Implemented | Add DNS/IP drift monitoring and alerting |
| SC-02 | Encryption at rest (CDSS admin/settings) | 164.312(a)(2)(iv), 164.312(c) | SC | Envelope encryption wrapper for settings/audit/job payloads, key metadata table, initial rotation runbook, encryption tests | `services/cdss-service/envelope_crypto.py`, `services/cdss-service/settings_provider.py`, `services/cdss-service/tests/test_envelope_crypto.py`, `docs/compliance/cdss-encryption-key-rotation-runbook.md` | Platform + Security | Partial | Move from local key to managed KMS provider and execute first production rotation |
| AU-01 | Audit logging for CDSS admin activity | 164.312(b) Audit Controls | AU | Admin audit logs + job/action history | `services/cdss-service/settings_provider.py`, `database/schemas/tenant.sql` | CDSS Backend | Partial | Add immutable export pipeline + retention/legal hold policy |
| AU-02 | Request traceability | 164.312(b), 164.312(c) | AU / IR | `X-Request-ID` propagated and emitted in error envelopes | `services/cdss-service/main.py`, `services/ehr-service/src/main.ts` | Platform | Implemented | Add correlation query runbook and dashboard links |
| SI-02 | AI timeout/retry + safe fallback | 164.308(a)(1), 164.312(c) | SI / SC | Retry/circuit-breaker policy on EHR→CDSS calls and resilient fallback responses on CDSS intelligent endpoints | `services/ehr-service/src/services/cdss.service.ts`, `services/cdss-service/main.py` | Platform + CDSS Backend | Implemented | Validate fallback UX in release test pack |
| DE-01 | Nurse copilot KPI instrumentation | 164.308(a)(1)(ii)(D), 164.312(b) | DE / AU | Prometheus counters/histograms for recommendation volume, decisions, time-to-triage, documentation duration, and alert response latency | `services/ehr-service/src/services/metrics.service.ts`, `services/ehr-service/src/controllers/metrics.controller.ts` | Platform + Clinical Ops | Implemented | Add Grafana dashboard + SLO thresholds per tenant tier |
| CP-01 | Backup/restore controls | 164.308(a)(7) | CP | Existing backup guidance and restore workflows | `docs/deployment/backup-restore.md` | Platform Ops | Partial | Add quarterly restore drill evidence log |
| RA-01 | Risk analysis cadence | 164.308(a)(1)(ii)(A) | RA / PM | This initial register + hardening backlog | `docs/plans/ai-ehR-hardening-roadmap.md` | Security | Partial | Schedule quarterly review and sign-off records |

## Open P0 Compliance Gaps

1. Formalize key rotation process with evidence artifacts (change record, key ID timeline, rollback).
2. Add immutable audit export and retention policy evidence.
3. Add cross-tenant leakage test report as release gate.

## Evidence Checklist (Per Release)

- AuthN/AuthZ negative test results attached.
- Tenant isolation test run attached.
- Egress allowlist and PHI policy check logs attached.
- Key metadata snapshot (`cdss_encryption_keys`) attached.
- Incident and exception register updated.
