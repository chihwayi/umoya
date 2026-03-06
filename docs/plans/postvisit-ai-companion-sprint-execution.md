# Post-Visit AI Companion Sprint Execution Plan

Date created: March 5, 2026  
Owner: EHR Backend + Frontend + CDSS + Clinical Safety + Mobile

## Objective

Build a production-grade Post-Visit AI Companion that turns consultation audio into clinically usable, doctor-approved artifacts and patient-safe follow-up guidance, with closed-loop actions for doctor, nurse, lab, imaging, pharmacy, and accounts.

This plan extends current Medicore capabilities (voice transcription, CDSS, telemedicine, patient portal, cross-module queue), not a greenfield rewrite.

## Execution Status Update (March 6, 2026)

Sprint 5/6 implementation added:
- Post-visit FHIR projection endpoint:
  - `GET /post-visit/sessions/:id/fhir`
- Versioned mobile contracts:
  - `GET /post-visit/sessions/:id/mobile-contract?version=v1`
  - `GET /post-visit/sessions/:id/mobile-events?version=v1`
- Backend contract tests:
  - `post-visit.controller.spec.ts` and `post-visit.service.spec.ts`
- Grounded LLM safety layer:
  - doctor-note polishing from approved SOAP/context (citation-allow-list validated)
  - patient Q&A grounded to approved summary/checklist only (abstain + deterministic fallback on unsafe output)
  - implementation service: `PostVisitGroundedLlmService`
- QA automation additions:
  - `qa/tests/post-visit-fhir-mobile-contract-smoke.ts`
  - `qa/tests/post-visit-end-to-end-journey-smoke.ts`
- Sprint 6 release hardening artifacts:
  - `docs/release/post-visit-ai-companion-release-checkpoint-2026-03-06.md`
  - `docs/release/post-visit-ai-companion-cross-functional-signoff-2026-03-06.md`

## External Benchmark Snapshot (What We Verified)

- `postvisit.ai` public app bundle exposes feature claims including:
  - ambient recording to SOAP,
  - health companion follow-up,
  - labs/vitals longitudinal context,
  - guideline/evidence grounding,
  - HIPAA-ready, consent-first, audit logging.
- Cerebral Valley event metadata confirms a Claude Code hackathon gallery for early 2026.
- Relevant standards/guardrails validated:
  - HL7 FHIR R4 resources for Encounter, CarePlan, Communication, DocumentReference, ServiceRequest, Task, QuestionnaireResponse, Provenance.
  - CDS Hooks (hooks + cards + CDS service model).
  - SMART App Launch (launch context, scopes, PKCE, FHIR access).
  - NIST SP 800-66r2 (HIPAA Security Rule cybersecurity guidance).
  - NLM RxNorm program page for medication normalization.
  - NIST AI RMF 1.0 publication metadata.

See source links in the appendix.

## Current Baseline in Medicore

Already present and reusable:

- Voice capture + transcription API:
  - `POST /transcription/whisper`
  - SOAP note return path in transcription service.
- Frontend voice consultation components:
  - `VoiceConsultationPanel`, `VoiceConsultationButton`.
- Telemedicine consultation lifecycle + consent endpoints.
- CDSS proxy + recommendation execution architecture.
- Patient portal appointments/records/labs/prescriptions/messages.
- Unified context endpoint:
  - `GET /patients/:id/context` (already includes HIV, oncology, telemedicine, lab, imaging, pharmacy, etc.).
- Workflow execution persistence patterns:
  - recommendation bundles + `action_executions` in cross-module workflows.

Gap: these are not yet assembled into one coherent post-visit product with doctor signoff, patient-safe conversational follow-up, escalation intelligence, and mobile-first journey.

## Product Definition (Target)

### 1) Doctor Copilot Workspace (Post-Visit Command Center)

- Generate draft encounter outputs from voice + context:
  - SOAP,
  - assessment/plan,
  - order recommendations,
  - referral letter/sick note/work note drafts.
- Show confidence + source grounding + guideline citations per recommendation.
- One-click execute selected items into underlying workflows (existing execution patterns).
- Mandatory doctor review/signoff before patient-facing release.

### 2) Patient Post-Visit Companion

- Plain-language visit summary (multilingual option).
- Checklist of tasks (medication, labs, imaging, follow-up date, warning signs).
- Grounded Q&A limited to approved encounter + guideline context.
- “Teach-back” verification prompts (did patient understand instructions?).
- Urgent symptom escalation detection with safety routing.

### 3) Closed-Loop Team Sync

- Nurse queue receives follow-up tasks generated from signed post-visit plan.
- Lab/imaging/pharmacy order status updates feed back into companion and doctor panel.
- Accounts/billing workflow receives coded charge context from finalized plan.

## Differentiators (Beyond Current PostVisit-Like Pattern)

- Dual-control safety model:
  - AI draft -> clinician signoff -> patient release.
- Actionable, executable bundles:
  - not just recommendations, but one-click operational execution into module workflows.
- Longitudinal context fusion:
  - encounter transcript + existing patient context + unresolved module alerts.
- Evidence transparency:
  - per-recommendation citation mapping + provenance trail.
- Mobile-first interaction contract:
  - endpoints and payloads designed for patient/doctor/nurse mobile clients from day one.

## Architecture Changes

### A. New Domain Layer: Post-Visit Session

Add a core session object tied to consultation/appointment:

- `post_visit_sessions`
  - `id`, `tenant_id`, `patient_id`, `doctor_id`, `appointment_id`, `consultation_id`,
  - `status` (`captured|processing|draft_ready|doctor_reviewed|published|closed`),
  - `source_type` (`in_person|telemedicine|hybrid`),
  - `language`, `started_at`, `completed_at`,
  - `reviewed_at`, `reviewed_by`, `published_at`,
  - `safety_level`, `risk_flags` (jsonb).

### B. Transcript + Extraction

- `post_visit_transcript_segments`
  - diarized timeline, timestamps, confidence.
- `post_visit_extracted_entities`
  - symptoms, diagnoses, meds, allergies, vitals, social/risk context.
- Keep original and normalized values (for medico-legal and auditability).

### C. Clinical Artifact Drafts + Signoff

- `post_visit_draft_artifacts`
  - SOAP, summary, recommendation bundle, patient instructions, letters.
- `post_visit_review_actions`
  - accepted/edited/rejected sections with reason.
- `post_visit_publish_log`
  - what was exposed to patient, when, by whom.

### D. Companion Conversation + Escalation

- `post_visit_companion_threads`
- `post_visit_companion_messages`
- `post_visit_escalation_events`
  - trigger phrase/signals,
  - severity,
  - routing target (`emergency|doctor|nurse`),
  - resolution timestamps.

### E. Interop + Audit

- FHIR projection layer from signed artifacts:
  - Encounter, CarePlan, Communication, ServiceRequest, Task, DocumentReference, Provenance, QuestionnaireResponse.
- Reuse HIPAA audit service for all AI generation/review/publish actions.

## API Contract Additions (EHR Service)

### Doctor flow

- `POST /post-visit/sessions`
  - create session from appointment/consultation.
- `POST /post-visit/sessions/:id/transcribe`
  - attach/process audio, produce transcript + extraction + draft.
- `GET /post-visit/sessions/:id/draft`
  - full draft artifacts with citations/confidence.
- `POST /post-visit/sessions/:id/review`
  - doctor accepts/edits/rejects sections.
- `POST /post-visit/sessions/:id/publish`
  - publish approved patient version.

### Execution flow

- `POST /post-visit/sessions/:id/recommendations/:actionId/execute`
  - one-click module action execution (reuse action execution persistence model).

### Patient companion flow

- `GET /patient-portal/post-visit/sessions`
- `GET /patient-portal/post-visit/sessions/:id/summary`
- `POST /patient-portal/post-visit/sessions/:id/messages`
- `GET /patient-portal/post-visit/sessions/:id/messages`
- `POST /patient-portal/post-visit/sessions/:id/acknowledgements`
  - teach-back and adherence confirmations.

### Safety flow

- `GET /post-visit/escalations`
- `POST /post-visit/escalations/:id/resolve`

## Frontend Changes

### Doctor UI

- New panel/page: `PostVisitDoctorWorkspace`
  - timeline audio/transcript,
  - structured draft editor,
  - citation sidebar,
  - one-click recommendation execution,
  - publish controls.

### Patient UI (web now, mobile-ready contracts)

- New portal area: `PostVisitCompanion`
  - simplified summary cards,
  - action checklist,
  - grounded chat,
  - urgent escalation prompts.

### Nurse UI

- In nurse dashboard/cross-module feed:
  - post-visit generated follow-up tasks,
  - completion and SLA tracking.

## Mobile Readiness (Non-Negotiable Track)

- Keep payloads compact and paginated for mobile network constraints.
- Include deterministic status enums and idempotent action endpoints.
- Server-driven UI metadata for cards/checklists to reduce app release coupling.
- Push-notification event model:
  - doctor review needed,
  - patient follow-up due,
  - escalation triggered.

## Sprint Breakdown (12 Weeks)

### Sprint 1 (Weeks 1-2): Data Model + Session Lifecycle

- Add DB migration `035-post-visit-core.sql`.
- Add core session APIs (`create`, `draft fetch` placeholder).
- Persist transcript segments + extracted entities from existing transcription flow.
- Acceptance:
  - session created and linked to appointment/consultation,
  - transcript and extraction persisted,
  - no PHI leakage in logs.

### Sprint 2 (Weeks 3-4): Draft Artifact Engine + Citation Mapping

- Generate structured artifacts from transcript + `/patients/:id/context`.
- Per-rule citation linkage with confidence metadata.
- Doctor review action persistence.
- Acceptance:
  - deterministic JSON schema for draft artifacts,
  - citation list appears per recommendation item.

### Sprint 3 (Weeks 5-6): Doctor Execution + Workflow Sync

- Wire recommendation action execution endpoint.
- Reuse module execution pathways (oncology/HIV/cardiology/etc. pattern).
- Add idempotency guard for repeated clicks.
- Acceptance:
  - actions update module data and `action_executions`,
  - replay is idempotent and auditable.

### Sprint 4 (Weeks 7-8): Patient Companion + Safety Escalation

- Patient summary/checklist endpoints and UI.
- Grounded companion messaging tied to approved artifacts only.
- Escalation detection and routing.
- Acceptance:
  - patient never sees unapproved draft content,
  - urgent signals create escalation events with SLA clocks.

### Sprint 5 (Weeks 9-10): FHIR/Interop + Mobile Contracts

- Add FHIR projection mappings and provenance emission.
- Stabilize mobile payload schemas/events.
- Acceptance:
  - signed post-visit output is exportable/interoperable,
  - versioned API contract for mobile consumers.

### Sprint 6 (Weeks 11-12): Hardening + UAT + Release Gate

- End-to-end testing (doctor -> patient -> nurse/lab/imaging/pharmacy/accounts).
- Performance, security, and clinical safety gates.
- Production runbooks and release checklist.
- Acceptance:
  - UAT signoff complete,
  - release checklist passes with no P0/P1 defects.

## Clinical Safety and Governance Rules

- High-risk recommendations require explicit doctor signoff.
- AI must support abstention (no forced answer).
- Companion responses restricted to approved encounter context + vetted references.
- Every generation/review/publish action must be auditable.
- Escalation triggers must prioritize patient safety over conversational continuity.

## Metrics (Definition of Success)

- Doctor documentation time reduction (target: >= 40%).
- Post-visit plan publication within 15 minutes of consultation end.
- Patient comprehension/teach-back completion rate.
- Follow-up adherence rate (lab/imaging/medication).
- Escalation response SLA compliance.
- Hallucination safety rate:
  - 0 patient-facing answers without grounding provenance.

## QA/UAT Artifacts to Add

- `qa/uat/post-visit-ai-companion-uat-checklist.md`
- `qa/tests/post-visit-session-smoke.ts`
- `qa/tests/post-visit-companion-escalation-smoke.ts`
- `qa/tests/post-visit-doctor-signoff-and-execution-smoke.ts`

## Immediate Execution Order

1. Create migration and core entities for post-visit sessions/artifacts.
2. Add backend session + draft APIs and wire from current transcription flow.
3. Deliver doctor workspace MVP with review/publish.
4. Add patient companion summary and controlled chat.
5. Add escalation workflow and close-loop routing.

## Appendix: Source Links

- PostVisit landing/app shell: https://postvisit.ai
- PostVisit showcase bundle (feature claims): https://postvisit.ai/build/assets/Showcase-BsGx2U6O.js
- PostVisit evidence showcase bundle: https://postvisit.ai/build/assets/ShowcaseEbm-LhNkfFD0.js
- PostVisit tech/privacy showcase bundle: https://postvisit.ai/build/assets/ShowcaseTech-2yKBN7uy.js
- Cerebral Valley hackathon gallery metadata: https://cerebralvalley.ai/e/claude-code-hackathon/hackathon/gallery
- HL7 FHIR R4 Encounter: https://www.hl7.org/fhir/R4/encounter.html
- HL7 FHIR R4 CarePlan: https://www.hl7.org/fhir/R4/careplan.html
- HL7 FHIR R4 Communication: https://www.hl7.org/fhir/R4/communication.html
- HL7 FHIR R4 DocumentReference: https://www.hl7.org/fhir/R4/documentreference.html
- HL7 FHIR R4 ServiceRequest: https://www.hl7.org/fhir/R4/servicerequest.html
- HL7 FHIR R4 Task: https://www.hl7.org/fhir/R4/task.html
- HL7 FHIR R4 QuestionnaireResponse: https://www.hl7.org/fhir/R4/questionnaireresponse.html
- HL7 FHIR R4 Provenance: https://www.hl7.org/fhir/R4/provenance.html
- CDS Hooks specification: https://cds-hooks.org/specification/current/
- SMART App Launch (HL7 IG): https://build.fhir.org/ig/HL7/smart-app-launch/
- SMART scopes and launch context: https://build.fhir.org/ig/HL7/smart-app-launch/scopes-and-launch-context.html
- NIST SP 800-66r2 (HIPAA Security Rule guidance): https://csrc.nist.gov/pubs/sp/800/66/r2/final
- NIST AI RMF 1.0 PDF: https://nvlpubs.nist.gov/nistpubs/ai/nist.ai.100-1.pdf
- NLM RxNorm overview: https://www.nlm.nih.gov/research/umls/rxnorm/index.html
