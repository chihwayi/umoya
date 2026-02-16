# Nurse Co‑pilot Development Plan (Non‑HIV, Non‑Maternity)

## Scope

- Target area: Nurse dashboard (exclude HIV and Maternity modules)
- Goal: Deliver a “Co‑pilot” EHR experience that simplifies nursing workflow while preserving data quality and HIPAA safety
- Approach: Three sprints with checklists; complete each checklist before moving to the next sprint

## Status Convention (Multi‑Agent)

- [ ] Not started
- [~] In progress (append owner/date, e.g., `@agent-name 2026-02-16`)
- [!] Blocked (append blocker note)
- [x] Completed (append PR/commit reference)
- Rule: Update only the boxes for items you actively worked on; do not rewrite unrelated statuses
- Rule: For partially complete items, keep `[~]` and add a one-line remaining-scope note under the item

---

## Sprint 1 — Safety & Foundation (HIPAA + Architecture)

### 1.1 CDSS Access Boundary

- [x] Identify all direct frontend → cdss-service calls in ehr-frontend (`local changes pending commit`)
- [x] Define ehr-service proxy endpoints for CDSS usage (`local changes pending commit`)
  - [x] POST /cdss/triage/analyze
  - [x] POST /cdss/vitals/interpret
  - [x] POST /cdss/notes/draft
- [x] Define role and tenant access rules for each endpoint (`local changes pending commit`)
- [~] Define audit logging fields (`@codex 2026-02-16`)
  - [x] userId, tenantId
  - [x] action type (triage/vitals/notes)
  - [x] model name/version
  - [x] prompt context hash
  - [x] recommendation summary
  - [x] user action (accept/modify/reject)
  - [x] timestamp
  Remaining scope: extend decision capture consistently to every remaining copilot entry point beyond nurse dashboard/summary/triage screens.

### 1.2 Remove PHI Debug Logging

- [x] Remove PHI-adjacent console logs in NursePatientSummary.tsx (`local changes pending commit`)
- [x] Remove PHI-adjacent console logs in NurseDashboard.tsx (`local changes pending commit`)
- [~] Confirm no patient identifiers appear in browser logs (`@codex 2026-02-16`)
  Remaining scope: run full nurse workflow manual pass in browser devtools and verify zero PHI log output.

### 1.3 Reduce Over‑Fetch in Nurse Patient Summary

- [x] Add backend endpoint for appointments by patient (`@codex 2026-02-16`)
- [x] Replace broad appointment fetch with patient‑scoped fetch (`@codex 2026-02-16`)
- [x] Verify only the selected patient’s appointments are returned (`@codex 2026-02-16`)

### 1.4 Server‑Scoped Alerts and Tasks

- [x] Replace localStorage alert acknowledgements with server persistence (`@codex 2026-02-16`)
- [x] Replace localStorage task state with server persistence (`@codex 2026-02-16`)
- [x] Ensure tenant + user scoping for acknowledgements and task history (`@codex 2026-02-16`)

### 1.5 PHI‑Minimized AI Inputs

- [ ] Define allowed fields per AI/CDSS action (triage/vitals/notes)
- [ ] Exclude direct identifiers unless strictly required
- [ ] Document allowlist for prompt fields

### 1.6 Reliability + Governance Baseline

- [ ] Define fail-safe behavior when CDSS/AI is unavailable (nurse workflow must continue)
- [ ] Add timeout and retry policy for AI calls with safe fallback messaging
- [ ] Add recommendation transparency fields in responses
  - [ ] why this recommendation
  - [ ] confidence/uncertainty indicator
  - [ ] source/provenance references
- [ ] Define model versioning policy (active version, rollback version, release timestamp)
- [ ] Define minimum retention and access policy for AI/CDSS audit logs

---

## Sprint 2 — Triage & Vitals Co‑pilot

### 2.1 AI Triage Copilot (Queue + Triage Screen)

- [ ] Define triage input schema
  - [ ] vitals, age, gender
  - [ ] chief complaint
  - [ ] key comorbidity flags
- [ ] Define triage output schema
  - [ ] riskLevel: low/medium/high
  - [ ] suggestedTriageLevel
  - [ ] reasons[]
  - [ ] missingData[]
- [ ] Add queue risk badge per patient
- [ ] Add triage suggestion panel with “Apply suggestion” button
- [ ] Require nurse confirmation before saving

### 2.2 Vitals Interpretation Panel

- [ ] Define interpretation rules or model prompt
- [ ] Display interpretation after vitals entry
- [ ] Label as AI suggestion, not automatic decision

### 2.3 Vitals Trend Summary

- [ ] Define trend summary logic for last N vitals
- [ ] Add summary section to Vitals History modal
- [ ] Ensure summary references real stored values

### 2.4 Clinical Safety Guardrails

- [ ] Define high-risk trigger thresholds that require escalation wording
- [ ] Add explicit escalation suggestions for high-risk outputs
- [ ] Ensure non-diagnostic labeling is present in triage/vitals AI UI
- [ ] Add nurse override capture (accept/modify/reject + optional reason)

---

## Sprint 3 — Smart Charting, Tasks & Handoff Co‑pilot

### 3.1 Smart Charting for Nursing Notes

- [ ] Define structured input sources for note drafts
- [ ] Implement /cdss/notes/draft endpoint
- [ ] Add “Generate draft note” button in Nursing Notes UI
- [ ] Show provenance for each drafted section
- [ ] Require nurse review before save

### 3.2 Next‑Best‑Action Task Feed

- [ ] Define CDSS task generation rules
- [ ] Store tasks server‑side with priority and reason
- [ ] Show Suggested vs Manual tasks
- [ ] Allow accept/dismiss with audit trail

### 3.3 Patient Safety Alerts 2.0

- [ ] Rank alerts by urgency + confidence + recency
- [ ] Suppress repeated low‑value alerts
- [ ] Display “why shown / why now” explanation

### 3.4 Nurse Handoff Summary Generator

- [ ] Define summary input (today’s vitals, notes, tasks, alerts)
- [ ] Implement /cdss/handoff/summary endpoint
- [ ] Add “Generate Handoff Summary” action
- [ ] Require nurse review before finalizing

### 3.5 Operations + Quality Measurement

- [ ] Define KPI dashboard for nurse copilot outcomes
  - [ ] time-to-triage
  - [ ] documentation time per encounter
  - [ ] alert acceptance/override rate
  - [ ] high-risk alert response time
- [ ] Add model quality monitoring by tenant and global aggregate
- [ ] Add drift/degradation checks with rollback playbook
- [ ] Add quarterly safety review cadence for AI recommendation quality

---

## HIPAA‑Safe Implementation Rules (Must‑Have)

- [ ] No direct browser → cdss-service calls for clinical decisions
- [ ] Remove PHI logs in frontend production paths
- [ ] Tenant/user/session‑scoped server persistence for acknowledgements/tasks
- [ ] Human‑in‑the‑loop for all AI recommendations
- [ ] Full audit trail (model version, context hash, recommendation, action, timestamp)
- [ ] PHI‑minimized prompts and allowlist‑only egress
- [ ] Recommendation transparency in UI (why, confidence, provenance)
- [ ] Safe fallback when AI/CDSS is unavailable (no workflow blockage)

---

## Sequenced Execution Checklist (File‑Level Targets)

### Wave 0 — Baseline Cleanup (Do First)

- [x] Remove PHI-adjacent frontend logs (`local changes pending commit`)
  - [x] `ehr-frontend/src/pages/NursePatientSummary.tsx`
  - [x] `ehr-frontend/src/pages/NurseDashboard.tsx`
- [x] Remove direct browser usage of `cdssApi` for nurse workflows (`local changes pending commit`)
  - [x] `ehr-frontend/src/services/api.ts`
  - [x] `ehr-frontend/src/pages/NurseDashboard.tsx`
- [x] Ensure all nurse CDSS calls use EHR API wrappers only (`local changes pending commit`)
  - [x] `ehr-frontend/src/services/api.ts` (`ehrApi` / `cdssEndpoints`)

### Wave 1 — Backend CDSS Boundary + New Endpoints

- [x] Add/extend nurse-focused CDSS proxy routes (`local changes pending commit`)
  - [x] `services/ehr-service/src/controllers/cdss.controller.ts`
  - [x] `services/ehr-service/src/services/cdss.service.ts`
- [x] Add new nurse copilot endpoint contracts (`local changes pending commit`)
  - [x] `POST /cdss/triage/analyze`
  - [x] `POST /cdss/vitals/interpret`
  - [x] `POST /cdss/notes/draft`
  - [x] `POST /cdss/handoff/summary`
- [~] Wire strict tenant/role enforcement and audit metadata (`@codex 2026-02-16`)
  - [x] `services/ehr-service/src/guards/roles.guard.ts`
  - [x] `services/ehr-service/src/interceptors/hipaa-audit.interceptor.ts`
  - [x] `services/ehr-service/src/services/hipaa-audit.service.ts`
  Remaining scope: align all remaining frontend payload contracts so copilot user-action fields are always present in requests.

### Wave 2 — Nurse UI Integration

- [x] Integrate triage copilot panel + apply-confirm flow (`@codex 2026-02-16`)
  - [x] `ehr-frontend/src/components/TriageQueue.tsx`
  - [x] `ehr-frontend/src/pages/NurseDashboard.tsx`
- [x] Integrate vitals interpretation and trend summaries (`@codex 2026-02-16`)
  - [x] `ehr-frontend/src/components/VitalsPanel.tsx`
  - [x] `ehr-frontend/src/pages/NursePatientSummary.tsx`
- [x] Integrate smart note draft + provenance rendering (`@codex 2026-02-16`)
  - [x] `ehr-frontend/src/pages/NurseDashboard.tsx`
  - [x] `ehr-frontend/src/components/NursingNotes.tsx`
- [~] Integrate handoff summary generation/review UI (`@codex 2026-02-16`)
  - [x] `ehr-frontend/src/pages/NurseDashboard.tsx`
  Remaining scope: add finalize/share workflow and explicit reviewer confirmation status.

### Wave 3 — Server-Scoped Tasks & Alerts (Replace localStorage)

- [~] Add persistent nurse alert acknowledgement store (`@codex 2026-02-16`)
  - [~] `services/ehr-service/src/entities/*` (new nurse alert ack entity)
  - [x] `services/ehr-service/src/services/*` (new nurse alert/task service)
  - [x] `services/ehr-service/src/controllers/*` (new nurse alert/task controller)
  Remaining scope: migrate from audit-log-backed state to dedicated entities if higher-volume querying requires it.
- [~] Add persistent nurse task store with acceptance/override actions (`@codex 2026-02-16`)
  - [~] `services/ehr-service/src/entities/*` (new nurse task entity)
  - [x] `services/ehr-service/src/services/*` (new nurse task service)
  - [x] `services/ehr-service/src/controllers/*` (new nurse task controller)
  Remaining scope: add explicit server-side override-reason semantics at task domain level (beyond audit event metadata).
- [x] Replace local client state with server APIs (`local changes pending commit`)
  - [x] `ehr-frontend/src/components/TaskManagement.tsx`
  - [x] `ehr-frontend/src/components/PatientSafetyAlerts.tsx`
  - [x] `ehr-frontend/src/pages/NurseDashboard.tsx`
  - [x] `ehr-frontend/src/services/api.ts`

### Wave 4 — Data Access Optimization

- [x] Add patient-scoped appointment endpoint (no broad fetch + client filter) (`@codex 2026-02-16`)
  - [x] `services/ehr-service/src/controllers/appointment.controller.ts` (reused existing `GET /appointments` + query DTO extension)
  - [x] `services/ehr-service/src/services/appointment.service.ts`
- [x] Update nurse summary screen to consume patient-scoped endpoint (`@codex 2026-02-16`)
  - [x] `ehr-frontend/src/pages/NursePatientSummary.tsx`
  - [x] `ehr-frontend/src/services/api.ts` (no new method required; existing `params` support reused)

### Wave 5 — CDSS Service Hardening for Nurse Copilot

- [ ] Implement copilot endpoints/functions in CDSS service
  - [ ] `services/cdss-service/main.py`
  - [ ] `services/cdss-service/ai_models/llm_provider.py`
  - [ ] `services/cdss-service/ai_models/rag_engine.py`
- [ ] Enforce PHI-minimized input allowlists and outbound egress policy
  - [ ] `services/cdss-service/settings_provider.py`
  - [ ] `services/cdss-service/service_auth.py`
- [ ] Add transparent recommendation payload fields
  - [ ] `why_recommended`
  - [ ] `confidence`
  - [ ] `provenance`

### Wave 6 — Database + Provisioning (Critical Requirement)

- [ ] Add schema changes for nurse copilot persistence
  - [ ] `database/migrations/*` (new migration files for nurse tasks/acknowledgements/audit expansion)
- [ ] Add tenant provisioning statements for all new tables/columns/indexes
  - [ ] `services/tenant-service/src/services/database-provisioning.service.ts`
- [ ] If needed, add central tenant metadata updates
  - [ ] `database/schemas/tenant.sql`
- [ ] Add/refresh provisioning run script for existing tenants
  - [ ] `scripts/provision-*.ts`
  - [ ] `docs/deployment/database-provisioning.md`

### Wave 7 — Reliability, Metrics, and Safety Ops

- [ ] Add AI timeout/retry + safe fallback behavior
  - [ ] `services/ehr-service/src/services/cdss.service.ts`
  - [ ] `services/cdss-service/main.py`
- [ ] Add KPI capture for nurse copilot outcomes
  - [ ] `services/ehr-service/src/services/metrics.service.ts`
  - [ ] `services/ehr-service/src/controllers/metrics.controller.ts`
- [ ] Add monitoring and runbook updates
  - [ ] `docs/compliance/hipaa-nist-control-register.md`
  - [ ] `docs/deployment/monitoring.md`

### Wave 8 — Test & Release Gates (Before Go-Live)

- [ ] Unit tests for new EHR/CDSS routes and services
  - [ ] `services/ehr-service/src/**/*.spec.ts`
  - [ ] `services/cdss-service/tests/*.py`
- [ ] UI integration tests for nurse copilot flows
  - [ ] `ehr-frontend/src/**/*.test.tsx`
- [ ] Contract tests between EHR-service and CDSS-service
  - [ ] `services/ehr-service/src/services/cdss-contract.spec.ts`
- [ ] Final pre-release checklist sign-off
  - [ ] Security review complete
  - [ ] HIPAA audit logging validated
  - [ ] Tenant provisioning validated for new and existing tenants
