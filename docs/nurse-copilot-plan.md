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
- [x] Define audit logging fields (`@codex 2026-02-16`)
  - [x] userId, tenantId
  - [x] action type (triage/vitals/notes)
  - [x] model name/version
  - [x] prompt context hash
  - [x] recommendation summary
  - [x] user action (accept/modify/reject)
  - [x] timestamp

### 1.2 Remove PHI Debug Logging

- [x] Remove PHI-adjacent console logs in NursePatientSummary.tsx (`local changes pending commit`)
- [x] Remove PHI-adjacent console logs in NurseDashboard.tsx (`local changes pending commit`)
- [x] Confirm no patient identifiers appear in browser logs (`@codex 2026-03-04`)
  - [x] Added automated guard preventing `console.*` logging in tracked nurse-facing UI files

### 1.3 Reduce Over‑Fetch in Nurse Patient Summary

- [x] Add backend endpoint for appointments by patient (`@codex 2026-02-16`)
- [x] Replace broad appointment fetch with patient‑scoped fetch (`@codex 2026-02-16`)
- [x] Verify only the selected patient’s appointments are returned (`@codex 2026-02-16`)

### 1.4 Server‑Scoped Alerts and Tasks

- [x] Replace localStorage alert acknowledgements with server persistence (`@codex 2026-02-16`)
- [x] Replace localStorage task state with server persistence (`@codex 2026-02-16`)
- [x] Ensure tenant + user scoping for acknowledgements and task history (`@codex 2026-02-16`)

### 1.5 PHI‑Minimized AI Inputs

- [x] Define allowed fields per AI/CDSS action (triage/vitals/notes) (`@codex 2026-02-16`)
- [x] Exclude direct identifiers unless strictly required (`@codex 2026-02-16`)
- [x] Document allowlist for prompt fields (`@codex 2026-02-16`)

### 1.6 Reliability + Governance Baseline

- [x] Define fail-safe behavior when CDSS/AI is unavailable (nurse workflow must continue) (`@codex 2026-02-16`)
- [x] Add timeout and retry policy for AI calls with safe fallback messaging (`@codex 2026-02-16`)
- [x] Add recommendation transparency fields in responses (`@codex 2026-02-16`)
  - [x] why this recommendation
  - [x] confidence/uncertainty indicator
  - [x] source/provenance references
- [x] Define model versioning policy (active version, rollback version, release timestamp) (`@codex 2026-02-16`)
- [x] Define minimum retention and access policy for AI/CDSS audit logs (`@codex 2026-02-16`)

---

## Sprint 2 — Triage & Vitals Co‑pilot

### 2.1 AI Triage Copilot (Queue + Triage Screen)

- [x] Define triage input schema (`@codex 2026-02-16`)
  - [x] vitals, age, gender
  - [x] chief complaint
  - [x] key comorbidity flags
- [x] Define triage output schema (`@codex 2026-02-16`)
  - [x] riskLevel: low/medium/high
  - [x] suggestedTriageLevel
  - [x] reasons[]
  - [x] missingData[] (`@codex 2026-02-16`)
- [x] Add queue risk badge per patient (`@codex 2026-02-16`)
- [x] Add triage suggestion panel with “Apply suggestion” button (`@codex 2026-02-16`)
- [x] Require nurse confirmation before saving (`@codex 2026-02-16`)

### 2.2 Vitals Interpretation Panel

- [x] Define interpretation rules or model prompt (`@codex 2026-02-16`)
- [x] Display interpretation after vitals entry (`@codex 2026-02-16`)
- [x] Label as AI suggestion, not automatic decision (`@codex 2026-02-16`)

### 2.3 Vitals Trend Summary

- [x] Define trend summary logic for last N vitals (`@codex 2026-02-16`)
- [x] Add summary section to Vitals History modal (`@codex 2026-02-16`)
- [x] Ensure summary references real stored values (`@codex 2026-02-16`)

### 2.4 Clinical Safety Guardrails

- [x] Define high-risk trigger thresholds that require escalation wording (`@codex 2026-02-16`)
- [x] Add explicit escalation suggestions for high-risk outputs (`@codex 2026-02-16`)
- [x] Ensure non-diagnostic labeling is present in triage/vitals AI UI (`@codex 2026-02-16`)
- [x] Add nurse override capture (accept/modify/reject + optional reason) (`@codex 2026-02-16`)

---

## Sprint 3 — Smart Charting, Tasks & Handoff Co‑pilot

### 3.1 Smart Charting for Nursing Notes

- [x] Define structured input sources for note drafts (`@codex 2026-02-16`)
- [x] Implement /cdss/notes/draft endpoint (`@codex 2026-02-16`)
- [x] Add “Generate draft note” button in Nursing Notes UI (`@codex 2026-02-16`)
- [x] Show provenance for each drafted section (`@codex 2026-02-16`)
- [x] Require nurse review before save (`@codex 2026-02-16`)

### 3.2 Next‑Best‑Action Task Feed

- [x] Define CDSS task generation rules (`@codex 2026-02-16`)
- [x] Store tasks server‑side with priority and reason (`@codex 2026-02-16`)
- [x] Show Suggested vs Manual tasks (`@codex 2026-02-16`)
- [x] Allow accept/dismiss with audit trail (`@codex 2026-02-16`)

### 3.3 Patient Safety Alerts 2.0

- [x] Rank alerts by urgency + confidence + recency (`@codex 2026-02-16`)
- [x] Suppress repeated low‑value alerts (`@codex 2026-02-16`)
- [x] Display “why shown / why now” explanation (`@codex 2026-02-16`)

### 3.4 Nurse Handoff Summary Generator

- [x] Define summary input (today’s vitals, notes, tasks, alerts) (`@codex 2026-02-16`)
- [x] Implement /cdss/handoff/summary endpoint (`@codex 2026-02-16`)
- [x] Add “Generate Handoff Summary” action (`@codex 2026-02-16`)
- [x] Require nurse review before finalizing (`@codex 2026-02-16`)

### 3.5 Operations + Quality Measurement

- [x] Define KPI dashboard for nurse copilot outcomes (`@codex 2026-02-16`)
  - [x] time-to-triage
  - [x] documentation time per encounter
  - [x] alert acceptance/override rate
  - [x] high-risk alert response time
- [x] Add model quality monitoring by tenant and global aggregate (`@codex 2026-02-16`)
- [x] Add drift/degradation checks with rollback playbook (`@codex 2026-02-16`)
- [x] Add quarterly safety review cadence for AI recommendation quality (`@codex 2026-02-16`)

---

## HIPAA‑Safe Implementation Rules (Must‑Have)

- [x] No direct browser → cdss-service calls for clinical decisions (`@codex 2026-02-16`)
- [x] Remove PHI logs in frontend production paths (`@codex 2026-02-16`)
- [x] Tenant/user/session‑scoped server persistence for acknowledgements/tasks (`@codex 2026-02-16`)
- [x] Human‑in‑the‑loop for all AI recommendations (`@codex 2026-02-16`)
- [x] Full audit trail (model version, context hash, recommendation, action, timestamp) (`@codex 2026-02-16`)
- [x] PHI‑minimized prompts and allowlist‑only egress (`@codex 2026-02-16`)
- [x] Recommendation transparency in UI (why, confidence, provenance) (`@codex 2026-02-16`)
- [x] Safe fallback when AI/CDSS is unavailable (no workflow blockage) (`@codex 2026-02-16`)

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
- [x] Wire strict tenant/role enforcement and audit metadata (`@codex 2026-02-16`)
  - [x] `services/ehr-service/src/guards/roles.guard.ts`
  - [x] `services/ehr-service/src/interceptors/hipaa-audit.interceptor.ts`
  - [x] `services/ehr-service/src/services/hipaa-audit.service.ts`

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
- [x] Integrate handoff summary generation/review UI (`@codex 2026-02-16`)
  - [x] `ehr-frontend/src/pages/NurseDashboard.tsx`
  - [x] `services/ehr-service/src/controllers/nurse-worklist.controller.ts`
  - [x] `services/ehr-service/src/services/nurse-worklist.service.ts`

### Wave 3 — Server-Scoped Tasks & Alerts (Replace localStorage)

- [x] Add persistent nurse alert acknowledgement store (`@codex 2026-03-04`)
  - [x] `services/ehr-service/src/entities/*` (new nurse alert ack entity)
  - [x] `services/ehr-service/src/services/*` (new nurse alert/task service)
  - [x] `services/ehr-service/src/controllers/*` (new nurse alert/task controller)
- [x] Add persistent nurse task store with acceptance/override actions (`@codex 2026-03-04`)
  - [x] `services/ehr-service/src/entities/*` (new nurse task entity)
  - [x] `services/ehr-service/src/services/*` (new nurse task service)
  - [x] `services/ehr-service/src/controllers/*` (new nurse task controller)
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

- [x] Implement copilot endpoint hardening in CDSS service (`@codex 2026-02-16`)
  - [x] `services/cdss-service/main.py`
  - [x] `services/cdss-service/ai_models/llm_provider.py`
  - [x] `services/cdss-service/ai_models/rag_engine.py`
- [x] Enforce PHI-minimized input allowlists and outbound egress policy (`@codex 2026-02-16`)
  - [x] `services/cdss-service/settings_provider.py`
  - [x] `services/cdss-service/outbound_guard.py`
  - [x] `services/cdss-service/terminology/terminology_service.py`
  - [x] `services/cdss-service/service_auth.py`
- [x] Add transparent recommendation payload fields (`@codex 2026-02-16`)
  - [x] `why_recommended`
  - [x] `confidence`
  - [x] `provenance`

### Wave 6 — Database + Provisioning (Critical Requirement)

- [x] Add schema changes for nurse copilot persistence (`@codex 2026-02-16`)
  - [x] `database/migrations/034-nurse-copilot-persistence.sql`
  - [x] `services/ehr-service/src/services/nurse-worklist.service.ts` (reads/writes dedicated persistence tables with fallback)
- [x] Add tenant provisioning statements for all new tables/columns/indexes (`@codex 2026-02-16`)
  - [x] `services/tenant-service/src/services/database-provisioning.service.ts` (`sprint46_nurse_copilot` bundle)
- [x] If needed, add central tenant metadata updates (`@codex 2026-02-16`)
  - [x] Not required for this wave (`database/schemas/tenant.sql` unchanged; tenant DB schema handled via migration + bundle)
- [x] Add/refresh provisioning run script for existing tenants (`@codex 2026-02-16`)
  - [x] `scripts/provision-sprint46-nurse-copilot.ts`
  - [x] `docs/deployment/database-provisioning.md`

### Wave 7 — Reliability, Metrics, and Safety Ops

- [x] Add AI timeout/retry + safe fallback behavior (`@codex 2026-02-16`)
  - [x] `services/ehr-service/src/services/cdss.service.ts`
  - [x] `services/cdss-service/main.py`
- [x] Add KPI capture for nurse copilot outcomes (`@codex 2026-02-16`)
  - [x] `services/ehr-service/src/services/metrics.service.ts`
  - [x] `services/ehr-service/src/controllers/metrics.controller.ts`
- [x] Add monitoring and runbook updates (`@codex 2026-02-16`)
  - [x] `docs/compliance/hipaa-nist-control-register.md`
  - [x] `docs/deployment/monitoring.md`

### Wave 8 — Test & Release Gates (Before Go-Live)

- [x] Unit tests for new EHR/CDSS routes and services (`@codex 2026-02-16`)
  - [x] `services/ehr-service/src/services/metrics.service.spec.ts`
  - [x] `services/ehr-service/src/controllers/metrics.controller.spec.ts`
  - [x] `services/ehr-service/src/services/cdss.service.nurse-metrics.spec.ts`
  - [x] `services/ehr-service/src/services/cdss-contract.spec.ts`
  - [x] `services/ehr-service/src/services/nurse-worklist.service.spec.ts`
  - [x] `services/ehr-service/src/services/nurse-frontend-logging.spec.ts`
  - [x] `services/cdss-service/tests/test_copilot_resilience.py`
- [x] UI integration tests for nurse copilot flows (`@codex 2026-02-16`)
  - [x] `ehr-frontend/src/components/TriageQueue.test.tsx`
  - [x] `ehr-frontend/src/components/TaskManagement.test.tsx`
  - [x] `ehr-frontend/src/components/PatientSafetyAlerts.test.tsx`
- [x] Contract tests between EHR-service and CDSS-service (`@codex 2026-02-16`)
  - [x] `services/ehr-service/src/services/cdss-contract.spec.ts`
- [~] Final pre-release checklist sign-off (`@codex 2026-02-16`)
  - [x] Engineering evidence package documented (`docs/release/nurse-copilot-pre-release-signoff.md`)
  - [~] Security review complete
  - [~] HIPAA audit logging validated
  - [~] Tenant provisioning validated for new and existing tenants
  Remaining scope: named reviewer approvals and go-live decision signoff.
