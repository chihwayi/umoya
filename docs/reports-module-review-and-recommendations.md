# Module-by-Module Review: Reporting & Recommendations

**Scope:** Medicore multi-tenant eHR (Zimbabwe private clinics).  
**Purpose:** Identify what reporting exists today and recommend **actual important reports** that should be implemented or hardened.

---

## 1. Module-by-module summary

### 1.1 EHR Service (`services/ehr-service`)

| Area | What exists | Notes |
|------|-------------|--------|
| **Financial reports** | `financial-reports.controller`: revenue (with breakdowns/trends), P&L, cash flow, AR aging. | Used by Billing Dashboard. Filters: date range, period, service type, doctor, groupBy. |
| **Analytics & reporting** | `analytics.controller`: report templates (CRUD, execute, clone, execution history), scheduled reports (CRUD, pause/resume, manual run, history), clinical outcomes (record, query, trends, metrics, comparisons), analytics metrics (create, calculate, trends, compare, benchmarks). | Export formats: JSON, PDF, Excel, CSV. |
| **Legacy reports** | `reports.controller` + `reports.service`: patient summary, financial report (bills by period), clinical report (consultations, top diagnoses, prescription stats), dashboard data, appointments report, prescriptions report, lab results report. | Financial here is bill-based; more detailed finance is in `financial-reports`. Lab turnaround is hardcoded (“2.5 days” etc.). |
| **Module general reports** | `GET /reports/modules/:module/general?days=` for MAR, blood_bank, sepsis, infection_control, cdi, revenue_cycle, population_health, hiv. | Used by ModuleGeneralReportCard in Revenue Cycle and Population Health dashboards. Stats + highlights + recommendations. |
| **HIPAA audit** | `hipaa-audit.controller`: logs (filtered), summary (date range), breach detection, disclosure report (admin). | HIPAA Compliance Dashboard consumes logs, summary, breaches. |
| **Health records export** | `health-records-export.service`: full medical record PDF; FHIR bundle; JSON; CSV (by data type). | Used by patient-portal export endpoints. |
| **Claims** | `claims.controller`: analytics (date/provider), dashboard summary, claim readiness worklist, readiness per claim. | Feeds Claims Dashboard. |
| **Payment reconciliation** | `payment-reconciliation.controller`: reconciliation report (date range). | Exists; ensure Billing/Accounts can open it. |
| **DHIS2** | `dhis2.controller`: `POST /dhis2/reports/aggregate`. `dhis2.service`: sync, aggregate profiles (service_delivery, maternal_newborn, hiv_monthly, immunization_monthly, pharmacy_stock). | Public health reporting; profile completeness varies. |
| **Post-visit** | `post-visit.controller`: `GET /post-visit/reports/trial-memory-audit` (CSV/JSON). | For trial/memory audit export. |
| **Metrics** | `metrics.controller`: Prometheus scrape, nurse copilot KPIs, workflow health snapshot (HIV, coordination, revenue cycle). | Operational monitoring, not end-user reports. |

### 1.2 Tenant Service (`services/tenant-service`)

| Area | What exists | Notes |
|------|-------------|--------|
| **Analytics** | `tenant-analytics.controller`: system overview, all tenants overview, per-tenant metrics, `generateTenantReport(tenantId)`. | Platform-level; `generateTenantReport` should be checked for completeness (users, activity, storage). |

### 1.3 EHR Frontend (`ehr-frontend`)

| Area | What exists | Notes |
|------|-------------|--------|
| **Billing** | Uses `getFinancialReports` (revenue, P&L, cash flow, aging) with date/period. | Working. |
| **Analytics** | Analytics Dashboard: templates, schedules, outcomes, metrics (overview + execute/trends). | Report builder and schedules in use. |
| **HIPAA** | HIPAA Compliance Dashboard: overview stats, logs, breaches, user access, sessions, summary. | Consumes hipaa-audit APIs. |
| **Module cards** | ModuleGeneralReportCard calls `getModuleGeneralReport(moduleKey, days)` for Revenue Cycle and Population Health. | Working. |
| **HIV** | HIVComparisonReports (time period / facility comparison). | Uses analytics/comparison APIs. |
| **Imaging** | Imaging report templates and sign/acknowledge flows. | Reporting here is document workflow, not analytics. |

### 1.4 Patient Portal (`patient-portal`)

| Area | What exists | Notes |
|------|-------------|--------|
| **Exports** | PDF (full record), FHIR bundle, JSON, CSV (by type), immunization export, consent export. | Backed by `patient-portal.controller` and `health-records-export.service`. |

### 1.5 Web App (`web-app`)

| Area | What exists | Notes |
|------|-------------|--------|
| **Tenant admin** | Tenant CRUD, directory. | No dedicated “reports” UI; platform analytics live in tenant-service. |

### 1.6 Scripts / evidence

| Item | What exists | Notes |
|------|-------------|--------|
| **SOC2/HIPAA evidence** | `scripts/soc2-hipaa-evidence-report.js`: stub checklist (PHI audit, de-identification, etc.). | Does not connect to DB; no per-tenant counts. |

---

## 2. Gaps and risks

- **Lab report:** Turnaround time in `reports.service.getLabResultsReport` is hardcoded; should be computed from order/result timestamps.
- **Tax reporting:** `tax-management.controller` exists; unclear if there is a concrete “tax report” (e.g. VAT, withholding by period) for Zimbabwe.
- **Referrals:** No dedicated referral report (in/out by source, status, specialty).
- **Immunization coverage:** No internal “immunization coverage by antigen/age/facility” report; only export and DHIS2 aggregate.
- **Default report templates:** Analytics has a full report builder but no canned templates (e.g. “Monthly revenue”, “AR aging”, “HIPAA summary”); tenants start from scratch.
- **SOC2 evidence script:** Not wired to real audit data; evidence is static.

---

## 3. Recommended reports (prioritized)

These are the **actual important reports** worth implementing or hardening, in order of impact.

### Tier 1 – Should do (compliance, finance, operations)

1. **HIPAA Accounting of Disclosures (per patient)**  
   - **Status:** API exists: `admin-audit.controller` → `getDisclosureReport`.  
   - **Action:** Expose in HIPAA Compliance Dashboard (e.g. “Disclosure report” tab or modal) with date range and patient selector, and add “Export PDF/CSV” so clinics can hand it to patients/auditors.

2. **SOC2/HIPAA evidence report (platform)**  
   - **Status:** `scripts/soc2-hipaa-evidence-report.js` is a stub.  
   - **Action:** Optionally connect to tenant DB(s) or a read-only replica: count `hipaa_audit_log` entries (e.g. by action, outcome) for the period and include in the generated report (JSON/CSV). Keeps automation and gives auditors real numbers.

3. **Lab results report – real turnaround**  
   - **Status:** `reports.service.getLabResultsReport` returns fixed “2.5 days” etc.  
   - **Action:** Compute min/max/avg turnaround from `lab_orders` (and result timestamps if available) by period; replace hardcoded `turnaroundTime` with real aggregates.

4. **Tax report (Zimbabwe context)**  
   - **Status:** Tax management controller exists; no clear “tax report” endpoint.  
   - **Action:** Add a single “tax report” (e.g. `GET /tax-management/report?startDate=&endDate=`) returning taxable revenue, VAT, withholding (or similar) by period so clinics can meet local requirements.

5. **Default report templates**  
   - **Status:** Report builder is flexible but has no seed data.  
   - **Action:** Seed 3–5 canned templates per tenant (or globally): e.g. “Monthly revenue summary”, “AR aging as of date”, “HIPAA audit summary (date range)”, “Appointments by status (period)”. Reduces setup time and standardizes common asks.

### Tier 2 – Nice to have (clinical, referrals, public health)

6. **Referral report**  
   - **Status:** Referral controller exists; no aggregated report.  
   - **Action:** Add e.g. `GET /referrals/report?dateFrom=&dateTo=` with counts by direction (in/out), status, referring/referred-to facility or specialty. Supports referral management and contracts.

7. **Immunization coverage report**  
   - **Status:** Immunization data and DHIS2 aggregate exist; no internal coverage report.  
   - **Action:** Add e.g. `GET /immunizations/report/coverage?period=&antigen=&ageGroup=` (or similar) for coverage by antigen and age group. Use for internal QA and to align with DHIS2.

8. **Mortality / sentinel event (if applicable)**  
   - **Status:** Not present.  
   - **Action:** Only if you track mortality or sentinel events (e.g. in admissions or a dedicated table): add a small “quality/safety” report (counts, optional breakdown by unit/period) for internal or regulator use.

### Tier 3 – Optional (platform, tenant)

9. **Tenant report content**  
   - **Status:** `tenant-analytics.service.generateTenantReport(tenantId)` exists.  
   - **Action:** Ensure it returns clear KPIs (e.g. active users, last login, storage, key activity counts). If already sufficient, document it; if thin, extend and optionally add a simple “Tenant report” download in web-app.

10. **Platform SLA/health report**  
    - **Status:** Prometheus metrics and workflow health exist; no end-user “SLA report”.  
    - **Action:** Only if you need to report uptime/SLA to tenants or management: add a small report (e.g. from metrics store or logs) with uptime, error rate, or latency by period. Otherwise, keep this in Prometheus/Grafana only.

---

## 4. What not to prioritize

- **Duplicate financial reports:** You already have both `financial-reports` (detailed) and `reports.service.getFinancialReport` (bill-based). Prefer directing all financial reporting to `financial-reports` and deprecating or clearly documenting the legacy one; no need for a third financial engine.
- **More dashboards before reports:** Many specialty dashboards (ED, OR, PACU, MAR, sepsis, etc.) already exist. Focus report work on the list above rather than new dashboards.
- **Patient-facing “reports”:** Patient exports (PDF, FHIR, JSON, CSV, immunizations, consent) are in place; no high-priority new patient report type unless there is a specific regulatory or contract ask.

---

## 5. Summary table

| Report | Module | Priority | Action |
|--------|--------|----------|--------|
| HIPAA Accounting of Disclosures | ehr-service + ehr-frontend | Tier 1 | Expose in HIPAA dashboard + export |
| SOC2/HIPAA evidence | scripts + ehr-service | Tier 1 | Wire script to audit DB counts |
| Lab turnaround (real) | ehr-service reports.service | Tier 1 | Compute from lab_orders/result dates |
| Tax report | ehr-service tax-management | Tier 1 | Add GET report endpoint |
| Default report templates | ehr-service analytics | Tier 1 | Seed canned templates |
| Referral report | ehr-service referrals | Tier 2 | Add GET /referrals/report |
| Immunization coverage | ehr-service immunizations | Tier 2 | Add coverage report endpoint |
| Mortality/sentinel (if any) | ehr-service | Tier 2 | Add only if data exists |
| Tenant report content | tenant-service | Tier 3 | Review/extend generateTenantReport |
| Platform SLA report | metrics/observability | Tier 3 | Only if required for contracts |

---

*Generated from a module-by-module review of the Medicore codebase. Implement in order of priority and local regulatory needs.*

---

## Provisioning note

- **HIPAA audit:** Tenant DB provisioning (`database-provisioning.service`) creates `hipaa_audit_logs` and adds columns used by the EHR and SOC2 evidence script: `event_type`, `operation`, `data_classification`, `request_id`, `ip_address_hash`, `changes_delta`, `immutable`, plus indexes.
- **To provision every tenant DB** (apply full clinic schema, including the above, to all existing tenants):
  1. Ensure Postgres and the master DB are running.
  2. Set `DATABASE_URL` to your master DB (e.g. `postgresql://medicore:medicore_password@localhost:5432/medicore_master`).
  3. Run: **`npm run provision:all-tenants`**  
     This runs `services/tenant-service/src/scripts/repairTenants.ts`, which connects to the master DB, lists all active/pending/suspended tenants, and calls `applyClinicSchema` on each tenant database.
  - Alternatively, if the tenant-service is running, call **`POST /admin/tenants/repair-all`** (with admin auth) to do the same via API.
- **SOC2 evidence:** Run with a tenant DB URL to include live counts:  
  `DATABASE_URL=postgresql://... node scripts/soc2-hipaa-evidence-report.js [--format=json|csv] [--days=30]`  
  Or from repo root: `npm run report:soc2-hipaa`.
