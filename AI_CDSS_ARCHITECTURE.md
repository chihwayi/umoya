# MediCore AI & CDSS Architecture

> How the Clinical Decision Support System works — from document ingestion to bedside recommendations.

---

## Table of Contents

1. [Overview](#overview)
2. [Why Not Just Elasticsearch?](#why-not-just-elasticsearch)
3. [The Full AI Stack](#the-full-ai-stack)
4. [Complete Model Inventory](#complete-model-inventory)
5. [Document Ingestion Pipeline](#document-ingestion-pipeline)
6. [How a Search Query Flows](#how-a-search-query-flows)
7. [The Knowledge Databases](#the-knowledge-databases)
8. [Hybrid Search: Vector + BM25 + Reranking](#hybrid-search-vector--bm25--reranking)
9. [Intelligent Diagnosis Engine](#intelligent-diagnosis-engine)
10. [LLM Integration & Governance](#llm-integration--governance)
11. [Redis Caching & Job Queue](#redis-caching--job-queue)
12. [Safety, PHI & Audit](#safety-phi--audit)
13. [Running & Managing Ingestion](#running--managing-ingestion)

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
| `medbert/medbert-base` | HuggingFace Transformer | Diagnosis from structured vitals/labs |
| `emilyalsentzer/Bio_ClinicalBERT` | HuggingFace Transformer | Diagnosis from clinical notes |
| `openai/clip-vit-base-patch32` | Vision Transformer | Medical image analysis (X-ray, DICOM) |
| Faster-Whisper (`base`/`small`/`medium`) | Speech-to-text | Audio transcription → SOAP notes |
| Ollama LLM (mistral, llama2, neural-chat…) | Generative LLM | Clinical reasoning, SOAP notes, summaries |

---

## Complete Model Inventory

Every AI model in the system, where it lives, what it does, and whether it ships inside the Docker image or downloads at runtime.

---

### 1. Embedding Model — `all-MiniLM-L6-v2`

| | |
|---|---|
| **HuggingFace ID** | `sentence-transformers/all-MiniLM-L6-v2` |
| **Library** | `sentence-transformers` |
| **Dimensions** | 384 floats per vector |
| **File** | `ai_models/rag_engine.py` |
| **Loaded as** | `SentenceTransformer('all-MiniLM-L6-v2')` |
| **Docker** | **Baked into image** — downloaded at build time, cached in `/opt/hf_cache` |
| **Purpose** | Encodes every guideline chunk and every incoming query into a 384-dimensional vector. Cosine similarity between query vector and chunk vectors drives the semantic search leg of the hybrid search. |
| **Speed** | ~2 000 sentences/second on CPU; sub-millisecond per single query |
| **Fallback** | None — this model is required for RAG to function |

---

### 2. Re-Ranker — `cross-encoder/ms-marco-MiniLM-L-6-v2`

| | |
|---|---|
| **HuggingFace ID** | `cross-encoder/ms-marco-MiniLM-L-6-v2` |
| **Library** | `sentence-transformers` (CrossEncoder class) |
| **File** | `ai_models/rag_engine.py` |
| **Loaded as** | `CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')` |
| **Docker** | **Baked into image** — cached in `/opt/hf_cache` |
| **Purpose** | After RRF fusion produces a candidate list, this model scores every `[query, document]` pair jointly — seeing both at the same time gives far higher precision than the bi-encoder. Results are then re-sorted by this score. |
| **Fallback** | If loading fails, re-ranking is skipped and the RRF-ranked order is used directly |

---

### 3. MedBERT — `medbert/medbert-base`

| | |
|---|---|
| **HuggingFace ID** | `medbert/medbert-base` |
| **Library** | `transformers`, `torch` |
| **File** | `ai_models/medbert_predictor.py` |
| **Loaded as** | `AutoModel.from_pretrained()` + `AutoTokenizer.from_pretrained()` |
| **Docker** | **Downloaded at runtime** — only if `CDSS_ALLOW_MODEL_DOWNLOAD=true` |
| **Purpose** | Analyses structured patient data (vitals, lab values, demographics) and outputs a probability distribution over possible diagnoses. Contributes 35% weight in the diagnosis fusion engine. |
| **Fallback** | **Lightweight mode** — if the model is unavailable, falls back to feature encoding + rule-based pattern matching without any transformer. The service keeps running. |

---

### 4. ClinicalBERT — `emilyalsentzer/Bio_ClinicalBERT`

| | |
|---|---|
| **HuggingFace ID** | `emilyalsentzer/Bio_ClinicalBERT` |
| **Library** | `transformers`, `torch` |
| **File** | `ai_models/clinicalbert_diagnostic.py` |
| **Loaded as** | `AutoTokenizer.from_pretrained()` + `AutoModelForSequenceClassification.from_pretrained()` |
| **Docker** | **Downloaded at runtime** — only if `CDSS_ALLOW_MODEL_DOWNLOAD=true` |
| **Purpose** | Reads free-text clinical notes (chief complaint, history of presenting illness) and produces a diagnosis probability distribution. BioBERT trained on MIMIC-III clinical notes — understands clinical language far better than a general BERT. Contributes 30% weight in fusion. |
| **Fallback** | **Lightweight mode** — spaCy NLP + keyword extraction without transformer |
| **NLP pipeline** | `en_core_sci_sm` (scispaCy) for token lemmatisation and noun chunks; falls back to `en_core_web_sm` |

---

### 5. scispaCy — `en_core_sci_sm`

| | |
|---|---|
| **Package** | `en_core_sci_sm` (scispaCy v0.5.4) |
| **Library** | `spacy`, `scispacy` |
| **Files** | `ai_models/rag_engine.py`, `ai_models/clinicalbert_diagnostic.py` |
| **Docker** | **Baked into image** — installed from `https://s3-us-west-2.amazonaws.com/ai2-s2-scispacy/releases/v0.5.4/en_core_sci_sm-0.5.4.tar.gz` |
| **Purpose** | Medical/scientific NLP: tokenisation, lemmatisation, noun-chunk extraction, named entity recognition for diseases, chemicals, and procedures. Used in both the RAG query expansion path and the ClinicalBERT NLP pipeline. |
| **Fallback** | `en_core_web_sm` (standard English) if sci model unavailable |

---

### 6. CLIP Vision Model — `openai/clip-vit-base-patch32`

| | |
|---|---|
| **HuggingFace ID** | `openai/clip-vit-base-patch32` |
| **Alternative** | `microsoft/BiomedCLIP-PubMedBERT_256-vit_base_patch16_224` (drop-in swap for clinical imaging) |
| **Library** | `transformers`, `torch`, `pillow`, `pydicom` |
| **File** | `ai_models/medical_vision.py` |
| **Loaded as** | `CLIPModel.from_pretrained()` + `CLIPProcessor.from_pretrained()` |
| **Docker** | **Downloaded at runtime** — loaded on first image analysis request |
| **Device** | GPU if `torch.cuda.is_available()`, otherwise CPU |
| **Purpose** | Analyses medical images — chest X-rays, DICOM files, JPGs. Matches the image against clinical label descriptions to detect: normal chest X-ray, pneumonia, tuberculosis, pleural effusion, pneumothorax, fracture. DICOM files are pre-processed with `pydicom` before being passed to CLIP. |
| **Mock mode** | Set `MOCK_VISION_AI=true` to skip model loading (useful in dev/CI) |
| **Triggered by** | `POST /analyze-image` (async job via Redis queue) |

---

### 7. Faster-Whisper (Speech-to-Text)

| | |
|---|---|
| **Library** | `faster-whisper>=1.0.0` |
| **Model sizes** | `base`, `small`, `medium`, `large` (set via `WHISPER_MODEL_SIZE`) |
| **File** | `ai_models/voice_scribe.py` |
| **Loaded as** | `WhisperModel(size, device, compute_type='int8')` |
| **Docker** | **Downloaded at runtime** — on first transcription request |
| **Device** | Set via `WHISPER_DEVICE` env var (default: `cpu`) |
| **Quantisation** | int8 — significantly reduces memory footprint on CPU |
| **Languages** | English (`en`), Shona (`sn`), Ndebele (`nd`), auto-detection |
| **Purpose** | Transcribes clinician audio (voice consultations, dictated notes) to text. The transcript is then passed to the LLM to generate a structured SOAP note. |
| **Fallback** | If `faster_whisper` import fails, transcription endpoints are disabled gracefully |
| **Triggered by** | `POST /transcribe` (async job) and `POST /transcription/stream` (streaming) |

---

### 8. LLM — Ollama (mistral / llama2 / neural-chat / any Ollama model)

| | |
|---|---|
| **Runtime** | Ollama — local inference server, not HuggingFace directly |
| **Model** | Configured via `LLM_MODEL_NAME` env var — any model pulled into Ollama works |
| **Common choices** | `mistral`, `llama2`, `neural-chat`, `llama3`, `phi3` |
| **API endpoint** | `LLM_API_URL` (e.g. `http://ollama:11434`) |
| **File** | `ai_models/llm_provider.py` |
| **Docker** | **Served externally** — CDSS calls Ollama over HTTP; Ollama is a separate service/container |
| **Temperature** | 0.2 — low, for factual clinical output |
| **Max tokens** | 1 024 per response |
| **JSON mode** | Supported (`format: "json"` in payload) — used for structured SOAP notes and diagnosis JSON |
| **Purpose** | Generates natural-language clinical reasoning, differential diagnosis lists, SOAP notes from transcripts, patient visit summaries. Always receives retrieved guideline citations as context first (grounded generation). |
| **Governance** | Every call gated by tenant use-case policy: enabled/disabled per use case, model allowlist, audit log on every call |
| **OpenAI (optional)** | Supported as an alternative vendor for non-PHI use cases; not used by default |

---

### 9. Zimbabwe Terminology & Localisation

| | |
|---|---|
| **File** | `ai_models/zimbabwe_terminology.py` |
| **Type** | Custom rule-based NLP (no HuggingFace download) |
| **Purpose** | Bridges local language → clinical English for the diagnosis engine |
| **Knowledge bases** | |
| `ZIMBABWE_TERMINOLOGY` | Maps common conditions: HIV/ARVs, TB/DOTS, Malaria, Diabetes, Hypertension, Pneumonia |
| `SHONA_SYMPTOMS` | 21 symptoms with Shona translations (e.g. `musoro kurwadza` → headache) |
| `NDEBELE_SYMPTOMS` | 21 symptoms with Ndebele translations |
| `ZIMBABWE_DISEASE_PATTERNS` | Prevalence multipliers and local symptom patterns — boosts locally common conditions (HIV, Malaria, TB) in the diagnosis scorer |
| **Used in** | `ai_models/clinicalbert_diagnostic.py` — applied during scoring to adjust confidence for Zimbabwe's disease burden |

---

### 10. NLTK (tokenisation support)

| | |
|---|---|
| **Library** | `nltk` |
| **Data downloaded** | `punkt`, `punkt_tab`, `averaged_perceptron_tagger`, `averaged_perceptron_tagger_eng` |
| **Docker** | **Baked into image** — downloaded to `/usr/share/nltk_data` at build time (world-readable) |
| **Purpose** | Sentence tokenisation and POS tagging used by the `unstructured` PDF extraction library during ingestion |

---

### Model Download Summary

| Model | How it arrives | Env var to control |
|---|---|---|
| `all-MiniLM-L6-v2` | **Baked into Docker image** | — |
| `cross-encoder/ms-marco-MiniLM-L-6-v2` | **Baked into Docker image** | — |
| `en_core_sci_sm` (scispaCy) | **Baked into Docker image** | — |
| NLTK punkt/tagger data | **Baked into Docker image** | — |
| `medbert/medbert-base` | Downloaded at runtime | `CDSS_ALLOW_MODEL_DOWNLOAD=true` |
| `emilyalsentzer/Bio_ClinicalBERT` | Downloaded at runtime | `CDSS_ALLOW_MODEL_DOWNLOAD=true` |
| `openai/clip-vit-base-patch32` | Downloaded on first image request | `MOCK_VISION_AI=true` to skip |
| Faster-Whisper | Downloaded on first transcription request | `WHISPER_MODEL_SIZE=base` |
| LLM (mistral, llama2, etc.) | Served by Ollama (external) | `LLM_MODEL_NAME`, `LLM_API_URL` |

**The four baked-in models** (`all-MiniLM-L6-v2`, cross-encoder, scispaCy, NLTK) are the ones that run on every single guideline query. They must be available from cold start, so they live in the image. The heavier transformer models (MedBERT, ClinicalBERT) are optional — if they can't load, the service degrades gracefully to rule-based mode rather than failing.

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
         ├─ MedBERT Predictor  [medbert/medbert-base]
         │   AutoModel.from_pretrained — structured EHR data
         │   Vitals, labs, demographics → diagnosis probabilities
         │   Weight in fusion: 35%
         │   Fallback: feature encoding + pattern matching
         │
         ├─ ClinicalBERT Diagnostic  [emilyalsentzer/Bio_ClinicalBERT]
         │   AutoModelForSequenceClassification — free text
         │   BioBERT trained on MIMIC-III clinical notes
         │   Chief complaint, HPI → diagnosis probabilities
         │   Weight in fusion: 30%
         │   Fallback: spaCy NLP + keyword extraction
         │
         ├─ Rule-based Engine
         │   Symptom matching + clinical decision rules
         │   Fast, explainable, reliable baseline
         │   Weight in fusion: 35%
         │
         ├─ Zimbabwe Terminology Layer
         │   Adjusts scores for local disease prevalence
         │   Shona/Ndebele symptom → canonical English mapping
         │   Prevalence multipliers for HIV, Malaria, TB, etc.
         │
         └─ Fusion Engine
             Weighted average of probabilities
             Agreement scoring (boost if all three agree)
             ICD-10 + SNOMED CT code attachment
             RAG-retrieved evidence for top diagnoses
             Optional LLM reasoning (Ollama) for differential
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
