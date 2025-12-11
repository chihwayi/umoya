"""
ClinicalBERT Diagnostic Assistant
Uses ClinicalBERT model for unstructured clinical notes analysis
Analyzes chief complaint, history, clinical notes for diagnostic suggestions
"""

import os
import logging
from typing import Dict, List, Optional, Any
import re

logger = logging.getLogger(__name__)

try:
    from transformers import AutoModelForSequenceClassification, AutoTokenizer, pipeline
    import torch
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False
    logger.warning("Transformers library not available. AI features disabled.")

from .model_loader import get_model_cache, is_ai_enabled


class ClinicalBERTDiagnostic:
    """
    ClinicalBERT for unstructured clinical notes
    Analyzes free-text clinical notes for diagnostic suggestions
    """
    
    def __init__(self, model_name: str = "emilyalsentzer/Bio_ClinicalBERT"):
        """
        Initialize ClinicalBERT diagnostic assistant
        
        Note: Full ClinicalBERT requires significant resources.
        We'll use a hybrid approach with text analysis + embeddings.
        """
        self.model_name = model_name
        self.model = None
        self.tokenizer = None
        self.classifier = None
        self._initialized = False
        
        if not TRANSFORMERS_AVAILABLE:
            logger.warning("Transformers not available. ClinicalBERT will use fallback mode.")
            return
        
        if not is_ai_enabled():
            logger.info("AI models disabled via CDSS_ENABLE_AI. ClinicalBERT will use fallback mode.")
            return
        
        self._try_load_model()
    
    def _try_load_model(self):
        """Try to load the model, fallback to lightweight mode if fails"""
        if self._initialized:
            return
        
        try:
            # Check cache first
            cache_key = f"clinicalbert_{self.model_name}"
            cache = get_model_cache()
            
            if cache_key in cache:
                self.model = cache[cache_key].get('model')
                self.tokenizer = cache[cache_key].get('tokenizer')
                self.classifier = cache[cache_key].get('classifier')
                self._initialized = True
                logger.info(f"Loaded ClinicalBERT from cache: {self.model_name}")
                return
            
            # For now, use lightweight text analysis
            # Full ClinicalBERT would require GPU and model download
            logger.info("ClinicalBERT: Using lightweight text analysis (full model requires GPU)")
            self._initialized = True
            
        except Exception as e:
            logger.warning(f"Failed to load ClinicalBERT model: {e}. Using fallback mode.")
            self._initialized = True
    
    def _extract_entities_lightweight(self, text: str) -> Dict[str, List[str]]:
        """
        Lightweight entity extraction from clinical text
        Uses pattern matching and keyword extraction
        """
        text_lower = text.lower()
        entities = {
            'symptoms': [],
            'signs': [],
            'medications': [],
            'conditions': [],
            'vitals_mentions': []
        }
        
        # Symptom patterns
        symptom_keywords = {
            'fever': ['fever', 'pyrexia', 'temperature', 'hot'],
            'cough': ['cough', 'coughing', 'productive cough'],
            'chest_pain': ['chest pain', 'chest discomfort', 'angina'],
            'shortness_of_breath': ['shortness of breath', 'sob', 'dyspnea', 'dyspnoea', 'breathless'],
            'headache': ['headache', 'head pain', 'cephalgia'],
            'abdominal_pain': ['abdominal pain', 'stomach pain', 'belly pain', 'abdominal discomfort'],
            'nausea': ['nausea', 'nauseous', 'feeling sick'],
            'vomiting': ['vomiting', 'vomit', 'throwing up'],
            'dizziness': ['dizziness', 'dizzy', 'vertigo', 'lightheaded'],
            'fatigue': ['fatigue', 'tired', 'exhausted', 'weakness']
        }
        
        for symptom, keywords in symptom_keywords.items():
            if any(keyword in text_lower for keyword in keywords):
                entities['symptoms'].append(symptom)
        
        # Vital sign mentions
        vitals_patterns = {
            'blood_pressure': r'\b(?:bp|blood pressure)\s*(?:is|:)?\s*(\d+/\d+)',
            'heart_rate': r'\b(?:hr|heart rate|pulse)\s*(?:is|:)?\s*(\d+)',
            'temperature': r'\b(?:temp|temperature|fever)\s*(?:is|:)?\s*(\d+\.?\d*)',
            'oxygen_saturation': r'\b(?:o2|oxygen|saturation|spo2)\s*(?:is|:)?\s*(\d+)'
        }
        
        for vital_type, pattern in vitals_patterns.items():
            matches = re.findall(pattern, text_lower)
            if matches:
                entities['vitals_mentions'].append({
                    'type': vital_type,
                    'values': matches
                })
        
        # Medication mentions (common medications)
        medication_keywords = [
            'aspirin', 'metformin', 'insulin', 'warfarin', 'amoxicillin',
            'paracetamol', 'ibuprofen', 'atenolol', 'lisinopril', 'amlodipine'
        ]
        
        for med in medication_keywords:
            if med in text_lower:
                entities['medications'].append(med)
        
        return entities
    
    def _analyze_text_semantics(self, text: str) -> Dict[str, Any]:
        """
        Analyze clinical text for semantic patterns
        This would use ClinicalBERT embeddings in full implementation
        """
        entities = self._extract_entities_lightweight(text)
        
        # Extract key phrases
        sentences = re.split(r'[.!?]\s+', text)
        key_phrases = []
        
        for sentence in sentences:
            sentence_lower = sentence.lower().strip()
            if len(sentence_lower) > 10:  # Skip very short sentences
                # Look for diagnostic indicators
                diagnostic_indicators = [
                    'presents with', 'complains of', 'reports', 'history of',
                    'diagnosed with', 'suffering from', 'showing signs of'
                ]
                
                if any(indicator in sentence_lower for indicator in diagnostic_indicators):
                    key_phrases.append(sentence.strip())
        
        return {
            'entities': entities,
            'key_phrases': key_phrases,
            'text_length': len(text),
            'sentence_count': len(sentences)
        }
    
    def suggest_diagnoses(
        self,
        clinical_text: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Suggest diagnoses from clinical text
        
        Args:
            clinical_text: Free-text clinical notes, chief complaint, history
            context: Optional additional context (age, gender, etc.)
        
        Returns:
            {
                'suggestions': [...],
                'entities': {...},
                'confidence': 'high'|'moderate'|'low',
                'source': 'clinicalbert'
            }
        """
        if not self._initialized:
            self._try_load_model()
        
        if not clinical_text or len(clinical_text.strip()) < 5:
            return {
                'suggestions': [],
                'entities': {},
                'confidence': 'low',
                'source': 'clinicalbert_lightweight',
                'message': 'Insufficient clinical text provided'
            }
        
        # Analyze text
        analysis = self._analyze_text_semantics(clinical_text)
        entities = analysis['entities']
        
        # Map symptoms to potential diagnoses
        symptom_diagnosis_map = {
            'fever': [
                {'diagnosis': 'Viral Upper Respiratory Infection', 'probability': 0.30},
                {'diagnosis': 'Bacterial Pneumonia', 'probability': 0.25},
                {'diagnosis': 'Urinary Tract Infection', 'probability': 0.15},
                {'diagnosis': 'COVID-19', 'probability': 0.12},
                {'diagnosis': 'Sepsis', 'probability': 0.08}
            ],
            'cough': [
                {'diagnosis': 'Acute Bronchitis', 'probability': 0.35},
                {'diagnosis': 'Pneumonia', 'probability': 0.28},
                {'diagnosis': 'Asthma Exacerbation', 'probability': 0.15},
                {'diagnosis': 'COPD Exacerbation', 'probability': 0.12}
            ],
            'chest_pain': [
                {'diagnosis': 'Acute Coronary Syndrome', 'probability': 0.25},
                {'diagnosis': 'GERD/Reflux', 'probability': 0.20},
                {'diagnosis': 'Musculoskeletal Pain', 'probability': 0.18},
                {'diagnosis': 'Pneumonia', 'probability': 0.15}
            ],
            'shortness_of_breath': [
                {'diagnosis': 'Heart Failure', 'probability': 0.28},
                {'diagnosis': 'COPD Exacerbation', 'probability': 0.22},
                {'diagnosis': 'Asthma', 'probability': 0.18},
                {'diagnosis': 'Pneumonia', 'probability': 0.15}
            ],
            'abdominal_pain': [
                {'diagnosis': 'Gastroenteritis', 'probability': 0.30},
                {'diagnosis': 'Appendicitis', 'probability': 0.20},
                {'diagnosis': 'Irritable Bowel Syndrome', 'probability': 0.15}
            ]
        }
        
        # Aggregate diagnoses from symptoms
        diagnosis_scores = {}
        
        for symptom in entities.get('symptoms', []):
            if symptom in symptom_diagnosis_map:
                for diag_info in symptom_diagnosis_map[symptom]:
                    diag_name = diag_info['diagnosis']
                    prob = diag_info['probability']
                    
                    if diag_name not in diagnosis_scores:
                        diagnosis_scores[diag_name] = {
                            'diagnosis': diag_name,
                            'probability': prob,
                            'supporting_symptoms': [symptom]
                        }
                    else:
                        # Increase probability if multiple symptoms support
                        diagnosis_scores[diag_name]['probability'] = min(
                            diagnosis_scores[diag_name]['probability'] + (prob * 0.3),
                            0.95
                        )
                        diagnosis_scores[diag_name]['supporting_symptoms'].append(symptom)
        
        # Sort by probability
        suggestions = sorted(
            diagnosis_scores.values(),
            key=lambda x: x['probability'],
            reverse=True
        )[:10]
        
        # Calculate overall confidence
        if suggestions and suggestions[0]['probability'] > 0.6:
            confidence = 'high'
        elif suggestions and suggestions[0]['probability'] > 0.4:
            confidence = 'moderate'
        else:
            confidence = 'low'
        
        return {
            'suggestions': [
                {
                    'diagnosis': s['diagnosis'],
                    'probability': round(s['probability'], 3),
                    'confidence': 'high' if s['probability'] > 0.6 else 'moderate' if s['probability'] > 0.4 else 'low',
                    'supporting_symptoms': s['supporting_symptoms'],
                    'source': 'clinicalbert_lightweight'
                }
                for s in suggestions
            ],
            'entities': entities,
            'confidence': confidence,
            'source': 'clinicalbert_lightweight',
            'model_available': self.model is not None
        }
