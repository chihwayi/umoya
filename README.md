# MediCore

MediCore is a production-grade, AI-first, multi-tenant EHR platform built for clinics and hospitals. It covers the full care continuum — from patient registration to discharge, billing, and post-visit follow-up — with a deeply integrated clinical AI layer.

## What's in this repo

| Path | Purpose |
|---|---|
| `web-app/` | Super admin portal — tenant operations, health monitoring, audit, CDSS admin |
| `ehr-frontend/` | Staff EHR — doctors, nurses, pharmacy, lab, radiology, accounts, admin |
| `patient-portal/` | Patient self-service — appointments, records, bills, telemedicine, messaging |
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

All AI calls go through a governed pathway that enforces consent checks, PHI redaction, prompt auditing, and circuit-breaking. Every AI output in the UI shows a confidence score, abstention state, AI-disclosure label, and citation drawer.

---

## Interoperability

- FHIR R4 endpoints
- HL7 messaging
- CCDA documents
- DHIS2 integration (HIV, immunization, maternal/newborn, pharmacy stock aggregates)
- WHO SMART Guidelines
- SNOMED / ICD-10 terminology
- Medical-aid and insurance integrations
- Patient health record exports — PDF, FHIR bundle, JSON, CSV

---

## Security & Compliance

- JWT authentication with 2FA
- Tenant-scoped data isolation — every request requires `X-Tenant-ID`
- HIPAA audit interception on all PHI access (append-only `hipaa_audit_logs`)
- Consent guard middleware before every CDSS PHI call
- AES-256-GCM encryption at rest for sensitive clinical columns
- CDSS PHI redaction, egress allowlisting, and encryption key rotation
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
| [docs/MEDICORE_REFERENCE.md](./docs/MEDICORE_REFERENCE.md) | Architecture, tech stack, AI governance patterns, CDSS endpoint registry, HIPAA rules, reporting landscape |
| [docs/MEDICORE_AI_FIRST_SPRINTS.md](./docs/MEDICORE_AI_FIRST_SPRINTS.md) | AI-First sprint specifications (S111–S118), provisioning bundle registry, 61/61 maturity validation |
| [docs/SPRINT-ROADMAP-AI-FIRST.md](./docs/SPRINT-ROADMAP-AI-FIRST.md) | Strategic sprint roadmap |
| [.env.example](./.env.example) | All required environment variables |
