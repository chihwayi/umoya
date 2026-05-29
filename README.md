# MediCore

MediCore is a production-grade, AI-first, multi-tenant electronic health record platform built for clinics, hospitals, and health ministries across Africa and the SADC region. It covers the full care continuum — from patient registration to discharge, billing, and post-visit follow-up — with a deeply integrated clinical AI layer and regional interoperability standards.

---

## Repository Layout

| Path | Purpose |
|---|---|
| `web-app/` | Super-admin portal — tenant operations, health monitoring, audit logs, CDSS administration |
| `ehr-frontend/` | Staff EHR — doctors, nurses, pharmacy, laboratory, radiology, accounts, and administration |
| `patient-portal/` | Patient self-service — appointments, records, bills, telemedicine, and secure messaging |
| `mobile/` | Point-of-care mobile app — offline-capable Expo application for nurses and clinicians |
| `services/ehr-service/` | Core clinical API — controllers spanning all clinical, operational, and financial domains |
| `services/cdss-service/` | AI and CDSS service — clinical decision support, LLM inference, RAG, and evaluation |
| `services/tenant-service/` | Tenant lifecycle management — provisioning, billing, analytics, and backups |
| `database/`, `scripts/` | Schema provisioning, seed data, and utility scripts |
| `monitoring/`, `infrastructure/` | Prometheus and Grafana configuration |

---

## Clinical Capabilities

### Core Workflows
- Patient registration with AI-assisted duplicate detection (phonetic matching), insurance card OCR pre-fill, and SDOH structured intake
- Appointments, scheduling intelligence, waitlists, and provider availability management — with AI no-show risk prediction and auto-generated pre-appointment briefs
- Multi-role clinical documentation — SOAP notes, nursing notes, clinical templates, ambient voice transcription (mobile), and AI-generated referral letters, discharge summaries, and pre-authorisations
- Orders, problems, allergies, vitals, care plans, referrals, consents, and document management — with AI-suggested orders routed through clinician approval
- Prescriptions with drug-drug interaction hard-stops, PDMP controlled substance monitoring, formulary optimization, and AI drug substitution for out-of-stock medications
- Laboratory orders, catalogs, order sets, critical result alerts, and dual AI interpretation narratives (clinical and patient-safe plain language)
- Imaging workflows with DICOM viewer, AI attention heatmap overlays, incidental finding SLA tracking, and structured AI findings review panel with confidence scores
- Proactive patient risk scoring (nightly composite across all active patients) with heat map, automatic nurse alerts, and 30-day mortality risk badge on every patient card
- Care gap detection — overdue HbA1c, HIV testing, cervical screening, flu vaccination, lapsed follow-up — with AI-recommended actions surfaced in EHR and mobile
- Post-encounter AI follow-up scheduler — recommends interval and modality (in-person / telemedicine / phone); nightly cron flags overdue follow-ups to the care team

### Hospital and Specialty Modules
- Bed management and ADT (admission, discharge, transfer)
- Emergency department triage
- Operating room and anaesthesia management
- Barcode medication administration (BCMA) and medication administration record
- Blood bank
- Infection control and sepsis protocols
- HIV care, ART management, viral load tracking, and DHIS2 reporting
- Maternity, oncology, ophthalmology, cardiology, and diabetes modules
- Pharmacy dispensing with adherence monitoring
- Central Storeroom and Inventory Management — multi-location inventory hub spanning medicines, vaccines, consumables, lab reagents, and emergency kits; FEFO dispensing, expiry tracking, cold-chain flagging, procurement automation, and AI demand forecasting tightly integrated into pharmacy, ward, lab, and maternity workflows
- Immunizations and travel vaccines
- Population health and care gap management
- Prior authorizations and claims management
- Revenue cycle — eligibility, denial prediction, appeals, and collections

### SADC and Africa-Specific Modules
- **Hypertension and Traditional Medicine** — HTN risk stratification, herb-drug interaction CDSS, traditional healer referral pathway
- **Sickle Cell Disease** — SCD register, crisis event tracking, hydroxyurea treatment records, complication screening
- **Epilepsy and NCD Register** — Epilepsy register with AED prescribing, NCD complication cohort analytics, protocol decision support
- **One Health and PACTR** — Cross-species surveillance, zoonotic risk AI, PACTR clinical trial registry integration
- **Maternal Mortality Audit** — Near-miss classification (three-delay model), MDSR submission, preventability scoring AI
- **NCD Complication Management** — Diabetes foot examination, CKD GFR staging, CVD risk scoring, care gap analytics
- **NHIF and CBHI Capitation** — National health insurance capitation billing, community-based health insurance claims, batch remittance
- **Traditional Birth Attendant** — Referral tracking, safe delivery kit inventory, TBA training records
- **CRVS Integration** — Civil registration and vital statistics bridge for birth and death notifications
- **DISA and SmartCare Interoperability** — DISA HIV lab results import, SmartCare patient record exchange, PEPFAR program reporting
- **Ubuntu Cultural Health** — SDOH risk assessment, Ubuntu psychosocial wellbeing, family council consent, traditional medicine disclosure
- **UHC and SDG Analytics** — UHC service coverage index, SDG 3 progress tracking, catastrophic health expenditure, health equity index
- **NCID Deduplication** — National client identifier resolution, probabilistic deduplication scoring, NCID federation
- **Low-Bandwidth and Offline Support** — SMS appointment reminders, Africa's Talking SMS/USSD stateful menus (appointment confirmation, refill requests, lab results, opt-out), offline-capable point-of-care sync with field-level conflict resolution
- **Cross-Border Continuity** — IHR and WHO international patient record portability, SADC cross-border continuity AI
- **Multilingual AI** — All LLM-powered CDSS endpoints support a `locale` parameter for output in English, Swahili, Shona, Zulu, Ndebele, Afrikaans, French, and Portuguese

### HIV Centre of Excellence

Advanced HIV programme management purpose-built for high-volume clinics operating under Zimbabwe CDPA 2021 and MOHCC protocols.

- **CDPA 2021 Compliance** — 18-control per-tenant compliance register; BAA vendor registry with seeded vendors; POTRAZ 72-hour breach notification workflow with overdue tracking; per-patient consent records (grant, withdraw, expiry) covering HIV testing, data sharing, SMS communication, treatment, and photography
- **MFA and Session Security** — TOTP 2FA via `speakeasy`; WebAuthn / FIDO2 hardware security key support (YubiKey, TouchID, FaceID) via `@simplewebauthn/server`; idle session timeout; AES-256-GCM column-level encryption on national ID, phone, and email fields; emergency bypass audit log
- **OI Early Warning and Geriatric HIV** — 6 opportunistic infection alert rules (PCP, Cryptococcal, MAC, CMV, Toxoplasmosis, TB) triggered by CD4 thresholds; VACS Index 2.0 comorbidity/mortality score for PLHIV ≥ 50; stable-patient fast-track classification; auto-geriatric flag on age ≥ 50
- **Drug Resistance and Multi-Month Dispensing** — Zimbabwe national ART formulary regimen-switch engine (NNRTI → PI second-line, LPV/r for pregnant, NATC approval for third-line); VL trend classification (suppressed/rising/failing/rebounding); MMD scheduling with eligibility criteria (3-month: VL suppressed ≥ 6 months; 6-month: VL suppressed ≥ 12 months); NHLS HL7 lab import with range validation
- **Adolescent HIV, Disclosure, and GBV** — Structured HIV disclosure status records; TRAQ 6-domain adolescent transition readiness assessment; HITS GBV screening tool (score ≥ 11 positive, ≥ 16 + weapon = imminent danger flag); role-restricted counsellor session notes (own notes only for counsellors; senior staff see redacted view)
- **Empowerment and Support Groups** — WEEP/MEEP economic empowerment programmes with enrolment, baseline/outcome economic indicators, and milestone tracking; peer support groups with session management and attendance recording
- **Clinical Training Platform** — Configurable CPD-accredited courses with MCQ assessment engine, per-question feedback, certificate generation, CPD ledger, and a searchable alumni deployment directory with facility map and CSV export
- **95-95-95 Cascade and Research** — HIV treatment cascade computation (diagnosed → on ART → suppressed) with sex and age-band disaggregation; LTFU definition (> 90 days past expected visit); 6/12/24-month retention cohorts; re-engagement recording; SQL-injection-safe JSONB cohort builder with field whitelist; Kaplan-Meier survival curves with Greenwood 95% CI
- **De-identification and Research Access** — 18 PHI identifier removal (HIPAA Safe Harbor); 5-year age banding; YYYY-MM date generalisation; age ≥ 90 → '90+'; time-limited public research portal access tokens shareable with external collaborators without requiring EHR accounts; VigiBase-compatible pharmacovigilance adverse event reporting with sequential case IDs
- **USSD Workflows and Adherence Nudges** — Stateful USSD session machine via Africa's Talking webhook (appointment confirm, refill request, lab result view, SMS opt-out menus); scheduled adherence nudge campaigns in English, ChiShona, and IsiNdebele; Bull queue bulk SMS dispatch with Twilio provider failover; opt-out registry
- **8-Language Localisation** — `react-i18next` in patient portal, EHR frontend, and Expo mobile (offline-embedded bundle); complete translation files in English, ChiShona, IsiNdebele, Kiswahili, isiZulu, Afrikaans, Français, and Português; language selector component; preference persisted to patient and staff records; PDF appointment letters and discharge summaries in the patient's preferred language
- **Breach Detection and Disaster Recovery** — 5-rule real-time anomaly engine (bulk download, brute-force login, after-hours sensitive access, audit log sequence gaps, unauthorised bulk export); SHA-256 hash-chained audit log with chain integrity verification endpoint; nightly encrypted `pg_dump` with AES-256-GCM, S3 upload, checksum verification, and `pg_restore` integrity check; security dashboard with anomaly acknowledgement, breach incident lifecycle, and DR test log
- **Clinical Monitoring Dashboards** — 5 provisioned Grafana dashboards (95-95-95 cascade gauges with 12-month trend, LTFU/retention rates, OI alert operations, MMD adherence, security anomalies); real-time OI/anomaly/MMD alert badge counts in EHR sidebar
- **Offline-First Hardening** — Field-level Last-Write-Wins conflict resolution (immutable: lab results; server wins: appointments; field merge: all clinical forms); offline coverage spanning HIV clinical visits, counselling sessions, GBV assessments, disclosure records, adolescent transition assessments, and counsellor sessions; conflict log for audit
- **Dental Module** — FDI 32-tooth notation chart with per-tooth condition coding (healthy, caries, filled, missing, crown, RCT, bridge, implant, extraction needed, watch); 6-point periodontal probing per tooth with bleeding-on-probing recording; treatment plan management with procedure codes and costs; colour-coded interactive chart UI
- **ANC HIV+ Pathway (PMTCT)** — ANC registration with EDD calculation (Naegele's rule); PMTCT visit schedule with gestational VL monitoring; maternal transmission risk flag when VL > 1,000 copies/mL at ≥ 36 weeks; NVP prophylaxis tracking (6-week standard, 12-week high-risk); Early Infant Diagnosis schedule generator (6w/4m/12m/18m due dates) with result recording and immediate ART flag on positive
- **Paediatric Growth Charts** — WHO 2006/2007 LMS z-score computation for WAZ, HAZ, WHZ, and BAZ; malnutrition categorisation (severe underweight WAZ < −3, stunting HAZ < −2, wasting WHZ < −2); nutrition referral auto-trigger when WAZ < −2; growth chart with WHO reference lines plotted against patient measurements
- **Paediatric ART Dosing** — MOHCC weight-band dosing table (3–5.9 kg through ≥ 25 kg) for ABC/3TC FDC, EFV, LPV/r liquid and tablet formulations; weight-band change detection with alert when a patient crosses to the next band; inline dose recommendation on ART initiation form
- **Role-Based Access Control** — 9-tier role matrix (`super_admin`, `admin`, `doctor`, `nurse`, `counsellor`, `lab`, `reception`, `pharmacist`, `researcher`) enforced globally; researcher role restricted to de-identified exports only

### Patient Health Education

Tenant-managed health education content with patient self-service enrollment, lesson progress tracking, and knowledge assessment.

- Staff with the health educator role author courses organised into modules and lessons; each lesson supports text, video URL, and PDF content types
- Full translation management — lesson content stored per language code; patients receive content in their preferred language with automatic English fallback
- Knowledge quizzes attached to lessons with configurable pass thresholds and maximum attempt limits; automatic scoring with pass/fail result
- Patients browse a tenant-specific course library, self-enroll, track lesson completion with progress bars, and receive course-complete status when all lessons are done
- Progress dashboard visible to staff showing per-patient completion percentage and best quiz score across all enrolled courses
- **AI-powered course personalization** — active diagnoses mapped to ranked course recommendations; mobile app surfaces matched courses in a horizontal chip scroll; clinicians can manually recommend specific courses per patient
- Available in all 8 supported languages; course reader accessible in patient portal and mobile app

---

## Smart Inventory and Central Storeroom

A fully integrated central inventory hub connecting pharmacy, ward, lab, maternity, and oncology to a single authoritative stock record with AI demand forecasting, expiry intelligence, and therapeutic substitution.

- **Multi-location Inventory** — Separate stock ledgers for pharmacy, ward stores, lab sites, and community stores; inter-location transfers with two-step receive confirmation; real-time dashboard with low-stock alerts, reorder thresholds, and consumption analytics
- **FEFO Dispensing** — First Expiry First Out batch selection enforced at every dispense and transfer; expiry alerts generated automatically at 7, 30, and 90 days; cold-chain flagging on refrigerated and frozen items with per-item notes
- **Soft Stock Reservations** — On prescription creation, stock is soft-reserved at the dispensing pharmacy; reservation is automatically released on dispense, prescription cancellation, or 24-hour expiry; prevents over-dispensing for high-demand and controlled drugs
- **Pharmacy and Ward Integration** — Dispensing workflow shows live reserved quantities alongside available stock; CDSS queries current availability before surfacing drug substitution suggestions; ward staff submit and track stock requests directly to the central store
- **Vaccine and Lab Reagent Tracking** — Vaccine inventory is linked to immunization administration records; lab reagent stocks are depleted as test results are entered; low-reagent alerts surface in the lab dashboard
- **Emergency Kit Management** — Per-location emergency kit par levels with automatic replenishment requests when an item falls below threshold; kit status dashboard accessible to nurses, doctors, and store managers
- **ARV and Chemotherapy Intelligence** — ARV stock compared daily against active patient load with a days-of-stock calculation; chemotherapy regimen component availability verified before dose preparation approval
- **AI Demand Forecasting** — LLM-augmented consumption trend analysis with seasonality detection; 30-day forward stock forecast per item and location; configurable horizon and AI-assisted anomaly flag when actual consumption diverges from forecast
- **Procurement Automation** — Supplier registry with lead times; purchase order lifecycle (draft → submitted → partially received → fully received); one-click AI-assisted reorder that auto-generates purchase orders for all items below the reorder level
- **Drug Substitution Engine** — When a prescribed drug is out of stock, ranked therapeutic equivalents are surfaced with confidence scores and AI rationale from direct drug mappings, ATC code family matching, and LLM clinical grounding; selection persisted for audit
- **Expiry Risk Reporting** — AI-generated cross-location expiry risk summary identifying high-waste items and recommending redistribution or accelerated usage before loss occurs
- **Role-Based Access** — Store managers and administrators manage catalog, stock adjustments, supplier orders, and transfers; pharmacists access FEFO batches, reservations, and substitution suggestions; nurses and doctors view emergency kit status and submit requests

---

## AI and Clinical Decision Support

MediCore is AI-first — every major clinical surface has an integrated AI layer governed through a single audited pathway.

| Capability | Description |
|---|---|
| Differential diagnosis | AI-assisted diagnosis suggestions with confidence scores and citations |
| Drug safety hard-stops | Contraindication checks block prescribing; PDMP flags controlled substance risk |
| Clinical RAG | pgvector + BM25 hybrid retrieval grounds all AI output in real clinical documents |
| Denial prediction | XGBoost pre-submission claim risk scoring with explainable top-3 reasons and RAG-grounded appeal letters |
| Patient risk stratification | 6-dimension composite risk tier (chronic conditions, vitals, adherence, SDOH, no-show, labs) with nightly batch |
| Early warning system | ML deterioration probability + NEWS2 breakdown surfaced in the vitals panel |
| Radiology AI | DICOM viewer with AI attention heatmap overlay and incidental finding SLA tracking |
| Ambient transcription | Whisper-based voice capture with failed-chunk retry queue and automatic PostVisit handoff |
| PostVisit AI | AI-generated visit summaries, follow-up task generation, outcome capture, and self-learning feedback loop |
| Inbox triage AI | Priority assignment with `pending_review` fallback when AI is unavailable |
| AI Ops Dashboard | Per-surface accuracy, latency, abstention rate, and fairness audits by age, gender, and SDOH |
| Self-learning loop | Nightly outcome collection → weekly evaluation → release gate → model deployment |
| NCID deduplication AI | Probabilistic phonetic matching for national client identifier resolution across facilities |
| UHC and SDG analytics | UHC service coverage index, SDG 3 health goal progress, and health equity index computation |
| Multilingual AI | All LLM endpoints accept a `locale` parameter; output adapts to the patient's language |
| SADC epidemic AI | Zoonotic risk scoring, maternal mortality preventability AI, SCD crisis prediction, NCD complication risk |
| Cross-border continuity AI | IHR-aligned AI summary for SADC patient record portability across borders |
| Proactive risk scoring | Nightly composite patient risk score (NEWS2, vitals, labs, adherence, missed appointments) with automatic nurse alerts for high/critical patients |
| Mortality risk prediction | 30-day composite mortality risk badge on every patient card — age, comorbidities, NEWS2, ICU status, and critical labs combined into a single defensible score with factor breakdown popover |
| AI clinical summary panel | Auto-generated 5-sentence patient summary on every record open — condition, medications, recent labs, mortality risk, and longitudinal pattern — with thumbs up/down feedback loop and regenerate |
| Treatment gap detection | Rule-based care gap engine detects overdue cervical screening, HbA1c, HIV testing, flu vaccination, and lapsed follow-up with AI-recommended actions, dismiss (30-day), and resolve workflows |
| AI-generated documents | One-click referral letters, discharge summaries, pre-authorisation requests, and sick notes — AI drafts from structured clinical data, clinician reviews and signs; patient portal shows only signed documents |
| Drug substitution engine | Out-of-stock medication → ranked therapeutic equivalents with confidence scores, rationale, and caveats sourced from CDSS, LLM grounding, and protocol rules; selection persisted for audit |
| Inventory demand forecasting | AI consumption trend analysis with seasonality detection; 30-day forward stock forecast per item and location; reorder suggestions auto-generated to prevent stockouts before they affect patient care |
| Storeroom anomaly detection | Consumption surveillance automatically flags sudden spikes, unexplained drops, and receive-vs-issue discrepancies across all inventory locations |
| Expiry risk AI | Cross-location expiry risk summary with redistribution and accelerated-usage recommendations; prevents medication and reagent waste before it occurs |
| AI follow-up scheduler | Post-encounter AI recommendation for optimal follow-up interval and modality (in-person / telemedicine / phone) based on risk band and diagnoses; nightly cron flags overdue follow-ups and alerts the care team |
| AI lab interpretation | Dual narrative per lab result — technical clinician narrative and patient-safe plain language; critical flags trigger real-time alerts; patients see "What does this mean?" expandable section |
| Appointment no-show prediction | Pre-encounter no-show risk score + auto-generated AI pre-appointment brief (diagnoses, recent labs, meds, tasks) delivered to the clinician 30 minutes before each visit |
| AI clinical timeline | Longitudinal patient narrative with pattern detection — recurring infections, drug failures, deteriorating vitals, missed appointments, chronic progression — using hash-based cache invalidation |
| Predictive adherence engine | Daily adherence risk scoring with personalised patient nudges (portal + SMS) containing medication names; nightly cron with 24-hour deduplication at both application and database level |
| AI communication hub | Urgency classification, AI draft replies, and auto-translation on every patient message; clinician approval required — AI never sends autonomously; inbox sorted by urgency |
| Radiology AI findings panel | Structured AI findings with confidence bars and reviewer workflow (confirmed / rejected / needs review); CDSS abstention logged transparently; critical/high urgency findings trigger alerts |
| Ambient voice AI | Mobile voice capture → Whisper transcription → structured clinical data extraction (vitals, chief complaint, plan) via CDSS or regex fallback; pre-fills encounter form fields |
| CDSS abstention transparency | Every AI surface shows real-time status (active / unavailable / abstained / low-confidence); silent abstentions logged to `ai_abstention_log` with reason codes; `GET /cdss/health` endpoint |
| Education personalization | Active diagnoses → ranked health education course recommendations; clinician can manually recommend specific courses per patient; mobile horizontal scroll of matched courses |
| Telemedicine post-call bridge | Daily.co webhook auto-triggers post-visit AI pipeline (summary, escalation check, follow-up tasks) on call end; idempotent with per-session deduplication and retry endpoint |
| Alert delivery wiring | OI early warning and NEWS2 alerts wired end-to-end to `AlertDeliveryService.broadcastCriticalAlert`; every clinical threshold breach reaches on-call staff via push notification |
| Post-visit escalation routing | Escalation classifier output wired to nurse task creation and push alert; `URGENT` escalations create tasks with 2-hour SLA; fallback to `pending_review` if CDSS unavailable |

All AI calls go through a governed pathway that enforces consent checks, PHI redaction, prompt auditing, and circuit-breaking. Every AI output in the UI includes a confidence score, abstention state, AI-disclosure label, and citation drawer.

---

## Interoperability

- FHIR R4 endpoints
- HL7 messaging
- CCDA documents
- DHIS2 integration (HIV, immunization, maternal/newborn, pharmacy stock aggregates)
- WHO SMART Guidelines and IHR international health regulations
- SNOMED CT and ICD-10 terminology
- SORMAS — surveillance, outbreak response, and epidemic management
- DISA — HIV laboratory results import for PEPFAR-aligned programs
- SmartCare — patient record exchange for SADC cross-facility continuity
- PACTR — Pan African Clinical Trials Registry integration
- Africa's Talking — SMS appointment reminders and USSD gateway for low-bandwidth access
- CRVS — Civil registration and vital statistics (birth and death notifications)
- Medical-aid, NHIF, and CBHI insurance integrations
- Patient health record exports in PDF, FHIR bundle, JSON, and CSV

---

## Security and Compliance

- JWT authentication with 2FA (TOTP via `speakeasy` and WebAuthn/FIDO2 hardware tokens) and cross-tenant validation — `tenantId` embedded in JWT payload; `JwtAuthGuard` cross-checks against `X-Tenant-ID` header to prevent token replay across facilities
- Tenant-scoped data isolation — every request requires `X-Tenant-ID`; database-per-tenant architecture
- HIPAA audit interception on all PHI access with append-only `hipaa_audit_logs`; SHA-256 hash-chained audit records with chain integrity verification to detect deletion or tampering
- Consent guard middleware before every CDSS PHI call; per-patient CDPA consent records with withdrawal tracking and expiry alerts
- AES-256-GCM encryption at rest for sensitive clinical columns (national ID, phone, email)
- CDSS PHI redaction, egress allowlisting, and encryption key rotation
- Real-time breach detection — 5 anomaly rules (bulk download, brute-force login, after-hours sensitive access, audit log gaps, unauthorised export); anomaly events escalate to breach incidents with POTRAZ 72-hour notification workflow
- Nightly encrypted database backups with SHA-256 checksum and off-site S3 storage; on-demand integrity verification via `pg_restore`
- 9-tier role-based access control enforced globally (`super_admin` → `researcher`)
- Mobile: biometric login gate (Face ID and fingerprint), session auto-lock on background and 5-minute inactivity, offline read cache cleared on logout
- SOC2 and HIPAA evidence report: `npm run report:soc2-hipaa`
- Zimbabwe CDPA 2021 compliance: 18-control register per tenant, BAA vendor registry, POTRAZ breach notification within 72 hours

---

## Patient-Facing Features

### Self-Service Portal and Mobile App
- Secure login with tenant resolution; caregiver and guardian login with invitation code
- Appointments view with upcoming and past visits; attendance confirmation
- Health records, lab results, prescriptions, and bills
- Medication reminders, adherence check-in, and refill requests
- Multi-Month Dispensing schedule view with next pickup countdown and dispensing history
- Telemedicine video consultations with pre-consultation form auto-linked to EHR clinical visit draft
- Secure messaging with providers; Whisper AI voice input for symptom and message composition
- Symptom checker and post-visit AI follow-ups
- AI lab interpretation — "What does this mean?" expandable plain-language narrative on every lab result
- Upcoming follow-up recommendations — accepted AI follow-up schedules visible in the patient's appointment view
- Questionnaires, patient-reported outcome schedules, and health goals
- CDPA consent dashboard — grant, view, and withdraw consent per processing purpose with expiry tracking
- Caregiver and guardian access management — grant access with relationship, access level, and expiry
- Family access, immunizations, and consent management

### HIV-Specific Patient Views
- ANC/EID tracker — pregnancy details, EDD, gestational VL monitoring, NVP prophylaxis status, EID timepoint schedule (6w/4m/12m/18m) with result recording
- Growth chart — WAZ/HAZ z-score history with WHO reference lines and malnutrition status
- Dental treatment plan summary — procedure list, costs, and completion status
- Support groups — enrolled groups, session history, attendance records, and next session date
- Communication preferences — per-nudge SMS toggle and global SMS opt-out with opt-back-in

### Health Education
- Browse and enroll in tenant-authored health education courses
- Module-by-module lesson reader with text, video, and PDF content types
- Progress bars showing lessons completed per course
- Knowledge quizzes with immediate scored feedback; course marked complete when all lessons done
- Language selector with 8 options — content delivered in the patient's preferred language

### Language and Accessibility
- Language selector with 8 options: English, ChiShona, IsiNdebele, Kiswahili, isiZulu, Afrikaans, Français, Português
- Language preference persisted to patient record across all sessions
- USSD self-service via Africa's Talking (`*123#`) — appointment confirmation, medication refill requests, recent lab result view, and SMS opt-out; no smartphone required
- PDF appointment letters and discharge summaries generated in the patient's preferred language

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
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Architecture rules, DB provisioning patterns, and agent constraints |
| [.env.example](./.env.example) | All required environment variables |
