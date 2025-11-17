## Sprint 4 Delivery Plan

This document captures the scoped work for Sprint 4 and breaks it into concrete, testable deliverables. Each subsection maps to the grooming items the team aligned on and will be used to open implementation issues.

### 1. Specialty Dashboards (Oncology & Cardiology)

- **Data exposure audit**
  - Ensure `oncology_cases`, `oncology_regimens`, and `oncology_adverse_events` SNOMED fields are projected in the API payloads (`listCases`, `getCaseDetail`, `listRegimens`, `listAdverseEvents`).
  - Confirm cardiology encounter endpoints expose `reason_snomed_*`, `symptom_snomed_codes`, and `diagnostic_snomed_codes`.
- **Dashboard widgets**
  - Oncology: SNOMED-coded diagnosis tiles, regimen timeline with coded drug concepts, adverse event heatmap filtered by SNOMED latent classes.
  - Cardiology: risk badges driven by SNOMED-coded symptoms, diagnostics checklist, follow-up SLA tracker.
- **Automation hooks**
  - Regimen cycle reminders (scheduled job).
  - Adverse event escalation if SNOMED concept severity >= Grade 3.
  - Cardiology follow-up alerts when `care_status` not closed within SLA.

### 2. CDSS Hook Integration

- **Event matrix**
  - Triage assessment saved, HIV clinical visit saved, prescription created, lab/imaging ordered, nursing note recorded, maternity milestone, oncology regimen update.
- **Payload contract**
  - Standard JSON schema with patient context, encounter metadata, SNOMED-coded findings/diagnoses/meds, vitals, recent history.
- **Hook architecture**
  - Central `cdssHookService` to publish events synchronously (blocking warnings) or asynchronously (long-running risk models).
  - Feature flags per tenant/module.
- **Response handling**
  - UI alert cards, notification drawer entries, auto-created follow-up tasks.
- **Observability**
  - Structured logs + metrics for hook success/failure, audit trail per patient.

### 3. Tenant Provisioning Hardening

- **Schema drift detector**
  - CLI script comparing tenant schemas vs `getClinicSchema()` output; auto-generates corrective SQL.
- **Modular provisioning bundles**
  - Break SQL statements into `core`, `HIV`, `Maternity`, `Oncology`, `Cardiology`, etc., selectable during tenant creation.
- **Upgrade runner**
  - Enhanced `update-existing-tenants.sh` with per-module version tracking (`tenant_schema_versions` table) and health checks.
- **Smoke tests**
  - Automated new-tenant creation + API sanity suite.
- **Monitoring**
  - Emit provisioning events for Prometheus/Grafana dashboards and pager alerts on failures.

### 4. QA & Clinical Validation

- **Scenario library (top 10 workflows)**
  1. HIV full visit with SNOMED diagnoses/regimens.
  2. Maternity ANC → ultrasound → delivery → newborn follow-up.
  3. Triage assessment → prescription → nursing note.
  4. Oncology case lifecycle (case, regimen, infusion, adverse event).
  5. Cardiology encounter with diagnostics and follow-up.
  6. Lab order + critical alert acknowledgment.
  7. Imaging order + result review.
  8. CDSS alert surfacing (triage/prescription).
  9. New tenant provisioning regression.
  10. HIV monthly return / reporting extract.
- **Test assets**
  - Reusable patient fixtures, Playwright/Cypress suites, API regression tests, manual checklists for clinical reviewers.
- **Execution**
  - Nightly automated runs in QA tenant, clinical sign-off checkpoints, defect tracking with module/severity tags.

### 5. ICD-10 Mapping Strategy

- **Source**: `snowstorm/import/SNOMED_CT_to_ICD-10-CM_Resources_20250901.zip` (staged).
- **Ingestion options**
  - Import refsets into Snowstorm and query via REST, or ETL into `snomed_icd10_mappings` table.
- **API/UI**
  - Extend `/api/terminology/snomed/map/:conceptId/ICD10` with detailed mappings (map group, priority, advice).
  - UI suggestion chips when clinicians pick a SNOMED diagnosis.
- **Versioning**
  - Track map effective time, align updates with SNOMED releases, maintain rollback plan.

---

The next step is to open engineering tickets per bullet (or convert to Jira epics/stories) and begin implementation in the order agreed: Specialty Dashboards → CDSS hooks → provisioning hardening → QA automation → ICD‑10 mapping.


This document captures the scoped work for Sprint 4 and breaks it into concrete, testable deliverables. Each subsection maps to the grooming items the team aligned on and will be used to open implementation issues.

### 1. Specialty Dashboards (Oncology & Cardiology)

- **Data exposure audit**
  - Ensure `oncology_cases`, `oncology_regimens`, and `oncology_adverse_events` SNOMED fields are projected in the API payloads (`listCases`, `getCaseDetail`, `listRegimens`, `listAdverseEvents`).
  - Confirm cardiology encounter endpoints expose `reason_snomed_*`, `symptom_snomed_codes`, and `diagnostic_snomed_codes`.
- **Dashboard widgets**
  - Oncology: SNOMED-coded diagnosis tiles, regimen timeline with coded drug concepts, adverse event heatmap filtered by SNOMED latent classes.
  - Cardiology: risk badges driven by SNOMED-coded symptoms, diagnostics checklist, follow-up SLA tracker.
- **Automation hooks**
  - Regimen cycle reminders (scheduled job).
  - Adverse event escalation if SNOMED concept severity >= Grade 3.
  - Cardiology follow-up alerts when `care_status` not closed within SLA.

### 2. CDSS Hook Integration

- **Event matrix**
  - Triage assessment saved, HIV clinical visit saved, prescription created, lab/imaging ordered, nursing note recorded, maternity milestone, oncology regimen update.
- **Payload contract**
  - Standard JSON schema with patient context, encounter metadata, SNOMED-coded findings/diagnoses/meds, vitals, recent history.
- **Hook architecture**
  - Central `cdssHookService` to publish events synchronously (blocking warnings) or asynchronously (long-running risk models).
  - Feature flags per tenant/module.
- **Response handling**
  - UI alert cards, notification drawer entries, auto-created follow-up tasks.
- **Observability**
  - Structured logs + metrics for hook success/failure, audit trail per patient.

### 3. Tenant Provisioning Hardening

- **Schema drift detector**
  - CLI script comparing tenant schemas vs `getClinicSchema()` output; auto-generates corrective SQL.
- **Modular provisioning bundles**
  - Break SQL statements into `core`, `HIV`, `Maternity`, `Oncology`, `Cardiology`, etc., selectable during tenant creation.
- **Upgrade runner**
  - Enhanced `update-existing-tenants.sh` with per-module version tracking (`tenant_schema_versions` table) and health checks.
- **Smoke tests**
  - Automated new-tenant creation + API sanity suite.
- **Monitoring**
  - Emit provisioning events for Prometheus/Grafana dashboards and pager alerts on failures.

### 4. QA & Clinical Validation

- **Scenario library (top 10 workflows)**
  1. HIV full visit with SNOMED diagnoses/regimens.
  2. Maternity ANC → ultrasound → delivery → newborn follow-up.
  3. Triage assessment → prescription → nursing note.
  4. Oncology case lifecycle (case, regimen, infusion, adverse event).
  5. Cardiology encounter with diagnostics and follow-up.
  6. Lab order + critical alert acknowledgment.
  7. Imaging order + result review.
  8. CDSS alert surfacing (triage/prescription).
  9. New tenant provisioning regression.
  10. HIV monthly return / reporting extract.
- **Test assets**
  - Reusable patient fixtures, Playwright/Cypress suites, API regression tests, manual checklists for clinical reviewers.
- **Execution**
  - Nightly automated runs in QA tenant, clinical sign-off checkpoints, defect tracking with module/severity tags.

### 5. ICD-10 Mapping Strategy

- **Source**: `snowstorm/import/SNOMED_CT_to_ICD-10-CM_Resources_20250901.zip` (staged).
- **Ingestion options**
  - Import refsets into Snowstorm and query via REST, or ETL into `snomed_icd10_mappings` table.
- **API/UI**
  - Extend `/api/terminology/snomed/map/:conceptId/ICD10` with detailed mappings (map group, priority, advice).
  - UI suggestion chips when clinicians pick a SNOMED diagnosis.
- **Versioning**
  - Track map effective time, align updates with SNOMED releases, maintain rollback plan.

---

The next step is to open engineering tickets per bullet (or convert to Jira epics/stories) and begin implementation in the order agreed: Specialty Dashboards → CDSS hooks → provisioning hardening → QA automation → ICD‑10 mapping.


This document captures the scoped work for Sprint 4 and breaks it into concrete, testable deliverables. Each subsection maps to the grooming items the team aligned on and will be used to open implementation issues.

### 1. Specialty Dashboards (Oncology & Cardiology)

- **Data exposure audit**
  - Ensure `oncology_cases`, `oncology_regimens`, and `oncology_adverse_events` SNOMED fields are projected in the API payloads (`listCases`, `getCaseDetail`, `listRegimens`, `listAdverseEvents`).
  - Confirm cardiology encounter endpoints expose `reason_snomed_*`, `symptom_snomed_codes`, and `diagnostic_snomed_codes`.
- **Dashboard widgets**
  - Oncology: SNOMED-coded diagnosis tiles, regimen timeline with coded drug concepts, adverse event heatmap filtered by SNOMED latent classes.
  - Cardiology: risk badges driven by SNOMED-coded symptoms, diagnostics checklist, follow-up SLA tracker.
- **Automation hooks**
  - Regimen cycle reminders (scheduled job).
  - Adverse event escalation if SNOMED concept severity >= Grade 3.
  - Cardiology follow-up alerts when `care_status` not closed within SLA.

### 2. CDSS Hook Integration

- **Event matrix**
  - Triage assessment saved, HIV clinical visit saved, prescription created, lab/imaging ordered, nursing note recorded, maternity milestone, oncology regimen update.
- **Payload contract**
  - Standard JSON schema with patient context, encounter metadata, SNOMED-coded findings/diagnoses/meds, vitals, recent history.
- **Hook architecture**
  - Central `cdssHookService` to publish events synchronously (blocking warnings) or asynchronously (long-running risk models).
  - Feature flags per tenant/module.
- **Response handling**
  - UI alert cards, notification drawer entries, auto-created follow-up tasks.
- **Observability**
  - Structured logs + metrics for hook success/failure, audit trail per patient.

### 3. Tenant Provisioning Hardening

- **Schema drift detector**
  - CLI script comparing tenant schemas vs `getClinicSchema()` output; auto-generates corrective SQL.
- **Modular provisioning bundles**
  - Break SQL statements into `core`, `HIV`, `Maternity`, `Oncology`, `Cardiology`, etc., selectable during tenant creation.
- **Upgrade runner**
  - Enhanced `update-existing-tenants.sh` with per-module version tracking (`tenant_schema_versions` table) and health checks.
- **Smoke tests**
  - Automated new-tenant creation + API sanity suite.
- **Monitoring**
  - Emit provisioning events for Prometheus/Grafana dashboards and pager alerts on failures.

### 4. QA & Clinical Validation

- **Scenario library (top 10 workflows)**
  1. HIV full visit with SNOMED diagnoses/regimens.
  2. Maternity ANC → ultrasound → delivery → newborn follow-up.
  3. Triage assessment → prescription → nursing note.
  4. Oncology case lifecycle (case, regimen, infusion, adverse event).
  5. Cardiology encounter with diagnostics and follow-up.
  6. Lab order + critical alert acknowledgment.
  7. Imaging order + result review.
  8. CDSS alert surfacing (triage/prescription).
  9. New tenant provisioning regression.
  10. HIV monthly return / reporting extract.
- **Test assets**
  - Reusable patient fixtures, Playwright/Cypress suites, API regression tests, manual checklists for clinical reviewers.
- **Execution**
  - Nightly automated runs in QA tenant, clinical sign-off checkpoints, defect tracking with module/severity tags.

### 5. ICD-10 Mapping Strategy

- **Source**: `snowstorm/import/SNOMED_CT_to_ICD-10-CM_Resources_20250901.zip` (staged).
- **Ingestion options**
  - Import refsets into Snowstorm and query via REST, or ETL into `snomed_icd10_mappings` table.
- **API/UI**
  - Extend `/api/terminology/snomed/map/:conceptId/ICD10` with detailed mappings (map group, priority, advice).
  - UI suggestion chips when clinicians pick a SNOMED diagnosis.
- **Versioning**
  - Track map effective time, align updates with SNOMED releases, maintain rollback plan.

---

The next step is to open engineering tickets per bullet (or convert to Jira epics/stories) and begin implementation in the order agreed: Specialty Dashboards → CDSS hooks → provisioning hardening → QA automation → ICD‑10 mapping.




