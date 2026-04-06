# MediCore AI & CDSS Architecture

> Faithful implementation-oriented architecture reference for the AI stack that currently exists in this repository as of April 5, 2026.

---

## Table of Contents

1. [Purpose and Scope](#purpose-and-scope)
2. [Architectural Layers](#architectural-layers)
3. [AI Subsystem Inventory](#ai-subsystem-inventory)
4. [Runtime Model and Algorithm Inventory](#runtime-model-and-algorithm-inventory)
5. [Governance and Control Plane](#governance-and-control-plane)
6. [Canonical End-to-End AI Flows](#canonical-end-to-end-ai-flows)
7. [Storage and Data Plane](#storage-and-data-plane)
8. [API Surface Overview](#api-surface-overview)
9. [Web and Mobile Consumption](#web-and-mobile-consumption)
10. [Config-Dependent Behavior and Graceful Degradation](#config-dependent-behavior-and-graceful-degradation)
11. [What This Document Does and Does Not Claim](#what-this-document-does-and-does-not-claim)
12. [Update Checklist](#update-checklist)

---

## Purpose and Scope

This document is intentionally not a product pitch.

It is a code-faithful description of the AI stack implemented in this repo. It covers:

- the **CDSS core** running in `services/cdss-service`
- the **EHR orchestration layer** running in `services/ehr-service`
- the **learning, governance, monitoring, and promotion** surfaces around those models
- the main **web and mobile consumers** of those AI capabilities

The system is not a single AI pipeline. It is a layered AI platform with multiple independent but connected flows:

- clinician-facing diagnosis and guideline reasoning
- patient-facing AI interactions
- specialty decision support
- knowledge ingestion and retrieval
- transcription and imaging
- post-visit grounded drafting
- proactive longitudinal monitoring
- self-learning, federated learning, and release governance

Where behavior is conditional on configuration, this document says so explicitly.

---

## Architectural Layers

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           CHANNELS / CLIENTS                            │
│                                                                          │
│  Web EHR (broad specialty coverage)                                     │
│  Mobile app (doctor / nurse / patient focused slices)                   │
│  Patient portal APIs                                                     │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      EHR AI ORCHESTRATION LAYER                          │
│                                                                          │
│  NestJS services and controllers that:                                   │
│  - gather patient / workflow context                                     │
│  - call CDSS with auth / retry / policy                                  │
│  - persist AI artifacts                                                   │
│  - raise alerts / create follow-ups / expose workflow APIs               │
│                                                                          │
│  Examples:                                                               │
│  CdssService, PatientAiService, ProactiveAiService,                      │
│  EncounterCopilotService, RadiologyAiService,                            │
│  PostVisitGroundedLlmService, ClaimsAiService,                           │
│  RegistrationIntelligenceService, ModelRegistryService                   │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           CDSS CORE PLATFORM                             │
│                                                                          │
│  FastAPI app that provides:                                              │
│  - knowledge retrieval and RAG                                            │
│  - diagnosis, risk, dosing, lab, medication support                      │
│  - governed LLM JSON/text generation                                     │
│  - voice and image analysis                                               │
│  - specialty clinical endpoints                                           │
│  - feedback capture, self-learning, federated hooks                      │
│  - admin, metrics, audit, model and use-case governance                  │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                            DATA / CONTROL PLANE                          │
│                                                                          │
│  Tenant PostgreSQL DBs        Master DB                                  │
│  Redis                        MinIO                                      │
│  ChromaDB                     pgvector                                   │
│  Knowledge registry           Model registry / use-case policy tables    │
│  Ollama (primary local LLM)   Optional external services where enabled   │
└──────────────────────────────────────────────────────────────────────────┘
```

The critical distinction is:

- **CDSS core** is the central AI runtime and policy engine
- **EHR orchestration** turns those model calls into product workflows
- **clients** consume curated workflow outputs, not raw model primitives

---

## AI Subsystem Inventory

### 1. CDSS Core Platform

The FastAPI application in `services/cdss-service/main.py` currently exposes **153** declared routes. Its responsibilities go well beyond classic diagnosis support.

Main CDSS capability families:

- **Health and admin**
  - `/health`
  - `/admin/settings`
  - `/admin/models`
  - `/admin/ai-vendors`
  - `/admin/ai-usecases`
  - `/admin/jobs`
  - `/admin/metrics`
  - `/admin/audit`

- **Knowledge and retrieval**
  - `/admin/ingest`
  - `/admin/reindex`
  - `/knowledge/registry/status`
  - `/knowledge/registry/releases`
  - `/knowledge/ingest`
  - `/knowledge/search`
  - `/guidelines/search`
  - `/guidelines/check`

- **Core CDSS reasoning**
  - `/diagnosis/suggest`
  - `/diagnosis/suggest/intelligent`
  - `/patient/summarize`
  - `/risk/calculate`
  - `/risk/deterioration`
  - `/risk/deterioration/ml`
  - `/risk/readmission`
  - `/care-gaps/detect`
  - `/care-gaps/batch-detect`
  - `/labs/interpret`
  - `/labs/critical-check`
  - `/dosing/recommend`
  - `/drugs/interactions/advanced`
  - `/medications/duplicates`
  - `/medications/high-risk`
  - `/medications/food-interactions`

- **LLM and structured generation**
  - `/governed/json`
  - `/education/generate`
  - `/registration/documents/analyze`
  - `/nlp/extract-codes`

- **Voice and imaging**
  - `/transcribe`
  - `/transcribe/basic`
  - `/transcription/stream`
  - `/analyze-image`
  - `/radiology/analyze`
  - `/cdss/imaging/attention-map`

- **Patient and guided assistant surfaces**
  - `/symptom-check`
  - `/patient/adherence-chat`
  - `/patient/analyze/proactive`

- **Order, nursing, medication, discharge intelligence**
  - `/order/suggest-sets`
  - `/order/imaging-appropriateness`
  - `/order/prior-auth-predict`
  - `/nursing/care-plan`
  - `/nursing/sbar`
  - `/nursing/fall-risk`
  - `/nursing/wound-staging`
  - `/medication/reconciliation`
  - `/medication/pdmp-check`
  - `/discharge/intelligence`
  - `/discharge/follow-up-timing`

- **Self-learning and model operations**
  - `/feedback/outcome`
  - `/feedback/outcome/summary`
  - `/feedback/outcome/review/{entry_id}`
  - `/feedback/outcome/learning/claim`
  - `/feedback/outcome/batch-collect`
  - `/feedback/outcome/learning/accept-batch`
  - `/feedback/outcome/learning/retrain`
  - `/self-learning/shadow-eval`
  - `/self-learning/bias-audit`
  - `/self-learning/audit-anomaly`
  - `/fl/train-local`
  - `/fl/evaluate`
  - `/fl/aggregate`
  - `/fl/model-version`
  - `/model/load`
  - `/model/status`
  - `/model/performance`

- **Specialty CDSS families**
  - TB, HIV, mental health, malaria, geriatrics, neurology, pulmonology
  - nephrology, dermatology, palliative care, nutrition, ICU
  - PGx, formulary optimization, scheduling, IoT analysis
  - antimicrobial support, SDOH, trials, supply chain
  - claims denial prediction and appeal drafting

This means the CDSS is not just a search + diagnosis service. It is the central AI runtime for a large portion of the product.

### 2. EHR AI Orchestration Layer

The NestJS EHR service wraps CDSS into concrete workflows and also contains AI-specific orchestration that is not simply a thin proxy.

Key implemented orchestration subsystems:

| Subsystem | Primary implementation role |
|---|---|
| `CdssService` | Central CDSS client with auth headers, retries, circuit behavior, and shared request policy |
| `KnowledgeIngestService` | Stores tenant clinical documents in MinIO and triggers tenant-scoped CDSS ingestion |
| `TranscriptionService` | Chooses local whisper path first, can fall back to OpenAI Whisper where configured |
| `RadiologyAiService` | Registers studies, triggers asynchronous CDSS analysis, persists findings, broadcasts critical alerts |
| `PatientAiService` | Orchestrates symptom checking, adherence chat, escalation, follow-up workflows, and audit |
| `ProactiveAiService` | Produces patient AI snapshots, active alerts, and risk history for longitudinal monitoring |
| `EncounterCopilotService` | Builds encounter sessions from longitudinal chart context, smart defaults, care gaps, pathways, and follow-up tasks |
| `PostVisitGroundedLlmService` | Runs governed post-visit drafting: patient answers, doctor polish, escalation classification, referral letters, clinical notes |
| `RegistrationIntelligenceService` | Handles duplicate detection, intake assessment, eligibility verification, document extraction |
| `RegistrationAiService` | Additional registration-oriented AI helpers used by intake flows |
| `ClaimsAiService` | Denial risk scoring, appeal drafting, override handling, PDMP risk checks |
| `PredictiveRiskService` | Deterioration and readmission predictions/history surfaces |
| `RiskStratificationService` | Batch and patient-level risk tiering |
| `FederatedLearningService` | Creates and tracks FL rounds, submissions, and promotion inputs |
| `ModelRegistryService` | Promotion, rollback, model cards, history, shadow-evaluation governance |
| `ModelMonitoringService` | Metrics, fairness, offline eval runs, release gates, readiness, AI ops reporting |
| `AiExplainabilityService` | Audit history, override capture, recommendation display tracking |
| `WhoSmartGuidelinesService` | WHO Smart Guideline workflow surfaces distinct from raw CDSS RAG |

### 3. Workflow-Centric AI Subsystems

Several AI capabilities are product workflows in their own right and should be understood as such:

- **Patient AI**
  - symptom triage
  - adherence support
  - escalation routing
  - follow-up orchestration

- **Proactive AI**
  - longitudinal patient snapshot generation
  - active alert surfacing
  - risk history tracking

- **Encounter Copilot**
  - contextual summary generation
  - suggested orders
  - likely care gaps
  - pathway recommendations
  - order appropriateness review
  - result follow-up task generation

- **Post-Visit AI**
  - grounded patient Q&A
  - clinician-facing draft polishing
  - escalation classification
  - referral letter drafting
  - clinical note drafting

- **Radiology AI**
  - study registration
  - asynchronous inference
  - result persistence
  - critical alert broadcast
  - radiologist review loop

These are not fully represented by a single RAG diagram. They have their own persistence, routing, and governance behavior.

---

## Runtime Model and Algorithm Inventory

This section distinguishes between:

- true ML / transformer models
- classical ML
- retrieval algorithms
- governed rule systems
- orchestration logic around those models

### Retrieval and Search

| Component | Runtime role |
|---|---|
| `sentence-transformers/all-MiniLM-L6-v2` | Query and chunk embeddings for semantic retrieval |
| `cross-encoder/ms-marco-MiniLM-L-6-v2` | Precision reranking of retrieved candidates |
| `rank-bm25` / BM25Okapi | Lexical keyword search |
| Reciprocal Rank Fusion | Fuses vector and lexical ranks |
| ChromaDB | Fast vector store and fallback retrieval layer |
| pgvector | Persistent tenant-aware vector retrieval layer |
| Knowledge registry | Release-reviewed fallback content layer when vector search is unavailable or empty |

### Clinical NLP and Preprocessing

| Component | Runtime role |
|---|---|
| scispaCy `en_core_sci_sm` | Primary clinical tokenization / NLP preprocessing |
| spaCy `en_core_web_sm` | Fallback NLP |
| NLTK assets | Sentence segmentation support for ingestion libraries |
| custom abbreviation expansion | Query enrichment before retrieval |
| custom metadata tagging heuristics | Domain, population, source metadata assignment |

### Diagnosis and Core Clinical Reasoning

| Component | Runtime role |
|---|---|
| `medbert/medbert-base` | Structured-data diagnosis signal when model download/use is enabled |
| `emilyalsentzer/Bio_ClinicalBERT` | Note-text diagnosis signal when enabled |
| rule engine | Deterministic clinical rules and symptom matching |
| fusion engine | Combines model and rule signals |
| Zimbabwe terminology layer | Local symptom translation and prevalence adjustment |

### Voice and Imaging

| Component | Runtime role |
|---|---|
| Faster-Whisper | Primary local transcription model in CDSS |
| local whisper-compatible endpoints | Alternative local transcription path used by EHR orchestration |
| OpenAI Whisper API | Optional transcription fallback when configured |
| `openai/clip-vit-base-patch32` | Default image classification path |
| `microsoft/BiomedCLIP-PubMedBERT_256-vit_base_patch16_224` | Biomedical imaging alternative where enabled |

### Language Models

| Component | Runtime role |
|---|---|
| Ollama local models | Primary governed text and JSON generation path |
| optional OpenAI vendor | Secondary governed vendor path when tenant policy allows it |
| `governed/json` contract | Structured generation substrate used by several higher-level features |

### Classical ML and Learning

| Component | Runtime role |
|---|---|
| GradientBoostingClassifier | Local predictive model training for selected surfaces |
| differential privacy layer | Noise applied before sharing FL metrics/artifacts |
| FedAvg-style aggregation logic | Cross-tenant model aggregation |
| shadow evaluation | Challenger-vs-production comparison before promotion |
| fairness / calibration / drift checks | Release and monitoring gates |

### Important Accuracy Note

Not every AI surface is transformer-backed.

Many surfaces in MediCore are combinations of:

- governed rules
- retrieval
- structured heuristics
- classical ML
- optional LLM generation

That is intentional. The platform is designed so critical workflows can still function when heavyweight models are disabled or unavailable.

---

## Governance and Control Plane

The AI control plane lives primarily in the CDSS settings provider and the surrounding EHR model operations services.

### Master-DB Control Objects

The CDSS settings layer creates and manages:

- `system_settings`
- `cdss_admin_audit_logs`
- `cdss_encryption_keys`
- `cdss_admin_jobs`
- `cdss_model_registry`
- `cdss_tenant_policies`
- `cdss_ai_vendor_registry`
- `cdss_ai_usecase_policies`

### Seeded Model Registry

The CDSS model registry is seeded with core runtime entries such as:

- `rule_engine`
- `rag`
- `llm_primary`
- `llm_canary`
- `medbert_local`
- `clinicalbert_local`
- `fusion_engine`

This registry is not a complete list of every workflow surface. It is the CDSS runtime registry for central model/control-plane objects.

### Seeded LLM Use-Case Policies

The current seeded use-case policy set includes:

- `intelligent_diagnosis`
- `patient_summarization`
- `patient_adherence_chat`
- `voice_soap_generation`
- `guideline_analysis`
- `patient_education_generation`
- `clinical_code_extraction`
- `registration_document_intelligence`
- `post_visit_patient_answer`
- `post_visit_doctor_polish`
- `post_visit_escalation_classification`
- `post_visit_referral_letter`
- `post_visit_clinical_note`

Each policy can govern:

- whether the use case is enabled
- which vendor is allowed
- which model names are allowed
- whether tenant context is required
- whether prompt redaction is required

### Safety Gate Behavior

The AI safety layer is more than simple PHI redaction.

Implemented gate behaviors include:

- input payload PHI scanning
- confidence score calculation
- citation count thresholds
- contradiction detection between top diagnoses / recommendation text and retrieved citations
- low-confidence abstention
- replacement of blocked recommendations with clinician-escalation guidance

So a “safe” response may be:

- a normal answer
- an abstention with reasons
- or a downgraded recommendation instructing clinician review

### Audit and Explainability

The platform records AI behavior at multiple layers:

- CDSS admin audit logs
- AI recommendation audit history
- override capture
- model monitoring snapshots
- offline eval runs
- release-gate results
- patient AI prompt/result audit summaries
- post-visit LLM prompt hash / token / safety metadata

This means governance is not only pre-call allowlisting. It also includes post-call observability and human override recording.

---

## Canonical End-to-End AI Flows

There is no single universal AI flow in MediCore. The following are the main implemented flows.

### 1. Clinician Diagnosis and Guideline Reasoning

```
Clinician action in EHR
  -> EHR assembles patient context
  -> CdssService calls diagnosis / risk / guideline endpoints
  -> CDSS runs rule / transformer / retrieval logic
  -> optional governed LLM reasoning is applied
  -> safety gate may pass or abstain
  -> EHR returns structured recommendations, citations, and workflow-friendly output
```

Typical endpoints:

- `/diagnosis/suggest`
- `/diagnosis/suggest/intelligent`
- `/guidelines/search`
- `/risk/calculate`
- `/patient/summarize`

### 2. Tenant Knowledge Ingestion

```
User uploads clinical knowledge document in EHR
  -> EHR stores file in MinIO
  -> EHR stores metadata in tenant DB
  -> EHR calls CDSS knowledge ingest with tenant + file payload
  -> CDSS extracts, chunks, embeds, and writes to vector/search stores
  -> EHR updates document ingestion status and chunk count
```

This is distinct from the CDSS admin full-corpus ingest flow.

### 3. Transcription and SOAP Generation

```
Audio enters EHR transcription flow
  -> local whisper-compatible endpoint attempted first when configured
  -> request may include tenant/auth headers for CDSS-backed local path
  -> if local path fails and cloud credentials exist, OpenAI Whisper fallback may run
  -> transcript is normalized
  -> SOAP note may be generated through governed LLM path
```

The important point is that transcription is multi-path, not single-vendor.

### 4. Radiology AI

```
Imaging study registered in EHR
  -> study persisted with aiAnalysisRequested=true
  -> asynchronous CDSS radiology analysis triggered
  -> findings persisted in tenant DB
  -> critical results can broadcast alert-delivery events
  -> radiologist review can close the loop
```

This is more than “CLIP returns labels.” It is an asynchronous operational workflow.

### 5. Patient AI: Symptom and Adherence

```
Patient submits symptoms or sends adherence message
  -> EHR patient AI service calls governed CDSS surface
  -> result is normalized into patient-safe safety policy
  -> patient AI session is persisted
  -> escalation may be created
  -> follow-up orchestration record may be created
  -> history remains queryable later
```

This workflow includes:

- AI session history
- escalation tracking
- follow-up orchestration
- governed prompt/result audit capture

### 6. Proactive Longitudinal AI

```
Manual or scheduled trigger
  -> ProactiveAiService analyzes patient longitudinal state
  -> patient snapshot written/read
  -> active alerts exposed to clinician views
  -> risk history tracked over time
```

This is a longitudinal monitoring workflow, not just a point-in-time model call.

### 7. Encounter Copilot

```
Clinician starts encounter copilot session
  -> EHR gathers patient, meds, allergies, vitals, open care gaps, ambient context
  -> specialty contributors and smart defaults are built
  -> pathway recommendations and suggested orders are generated
  -> session persisted with governance metadata and confidence score
  -> downstream order appropriateness and result follow-up tasks can be generated
```

This subsystem is one of the most workflow-rich AI layers in the product.

### 8. Post-Visit Grounded LLM

```
Post-visit workflow needs patient answer / doctor polish / referral / note
  -> EHR prepares grounded context, citations, and constraints
  -> governed JSON completion is requested through CdssService
  -> response may abstain if context is insufficient
  -> audit metadata and safety indicators are stored with result
```

Supported post-visit AI tasks include:

- grounded patient answers
- doctor-language polishing
- escalation classification
- referral letter drafting
- clinical note drafting

### 9. Self-Learning, Federated Learning, and Release

```
Clinician or workflow outcome captured
  -> feedback stored with learning status
  -> human review gate decides eligibility
  -> batches are collected for retraining
  -> local / federated training and evaluation run
  -> shadow evaluation compares challenger and production
  -> model registry and release gates decide promotion / rollback
  -> monitoring continues after deployment
```

This lifecycle spans both CDSS and EHR services. It is not contained in a single process.

---

## Storage and Data Plane

### Tenant PostgreSQL Databases

Hold patient and workflow data plus many AI artifacts such as:

- knowledge document metadata
- radiology studies and findings
- encounter copilot sessions
- patient AI sessions, escalations, and follow-up orchestrations
- post-visit artifacts
- model metrics and release records

### Master Database

Holds shared CDSS governance/control-plane state such as:

- AI vendor registry
- AI use-case policies
- CDSS model registry
- CDSS admin jobs and audits

### MinIO

Used for:

- uploaded knowledge documents
- model artifacts
- other workflow-linked binary assets

### Redis

Used for:

- query caching
- LLM response caching
- CDSS job queues
- dead-letter retry patterns

### ChromaDB and pgvector

These are complementary retrieval stores:

- **ChromaDB**: fast vector retrieval and fallback
- **pgvector**: persistent, tenant-aware retrieval

### Knowledge Registry

A versioned fallback layer for governed knowledge release content, distinct from raw ingested chunks.

---

## API Surface Overview

### CDSS Platform Families

The CDSS FastAPI app currently covers these high-level families:

- health
- admin and policy
- ingest and jobs
- retrieval and knowledge
- diagnosis and risk
- labs, dosing, medications
- transcription and imaging
- patient-facing AI
- specialty decision support
- registration / coding / education
- claims and pharmacy intelligence
- proactive monitoring
- self-learning / FL / model loading / model-version lookup

### EHR AI Families

The EHR Nest app currently exposes or orchestrates AI through:

- `cdss`
- `knowledge`
- `transcription`
- `radiology-ai`
- `patient-ai`
- `proactive`
- `encounter-copilot`
- `registration-intelligence`
- `claims`
- `risk`
- `fl`
- `model-registry`
- `model-monitoring`
- `ai/explainability`
- patient-portal AI and post-visit flows

### Important Architectural Point

The EHR API is not merely forwarding calls.

It adds:

- tenant DB lookups
- persistence
- alerting
- follow-up orchestration
- workflow-specific shaping of model outputs
- release and audit surfaces

---

## Web and Mobile Consumption

### Web EHR

The web app is the broadest AI consumer.

It exposes a large number of specialty and operational modules, including:

- oncology
- ophthalmology
- emergency
- OR / PACU
- blood bank
- infection control
- sepsis
- HIV
- maternity
- diabetes
- cardiology
- radiology
- telemedicine
- population health
- revenue cycle and claims

So the web experience acts as the main operational surface for the widest part of the AI stack.

### Mobile App

The mobile app is narrower and role-focused:

- doctor flows
- nurse flows
- patient flows

It consumes a meaningful subset of the AI stack, especially:

- patient portal AI
- telemedicine
- messages
- post-visit patient workflows
- selected clinician decision-support slices

It should be thought of as a focused companion client, not a full mirror of all web specialty modules.

---

## Config-Dependent Behavior and Graceful Degradation

Several important behaviors depend on configuration and environment.

### Model Loading

- MedBERT and ClinicalBERT may be disabled or not downloaded in lightweight deployments
- image and voice models may lazy-load on first use
- Ollama is external to the CDSS container and may be unavailable independently

### Vendor and Path Selection

- governed LLM use depends on use-case policy and vendor allowlists
- transcription may use local whisper or OpenAI fallback
- search may hit pgvector first, then knowledge registry, then ChromaDB fallback

### Safety Outcomes

AI surfaces may:

- answer normally
- answer with lower-confidence guidance
- abstain
- request clinician review

### Workflow Degradation

Many workflows still function in reduced mode when heavyweight AI is unavailable by falling back to:

- rules
- template logic
- cached data
- previously persisted artifacts

That graceful degradation is part of the architecture, not an accident.

---

## What This Document Does and Does Not Claim

### This document does claim

- to describe the major AI subsystems currently implemented in this repo
- to distinguish CDSS core from EHR orchestration
- to document the main runtime models, governance objects, and AI flows
- to describe config-dependent behavior where it materially changes runtime behavior

### This document does not claim

- that every individual endpoint is documented here in full detail
- that every model is always loaded in every deployment
- that all web AI capabilities have identical mobile parity
- that every future AI subsystem will automatically fit one canonical pipeline

If a new AI subsystem is added and it changes orchestration, storage, governance, or release behavior, this document should be updated.

---

## Update Checklist

When adding or materially changing an AI capability, update this document if any of the following change:

- a new AI-facing controller or service is added in EHR
- a new governed LLM use case is seeded
- a new CDSS endpoint family is added
- a new model vendor or model registry entry is introduced
- a new storage table for AI artifacts is introduced
- a new learning / monitoring / release gate is added
- a new user-facing AI workflow appears in web, mobile, or patient portal

For implementation history and sprint context, see:

- `docs/SPRINT-ROADMAP-AI-FIRST.md`
- `docs/AI_FIRST_MASTER_GUIDE.md`
- `docs/History.md`
