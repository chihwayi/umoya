# MediCore AI & CDSS Architecture

> The complete picture of how every AI model works, how they talk to each other, how the system learns from clinicians over time, and why this beats a plain search engine.

---

## Table of Contents

1. [The Big Picture](#the-big-picture)
2. [Why Not Just Elasticsearch?](#why-not-just-elasticsearch)
3. [Every AI Model in the System](#every-ai-model-in-the-system)
4. [The Unified AI Flow](#the-unified-ai-flow)
5. [Document Ingestion — How Knowledge Gets In](#document-ingestion--how-knowledge-gets-in)
6. [Real-Time Clinical Query — How Knowledge Gets Out](#real-time-clinical-query--how-knowledge-gets-out)
7. [Hybrid Search: Vector + BM25 + Reranking](#hybrid-search-vector--bm25--reranking)
8. [Diagnosis Engine — Three Models, One Answer](#diagnosis-engine--three-models-one-answer)
9. [Voice, Vision, and Structured Clinical AI](#voice-vision-and-structured-clinical-ai)
10. [The LLM Layer — Local, Governed, Grounded](#the-llm-layer--local-governed-grounded)
11. [The Self-Learning Loop](#the-self-learning-loop)
12. [Federated Learning — Learning Across Clinics Without Sharing Patient Data](#federated-learning--learning-across-clinics-without-sharing-patient-data)
13. [Model Drift Monitoring & Anomaly Detection](#model-drift-monitoring--anomaly-detection)
14. [Safety, PHI & Governance](#safety-phi--governance)
15. [The Knowledge Databases](#the-knowledge-databases)
16. [Redis: Caching & Job Queue](#redis-caching--job-queue)
17. [Running & Managing Ingestion](#running--managing-ingestion)

---

## The Big Picture

MediCore's AI is not a collection of separate tools bolted together. It is a single clinical intelligence pipeline where every component feeds the next:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         KNOWLEDGE IN                                     │
│  WHO Guidelines + Local Protocols → MinIO → Ingestion → ChromaDB/pgvector│
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        REAL-TIME CLINICAL AI                             │
│                                                                          │
│  Clinician Query ──► RAG (Vector + BM25 + Reranker) ──► Citations       │
│  Patient Vitals  ──► MedBERT ──┐                                        │
│  Clinical Notes  ──► ClinicalBERT ──► Fusion Engine ──► Diagnosis       │
│  Rule engine     ──────────────┘                                        │
│  Audio           ──► Faster-Whisper ──► LLM ──► SOAP Note              │
│  X-ray / DICOM   ──► CLIP Vision ──► Findings                          │
│  All of above    ──► Ollama LLM ──► Clinical Reasoning Text            │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │  Clinician acts on AI recommendation
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         LEARNING LOOP                                    │
│                                                                          │
│  Clinician accepts / modifies / overrides recommendation                │
│       ↓                                                                  │
│  Feedback captured → human review gate → approved for learning          │
│       ↓                                                                  │
│  Local retraining (per clinic, privacy-preserving)                      │
│       ↓                                                                  │
│  Federated averaging across all clinics (FedAvg)                       │
│       ↓                                                                  │
│  Governance gates: AUC, Brier score, fairness, calibration             │
│       ↓                                                                  │
│  Shadow → Canary → Production promotion (clinical approval required)    │
│       ↓                                                                  │
│  Drift & bias monitoring runs continuously                              │
└──────────────────────────────────────────────────────────────────────────┘
```

Every decision the AI makes can be audited, reviewed, corrected, and fed back into improving the next generation of the model — without any raw patient data ever leaving a clinic.

---

## Why Not Just Elasticsearch?

| Capability | Elasticsearch | MediCore CDSS |
|---|---|---|
| Keyword match | Yes — fuzzy text | Yes — BM25 index |
| Semantic understanding | No | Yes — 384-dim sentence embeddings |
| Synonym / abbreviation handling | Manual synonym files | Automatic (HIV → "human immunodeficiency virus…") |
| Finds meaning, not just words | No | Yes — cosine similarity over meaning vectors |
| Precision re-ranking | No | Cross-encoder scores every `[query, doc]` pair |
| Clinical domain tagging | Manual | Automatic heuristic metadata extraction |
| Safe re-ingestion | Requires custom logic | Stable IDs (source + page + md5 hash) |
| Multi-signal fusion | No | RRF fuses vector rank + BM25 rank |
| Per-clinic isolation | Complex | Native `tenant_id` on every row |
| Diagnosis from patient data | Not applicable | MedBERT + ClinicalBERT + rule fusion |
| Voice transcription | Not applicable | Faster-Whisper → SOAP note |
| Medical image analysis | Not applicable | CLIP vision model |
| Clinical reasoning text | Not applicable | Local Ollama LLM (grounded in retrieved citations) |
| Self-learning from clinicians | Not applicable | Feedback loop → federated retraining → governed promotion |
| Fairness & drift monitoring | Not applicable | Demographic parity audits, anomaly detection |

**The short version:** Elasticsearch finds documents containing your words. The CDSS finds documents containing your *meaning*, generates a grounded explanation, learns from clinician corrections, and gets better over time — without your patient data ever leaving your infrastructure.

---

## Every AI Model in the System

### Retrieval & Embedding

| Model | HuggingFace ID | What it does |
|---|---|---|
| **Bi-encoder** | `sentence-transformers/all-MiniLM-L6-v2` | Encodes every guideline chunk and every query into a 384-dim vector. The semantic heart of RAG. |
| **Cross-encoder reranker** | `cross-encoder/ms-marco-MiniLM-L-6-v2` | After RRF fusion, scores every `[query, doc]` pair jointly for precision ranking. |
| **BM25Okapi** | `rank-bm25` library (in-memory) | Lexical keyword search — catches exact drug names, dosages, codes that vectors miss. |

### Clinical NLP

| Model | HuggingFace ID / Package | What it does |
|---|---|---|
| **scispaCy** | `en_core_sci_sm` v0.5.4 | Medical tokenisation, lemmatisation, named entity recognition (diseases, chemicals, procedures). Primary NLP for both RAG and ClinicalBERT. |
| **spaCy fallback** | `en_core_web_sm` | Standard English NLP — used when scispaCy unavailable. |
| **NLTK** | punkt, punkt_tab, averaged_perceptron_tagger | Sentence tokenisation for the `unstructured` PDF extraction library used during ingestion. |

### Diagnosis Models

| Model | HuggingFace ID | What it does | Fusion weight |
|---|---|---|---|
| **MedBERT** | `medbert/medbert-base` | Analyses structured EHR data — vitals, labs, demographics — to produce a probability distribution over diagnoses. | 35% |
| **ClinicalBERT** | `emilyalsentzer/Bio_ClinicalBERT` | Analyses free-text clinical notes (chief complaint, HPI). BioBERT trained on MIMIC-III. | 30% |
| **Rule-based engine** | — (in-code decision trees) | Symptom matching + clinical decision rules. Fast, explainable, fails gracefully. | 35% |
| **Fusion engine** | — (weighted average + agreement scoring) | Combines all three, boosts score when models agree, attaches ICD-10 + SNOMED codes. | — |
| **Zimbabwe terminology** | `ai_models/zimbabwe_terminology.py` | Maps Shona/Ndebele symptoms → English; applies local prevalence multipliers (HIV, TB, Malaria). | Modifier |

### Federated / Self-Learning Models

| Model | Library | What it does |
|---|---|---|
| **GradientBoostingClassifier** | scikit-learn | Trained locally per clinic on: deterioration, readmission, no-show, sepsis outcomes. n_estimators=100, max_depth=4. |
| **Differential privacy layer** | Custom (Gaussian noise) | Adds noise to gradient/feature importances before sharing. Privacy budget tracked per round (epsilon=1.0 default). |
| **FedAvg aggregator** | Custom (weighted average) | Combines locally trained models from all participating clinics into a global model by weighting by sample count. |

### Voice & Vision

| Model | Library / ID | What it does |
|---|---|---|
| **Faster-Whisper** | `faster-whisper`, `base`/`small`/`medium`/`large` | Transcribes clinician audio to text. Supports English, Shona (`sn`), Ndebele (`nd`). int8 quantised for CPU efficiency. |
| **CLIP** | `openai/clip-vit-base-patch32` | Analyses medical images (chest X-ray, DICOM, JPG). Detects: pneumonia, TB, pleural effusion, pneumothorax, fracture. |
| **BiomedCLIP** (optional swap) | `microsoft/BiomedCLIP-PubMedBERT_256-vit_base_patch16_224` | Drop-in clinical imaging alternative to base CLIP — trained on biomedical image-text pairs. |

### Language Models

| Model | Runtime | What it does |
|---|---|---|
| **Ollama LLM** (mistral / llama2 / llama3 / neural-chat / phi3 / any) | Ollama (local server) | Generates clinical reasoning text, differential diagnosis explanations, SOAP notes, patient summaries. Always grounded in retrieved citations. temperature=0.2. |
| **OpenAI** (optional) | Cloud API | Only for non-PHI use cases when enabled by tenant policy. Not used by default. |

### Where Each Model Lives at Runtime

| Model | In Docker image? | Downloads when? |
|---|---|---|
| `all-MiniLM-L6-v2` | **Yes** — baked in at build, cached at `/opt/hf_cache` | Never |
| `cross-encoder/ms-marco-MiniLM-L-6-v2` | **Yes** — baked in | Never |
| `en_core_sci_sm` (scispaCy) | **Yes** — installed at build | Never |
| NLTK punkt + tagger | **Yes** — downloaded to `/usr/share/nltk_data` at build | Never |
| `medbert/medbert-base` | No | At startup if `CDSS_ALLOW_MODEL_DOWNLOAD=true` |
| `emilyalsentzer/Bio_ClinicalBERT` | No | At startup if `CDSS_ALLOW_MODEL_DOWNLOAD=true` |
| `openai/clip-vit-base-patch32` | No | On first image analysis request |
| Faster-Whisper | No | On first transcription request |
| Ollama LLM | No | Served by separate Ollama container |
| Federated GBM models | No | Trained locally; weights stored in MinIO |

The four baked-in models are baked because they run on **every single query**. Everything else either lazy-loads or degrades gracefully when unavailable.

---

## The Unified AI Flow

Here is how all the components work together for a single patient encounter — from the moment a clinician opens a chart to the moment the model learns from their decision:

```
STEP 1 — CLINICIAN OPENS PATIENT
─────────────────────────────────────────────────────────────────────────
Patient data (vitals, labs, notes, demographics) loaded from EHR DB
                    │
                    ▼
STEP 2 — PARALLEL AI ANALYSIS
─────────────────────────────────────────────────────────────────────────

  Structured data ──► MedBERT (medbert/medbert-base)
                      AutoModel.from_pretrained
                      Output: P(diagnosis_A)=0.72, P(diagnosis_B)=0.41…

  Clinical notes  ──► ClinicalBERT (emilyalsentzer/Bio_ClinicalBERT)
                      AutoModelForSequenceClassification
                      scispaCy tokenisation first
                      Output: P(diagnosis_A)=0.68, P(diagnosis_B)=0.55…

  Symptom list    ──► Rule-based engine
                      Decision rules + Zimbabwe terminology adjustments
                      Output: P(diagnosis_A)=0.80, P(diagnosis_B)=0.30…

                    │
                    ▼
STEP 3 — FUSION ENGINE
─────────────────────────────────────────────────────────────────────────
  Weighted combination:
    diagnosis_A = (0.72 × 0.35) + (0.68 × 0.30) + (0.80 × 0.35) = 0.736
    Agreement bonus applied when all three models point the same way
    ICD-10 + SNOMED CT codes attached to top diagnoses

                    │
                    ▼
STEP 4 — KNOWLEDGE RETRIEVAL (RAG)
─────────────────────────────────────────────────────────────────────────
  For each top diagnosis, retrieve relevant guidelines:

  Query: "HIV management adult ART initiation"
    │
    ├─ Abbreviation expansion: "HIV human immunodeficiency virus antiretroviral"
    │
    ├─ all-MiniLM-L6-v2 encodes query → 384-dim vector
    │    ↓ cosine search in ChromaDB + pgvector
    │    Top-K semantically relevant chunks
    │
    ├─ BM25Okapi keyword scores across all docs
    │    Top-K by lexical match
    │
    ├─ RRF fusion: score = 1/(60+v_rank) + 1/(60+bm25_rank)
    │
    ├─ Deduplication (same source + page → keep one)
    │
    └─ Cross-encoder reranks top candidates as [query, doc] pairs
         Final citations: title, text excerpt, source, similarity_score

                    │
                    ▼
STEP 5 — LLM REASONING (optional, governed)
─────────────────────────────────────────────────────────────────────────
  Governance check: is this use case enabled for this tenant?
  PHI redacted from prompt
  Prompt = patient_context + top citations + fusion scores
  POST Ollama /api/generate (temperature=0.2, max_tokens=1024)
  Output: differential diagnosis explanation + management plan
  Redis cache (TTL 600s) — identical prompts skip the LLM

                    │
                    ▼
STEP 6 — RESPONSE TO CLINICIAN
─────────────────────────────────────────────────────────────────────────
  {
    diagnoses: [ { name, probability, icd10, snomed, confidence } ],
    citations: [ { title, text, source, similarity_score, grounded: true } ],
    analysis: "Based on retrieved guidelines, first-line ART…"
  }

  grounded: true = text came from an ingested document, not generated

                    │
                    ▼
STEP 7 — CLINICIAN ACTS
─────────────────────────────────────────────────────────────────────────
  Clinician: accepts / modifies / overrides / ignores
                    │
                    ▼
STEP 8 — FEEDBACK CAPTURED
─────────────────────────────────────────────────────────────────────────
  POST /feedback/outcome
  { clinician_action: "modified", override_reason: "…",
    outcome_30d: { readmission: false, … } }

  Stored in cdss_feedback_entries:
    learning_status: "pending_review"
    source_model, confidence_score, demographic fields

                    │
                    ▼
STEP 9 — LEARNING LOOP (async, background)
─────────────────────────────────────────────────────────────────────────
  See full details in "The Self-Learning Loop" section below
```

---

## Document Ingestion — How Knowledge Gets In

Guidelines (WHO Smart Guidelines, local protocols) live in MinIO object storage. Ingestion converts them into searchable, semantically-indexed chunks.

```
MinIO bucket: who-smart-guidelines/
  └── 282 PDF files
         │
         │  POST /admin/ingest  (JWT required)
         ▼
  Redis queue: cdss:jobs:queue
  job pushed → API returns job_id immediately → worker picks it up
         │
         ▼  (cdss-worker container, blocking brpop)
  ┌─────────────────────────────────────────────────────────────┐
  │  For each PDF:                                              │
  │                                                             │
  │  1. EXTRACT TEXT                                            │
  │     Primary:  unstructured library (layout-aware,           │
  │               by_title chunking — respects headers)         │
  │     Fallback: pypdf (plain text extraction)                 │
  │     NLTK punkt used by unstructured for sentence boundaries │
  │                                                             │
  │  2. CHUNK                                                   │
  │     Max chunk:         1 500 chars                          │
  │     New chunk trigger: 2 000 chars                          │
  │     Min chunk:            50 chars (noise filter)           │
  │                                                             │
  │  3. HEURISTIC METADATA TAGGING                              │
  │     clinical_domain — 15 categories:                        │
  │       infectious_disease, cardiology, obstetrics,           │
  │       pediatrics, endocrinology, oncology, respiratory,     │
  │       mental_health, nutrition, surgery, nephrology,        │
  │       neurology, ophthalmology, dermatology, emergency      │
  │     target_population:                                      │
  │       pregnant_women, children, elderly, adults             │
  │     source: filename  │  page: page number                  │
  │                                                             │
  │  4. STABLE CHUNK ID                                         │
  │     "{source}_p{page}_{md5(text)}"                          │
  │     Same chunk re-ingested = same ID = upsert (no dup)      │
  │                                                             │
  │  5. EMBED                                                   │
  │     all-MiniLM-L6-v2 batch encodes all chunks               │
  │     → 384-float vector per chunk                            │
  │                                                             │
  │  6. UPSERT INTO BOTH STORES                                 │
  │     ChromaDB:  collection.upsert() — fast in-memory RAG     │
  │     pgvector:  clinical_knowledge_chunks — tenant-aware,    │
  │                persistent across restarts                   │
  │                                                             │
  │  7. REBUILD BM25 INDEX (incremental, in-memory)             │
  │                                                             │
  │  ✅ Added N chunks. Total in DB: XXXXX                      │
  └─────────────────────────────────────────────────────────────┘
         │
         ▼
  Job status → "completed"
  Quality report → data/ingest_metadata_report.json
  (field coverage, domain distribution, population distribution)
```

**Re-ingestion is always safe.** The stable MD5-based chunk ID means running ingest again after adding new documents upserts existing ones in place. No duplicates accumulate.

**Why the worker is separate from the API.** Ingesting 282 PDFs takes 20–40 minutes. The job is queued, the API returns instantly, and the worker processes in the background. Failed jobs retry up to 3 times, then land in a dead-letter queue for manual inspection.

---

## Real-Time Clinical Query — How Knowledge Gets Out

```
POST /guidelines/search
{ query, patient_context: { age, pregnant, gender }, limit }
         │
         ├─ 1. PHI REDACTION
         │     privacy_guard.redact_text()
         │     Names, MRNs, dates stripped — never reaches model
         │
         ├─ 2. ABBREVIATION EXPANSION (pre-query)
         │     HIV → "HIV human immunodeficiency virus antiretroviral"
         │     ANC → "ANC antenatal care prenatal"
         │     TB  → "TB tuberculosis pulmonary respiratory"
         │     + 10 more medical abbreviations
         │
         ├─ 3. KNOWLEDGE RETRIEVAL (three layers)
         │
         │   Layer A — pgvector (tenant-aware, persistent)
         │     all-MiniLM-L6-v2 encodes query → vector
         │     SELECT ... WHERE tenant_id=X ORDER BY embedding <=> vector
         │     BM25 rerank on retrieved rows → RRF fusion
         │
         │   Layer B — Knowledge Registry (fallback)
         │     Versioned, human-reviewed JSON guidelines
         │     knowledge_registry/ directory
         │     Used when pgvector has no results
         │
         │   Layer C — ChromaDB (fast in-memory, final fallback)
         │     Full hybrid search (see Hybrid Search section)
         │
         ├─ 4. POPULATION FILTER
         │     Filter citations by patient age / gender / pregnancy
         │
         ├─ 5. LLM ANALYSIS (if enabled, governed)
         │     Ollama POST /api/generate
         │     Model sees: patient context + top citations
         │     Output: clinical reasoning grounded in evidence
         │     Redis cache: md5(prompt), TTL 600s
         │     Timeout: 20s (configurable)
         │
         └─ 6. RESPONSE
               citations: [{ title, text, source, similarity_score, grounded }]
               analysis: "…LLM text grounded in citations…"
```

---

## Hybrid Search: Vector + BM25 + Reranking

```
Query → Abbreviation expansion
         │
         ├─ VECTOR SEARCH  (all-MiniLM-L6-v2)
         │   What it catches: synonyms, related concepts, paraphrasing
         │   What it misses: exact drug names, specific dose numbers
         │   Returns: ranked list (v_rank 0 = best)
         │
         ├─ BM25 SEARCH  (BM25Okapi, rank-bm25 library)
         │   What it catches: exact terms, dosages, codes, drug names
         │   What it misses: semantically equivalent but different words
         │   Returns: scored list (b_rank 0 = best)
         │
         └─ RRF FUSION  (k=60)
             score = 1/(60 + v_rank) + 1/(60 + b_rank)

             k=60 means rank-1 contributes ~0.016
             A document ranked 1st in one signal but absent from the
             other still scores meaningfully — neither signal dominates.
                  │
                  ▼
             DEDUPLICATION
             Same source file + same page number → keep highest scorer
                  │
                  ▼
             CROSS-ENCODER RERANKING  (cross-encoder/ms-marco-MiniLM-L-6-v2)
             Retrieves n_results × 5 candidates from RRF
             Forms pairs: [ [query, doc1], [query, doc2], … ]
             Model reads query AND document together → logit score
             Re-sorts by logit → slices to final top-N
             Fallback: if model unavailable, use RRF order
```

The cross-encoder is the precision layer. The bi-encoder + BM25 + RRF is the recall layer. Together they give you wide net + precise filter.

---

## Diagnosis Engine — Three Models, One Answer

```
Patient data
  ├─ Vitals, labs, demographics (structured)
  └─ Free-text notes, chief complaint (unstructured)
         │
         ├─────────────────────────────────────────────┐
         │                                             │
         ▼                                             ▼
  MedBERT                                    ClinicalBERT
  medbert/medbert-base                       emilyalsentzer/Bio_ClinicalBERT
  AutoModel.from_pretrained                  AutoModelForSequenceClassification
  ─────────────────────                      ──────────────────────────────────
  Input: structured feature vector           Input: raw clinical text
  Vitals: RR, SpO2, BP, HR, temp             Tokenised by scispaCy en_core_sci_sm
  Labs: WBC, lactate, glucose …              Falls back to en_core_web_sm
  Demographics: age, gender                  BioBERT base trained on MIMIC-III
                                             Text classification pipeline
  Output: P(HIV)=0.82, P(TB)=0.41…          Output: P(HIV)=0.78, P(TB)=0.55…

  Fallback: feature encoding + pattern       Fallback: spaCy NLP + keywords
  matching if model unavailable              if model unavailable
         │                                             │
         └──────────────────┬──────────────────────────┘
                            │
                            ▼
                   RULE-BASED ENGINE
                   Symptom matching + clinical decision rules
                   Output: P(HIV)=0.90, P(TB)=0.35…

                            │
                            ▼
                   ZIMBABWE TERMINOLOGY LAYER
                   Shona/Ndebele symptom → English canonical
                   SHONA_SYMPTOMS: 21 symptoms with translations
                   NDEBELE_SYMPTOMS: 21 symptoms with translations
                   ZIMBABWE_DISEASE_PATTERNS: prevalence multipliers
                   → Boosts locally common conditions (HIV, Malaria, TB)
                   → Applied as score modifier before fusion

                            │
                            ▼
                   FUSION ENGINE
                   ─────────────────────────────────────────
                   Weights:  MedBERT 35% + ClinicalBERT 30% + Rules 35%
                   Formula:  score = Σ(model_probability × weight)
                   Agreement bonus: applied when all three models agree
                   Confidence: boosted when model outputs align closely

                   Final output per diagnosis:
                     name, probability, confidence,
                     icd10_code  (ICD-10 mapper — lookup table),
                     snomed_code (SNOMED CT mapper — lookup table)

                            │
                            ▼
                   RAG retrieves evidence for top diagnoses
                   LLM generates differential reasoning from citations
```

**On the ICD-10 and SNOMED mappers:** These are structured lookup tables, not ML models. The diagnosis name from the fusion engine is mapped to standard codes for interoperability. They are deterministic and do not require model downloads.

**On the `CDSS_ALLOW_MODEL_DOWNLOAD` flag:** If this is `false` (the default in resource-constrained environments), MedBERT and ClinicalBERT do not download. The service runs in lightweight mode — rule-based engine at full weight, Zimbabwe terminology still applied. You get meaningful clinical suggestions without the memory overhead of full transformers.

---

## Voice, Vision, and Structured Clinical AI

### Voice — Faster-Whisper → SOAP Note

```
Clinician records audio during consultation
         │
         ▼  POST /transcribe  (async job)
  Faster-Whisper
  WhisperModel(size=WHISPER_MODEL_SIZE, device=WHISPER_DEVICE, compute_type='int8')
  Sizes: base / small / medium / large
  Languages: English (en), Shona (sn), Ndebele (nd), auto-detect
  int8 quantisation — runs on CPU without GPU
         │
         ▼
  Raw transcript text
         │
         ▼  LLM (Ollama)
  LLMProvider.generate_json(transcript, schema="SOAP note")
  Structured output: Subjective, Objective, Assessment, Plan
         │
         ▼
  SOAP note saved to patient record
```

### Medical Image Analysis — CLIP

```
X-ray / DICOM upload
         │
         ├─ DICOM? → pydicom pre-processing → pixel array → PNG
         ├─ JPG/PNG? → direct
         │
         ▼  POST /analyze-image  (async job)
  CLIP Model
  openai/clip-vit-base-patch32  (default)
  Alternative: microsoft/BiomedCLIP-PubMedBERT_256-vit_base_patch16_224
  CLIPModel.from_pretrained + CLIPProcessor.from_pretrained
  Device: GPU if available, CPU otherwise
         │
         ▼
  Labels scored:
    normal chest x-ray, pneumonia, tuberculosis,
    pleural effusion, pneumothorax, fracture
         │
         ▼
  Findings returned with confidence scores
  Flagged findings surface as clinical alerts
```

### Structured Clinical Decision AI

These endpoints run within the CDSS and use rule-based logic + evidence lookup — no separate ML models, but they integrate with RAG for guideline backing:

| Endpoint | What it does |
|---|---|
| `POST /drugs/interactions/advanced` | Drug-drug interaction analysis with severity scoring |
| `POST /risk/calculate` | Patient risk score with contributing factors |
| `POST /risk/deterioration/ml` | ML-enhanced early warning score (uses federated GBM model when available) |
| `POST /dosing/recommend` | Weight/renal-adjusted dosing recommendation |
| `POST /labs/interpret` | Lab value interpretation with reference ranges |
| `POST /medications/duplicates` | Duplicate therapy detection |
| `POST /medications/high-risk` | High-risk medication alerts |
| `POST /medications/food-interactions` | Food-drug interaction warnings |
| `POST /hiv/testing/algorithm` | Zimbabwe HIV testing algorithm |
| `POST /patient/summarize` | LLM-generated patient visit summary |

---

## The LLM Layer — Local, Governed, Grounded

The LLM is the last step in the pipeline. It never sees raw patient data — only the redacted clinical context and the retrieved citations.

```
llm_provider.generate_response(prompt, use_case, tenant_id)
         │
         ├─ 1. GOVERNANCE CHECK
         │     Load use-case policy for this tenant from settings_provider
         │     Is the use case enabled?
         │     Is the requested model on the allowlist?
         │     Which vendor is configured (ollama / openai)?
         │     If denied → log "llm_use_case_denied" → raise RuntimeError
         │
         ├─ 2. PHI REDACTION
         │     privacy_guard.redact_text(prompt)
         │     privacy_guard.redact_text(system_prompt)
         │     Names, MRNs, dates, identifiers stripped
         │
         ├─ 3. CACHE CHECK
         │     Redis key: md5(prompt)  TTL: 600s
         │     Hit → return cached response immediately
         │
         ├─ 4. LLM CALL
         │     POST {LLM_API_URL}/api/generate
         │     { model: LLM_MODEL_NAME,
         │       prompt: redacted_prompt,
         │       temperature: 0.2,
         │       num_predict: 1024,
         │       format: "json" if structured output }
         │     Timeout: LLM_TIMEOUT_SECONDS (default 30s)
         │     Retries: LLM_MAX_RETRIES (default 1)
         │
         ├─ 5. OUTBOUND PHI GUARD
         │     Response checked for potential PHI before returning
         │
         ├─ 6. AUDIT LOG
         │     log_action("llm_use_case_allowed", use_case, model, tenant)
         │
         └─ 7. CACHE WRITE + RETURN
```

**Why Ollama (local)?** Patient data never leaves the clinic's server. There is no API call to OpenAI with a patient's vitals in the body. OpenAI is available as an optional secondary vendor, controlled by tenant governance policy, and only used after PHI redaction.

**Why temperature 0.2?** Clinical output must be factual and reproducible. High temperature introduces creative variation that is harmful in a medical context. 0.2 keeps the model near its highest-confidence response.

---

## The Self-Learning Loop

Every time a clinician accepts, modifies, or overrides an AI recommendation, that signal is captured and eventually improves the model — but only after passing through a human review gate.

```
STAGE 1 — CLINICIAN FEEDBACK CAPTURE
─────────────────────────────────────────────────────────────────────────
POST /feedback/outcome
{
  clinician_action: "overridden",  // accepted | modified | overridden | ignored
  override_reason: "Patient already on ARTs",
  outcome_30d: { readmission: false, adverse_event: false },
  outcome_90d: { …90-day observations… }
}

Stored in cdss_feedback_entries:
  learning_status:    "pending_review"
  processing_status:  "received"
  source_model:       "diagnosis" | "risk" | "vitals_risk" | "denial"
  confidence_score:   0.736  (what the model said)
  clinician_action:   "overridden"
  demographic fields: age_bucket, gender, sdoh_flag  (for fairness audits)

         │
         ▼
STAGE 2 — HUMAN REVIEW GATE
─────────────────────────────────────────────────────────────────────────
POST /feedback/outcome/review/{entry_id}
{
  action: "approve_for_learning",  // or "reject_for_learning"
  review_notes: "Override was clinically justified, good learning signal"
}

learning_status transitions:
  pending_review → reviewed → approved_for_learning
                            → rejected_for_learning  (with notes)

Only "approved_for_learning" entries proceed.
Rejected entries are kept for audit but excluded from retraining.

         │
         ▼
STAGE 3 — BATCH COLLECTION & RETRAINING TRIGGER
─────────────────────────────────────────────────────────────────────────
POST /feedback/outcome/batch-collect
  Collects approved entries
  Computes aggregates: accepted_count, modified_count, overridden_count,
                       ignored_count, avg_outcome_score

POST /feedback/outcome/learning/retrain
  Triggered when approved batch reaches threshold (MIN_OUTCOMES ≈ 50)
  Writes approved entries to JSONL:
    /tmp/medicore_retrain_{surface}.jsonl
    Each line: { predicted, actual, features, timestamp, tenant_id }

  Background job picks up JSONL, retrains model surface
  (diagnosis / risk / denial / vitals_risk)
  Model version bumped in model_deployments table

         │
         ▼
STAGE 4 — FEDERATED LEARNING (across all clinics)
─────────────────────────────────────────────────────────────────────────
  See full federated learning section below

         │
         ▼
STAGE 5 — SHADOW EVALUATION
─────────────────────────────────────────────────────────────────────────
POST /self-learning/shadow-eval
  Challenger model runs alongside production model
  Both score the same inputs
  Divergence logged to /tmp/shadow_{surface}.jsonl:
    { confidence_delta, abstention_divergence, production_score,
      challenger_score, timestamp }
  Human review triggered if: confidence_delta > 0.20

         │
         ▼
STAGE 6 — PROMOTION GATES
─────────────────────────────────────────────────────────────────────────
  Challenger must pass ALL of:
    AUC ≥ 0.55
    Improvement ≥ 0.01 over current production model
    Brier score ≤ 0.25
    Calibration: decile expected vs actual rates aligned
    Fairness: demographic parity gap ≤ 10%
    Clinical approval: human sign-off required

  Staging: shadow → canary (optional, % of real traffic) → production
  Auto-promotion BLOCKED — every stage requires explicit approval

         │
         ▼
STAGE 7 — PRODUCTION DEPLOYMENT
─────────────────────────────────────────────────────────────────────────
POST /model/load
  Loads promoted model into _LOADED_MODELS in-memory cache
  Serving switches to new model version
  All predictions now use updated model
  Old version retained for rollback
```

---

## Federated Learning — Learning Across Clinics Without Sharing Patient Data

The federated learning system lets all clinics collectively improve shared predictive models without any clinic's patient data ever being visible to another.

```
WEEKLY CRON (Sunday 02:00 UTC)
─────────────────────────────────────────────────────────────────────────
FederatedLearningService.initiateRound()
  Model types: deterioration, readmission, no_show, sepsis
  Creates FlRound: roundNumber, globalModelVersion, status="pending"
  Kicks off local training for each active tenant

         │
         ▼  (simultaneously, in each clinic's own database)
LOCAL TRAINING — PER CLINIC
─────────────────────────────────────────────────────────────────────────
POST /fl/train-local  { modelType, roundId, tenantId }

For each model type, the clinic queries ONLY its own patient data:

  deterioration: vitals (RR, SpO2, BP, HR, temp) + ICU transfer label
  readmission:   demographics + 30-day readmission label
  no_show:       age, gender, day_of_week, hour_of_day + attendance label
  sepsis:        RR, HR, temp, BP, WBC, lactate, age + sepsis label

  Minimum viable training: ≥10 samples, ≥5 positive outcomes
  If not enough data: clinic skips this round gracefully

  GradientBoostingClassifier (scikit-learn)
    n_estimators=100, max_depth=4, learning_rate=0.05, subsample=0.8

  DIFFERENTIAL PRIVACY APPLIED:
    Gaussian noise added to feature importances before sharing
    noise_scale = gradient_norm / privacy_epsilon  (epsilon=1.0 default)
    → What is shared: noisy feature importances + aggregate metrics
    → What is NOT shared: any patient-level data whatsoever

  Local model weights uploaded to MinIO:
    models/{modelType}/round-{roundId}/weights.pkl

  Clinic submits FlParticipationLog:
    localModelMetrics: { auc, brierScore, featureImportances }
    sampleCount, gradientNorm, privacyEpsilon

         │
         ▼  (once all clinics submit, or 24h timeout)
FEDERATED AGGREGATION (FedAvg)
─────────────────────────────────────────────────────────────────────────
POST /fl/aggregate  { roundId }

  Weighted average by sample count:
    aggregated_metric[k] = Σ(clinic_metric[k] × clinic_samples) / total_samples

  Aggregates: AUC, Brier score, feature importances
  Produces: global model weights reference in MinIO

         │
         ▼
GLOBAL MODEL EVALUATION
─────────────────────────────────────────────────────────────────────────
POST /fl/evaluate  { roundId }

  Holdout evaluation on last 10% of outcomes (min 20 samples)
  Promotion gates:
    AUC ≥ 0.55
    Improvement ≥ 0.01 over current global model
    Brier score ≤ 0.25
    Calibration: 10-decile expected vs actual alignment
    Fairness: no demographic parity flag raised

  Model registered in ModelRegistry:
    modelName, version, minioPath, aucRoc, brierScore,
    sampleCount (total across all clinics), tenantCount,
    featureNames, framework, status, deploymentStage

  ModelPromotionReview created:
    requestedStage: "shadow"
    reviewStatus:   "pending_review"
    Requires human clinical approval to proceed

         │
         ▼  (after clinical approval)
SHADOW → CANARY → PRODUCTION  (same gates as self-learning above)
```

**What "federated" means in practice:** No clinic ever sends a patient row to another clinic or to a central server. Only the model's aggregate statistics (weighted scores, noisy feature importances) travel over the network. The actual patient records never leave the clinic's PostgreSQL database.

---

## Model Drift Monitoring & Anomaly Detection

The system continuously monitors its own models for signs of degradation.

### Bias Audit

```
POST /self-learning/bias-audit
  Protected attributes: age_bucket, gender, sdoh_flag
  For each attribute:
    Compute outcome_score mean per group
    parity_gap = max(group_means) - min(group_means)
    PASS if gap ≤ 10%
    FAIL if gap > 10% → recommendation: pause auto-learning approval

  Confidence based on sample size: 0.60 + min(samples/1000, 0.30)
  Reports: worst_performing_group, best_performing_group, per-attribute results
```

### Anomaly Detection

```
POST /self-learning/audit-anomaly
  Compares consecutive metric snapshots (requires ≥2 historical records)

  ACCURACY DROP > 5%
    Critical if > 15%: halt auto-deployment, trigger manual review, consider rollback
    High if 5–15%: flag for review

  ABSTENTION SURGE > 20%
    Model refusing > 20% of requests (safety gates firing too often)
    Action: check input data quality, review safety gate thresholds

  LATENCY SPIKE > 3× baseline
    Severity: medium
    Action: check service load, review model complexity

  FAIRNESS DEGRADATION (SDOH parity gap > 10%)
    Severity: high
    Action: review training data for SDOH bias, pause auto-learning approval
```

### Calibration Monitoring

Every promoted model's calibration is checked continuously:
- 10-decile analysis: for each decile of predicted probability, what was the actual event rate?
- Overconfident model: predicts 0.9 but only 0.6 actually occur → flagged
- Underconfident model: predicts 0.2 but 0.5 actually occur → flagged

---

## Safety, PHI & Governance

| Layer | Mechanism | What it prevents |
|---|---|---|
| **Input** | `privacy_guard.redact_text()` on every query | PHI reaching the embedding model or LLM |
| **Output** | Outbound PHI guard on LLM responses | PHI leaking back through the API |
| **LLM gating** | Per-tenant, per-use-case governance policy | Unauthorised model calls; wrong model for use case |
| **Model allowlist** | Only listed model names accepted per use case | Swapping in an unapproved model |
| **Audit log** | Every AI decision: use case, model, tenant, outcome | Full traceability for every clinical AI call |
| **Feedback gate** | Human review before any feedback enters training | Bad signals corrupting the model |
| **Promotion gate** | AUC, Brier, calibration, fairness, clinical approval | Degraded model reaching production |
| **Shadow mode** | Challenger runs alongside production before promotion | Untested model affecting real care |
| **Differential privacy** | Gaussian noise on FL gradients | Individual patient data inferred from model weights |
| **Stable chunk IDs** | MD5-based upsert on ingest | Ghost duplicate knowledge chunks |
| **Dead-letter queue** | Failed jobs captured, inspectable, re-queueable | Silently dropped ingestion jobs |

---

## The Knowledge Databases

### ChromaDB — Fast In-Memory RAG

- PersistentClient, file-backed (`./data/chroma_db`)
- Collection: `medical_guidelines`, cosine distance
- Rebuilt in full on `POST /admin/reindex`
- BM25 index lives alongside it in memory, rebuilt after every ingest

### pgvector — Persistent Tenant-Aware Store

```sql
-- One row per ingested document
clinical_knowledge_documents (
  id UUID, tenant_id, title, document_type, specialty,
  minio_bucket, minio_key, chunk_count, ingestion_status,
  is_active, uploaded_by, created_at, updated_at
)

-- One row per text chunk with its embedding
clinical_knowledge_chunks (
  id UUID, document_id → documents.id,
  tenant_id,           -- clinic-level isolation
  chunk_index,         -- position in document
  chunk_text,
  chunk_tokens,
  embedding vector(384),   -- pgvector column, cosine via <=>
  metadata JSONB           -- domain, population, keywords
)
```

### Feedback & Learning Tables

```sql
cdss_feedback_entries     -- clinician feedback, learning status machine
cdss_feedback_batches     -- aggregated batch stats

-- Federated learning (EHR service)
FlRound                   -- round metadata, status, aggregated metrics
FlParticipationLog        -- per-clinic contribution, privacy budget
ModelRegistry             -- candidate models with evaluation metrics
ModelPromotionReview      -- approval records per promotion stage
ModelPerformanceMetric    -- time-series AUC, Brier, calibration
ModelFairnessReport       -- parity gap results per model version
```

---

## Redis: Caching & Job Queue

### Query Cache

```
Key:  "rag:query:{tenant_id}:{md5(query + filters + n_results)}"
TTL:  3600 seconds

Same clinical query within the hour → instant response
No re-embedding, no re-searching, no LLM call
```

### LLM Cache

```
Key:  md5(prompt)
TTL:  600 seconds

Identical prompts skip the Ollama call entirely
```

### Job Queue

```
Queue: cdss:jobs:queue   (Redis list, lpush / brpop)
DLQ:   cdss:jobs:dead_letter

POST /admin/ingest → lpush job_id → API returns immediately
cdss-worker brpop(queue, timeout=5s) → _run_job(job_id)
Status: queued → running → completed / failed
Retry: up to 3 times, then dead_letter
Manual recover: POST /admin/jobs/dead-letter/requeue/{job_id}

Job types:
  ingest       — run full guideline corpus ingest
  reindex      — delete + rebuild ChromaDB + BM25
  cache_flush  — clear Redis caches (rag:*, llm:*, cdss:*)
  reencrypt    — re-encrypt payloads in database
  transcribe   — audio transcription + SOAP note generation
  analyze_image — medical image analysis via CLIP
```

---

## Running & Managing Ingestion

### Trigger a full re-ingest

```bash
# Generate a 1-hour JWT (uses JWT_SECRET from .env)
TOKEN=$(node -e "
  const c = require('crypto');
  const h = { alg:'HS256', typ:'JWT' };
  const p = { sub:'admin@medicore.co.zw', email:'admin@medicore.co.zw',
              exp: Math.floor(Date.now()/1000)+3600 };
  const b64 = s => Buffer.from(JSON.stringify(s)).toString('base64url');
  const data = b64(h)+'.'+b64(p);
  const sig = c.createHmac('sha256','dev_secret_key_change_in_production')
               .update(data).digest('base64url');
  console.log(data+'.'+sig);
")

curl -s -X POST http://localhost:8000/admin/ingest \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Watch ingestion progress

```bash
docker logs medicore-cdss-worker -f --tail=20 | grep "Total in DB"
```

### Check job status

```bash
curl -s http://localhost:8000/admin/ingest/jobs \
  -H "Authorization: Bearer $TOKEN" | jq '.[] | {id, status, result}'
```

### Test a guideline search

```bash
curl -s -X POST http://localhost:8000/guidelines/search \
  -H "Content-Type: application/json" \
  -d '{"query":"hypertension management pregnancy","limit":3}' \
  | jq '.citations[].title'
```

### Interactive API docs

`http://localhost:8000/docs` — full Swagger UI for all 60+ CDSS endpoints.

---

*For sprint history and roadmap context, see `docs/SPRINT-ROADMAP-AI-FIRST.md` and `docs/AI_FIRST_MASTER_GUIDE.md`.*
