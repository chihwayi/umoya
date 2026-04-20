# MediCore

MediCore is a production-grade, AI-first, multi-tenant EHR platform built for clinics and hospitals across Africa and the SADC region. It covers the full care continuum — from patient registration to discharge, billing, and post-visit follow-up — with a deeply integrated clinical AI layer and regional interoperability standards.

## What's in this repo

| Path | Purpose |
|---|---|
| `web-app/` | Super admin portal — tenant operations, health monitoring, audit, CDSS admin |
| `ehr-frontend/` | Staff EHR — doctors, nurses, pharmacy, lab, radiology, accounts, admin |
| `patient-portal/` | Patient self-service — appointments, records, bills, telemedicine, messaging |
| `mobile/` | Point-of-care mobile app — offline-capable Expo app for nurses and clinicians |
| `services/ehr-service/` | Core clinical API — 100+ controllers across all clinical and operational domains |
| `services/cdss-service/` | AI/CDSS service — clinical decision support, LLM inference, RAG, evaluation |
| `services/tenant-service/` | Tenant lifecycle, provisioning, analytics, backups |
| `database/`, `scripts/` | Schema provisioning, seed data, utilities |
| `monitoring/`, `infrastructure/` | Prometheus and Grafana configuration |

---

## Clinical Capabilities

### Core Workflows
- Patient registration with AI-assisted duplicate detection (phonetic matching), insurance card OCR pre-fill, and SDOH structured intake
- Appointments, scheduling intelligence, waitlists, and provider availability
- Multi-role clinical documentation — SOAP notes, nursing notes, clinical templates, ambient voice transcription
- Orders, problems, allergies, vitals, care plans, referrals, consents, and documents
- Prescriptions with drug-drug interaction hard-stops, PDMP controlled substance monitoring, and formulary optimization
- Lab orders, catalogs, order sets, critical result alerts, and interpretation AI
- Imaging workflows with DICOM viewer, AI heatmap overlays, and incidental finding SLA tracking

### Hospital & Specialty Modules
- Bed management and ADT
- Emergency department and triage
- Operating room and anesthesia
- BCMA / Medication administration record
- Blood bank
- Infection control and sepsis protocols
- HIV care, ART management, viral load tracking, DHIS2 reporting
- Maternity, oncology, ophthalmology, cardiology, diabetes
- Pharmacy dispensing with adherence monitoring
- Immunizations and travel vaccines
- Population health and care gap management
- Prior authorizations and claims management
- Revenue cycle — eligibility, denial prediction, appeals, collections

### SADC / Africa-Specific Modules (S143–S161)
- **Hypertension & Traditional Medicine** — HTN risk stratification, herb-drug interaction CDSS, traditional healer referral pathway
- **Sickle Cell Disease** — SCD register, crisis event tracking, HU treatment records, complication screening (VOC, stroke, ACS, renal)
- **Epilepsy / NCD Register** — Epilepsy register with AED prescribing, NCD complication cohort analytics, protocol decision support
- **One Health & PACTR** — Cross-species surveillance, zoonotic risk AI, PACTR clinical trial registry integration
- **Maternal Mortality Audit** — Near-miss classification (three-delay model), MDSR submission, preventability scoring AI
- **NCD Complication Management** — Diabetes foot exam, CKD GFR staging, CVD risk scoring, care gap analytics
- **NHIF / CBHI Capitation** — National health insurance capitation billing, community-based health insurance claims, CBHI member eligibility, batch remittance
- **Traditional Birth Attendant (TBA)** — Referral tracking, safe delivery kit inventory, TBA training records
- **CRVS Integration** — Civil registration vital statistics bridge for birth and death notifications
- **DISA / SmartCare Interoperability** — DISA HIV lab results import, SmartCare patient record exchange, PEPFAR program reporting
- **Ubuntu Cultural Health** — SDOH risk assessment, Ubuntu psychosocial wellbeing, family council consent, traditional medicine disclosure
- **UHC / SDG Analytics** — UHC service coverage index, SDG 3 progress tracking, catastrophic health expenditure, health equity index
- **NCID / Deduplication** — National client identifier resolution, probabilistic deduplication scoring, NCID federation
- **Low-Bandwidth / Offline Support** — SMS appointment reminders, Africa's Talking SMS/USSD gateway, offline-capable point-of-care sync
- **Cross-Border Continuity** — IHR / WHO international patient record portability, SADC cross-border continuity AI
- **Multilingual AI (i18n)** — All LLM-powered CDSS endpoints support `locale` parameter for multilingual output (English, Swahili, Shona, Zulu, French, Portuguese)

### Patient-Facing
- Secure login with tenant resolution
- Appointments, records, lab results, prescriptions, bills
- Medication reminders and adherence tracking
- Telemedicine (video consults)
- Secure messaging with providers
- Symptom checker and post-visit AI follow-ups
- Questionnaires, PRO schedules, health goals
- Family access, immunizations, consent management

---

## AI & Clinical Decision Support

MediCore is AI-first — every major clinical surface has an integrated AI layer governed through a single audited pathway.

| Capability | Description |
|---|---|
| Differential diagnosis | AI-assisted diagnosis suggestions with confidence scores and citations |
| Drug safety hard-stops | Contraindication checks block prescribing; PDMP flags controlled substance risk |
| Clinical RAG | pgvector + BM25 hybrid retrieval grounds all AI output in real clinical documents |
| Denial prediction | XGBoost pre-submission claim risk scoring with explainable top-3 reasons and RAG-grounded appeal letters |
| Patient risk stratification | 6-dimension composite risk tier (chronic conditions, vitals, adherence, SDOH, no-show, labs) with nightly batch |
| Early warning system | ML deterioration probability + NEWS2 breakdown surfaced in VitalsPanel |
| Radiology AI | DICOM viewer with AI attention heatmap overlay and incidental finding SLA tracking |
| Inbox triage AI | Priority assignment with `pending_review` fallback when AI is unavailable |
| Post-visit AI | Follow-up task generation, outcome capture, and self-learning feedback loop |
| AI Ops Dashboard | Per-surface accuracy, latency, abstention rate, and fairness audits (age, gender, SDOH) |
| Self-learning loop | Nightly outcome collection → weekly evaluation → release gate → model deployment |
| NCID deduplication AI | Probabilistic phonetic matching for national client identifier resolution across facilities |
| UHC / SDG analytics | UHC service coverage index, SDG 3 health goal progress, health equity index computation |
| Multilingual AI | All LLM endpoints accept `locale` parameter; output adapts to patient's language via locale instruction injection |
| SADC epidemic AI | Zoonotic risk scoring, maternal mortality preventability AI, SCD crisis prediction, NCD complication risk |
| Cross-border continuity AI | IHR-aligned AI summary for SADC patient record portability across borders |

All AI calls go through a governed pathway that enforces consent checks, PHI redaction, prompt auditing, and circuit-breaking. Every AI output in the UI shows a confidence score, abstention state, AI-disclosure label, and citation drawer.

---

## Interoperability

- FHIR R4 endpoints
- HL7 messaging
- CCDA documents
- DHIS2 integration (HIV, immunization, maternal/newborn, pharmacy stock aggregates)
- WHO SMART Guidelines + IHR international health regulations
- SNOMED / ICD-10 terminology
- SORMAS — surveillance, outbreak response, and epidemic management
- DISA — HIV laboratory results import for PEPFAR-aligned programs
- SmartCare — patient record exchange for SADC cross-facility continuity
- PACTR — Pan African Clinical Trials Registry integration
- Africa's Talking — SMS appointment reminders and USSD gateway for low-bandwidth access
- CRVS — Civil registration and vital statistics (birth and death notifications)
- Medical-aid and NHIF/CBHI insurance integrations
- Patient health record exports — PDF, FHIR bundle, JSON, CSV

---

## Security & Compliance

- JWT authentication with 2FA and cross-tenant validation — `tenantId` embedded in JWT payload; `JwtAuthGuard` cross-checks against `X-Tenant-ID` header, preventing token replay across clinics
- Tenant-scoped data isolation — every request requires `X-Tenant-ID`; DB-per-tenant architecture
- HIPAA audit interception on all PHI access (append-only `hipaa_audit_logs`)
- Consent guard middleware before every CDSS PHI call
- AES-256-GCM encryption at rest for sensitive clinical columns
- CDSS PHI redaction, egress allowlisting, and encryption key rotation
- Mobile: biometric login gate (Face ID / fingerprint), session auto-lock (background + 5-min inactivity), offline read cache clears PHI on logout
- SOC2/HIPAA evidence report script: `npm run report:soc2-hipaa`

---

## Quick Start

**1. Configure environment**
```bash
cp .env.example .env
```

**2. Install dependencies**
```bash
npm install
```

**3. Start the stack**
```bash
docker compose up -d postgres-master redis minio tenant-service cdss-service cdss-worker medical-aid-demo-service ehr-service web-app ehr-frontend patient-portal prometheus grafana
```

**4. Open the interfaces**

| Interface | URL |
|---|---|
| Staff EHR | http://localhost:3000 |
| Admin portal | http://localhost:3011 |
| Patient portal | http://localhost:3015 |
| EHR API docs | http://localhost:3013/api/docs |
| CDSS API docs | http://localhost:8000/docs |
| Tenant API docs | http://localhost:3001/api/docs |
| Grafana | http://localhost:3012 |
| Medical aid demo | http://localhost:3004 |

---

## Development Commands

```bash
npm run dev          # start all services in dev mode
npm run build        # build all packages
npm run test         # run all test suites
npm run lint         # lint all packages
```

Seed and utility scripts:
```bash
npm run seed:sample-imaging
npm run seed:thandeka
npm run dhis2:bootstrap
npm run provision:all-tenants
npm run report:soc2-hipaa
./scripts/smoke-medical-aid-demo.sh
```

---

## Runtime Ports

| Service | Port |
|---|---|
| EHR frontend | 3000 |
| Tenant service | 3001 |
| Medical aid demo | 3004 |
| Admin portal | 3011 |
| Grafana | 3012 |
| EHR API | 3013 |
| Patient portal | 3015 |
| CDSS API | 8000 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| MinIO API / console | 9000 / 9001 |
| Prometheus | 9090 |

---

## Documentation

| Document | Contents |
|---|---|
| [docs/MEDICORE_REFERENCE.md](./docs/MEDICORE_REFERENCE.md) | Architecture, tech stack, AI governance, CDSS endpoint registry (167 sprints), HIPAA rules, interoperability, sprint history |
| [.env.example](./.env.example) | All required environment variables |
