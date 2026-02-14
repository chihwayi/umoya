# CDSS Admin Program — Architecture & Sprint Plan

## Objectives

- Centralize AI/CDSS configuration and operations under the system owner in the admin portal (port 3011).
- Keep a single, shared CDSS (LLM + RAG) for all tenants while providing owner-only controls.
- Improve performance and perceived latency via shared caches and request coalescing.
- Establish repeatable quality gates for every sprint: DB provisioning, lint checks, unit tests, integration tests, data validation, and Git hygiene.

Related execution docs:

- `docs/plans/microservice-communication-hardening-sprint.md`
- `docs/plans/microservice-communication-task-board.md`

## Current Architecture (Summary)

- Web Admin (3011): React web-app that proxies to tenant-service (/api) and ehr-service (/api/terminology). No CDSS admin UI today.
- CDSS Service: Python FastAPI providing RAG + LLM features. ChromaDB persists at `./data/chroma_db`; Redis optional for caching.
- Master DB: Stores tenants and global metadata; services already use master DB for shared features (e.g., SNOMED).
- Auth: Web admin has JWT-based login; no dedicated “system owner” CDSS admin role yet.

## Proposed Design

- Source of Truth: Persist CDSS settings in master DB (system_settings JSONB) and allow cdss-service to load/override env defaults.
- Admin API (cdss-service):
  - `GET /admin/status`: LLM/model availability, Chroma docs, cache status.
  - `GET/PUT /admin/settings`: Read/write global settings.
  - `POST /admin/ingest`: Upload PDFs and trigger ingestion (async with status).
  - `POST /admin/reindex`: Wipe+rebuild collection; rebuild BM25.
  - `POST /admin/cache/flush`: Clear Redis namespaces.
  - `GET /admin/metrics`: Usage, latency percentiles, cache hit rate.
- Web Admin Module:
  - Route `/cdss` with tabs: Settings, Ingestion, Cache, Metrics.
  - Owner-only visibility and actions.
- Security:
  - Phase 1: OWNER_EMAILS allowlist in cdss-service.
  - Phase 2: Proper system_owner role from tenant-service JWT claims.
- Multi-Tenant Performance:
  - Single shared Chroma index and single LLM backend.
  - Redis caches: RAG result cache and LLM response cache (prompt+context hashing).
  - In-flight request dedup and optional pre-warming.

## Data Model Changes (Master DB)

- `system_settings`:
  - `key TEXT PRIMARY KEY`
  - `value JSONB NOT NULL`
  - `updated_at TIMESTAMPTZ DEFAULT NOW()`
- `cdss_admin_audit_logs`:
  - `id UUID PRIMARY KEY`
  - `actor TEXT NOT NULL` (email or user id)
  - `action TEXT NOT NULL`
  - `payload JSONB`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
- Optional: `cdss_jobs` for ingestion/reindex tracking (type, status, progress, metadata).

## Admin Settings (Examples)

- `llm_enabled`: boolean
- `llm_api_url`: string
- `llm_model_name`: string
- `rag_enabled`: boolean
- `cache_ttl_seconds`: number
- `cache_namespace`: string
- `allow_pdf_uploads`: boolean

## Caching & Latency

- RAG Cache: `rag:{md5(query)}` → result list with TTL.
- LLM Cache: `llm:{model}:{md5(prompt+context)}` → response with TTL.
- Coalescing: per-key semaphores to avoid duplicate upstream work.

## Web Admin Integration

- Reverse proxy `/api/cdss-admin` → `cdss-service:8000/admin`.
- UI components:
  - Settings form with validation and health checks.
  - Ingestion manager: upload, progress, doc counts, reindex.
  - Cache panel: TTL controls, flush buttons.
  - Metrics dashboard: volume, P50/P95 latency, cache hit ratio.

---

## Sprint Plan & Quality Gates

### Sprint 1 — Persistence & Admin API (Settings/Status)

- Tasks
  - Create master table `system_settings` and repository.
  - cdss-service SettingsProvider to load and update settings.
  - Implement `GET /admin/status`, `GET/PUT /admin/settings`.
  - Owner-only gating (Phase 1: OWNER_EMAILS allowlist).
- Quality Gates
  - [ ] System DB provisioning for new tables (migration script applied)
  - [ ] Lint errors check (backend)
  - [ ] System unit testing (settings load/update, status route)
  - [ ] System integration testing (e2e: write settings, service reflects)
  - [ ] Data validation (request payload schemas, safe defaults)
  - [ ] Git add, commit, and push

### Sprint 2 — Ingestion & Index Management

- Tasks
  - `POST /admin/ingest` with uploads, async job, status endpoint.
  - `POST /admin/reindex` and BM25 rebuild.
  - RAG document counts, last ingestion stats.
- Quality Gates
  - [ ] System DB provisioning (cdss_jobs if used)
  - [ ] Lint errors check (backend)
  - [ ] System unit testing (job orchestration, status)
  - [ ] System integration testing (upload→ingest→query path)
  - [ ] Data validation (file types, size limits)
  - [ ] Git add, commit, and push

### Sprint 3 — Web Admin UI

- Tasks
  - Add `/cdss` admin route with tabs (Settings, Ingestion, Cache, Metrics).
  - Proxy `/api/cdss-admin` and secure owner-only visibility.
  - Forms and actions wired to admin API with optimistic UI and toasts.
- Quality Gates
  - [ ] Lint errors check (frontend)
  - [ ] System unit testing (components/services)
  - [ ] System integration testing (Cypress or React Testing Library flows)
  - [ ] Data validation (client-side schemas)
  - [ ] Git add, commit, and push

### Sprint 4 — Caching & Performance

- Tasks
  - Implement Redis namespaces and TTL controls for RAG and LLM caches.
  - In-flight request deduplication.
  - Warm-up tasks after reindex/model change.
- Quality Gates
  - [ ] Lint errors check (backend)
  - [ ] System unit testing (cache keys, TTLs, dedup)
  - [ ] System integration testing (load tests, cache hit verification)
  - [ ] Data validation (safe cache serialization)
  - [ ] Git add, commit, and push

### Sprint 5 — AuthZ Hardening & Audit

- Tasks
  - Introduce `system_owner` role in master DB and issue role-bearing JWT.
  - Replace allowlist with RBAC; enforce in cdss-service.
  - Implement audit logging (`cdss_admin_audit_logs`).
- Quality Gates
  - [ ] System DB provisioning for new tables
  - [ ] Lint errors check (backend, tenant-service token logic)
  - [ ] System unit testing (RBAC, audit write)
  - [ ] System integration testing (owner vs non-owner access paths)
  - [ ] Data validation (log payloads)
  - [ ] Git add, commit, and push

### Sprint 6 — Observability & Alerts

- Tasks
  - Metrics endpoints/logs, Prometheus-friendly output.
  - UI charts for latency and cache hits.
  - Alerts for LLM/Chroma failures.
- Quality Gates
  - [ ] Lint errors check (backend, frontend)
  - [ ] System unit testing (metric formatters)
  - [ ] System integration testing (metrics scrape, dashboard)
  - [ ] Data validation (bounds, empty states)
  - [ ] Git add, commit, and push

---

## Rollout & Backwards Compatibility

- cdss-service continues to use env defaults when `system_settings` not present or keys missing.
- Web Admin hides the CDSS section unless user is system owner (or whitelisted in Phase 1).
- No tenant database changes; all CDSS controls are global.

## Risks & Mitigations

- Misconfiguration of LLM endpoints → Health check before apply; rollback on failure.
- Large PDF ingestion latency → Async jobs, status polling, file size/type validation.
- Cache staleness → TTLs, manual flush option, audit log for clears.

## Baseline Completed (Pre-Plan)

- [x] Enforce strict LLM model via env only; default to `llama3.1:latest`.
- [x] RAG retrieval robustness (empty filter fix); ingestion fallback via pypdf.
- [x] Git hygiene for Chroma artifacts and local PDFs.

> The above establishes a stable base for the new owner-focused CDSS Admin module.
