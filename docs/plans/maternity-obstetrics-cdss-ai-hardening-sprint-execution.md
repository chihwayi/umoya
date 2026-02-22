# Maternity/Obstetrics CDSS-AI Hardening Sprint Execution Plan

Date created: February 22, 2026  
Owner: EHR + CDSS + Frontend + Clinical Safety + Data Platform

## Objective

Harden maternity/obstetric workflows from nurse capture to doctor action so they are:
- clinically safer (rule-enforced, not only advisory),
- non-duplicative (reuse same-day vitals and existing data),
- CDSS/AI-assisted with traceable decisions,
- synchronized between nurse and doctor queues in real time.

## Current-State Audit Summary

Reviewed code areas:
- `services/ehr-service/src/services/maternity.service.ts`
- `services/ehr-service/src/controllers/maternity.controller.ts`
- `ehr-frontend/src/components/MaternityEnrollmentDetailModal.tsx`
- `ehr-frontend/src/components/MaternityDashboard.tsx`
- `ehr-frontend/src/components/MaternityDoctorView.tsx`
- `ehr-frontend/src/pages/MaternityDoctorDashboard.tsx`
- `services/tenant-service/src/services/database-provisioning.service.ts`

Key gaps found:
1. Reporting query safety risk: date filters are string-interpolated in maternity reports (`getMaternityIndicators`, `getDeliverySummary`, `getANCCoverage`) instead of parameterized SQL.
2. Weak clinical guardrails: ANC/delivery/postnatal flows are mostly CRUD, with minimal blocker-grade rules (timing/sequence/range/contraindication checks are not centralized).
3. Duplicate data capture remains: ANC/postnatal vitals are manually re-entered even when same-day nurse vitals already exist.
4. CDSS boundary inconsistency: maternity UIs still call `cdssApi.searchGuidelines` directly from browser-facing components instead of EHR-proxy-only flow.
5. Doctor-nurse sync is UI-driven, not workflow-governed: no explicit escalation lifecycle table/state machine for maternity risk actions.
6. Data integrity gaps: no unique constraint for ANC visit number per enrollment; no provenance links from maternity visit vitals to source `vitals` record.
7. Inconsistent contract risk: frontend allows nullable delivery time while provisioning schema requires `delivery_time TIME NOT NULL`.
8. Coverage mismatch: frontend expects some indicator fields that are not returned by current indicator endpoint.
9. Limited maternity-specific CDSS surface: no dedicated maternity precheck endpoint comparable to hardened HIV precheck paths.
10. Maternity tests are sparse/nonexistent for critical rule behaviors and nurse-doctor synchronization.

## Target Architecture

### 1) Deterministic Safety Engine + AI Assist
- Deterministic rules are authoritative for blocker/warning/required-data checks.
- AI provides contextual explanation, prioritization, and guideline references.
- Final action paths (save, referral, escalation, discharge) require deterministic pass state.

### 2) Precheck Contract Per Visit Type
New precheck contracts before writes:
- ANC precheck
- Delivery precheck
- Birth outcome precheck
- Postnatal precheck

Each response must return:
- `blockers[]` (cannot submit)
- `warnings[]` (submit allowed with acknowledgment)
- `required_actions[]`
- `suggested_orders[]`
- `doctor_escalation_required` boolean
- `trace` (rule ids, guideline sources, model metadata)

### 3) Vitals De-dup Pipeline
- On visit date selection, auto-fetch patient vitals recorded same date.
- Auto-populate ANC/postnatal vitals from latest same-day vitals entry.
- Maintain provenance links to source `vitals.id`.
- Allow override with audit reason.

### 4) Nurse-Doctor Synchronization State Machine
- Create explicit maternity care tasks/escalations:
  - `open -> acknowledged -> actioned -> closed`
- Triggered by high-risk findings, severe vitals, labor danger signs, postpartum danger signs, neonatal risk.
- Doctor actions write back to maternity timeline visible in nurse dashboard.

### 5) CDSS Boundary Standardization
- No direct browser-to-CDSS maternity calls for clinical workflow paths.
- Route guideline/RAG and CDSS inference through EHR endpoints with tenant/auth/audit controls.

## Sprint Roadmap

### Sprint M0 (P0): Security + Contract Stabilization
Target: 2-3 days

1. Parameterize maternity report date filters.
   - Files:
     - `services/ehr-service/src/services/maternity.service.ts`
   - Acceptance:
     - No string interpolation for dates in SQL.
     - Unit tests for date boundary and malformed input handling.

2. Normalize delivery-time contract.
   - Files:
     - `ehr-frontend/src/components/MaternityEnrollmentDetailModal.tsx`
     - `services/ehr-service/src/services/maternity.service.ts`
     - `services/tenant-service/src/services/database-provisioning.service.ts` (if schema update chosen)
   - Acceptance:
     - Frontend + backend + schema agree on required/optional behavior.

3. Remove direct maternity guideline calls from frontend.
   - Files:
     - `ehr-frontend/src/components/MaternityDashboard.tsx`
     - `ehr-frontend/src/components/MaternityDoctorView.tsx`
     - `ehr-frontend/src/pages/MaternityDoctorDashboard.tsx`
     - `ehr-frontend/src/services/api.ts`
     - `services/ehr-service/src/controllers/cdss.controller.ts` (proxy endpoint usage)
   - Acceptance:
     - Maternity guideline/search requests go through EHR-only path.

### Sprint M1 (P0/P1): Core Maternity Rule Engine
Target: 5-7 days

1. Add maternity CDSS precheck endpoints.
   - New endpoints:
     - `POST /maternity/anc/precheck`
     - `POST /maternity/deliveries/precheck`
     - `POST /maternity/birth-outcomes/precheck`
     - `POST /maternity/postnatal/precheck`

2. Implement deterministic rule packs (versioned).
   - Rule domains:
     - ANC timing/frequency and overdue windows
     - severe BP, fever, reduced fetal movement, danger signs
     - delivery consistency (labor/onset/rupture/blood loss/outcome coherence)
     - postpartum danger signs and neonatal risk flags
     - impossible chronology checks (future/past contradictions)

3. Enforce server-side sequence constraints.
   - Examples:
     - no birth outcome before delivery
     - no postnatal before delivery date
     - no ANC visit dated before enrollment/LMP sanity bounds

Acceptance:
- Blocker paths prevent persistence.
- Warnings require explicit user acknowledgment payload.
- Rule trace is returned and auditable.

### Sprint M2 (P1): Vitals Auto-Propagation + Provenance
Target: 4-6 days

1. Add same-day vitals fetch API contract.
   - Extend vitals endpoint to support date filter and latest-on-date retrieval.

2. Add maternity visit auto-fill behavior.
   - ANC and postnatal forms auto-load same-day vitals.
   - Show source timestamp + recorder.

3. Add provenance fields.
   - Add source-link columns for ANC/postnatal vitals record lineage.

Acceptance:
- Nurses can complete visits without retyping same-day vitals.
- Manual override captured with audit reason.

### Sprint M3 (P1): Nurse-Doctor Sync Pipeline
Target: 5-7 days

1. Introduce maternity care task/escalation tables and APIs.
2. Auto-create tasks from rule-engine critical outcomes.
3. Add doctor action panel for maternity escalations.
4. Reflect doctor actions in nurse dashboard and enrollment timeline.

Acceptance:
- Critical maternity events produce visible, trackable, closeable tasks.
- Nurse and doctor views stay synchronized by status transitions.

### Sprint M4 (P1): Intelligent UI Hardening
Target: 4-6 days

1. Convert heuristic scoring to backend-authoritative risk signals.
2. Add hard-stop panels for blocker conditions in forms.
3. Auto-suggest next ANC/postnatal dates based on gestation/postpartum day and risk level.
4. Ensure role-aware defaults for provider fields (no manual retyping where user context exists).

Acceptance:
- UI cannot bypass backend blockers.
- Form defaults reduce manual typing and mismatch errors.

### Sprint M5 (P1/P2): WHO/Zimbabwe Guideline Encoding and Retrieval
Target: 5-8 days

1. Build guideline source registry for maternity (WHO + Zimbabwe MoH artifacts used by facility).
2. Map each deterministic rule to guideline references.
3. Add citation-aware explanation objects in precheck responses.
4. Add guideline drift process (review version/date, re-approval workflow).

Acceptance:
- Every high-risk rule has traceable guideline mapping.
- Guideline update process is auditable and repeatable.

### Sprint M6 (P1/P2): QA, Monitoring, and Release Gates
Target: 4-6 days

1. Backend tests for maternity rule engine and sequencing.
2. Frontend tests for blocker panels and auto-population behavior.
3. Integration tests for nurse->doctor escalation lifecycle.
4. Metrics/alerts:
   - blocker frequency by rule
   - override rate
   - unresolved critical escalations > SLA
   - same-day vitals auto-population adoption rate

Acceptance:
- CI fails on rule regressions or contract drift.
- Production dashboards expose safety and adoption metrics.

## Database & Provisioning Requirements (Mandatory)

For every schema change, update tenant provisioning in:
- `services/tenant-service/src/services/database-provisioning.service.ts`

Planned schema additions (proposed):
1. `maternity_cdss_assessments`
   - stores precheck request/response trace, rule outcomes, acknowledgments.
2. `maternity_care_tasks`
   - nurse-doctor escalation lifecycle with SLA fields.
3. `maternity_visit_vitals_links`
   - links ANC/postnatal visits to source `vitals.id`, includes override reason.
4. Constraints/indexes:
   - unique `(maternity_enrollment_id, visit_number)` on `anc_visits`
   - chronology check constraints where feasible
   - indexes on `status`, `priority`, `created_at`, `patient_id` for task queues.

## Acceptance Criteria (Program-Level)

1. Maternity submissions are guarded by deterministic precheck APIs with blocker/warning semantics.
2. Same-day vitals are auto-populated into ANC/postnatal forms with provenance.
3. Critical findings auto-create doctor-facing tasks with closed-loop status updates.
4. No direct browser CDSS calls remain in maternity clinical workflows.
5. All DB changes are reflected in tenant provisioning logic.
6. End-to-end tests cover key unsafe scenarios and fail on regressions.

## Execution Board

Status key: `pending`, `in_progress`, `completed`

- M0 Security + Contract Stabilization: `pending`
- M1 Core Maternity Rule Engine: `pending`
- M2 Vitals Auto-Propagation + Provenance: `pending`
- M3 Nurse-Doctor Sync Pipeline: `pending`
- M4 Intelligent UI Hardening: `pending`
- M5 Guideline Encoding + Traceability: `pending`
- M6 QA + Monitoring + Release Gates: `pending`
