# PostVisit AI Premium Advanced Sprint Execution Plan (V2)

Date created: March 6, 2026  
Owner: EHR Backend + Frontend + CDSS/AI + Clinical Safety + Platform  
Scope: Web platform completion (mobile-ready contracts, not full native app build)

## 1) Alignment Decision

This plan adopts the improvement direction from:
- `PostVisit-AI-Product-Intelligence-Report.docx`
- `DEVELOPMENT_GUIDELINES.md`

Decision: **Agree and proceed**, with sequencing adjusted to current Medicore baseline and already delivered Post-Visit work (session lifecycle, review/publish, companion, escalations, FHIR projection, mobile contracts, grounded LLM, doctor workspace, in-browser recording, local whisper support).

## 2) Program Objectives

1. Close safety-critical gaps first (audit chain-of-custody, escalation confidence, diarization quality, citation quality).  
2. Complete core clinical intelligence (OCR document intelligence, medication safety intelligence, specialty SOAP templates, multilingual teach-back).  
3. Add premium differentiators (real-time intra-visit intelligence, longitudinal patient story, smart billing, pre-visit brief).  
4. Finalize enterprise interoperability and hardening (FHIR write-back, peer consult, model/prompt governance, red-team safety, mobile-readiness contracts).

## 3) Non-Negotiable Engineering Rules

- Local-first inference for clinical content (`Ollama/llama3.1`, local whisper.cpp at `127.0.0.1:8080`), external fallback only where explicitly allowed.
- Every PHI read/write operation audited.
- Soft-delete only on PHI tables (`deleted_at`), no application-level hard delete.
- Business logic in services; controllers remain thin.
- Zod-validated LLM outputs before persistence/use.
- All new capabilities behind feature flags.
- Every DB change comes with migration + provisioning script + rollback plan.

## 4) Feature Flags (Must Exist Before Coding)

- `FEATURE_POSTVISIT_AUDIT_CHAIN=true|false`
- `FEATURE_POSTVISIT_ESCALATION_CONFIDENCE=true|false`
- `FEATURE_POSTVISIT_DIARIZATION_REVIEW=true|false`
- `FEATURE_POSTVISIT_CITATION_QUALITY_V2=true|false`
- `FEATURE_POSTVISIT_OCR_INTELLIGENCE=true|false`
- `FEATURE_POSTVISIT_MEDICATION_INTELLIGENCE_V2=true|false`
- `FEATURE_POSTVISIT_SPECIALTY_SOAP=true|false`
- `FEATURE_POSTVISIT_MULTILINGUAL_TEACHBACK=true|false`
- `FEATURE_POSTVISIT_INTRAVISIT_ALERTS=true|false`
- `FEATURE_POSTVISIT_PATIENT_STORY=true|false`
- `FEATURE_POSTVISIT_BILLING_INTELLIGENCE=true|false`
- `FEATURE_POSTVISIT_PREVISIT_BRIEF=true|false`
- `FEATURE_POSTVISIT_FHIR_WRITEBACK=true|false`
- `FEATURE_POSTVISIT_PEER_CONSULT=true|false`
- `FEATURE_POSTVISIT_ENTERPRISE_HARDENING=true|false`

## 5) Sprint Program (Advanced)

## Phase A: Safety Foundation (Do First)

### Sprint A1 (1 week): Audit Chain-Of-Custody + Prompt/Model Audit

Deliverables:
- Extend audit model to full PHI access logging coverage.
- Add append-only protection for `audit_events`.
- Add `prompt_audit_log` and `model_registry`.
- Add daily audit integrity hash job.

API/Backend:
- `GET /admin/audit/disclosure-report`

Acceptance:
- Any PHI-serving endpoint emits `PHI_READ` audit event.
- Attempted `UPDATE/DELETE` on `audit_events` blocked.
- Daily hash job produces verifiable integrity row.

---

### Sprint A2 (1 week): Escalation Confidence Scoring V2

Deliverables:
- Two-stage escalation pipeline:
  - Stage 1 keyword prefilter
  - Stage 2 local LLM classifier with confidence + temporality
- New doctor-facing confidence badge + confirm/dismiss actions.
- Persist all classifications (including low confidence/no-route events).

Backend:
- `POST /post-visit/escalation/classify` (internal service endpoint)
- Update `post_visit_escalation_events` metadata schema.

Acceptance:
- Emergency routing only for high confidence + current temporality.
- Sub-threshold events persisted and reviewable.

---

### Sprint A3 (1 week): Diarization Quality + Correction UX

Deliverables:
- Persist diarization segments with confidence threshold gating.
- `DiarizationReviewPanel` in doctor workspace.
- Correction telemetry by specialty.
- Signoff blocker for unresolved low-confidence attribution.

Backend:
- `GET /post-visit/sessions/:id/diarization`
- `POST /post-visit/sessions/:id/diarization/:segmentId/reassign`

Acceptance:
- Doctor can reassign unknown segments with undo.
- Signoff blocked when required attribution unresolved.

---

### Sprint A4 (1 week): Citation Quality V2

Deliverables:
- Add citation relevance score + recency + superseded flags.
- Publish blocking rule for superseded citations unless explicit doctor acknowledgement.
- Warning badges for old guidelines.

Acceptance:
- Weak relevance citations are excluded from publish output.
- Superseded citation acknowledgement captured in review audit.

## Phase B: Core Clinical Intelligence Completion

### Sprint B1 (1 week): Document Intelligence (OCR -> FHIR)

Deliverables:
- Local OCR pipeline for image/PDF upload.
- Structured extraction into typed document intelligence model.
- FHIR mapping (`Observation`, `MedicationRequest`, `DiagnosticReport`).
- Critical lab value auto-escalation routing.
- Duplicate document detection (>90% similarity).

UI:
- `LabTrendChart` in doctor workspace and patient companion summary view.

Acceptance:
- OCR outputs persisted + mappable FHIR resources produced.
- Critical values trigger non-emergency clinician queue events.

---

### Sprint B2 (1 week): Medication Intelligence V2

Deliverables:
- RxNorm normalization (`RxCUI`) pipeline.
- Interaction severity classification (`contraindicated/major/moderate/minor`).
- Beers Criteria alerts for 65+.
- Renal dosing alert logic for eGFR < 60 + renally cleared drugs.
- Personalized medication risk narrative from patient context.

Acceptance:
- New medication recommendations include interaction + personalized risk context.
- High-risk alerts rendered before signoff.

---

### Sprint B3 (1 week): Specialty SOAP Templates

Deliverables:
- `SOAPTemplateRegistry` and specialty-specific extraction/validation.
- Initial templates:
  - General Practice
  - Mental Health
  - Cardiology
  - Paediatrics

Acceptance:
- Encounter specialty drives required SOAP fields and validation.
- Missing specialty-required fields block publish/signoff.

---

### Sprint B4 (1 week): Multilingual + Literacy + Teach-Back

Deliverables:
- Patient preferred language support.
- Two-pass plain-language/literacy rewrite.
- Auto-generated teach-back questions.
- Companion topic checklist with follow-up shortcuts.

Acceptance:
- Patient summary is language-aware and literacy-scored.
- Teach-back questions are generated, persisted, and auditable.

## Phase C: Premium Differentiators

### Sprint C1 (1 week): Real-Time Intra-Visit Intelligence

Deliverables:
- Stream partial transcript processing during active consultation.
- `RealTimeAlertEngine` for allergy/interaction/dose/duplicate-order alerts.
- `IntraVisitAlertBar` in doctor consultation UI.

Acceptance:
- Alerts appear within target latency on local stack.
- All alerts confirm/dismiss auditable.

---

### Sprint C2 (1 week): Longitudinal Patient Story

Deliverables:
- Background job regenerating versioned patient story post-signoff.
- Doctor `PatientStoryPanel` with timeline + trends.

Acceptance:
- New encounter prep loads latest patient story snapshot.
- Version-to-version diff available.

---

### Sprint C3 (1 week): Smart Billing Intelligence

Deliverables:
- CPT/ICD suggestion pipeline from signed SOAP.
- Documentation sufficiency checker.
- Doctor approval workflow + billing audit log.

Acceptance:
- Suggestions show confidence + justification + documentation gaps.
- Approved codes tied to encounter audit trail.

---

### Sprint C4 (1 week): Pre-Visit AI Brief + Follow-Up Risk

Deliverables:
- Auto-generated pre-visit brief 60 minutes before appointment.
- Adherence risk scoring + risk-tiered nudge policy.
- Missed-task auto escalation to coordinator workflow.

Acceptance:
- Brief generated and delivered for scheduled appointments.
- High-risk follow-up policy applies deterministically.

## Phase D: Productivity + Integration + Enterprise

### Sprint D1 (1 week): Auto-Admin Docs + Voice Review

Deliverables:
- Template-driven referral/sick-note/RTW generation.
- Doctor e-sign + immutable output.
- Voice command review actions (`approve/edit/add followup/sign and publish`).

Acceptance:
- Signed document artifacts are immutable and dispatched with audit.
- Voice `SIGN_AND_PUBLISH` requires explicit confirmation.

---

### Sprint D2 (1 week): Clinical Trial Matcher + Companion Memory Deepening

Deliverables:
- ClinicalTrials.gov matching with de-identified query only.
- Eligibility assessment + doctor actions.
- Enhanced companion session memory and topic persistence.

Acceptance:
- Trial matches surfaced with no PHI external leakage.
- Companion answers reference prior session turns safely.

---

### Sprint D3 (1 week): FHIR Write-Back + Peer Consultation Gateway

Deliverables:
- SMART on FHIR launch context support.
- Write-back for signed artifacts/orders with retry + failure queue.
- Peer consultation request/response workflow with anonymization.

Acceptance:
- Write-back attempts logged in `fhir_sync_log`.
- Peer consult summaries are de-identified and traceable.

---

### Sprint D4 (1 week): Enterprise Hardening + Release Gate

Deliverables:
- Red-team suite (>=50 adversarial tests) in CI.
- Secret rotation checks + key age policy checks.
- SOC2/HIPAA evidence automation jobs.
- Final UAT checklist and production runbooks.

Acceptance:
- Release blocked automatically on red-team regressions.
- Go-live checklist passes with no P0/P1 defects.

## 6) Migration + Provisioning Plan

Planned migration sequence:
- `039-post-visit-audit-chain-of-custody.sql`
- `040-post-visit-escalation-confidence-v2.sql`
- `041-post-visit-citation-quality-v2.sql`
- `042-post-visit-document-intelligence.sql`
- `043-post-visit-medication-intelligence-v2.sql`
- `044-post-visit-specialty-soap.sql`
- `045-post-visit-multilingual-teachback.sql`
- `046-post-visit-realtime-intelligence.sql`
- `047-post-visit-patient-story-previsit-brief.sql`
- `048-post-visit-billing-intelligence.sql`
- `049-post-visit-admin-docs-voice-review.sql`
- `050-post-visit-trial-matcher-peer-consult-fhir-writeback.sql`
- `051-post-visit-enterprise-hardening.sql`

Provisioning scripts (paired with migrations):
- `scripts/provision-sprint52-post-visit-audit-safety.ts`
- `scripts/provision-sprint53-post-visit-escalation-confidence-v2.ts`
- `scripts/provision-sprint54-post-visit-core-intelligence.ts`
- `scripts/provision-sprint55-post-visit-premium-differentiators.ts`
- `scripts/provision-sprint56-post-visit-enterprise-gates.ts`

## 7) Test Strategy By Sprint

- Unit: service-layer logic and policy gates.
- Contract: API response schema and mobile contract stability.
- Integration: DB migration + queue/worker + event bus flows.
- UAT: doctor/nurse/patient end-to-end scenarios.
- Safety regression: red-team adversarial suite.

Mandatory CI checks for each sprint:
- Backend tests pass (`npm --workspace @medicore/ehr-service run test`)
- Backend build pass (`npm --workspace @medicore/ehr-service run build`)
- Frontend lint target pass for touched files
- New migrations apply cleanly on fresh DB

## 8) Success Metrics (Go/No-Go)

- Doctor doc time reduction >= 40%
- Post-visit publish within 15 minutes median
- Escalation triage precision improvement with confidence model
- Follow-up adherence uplift and missed-task recovery rate
- 0 patient-facing ungrounded responses
- 0 unaudited PHI access endpoints in release audit

## 9) Immediate Next Action

Current execution status:
1. **Sprint A1** completed (audit chain-of-custody + prompt/model audit + disclosure report endpoint).
2. **Sprint A2** started (confidence/temporality escalation classifier, routing gate, and queue visibility).
3. **Sprint A3** completed (diarization segments with confidence/threshold, Diarization Review in doctor workspace, publish blocked when `needs_review` unresolved; `GET/POST` diarization endpoints; `FEATURE_POSTVISIT_DIARIZATION_REVIEW`).
4. **Sprint A4** completed (citation relevance/superseded flags, publish blocking for unacknowledged superseded citations, weak relevance exclusion; doctor acknowledgement in workspace).
5. **Sprint B1** completed (Document Intelligence: local OCR pipeline, structured extraction, FHIR Observation/MedicationRequest/DiagnosticReport mapping, critical lab escalation routing, duplicate detection ≥90%, LabTrendChart in doctor workspace and patient companion summary; `GET` patient-portal `lab-trends`).
6. **Sprint B2** completed (Medication Intelligence V2: `FEATURE_POSTVISIT_MEDICATION_INTELLIGENCE_V2`; RxNorm/RxCUI dictionary + omeprazole/amlodipine/atorvastatin; interaction severity contraindicated/major/moderate; Beers 65+; renal eGFR &lt;60; personalized risk narrative in recommendations; HIPAA audit on PHI read for medication intel; high-risk alert gate before signoff with `acknowledgedMedicationHighRisk`; Doctor Workspace sends acknowledgment when high-risk alert present).
7. **Sprint B3** completed (Specialty SOAP templates: `SOAPTemplateRegistry` with General Practice, Mental Health, Cardiology, Paediatrics; specialty-driven required SOAP fields and validation; missing required fields block publish/signoff; HIPAA audit on PHI read for specialty SOAP validation).
8. **Next in sequence:** Phase B — **Sprint B4** (Multilingual + literacy + teach-back).
