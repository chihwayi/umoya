# MediCore AI & CDSS Architecture

> Code-faithful architecture guide for the AI and CDSS stack implemented in this repository as of April 7, 2026.

---

## 1. What This Document Is

This document explains, in simple detail, what MediCore has actually built for AI and CDSS.

It is meant to answer these questions clearly:

- What services make up the AI stack?
- What technologies are used?
- How does a request move from the UI to AI/CDSS and back?
- How do knowledge retrieval, LLMs, rules, monitoring, and governance fit together?
- What is still missing if the platform is to become even stronger?

This document is intentionally implementation-oriented.

It is not just a theory diagram.

---

## 2. The Big Picture

MediCore does **not** have one single AI pipeline.

It has a layered AI platform made of:

1. **Client surfaces**
   - web EHR
   - mobile app
   - patient portal flows

2. **EHR orchestration layer**
   - NestJS services/controllers in `services/ehr-service`
   - gathers clinical/workflow context
   - calls CDSS
   - persists AI artifacts
   - turns raw AI output into product workflows

3. **CDSS core platform**
   - FastAPI app in `services/cdss-service`
   - diagnosis support
   - guideline retrieval
   - governed LLM generation
   - patient AI endpoints
   - imaging and transcription endpoints
   - admin/jobs/metrics/audit/model operations

4. **Data and control plane**
   - tenant PostgreSQL databases
   - master PostgreSQL database
   - Redis
   - MinIO
   - ChromaDB
   - pgvector
   - Ollama and optional external AI vendors

The cleanest way to think about MediCore is:

- **EHR is the workflow brain**
- **CDSS is the AI runtime and policy engine**
- **Postgres / Redis / MinIO / vector stores are the memory and control plane**

---

## 3. Overall Architecture

```text
Web EHR / Mobile / Patient Portal
        |
        v
EHR NestJS orchestration layer
        |
        |-- Builds context
        |-- Adds tenant/auth/governance headers
        |-- Persists AI artifacts
        |-- Creates alerts, follow-ups, tasks, queue items
        |
        v
CDSS FastAPI core
        |
        |-- Rules
        |-- RAG retrieval
        |-- Optional LLM generation
        |-- Specialty endpoints
        |-- Patient AI endpoints
        |-- Imaging / voice endpoints
        |-- Feedback / retraining / model ops
        |
        v
Storage and control plane
        |
        |-- Tenant PostgreSQL
        |-- Master PostgreSQL
        |-- Redis
        |-- MinIO
        |-- ChromaDB
        |-- pgvector
```

---

## 4. Main Services And Their Jobs

### 4.1 CDSS Core

The CDSS service in `services/cdss-service/main.py` is the main AI runtime.

It currently handles:

- diagnosis support
- guideline search
- patient summarization
- risk scoring
- labs / medication / dosing support
- patient AI endpoints
- governed JSON/text generation
- registration document intelligence
- clinical code extraction
- imaging analysis
- transcription
- specialty AI/CDSS endpoints
- admin settings/jobs/metrics/audit
- feedback, self-learning, federated learning, model versioning

This means CDSS is not just “the diagnosis service”.
It is the AI platform backend for a large part of MediCore.

### 4.2 EHR Orchestration

The EHR service in `services/ehr-service` is where raw AI output becomes usable product behavior.

Important orchestration services include:

- `CdssService`
  - central CDSS client
  - shared auth, retry, timeout, policy behavior

- `PatientAiService`
  - symptom checks
  - adherence chat
  - escalation creation
  - follow-up orchestration

- `ProactiveAiService`
  - longitudinal patient analysis
  - patient AI snapshots
  - risk trend and alert surfacing

- `EncounterCopilotService`
  - encounter summary
  - suggested orders
  - pathway recommendations
  - care-gap-aware workflow support

- `RadiologyAiService`
  - study registration
  - async AI analysis
  - finding persistence
  - critical alert broadcast

- `PostVisitGroundedLlmService`
  - doctor polish
  - patient answers
  - escalation classification
  - referral letters
  - clinical notes

- `RegistrationIntelligenceService`
  - intake document understanding
  - duplicate review
  - registration normalization

- `ClaimsAiService`
  - denial prediction
  - appeals drafting
  - finance/claims AI orchestration

- `KnowledgeIngestService`
  - tenant document upload
  - MinIO storage
  - tenant-scoped CDSS ingestion

- `ModelMonitoringService`
  - metrics
  - fairness
  - release gates
  - offline evals
  - readiness

- `ModelRegistryService`
  - promotion
  - rollback
  - shadow evaluation governance

So the EHR service is not just proxying CDSS.
It is shaping the AI into workflows clinicians and patients actually use.

---

## 5. Main Technologies Used

### 5.1 Backend Frameworks

- **FastAPI** for CDSS core
- **NestJS** for EHR orchestration
- **TypeORM** and raw SQL in EHR
- **psycopg2** and direct SQL in CDSS/master settings layer

### 5.2 Databases And Storage

- **Tenant PostgreSQL**
  - patient/workflow data
  - many AI artifacts
  - tenant-scoped knowledge metadata
  - metrics and release data

- **Master PostgreSQL**
  - CDSS settings
  - vendor registry
  - use-case policy registry
  - admin jobs
  - audit/control objects

- **MinIO**
  - uploaded documents
  - model artifacts
  - binary workflow assets

- **Redis**
  - cache
  - rate limiting
  - metrics counters
  - queue/retry support

### 5.3 Retrieval Stack

- **ChromaDB**
  - persistent local vector store
  - fast retrieval
  - fallback retrieval path

- **pgvector**
  - tenant-aware vector retrieval in PostgreSQL
  - persistent relationally integrated vector search

- **BM25 / rank-bm25**
  - lexical retrieval

- **Cross encoder reranking**
  - improves precision after initial retrieval

- **Reciprocal Rank Fusion**
  - combines lexical and semantic candidates

### 5.4 AI / ML Libraries And Models

- `sentence-transformers/all-MiniLM-L6-v2`
  - embeddings for semantic retrieval

- `cross-encoder/ms-marco-MiniLM-L-6-v2`
  - reranking

- `en_core_sci_sm` / spaCy
  - clinical NLP preprocessing when available

- NLTK
  - sentence/tokenizer assets used by ingestion stack

- MedBERT / ClinicalBERT
  - optional diagnosis signal layers when enabled

- custom fusion engine
  - combines rules and model signals

- Faster-Whisper
  - local transcription path

- CLIP / BiomedCLIP
  - imaging analysis path

- Ollama local models
  - primary local governed LLM path

- optional OpenAI vendor path
  - only when enabled by configuration and policy

### 5.5 Security And Governance Tech

- JWT-based admin and service auth
- tenant-aware policy checks
- prompt audit logging
- model registry and use-case registry
- release-gate and readiness tracking
- safety gate / abstention / contradiction checks

---

## 6. Retrieval And Knowledge Architecture

This is one of the most important parts of the system.

MediCore does **not** rely on “LLM alone”.
The platform uses a retrieval stack to ground clinical answers in actual guideline content.

### 6.1 What Happens During Guideline Retrieval

At a high level:

1. A query is submitted from EHR or another AI workflow.
2. CDSS normalizes and expands the query.
3. Retrieval runs through:
   - semantic vector search
   - lexical BM25 search
   - fusion/reranking
4. Results are filtered by metadata and tenant context where relevant.
5. Retrieved citations are passed into:
   - direct grounded answers
   - governed LLM reasoning
   - fallback recommendation logic

### 6.2 Why There Are Two Vector Layers

MediCore currently uses both:

- **ChromaDB**
- **pgvector**

This is intentional.

#### ChromaDB is used for:

- fast local vector retrieval
- fallback retrieval when pgvector path is unavailable
- simpler local/dev operation
- a resilient semantic store that does not depend on tenant SQL joins

#### pgvector is used for:

- tenant-aware persistent vector search
- integration with tenant relational data and metadata
- SQL-level governance and joins
- stronger production alignment for tenant knowledge

So the architecture is:

- **pgvector first where tenant-aware persistent relational retrieval matters**
- **ChromaDB as a live fallback / secondary semantic store**
- **BM25 as lexical support**
- **cross-encoder reranking for precision**

This gives MediCore more robustness than a single-store approach.

### 6.3 Knowledge Ingestion Paths

There are two important knowledge-ingestion paths:

#### A. Admin full-corpus ingest

This runs through CDSS admin endpoints such as:

- `/admin/ingest`
- `/admin/ingest/status/{job_id}`
- `/admin/ingest/history`

This path processes the WHO/local guideline corpus in the CDSS file area.

Current behavior:

- scans PDFs
- extracts chunks
- embeds chunks
- upserts into vector store
- rebuilds BM25 in-memory index

Important implementation note:

This path is **correct but slow**, because BM25 is rebuilt after files are added and the corpus grows over time.

#### B. Tenant-scoped knowledge ingest

This runs through:

- EHR `KnowledgeIngestService`
- CDSS `/knowledge/ingest`

This path is used for tenant clinical knowledge documents and is a separate flow from the admin full-corpus sync.

It does:

1. upload in EHR
2. MinIO persistence
3. tenant DB metadata row
4. CDSS chunking/embedding
5. ingestion result + chunk count update

---

## 7. Main AI/CDSS Flows

This is the simplest way to understand how the system works in practice.

### 7.1 Diagnosis And Guideline Flow

```text
Clinician action in web/mobile
    -> EHR collects symptoms, vitals, history, context
    -> CdssService calls diagnosis or guideline endpoint
    -> CDSS runs rule engine + retrieval + optional model layers
    -> optional governed LLM step may add explanation
    -> safety gate may pass, abstain, or downgrade output
    -> EHR returns structured recommendation + citations + workflow actions
```

Typical endpoints:

- `/diagnosis/suggest`
- `/diagnosis/suggest/intelligent`
- `/guidelines/search`
- `/patient/summarize`
- `/risk/calculate`

### 7.2 Patient AI Flow

```text
Patient submits symptom or adherence input
    -> PatientAiService calls governed CDSS path
    -> response is normalized into patient-safe guidance
    -> session is persisted
    -> escalation may be created
    -> follow-up orchestration may be created
    -> staff queue and patient history can reference the same trail later
```

This is not just a chatbot.
It is a workflow with persistence, escalation, and follow-up state.

### 7.3 Proactive Longitudinal AI Flow

```text
Manual or scheduled patient review
    -> ProactiveAiService analyzes longitudinal chart state
    -> snapshot is created or refreshed
    -> active alerts and next actions are exposed
    -> risk trends feed clinician-facing intelligence views
```

This feeds the unified patient-intelligence surfaces in the product.

### 7.4 Encounter Copilot Flow

```text
Clinician opens encounter workflow
    -> EncounterCopilotService gathers chart, meds, allergies, vitals, gaps, ambient context
    -> smart defaults and specialty contributors are built
    -> suggested orders / pathway recommendations / follow-up tasks are generated
    -> encounter copilot session is persisted
    -> downstream review and follow-up artifacts can be created
```

This is one of the richest orchestration flows in the system.

### 7.5 Radiology AI Flow

```text
Study registered in EHR
    -> RadiologyAiService stores study and requests AI analysis
    -> CDSS analyzes study
    -> findings are persisted back in tenant DB
    -> critical findings can trigger alerts
    -> radiologist review can close the loop
```

This is asynchronous workflow AI, not a one-shot inference API only.

### 7.6 Post-Visit Grounded LLM Flow

```text
Post-visit workflow needs answer / note / polish / escalation classification
    -> EHR builds grounded context and constraints
    -> governed CDSS LLM path is called
    -> safety gate may abstain or allow response
    -> audit and provenance metadata are attached
    -> result is stored and exposed to doctor/patient/escalation workflows
```

Main use cases:

- patient answer drafting
- doctor polish
- escalation classification
- referral letters
- clinical notes

### 7.7 Registration Intelligence Flow

```text
Registration intake or document review starts
    -> EHR registration intelligence flow checks duplicates and extracts structure
    -> CDSS document-analysis path may be called
    -> result is normalized back into registration workflow
    -> staff review or downstream eligibility/intake logic uses the output
```

### 7.8 Claims AI Flow

```text
Claims / finance workflow needs denial or appeal intelligence
    -> ClaimsAiService builds the case context
    -> governed AI/CDSS support is applied
    -> risk or appeal output is persisted
    -> override / review / promotion monitoring can inspect that surface later
```

### 7.9 Learning And Model Operations Flow

```text
Clinical or workflow outcome captured
    -> feedback stored
    -> human review can claim/accept batches
    -> retraining or federated evaluation may run
    -> shadow evaluation compares challenger vs production
    -> model registry and release gates decide promotion or rollback
    -> AI ops monitoring tracks runtime health after deployment
```

This lifecycle spans both CDSS and EHR.

---

## 8. Governance, Safety, And Monitoring

MediCore’s AI stack is not just “models + prompts”.

It has a real governance/control layer.

### 8.1 Control Objects

CDSS settings and governance tables include:

- system settings
- admin audit logs
- admin jobs
- model registry
- AI vendor registry
- AI use-case policy registry
- tenant policy registry

### 8.2 AI Surface Contract Layer

The EHR service now has a shared AI surface contract system in:

- `services/ehr-service/src/services/ai-surface-contract.service.ts`

Current catalogued surfaces include:

- `cdss_diagnosis`
- `proactive_ai`
- `risk_tier`
- `patient_ai`
- `encounter_copilot`
- `radiology_ai`
- `post_visit_grounded_llm`
- `registration_intelligence`
- `claims_ai`
- `oncology_mobile_intelligence`

Each surface defines:

- display name
- description
- use cases
- monitoring surface
- audit source of truth
- disable paths
- rollback paths

This is important because it gives the system one consistent language for:

- provenance
- operations
- governance
- release decisions

### 8.3 Safety Behavior

The AI safety path includes more than redaction.

Implemented behaviors include:

- PHI-aware request handling/redaction support
- citation requirements
- confidence thresholds
- contradiction checks
- abstention on weak grounding or low confidence
- downgrade-to-clinician-review behavior

So a “safe” answer may be:

- a normal grounded answer
- a reduced-confidence answer
- or an abstention telling the user to escalate to clinician review

### 8.4 AI Ops And Release Readiness

The AI Ops control tower in EHR now exposes per-surface:

- latest metrics
- abstention rate
- latency
- accuracy
- fairness gap
- model version
- release readiness
- governance source of truth
- disable and rollback paths

This is one of the strongest parts of the current stack, because it turns AI into something the platform can actually operate, not just demo.

---

## 9. What Web, Mobile, And Patient Flows Consume

### 9.1 Web EHR

The web app is the broadest AI consumer.

It uses AI across:

- diagnosis and guideline support
- patient intelligence
- encounter copilot
- post-visit drafting
- radiology
- registration intelligence
- claims and finance AI
- specialty modules like oncology, sepsis, blood bank, OR/PACU, HIV, maternity, diabetes, cardiology, and others

### 9.2 Mobile

The mobile app is narrower, but now it meaningfully consumes:

- patient companion AI
- telemedicine-related AI flows
- patient post-visit and follow-up AI
- selected doctor specialty micro-flows
- mobile specialty intelligence such as oncology snapshot, sepsis, blood bank, PACU, and critical imaging slices

### 9.3 Patient Portal

The patient side consumes:

- patient AI sessions
- adherence/symptom workflows
- telemedicine flows
- post-visit and follow-up workflows
- health-summary style AI context where exposed through patient-safe endpoints

---

## 10. Where The Current Document Was Still Weak

The previous version of this document was better than before, but it still had a few weaknesses:

- it read more like a subsystem inventory than a simple explanation
- it did not explain the **why** of the dual retrieval architecture clearly enough
- it did not clearly separate:
  - raw model runtime
  - EHR orchestration
  - workflow persistence
  - governance/control-tower behavior
- it did not end with a concrete “what still strengthens this architecture” view

This version is meant to fix that.

---

## 11. What Is Still Missing Or Would Strengthen The Stack Further

MediCore already has a strong AI/CDSS platform.

What would strengthen it further:

### 11.1 Better Ingestion Throughput

The full admin corpus ingestion path is correct but still slow.

The current implementation rebuilds BM25 in-memory during ingest, and that becomes more expensive as the corpus grows.

Strong improvement:

- move BM25 rebuild to the end of large ingest jobs
- or batch rebuild after N files instead of every file

### 11.2 More Explicit Dataset / Eval Coverage By Surface

The platform already has release gates and offline eval support, but it would be stronger if every major surface had a clearly maintained eval dataset and visible quality target.

Especially for:

- patient AI
- post-visit grounded LLM
- registration intelligence
- claims AI
- oncology mobile intelligence

### 11.3 More Complete AI Ops Instrumentation For Newer Surfaces

The catalog now includes `oncology_mobile_intelligence`, but some newer or narrower surfaces are still more catalogued than fully instrumented.

Strong improvement:

- ensure every catalogued AI surface emits stable `ai_ops_metrics`

### 11.4 Better Ingestion Progress Visibility

The admin ingest job currently reports final completion cleanly, but its in-flight progress is still weak.

Strong improvement:

- persist per-file progress
- current file
- processed file count
- running chunk total
- estimated completion status

### 11.5 Stronger Unified Longitudinal Intelligence

MediCore has many strong AI subsystems, but the strongest future direction is still to make the whole platform feel like one coherent clinical intelligence system rather than many smart features.

Strong improvement:

- continue unifying patient intelligence, explainability, AI ops, and specialty surfaces under one operational language

---

## 12. pgvector + ChromaDB vs Elasticsearch

You asked specifically for this comparison.

### 12.1 What Elasticsearch Would Give

If MediCore used only Elasticsearch for guideline search, the main strengths would be:

- very strong lexical search
- mature filtering and faceting
- excellent full-text search behavior
- operational familiarity in many enterprises
- scalable document indexing and search

If tuned well, Elasticsearch can be excellent for:

- keyword search
- metadata filters
- phrase queries
- operational dashboards around search content

### 12.2 What Elasticsearch Alone Would Not Give As Cleanly

If you used “just Elasticsearch for guidelines”, you would not automatically get the same architecture benefits MediCore currently has.

Why:

1. **Semantic retrieval is not the same as text search**
   - Elasticsearch can support vector search, but then you are effectively rebuilding part of a vector stack inside Elasticsearch anyway.

2. **Tenant-local relational integration is weaker than pgvector in tenant PostgreSQL**
   - MediCore’s tenant-aware RAG needs to live close to tenant relational workflows.
   - pgvector inside PostgreSQL fits that very naturally.

3. **Local-first fallback is stronger with ChromaDB**
   - Chroma gives a lightweight persistent semantic store that works well for local/dev/fallback usage.

4. **MediCore already combines semantic + lexical + reranking**
   - It is not choosing vectors instead of lexical search.
   - It already uses:
     - vector retrieval
     - BM25 lexical retrieval
     - reciprocal rank fusion
     - cross-encoder reranking

So the real comparison is not:

- “MediCore vectors” vs “search”

It is:

- **MediCore hybrid retrieval stack**
  vs
- **Elasticsearch-only guideline search**

### 12.3 Current Advantages Of MediCore’s Approach

MediCore’s current stack gives these advantages:

#### A. Better semantic grounding

The vector path helps the system find clinically similar content even when wording is different.

That matters a lot for:

- symptom phrasing
- diagnosis support
- guideline grounding
- patient-safe question answering

#### B. Better tenant-aware knowledge architecture

pgvector inside PostgreSQL fits very well with:

- tenant separation
- SQL joins
- relational governance
- tenant-scoped knowledge documents

#### C. Better resilience

Because the platform has:

- pgvector
- ChromaDB
- BM25
- knowledge registry fallback

it can survive partial failures more gracefully than a single-store architecture.

#### D. Better AI-first design

Elasticsearch-only guideline search would be strongest as a search product.

MediCore’s current approach is stronger as an **AI-grounding product**, because the retrieval layer is already designed to feed:

- governed LLM generation
- diagnosis support
- patient AI
- post-visit drafting
- specialty guidance

### 12.4 Where Elasticsearch Could Still Help

This does **not** mean Elasticsearch is useless here.

Elasticsearch could still add value for:

- advanced lexical search and faceted admin search
- large-scale content management
- richer admin-side content browsing
- operational search analytics

So the fair conclusion is:

- **Elastic search could strengthen the search/admin side**
- but **it should not replace the current pgvector + ChromaDB hybrid grounding architecture outright**

### 12.5 Bottom-Line Comparison

If MediCore used only Elasticsearch for guidelines:

- search UX might be strong
- admin filtering might be strong
- but AI grounding would be less naturally aligned unless vector search and reranking were re-added anyway

With the current MediCore design:

- pgvector gives strong tenant-aware persistent semantic retrieval
- ChromaDB gives strong local/fallback semantic retrieval
- BM25 gives lexical support
- reranking improves precision
- the whole stack is better aligned to AI/CDSS workflows than “just searchable documents”

That is a real architectural advantage.

---

## 13. Final Assessment

MediCore’s AI/CDSS architecture is already more serious than a typical “LLM added to an EHR” design.

Its standout strengths today are:

- layered architecture instead of one brittle AI pipeline
- real retrieval grounding instead of LLM-only answers
- workflow-native AI orchestration in EHR
- governance, release, and monitoring surfaces
- strong patient + clinician + specialty coverage
- resilience through hybrid retrieval and graceful degradation

Its main next-level improvements are:

- faster large-corpus ingestion
- stronger progress visibility during ingest
- fuller AI ops metrics coverage for every surface
- even tighter eval discipline across all AI surfaces

In short:

MediCore already has a real AI/CDSS platform.
What remains is mostly optimization, instrumentation, and continued unification, not rebuilding the architecture from scratch.
