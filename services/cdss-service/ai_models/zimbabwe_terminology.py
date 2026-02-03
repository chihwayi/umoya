"""
Zimbabwe-Specific Medical Terminology
Supports Shona, Ndebele, and local medical terms
"""

# Zimbabwe-specific medical terminology mappings
ZIMBABWE_TERMINOLOGY = {
    # Common conditions (English -> Local terms)
    'hiv': {
        'shona': ['hiv', 'mukondombera', 'chirwere chehiv'],
        'ndebele': ['hiv', 'isifo sehiv'],
        'local_terms': ['arv', 'antiretroviral', 'art', 'arvs']
    },
    'tuberculosis': {
        'shona': ['tb', 'chirwere chepfupa', 'pfupa'],
        'ndebele': ['tb', 'isifo samathambo'],
        'local_terms': ['tuberculosis', 'pulmonary tb', 'extra-pulmonary tb']
    },
    'malaria': {
        'shona': ['malaria', 'marariya', 'chirwere chemalaria'],
        'ndebele': ['malaria', 'imalariya'],
        'local_terms': ['malaria', 'fever', 'high fever']
    },
    'diabetes': {
        'shona': ['diabetes', 'chirwere cheshuga', 'shuga'],
        'ndebele': ['diabetes', 'isifo sikashukela'],
        'local_terms': ['diabetes', 'diabetic', 'blood sugar', 'high sugar']
    },
    'hypertension': {
        'shona': ['hypertension', 'bp yepamusoro', 'blood pressure yepamusoro'],
        'ndebele': ['hypertension', 'bp ephezulu'],
        'local_terms': ['high bp', 'high blood pressure', 'bp high']
    },
    'pneumonia': {
        'shona': ['pneumonia', 'chirwere chepfupa', 'pfupa'],
        'ndebele': ['pneumonia', 'isifo samathambo'],
        'local_terms': ['pneumonia', 'chest infection', 'lung infection']
    }
}

# Shona symptom translations
SHONA_SYMPTOMS = {
    'fever': ['fivha', 'kupisa', 'kupisa kwemuviri', 'temperature'],
    'cough': ['chikosoro', 'kukosora', 'cough'],
    'headache': ['musoro', 'kurwadza musoro', 'headache'],
    'chest_pain': ['kurwadza pachipfuva', 'chipfuva', 'chest pain'],
    'shortness_of_breath': ['kufemuka', 'kushaya mweya', 'breathless'],
    'abdominal_pain': ['kurwadza mudumbu', 'dumbu', 'stomach pain'],
    'nausea': ['kusvotwa', 'kuda kurutsa', 'nausea'],
    'vomiting': ['kurutsa', 'vomiting'],
    'diarrhea': ['manyoka', 'kuita manyoka', 'diarrhea'],
    'fatigue': ['kuneta', 'kushaya simba', 'tired'],
    'dizziness': ['kudzungaira', 'dizziness'],
    'joint_pain': ['kurwadza mabvi', 'joint pain']
}

# Ndebele symptom translations
NDEBELE_SYMPTOMS = {
    'fever': ['umkhuhlane', 'ubushushu', 'fever'],
    'cough': ['ukukhwehlela', 'cough'],
    'headache': ['ubuhlungu bekhanda', 'headache'],
    'chest_pain': ['ubuhlungu esifubeni', 'chest pain'],
    'shortness_of_breath': ['ukuphefumula', 'breathless'],
    'abdominal_pain': ['ubuhlungu esiswini', 'stomach pain'],
    'nausea': ['ukugula', 'nausea'],
    'vomiting': ['ukuhlanza', 'vomiting'],
    'diarrhea': ['ukuchama', 'diarrhea'],
    'fatigue': ['ukukhathala', 'tired'],
    'dizziness': ['ukudangala', 'dizziness'],
    'joint_pain': ['ubuhlungu emalungwini', 'joint pain']
}

# Zimbabwe-specific disease patterns (common in Zimbabwe)
ZIMBABWE_DISEASE_PATTERNS = {
    'HIV/AIDS': {
        'common_symptoms': ['fever', 'fatigue', 'weight_loss', 'cough', 'diarrhea'],
        'prevalence': 'high',  # High prevalence in Zimbabwe
        'base_probability_multiplier': 1.2  # Increase probability for common conditions
    },
    'Tuberculosis': {
        'common_symptoms': ['cough', 'fever', 'weight_loss', 'night_sweats', 'chest_pain'],
        'prevalence': 'high',
        'base_probability_multiplier': 1.15
    },
    'Malaria': {
        'common_symptoms': ['fever', 'chills', 'headache', 'body_aches', 'fatigue'],
        'prevalence': 'high',
        'base_probability_multiplier': 1.2
    },
    'Diabetes': {
        'common_symptoms': ['frequent_urination', 'thirst', 'fatigue', 'blurred_vision'],
        'prevalence': 'moderate',
        'base_probability_multiplier': 1.0
    },
    'Hypertension': {
        'common_symptoms': ['headache', 'dizziness', 'chest_pain'],
        'prevalence': 'moderate',
        'base_probability_multiplier': 1.0
    }
}

def translate_symptom_to_english(text: str, language: str = 'auto') -> str:
    """
    Translate Shona/Ndebele symptom to English
    
    Args:
        text: Symptom text in Shona, Ndebele, or English
        language: 'shona', 'ndebele', or 'auto' (detect)
    
    Returns:
        English symptom key or original text if not found
    """
    text_lower = text.lower().strip()
    
    # Auto-detect language or use specified
    if language == 'auto':
        # Check Shona first
        for eng_symptom, shona_terms in SHONA_SYMPTOMS.items():
            if any(term in text_lower for term in shona_terms):
                return eng_symptom
        
        # Check Ndebele
        for eng_symptom, ndebele_terms in NDEBELE_SYMPTOMS.items():
            if any(term in text_lower for term in ndebele_terms):
                return eng_symptom
    elif language == 'shona':
        for eng_symptom, shona_terms in SHONA_SYMPTOMS.items():
            if any(term in text_lower for term in shona_terms):
                return eng_symptom
    elif language == 'ndebele':
        for eng_symptom, ndebele_terms in NDEBELE_SYMPTOMS.items():
            if any(term in text_lower for term in ndebele_terms):
                return eng_symptom
    
    # Return original if no translation found
    return text

def get_zimbabwe_disease_multiplier(diagnosis: str) -> float:
    """
    Get probability multiplier for Zimbabwe-specific disease prevalence
    
    Args:
        diagnosis: Diagnosis name
    
    Returns:
        Multiplier (1.0 = no change, >1.0 = increase probability)
    """
    diagnosis_lower = diagnosis.lower()
    
    for disease, pattern in ZIMBABWE_DISEASE_PATTERNS.items():
        if disease.lower() in diagnosis_lower or diagnosis_lower in disease.lower():
            return pattern.get('base_probability_multiplier', 1.0)
    
    return 1.0

def extract_zimbabwe_conditions(text: str) -> list:
    """
    Extract Zimbabwe-specific conditions from text (supports Shona, Ndebele, English)
    
    Args:
        text: Clinical text
    
    Returns:
        List of detected condition names
    """
    text_lower = text.lower()
    detected_conditions = []
    
    for condition, translations in ZIMBABWE_TERMINOLOGY.items():
        # Check English
        if condition in text_lower:
            detected_conditions.append(condition)
            continue
        
        # Check Shona
        if any(term in text_lower for term in translations.get('shona', [])):
            detected_conditions.append(condition)
            continue
        
        # Check Ndebele
        if any(term in text_lower for term in translations.get('ndebele', [])):
            detected_conditions.append(condition)
            continue
        
        # Check local terms
        if any(term in text_lower for term in translations.get('local_terms', [])):
            detected_conditions.append(condition)
    
    return detected_conditions


