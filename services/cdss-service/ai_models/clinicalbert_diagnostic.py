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
from .llm_provider import LLMProvider

# Import terminology mappers
try:
    from terminology.icd10_mapper import Icd10Mapper
    from terminology.snomed_mapper import SnomedMapper
    TERMINOLOGY_AVAILABLE = True
except ImportError:
    TERMINOLOGY_AVAILABLE = False

# Import Zimbabwe-specific terminology
try:
    from .zimbabwe_terminology import (
        translate_symptom_to_english,
        extract_zimbabwe_conditions,
        get_zimbabwe_disease_multiplier,
        SHONA_SYMPTOMS,
        NDEBELE_SYMPTOMS
    )
    ZIMBABWE_TERMINOLOGY_AVAILABLE = True
except ImportError:
    ZIMBABWE_TERMINOLOGY_AVAILABLE = False
    logger.warning("Zimbabwe terminology not available")


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
        self._full_model_attempted = False
        self._ai_enabled = is_ai_enabled()
        self.llm_provider = None
        self.icd10_mapper = None
        self.snomed_mapper = None
        
        # Always initialize (lightweight mode works without transformers)
        if not TRANSFORMERS_AVAILABLE:
            logger.info("Transformers not available. ClinicalBERT will use lightweight fallback mode.")
        
        # Lightweight mode is always available once the class is constructed.
        self._initialized = True

        if not self._ai_enabled:
            logger.info("AI models disabled via CDSS_ENABLE_AI. ClinicalBERT will use fallback mode.")
            return
        
        # Initialize terminology mappers
        if TERMINOLOGY_AVAILABLE:
            try:
                self.icd10_mapper = Icd10Mapper()
                self.snomed_mapper = SnomedMapper()
            except Exception as e:
                logger.warning(f"Failed to initialize terminology mappers: {e}")
        
        try:
            self.llm_provider = LLMProvider()
        except Exception:
            self.llm_provider = None
        
        # Try to load full model if transformers available
        if TRANSFORMERS_AVAILABLE:
            self._try_load_model()
    
    def _try_load_model(self):
        """Try to load the model, fallback to lightweight mode if fails"""
        if self._full_model_attempted:
            return
        self._full_model_attempted = True
        if not self._ai_enabled or not TRANSFORMERS_AVAILABLE:
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
            
            allow_model_download = os.getenv("CDSS_ALLOW_MODEL_DOWNLOAD", "false").strip().lower() == "true"
            if allow_model_download:
                self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
                self.model = AutoModelForSequenceClassification.from_pretrained(self.model_name)
                self.classifier = pipeline(
                    "text-classification",
                    model=self.model,
                    tokenizer=self.tokenizer,
                    truncation=True,
                )
                cache[cache_key] = {
                    "model": self.model,
                    "tokenizer": self.tokenizer,
                    "classifier": self.classifier,
                }
                logger.info(f"Loaded ClinicalBERT model via transformers: {self.model_name}")
                return

            logger.info(
                "ClinicalBERT: Full model download disabled (CDSS_ALLOW_MODEL_DOWNLOAD=false). "
                "Using lightweight text analysis."
            )
            
        except Exception as e:
            logger.warning(f"Failed to load ClinicalBERT model: {e}. Using fallback mode.")
    
    def _extract_entities_lightweight(self, text: str) -> Dict[str, Any]:
        """
        Enhanced entity extraction from clinical text using Spacy Lemmatization
        and SNOMED CT / ICD-10 mapping.
        """
        # Initialize Spacy if not already loaded (lazy load)
        if not hasattr(self, 'nlp') or self.nlp is None:
            import spacy
            try:
                # Try scispaCy first (better for medical terms)
                self.nlp = spacy.load("en_core_sci_sm")
                logger.info("ClinicalBERT: Loaded scispaCy (en_core_sci_sm) for entity extraction")
            except Exception:
                try:
                    # Fallback to standard model
                    self.nlp = spacy.load("en_core_web_sm") 
                    logger.info("ClinicalBERT: Loaded standard Spacy (en_core_web_sm)")
                except Exception as e:
                    logger.warning(f"ClinicalBERT: Failed to load Spacy: {e}. Using basic keyword matching.")
                    self.nlp = None

        text_lower = text.lower()
        entities = {
            'symptoms': [],
            'symptom_details': [], # New field with codes
            'signs': [],
            'medications': [],
            'conditions': [],
            'vitals_mentions': []
        }

        # 1. Advanced Lemmatization & Mapping Strategy
        if self.nlp:
            doc = self.nlp(text_lower)
            canonical_symptoms = {
                'fever','cough','shortness_of_breath','chest_pain','abdominal_pain',
                'nausea','vomiting','headache','dizziness','fatigue',
                'throat_issues','nasal_symptoms','skin_issues','cardiovascular','neurological','psychiatric_cognitive'
            }
            lemma_normalization = {
                'febrile':'fever','pyrexia':'fever','chill':'fever','sweat':'fever',
                'vomit':'vomiting','emesis':'vomiting','nauseous':'nausea','queasy':'nausea',
                'breathless':'shortness_of_breath','dyspnea':'shortness_of_breath','dyspnoea':'shortness_of_breath','wheeze':'shortness_of_breath',
                'angina':'chest_pain','tightness':'chest_pain',
                'abdomen':'abdominal_pain','belly':'abdominal_pain','tummy':'abdominal_pain','stomach':'abdominal_pain',
                'dizzy':'dizziness'
            }

            # Process tokens
            found_symptoms = set()

            def _add_symptom_with_codes(symptom_key: str) -> None:
                if symptom_key in found_symptoms:
                    return
                found_symptoms.add(symptom_key)
                entities['symptoms'].append(symptom_key)
                detail = {'name': symptom_key}
                if self.icd10_mapper:
                    icd = self.icd10_mapper.get_icd10_for_symptom(symptom_key)
                    if icd:
                        detail['icd10'] = icd
                if self.snomed_mapper:
                    snomed = self.snomed_mapper.get_snomed_for_symptom(symptom_key)
                    if snomed:
                        detail['snomed'] = snomed
                entities['symptom_details'].append(detail)
            
            # 1. Direct Lemma Matching
            for token in doc:
                lemma = token.lemma_
                if lemma in canonical_symptoms:
                    std_key = lemma
                elif lemma in lemma_normalization:
                    std_key = lemma_normalization[lemma]
                else:
                    continue
                _add_symptom_with_codes(std_key)
            
            # 2. Phrase Matching (Basic Noun Chunks) - "chest pain", "shortness of breath"
            for chunk in doc.noun_chunks:
                chunk_text = chunk.text.lower()
                # Check for composite terms
                if "chest" in chunk_text and "pain" in chunk_text:
                    _add_symptom_with_codes('chest_pain')
                elif "short" in chunk_text and "breath" in chunk_text:
                    _add_symptom_with_codes('shortness_of_breath')

        else:
            # FALLBACK: Use original keyword matching if Spacy fails
            symptom_keywords = {
                'fever': ['fever', 'pyrexia', 'temperature', 'hot', 'chills', 'rigors', 'febrile'],
                'cough': ['cough', 'coughing', 'productive cough', 'dry cough', 'hemoptysis', 'hacking'],
                'chest_pain': ['chest pain', 'chest discomfort', 'angina', 'pleuritic pain', 'tightness in chest'],
                'shortness_of_breath': ['shortness of breath', 'sob', 'dyspnea', 'dyspnoea', 'breathless', 'air hunger'],
                'headache': ['headache', 'head pain', 'cephalgia', 'migraine', 'throbbing head'],
                'abdominal_pain': ['abdominal pain', 'stomach pain', 'belly pain', 'cramping', 'epigastric pain'],
                'nausea': ['nausea', 'nauseous', 'feeling sick'],
                'vomiting': ['vomiting', 'vomit', 'throwing up'],
                'dizziness': ['dizziness', 'dizzy', 'vertigo', 'lightheaded'],
                'fatigue': ['fatigue', 'tired', 'exhausted', 'weakness'],
                'throat_issues': ['sore throat', 'pharyngitis', 'odynophagia', 'difficulty swallowing', 'dysphagia'],
                'nasal_symptoms': ['congestion', 'rhinorrhea', 'runny nose', 'sneezing', 'post-nasal drip'],
                'musculoskeletal': ['myalgia', 'arthralgia', 'joint pain', 'back pain', 'stiffness', 'body aches'],
                'neurological': ['numbness', 'tingling', 'paresthesia', 'seizure', 'tremor', 'fainting', 'syncope'],
                'psychiatric_cognitive': ['anxiety', 'depression', 'insomnia', 'confusion', 'hallucinations', 'irritability'],
                'skin_issues': ['rash', 'pruritus', 'itching', 'jaundice', 'cyanosis', 'hives', 'lesion'],
                'urinary_issues': ['dysuria', 'frequent urination', 'hematuria', 'incontinence', 'burning urination'],
                'cardiovascular': ['palpitations', 'tachycardia', 'bradycardia', 'irregular heartbeat', 'edema', 'swelling']
            }
            
            for symptom, keywords in symptom_keywords.items():
                if any(keyword in text_lower for keyword in keywords):
                    entities['symptoms'].append(symptom)
        
        # Vital sign mentions (Regex is robust enough for now)
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
        Enhanced with Zimbabwe-specific terminology support
        """
        # Pre-process text: translate Shona/Ndebele symptoms to English
        if ZIMBABWE_TERMINOLOGY_AVAILABLE:
            # Extract Zimbabwe-specific conditions
            zimbabwe_conditions = extract_zimbabwe_conditions(text)
            if zimbabwe_conditions:
                logger.debug(f"Detected Zimbabwe-specific conditions: {zimbabwe_conditions}")
        
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
        context: Optional[Dict[str, Any]] = None,
        tenant_id: Optional[str] = None,
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
        if TRANSFORMERS_AVAILABLE and self._ai_enabled and not self._full_model_attempted:
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
        
        
        diagnosis_scores = {}
        
        llm_results = None
        if getattr(self, 'llm_provider', None):
            try:
                import asyncio
                schema = '{"diagnoses":[{"name":"string","probability":"number between 0 and 1"}]}'
                symptoms_list = entities.get('symptoms', [])
                vitals_list = entities.get('vitals_mentions', [])
                prompt = (
                    "Given these symptoms and vitals from clinical notes, list top 8 differential diagnoses "
                    "with probabilities between 0 and 1.\n"
                    f"Symptoms: {', '.join(symptoms_list)}\n"
                    f"Vitals: {vitals_list}\n"
                    "Return JSON only."
                )
                llm_results = asyncio.run(
                    self.llm_provider.generate_json(
                        prompt,
                        schema,
                        use_case="intelligent_diagnosis",
                        tenant_id=tenant_id,
                    )
                )
            except Exception as e:
                logger.debug(f"LLM generation failed: {e}")
                llm_results = None
        
        if llm_results and isinstance(llm_results, dict) and 'diagnoses' in llm_results:
            for item in llm_results['diagnoses']:
                name = item.get('name')
                prob = float(item.get('probability', 0))
                if not name:
                    continue
                if ZIMBABWE_TERMINOLOGY_AVAILABLE:
                    try:
                        mult = get_zimbabwe_disease_multiplier(name)
                        prob = prob * mult
                    except Exception:
                        pass
                if name not in diagnosis_scores:
                    diagnosis_scores[name] = {'diagnosis': name, 'probability': prob, 'supporting_symptoms': symptoms_list or []}
                else:
                    diagnosis_scores[name]['probability'] = max(diagnosis_scores[name]['probability'], prob)
        else:
            fallback_map = {
                'fever': ['Malaria','Viral Upper Respiratory Infection','Bacterial Pneumonia','Tuberculosis','Urinary Tract Infection','COVID-19'],
                'cough': ['Tuberculosis','Acute Bronchitis','Pneumonia','Asthma Exacerbation','COPD Exacerbation'],
                'chest_pain': ['Acute Coronary Syndrome','GERD/Reflux','Musculoskeletal Pain','Pneumonia'],
                'shortness_of_breath': ['Heart Failure','COPD Exacerbation','Asthma','Pneumonia'],
                'abdominal_pain': ['Gastroenteritis','Appendicitis','Irritable Bowel Syndrome','Peptic Ulcer Disease'],
                'nausea': ['Gastroenteritis','Food Poisoning','Migraine','Pregnancy'],
                'vomiting': ['Gastroenteritis','Food Poisoning','Intestinal Obstruction'],
                'headache': ['Tension Headache','Migraine','Sinusitis','Hypertension'],
                'dizziness': ['Benign Paroxysmal Positional Vertigo','Dehydration','Anemia','Hypoglycemia'],
                'fatigue': ['Anemia','Hypothyroidism','Depression','Viral Infection']
            }
            base_probs = {
                0: 0.35, 1: 0.25, 2: 0.18, 3: 0.12, 4: 0.08, 5: 0.05
            }
            for symptom in entities.get('symptoms', []):
                if symptom in fallback_map:
                    for idx, diag in enumerate(fallback_map[symptom]):
                        prob = base_probs.get(idx, 0.05)
                        if ZIMBABWE_TERMINOLOGY_AVAILABLE:
                            try:
                                prob = prob * get_zimbabwe_disease_multiplier(diag)
                            except Exception:
                                pass
                        if diag not in diagnosis_scores:
                            diagnosis_scores[diag] = {'diagnosis': diag, 'probability': prob, 'supporting_symptoms': [symptom]}
                        else:
                            diagnosis_scores[diag]['probability'] = min(diagnosis_scores[diag]['probability'] + (prob * 0.3), 0.95)
                            diagnosis_scores[diag]['supporting_symptoms'].append(symptom)
        
        if ZIMBABWE_TERMINOLOGY_AVAILABLE:
            zimbabwe_conditions = extract_zimbabwe_conditions(clinical_text)
            for condition in zimbabwe_conditions:
                condition_map = {
                    'hiv': 'HIV/AIDS',
                    'tuberculosis': 'Tuberculosis',
                    'malaria': 'Malaria',
                    'diabetes': 'Diabetes',
                    'hypertension': 'Hypertension',
                    'pneumonia': 'Pneumonia'
                }
                diag_name = condition_map.get(condition, condition.title())
                if diag_name not in diagnosis_scores:
                    diagnosis_scores[diag_name] = {
                        'diagnosis': diag_name,
                        'probability': 0.25,
                        'supporting_symptoms': ['zimbabwe_condition_detected']
                    }
        
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
        
        # Enrich suggestions with ICD-10 and SNOMED CT codes
        enriched_suggestions = []
        for s in suggestions:
            sugg_dict = {
                'diagnosis': s['diagnosis'],
                'probability': round(s['probability'], 3),
                'confidence': 'high' if s['probability'] > 0.6 else 'moderate' if s['probability'] > 0.4 else 'low',
                'supporting_symptoms': s['supporting_symptoms'],
                'source': 'clinicalbert_lightweight'
            }
            
            # Add ICD-10 and SNOMED CT codes
            if self.icd10_mapper:
                icd10_code = self.icd10_mapper.get_icd10_code(s['diagnosis'])
                if icd10_code:
                    sugg_dict['icd10'] = icd10_code
            
            if self.snomed_mapper:
                snomed_code = self.snomed_mapper.get_snomed_code(s['diagnosis'])
                if snomed_code:
                    sugg_dict['snomed'] = snomed_code
            
            enriched_suggestions.append(sugg_dict)
        
        return {
            'suggestions': enriched_suggestions,
            'entities': entities,
            'confidence': confidence,
            'source': 'clinicalbert_lightweight',
            'model_available': self.model is not None
        }
