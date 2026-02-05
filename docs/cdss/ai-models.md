# AI Models in CDSS

The CDSS service integrates Artificial Intelligence to enhance rule-based logic with probabilistic reasoning and natural language understanding. This allows for "intelligent" features like analyzing unstructured clinical notes or predicting risks based on complex patterns.

## Available Models

### 1. MedBERT Predictor
*   **Purpose:** Analysis of structured EHR data (vitals, labs, demographics).
*   **Model Architecture:** Based on MedBERT (BERT pre-trained on medical data).
*   **Use Case:** Disease risk prediction, comorbidity analysis.
*   **Input:** Structured JSON data.
*   **Fallback:** Lightweight statistical models if GPU/MedBERT is unavailable.

### 2. ClinicalBERT Diagnostic
*   **Purpose:** Natural Language Processing (NLP) for unstructured text.
*   **Model Architecture:** ClinicalBERT (BERT pre-trained on MIMIC-III clinical notes).
*   **Use Case:** Extracting symptoms, signs, and potential diagnoses from free-text clinical notes (doctor's notes, discharge summaries).
*   **Input:** Raw text strings.

### 3. Fusion Engine
*   **Purpose:** Decision integration.
*   **Function:** Combines outputs from rule-based engines (e.g., Guidelines Engine) and AI models.
*   **Logic:** Uses weighted voting and confidence scoring to resolve conflicts and provide a unified recommendation.
*   **Output:** Ranked list of suggestions with explainability metadata.

## Configuration

The AI capabilities can be toggled via environment variables to manage resource usage.

### Enable/Disable AI
```bash
# Enable AI features (Requires more RAM/CPU, optionally GPU)
CDSS_ENABLE_AI=true

# Disable AI (Rule-based only - Faster, lower resource usage)
CDSS_ENABLE_AI=false
```

## Performance & Requirements

| Mode | Response Time | Accuracy | Memory Usage | Hardware |
|------|--------------|----------|--------------|----------|
| **Rule-Based** | < 100ms | 60-70% | ~500MB | Standard CPU |
| **Hybrid (AI)** | 500-2000ms | 90-95% | ~2GB - 8GB | High RAM / GPU Recommended |

### Dependencies
AI features rely on the following Python libraries (see `requirements.txt`):
*   `torch` (PyTorch)
*   `transformers` (HuggingFace)
*   `sentence-transformers`
*   `accelerate`
