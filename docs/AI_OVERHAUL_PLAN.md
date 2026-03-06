# AI Clinical Decision Support: Intelligence Overhaul Plan

## 1. Executive Summary
The current implementation of the CDSS (Clinical Decision Support System) suffers from "Garbage In, Garbage Out." While the infrastructure (RAG, Vector DB, LLM) is in place, the **data quality** and **contextual intelligence** are insufficient for a "world-class" EHR. 

The system currently retrieves semantically similar but clinically irrelevant text (e.g., Antenatal Care guidelines for an elderly male patient) and displays raw, broken PDF extracts that erode user trust.

To achieve a "world-class" standard, we must move from **naive RAG** (matching keywords) to **Agentic Clinical RAG** (understanding patient context, structure, and intent).

---

## 2. Current Pain Points & Root Causes

| Symptom | Root Cause | Technical Deficiency |
| :--- | :--- | :--- |
| **"Dumb" Responses** | LLM lacks structured context; forced to summarize noisy input. | Naive "Sliding Window" Chunking breaks sentences and tables. |
| **Irrelevant Guidelines** | Search matches "hypertension" keyword in *any* document (e.g., Pregnancy guidelines). | Lack of **Metadata Filtering** (Age, Sex, Condition) in retrieval. |
| **Broken Grammar/Text** | Raw PDF extraction retains hyphens (`hyper- tension`), headers, and footers. | Basic `pypdf` extraction without layout analysis or cleaning. |
| **No Clear Answer** | System returns *sources* rather than a *synthesized clinical recommendation*. | Prompt does not enforce "Chain of Thought" or structured JSON output. |

---

## 3. The "World-Class" Roadmap

### Phase 1: Smart Ingestion (The Foundation)
*Refining how we read and store knowledge.*

1.  **Layout-Aware PDF Parsing**: 
    *   **Action**: Replace `pypdf` with **`unstructured`** or **`Microsoft MarkItDown`**.
    *   **Goal**: Detect and preserve **Tables** as structured text (CSV/Markdown), remove headers/footers automatically, and join hyphenated words correctly.
2.  **Semantic Chunking**:
    *   **Action**: Stop splitting by 1000 characters. Split by **Headers** (e.g., "Diagnosis", "Treatment", "Contraindications").
    *   **Goal**: Ensure a chunk contains a complete thought/rule, not half a sentence.
3.  **Metadata Extraction (Crucial)**:
    *   **Action**: Use a small LLM during ingestion to tag every chunk.
    *   **Tags**: `target_population` (e.g., "pregnant", "elderly", "pediatric"), `condition` (e.g., "hypertension"), `clinical_intent` (e.g., "screening", "treatment").
    *   **Goal**: Enable filtering (e.g., "Give me hypertension treatment for *non-pregnant* adults").

### Phase 2: Context-Aware Retrieval (The Brain)
*Ensuring we find the RIGHT knowledge.*

1.  **Patient-Guideline Matching**:
    *   **Action**: Before searching, extract patient attributes (Age: 75, Sex: Male, Condition: Hypertension).
    *   **Logic**: Apply **Pre-filtering** to the Vector DB query.
    *   `where={"AND": [{"condition": "hypertension"}, {"target_population": {"$ne": "pregnant"}}]}`
2.  **Query Expansion**:
    *   **Action**: Transform user query "hypertension" → "hypertension management guidelines for elderly male with comorbidities".
3.  **Re-Ranking**:
    *   **Action**: Implement a **Cross-Encoder** (e.g., `bge-reranker-base`) to score the top 20 results and keep only the top 5 *actually relevant* ones.

### Phase 3: Cognitive Synthesis (The Voice)
*Generating human-grade clinical advice.*

1.  **Structured Output (JSON)**:
    *   **Action**: Force LLM to output JSON:
        ```json
        {
          "summary": "...",
          "recommendations": ["..."],
          "warnings": ["..."],
          "citations": [{"id": "doc1", "text": "..."}]
        }
        ```
    *   **Goal**: Frontend renders a clean UI cards, not a wall of text.
2.  **Chain-of-Thought Prompting**:
    *   **Action**: Update system prompt to require "Reasoning":
        "First, analyze the patient's demographics. Second, check if the retrieved guidelines apply to this demographic. Third, formulate a recommendation."
3.  **Model Upgrade**:
    *   **Action**: `llama2:latest` is outdated. Upgrade to **`llama3:8b-instruct`** or **`mistral:7b-instruct-v0.3`**. These models are significantly better at following complex instructions and formatting.

---

## 4. Implementation Plan (Next Steps)

1.  **Immediate Fix (Low Effort, High Impact)**:
    *   Switch LLM model to `llama3` or `mistral` in `docker-compose.yml`.
    *   Implement basic "Metadata Tagging" for existing PDFs (manually or script-based) to separate ANC content.
    
2.  **Medium Term (Engineering Work)**:
    *   Rewrite `ingest_guidelines.py` to use `unstructured` library.
    *   Implement "HyDE" (Hypothetical Document Embeddings) to improve search relevance.

3.  **Long Term (Architecture)**:
    *   Deploy a dedicated "Reranker" service container.
    *   Fine-tune a small model (7B) specifically on WHO guidelines for tone and style.

## 5. Why This Beats "Just Using ChatGPT"
*   **Privacy**: Zero data leaves the hospital's on-premise infrastructure.
*   **Traceability**: Every sentence is linked to a specific, immutable WHO guideline version (unlike ChatGPT's hallucinations).
*   **Specialization**: Tuned specifically for *your* guidelines and *your* patient data schema.
