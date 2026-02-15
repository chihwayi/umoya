# CDSS API Reference

Base URL: `http://cdss-service:8000` (Internal) or via EHR Proxy `/api/cdss/*`

## Health Check
*   **GET** `/health`
    *   Returns service status and timestamp.

## Core Endpoints

### 1. Drug Interaction Check
*   **POST** `/drugs/interactions/advanced`
*   **Description:** Checks for interactions between a list of drugs and patient context.
*   **Request Body:**
    ```json
    {
      "drug_ids": ["uuid-1", "uuid-2"],
      "patient_id": "patient-uuid",
      "drugs_data": [...] // Optional pre-fetched data
    }
    ```
*   **Response:**
    ```json
    {
      "interactions": [...],
      "severity_summary": {"high": 1, "moderate": 0},
      "recommendations": ["Monitor for..."]
    }
    ```

### 2. Clinical Guidelines Check
*   **POST** `/guidelines/check`
*   **Description:** Evaluates patient data against clinical guidelines.
*   **Request Body:**
    ```json
    {
      "condition": "Type 2 Diabetes",
      "patient_age": 45,
      "medications": ["Metformin"],
      "comorbidities": ["Hypertension"]
    }
    ```

### 3. Risk Scoring
*   **POST** `/risk/calculate`
*   **Description:** Calculates risk scores (e.g., Framingham, Readmission).
*   **Request Body:**
    ```json
    {
      "patient_id": "uuid",
      "vitals": {"bp_systolic": 140, "bp_diastolic": 90},
      "medications": [...],
      "diagnoses": [...]
    }
    ```
*   **Response:**
    ```json
    {
      "overall_score": 0.15,
      "risk_level": "moderate",
      "factors": [...],
      "recommendations": [...]
    }
    ```

### 4. Dosing Recommendation
*   **POST** `/dosing/recommend`
*   **Description:** Calculates appropriate medication dosing.
*   **Request Body:**
    ```json
    {
      "medication_id": "uuid",
      "patient_weight_kg": 70,
      "patient_age": 30,
      "renal_function": {"egfr": 60}
    }
    ```

### 5. Diagnostic Suggestion
*   **POST** `/diagnosis/suggest`
*   **Description:** Suggests potential diagnoses based on symptoms.
*   **Request Body:**
    ```json
    {
      "symptoms": ["fever", "cough"],
      "vitals": {"temperature": 38.5},
      "clinical_notes": "Patient reports..."
    }
    ```

### 6. AI-Enhanced Diagnostic Suggestion
*   **POST** `/diagnosis/suggest/intelligent`
*   **Description:** Uses AI models (MedBERT/ClinicalBERT) for deeper analysis.
*   **Request Body:** Same as `/diagnosis/suggest`.

### 7. Guideline Search (RAG)
*   **POST** `/guidelines/search`
*   **Description:** Searches indexed clinical guidance content with optional patient context.

### 8. Lab Interpretation
*   **POST** `/labs/interpret`
*   **Description:** Interprets laboratory values and returns critical/abnormal findings.

### 9. Duplicate Therapy Detection
*   **POST** `/medications/duplicates`
*   **Description:** Detects therapeutic duplication across active medications.

### 10. High-Risk Medication Screening
*   **POST** `/medications/high-risk`
*   **Description:** Screens medications against high-risk criteria (e.g. Beers/SToPP style checks).

### 11. Care Gap Detection
*   **POST** `/care-gaps/detect`
*   **Description:** Identifies preventive and longitudinal care gaps from demographics and history.

### 12. Food-Drug Interaction Screening
*   **POST** `/medications/food-interactions`
*   **Description:** Flags food interactions for active medication list.

### 13. Admin Encryption Re-Encryption Job
*   **POST** `/admin/encryption/reencrypt`
*   **Description:** Runs a key-rotation migration to re-encrypt stored payloads to the active encryption key.
*   **Request Body:**
    ```json
    {
      "async_job": true,
      "dry_run": false,
      "per_table_limit": 500
    }
    ```

## Error Handling

*   **400 Bad Request:** Invalid input data.
*   **404 Not Found:** Resource (e.g., drug, patient) not found.
*   **500 Internal Server Error:** Processing failure.
