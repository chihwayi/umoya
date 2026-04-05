# MediCore AI & CDSS Architecture

> How the Clinical Decision Support System works — from document ingestion to bedside recommendations.

---

## Table of Contents

1. [Overview](#overview)
2. [Why Not Just Elasticsearch?](#why-not-just-elasticsearch)
3. [The Full AI Stack](#the-full-ai-stack)
4. [Document Ingestion Pipeline](#document-ingestion-pipeline)
5. [How a Search Query Flows](#how-a-search-query-flows)
6. [The Knowledge Databases](#the-knowledge-databases)
7. [Hybrid Search: Vector + BM25 + Reranking](#hybrid-search-vector--bm25--reranking)
8. [Intelligent Diagnosis Engine](#intelligent-diagnosis-engine)
9. [LLM Integration & Governance](#llm-integration--governance)
10. [Redis Caching & Job Queue](#redis-caching--job-queue)
11. [Safety, PHI & Audit](#safety-phi--audit)
12. [Running & Managing Ingestion](#running--managing-ingestion)

---

## Overview

The CDSS (Clinical Decision Support System) is a standalone Python microservice (`services/cdss-service`, port 8000) that:

- Ingests medical guidelines and clinical documents as searchable knowledge
- Retrieves the most relevant guidelines for a given clinical query
- Runs multiple AI models to suggest diagnoses, drug interactions, dosing, and risk scores
- Optionally passes retrieved knowledge to a local LLM for natural-language clinical reasoning

It does **not** replace a clinician — it gives them the right information at the right moment, grounded in evidence.

---

## Why Not Just Elasticsearch?

A fair question. Here is what you gain by going beyond Elasticsearch:

| Capability | Elasticsearch (text search) | MediCore CDSS |
|---|---|---|
| **Keyword match** | Yes — exact/fuzzy text | Yes — BM25 index |
| **Semantic understanding** | No | Yes — 384-dim sentence embeddings |
| **Synonym / abbreviation handling** | Requires manual synonym files | Automatic (HIV → "human immunodeficiency virus…") |
| **"Meaning" not just words** | No | Yes — finds relevant content even when phrasing differs |
| **Reranking / precision boost** | No | Yes — cross-encoder scores every candidate pair |
| **Clinical domain tagging** | Manual only | Automatic heuristic + metadata extraction |
| **Idempotent re-ingestion** | Requires custom IDs | Built-in stable IDs (source + page + md5 hash) |
| **Multi-signal fusion** | No | RRF fuses vector rank + BM25 rank |
| **Per-tenant isolation** | Possible but complex | Native (tenant_id on every row) |
| **Integrated AI chain** | External glue code | Diagnosis models, LLM, RAG all in one service |
| **Outcome feedback loop** | Not applicable | Clinician overrides → learning pipeline |

**Short version:** Elasticsearch finds documents that contain your words. The CDSS finds documents that contain your *meaning*, even if the words are different — then it re-ranks for precision and grounds an LLM answer in the retrieved evidence.

---

## The Full AI Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    Clinical Query / EHR Data                │
└────────────────────────────┬────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   FastAPI CDSS  │  port 8000
                    │   (main.py)     │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────────┐
          │                  │                      │
   ┌──────▼──────┐  ┌────────▼────────┐  ┌─────────▼──────────┐
   │  Rule-based │  │  RAG Engine     │  │  Diagnosis Models  │
   │  Guidelines │  │  (rag_engine.py)│  │                    │
   │  Registry   │  │                 │  │  ┌─ MedBERT        │
   │  (JSON)     │  │  ┌─ ChromaDB    │  │  ├─ ClinicalBERT   │
   └─────────────┘  │  ├─ BM25 Index  │  │  └─ Fusion Engine  │
                    │  └─ Re-ranker   │  └────────────────────┘
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  pgvector (PG)  │  clinical_knowledge_chunks
                    │  tenant-aware   │  384-dim embeddings
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  LLM Provider   │  Ollama (local)
                    │  (llm_provider) │  temperature 0.2
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Redis Cache    │  query + LLM result cache
                    └─────────────────┘
```

**Models in play:**

| Model | Type | Purpose |
|---|---|---|
| `all-MiniLM-L6-v2` | SentenceTransformer (384 dims) | Query + document embedding |
| `cross-encoder/ms-marco-MiniLM-L-6-v2` | Cross-encoder | Reranking retrieved candidates |
| `en_core_sci_sm` | scispaCy NLP | Medical entity extraction, tokenisation |
| MedBERT (fine-tuned) | Classification | Diagnosis from structured vitals/labs |
| ClinicalBERT (BioBERT fine-tuned) | Classification | Diagnosis from clinical notes text |
| Ollama LLM (mistral / neural-chat) | Generative LLM | Clinical reasoning, SOAP notes, summaries |

---

## Document Ingestion Pipeline

This is how a PDF guideline goes from storage into searchable, semantically-indexed knowledge.

```
MinIO (object storage)
   └── who-smart-guidelines/ bucket
           │
           │  POST /admin/ingest  (JWT-authenticated)
           ▼
   ┌─────────────────────────────────────────────────────┐
   │              Redis Job Queue                        │
   │  cdss:jobs:queue  ← job_id pushed (lpush)           │
   └──────────────────────┬──────────────────────────────┘
                          │  cdss-worker brpop (blocking)
                          ▼
   ┌─────────────────────────────────────────────────────┐
   │           ingest_guidelines.py                      │
   │                                                     │
   │  For each PDF file:                                 │
   │                                                     │
   │  1. EXTRACT                                         │
   │     Primary:  unstructured library                  │
   │               (layout-aware, by_title chunking)     │
   │     Fallback: pypdf (plain text extraction)         │
   │                                                     │
   │  2. CHUNK                                           │
   │     Max chunk:        1 500 chars                   │
   │     New chunk thresh: 2 000 chars                   │
   │     Min chunk:           50 chars (skip noise)      │
   │                                                     │
   │  3. TAG METADATA (heuristic)                        │
   │     clinical_domain:  infectious_disease, cardiology│
   │                       obstetrics, pediatrics …      │
   │     target_population: pregnant_women, children,    │
   │                        elderly, adults              │
   │     source: filename  │  page: page number          │
   │                                                     │
   │  4. STABLE ID                                       │
   │     "{source}_p{page}_{md5(text)}"                  │
   │     → same chunk re-ingested = same ID = upsert     │
   │       (safe to run ingest as many times as needed)  │
   │                                                     │
   │  5. EMBED                                           │
   │     SentenceTransformer('all-MiniLM-L6-v2')         │
   │     Batch encode → 384-float vector per chunk       │
   │                                                     │
   │  6. UPSERT                                          │
   │     ChromaDB collection.upsert() — idempotent       │
   │     pgvector   clinical_knowledge_chunks             │
   │                                                     │
   │  7. REBUILD BM25 INDEX (in-memory, incremental)     │
   │                                                     │
   │  ✅ Added N chunks. Total in DB: XXXXX              │
   └─────────────────────────────────────────────────────┘
                          │
                          ▼
              Job status → "completed"
              Metadata quality report →
              data/ingest_metadata_report.json
```

**Why the stable ID matters:** If you re-ingest after adding new documents, existing chunks are updated in place (upsert), not duplicated. The corpus stays clean regardless of how many times you run it.

**Why the worker is separate from the API:** Ingesting 282 PDFs takes ~20–40 minutes. If it ran inline in the HTTP request it would time out. The job is pushed to Redis, the API returns immediately with a `job_id`, and the worker processes it in the background. You poll `GET /admin/ingest/status/{job_id}` to check progress.

---

## How a Search Query Flows

This is the full path from a clinician typing a query to a response appearing on screen.

```
EHR Frontend
  POST /guidelines/search
  { query: "ANC management first trimester",
    patient_context: { age: 24, pregnant: true },
    limit: 5 }
         │
         ▼
  CDSS FastAPI (main.py)
         │
         ├─ 1. PHI REDACTION
         │     privacy_guard.redact_text(query)
         │     Names, MRNs, dates stripped before any processing
         │
         ├─ 2. KNOWLEDGE RETRIEVAL  (three layers, tried in order)
         │
         │   Layer A — pgvector (persistent, tenant-aware)
         │     ┌─ Encode query → 384-dim vector
         │     ├─ SELECT chunks WHERE tenant_id=X
         │     │   ORDER BY embedding <=> query_vector  (cosine)
         │     ├─ BM25 rerank on retrieved rows
         │     └─ RRF fusion → ranked list
         │
         │   Layer B — Governed Knowledge Registry (fallback)
         │     Versioned, human-reviewed JSON guideline files
         │     knowledge_registry/ directory
         │
         │   Layer C — ChromaDB RAG (fast in-memory fallback)
         │     ┌─ Vector search in ChromaDB
         │     ├─ BM25 search (in-memory BM25Okapi index)
         │     ├─ RRF fusion
         │     ├─ Deduplication (same source + page → keep one)
         │     └─ Cross-encoder reranking
         │
         ├─ 3. POPULATION FILTER
         │     Filter citations by patient age / gender / pregnancy status
         │
         ├─ 4. LLM ANALYSIS (optional, if enabled)
         │     ┌─ Governance check: policy + vendor + allowed models
         │     ├─ Build prompt: patient context + top citations
         │     ├─ POST Ollama /api/generate (temperature 0.2)
         │     ├─ Redis cache (TTL 600s, key: md5(prompt))
         │     └─ Timeout: LLM_GUIDELINES_TIMEOUT_SECONDS (default 20s)
         │
         └─ 5. RESPONSE
               {
                 citations: [ { title, text, source, similarity_score, grounded } ],
                 analysis: "LLM clinical reasoning…"   // optional
               }
```

**The "grounded" flag** on each citation means the text came directly from an ingested document — it is not hallucinated. The LLM is always given the retrieved text first and asked to reason from it, not to generate from scratch.

---

## The Knowledge Databases

Two storage layers work together:

### ChromaDB — Fast In-Memory RAG

- Persistent file-based vector store (`./data/chroma_db`)
- Collection: `medical_guidelines`
- Distance: cosine similarity
- Rebuilt in full on `POST /admin/reindex`
- BM25 index lives alongside it in memory — rebuilt after every ingest

### pgvector — Persistent Tenant-Aware Store

Stored in PostgreSQL alongside the EHR data:

```
clinical_knowledge_documents
  id, tenant_id, title, document_type, specialty,
  minio_bucket, minio_key, chunk_count, ingestion_status

clinical_knowledge_chunks
  id (UUID), document_id → documents.id,
  tenant_id, chunk_index,
  chunk_text,
  embedding  vector(384),   ← pgvector column
  metadata   JSONB          ← domain, population, keywords
```

Every clinic (tenant) gets its own rows. A query from `kids-clinic` can never see chunks belonging to `city-hospital`. The vector similarity operator is `<=>` (cosine distance, lower = more similar).

---

## Hybrid Search: Vector + BM25 + Reranking

The three signals and how they combine:

```
Query: "hypertension management in pregnancy"
         │
         ├─ VECTOR SEARCH
         │   Encode query → 384-dim vector
         │   Find top-k nearest chunks by cosine similarity
         │   Good at: meaning, synonyms, related concepts
         │   Misses: exact drug names, specific code numbers
         │
         ├─ BM25 SEARCH  (BM25Okapi, rank-bm25 library)
         │   Tokenise query → keyword scores across all docs
         │   Good at: exact terms, dosage numbers, drug names
         │   Misses: semantically related but different words
         │
         └─ RRF FUSION  (Reciprocal Rank Fusion, k=60)
             Each document gets a combined score:
             score = 1/(60 + vector_rank) + 1/(60 + bm25_rank)
             The k=60 constant prevents one weak signal from
             dominating — a doc ranked 1st by vector but not
             found by BM25 still scores well.
                  │
                  ▼
             DEDUPLICATION
             Same source + same page → keep highest scorer
                  │
                  ▼
             CROSS-ENCODER RERANKING  (optional, precision boost)
             Model: cross-encoder/ms-marco-MiniLM-L-6-v2
             Forms pairs: [ [query, doc1], [query, doc2], … ]
             Scores each pair as a whole (not independently)
             Re-sorts by rerank score → final top-N returned
```

**Why RRF k=60?** If a document is ranked 1st by one signal but missing from the other, `1/(60+1) ≈ 0.016` — a meaningful contribution but not overwhelming. This makes the fusion robust when one retriever comes up empty.

**Abbreviation expansion** happens before any search:
- `HIV` → `"HIV human immunodeficiency virus antiretroviral"`
- `ANC` → `"ANC antenatal care prenatal"`
- `TB` → `"TB tuberculosis pulmonary respiratory"`
This dramatically improves recall for clinical abbreviations that may not appear in guideline text verbatim.

---

## Intelligent Diagnosis Engine

Beyond search, the CDSS can suggest diagnoses from patient data:

```
Patient Data
  ├─ Structured (vitals, labs, age, sex)
  └─ Unstructured (clinical notes, chief complaint)
         │
         ├─ MedBERT Predictor
         │   Fine-tuned on structured EHR data
         │   Output: probability distribution over diagnoses
         │   Weight in fusion: 35%
         │
         ├─ ClinicalBERT Diagnostic
         │   BioBERT fine-tuned on MIMIC clinical notes
         │   Input: free-text clinical notes
         │   Output: probability distribution over diagnoses
         │   Weight in fusion: 30%
         │
         ├─ Rule-based Engine
         │   Symptom matching + clinical decision rules
         │   Fast, explainable, reliable baseline
         │   Weight in fusion: 35%
         │
         └─ Fusion Engine
             Weighted average of probabilities
             Agreement scoring (boost if all three agree)
             ICD-10 + SNOMED CT code attachment
             RAG-retrieved evidence for top diagnoses
             Optional LLM reasoning generation
```

The fusion weights are tunable. Rule-based gets equal weight to ML models because it is highly explainable and fails gracefully when ML models are uncertain.

---

## LLM Integration & Governance

The LLM (local Ollama instance) is never called without governance checks:

```
llm_provider.generate_response(prompt, use_case, tenant_id)
         │
         ├─ 1. Resolve use-case policy from settings_provider
         │       Is this use case enabled for this tenant?
         │       Which vendor/model is allowed?
         │       If disabled → raise RuntimeError (not called)
         │
         ├─ 2. PHI redaction on prompt + system_prompt
         │       Any names, MRNs, dates stripped before leaving service
         │
         ├─ 3. POST Ollama /api/generate
         │       model:         LLM_MODEL_NAME
         │       temperature:   0.2  (factual, low creativity)
         │       num_predict:   1024 tokens
         │       format:        "json" if structured output needed
         │
         ├─ 4. Audit log
         │       llm_use_case_allowed / llm_use_case_denied
         │       Stored via settings_provider.log_action()
         │
         └─ 5. Redis cache
                key: md5(prompt)
                TTL: 600s
                Identical prompts don't re-call the LLM
```

**Why local LLM (Ollama)?** Patient data never leaves the clinic's infrastructure. There is no OpenAI API call with PHI in the request body. Cloud LLMs (OpenAI) are optional and only used for non-PHI use cases (e.g., post-visit summaries after redaction).

---

## Redis Caching & Job Queue

Redis serves two roles:

### Query Cache

```
cache key = "rag:query:{tenant_id}:{md5(query + filters + n_results)}"
TTL = 3600 seconds (1 hour)

Identical clinical queries within the hour → instant response
No re-embedding, no re-searching, no LLM call
```

### Async Job Queue

```
Queue: cdss:jobs:queue   (Redis list, lpush/brpop)
DLQ:   cdss:jobs:dead_letter

Lifecycle:
  POST /admin/ingest
    → lpush job_id onto queue
    → return { job_id, status: "queued" }

  cdss-worker (separate container)
    → brpop(queue, timeout=5s)  ← blocks, no polling
    → _run_job(job_id)
    → update status: queued → running → completed/failed

  On failure:
    → retry up to 3 times (re-enqueued)
    → after 3 failures → dead_letter queue
    → manual requeue: POST /admin/jobs/dead-letter/requeue/{job_id}
```

Job types: `ingest`, `reindex`, `cache_flush`, `reencrypt`, `transcribe`, `analyze_image`

---

## Safety, PHI & Audit

| Mechanism | What it does |
|---|---|
| `privacy_guard.redact_text()` | Strips PHI from every query before RAG/LLM processing |
| Outbound PHI guard | Checks LLM response for potential PHI before returning |
| AI governance policies | Per-tenant, per-use-case enable/disable + model allowlist |
| Audit log (`/admin/audit`) | Every AI decision logged with use case, model, tenant, outcome |
| Outcome feedback (`/feedback/outcome`) | Clinician overrides captured for model learning pipeline |
| Stable chunk IDs | Re-ingestion is safe and idempotent — no ghost duplicates |
| Dead-letter queue | Failed jobs never silently disappear |

---

## Running & Managing Ingestion

### Trigger a full re-ingest

```bash
# Generate a short-lived JWT (JWT_SECRET from .env)
TOKEN=$(node -e "
  const c = require('crypto');
  const h = { alg:'HS256', typ:'JWT' };
  const p = { sub:'admin@medicore.co.zw', email:'admin@medicore.co.zw', exp: Math.floor(Date.now()/1000)+3600 };
  const b64 = s => Buffer.from(JSON.stringify(s)).toString('base64url');
  const data = b64(h)+'.'+b64(p);
  const sig = c.createHmac('sha256','dev_secret_key_change_in_production').update(data).digest('base64url');
  console.log(data+'.'+sig);
")

# Start ingest job
curl -s -X POST http://localhost:8000/admin/ingest \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Monitor progress

```bash
# Watch the worker logs
docker logs medicore-cdss-worker -f --tail=20 | grep "Total in DB"
```

### Check job status

```bash
curl -s http://localhost:8000/admin/ingest/jobs \
  -H "Authorization: Bearer $TOKEN" | jq '.[] | {id, status, result}'
```

### Test a search query

```bash
curl -s -X POST http://localhost:8000/guidelines/search \
  -H "Content-Type: application/json" \
  -d '{"query":"hypertension management pregnancy","limit":3}' | jq '.citations[].title'
```

### Interactive API docs

`http://localhost:8000/docs` — full Swagger UI for all CDSS endpoints.

---

*This document describes the system as implemented. For sprint history and roadmap context, see `docs/SPRINT-ROADMAP-AI-FIRST.md`.*
