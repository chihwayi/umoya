# Clinical Decision Support System (CDSS) Overview

The **MediCore CDSS Service** is a Python-based microservice powered by **FastAPI** that provides advanced clinical reasoning, risk assessment, and decision support capabilities to the EHR platform. It acts as an intelligent layer that assists healthcare providers by analyzing patient data against medical knowledge bases and AI models.

## Key Features

### 1. Drug Interaction Checking
*   **Advanced Analysis:** Checks for drug-drug, drug-food, and drug-condition interactions.
*   **Severity Scoring:** Provides severity levels (low, moderate, high, critical) and actionable recommendations.
*   **Powered by:** `DrugInteractionAnalyzer` and `FoodInteractionChecker`.

### 2. Clinical Guidelines Engine
*   **Automated Guidelines:** Matches patient conditions against established clinical guidelines (e.g., WHO, CDC).
*   **Compliance Checks:** Ensures treatment plans align with standard of care.
*   **Powered by:** `ClinicalGuidelinesEngine`.

### 3. Risk Scoring & Assessment
*   **Predictive Modeling:** Calculates patient risk scores for various conditions (e.g., cardiovascular risk, readmission risk).
*   **Multi-Factor Analysis:** Considers vitals, labs, medications, and history.
*   **Powered by:** `RiskScoringEngine`.

### 4. Dosing Calculator
*   **Precision Dosing:** Adjusts dosages based on renal function (eGFR), weight, age, and body surface area (BSA).
*   **Pediatric Support:** Specialized calculations for pediatric dosing.
*   **Powered by:** `DosingCalculator`.

### 5. Diagnostic Assistance
*   **Symptom Analysis:** Suggests differential diagnoses based on reported symptoms and clinical signs.
*   **AI-Enhanced:** Leverages machine learning models to analyze unstructured clinical notes.
*   **Powered by:** `DiagnosticAssistant` and `ai_models`.

### 6. Trend Analysis & Lab Interpretation
*   **Longitudinal Analysis:** Detects concerning trends in patient vitals and lab results over time.
*   **Contextual Interpretation:** Interprets lab results in the context of patient demographics and history.
*   **Powered by:** `TrendAnalysisEngine` and `LabResultInterpreter`.

## Architecture

The CDSS service is designed as a stateless microservice:

*   **Framework:** FastAPI (Python 3.9+)
*   **Communication:** REST API (JSON)
*   **Integration:** Called by `ehr-service` via internal HTTP requests.
*   **Scalability:** Can be scaled horizontally; computationally intensive tasks (AI inference) can be offloaded to GPU-enabled nodes.

## Integration Flow

1.  **Trigger:** A user action in the EHR (e.g., prescribing a medication, viewing a dashboard) triggers a request to the `ehr-service`.
2.  **Proxy:** The `ehr-service` gathers necessary patient context and forwards the request to the `cdss-service`.
3.  **Analysis:** The `cdss-service` processes the data using its engines and AI models.
4.  **Response:** The CDSS returns structured recommendations, warnings, or scores to the `ehr-service`, which presents them to the user.
