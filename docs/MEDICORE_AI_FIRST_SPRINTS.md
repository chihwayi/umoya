# MediCore AI-First Sprints

**Last updated:** 2026-03-27
**Scope:** Sprint 111 (AI-First hardening) through Sprint 118 (frontend transparency) — specifications, acceptance criteria, and validation.

**Companion document:** `docs/MEDICORE_REFERENCE.md` — architecture, patterns, and CDSS registry.

---

## Maturity Summary

| Dimension | Before Sprint 112 | After Sprint 118 |
|---|---|---|
| HIPAA compliance | Multiple violations | Consent guard, AES-256-GCM encryption, prompt audit |
| AI signal visibility in UI | ~40% | 100% wired + confidence + abstention |
| Self-learning durability | SQLite `/tmp` | PostgreSQL, nightly batch, release gate |
| Drug safety | Advisory only | Hard-stop contraindications + PDMP |
| Financial AI | None | Denial prediction, appeals, hardship routing |
| Patient risk stratification | None | 6-dimension composite risk tier + nightly batch |
| Knowledge grounding | Hallucinated citations | pgvector + BM25 + RRF hybrid RAG |
| AI observability | None | AI Ops Dashboard — accuracy, latency, fairness |
| Self-learning flywheel | None | Outcome collection → eval → release gate → deploy |
| Radiology AI viewer | None | DICOM viewer + AI heatmap overlay |
| Registration AI | None | Phonetic match + OCR + SDOH intake |
| AI transparency (frontend) | None | FDA SaMD disclosure labels, confidence bands, abstention banners |

**Overall: 61/61 AI-First recommendations addressed. 0 gaps.**

---

## Provisioning Bundle Registry

| Sprint | Bundle ID | Version |
|---|---|---|
| Sprint 111 | sprint111_entity_completeness | 2026.03.26.2 |
| Sprint 112 | sprint112_p0_safety | 2026.03.27.1 |
| Sprint 112 | sprint112_feedback_persistence | 2026.03.27.2 |
| Sprint 113 | sprint113_ui_completeness | 2026.03.27.3 |
| Sprint 114 | sprint114_clinical_rag | 2026.03.28.1 |
| Sprint 115 | sprint115_denial_prediction | 2026.03.28.2 |
| Sprint 116 | sprint116_risk_stratification | 2026.03.29.1 |
| Sprint 116 | sprint116_self_learning | 2026.03.29.2 |
| Sprint 117 | sprint117_registration_ai | 2026.03.31.1 |
| Sprint 117 | sprint117_radiology_viewer | 2026.03.31.2 |

After every sprint:
```bash
./scripts/provision-repair-all.sh
node scripts/generate-tenant-provisioning-alignment.mjs
```

---

## Sprint 111 — AI-First Hardening Foundation

**Completed:** 2026-03-26

14 workstreams (MOAS-00 through MOAS-13) covering the foundational AI-first hardening:

| Workstream | Focus |
|---|---|
| MOAS-00 | Governed AI path enforcement |
| MOAS-01 | Consent guards on CDSS PHI calls |
| MOAS-02 | Encryption at rest (sensitive columns) |
| MOAS-03 | Provider governance |
| MOAS-04 | Financial AI foundations |
| MOAS-05 | Patient journey AI improvements |
| MOAS-06 | Drug safety baseline |
| MOAS-07 | Clinical documentation AI |
| MOAS-08 | Lab interpretation AI |
| MOAS-09 | Inbox triage AI |
| MOAS-10 | Early warning system |
| MOAS-11 | Pharmacy intelligence |
| MOAS-12 | Entity completeness + provisioning |
| MOAS-13 | Evaluation harness + release gates |

**Release signoff:** All 14 workstreams validated, tenant safety green, schema alignment green. Signed off 2026-03-26.

---

## Sprint 112 — P0 Safety Foundations

**Priority:** MUST DO FIRST. No new AI features until these are resolved.

### P0-1 — CDSS Feedback: SQLite → PostgreSQL

**Problem:** CDSS wrote feedback to `$TMPDIR/medicore_cdss_feedback.sqlite3` — lost on restart.

**Solution:**
- New tables: `cdss_feedback_batches`, `cdss_feedback_entries`
- New env var: `FEEDBACK_PG_DSN`
- asyncpg migration in CDSS `main.py`
- Provisioning bundle: `sprint112_feedback_persistence` (v2026.03.27.2)

### P0-2 — Consent Guard Middleware

**Problem:** CDSS PHI calls had no consent check (HIPAA §164.506 violation).

**Solution:**
- `ConsentService.checkAiConsent(patientId, 'cdss_ai_processing')`
- Guard injected into `CdssService.callGovernedJson()`
- `cdss_ai_processing` consent template seeded via provisioning

### P0-3 — Encryption at Rest (HIPAA §164.312)

**Solution:**
- AES-256-GCM transformer: `services/ehr-service/src/transformers/encryption.transformer.ts`
- Applied to: `post_visit_draft_artifacts.content`, `ambient_sessions.transcript_raw`
- New table: `encryption_key_versions`
- New env var: `ENCRYPTION_KEY`

### P0-4 — Drug Contraindication Hard-Stop

**Problem:** CONTRAINDICATED interactions were advisory — prescription still allowed.

**Solution:**
- Block prescription if `severity === 'contraindicated'` or `severity_score >= 5`
- HTTP 400 with code `CONTRAINDICATION_HARD_STOP`
- Override requires `doctor`/`senior_clinician` role + 20-char minimum reason
- `ContraindicationOverrideDto` with full audit trail

### P0-5 — Inbox Triage Fallback

**Problem:** When CDSS unavailable, inbox items fell through as `routine`.

**Solution:**
- CDSS `inbox_triage` output schema enforces `pending_review` as default fallback
- UI rendering: amber pulsing "Needs Triage" badge (see Sprint 113)

---

## Sprint 113 — UI Completeness

**Goal:** Every AI signal the backend generates must have pixels in the UI.

### Item 1 — VitalsPanel: ML Deterioration + NEWS2

- `EarlyWarningService` calls `callGovernedJson({ surface: 'ml_deterioration' })`
- Stores: `deteriorationProbability`, `riskHorizonHours`, `interventions[]`, `componentBreakdown`
- VitalsPanel renders: ML probability % with colour coding, expandable NEWS2 per-parameter table, interventions action list

### Item 2 — PharmacyDispensing: Adherence + Anomalies

- `adherenceConcerns[]` rendered as yellow/red badge chips (medicationName, adherencePercent, reason)
- `dispensingAnomalies[]` rendered as alert panel with severity badge

### Item 3 — GuidelineRecommendationCard: Citations

- `references[]` from CDSS rendered as clickable links with source, year, evidence grade

### Item 4 — ImagingReportComposer: Confidence + SLA

- Confidence % badge (green/amber/red) next to "Generate AI Draft"
- Incidental finding SLA countdown from `followupDueDate`
- "Escalate Now" button visible when ≤ 3 days remaining

### Item 5 — PatientAiFollowupsPage: Due Dates + Outcome Capture

- `dueAt` rendered with red highlight when past due
- "Did you complete this?" checkboxes → POST to `cdss_feedback_entries` → feeds self-learning

### Item 6 — PatientDashboard: AI Health Summary Banner

- Risk level badge, condition summary, health insights banner

### Item 7 — Inbox: `pending_review` State

- Amber "Needs Triage" badge with pulse animation for `pending_review` items

### Item 8 — CareGapPanel: ICD Code Badges

- ICD code chip rendered next to each gap type label

---

## Sprint 114 — Clinical RAG Knowledge Base

**Goal:** Replace hallucinated citations with real, grounded clinical documents.

### What Was Built

**Database:**
- `CREATE EXTENSION IF NOT EXISTS vector` in provisioning (`sprint114_clinical_rag` v2026.03.28.1)
- PostgreSQL image changed to `pgvector/pgvector:pg15`
- Tables: `clinical_knowledge_documents`, `clinical_knowledge_chunks` with `embedding vector(384)` column

**CDSS endpoints:**
- `POST /knowledge/ingest` — PDF parsing + sentence-transformer embeddings + chunking
- `POST /knowledge/search` — hybrid retrieval: cosine similarity + BM25 + Reciprocal Rank Fusion (RRF)
- `rag_search_logs` table for retrieval auditing

**EHR service:**
- `KnowledgeIngestService`, `KnowledgeController`
- `/guidelines/search` now calls RAG before LLM, returns `sources[]` from real documents

**Frontend:**
- `KnowledgeBasePage.tsx` — drag-drop PDF upload, document list with status, delete action
- `GuidelineRecommendationCard` renders real citations from `sources[]`

---

## Sprint 115 — Denial Prediction & Financial AI

### New Entities & Tables

| Entity | Table | Provisioning |
|---|---|---|
| `ClaimRiskScore` | `claim_risk_scores` | sprint115_denial_prediction (v2026.03.28.2) |
| `ClaimAppeal` | `claim_appeals` | same bundle |
| `FinancialHardshipReferral` | `financial_hardship_referrals` | same bundle |
| `PdmpCheck` | `pdmp_checks` | same bundle |

### Denial Prediction

- CDSS `POST /cdss/claims/denial-prediction` — XGBoost/sklearn with heuristic fallback
- Returns: `denial_probability`, `top_reasons[]` (code, description, weight), `recommended_actions[]`
- **70%** → warn, **90%** → block
- Override endpoint requires 30-char minimum reason
- `ClaimRiskBadge.tsx` with inline warn/block badge and override modal

### Appeal Letter Generation

- CDSS `POST /cdss/claims/appeal-template` — RAG-grounded from clinical knowledge base
- `AppealLetterPanel.tsx` — editable draft with citation display

### Financial Hardship Routing

- Auto-triggered for blocked claims > $10,000
- CDSS returns `programs_matched[]` (assistance programs)
- `FinancialHardshipReferral` entity tracks status workflow

### PDMP Controlled Substance Check

- CDSS `POST /cdss/pharmacy/pdmp-check` — MME calculation, multi-prescriber detection, substance history flags
- `PharmacyService.checkPdmp()` blocks dispensing at `risk_score >= 0.75`

### Self-Learning Wiring

- `POST /claims/:claimId/outcome` writes `actual_outcome` to `claim_risk_scores`
- Training script `train-denial-prediction-model.py` uses labeled outcomes for retraining

---

## Sprint 116 — Risk Stratification & Self-Learning

### New Entities & Tables

| Entity | Table | Provisioning |
|---|---|---|
| `PatientRiskTier` | `patient_risk_tiers` | sprint116_risk_stratification (v2026.03.29.1) |
| `RiskStratificationBatch` | `risk_stratification_batches` | same bundle |
| `ModelDeployment` | `model_deployments` | sprint116_self_learning (v2026.03.29.2) |
| `AiOpsMetric` | `ai_ops_metrics` | same bundle |

### Risk Tier Engine

CDSS `POST /cdss/risk/stratify` — 6-dimension composite score:

| Dimension | Weight | Source |
|---|---|---|
| Chronic conditions | 30% | ICD codes + `CHRONIC_CONDITION_WEIGHTS` dict |
| Vitals trend (NEWS2) | 25% | NEWS2 score normalised 0-1 |
| Medication adherence | 15% | Dispensed/total ratio from `pharmacy_dispensings` |
| SDOH | 15% | `sdoh_screenings` table + `SDOH_MAP` (8 risk factor types) |
| No-show history | 10% | `appointments` 180-day window |
| Lab trends | 5% | Abnormal results in `lab_orders.results` JSONB (30-day) |

**Tiers:** Critical / High / Medium / Low / Minimal
**Recommended actions:** type, priority (1–3), `dueWithinDays`
**Triggered actions:** `social_worker_referral` when SDOH score > 0.3, `outreach_call` when no-show rate > 50%

### Nightly Batch Job

- `RiskStratificationService.runBatch()` with `@Cron('0 0 * * *')`
- `RiskStratificationBatch` entity tracks progress + counts

### Self-Learning Loop

- `OutcomeCollectionService.collectOutcomes()` with `@Cron('0 1 * * *')` — 30-day lookback on `prompt_audit_log`
- Per-surface resolution logic: `vitals_interpretation` → ICU admission check, `denial_prediction` → claim outcome check
- Weekly model evaluation `@Cron('0 2 * * 0')` — writes per-surface accuracy/latency/fairness to `ai_ops_metrics`
- Release gate: blocks `approved_for_learning` if accuracy drops > 5% week-over-week
- Approved feedback → `POST /feedback/outcome/learning/claim` → CDSS model update → `ModelDeployment` record

### Fairness Audits

Three parity metrics stored in `ai_ops_metrics` and displayed on AI Ops Dashboard:
- `fairness_age_parity` — accuracy by age group
- `fairness_gender_parity` — accuracy by gender
- `fairness_sdoh_parity` — accuracy for SDOH-risk vs non-SDOH-risk patients

### Frontend

- `RiskTierBadge.tsx` — full variant (contributing factors + actions) and compact (inline pill)
- `AiOpsDashboard.tsx` at `/ai-ops` — per-surface cards with total calls, abstention rate, accuracy, latency, fairness parity, 30-day accuracy trend chart

---

## Sprint 117 — Registration AI + DICOM Viewer

### Part A — Registration AI

**Phonetic duplicate detection:**
- Extensions provisioned: `pg_trgm`, `fuzzystrmatch`
- GIN trigram indexes on `patients.first_name`, `patients.last_name`
- `GET /registration/match/phonetic` — `SIMILARITY()` + `SOUNDEX()` query
- `PatientDetailsStep` shows duplicate warning panel (similarity %) and blocks completion until dismissed

**Insurance card OCR:**
- `POST /registration/ocr-insurance-card` multipart endpoint
- CDSS `POST /cdss/registration/ocr-insurance-card` — pytesseract + regex extraction
- `InsuranceCardStep` auto-fills: member ID, group number, plan name, payer
- Manual fallback for low-confidence scans
- New table: `insurance_ocr_results`

**SDOH structured intake:**
- CDSS `POST /cdss/registration/sdoh-questions` — 10 AHC HRSN screener questions
- `SdohScreeningStep` as registration step 3
- CDSS `POST /cdss/registration/sdoh-score` — risk scoring
- Risk factors written to `sdoh_screenings` table with `screening_tool: 'AHC_HRSN_v1'`
- Auto-generated referrals: social work, food assistance, behavioural health

**New tables:** `registration_ai_sessions`, `insurance_ocr_results`
**Provisioning:** `sprint117_registration_ai` (v2026.03.31.1)

### Part B — DICOM Viewer

**Infrastructure:**
- Cornerstone.js (`cornerstone-core` + `cornerstone-wado-image-loader`) in `DicomViewer.tsx`
- WADO-RS proxy: `GET /imaging/wado/:studyUid/:seriesUid/:instanceUid` — serves DICOM bytes from MinIO
- New table: `dicom_series`

**AI heatmap overlay:**
- CDSS `POST /cdss/imaging/attention-map` — heuristic region placement per finding type (GradCAM upgrade path noted)
- Returns `heatmap_regions[]` with bounding box coordinates
- Rendered as canvas overlay with toggle button + opacity slider
- `heatmap_regions JSONB` column added to `radiology_report_drafts`

**Wiring:** `DicomViewer` integrated into `ImagingStudyViewerModal.tsx`
**Provisioning:** `sprint117_radiology_viewer` (v2026.03.31.2)

---

## Sprint 118 — Frontend AI Transparency

**Goal:** Close 5 universal missing patterns across all 16 AI-facing components. Targets FDA SaMD and ONC HTI-1 compliance.

### 5 Universal Gaps Closed

1. **No confidence score displayed** — all AI components now show confidence band
2. **Abstention silently ignored** — `abstained: true` now shows `AbstentionBanner` ("AI cannot make a recommendation — clinician review required")
3. **No AI-generated disclosure label** — "AI-generated" badge added to all outputs (FDA/ONC requirement)
4. **Null guard crashes** — all CDSS array accesses protected with optional chaining and `?? []`
5. **Untyped CDSS fields** — `CdssBaseResponse` TypeScript interface enforces `confidence`, `abstained`, `citations`, `model_id`

### Shared Infrastructure Added

- **`CdssBaseResponse`** interface (`ehr-frontend/src/types/cdss.ts`) — base type all CDSS responses extend
- **`useCdssResponse<T>()`** hook — safe CDSS fetch with loading/error/abstention states
- **`<AiOutputWrapper>`** component — wraps any AI output with confidence band, abstention banner, citations drawer, feedback thumbs
- **`<AbstentionBanner>`** — displayed when CDSS returns `abstained: true`

### Components Updated (P0/P1)

LabResultsViewer, VitalsPanel, NursingNotes, PreChartPanel, PrescriptionsModal, AmbientBar, CdssDecisionFeedback, RiskTierBadge, AppealLetterPanel, SmartInbox, TriageQueue, DoctorImagingResultsPanel, SectionAskButton, CareGapPanel

### Self-Learning Loop Closed

- `POST /feedback/outcome/learning/claim` now returns `model_id` + version bump
- `GET /fl/model-version` — current model version per surface
- EHR service logs new model versions after retraining
- AI Ops Dashboard shows current model version per surface

---

## AI-First Validation — 61/61 Recommendations

| Category | Total | Covered | Gap |
|---|---|---|---|
| P0 Safety Foundations | 5 | 5 | 0 |
| UI Completeness | 13 | 13 | 0 |
| Clinical RAG | 5 | 5 | 0 |
| Denial Prediction + Financial AI | 7 | 7 | 0 |
| Patient Risk Stratification | 10 | 10 | 0 |
| Self-Learning Loop Closure | 6 | 6 | 0 |
| AI Ops + Monitoring | 5 | 5 | 0 |
| Radiology AI | 4 | 4 | 0 |
| Registration AI | 3 | 3 | 0 |
| Pharmacy AI | 3 | 3 | 0 |
| **TOTAL** | **61** | **61** | **0** |

Validation completed: 2026-03-27.
