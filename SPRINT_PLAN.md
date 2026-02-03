# MediCore AI Transformation Sprint Plan

This document outlines the roadmap for transforming MediCore from a standard EHR into an AI-First Clinical Assistant. The plan is organized from foundational upgrades (low complexity/immediate value) to transformative capabilities (high complexity/high value).

## 🏁 Sprint 1: Foundation & "Real" Diagnostics (Weeks 1-2)
**Goal:** Replace "mock" or static rule-based logic with actual Generative AI capabilities using Local LLMs.

### 1. Local LLM Infrastructure
- **Objective:** Enable `cdss-service` to communicate with local LLMs (e.g., Llama 3, BioMistral) to avoid cloud costs and ensure data privacy.
- **Tasks:**
  - [x] Set up `Ollama` or `llama.cpp` integration in `services/cdss-service`.
  - [x] Create an `LLMService` abstraction layer in Python to handle prompt engineering and model fallback.

### 2. Intelligent Diagnostic Upgrade
- **Objective:** Enhance the existing `DiagnosticAssistant` to generate differential diagnoses for complex cases that simple rules miss.
- **Tasks:**
  - [x] Refactor `DiagnosticAssistant` (in `diagnostic_assistant.py`) to prompt the LLM with patient symptoms and vitals.
  - [x] Update `IntelligentFusionEngine` to weigh LLM suggestions alongside rule-based results.
  - [ ] **Value:** Moves from simple pattern matching (Fever = Flu) to complex reasoning.

### 3. Patient Note Summarization
- **Objective:** Reduce cognitive load by auto-summarizing patient history.
- **Tasks:**
  - [x] Create an endpoint `/api/cdss/summarize-history` (implemented as `/patient/summarize`).
  - [x] Implement prompts to generate a "One-Liner" summary for the patient header in `ehr-frontend`.

---

### 4. Predictive Analytics & "Truthful" Dashboards (Sprint 2)
- **Objective:** Replace random/mock data in dashboards with actual predictive modeling.
- **Tasks:**
  - [x] Integrate `statsmodels` or `Prophet` for time-series forecasting.
  - [x] Implement Glucose Forecasting: Predict future glucose levels based on historical logs (Exponential Smoothing).
  - [x] Implement Lab Trend Analysis: Detect declining trajectories in HIV (Viral Load/CD4) and TB patients (Linear Regression).
  - [ ] **Value:** Clinicians see *real* trends, not just static charts.

---

## 📚 Sprint 3: The "Brain" - RAG & Knowledge Base (Weeks 5-6)
**Goal:** Establish the "Truth Layer" to prevent hallucinations and ensure guideline compliance (as per strategic roadmap).

### 1. RAG Infrastructure & Knowledge Base
- **Objective:** Enable semantic search over medical documents and patient history.
- **Tasks:**
  - [ ] **Data Normalization:** Integrate `scispaCy` or `John Snow Labs` to map messy notes to standard codes (ICD-10, SNOMED).
  - [ ] **Vector Database:** Setup `ChromaDB` (local) for storing embeddings of guidelines and historical cases.
  - [ ] **Embeddings:** Implement `sentence-transformers` (e.g., `BioBERT` or `all-MiniLM`) for converting text to vectors.

### 2. Guideline Ingestion
- **Objective:** Make the `who-smart-guidelines` folder searchable.
- **Tasks:**
  - [ ] Build an ingestion script to parse PDFs/Markdown files.
  - [ ] Index WHO Guidelines into the Vector DB.

### 3. RAG-Enhanced Inference
- **Objective:** Force the LLM to "look up" facts before answering.
- **Tasks:**
  - [ ] Update `DiagnosticAssistant` to retrieve top-3 relevant guidelines before prompting Llama.
  - [ ] Implement "Citations" in the API response (e.g., "Source: HIV Guidelines p.4").

---

## 🎙️ Sprint 4: The "AI Scribe" (Weeks 7-8)
**Goal:** Reduce clinician documentation time by 50% using Voice AI.

### 1. Voice-to-Text Engine
- **Objective:** Transcribe consultations securely within the backend.
- **Tasks:**
  - [ ] Integrate `faster-whisper` (optimized Whisper model) into `cdss-service`.
  - [ ] Add microphone streaming/upload support to `VoiceConsultation` component in frontend.

### 2. Auto-SOAP Generation
- **Objective:** Convert raw transcripts into structured medical notes.
- **Tasks:**
  - [ ] Design prompts to extract **S**ubjective, **O**bjective, **A**ssessment, and **P**lan from transcripts.
  - [ ] Auto-fill the "Clinical Notes" form for physician review.

---

## 👁️ Sprint 5: Advanced Vision & Multimodal (Weeks 9-10)
**Goal:** Automated screening of medical imaging.

### 1. AI Radiologist
- **Objective:** Triage Chest X-Rays for TB and Pneumonia.
- **Tasks:**
  - [ ] Integrate a Vision-Language Model (like `MedGemma` or `CLIP`) into `cdss-service`.
  - [ ] Create an analysis pipeline for DICOM/JPEG uploads in `ImagingDashboard`.

---

## 📋 Summary of Value
- **Low Complexity / High Value:** Sprint 1 (LLM Integration) & Sprint 2 (Analytics). These use existing data to provide immediate insights.
- **Medium Complexity / Very High Value:** Sprint 3 (Voice Scribe). Drastically improves user experience and data quality.
- **High Complexity / Strategic Value:** Sprint 4 (RAG) & Sprint 5 (Vision). Positions MediCore as a cutting-edge, guideline-compliant platform.
