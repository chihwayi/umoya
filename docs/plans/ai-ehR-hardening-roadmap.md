# AI EHR Hardening Roadmap (Implementation Backlog)

## Objective

Build MediCore into a high-intelligence, high-safety, multi-tenant EHR platform that can scale to 100s of tenants with strong security, clinical safety controls, and compliance-ready evidence.

## Guardrails

- HIPAA has no official HHS certification; target must be demonstrable compliance, auditability, and continuous risk management.
- AI outputs are clinical decision support, not autonomous final diagnosis.
- Tenant isolation is a non-negotiable platform invariant.
- No PHI should leave approved boundaries without policy controls, contracts, and monitoring.

## Backlog Structure

Priority legend:

- `P0` = immediate platform risk / must-do foundation
- `P1` = production readiness and scale
- `P2` = optimization and strategic differentiation

Status legend:

- `Todo` | `In Progress` | `Blocked` | `Done`

---

## Epic 1: Identity, Trust Boundaries, and Access Control

### E1-B1 (`P0`, `Todo`) Remove header-based owner bypass in CDSS admin

- Owner: Backend (CDSS)
- Effort: 2-3 days
- Scope:
  - Remove `X-Owner-Email` trust fallback from `services/cdss-service/main.py`.
  - Require JWT-based owner claims only.
  - Add explicit 401/403 paths with request ID.
- Acceptance criteria:
  - Admin routes deny requests with only `X-Owner-Email`.
  - Owner access works only with valid signed JWT claim.
  - Regression tests cover pass/fail auth cases.

### E1-B2 (`P0`, `Todo`) Service-to-service auth hardening

- Owner: Platform + Backend
- Effort: 1-2 weeks
- Scope:
  - Add service identity (mTLS or signed service JWT) for EHR -> CDSS calls.
  - Enforce audience/issuer checks.
  - Remove implicit trust on internal network.
- Acceptance criteria:
  - CDSS rejects unauthenticated service callers.
  - Rotatable service credentials in env/secret manager.
  - Negative tests for invalid issuer/audience/signature.

### E1-B3 (`P0`, `Todo`) Fine-grained authorization model

- Owner: Backend (EHR + CDSS)
- Effort: 1 week
- Scope:
  - Introduce scoped permissions (admin settings, ingestion, metrics, audit).
  - Enforce role and tenant claims on every sensitive endpoint.
- Acceptance criteria:
  - Unauthorized roles receive deterministic 403.
  - Audit logs include actor, tenant, action, request ID.

---

## Epic 2: Tenant Isolation and Data Protection

### E2-B1 (`P0`, `Todo`) Tenant-scoped cache and storage isolation

- Owner: Platform + Backend
- Effort: 1 week
- Scope:
  - Namespace Redis keys by tenant for CDSS/RAG/LLM caches.
  - Tenant-scoped object keys and temp file paths.
  - Ensure no cross-tenant cache reuse.
- Acceptance criteria:
  - Cross-tenant cache reads are impossible by key design.
  - Load tests prove isolation under concurrent tenants.

### E2-B2 (`P0`, `Todo`) Encryption model upgrade (at-rest + in-transit + key rotation)

- Owner: Platform + Security
- Effort: 1-2 weeks
- Scope:
  - Envelope encryption using KMS for sensitive data classes.
  - Key rotation runbook and rotation automation.
  - TLS everywhere for inter-service and external endpoints.
- Acceptance criteria:
  - Key IDs and rotation timestamps are auditable.
  - Secrets are no longer long-lived static defaults in prod.

### E2-B3 (`P1`, `Todo`) Row-level and query-level tenant policy tests

- Owner: Backend + QA
- Effort: 1 week
- Scope:
  - Add tenant boundary tests for every cross-tenant risk surface.
  - Add fuzz tests for tenant header/token mismatch.
- Acceptance criteria:
  - CI fails on any tenant leakage path.
  - Security tests included in release gate.

---

## Epic 3: AI Safety Controls and Clinical Guardrails

### E3-B1 (`P0`, `Todo`) PHI minimization gateway for AI calls

- Owner: Backend (CDSS) + Security
- Effort: 1 week
- Scope:
  - Pre-processor for prompt redaction/pseudonymization when clinically safe.
  - Policy engine to block disallowed outbound content.
  - Structured telemetry with redaction.
- Acceptance criteria:
  - No raw PHI appears in LLM debug logs.
  - Policy violations are blocked and audited.

### E3-B2 (`P1`, `Todo`) Citation-grounded response enforcement

- Owner: AI/ML + Backend
- Effort: 1 week
- Scope:
  - Enforce guideline citation presence for high-impact recommendations.
  - Add abstain behavior when retrieval confidence is low.
  - Add contradiction checks between answer and citations.
- Acceptance criteria:
  - Safety layer rejects unsupported confident recommendations.
  - API responses include confidence + evidence metadata.

### E3-B3 (`P1`, `Todo`) Model registry and release governance

- Owner: AI/ML Platform
- Effort: 2 weeks
- Scope:
  - Versioned model registry (LLM prompt template, reranker, classifier versions).
  - Canary rollout and rollback strategy.
  - Model-level audit trail.
- Acceptance criteria:
  - Every prediction is traceable to model/prompt/version hash.
  - Rollback can be executed within 15 minutes.

### E3-B4 (`P1`, `Todo`) Human-in-the-loop for high-risk actions

- Owner: Product + Clinical Safety + Backend
- Effort: 1-2 weeks
- Scope:
  - Mandatory confirmation workflows for high-risk medication, diagnosis, triage alerts.
  - Override reason capture and review queue.
- Acceptance criteria:
  - High-risk actions cannot be auto-finalized without human acknowledgment.
  - Override analytics available in dashboard.

---

## Epic 4: Scale, Reliability, and Cost Control (100s of Tenants)

### E4-B1 (`P0`, `Todo`) Async inference and job orchestration

- Owner: Platform + Backend
- Effort: 1-2 weeks
- Scope:
  - Move long-running tasks (ingestion, transcription, vision, heavy inference) to queue workers.
  - Add idempotent job state and retries with dead-letter handling.
- Acceptance criteria:
  - No long blocking HTTP requests for heavy workloads.
  - Job success/failure and retries observable per tenant.

### E4-B2 (`P1`, `Todo`) Per-tenant quotas, fairness, and rate limits

- Owner: Platform + Backend
- Effort: 1 week
- Scope:
  - Per-tenant request quotas and burst controls.
  - Priority classes (clinical real-time vs background jobs).
  - Backpressure and graceful degradation.
- Acceptance criteria:
  - One noisy tenant cannot starve others.
  - SLOs hold under multi-tenant stress test.

### E4-B3 (`P1`, `Todo`) SLO/SLI platform and incident readiness

- Owner: SRE + Platform
- Effort: 1 week
- Scope:
  - Define SLOs for critical paths (medication safety, diagnosis assist, auth, tenant routing).
  - Build dashboards and alerts for error budget burn.
  - Incident playbooks and drill schedule.
- Acceptance criteria:
  - Pager alerts fire on sustained SLO burn.
  - On-call runbooks validated in game-day drills.

---

## Epic 5: Terminology, Interoperability, and Data Quality

### E5-B1 (`P1`, `Todo`) Terminology as source-of-truth service

- Owner: Backend (EHR Terminology) + CDSS
- Effort: 1 week
- Scope:
  - Prefer centralized SNOMED/ICD mapping service over static mapper fallbacks.
  - Add mapping confidence and provenance in responses.
- Acceptance criteria:
  - CDSS responses include terminology source and version metadata.
  - Drift between local static map and master data is monitored.

### E5-B2 (`P2`, `Todo`) FHIR provenance and CDS traceability

- Owner: Interop + Backend
- Effort: 2 weeks
- Scope:
  - Add provenance fields for AI-assisted recommendations.
  - Structure outputs for interoperability export where applicable.
- Acceptance criteria:
  - Recommendation records preserve who/what/when/how-generated lineage.

---

## Epic 6: Compliance Operating System

### E6-B1 (`P0`, `Todo`) Security risk analysis and control mapping

- Owner: Security + Compliance
- Effort: 1 week initial, then recurring
- Scope:
  - Risk analysis mapped to HIPAA Security Rule and NIST controls.
  - Control register with owners and review cadence.
- Acceptance criteria:
  - Signed risk register with remediation deadlines.
  - Quarterly control review evidence stored.

### E6-B2 (`P1`, `Todo`) Audit evidence pipeline

- Owner: Security + Platform
- Effort: 1 week
- Scope:
  - Centralized immutable audit export for security and AI decisions.
  - Retention and legal hold policy.
- Acceptance criteria:
  - Evidence bundle can be generated on demand for an audit window.

### E6-B3 (`P1`, `Todo`) Third-party and BAA governance

- Owner: Legal + Security + Platform
- Effort: 3-5 days
- Scope:
  - Vendor inventory for all PHI processors.
  - BAA status tracking and renewal alarms.
- Acceptance criteria:
  - No production PHI flow through uncontracted vendors.

---

## 90-Day Execution Plan

### Sprint Group A (Weeks 1-3): Foundation

- E1-B1, E1-B2, E2-B1, E3-B1, E6-B1

### Sprint Group B (Weeks 4-6): Safe Intelligence

- E3-B2, E3-B4, E5-B1, E4-B1

### Sprint Group C (Weeks 7-9): Multi-tenant Scale

- E4-B2, E4-B3, E2-B3, E1-B3

### Sprint Group D (Weeks 10-12): Audit Readiness

- E3-B3, E6-B2, E6-B3, E5-B2

---

## Release Gates (Definition of Done for “AI-Safe Multi-Tenant EHR”)

- AuthN/AuthZ:
  - No admin/service route accepts trust-by-header only.
- Tenant isolation:
  - All caches, queues, storage, and logs are tenant-scoped and tested.
- AI safety:
  - Unsupported recommendations are blocked or downgraded with abstain behavior.
- Reliability:
  - Critical endpoint SLOs defined, monitored, and enforced with incident playbooks.
- Compliance:
  - Risk analysis, control evidence, and vendor governance artifacts are current.

---

## Immediate Next 10 Tasks (Starter Queue)

1. Remove `X-Owner-Email` fallback from CDSS admin auth.
2. Add service identity verification for EHR -> CDSS calls.
3. Add tenant namespace strategy to CDSS Redis keys.
4. Add prompt/redaction middleware before LLM provider calls.
5. Disable raw AI prompt/response logging in production mode.
6. Add citation-required policy for high-risk recommendation responses.
7. Add abstain-on-low-confidence behavior in intelligent diagnosis flow.
8. Move ingestion/transcription/image analysis to worker queue.
9. Add per-tenant quotas and rate limiting for AI-heavy endpoints.
10. Create control register doc + map current controls to HIPAA/NIST.
