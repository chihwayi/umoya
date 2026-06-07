# CDSS Guideline Search — Architecture & Tuning Guide

How the clinical **guideline search** works (the "AI Clinical Guidelines" panel in the
nurse/doctor workspaces), how it was tuned for low-resource hardware, and exactly what
to change when running on a GPU / higher-spec machine.

_Last updated: 2026-06-01_

---

## 1. What it is

`POST /guidelines/search` (CDSS service) retrieves relevant clinical-guideline passages
for a free-text query (e.g. "sepsis protocol") and, when possible, generates a short
grounded clinical synthesis. The frontend calls it via the EHR/CDSS proxy
(`ehrApi.searchGuidelines` / `cdssApi`), which the dev proxy authenticates to CDSS with a
service token (`x-service-token`) while the client sends `X-Tenant-ID`.

- **Corpus:** ~39,787 chunks (WHO / GINA / GOLD / NICE PDFs) in ChromaDB collection
  `medical_guidelines`.
- **Embeddings:** `sentence-transformers/all-MiniLM-L6-v2`.
- **LLM:** Ollama on the host (`host.docker.internal:11434`, `llama3.1:latest`, 8B).

---

## 2. How retrieval works (hybrid)

Each query runs two searches in parallel, fused and (optionally) re-ranked:

1. **Vector / semantic search** — query embedded with MiniLM; ChromaDB returns the
   closest-meaning chunks. Short acronyms (HIV, TB, MI, HTN…) are expanded first to
   improve recall.
2. **BM25 / lexical search** — classic keyword ranking over the tokenized corpus; nails
   exact terms (drug names, "SEP-1", dosages) that semantics can miss.
3. **RRF fusion** (Reciprocal Rank Fusion, k=60) — each arm ranks its hits; every chunk
   gets `1/(60 + rank)` from each list, summed. Chunks strong in **both** float to the
   top. Vector covers *meaning*, BM25 covers *exact wording*.
4. **Page-level dedup**, then optional **cross-encoder re-rank** (`ms-marco-MiniLM-L-6-v2`)
   for final precision.
5. **LLM synthesis** — a short, grounded "Clinical Reasoning + Recommendation" summary
   over the top citations. Bounded by a wall-clock timeout; citations are always returned
   even if the LLM is slow/unavailable.

### Quality guards (added 2026-06-01)
- **Junk filter** (`ai_models/chunk_quality.py::is_low_value_text`) drops reference
  lists, bibliographies, acknowledgments, and society/TOC pages — these repeat keywords
  (so BM25 ranks them) but carry no clinical guidance. Applied **at query time** (cleans
  the existing corpus immediately) and **at ingestion** (`ingest_guidelines.py`).
- **Text cleaning** (`clean_chunk_text`) strips URLs, "Cited Here | Google Scholar",
  "91 of 170", and timestamps from chunk text.
- **Confidence display** — 0-confidence (BM25-only) hits show **"Keyword match"** in the
  UI instead of a misleading red "0%".

---

## 3. Current configuration (tuned for ~14 GB RAM, CPU/Metal Ollama)

Goal on this hardware: **excellent results** (junk-free, grounded) accepting ~50s latency.

| Setting | Where | Value | Why |
|---|---|---|---|
| `RAG_BM25_MAX_DOCS` | docker-compose (cdss) | `60000` | Above the ~40k corpus → BM25 builds → hybrid on. (Lower to 15000 to force fast vector-only on a constrained host.) |
| `RAG_ENABLE_RERANK` | docker-compose (cdss) | `false` | Cross-encoder is ~20s/query on CPU; RRF ordering is already strong. |
| `CDSS_WARM_RAG_ON_STARTUP` | env (default true) | `true` | Loads embedding model + builds BM25 in a background thread at boot, so the first search isn't a cold ~minutes build. |
| `LLM_GUIDELINES_TIMEOUT_SECONDS` | `.env` | `45` | Enough for the 8B model to finish the synthesis on this hardware. |
| `LLM_GUIDELINES_MAX_TOKENS` | env (read in `main.py`) | `450` | Caps synthesis length (a nurse summary is short). |
| Synthesis prompt | `main.py` | top 4 citations × 1200 chars | Focused prompt so the LLM finishes within budget while staying grounded. |
| Service auth | docker-compose (ehr-frontend) | `CDSS_SERVICE_TOKEN` injected by `setupProxy.js` | Browser→CDSS calls authenticate without exposing the secret. |

**Verified result** (query "postpartum hemorrhage management"): 5 citations, top 3 on-target
(*Intrapartum care.pdf* p.78/81/145, conf 0.70–0.74), no reference-list junk, plus a
grounded Clinical Reasoning + Recommendation synthesis. ~50s end-to-end.

### The latency tradeoff
The junk-free citations are ready in ~5s; the extra ~45s is the on-device LLM writing the
summary (8B prompt-eval over guideline context). A smaller model (gemma4:e4b) was tested
and was **not** faster. So on this hardware it's a genuine fork:
- **A — Depth (current):** citations **+ synthesis**, ~50s.
- **B — Speed:** citations only (still junk-filtered + hybrid), ~5s — set
  `LLM_GUIDELINES_TIMEOUT_SECONDS=0` / disable synthesis.
- **C — Best of both (proper fix):** return citations instantly, stream/poll the synthesis
  in the background. Needs a frontend + endpoint change.

---

## 4. When on GPU / quality hardware — best tweaks

1. **`RAG_ENABLE_RERANK=true`** — re-enable the cross-encoder for maximum precision
   (cheap on GPU).
2. **Synthesis becomes near-instant** → raise `LLM_GUIDELINES_MAX_TOKENS` back toward
   `1024` and lower `LLM_GUIDELINES_TIMEOUT_SECONDS` to ~`20`.
3. **Keep `RAG_BM25_MAX_DOCS=60000`** (hybrid on); raise only if the corpus grows past it.
4. **Biggest UX win regardless of hardware:** build **async synthesis** (option C) —
   citations stream immediately, the summary fills in after.

---

## 5. Adjacent / known issues (not blockers)

- **pgvector KB** table `knowledge_chunks` does not exist in this environment, so the
  Sprint-114 pgvector path in `search_guidelines` no-ops and retrieval uses ChromaDB.
  Provision it (or leave it) — ChromaDB hybrid is the active path.
- The **super-admin CDSS ingest panel** polls a stale seed-job ID, producing harmless
  `404` noise in CDSS logs.
- Memory: the embedding model + BM25 index (~40k chunks) need headroom; on <10 GB Docker
  RAM, drop `RAG_BM25_MAX_DOCS` to ~15000 (vector-only) to avoid OOM.

---

## 6. Key files

| File | Role |
|---|---|
| `services/cdss-service/main.py` | `/guidelines/search`, startup RAG warm-up, synthesis prompt + budget |
| `services/cdss-service/ai_models/rag_engine.py` | Hybrid retrieval (vector+BM25+RRF), re-rank, BM25 build, query-time junk filter |
| `services/cdss-service/ai_models/chunk_quality.py` | `is_low_value_text` + `clean_chunk_text` |
| `services/cdss-service/ai_models/llm_provider.py` | Ollama client; `generate_response(..., max_tokens=)` |
| `services/cdss-service/ingest_guidelines.py` | PDF chunking + ingestion-time junk filter |
| `ehr-frontend/src/setupProxy.js` | Injects `x-service-token` for `/cdss-service` |
| `ehr-frontend/src/components/GuidelineSearchPanel.tsx` | Results UI + "Keyword match" label |
