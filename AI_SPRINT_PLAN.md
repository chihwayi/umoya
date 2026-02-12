# AI Clinical Decision Support: 8-Week Sprint Plan

**Goal**: Transform Medicore CDSS from a "Naive RAG" prototype into a "World-Class" Clinical Assistant.
**Cycle**: 2-Week Sprints.

---

## Sprint 1: The "Clean Data" Foundation (Weeks 1-2)
**Theme**: "Garbage In, Garbage Out" Elimination.
**Objective**: Ensure every chunk of text in the Vector DB is clean, complete, and context-rich.

### Key Deliverables:
1.  **Advanced PDF Ingestion Pipeline** [COMPLETED]
    *   **Task**: Replace `pypdf` with `unstructured` or `layoutparser`.
    *   **Success Criteria**: Tables are parsed as Markdown/CSV, not garbled text. Headers/Footers are stripped.
2.  **Semantic Chunking Strategy** [COMPLETED]
    *   **Task**: Implement "Header-Based Chunking" (split by "Diagnosis", "Treatment" sections) instead of arbitrary character limits.
    *   **Success Criteria**: A chunk must never start in the middle of a sentence.
3.  **Data Hygiene** [COMPLETED]
    *   **Task**: WIPE the current ChromaDB. Re-ingest all 20+ WHO guidelines with the new pipeline.
    *   **Success Criteria**: No more "broken grammars" or disjointed words (`hyper- tension`) in search results.

---

## Sprint 2: Intelligence & Context (Weeks 3-4)
**Theme**: "Know the Patient."
**Objective**: Stop showing irrelevant guidelines (e.g., ANC for elderly males).

### Key Deliverables:
1.  **Metadata Tagging System** [COMPLETED]
    *   **Task**: Update ingestion to tag chunks with `target_population` (e.g., "pregnant", "adult", "child") and `clinical_domain` (e.g., "cardiology").
    *   **Success Criteria**: Every vector in ChromaDB has valid metadata.
2.  **Context-Aware Retrieval** [COMPLETED]
    *   **Task**: Modify `RAGEngine.query()` to accept patient demographics (Age, Sex).
    *   **Logic**: `if patient.sex == 'Male': exclude(metadata.target_population == 'pregnant')`.
    *   **Success Criteria**: Searching "hypertension" for a 75yo Male returns *zero* pregnancy-related chunks.
3.  **Model Upgrade (Llama 3 Integration)** [COMPLETED]
    *   **Task**: Finalize `llama3` transition. Update prompts to leverage its stronger reasoning.
    *   **Success Criteria**: System passes the "Reasoning Test" (can synthesize conflicting guidelines).

---

## Sprint 3: The "Clinical Voice" & UX (Weeks 5-6)
**Theme**: "Clear, Actionable Advice."
**Objective**: Move from "Sources & Guidelines" to "Clinical Recommendations."

### Key Deliverables:
1.  **Structured Output Engineering**
    *   **Task**: Force LLM to output strict JSON: `{ "recommendation": "...", "evidence_level": "...", "citations": [...] }`.
    *   **Success Criteria**: Zero parsing errors in the backend.
2.  **Frontend Cards Redesign**
    *   **Task**: Update `VitalsPanel.tsx` to render "Recommendation Cards" (Green/Yellow/Red alerts) instead of raw text blocks.
    *   **Success Criteria**: Nurses can see the "Answer" in <2 seconds without reading paragraphs.
3.  **Chain-of-Thought Prompting**
    *   **Task**: Rewrite system prompts to require "Step-by-Step Clinical Reasoning" before giving the final answer.
    *   **Success Criteria**: Responses explain *why* a recommendation was made (e.g., "Because BP > 160/100...").

---

## Sprint 4: Performance & Refinement (Weeks 7-8)
**Theme**: "Speed & Precision."
**Objective**: Sub-second latency and 99% relevance.

### Key Deliverables:
1.  **Re-Ranking Layer**
    *   **Task**: Deploy a Cross-Encoder (e.g., `bge-reranker`) to re-score the top 20 results.
    *   **Success Criteria**: The single best paragraph is always Rank #1.
2.  **Hybrid Search**
    *   **Task**: Combine Vector Search (Semantic) with BM25 (Keyword) search.
    *   **Success Criteria**: Exact drug names (e.g., "Nifedipine") are found even if the embedding model is fuzzy.
3.  **Latency Optimization**
    *   **Task**: Implement Redis Caching for frequent queries (e.g., "Hypertension treatment").
    *   **Success Criteria**: Common queries return in <200ms.

---

## Immediate Next Steps (Day 0)
1.  **Config**: Update `docker-compose.yml` to lock in `llama3`.
2.  **Code**: Create the `clean_text` utility (Done).
3.  **Plan**: Approval of this Sprint Plan.
