# MediCore System Reference

This file is the consolidated source of truth for the MediCore repository as reviewed on March 10, 2026.

## 1. Product Snapshot

MediCore is a multi-tenant EHR platform with three user-facing web applications and three backend services:

- `web-app/`: super admin and tenant operations portal
- `ehr-frontend/`: clinician and staff workflow application
- `patient-portal/`: patient self-service application
- `services/tenant-service/`: tenant lifecycle, analytics, and backups
- `services/ehr-service/`: core clinical, operational, financial, and interoperability API
- `services/cdss-service/`: clinical decision support and AI service

The system is already broader than a narrow ambulatory EMR. It includes outpatient, inpatient, specialty, financial, interoperability, and AI-assisted workflows in one codebase.

## 2. Repository Map

| Path | Role |
| --- | --- |
| `web-app/` | Super admin portal for tenant creation, health, audit, security, terminology, backups, and CDSS admin |
| `ehr-frontend/` | Main staff-facing web UI for doctors, nurses, accounts, lab, radiology, pharmacy, admin, and specialty workflows |
| `patient-portal/` | Patient login, appointments, records, prescriptions, bills, goals, questionnaires, messaging, telemedicine, and more |
| `services/tenant-service/` | Tenant APIs, tenant users, master-database analytics, storage-backed backups, provisioning |
| `services/ehr-service/` | Main API with 100+ controllers across clinical care, hospital ops, analytics, and integrations |
| `services/cdss-service/` | FastAPI-based CDSS with rules, AI hooks, privacy guards, worker queue, and evaluation harness |
| `database/` | Shared schemas and seed data |
| `scripts/` | Provisioning, seed, terminology import, smoke, and support scripts |
| `monitoring/`, `infrastructure/monitoring/` | Prometheus and Grafana config |

## 3. Runtime Architecture

### 3.1 Core services

| Component | Default port | Notes |
| --- | --- | --- |
| PostgreSQL master | `5432` | Master tenant registry and operational backing store |
| Redis | `6379` | Queueing, caching, and support services |
| MinIO | `9000` / `9001` | Object storage for documents, backups, and media |
| Tenant service | `3001` | NestJS API with Swagger at `/api/docs` |
| CDSS service | `8000` | FastAPI service with Swagger at `/docs` |
| CDSS worker | n/a | Background worker for CDSS jobs |
| EHR service | `3013` | NestJS API with Swagger at `/api/docs` |
| Web admin portal | `3011` | React app for platform operations |
| EHR frontend | `3000` | React app for staff workflows |
| Patient portal | `3015` | React app for patient workflows |
| Prometheus | `9090` | Metrics |
| Grafana | `3012` | Dashboarding |

### 3.2 Multi-tenancy model

- A master database stores tenant metadata, tenant users, analytics, and operational controls.
- Tenant-specific databases are provisioned per clinic or facility.
- Clinical requests are tenant-scoped using request context and `X-Tenant-ID` / tenant routing.
- Tenant-aware routing exists in both the EHR service and the CDSS integration path.

## 4. Current Product Surface

### 4.1 Platform and tenant operations

Current platform capabilities include:

- Tenant creation, activation, suspension, and deletion flows
- Tenant-scoped user management
- Master-level analytics and health monitoring
- Audit and backup administration
- Terminology and CDSS admin views in the admin portal
- Automated tenant database provisioning via the tenant service

### 4.2 Clinical core

The EHR service and frontend currently cover:

- Authentication, profile access, password change, and 2FA flows
- Patient registration and patient history
- Appointments, waitlists, doctor availability, and scheduling intelligence
- Medical records, nursing notes, clinical templates, problems, allergies, vitals, and orders
- Prescriptions, medication history, medication safety, and prescription templates
- Lab orders, catalogs, order sets, critical alerts, and result workflows
- Imaging workflows and storage-backed asset access
- Documents, secure provider messaging, consents, referrals, and care plans

### 4.3 Hospital and operational modules

The codebase already contains dedicated workflows for:

- Bed management and ADT
- Emergency department
- Operating room and anesthesia
- BCMA / MAR workflows
- Blood bank
- Infection control
- Sepsis workflows
- Case management
- Clinical documentation improvement
- Revenue cycle and financial reporting

### 4.4 Specialty and chronic care modules

The system includes dedicated APIs and frontend pages for:

- HIV care and HIV monitoring
- Maternity / obstetrics
- Oncology
- Ophthalmology
- Cardiology
- Diabetes
- Immunizations and travel vaccines
- Pharmacy
- Prior authorizations
- Population health

### 4.5 Patient-facing product surface

The patient portal already goes beyond simple appointment viewing. It includes:

- Tenant-aware registration and login
- Link-account flows
- Dashboard, appointments, and appointment requests
- Medical records, lab results, prescriptions, and export flows
- Medication reminders and adherence tracking
- Bills and vitals
- Questionnaires, PRO schedules, and health goals
- Messages and telemedicine
- Diabetes and cardiology self-management pages
- Symptom checker
- Family access
- Fitness integration
- Consents, care pathways, immunizations, admission status, and ED visit views

### 4.6 AI and CDSS surface

Current CDSS and AI-oriented capabilities include:

- Drug-drug and food-drug interaction checks
- Clinical guideline checks
- Risk scoring
- Dosing recommendations
- Diagnostic suggestion support
- Lab interpretation
- Duplicate therapy and high-risk medication detection
- WHO SMART Guidelines integration
- Transcription support
- Post-visit AI workflows and follow-up intelligence
- Offline evaluation harness and versioned report support

The EHR service currently contracts against these CDSS API routes:

- `/care-gaps/detect`
- `/diagnosis/suggest`
- `/diagnosis/suggest/intelligent`
- `/dosing/recommend`
- `/drugs/interactions/advanced`
- `/guidelines/check`
- `/guidelines/search`
- `/hiv/testing/algorithm`
- `/labs/interpret`
- `/medications/duplicates`
- `/medications/food-interactions`
- `/medications/high-risk`
- `/patient/summarize`
- `/risk/calculate`

## 5. Interoperability and Regional Fit

MediCore already exposes or references:

- FHIR R4 endpoints
- HL7 message endpoints
- CCDA endpoints
- DHIS2 integration and bootstrap scripts
- SNOMED / ICD-10 terminology support
- WHO SMART Guideline resource support
- Medical-aid integration surfaces
- Zimbabwe/SADC-oriented deployment assumptions and payment/claims context

## 6. Security, Privacy, and Compliance Posture

Based on the live code rather than older narrative docs, the active security posture includes:

- JWT authentication in the tenant and EHR services
- EHR 2FA setup, verify, disable, and complete-login endpoints
- Request validation with global validation pipes
- Tenant-scoped access controls and tenant header enforcement
- Request IDs attached and returned at the API edge
- Global HIPAA audit interception in the EHR service
- Append-only `hipaa_audit_logs` protections in the EHR service
- Signed URL support for stored assets
- CDSS service authentication with token and/or JWT modes
- CDSS PHI redaction, outbound PHI blocking, and egress allowlist controls
- CDSS encryption configuration and key rotation support
- Environment fail-fast checks for insecure production settings

The current codebase is strong on defensive controls, but compliance claims should still be treated as implementation-backed safeguards, not as an external certification statement.

## 7. Data and Storage Model

The core data pattern is:

- Master PostgreSQL database for tenants, tenant users, admin users, analytics, and audit
- Per-tenant clinical databases for patient and operational data
- Redis for queueing and support state
- MinIO / S3-compatible storage for documents, reports, backups, and imaging-related assets
- File access through signed URL helpers and service-level storage abstractions

## 8. QA and Verification

The repository contains meaningful automated coverage already:

- `services/ehr-service/src`: 42 spec files
- `services/cdss-service/tests`: 18 Python test files
- `ehr-frontend/src`: 7 frontend tests
- `patient-portal/src`: 1 frontend test file

There are also smoke, seed, and provisioning scripts under `scripts/` and additional QA assets under `qa/`.

Recommended routine verification:

```bash
npm install
npm run lint
npm run test
docker compose up -d postgres-master redis minio tenant-service cdss-service cdss-worker ehr-service web-app ehr-frontend patient-portal
```

Useful URLs after boot:

- Tenant Swagger: `http://localhost:3001/api/docs`
- EHR Swagger: `http://localhost:3013/api/docs`
- CDSS Swagger: `http://localhost:8000/docs`
- Staff frontend: `http://localhost:3000`
- Admin portal: `http://localhost:3011`
- Patient portal: `http://localhost:3015`

Important repo note:

- The reliable bootstrap path is `docker compose up ...` or `npm run dev`.
- Older helper flows still reference missing root scripts such as `scripts/migrate.sh`, `scripts/deploy.sh`, and `scripts/backup.sh`, so they should not be treated as the canonical startup or release path until repaired.

## 9. Documentation Policy

The repository previously contained 98 Markdown files, including sprint plans, release checkpoints, duplicated API notes, and boilerplate READMEs.

The retained documentation model is now:

- [README.md](../README.md): short root overview and startup guide
- [docs/MEDICORE_SYSTEM_REFERENCE.md](./MEDICORE_SYSTEM_REFERENCE.md): consolidated product and technical reference

If more documentation is added later, it should be because it is stable, operationally useful, and not duplicative of these two files.

## 10. Mobile Readiness

MediCore is close to a credible provider-first mobile phase because the backend already exposes the right domains:

- auth and tenant context
- patient summaries and charts
- vitals
- labs
- notifications
- transcription
- CDSS
- messaging
- telemedicine
- inpatient and ward-round oriented data

The right mobile strategy is not to mirror the whole web app. The highest-value mobile MVP should focus on:

1. Secure provider login with tenant resolution and short-session re-entry
2. Ward round patient list and bedside summary
3. Quick vitals, note capture, and voice transcription
4. Critical-result notifications and message inbox
5. Lightweight prescribing / acknowledgement workflows

Before mobile build-out, the web platform should lock down:

- the mobile auth contract
- offline sync boundaries
- push / event contract ownership
- camera and barcode use cases
- PHI caching and device security rules

## 11. Honest Review: What Still Needs Work to Beat Strong Niche EHRs

The breadth is already impressive. The bigger risk now is trying to win by adding even more breadth. The strongest niche EHRs usually win on workflow depth, operational polish, and repeatable outcomes in a narrower domain.

### 11.1 Biggest product gap: depth over breadth

MediCore has enough modules already. The next advantage should come from making a few flagship workflows exceptional:

- HIV program management for Zimbabwean/private-clinic use cases
- doctor-nurse-handshake workflows
- revenue cycle and medical-aid collections
- post-visit AI and patient follow-through

### 11.2 Reliability and implementation polish

To compete with best-in-class niche systems, MediCore should tighten:

- environment bootstrap reliability
- deployment playbooks
- regression suites around the highest-value workflows
- production-grade observability tied to clinical and financial outcomes

### 11.3 Revenue cycle intelligence

The system already has finance, payments, reconciliation, claims, prior auth, and medical-aid surfaces. The next differentiator is deeper automation:

- real-time eligibility and authorization status
- denial prediction and work queues
- missing-document detection before claim submission
- collection and aging dashboards by payer and provider

### 11.4 Clinical quality and operations layer

To beat strong niche EHRs, add more opinionated execution support:

- care-gap registries by specialty and disease program
- protocol adherence dashboards for clinicians and managers
- recall and recall-outcome tracking
- pathway variance reporting
- closed-loop tasking from alert to action to resolution

### 11.5 Mobile should amplify existing strengths

The mobile app should not be a generic companion. It should become the best bedside and follow-up tool in the stack:

- ward-round speed
- critical alert response
- voice-first charting
- secure messaging
- offline-safe capture
- patient follow-up escalation

## 12. Recommended Next Sequence

If the goal is to reach mobile with a stronger product foundation, the best sequence is:

1. Freeze documentation drift and keep this two-file doc model
2. Harden bootstrap, deployment, and regression coverage on core workflows
3. Pick three flagship domains and drive depth, metrics, and polish
4. Define the exact provider-mobile MVP contract
5. Start mobile with provider workflows first, then expand patient-mobile depth if needed

## 13. Execution Roadmap and Sprint Plan

This roadmap assumes 2-week sprints and focuses on the four priorities that matter most now:

1. Stabilize bootstrap, deployment, and regression coverage
2. Make HIV the first dominant workflow
3. Build closed-loop doctor-nurse coordination
4. Turn revenue cycle into a denial-prevention and collections engine

### 13.1 Program rules

- No net-new broad modules during this roadmap unless they directly unlock one of the four priorities
- Every sprint must ship measurable workflow improvement, not only code volume
- Every flagship workflow must have release gates, demo data, and operational metrics

### 13.2 Success metrics

By the end of the roadmap, the target state should be:

- bootstrap time predictable and documented
- one-command local bring-up for the core stack
- release regression suite covering the highest-value workflows
- HIV program dashboard trusted by clinicians and managers
- nurse-to-doctor urgent escalation flow visible and auditable
- first-pass claim acceptance rate materially improved
- denial queue and payer aging visible inside the product

### 13.3 Sprint schedule

#### Sprint 1: Platform Stability Foundation

Primary goal:
- remove bootstrap ambiguity and create a reliable release baseline

Scope:
- finalize root bootstrap path and environment assumptions
- standardize deploy and backup wrappers
- define canonical seed data for core demo and regression flows
- add CI or local release checklist for tenant service, EHR service, and frontends
- identify top 20 critical journeys and tag current test coverage gaps

Definition of done:
- `npm run setup`, `npm run migrate`, `npm run deploy`, and `npm run backup` are all real and documented
- local bring-up path is deterministic
- a single smoke checklist exists for platform startup and basic tenant creation

#### Sprint 2: Regression and Observability Baseline

Primary goal:
- stop regressions in the areas that will become flagship workflows

Scope:
- add regression packs for HIV intake/visit/regimen flows
- add regression packs for triage to doctor handoff and critical alerts
- add regression packs for claim creation, submission, response, and reconciliation
- publish operational metrics for wait times, escalation response, claim outcomes, and overdue HIV actions
- create alerting thresholds for failed claim processing, stuck escalations, and abnormal HIV backlog growth

Definition of done:
- release gate exists for HIV, handoff, and revenue-cycle flows
- dashboards show both technical and workflow metrics

#### Sprint 3: HIV Registry and Program Operations

Primary goal:
- make HIV a managed program workflow, not just encounter documentation

Scope:
- create HIV registry views by regimen, VL status, EAC status, TPT status, pregnancy, age group, and missed follow-up
- add longitudinal patient risk cards and next-best-action prompts
- improve clinician-facing HIV summary so the important actions are obvious
- standardize visit state transitions and overdue task logic
- tighten HIV monthly return and DHIS2-facing reporting outputs

Definition of done:
- care teams can work from a live HIV population view
- overdue VL, refill gap, and EAC patients are visible without manual hunting

#### Sprint 4: HIV Intervention Engine

Primary goal:
- make HIV follow-up execution excellent

Scope:
- outreach worklists for unsuppressed VL, missed appointments, refill gaps, and pediatric/pregnancy watchlists
- regimen change workflow with structured reasons, approvals, and audit
- EAC session tracking with due dates and completion state
- pharmacy and visit behavior signals surfaced to clinicians
- patient communication templates and recall outcomes linked back into the HIV registry

Definition of done:
- the system closes the loop from HIV risk detection to outreach to documented resolution

#### Sprint 5: Closed-Loop Doctor-Nurse Coordination

Primary goal:
- eliminate dropped handoffs between nurse intake and doctor action

Scope:
- create explicit handoff states: captured, escalated, acknowledged, seen, resolved
- build a unified nurse-to-doctor escalation queue for triage risk, abnormal vitals, pending orders, and critical labs
- add SLA timers and escalation aging
- embed doctor-ready summaries fed from nurse-entered context
- link actions back to orders, notes, messages, and audit logs

Definition of done:
- urgent nurse findings cannot disappear into module sprawl
- doctors see one actionable queue with reason, severity, timer, and patient context

#### Sprint 6: Clinical Operations Closure

Primary goal:
- make handoff and acute coordination measurable and operationally useful

Scope:
- analytics for acknowledgment time, resolution time, nurse backlog, doctor backlog, and escalation source
- closed-loop follow-up for abnormal vitals, critical labs, and unresolved orders
- role-specific dashboards for nurse leads and medical directors
- exception reporting for items left unresolved past SLA

Definition of done:
- operations leaders can identify which teams, clinics, or shifts are dropping urgent work

#### Sprint 7: Revenue Cycle Intelligence Foundation

Primary goal:
- move from billing capture to prevention-first revenue operations

Scope:
- eligibility verification workflow with structured status capture
- front-desk and accounts visibility into active coverage, pending verification, and pre-auth needs
- claim readiness checks before submission
- missing-document detection for notes, coding, referral, and attachment requirements
- payer-specific edit rules for common denial causes

Definition of done:
- claims can be blocked or flagged before submission when the package is incomplete

#### Sprint 8: Collections and Denial Management

Primary goal:
- turn revenue cycle into an operating system for collections and recovery

Scope:
- denial work queue with reason categories and next action
- payer aging dashboard by payer, clinic, provider, and service line
- remittance and reconciliation visibility
- resubmission workflow and owner assignment
- first-pass acceptance, denial rate, turnaround time, and A/R metrics in-product

Definition of done:
- clinic owners and accounts teams can see where money is delayed, why, and who owns the next action

### 13.4 Workstream ownership

Recommended ownership model:

- Platform reliability: 1 backend lead, 1 DevOps-capable engineer, 1 QA owner
- HIV depth: 1 product lead, 1 clinician SME, 2 engineers, 1 QA owner
- Doctor-nurse coordination: 1 workflow/product lead, 2 engineers, 1 frontend-heavy engineer, 1 QA owner
- Revenue cycle: 1 product lead with finance SME, 2 engineers, 1 analytics/reporting engineer, 1 QA owner

### 13.5 Release order

If capacity is constrained, release in this order:

1. Sprints 1 and 2 as mandatory foundation
2. Sprints 3 and 4 to establish HIV dominance
3. Sprints 5 and 6 to establish operational coordination superiority
4. Sprints 7 and 8 to strengthen commercial ROI and collections performance

### 13.6 What should wait until after this roadmap

The following should stay out unless directly needed:

- broad new specialty expansion
- patient-mobile feature sprawl
- cosmetic redesign projects not tied to workflow performance
- low-value AI demos without measurable clinical or financial impact
