# CDSS + AI Integration Plan
## Making CDSS "Thinking" and Dynamic

**Last Updated:** December 2024

---

## 🎯 Goal

Transform CDSS from **rule-based** to **intelligent/thinking** by integrating:
1. **MedBERT** - For structured EHR data
2. **ClinicalBERT** - For clinical notes/text
3. **Hybrid approach** - Combine rule-based + AI

---

## 🧠 How CDSS and AI Work Together

### Current Flow (Rule-Based Only)
```
Symptoms → Pattern Matching → Static Rules → Suggestions
```

### New Flow (Hybrid: Rule-Based + AI)
```
Symptoms/Notes/Vitals
    │
    ├─→ Rule-Based CDSS ──┐
    │   • Guidelines       │
    │   • Drug checks      │
    │   • Risk scores      │
    │                      │
    └─→ AI Models ─────────┤
        • MedBERT          │
        • ClinicalBERT     │
                          │
                          ▼
                ┌─────────────────┐
                │  Fusion Engine  │
                │  • Combine      │
                │  • Rank         │
                │  • Confidence   │
                └────────┬────────┘
                         │
                         ▼
                ┌─────────────────┐
                │  Final           │
                │  Recommendations │
                └─────────────────┘
```

### Why Both?

**Rule-Based CDSS:**
- ✅ Fast (<100ms)
- ✅ Explainable (clear rules)
- ✅ Reliable for known patterns
- ✅ Drug interactions, dosing

**AI Models:**
- ✅ Learns from data
- ✅ Handles novel cases
- ✅ Complex pattern recognition
- ✅ Context-aware

**Together:**
- Rule-based validates known patterns
- AI suggests from complex/novel patterns
- Both cross-validate
- Best accuracy and coverage

---

## 🔧 Implementation

### Phase 1: Set Up AI Infrastructure

**File:** `services/cdss-service/ai_models/__init__.py`

```python
# Install dependencies
# requirements.txt additions:
# transformers>=4.30.0
# torch>=2.0.0
# sentence-transformers>=2.2.0
```

### Phase 2: MedBERT Integration

**File:** `services/cdss-service/ai_models/medbert_predictor.py`

```python
from transformers import AutoModel, AutoTokenizer
import torch
import numpy as np

class MedBERTPredictor:
    """
    MedBERT for structured EHR data
    Predicts disease risk from vitals, labs, demographics
    """
    def __init__(self):
        model_name = "medbert/medbert-base"  # Or use local model
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModel.from_pretrained(model_name)
        self.model.eval()
    
    def predict_disease_risk(self, patient_data: dict):
        """
        patient_data: {
            'age': 45,
            'gender': 'male',
            'vitals': {...},
            'labs': {...},
            'conditions': [...]
        }
        """
        # Convert structured data to embeddings
        # Predict disease probabilities
        # Return ranked diagnoses with confidence
        pass
```

### Phase 3: ClinicalBERT Integration

**File:** `services/cdss-service/ai_models/clinicalbert_diagnostic.py`

```python
from transformers import AutoModelForSequenceClassification, AutoTokenizer

class ClinicalBERTDiagnostic:
    """
    ClinicalBERT for unstructured clinical notes
    Analyzes chief complaint, history, notes
    """
    def __init__(self):
        model_name = "emilyalsentzer/Bio_ClinicalBERT"
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_name)
        self.model.eval()
    
    def suggest_diagnoses(self, clinical_text: str):
        """
        clinical_text: "Patient presents with fever, cough, shortness of breath..."
        Returns: List of diagnoses with probabilities
        """
        # Process clinical notes
        # Extract entities
        # Suggest diagnoses
        pass
```

### Phase 4: Fusion Engine

**File:** `services/cdss-service/ai_models/fusion_engine.py`

```python
class IntelligentFusionEngine:
    """
    Combines rule-based CDSS + AI model results
    """
    def fuse_recommendations(
        self,
        rule_based_results: dict,
        medbert_results: dict,
        clinicalbert_results: dict
    ):
        """
        Combine and rank all recommendations
        Resolve conflicts
        Calculate confidence scores
        """
        # Weighted combination
        # Conflict resolution
        # Confidence scoring
        # Ranking
        pass
```

### Phase 5: Update Diagnostic Assistant

**File:** `services/cdss-service/diagnostic_assistant.py` (enhance)

```python
class DiagnosticAssistant:
    def __init__(self):
        self.medbert = MedBERTPredictor()
        self.clinicalbert = ClinicalBERTDiagnostic()
        self.fusion_engine = IntelligentFusionEngine()
        # ... existing rule-based logic
    
    def intelligent_suggest(
        self,
        symptoms: List[str],
        vitals: dict,
        clinical_notes: str,
        patient_data: dict
    ):
        # Rule-based (existing)
        rule_results = self.suggest(symptoms, vitals)
        
        # AI-based
        medbert_results = self.medbert.predict_disease_risk(patient_data)
        clinicalbert_results = self.clinicalbert.suggest_diagnoses(clinical_notes)
        
        # Fusion
        return self.fusion_engine.fuse_recommendations(
            rule_results,
            medbert_results,
            clinicalbert_results
        )
```

### Phase 6: Update API Endpoint

**File:** `services/cdss-service/main.py`

```python
@app.post("/diagnosis/suggest/intelligent")
async def intelligent_diagnosis(request: IntelligentDiagnosisRequest):
    """
    Hybrid: Rule-based CDSS + AI models
    """
    # Get all inputs
    symptoms = request.symptoms
    vitals = request.vitals
    clinical_notes = request.clinical_notes
    patient_data = {
        'age': request.age,
        'gender': request.gender,
        'vitals': vitals,
        'labs': request.labs,
        'history': request.history
    }
    
    # Intelligent suggestion
    results = diagnostic_assistant.intelligent_suggest(
        symptoms=symptoms,
        vitals=vitals,
        clinical_notes=clinical_notes,
        patient_data=patient_data
    )
    
    return {
        'suggested_diagnoses': results.diagnoses,
        'confidence_scores': results.confidences,
        'source': 'hybrid_cdss_ai',
        'rule_based_contributions': results.rule_contributions,
        'ai_contributions': results.ai_contributions,
        'explanation': results.explanation
    }
```

---

## 📊 Expected Improvements

### Diagnostic Accuracy
- **Current (Rule-based):** 60-70%
- **With AI:** 85-90%
- **Hybrid:** 90-95%

### Coverage
- **Current:** Known patterns only
- **With AI:** Novel cases, complex patterns
- **Hybrid:** Comprehensive

### Response Time
- **Rule-based:** <100ms
- **AI:** 500-2000ms
- **Hybrid:** ~1000ms (acceptable)

---

## 🚀 Quick Start Implementation

### Step 1: Add Dependencies
```bash
cd services/cdss-service
pip install transformers torch sentence-transformers
```

### Step 2: Create AI Models Directory
```bash
mkdir -p services/cdss-service/ai_models
```

### Step 3: Implement Models (see code above)

### Step 4: Update Diagnostic Assistant

### Step 5: Test Integration

---

## 🎯 Timeline

- **Week 1:** Set up infrastructure, install models
- **Week 2:** Implement MedBERT integration
- **Week 3:** Implement ClinicalBERT integration
- **Week 4:** Build fusion engine
- **Week 5:** Integrate with CDSS
- **Week 6:** Testing and refinement

---

## 📚 Resources

- **MedBERT:** https://huggingface.co/medbert/medbert-base
- **ClinicalBERT:** https://huggingface.co/emilyalsentzer/Bio_ClinicalBERT
- **Transformers:** https://huggingface.co/docs/transformers
