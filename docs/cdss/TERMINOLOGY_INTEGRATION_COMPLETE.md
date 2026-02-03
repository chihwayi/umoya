# SNOMED CT & ICD-10 Code Integration - Implementation Complete

**Date:** December 2024  
**Status:** ✅ Phase 0 Complete - Ready for Testing

## Overview

Successfully integrated SNOMED CT and ICD-10 terminology codes into the CDSS diagnostic system. All diagnostic responses now include standardized medical codes for interoperability and billing.

## What Was Implemented

### 1. Terminology Mapping Modules

#### ICD-10 Mapper (`services/cdss-service/terminology/icd10_mapper.py`)
- Comprehensive diagnosis → ICD-10 code mapping
- Symptom → ICD-10 code mapping for chief complaints
- Fuzzy matching for diagnosis name variations
- Batch code lookup support

**Key Features:**
- 50+ common diagnoses mapped to ICD-10 codes
- Symptom mapping for chief complaints
- Case-insensitive and partial matching
- Returns `None` if code not found (graceful degradation)

#### SNOMED CT Mapper (`services/cdss-service/terminology/snomed_mapper.py`)
- Symptom/finding → SNOMED CT concept ID mapping
- Diagnosis → SNOMED CT concept ID mapping
- Batch code lookup support

**Key Features:**
- 30+ symptoms mapped to SNOMED CT codes
- 25+ diagnoses mapped to SNOMED CT codes
- Supports both symptom and diagnosis lookups

#### Terminology Service (`services/cdss-service/terminology/terminology_service.py`)
- Integration layer for EHR terminology service (optional)
- Local mapper fallback (always available)
- Async support for future enhancements

### 2. Integration Points

#### Diagnostic Assistant (`services/cdss-service/diagnostic_assistant.py`)
- ✅ Initializes ICD-10 and SNOMED mappers on startup
- ✅ Enriches all rule-based diagnoses with codes
- ✅ Returns codes in `suggest_diagnosis()` responses

**Response Format:**
```json
{
  "suggested_diagnoses": [
    {
      "diagnosis": "Pneumonia",
      "probability": 0.75,
      "confidence": "high",
      "icd10": "J18.9",
      "snomed": "233604007",
      "matching_symptoms": ["fever", "cough"]
    }
  ]
}
```

#### Fusion Engine (`services/cdss-service/ai_models/fusion_engine.py`)
- ✅ Enriches fused AI + rule-based diagnoses with codes
- ✅ Includes codes in all diagnostic suggestions

#### MedBERT Predictor (`services/cdss-service/ai_models/medbert_predictor.py`)
- ✅ Adds ICD-10 and SNOMED codes to AI predictions
- ✅ Codes included in lightweight mode predictions

#### ClinicalBERT Diagnostic (`services/cdss-service/ai_models/clinicalbert_diagnostic.py`)
- ✅ Adds ICD-10 and SNOMED codes to clinical note analysis
- ✅ Codes included in text-based diagnostic suggestions

## Code Examples

### Using ICD-10 Mapper Directly

```python
from terminology.icd10_mapper import Icd10Mapper

mapper = Icd10Mapper()
code = mapper.get_icd10_code("Pneumonia")  # Returns "J18.9"
code = mapper.get_icd10_code("pneumonia")  # Also works (case-insensitive)
```

### Using SNOMED Mapper Directly

```python
from terminology.snomed_mapper import SnomedMapper

mapper = SnomedMapper()
code = mapper.get_snomed_code("Pneumonia")  # Returns "233604007"
code = mapper.get_snomed_for_symptom("fever")  # Returns "386661006"
```

## API Response Format

All diagnostic endpoints now return codes:

### Rule-Based CDSS Response
```json
POST /diagnosis/suggest
{
  "symptoms": ["fever", "cough"],
  "vitals": {"temperature": 38.5}
}

Response:
{
  "suggested_diagnoses": [
    {
      "diagnosis": "Bacterial Pneumonia",
      "probability": 0.65,
      "confidence": "moderate",
      "icd10": "J15.9",
      "snomed": "233604007",
      "matching_symptoms": ["fever", "cough"]
    }
  ],
  "recommended_tests": ["CBC", "Chest X-ray"],
  "red_flags": []
}
```

### Intelligent AI-Enhanced Response
```json
POST /diagnosis/suggest/intelligent
{
  "symptoms": ["fever", "cough"],
  "clinical_notes": "Patient presents with 3-day history of fever and productive cough",
  "age": 45,
  "gender": "male"
}

Response:
{
  "suggested_diagnoses": [
    {
      "diagnosis": "Bacterial Pneumonia",
      "probability": 0.72,
      "confidence": "high",
      "icd10": "J15.9",
      "snomed": "233604007",
      "sources": ["rule_based", "medbert", "clinicalbert"],
      "source_count": 3,
      "explanation": "Suggested by rule_based, medbert, clinicalbert (3 sources agree)"
    }
  ],
  "ai_enabled": true,
  "ai_models_used": {
    "medbert": true,
    "clinicalbert": true
  }
}
```

## Testing

### Test ICD-10 Mapping
```bash
# Test via Python
python3 -c "
from services.cdss-service.terminology.icd10_mapper import Icd10Mapper
mapper = Icd10Mapper()
print(mapper.get_icd10_code('Pneumonia'))
print(mapper.get_icd10_code('Heart Failure'))
"
```

### Test via API
```bash
# Test diagnostic endpoint
curl -X POST http://localhost:8000/diagnosis/suggest \
  -H "Content-Type: application/json" \
  -d '{
    "symptoms": ["fever", "cough"],
    "vitals": {"temperature": 38.5}
  }'

# Verify codes are in response
```

## Next Steps

1. **Expand Code Coverage**
   - Add more diagnoses to ICD-10 mapper (currently ~50)
   - Add more symptoms to SNOMED mapper (currently ~30)
   - Consider integrating with full ICD-10/SNOMED databases

2. **EHR Service Integration** (Optional)
   - Enable `CDSS_USE_EHR_TERMINOLOGY=true` in environment
   - CDSS will query EHR terminology service for codes not in local mapper
   - Requires authentication token

3. **Code Validation**
   - Add validation to ensure codes are valid
   - Check code hierarchies (parent/child relationships)
   - Validate against current ICD-10/SNOMED versions

4. **Testing**
   - Test with real diagnostic requests
   - Verify codes appear in all diagnostic responses
   - Test edge cases (unknown diagnoses, partial matches)

## Files Modified

- ✅ `services/cdss-service/diagnostic_assistant.py`
- ✅ `services/cdss-service/ai_models/fusion_engine.py`
- ✅ `services/cdss-service/ai_models/medbert_predictor.py`
- ✅ `services/cdss-service/ai_models/clinicalbert_diagnostic.py`

## Files Created

- ✅ `services/cdss-service/terminology/__init__.py`
- ✅ `services/cdss-service/terminology/icd10_mapper.py`
- ✅ `services/cdss-service/terminology/snomed_mapper.py`
- ✅ `services/cdss-service/terminology/terminology_service.py`

## Notes

- Codes are optional - if a code is not found, the diagnosis is still returned without the code
- Local mappers are fast (no network calls)
- EHR service integration is optional and can be enabled via environment variable
- All mappers support fuzzy matching for better code lookup


