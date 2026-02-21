# CDSS/AI Full Hardening Sprint Execution Plan

Date created: February 21, 2026  
Owner: Platform + EHR + CDSS + Frontend + Security + Clinical Safety

## Objective

Close identified security and architecture gaps, then raise CDSS/AI clinical intelligence quality to production-grade with measurable safety, reliability, and relevance.

## Scope

- CDSS service (`services/cdss-service`)
- EHR proxy and hooks (`services/ehr-service`)
- EHR frontend integration (`ehr-frontend`)
- Voice/transcription path
- Ingestion/RAG quality pipeline
- Validation and release gating

## Working Rules

- No direct browser-to-CDSS clinical calls for production workflows.
- All CDSS calls routed via EHR with tenant, auth, audit, and policy controls.
- AI outputs are assistive; high-risk paths require human confirmation.
- No PHI/plain credentials in logs.
- Tenant isolation is mandatory for storage, cache, queue, and request context.

## Sprint Roadmap

### Sprint 0 (Emergency P0) - Security and Boundary Closure
Target window: February 21-25, 2026

1. Remove direct frontend CDSS calls and enforce EHR proxy usage.
   - Files:
     - `ehr-frontend/src/services/api.ts`
     - caller pages/components using `cdssApi.*`
   - Acceptance:
     - No browser calls to `REACT_APP_CDSS_API_URL` for clinical workflows.
     - All CDSS requests include EHR auth + `X-Tenant-ID`.

2. Fix hardcoded tenant ID in document upload path.
   - Files:
     - `services/ehr-service/src/services/document.service.ts`
   - Acceptance:
     - Storage keys are generated from request tenant context, not constants.
     - Cross-tenant storage leakage test added and passing.

3. Fix voice endpoint contract mismatch and enforce single API contract.
   - Files:
     - `ehr-frontend/src/services/transcription.service.ts`
     - `services/ehr-service/src/controllers/transcription.controller.ts`
     - `services/ehr-service/src/services/transcription.service.ts`
   - Acceptance:
     - Frontend route and backend route match (`/api/transcription/whisper` or approved replacement).
     - Multipart field names aligned.
     - Tenant and auth headers forwarded to CDSS/local whisper target.

4. Strip sensitive logs.
   - Files:
     - `services/ehr-service/src/strategies/jwt.strategy.ts`
     - `services/ehr-service/src/guards/jwt-auth.guard.ts`
     - `services/ehr-service/src/services/users.service.ts`
     - `services/ehr-service/src/services/cdss.service.ts`
   - Acceptance:
     - No JWT payload logging, no temporary password logging, no patient payload dumps.
     - Structured redacted logs only.

### Sprint 1 (P0/P1) - CDSS Service Auth, Tenant, and Policy Hardening
Target window: February 26-March 4, 2026

1. Tighten CDSS endpoint auth and tenancy invariants.
   - Files:
     - `services/cdss-service/main.py`
   - Tasks:
     - Require valid tenant for non-public inference endpoints.
     - Review/limit auth exemptions.
     - Remove header-derived owner identity for job ownership metadata.
   - Acceptance:
     - Requests without tenant context fail closed where required.
     - Service auth exemptions documented and minimal.

2. Add explicit service JWT scopes from EHR and validate in CDSS.
   - Files:
     - `services/ehr-service/src/services/cdss.service.ts`
     - `services/cdss-service/main.py`
   - Acceptance:
     - EHR-issued service JWT carries route-appropriate scopes.
     - CDSS scope checks pass in strict mode.

3. Harden CORS behavior in CDSS.
   - Files:
     - `services/cdss-service/main.py`
   - Acceptance:
     - No wildcard origin in non-dev.
     - Explicit allowlist validation in startup checks.

### Sprint 2 (P1) - AI Model Path Correctness and Clinical Signal Quality
Target window: March 5-12, 2026

1. Fix MedBERT/ClinicalBERT initialization logic.
   - Files:
     - `services/cdss-service/ai_models/medbert_predictor.py`
     - `services/cdss-service/ai_models/clinicalbert_diagnostic.py`
   - Acceptance:
     - Full model load path is reachable when enabled.
     - Lightweight fallback remains available when models unavailable.

2. Fix ClinicalBERT entity extraction unreachable block.
   - Files:
     - `services/cdss-service/ai_models/clinicalbert_diagnostic.py`
   - Acceptance:
     - Symptom extraction populates expected entities for representative notes.
     - Unit tests added for lemma/path behavior.

3. Standardize AI traceability fields.
   - Files:
     - `services/cdss-service/diagnostic_assistant.py`
     - `services/cdss-service/ai_governance.py`
   - Acceptance:
     - Every intelligent response carries model trace + safety gate + abstain reason (if applicable).

### Sprint 3 (P1) - RAG/Ingestion Reality Alignment and Retrieval Accuracy
Target window: March 13-22, 2026

1. Restore full ingestion pipeline behavior and remove targeted partial ingest defaults.
   - Files:
     - `services/cdss-service/ingest_guidelines.py`
   - Acceptance:
     - Ingestion defaults process full configured corpus.
     - Partial/targeted mode is explicit and opt-in.

2. Re-enable context-aware metadata filters in guideline search.
   - Files:
     - `services/cdss-service/main.py`
   - Acceptance:
     - Gender/age/pregnancy context filters applied where relevant.
     - Retrieval tests confirm exclusion of clearly irrelevant population chunks.

3. Improve ingestion metadata quality and validation.
   - Files:
     - `services/cdss-service/ingest_guidelines.py`
     - verification scripts/tests
   - Acceptance:
     - Metadata coverage metrics reported after ingest.
     - Failed/unknown tagging rate tracked.

### Sprint 4 (P1) - Voice/Imaging Production Safety and Integration
Target window: March 23-30, 2026

1. Route imaging calls through EHR proxy (same trust boundary as CDSS copilot).
   - Files:
     - `ehr-frontend/src/services/api.ts`
     - `services/ehr-service` controller/service additions
   - Acceptance:
     - No direct browser call to CDSS image endpoint in production workflows.

2. Tighten upload security and file handling.
   - Files:
     - `services/cdss-service/main.py`
     - `services/ehr-service/src/controllers/transcription.controller.ts`
   - Tasks:
     - sanitize filenames on admin ingest and uploads
     - content-type and size validation
     - malware scan integration hook (if available)
   - Acceptance:
     - Path traversal and unsafe filename tests pass.

3. Voice clinical quality hardening.
   - Files:
     - `services/cdss-service/ai_models/voice_scribe.py`
     - EHR transcription response contracts
   - Acceptance:
     - SOAP schema validation.
     - Language handling validated for English/Shona/Ndebele sample set.

### Sprint 5 (P1/P2) - Evaluation, Monitoring, and Release Gates
Target window: March 31-April 10, 2026

1. Build offline clinical evaluation harness.
   - Metrics:
     - retrieval@k relevance
     - citation support rate
     - abstain correctness
     - unsafe overconfident output rate
   - Acceptance:
     - Baseline report generated and versioned.

2. Add test gates and drift checks.
   - Files:
     - CDSS tests
     - EHR contract/integration tests
     - QA E2E updates
   - Acceptance:
     - CI fails when contract drift, policy regressions, or safety regressions occur.

3. Observability and incident readiness.
   - Acceptance:
     - Dashboards for CDSS dependency latency/errors/retries by tenant.
     - Alerting for auth failures, high abstain spikes, and egress policy blocks.

## Cross-Cutting Deliverables

1. Documentation alignment
   - Update:
     - `docs/mobile-app-technical-brief.md`
     - `docs/cdss/api-reference.md`
     - `docs/cdss/setup.md`
   - Ensure endpoint names and flow reflect actual implementation.

2. Security baseline update
   - Update `docs/architecture/security.md` with enforced controls, not aspirational items.

3. Definition of Done per sprint
   - Code merged
   - Tests passing
   - Docs updated
   - Rollback notes added

## Execution Tracking Board

Status key:
- `[ ]` Not started
- `[~]` In progress
- `[x]` Completed
- `[!]` Blocked

### Sprint 0
- [x] Remove direct frontend CDSS calls
- [x] Fix hardcoded tenant in document upload
- [x] Fix voice endpoint contract mismatch
- [x] Remove sensitive logs

### Sprint 1
- [x] Tighten CDSS auth/tenant invariants
- [x] Add explicit service JWT scopes
- [x] Harden CDSS CORS behavior

### Sprint 2
- [x] Fix MedBERT init path
- [x] Fix ClinicalBERT init + extraction logic
- [x] Standardize AI traceability fields

### Sprint 3
- [x] Rework ingestion defaults/full corpus
- [x] Re-enable context-aware retrieval filters
- [x] Add metadata quality validation

### Sprint 4
- [x] Route imaging through EHR proxy
- [x] Harden upload and file handling
- [x] Voice SOAP quality gates

### Sprint 5
- [ ] Offline clinical eval harness
- [~] CI/CD safety + contract gates
- [ ] Monitoring + alert readiness

## Immediate Next 10 Tasks

1. Validate all frontend CDSS flows in QA (guideline search, risk, imaging) now that they route via EHR proxy.
2. Completed: Add/expand EHR proxy tests for `/cdss/analyze-image` and `/cdss/guidelines*` behavior (`services/ehr-service/src/services/cdss.service.proxy.spec.ts`).
3. Completed: Add/expand transcription integration tests for `/transcription/whisper` contract and forwarded headers (`services/ehr-service/src/controllers/transcription.controller.spec.ts`, `services/ehr-service/src/services/transcription.service.proxy.spec.ts`).
4. Completed: Add explicit service JWT scopes from EHR and validate strict scope checks in CDSS (`services/ehr-service` unit tests passing, `services/cdss-service` tests passing).
5. Completed: Harden CDSS CORS behavior (no wildcard in non-dev with startup validation and explicit allowlist parsing/tests).
6. Completed: Fix MedBERT and ClinicalBERT `_initialized` flow (full-model cache/load path reachable; lightweight fallback preserved).
7. Completed: Fix unreachable symptom extraction block in ClinicalBERT (lemma and phrase extraction now exercised by tests).
8. Completed: Re-enable context metadata filtering in guideline search (population-aware filters + exclusion tests for irrelevant chunks).
9. Completed: Restore ingestion defaults to full-corpus processing; targeted/partial ingest is now explicit opt-in via environment settings.
10. Completed: Add response-contract guard for voice transcription payload shape.
11. Completed: Add malware scan hook with fail-closed upload blocking for CDSS/EHR file ingestion paths.
12. Completed: Add SOAP schema + language normalization quality gates validated for English/Shona/Ndebele transcription flows.
13. Completed: Add CI gate enforcing frontend CDSS proxy-only boundary (no direct browser use of `REACT_APP_CDSS_API_URL`/absolute CDSS URLs in `ehr-frontend/src`).
