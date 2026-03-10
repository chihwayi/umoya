# MediCore

MediCore is a multi-tenant EHR platform for clinics and hospitals. This repository contains the admin portal, clinician-facing EHR, patient portal, tenant management service, core EHR service, and the CDSS/AI service.

The documentation set was consolidated on March 10, 2026. The root overview stays here; the full product and technical reference lives in [docs/MEDICORE_SYSTEM_REFERENCE.md](./docs/MEDICORE_SYSTEM_REFERENCE.md).

## What is in this repo

| Area | Path | Purpose |
| --- | --- | --- |
| Super admin portal | `web-app/` | Tenant operations, backups, health, audit, terminology, CDSS admin |
| Staff EHR frontend | `ehr-frontend/` | Multi-role clinical and operational web app |
| Patient portal | `patient-portal/` | Patient self-service, messaging, telemedicine, reminders, records, bills |
| Tenant service | `services/tenant-service/` | Tenant lifecycle, tenant users, analytics, backups, provisioning |
| EHR service | `services/ehr-service/` | Main clinical API, interoperability, billing, specialty workflows |
| CDSS service | `services/cdss-service/` | Clinical decision support, AI/LLM hooks, transcription support, evaluation |
| Infra and schemas | `database/`, `monitoring/`, `infrastructure/`, `scripts/` | Provisioning, monitoring, utilities, seed data |

## Product scope

MediCore already goes far beyond a basic clinic EMR. The current codebase includes:

- Multi-tenant provisioning and tenant-scoped data isolation
- Staff auth, RBAC, profile management, and EHR 2FA endpoints
- Patient registration, appointments, vitals, notes, orders, prescriptions, billing, payments, claims, referrals, care plans, and documents
- Secure provider messaging, notifications, reports, and analytics
- HIV, maternity, oncology, ophthalmology, cardiology, diabetes, pharmacy, immunization, ED, OR, anesthesia, blood bank, infection control, sepsis, case management, and revenue cycle modules
- Patient portal workflows for appointments, records, labs, prescriptions, reminders, bills, PROs, messages, telemedicine, goals, consents, pathways, immunizations, family access, and admission visibility
- Interoperability through FHIR, HL7, CCDA, WHO SMART Guidelines, DHIS2, terminology, and medical-aid integrations
- CDSS capabilities for drug safety, guidelines, risk scoring, diagnostic support, transcription, and post-visit AI workflows

## Default local runtime

| Component | Default port |
| --- | --- |
| EHR frontend | `3000` |
| Tenant service | `3001` |
| Web admin portal | `3011` |
| Grafana | `3012` |
| EHR API | `3013` |
| Patient portal | `3015` |
| CDSS API | `8000` |
| PostgreSQL | `5432` |
| Redis | `6379` |
| MinIO API / console | `9000` / `9001` |
| Prometheus | `9090` |

## Quick start

1. Create environment config.

```bash
cp .env.example .env
```

2. Install workspace dependencies.

```bash
npm install
```

3. Start the full stack.

```bash
docker compose up -d postgres-master redis minio tenant-service cdss-service cdss-worker ehr-service web-app ehr-frontend patient-portal prometheus grafana
```

4. Open the main surfaces.

- Admin portal: [http://localhost:3011](http://localhost:3011)
- Staff EHR: [http://localhost:3000](http://localhost:3000)
- Patient portal: [http://localhost:3015](http://localhost:3015)
- Tenant Swagger: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)
- EHR Swagger: [http://localhost:3013/api/docs](http://localhost:3013/api/docs)
- CDSS Swagger: [http://localhost:8000/docs](http://localhost:8000/docs)

## Recommended commands

```bash
npm run dev
npm run build
npm run test
npm run lint
```

Useful optional scripts:

```bash
npm run seed:sample-imaging
npm run seed:thandeka
npm run dhis2:bootstrap
```

## Source of truth

- System reference: [docs/MEDICORE_SYSTEM_REFERENCE.md](./docs/MEDICORE_SYSTEM_REFERENCE.md)
- Environment template: [.env.example](./.env.example)
- Compose stack: [docker-compose.yml](./docker-compose.yml)
