# Zimbabwe-Specific Terminology & Language Support

**Date:** December 11, 2024  
**Status:** ✅ Complete

## Overview

Enhanced AI models (MedBERT and ClinicalBERT) with Zimbabwe-specific medical terminology and Shona/Ndebele language support for better accuracy in the Zimbabwean healthcare context.

## What Was Implemented

### 1. Zimbabwe-Specific Terminology Module

**File:** `services/cdss-service/ai_models/zimbabwe_terminology.py`

**Features:**
- Shona symptom translations (12 common symptoms)
- Ndebele symptom translations (12 common symptoms)
- Zimbabwe-specific condition mappings (HIV, TB, Malaria, Diabetes, Hypertension, Pneumonia)
- Disease prevalence multipliers for Zimbabwe context
- Auto-detection of language (Shona/Ndebele/English)

### 2. ClinicalBERT Enhancements

**Enhanced Features:**
- ✅ Shona/Ndebele symptom keyword detection
- ✅ Zimbabwe-specific condition extraction
- ✅ Prevalence-adjusted probability calculations
- ✅ Multi-language symptom translation

**Example:**
- Shona: "fivha" → English: "fever"
- Ndebele: "umkhuhlane" → English: "fever"
- Auto-detects Zimbabwe conditions: "mukondombera" → "HIV/AIDS"

### 3. MedBERT Enhancements

**Enhanced Disease Patterns:**
- Added HIV/AIDS pattern (higher base probability for Zimbabwe)
- Added Tuberculosis pattern (higher base probability)
- Added Malaria pattern (high prevalence in Zimbabwe)
- Adjusted existing patterns for Zimbabwe context

**Base Probabilities Adjusted:**
- HIV/AIDS: 0.18 (was not included)
- Tuberculosis: 0.16 (was not included)
- Malaria: 0.20 (was not included)
- Pneumonia: 0.15 (maintained)

### 4. Benchmarking System

**File:** `services/cdss-service/ai_models/benchmark.py`

**Features:**
- Compare rule-based vs AI vs Fusion accuracy
- Track prediction correctness
- Export results to JSON
- Calculate improvement metrics

## Supported Languages

### Shona Symptoms
- Fever: "fivha", "kupisa", "kupisa kwemuviri"
- Cough: "chikosoro", "kukosora"
- Headache: "musoro", "kurwadza musoro"
- Chest Pain: "kurwadza pachipfuva", "chipfuva"
- Shortness of Breath: "kufemuka", "kushaya mweya"
- Abdominal Pain: "kurwadza mudumbu", "dumbu"
- Nausea: "kusvotwa", "kuda kurutsa"
- Vomiting: "kurutsa"
- Diarrhea: "manyoka", "kuita manyoka"
- Fatigue: "kuneta", "kushaya simba"
- Dizziness: "kudzungaira"
- Joint Pain: "kurwadza mabvi"

### Ndebele Symptoms
- Fever: "umkhuhlane", "ubushushu"
- Cough: "ukukhwehlela"
- Headache: "ubuhlungu bekhanda"
- Chest Pain: "ubuhlungu esifubeni"
- Shortness of Breath: "ukuphefumula"
- Abdominal Pain: "ubuhlungu esiswini"
- Nausea: "ukugula"
- Vomiting: "ukuhlanza"
- Diarrhea: "ukuchama"
- Fatigue: "ukukhathala"
- Dizziness: "ukudangala"
- Joint Pain: "ubuhlungu emalungwini"

## Zimbabwe-Specific Conditions

### High Prevalence Conditions
1. **HIV/AIDS**
   - Shona: "mukondombera", "chirwere chehiv"
   - Ndebele: "isifo sehiv"
   - Local terms: "arv", "antiretroviral", "art"

2. **Tuberculosis**
   - Shona: "chirwere chepfupa", "pfupa"
   - Ndebele: "isifo samathambo"
   - Local terms: "tb", "pulmonary tb"

3. **Malaria**
   - Shona: "marariya", "chirwere chemalaria"
   - Ndebele: "imalariya"
   - Local terms: "malaria", "high fever"

### Moderate Prevalence Conditions
4. **Diabetes**
   - Shona: "chirwere cheshuga", "shuga"
   - Ndebele: "isifo sikashukela"

5. **Hypertension**
   - Shona: "bp yepamusoro", "blood pressure yepamusoro"
   - Ndebele: "bp ephezulu"

## Usage Examples

### Example 1: Shona Clinical Note
```
Input: "Patient ane fivha uye kukosora kwemazuva matatu"
Translation: "Patient has fever and cough for three days"
Detected: fever, cough
Diagnosis Priority: Malaria (0.35), TB (0.30), Pneumonia (0.20)
```

### Example 2: Ndebele Clinical Note
```
Input: "Isiguli sinomkhuhlane nokukhwehlela"
Translation: "Patient has fever and cough"
Detected: fever, cough
Diagnosis Priority: Malaria (0.35), TB (0.30), Pneumonia (0.20)
```

### Example 3: Mixed Language
```
Input: "Patient with mukondombera and TB symptoms"
Detected: HIV/AIDS condition, TB condition
Diagnosis Priority: HIV/AIDS (0.25), Tuberculosis (0.30)
```

## Impact

### Before Enhancement
- Only English symptoms recognized
- Generic disease probabilities
- No Zimbabwe context awareness

### After Enhancement
- ✅ Shona/Ndebele/English symptom recognition
- ✅ Zimbabwe-specific disease prioritization
- ✅ Prevalence-adjusted probabilities
- ✅ Multi-language clinical note analysis

## Testing

Test with Zimbabwe-specific terminology:
```bash
curl -X POST http://localhost:8000/diagnosis/suggest/intelligent \
  -H "Content-Type: application/json" \
  -d '{
    "symptoms": ["fever", "cough"],
    "clinical_notes": "Patient ane fivha uye kukosora. Mukondombera suspected.",
    "age": 35,
    "gender": "male"
  }'
```

Expected: Higher probability for Malaria, TB, and HIV/AIDS diagnoses.

## Files Modified

- ✅ `services/cdss-service/ai_models/zimbabwe_terminology.py` (NEW)
- ✅ `services/cdss-service/ai_models/clinicalbert_diagnostic.py`
- ✅ `services/cdss-service/ai_models/medbert_predictor.py`
- ✅ `services/cdss-service/ai_models/benchmark.py` (NEW)
- ✅ `services/cdss-service/ai_models/__init__.py`

## Next Steps

1. Expand Shona/Ndebele vocabulary (more symptoms/conditions)
2. Add more Zimbabwe-specific disease patterns
3. Collect real-world clinical data for fine-tuning
4. Run benchmark tests with Zimbabwean clinical cases
5. Add support for other local languages if needed


