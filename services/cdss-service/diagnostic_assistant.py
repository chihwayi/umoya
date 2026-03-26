"""
Diagnostic Assistant
Provides differential diagnosis suggestions based on symptoms, vitals, and patient demographics
Uses pattern matching and clinical decision rules
Enhanced with AI models (MedBERT, ClinicalBERT) for intelligent diagnostics
Includes SNOMED CT and ICD-10 code mapping
"""
from typing import Dict, List, Optional, Any, Tuple
from collections import Counter
import re
import logging
import hashlib
import json
from privacy_guard import redact_text, redact_value
from ai_governance import apply_safety_gate, compute_request_hash

logger = logging.getLogger(__name__)

# Try to import AI models (optional)
try:
    from ai_models.medbert_predictor import MedBERTPredictor
    from ai_models.clinicalbert_diagnostic import ClinicalBERTDiagnostic
    from ai_models.fusion_engine import IntelligentFusionEngine
    from ai_models.llm_provider import LLMProvider
    from ai_models.rag_engine import RAGEngine
    from clinical_knowledge_registry import ClinicalKnowledgeRegistry
    AI_AVAILABLE = True
except ImportError:
    AI_AVAILABLE = False
    logger.info("AI models not available. Using rule-based only.")
    # Fallback if imports fail, though LLMProvider only needs httpx
    try:
        from ai_models.llm_provider import LLMProvider
    except ImportError:
        LLMProvider = None
    try:
        from clinical_knowledge_registry import ClinicalKnowledgeRegistry
    except ImportError:
        ClinicalKnowledgeRegistry = None

# Import terminology mappers
try:
    from terminology.icd10_mapper import Icd10Mapper
    from terminology.snomed_mapper import SnomedMapper
    TERMINOLOGY_AVAILABLE = True
except ImportError:
    TERMINOLOGY_AVAILABLE = False
    logger.warning("Terminology mappers not available. Codes will not be included.")


class DiagnosticAssistant:
    """Symptom-based diagnostic suggestion engine with AI enhancement"""
    
    def __init__(self):
        """Initialize diagnostic assistant with optional AI models and terminology"""
        self.medbert = None
        self.clinicalbert = None
        self.fusion_engine = None
        self.llm_provider = None
        self.rag_engine = None
        self.knowledge_registry = None
        self.icd10_mapper = None
        self.snomed_mapper = None
        
        # Always try to initialize AI models (lightweight mode works without transformers)
        try:
            self.medbert = MedBERTPredictor()
            self.clinicalbert = ClinicalBERTDiagnostic()
            self.fusion_engine = IntelligentFusionEngine()
            # Initialize LLMProvider and check availability
            if LLMProvider:
                self.llm_provider = LLMProvider()
                # We don't await here because __init__ is sync, but check_availability will be called later
            
            self.rag_engine = RAGEngine() if RAGEngine else None
            self.knowledge_registry = ClinicalKnowledgeRegistry() if ClinicalKnowledgeRegistry else None
            logger.info("AI models initialized for intelligent diagnostics (lightweight mode + LLM + RAG)")
        except Exception as e:
            logger.warning(f"Failed to initialize AI models: {e}. Using rule-based only.")
            self.medbert = None
            self.clinicalbert = None
            self.fusion_engine = None
            self.llm_provider = None
        
        if TERMINOLOGY_AVAILABLE:
            try:
                self.icd10_mapper = Icd10Mapper()
                self.snomed_mapper = SnomedMapper()
                logger.info("Terminology mappers initialized for code mapping")
            except Exception as e:
                logger.warning(f"Failed to initialize terminology mappers: {e}")
                self.icd10_mapper = None
                self.snomed_mapper = None

    def _runtime_model_versions(self) -> Dict[str, Dict[str, Any]]:
        return {
            "rule_engine": {"name": "rule_engine", "version": "2026.02", "enabled": True},
            "medbert": {"name": "medbert", "version": "local", "enabled": self.medbert is not None},
            "clinicalbert": {"name": "clinicalbert", "version": "local", "enabled": self.clinicalbert is not None},
            "fusion_engine": {"name": "fusion_engine", "version": "local", "enabled": self.fusion_engine is not None},
            "rag": {"name": "rag", "version": "v1", "enabled": self.rag_engine is not None},
            "llm": {
                "name": self.llm_provider.model_name if self.llm_provider else "llm",
                "version": self.llm_provider.model_name if self.llm_provider else "unavailable",
                "enabled": self.llm_provider is not None,
            },
        }

    def _select_llm_model(self, tenant_id: Optional[str], model_registry: Dict[str, Any]) -> Dict[str, Any]:
        default_model = self.llm_provider.model_name if self.llm_provider else None
        primary = model_registry.get("llm_primary") if isinstance(model_registry, dict) else None
        canary = model_registry.get("llm_canary") if isinstance(model_registry, dict) else None

        selected = default_model
        route = "default"
        canary_percent = 0

        if isinstance(primary, dict):
            selected = (primary.get("config") or {}).get("model_name") or primary.get("version") or selected
            route = "primary"

        if isinstance(canary, dict) and str(canary.get("status") or "").lower() == "canary":
            cfg = canary.get("config") or {}
            canary_model = cfg.get("model_name") or canary.get("version")
            try:
                canary_percent = int(cfg.get("canary_percent", 0))
            except Exception:
                canary_percent = 0
            canary_percent = max(0, min(canary_percent, 100))
            if canary_model and canary_percent > 0:
                tenant_key = tenant_id or "public"
                bucket = int(hashlib.sha256(tenant_key.encode("utf-8")).hexdigest()[:8], 16) % 100
                if bucket < canary_percent:
                    selected = str(canary_model)
                    route = "canary"

        return {
            "model_name": selected,
            "route": route,
            "canary_percent": canary_percent,
        }

    def _build_model_trace(
        self,
        tenant_id: Optional[str],
        model_registry: Dict[str, Any],
        llm_route: Dict[str, Any],
        request_payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        trace_payload = {
            "tenant_id": tenant_id or "public",
            "llm_model": llm_route.get("model_name"),
            "route": llm_route.get("route"),
            "models": model_registry,
        }
        return {
            "request_sha256": compute_request_hash(request_payload),
            "model_registry_sha256": hashlib.sha256(
                json.dumps(trace_payload, sort_keys=True, default=str).encode("utf-8")
            ).hexdigest(),
            "llm_model": llm_route.get("model_name"),
            "llm_route": llm_route.get("route"),
            "canary_percent": llm_route.get("canary_percent", 0),
        }
    
    # Symptom-diagnosis mapping database (simplified clinical knowledge base)
    DIAGNOSTIC_DATABASE = {
        'fever': {
            'common_diagnoses': [
                {'diagnosis': 'Viral Upper Respiratory Infection', 'probability': 0.35},
                {'diagnosis': 'Bacterial Pneumonia', 'probability': 0.20},
                {'diagnosis': 'Urinary Tract Infection', 'probability': 0.15},
                {'diagnosis': 'COVID-19', 'probability': 0.10},
                {'diagnosis': 'Influenza', 'probability': 0.10},
                {'diagnosis': 'Sepsis', 'probability': 0.05}
            ],
            'key_symptoms': ['fever', 'fatigue', 'body aches'],
            'alarming_signs': ['high_fever', 'rigors', 'altered_mental_status']
        },
        'cough': {
            'common_diagnoses': [
                {'diagnosis': 'Acute Bronchitis', 'probability': 0.30},
                {'diagnosis': 'Pneumonia', 'probability': 0.25},
                {'diagnosis': 'Asthma Exacerbation', 'probability': 0.15},
                {'diagnosis': 'COPD Exacerbation', 'probability': 0.10},
                {'diagnosis': 'Post-nasal Drip', 'probability': 0.10},
                {'diagnosis': 'GERD', 'probability': 0.05}
            ],
            'key_symptoms': ['cough', 'sputum', 'shortness_of_breath'],
            'alarming_signs': ['hemoptysis', 'chest_pain', 'respiratory_distress']
        },
        'chest_pain': {
            'common_diagnoses': [
                {'diagnosis': 'Musculoskeletal Pain', 'probability': 0.25},
                {'diagnosis': 'GERD/Reflux', 'probability': 0.20},
                {'diagnosis': 'Anxiety/Panic Attack', 'probability': 0.15},
                {'diagnosis': 'Acute Coronary Syndrome', 'probability': 0.15},
                {'diagnosis': 'Pneumonia', 'probability': 0.10},
                {'diagnosis': 'Pulmonary Embolism', 'probability': 0.08},
                {'diagnosis': 'Pericarditis', 'probability': 0.05}
            ],
            'key_symptoms': ['chest_pain', 'dyspnea', 'diaphoresis'],
            'alarming_signs': ['crushing_pain', 'radiating_pain', 'syncope']
        },
        'shortness_of_breath': {
            'common_diagnoses': [
                {'diagnosis': 'Heart Failure', 'probability': 0.25},
                {'diagnosis': 'COPD Exacerbation', 'probability': 0.20},
                {'diagnosis': 'Asthma', 'probability': 0.18},
                {'diagnosis': 'Pneumonia', 'probability': 0.15},
                {'diagnosis': 'Anxiety', 'probability': 0.10},
                {'diagnosis': 'Pulmonary Embolism', 'probability': 0.08}
            ],
            'key_symptoms': ['dyspnea', 'orthopnea', 'cough'],
            'alarming_signs': ['sudden_onset', 'cyanosis', 'respiratory_distress']
        },
        'abdominal_pain': {
            'common_diagnoses': [
                {'diagnosis': 'Gastroenteritis', 'probability': 0.30},
                {'diagnosis': 'Irritable Bowel Syndrome', 'probability': 0.20},
                {'diagnosis': 'Appendicitis', 'probability': 0.15},
                {'diagnosis': 'Peptic Ulcer Disease', 'probability': 0.10},
                {'diagnosis': 'Gallstones/Cholecystitis', 'probability': 0.10},
                {'diagnosis': 'Constipation', 'probability': 0.08}
            ],
            'key_symptoms': ['abdominal_pain', 'nausea', 'vomiting'],
            'alarming_signs': ['rebound_tenderness', 'rigid_abdomen', 'fever']
        },
        'headache': {
            'common_diagnoses': [
                {'diagnosis': 'Tension Headache', 'probability': 0.40},
                {'diagnosis': 'Migraine', 'probability': 0.25},
                {'diagnosis': 'Sinusitis', 'probability': 0.15},
                {'diagnosis': 'Medication Overuse Headache', 'probability': 0.10},
                {'diagnosis': 'Hypertension', 'probability': 0.05},
                {'diagnosis': 'Meningitis', 'probability': 0.03}
            ],
            'key_symptoms': ['headache', 'photophobia', 'nausea'],
            'alarming_signs': ['sudden_severe', 'neck_stiffness', 'focal_neurologic']
        },
        'dizziness': {
            'common_diagnoses': [
                {'diagnosis': 'Benign Paroxysmal Positional Vertigo', 'probability': 0.30},
                {'diagnosis': 'Orthostatic Hypotension', 'probability': 0.25},
                {'diagnosis': 'Medication Side Effect', 'probability': 0.15},
                {'diagnosis': 'Anemia', 'probability': 0.12},
                {'diagnosis': 'Arrhythmia', 'probability': 0.10},
                {'diagnosis': 'Stroke/TIA', 'probability': 0.05}
            ],
            'key_symptoms': ['dizziness', 'vertigo', 'nausea'],
            'alarming_signs': ['focal_neurologic', 'syncope', 'chest_pain']
        },
        'musculoskeletal_pain': {
            'common_diagnoses': [
                {'diagnosis': 'Muscle Strain', 'probability': 0.35},
                {'diagnosis': 'Contusion', 'probability': 0.25},
                {'diagnosis': 'Fracture', 'probability': 0.15},
                {'diagnosis': 'Arthritis', 'probability': 0.15},
                {'diagnosis': 'Tendinitis', 'probability': 0.10}
            ],
            'key_symptoms': ['pain', 'swelling', 'limited_range_of_motion'],
            'alarming_signs': ['deformity', 'inability_to_bear_weight', 'severe_pain']
        },
        'fall_injury': {
            'common_diagnoses': [
                {'diagnosis': 'Contusion', 'probability': 0.30},
                {'diagnosis': 'Fracture', 'probability': 0.25},
                {'diagnosis': 'Head Injury', 'probability': 0.15},
                {'diagnosis': 'Sprain/Strain', 'probability': 0.20},
                {'diagnosis': 'Laceration', 'probability': 0.10}
            ],
            'key_symptoms': ['pain', 'bruising', 'swelling'],
            'alarming_signs': ['loss_of_consciousness', 'deformity', 'severe_bleeding']
        }
    }
    
    # Clinical decision rules
    CLINICAL_RULES = {
        'pneumonia': {
            'required_symptoms': ['cough', 'fever'],
            'supporting_vitals': ['tachypnea', 'hypoxia', 'elevated_wbc'],
            'red_flags': ['sepsis', 'respiratory_failure']
        },
        'myocardial_infarction': {
            'required_symptoms': ['chest_pain'],
            'supporting_vitals': ['tachycardia', 'hypotension', 'elevated_troponin'],
            'red_flags': ['st_elevation', 'hemodynamic_instability']
        },
        'stroke': {
            'required_symptoms': ['neurologic_deficit'],
            'supporting_vitals': ['hypertension', 'altered_mental_status'],
            'red_flags': ['focal_neurologic', 'altered_mental_status', 'sudden_onset']
        }
    }
    
    def normalize_symptom(self, symptom: str) -> str:
        """Normalize symptom text for matching"""
        symptom_lower = symptom.lower().strip()
        
        # Map common variations
        symptom_map = {
            'sob': 'shortness_of_breath',
            'dyspnea': 'shortness_of_breath',
            'dyspnoea': 'shortness_of_breath',
            'cp': 'chest_pain',
            'abdominal_pain': 'abdominal_pain',
            'stomach_pain': 'abdominal_pain',
            'headache': 'headache',
            'dizzy': 'dizziness',
            'vertigo': 'dizziness',
            'cough': 'cough',
            'fever': 'fever',
            'pyrexia': 'fever'
        }
        
        if symptom_lower in symptom_map:
            return symptom_map[symptom_lower]
        
        # Replace spaces with underscores
        return symptom_lower.replace(' ', '_')
    
    def analyze_vitals(self, vitals: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze vital signs for diagnostic clues"""
        clues = []
        red_flags = []
        
        # Blood pressure analysis
        if vitals.get('bloodPressure'):
            bp = str(vitals['bloodPressure']).split('/')
            if len(bp) >= 2:
                try:
                    systolic = int(bp[0])
                    diastolic = int(bp[1])
                    
                    if systolic >= 180 or diastolic >= 120:
                        red_flags.append('Hypertensive emergency')
                        clues.append('Severe hypertension')
                    elif systolic >= 140 or diastolic >= 90:
                        clues.append('Hypertension')
                    elif systolic < 90:
                        red_flags.append('Hypotension')
                        clues.append('Low blood pressure')
                except:
                    pass
        
        # Heart rate analysis
        heart_rate = vitals.get('heartRate') or vitals.get('pulse')
        if heart_rate:
            try:
                hr = int(heart_rate)
                if hr > 100:
                    clues.append('Tachycardia')
                elif hr < 60:
                    clues.append('Bradycardia')
            except:
                pass
        
        # Temperature analysis
        temperature = vitals.get('temperature') or vitals.get('temp')
        if temperature:
            try:
                temp = float(temperature)
                if temp >= 38.5:
                    red_flags.append('High fever - consider infection')
                    clues.append('High fever')
                elif temp >= 37.5:
                    clues.append('Fever')
                elif temp < 36.0:
                    red_flags.append('Hypothermia')
            except:
                pass
        
        # Oxygen saturation
        o2_sat = vitals.get('oxygenSaturation') or vitals.get('spo2') or vitals.get('o2Sat')
        if o2_sat:
            try:
                sat = float(o2_sat)
                if sat < 90:
                    red_flags.append('Severe hypoxia - urgent assessment needed')
                    clues.append('Hypoxia')
                elif sat < 95:
                    clues.append('Mild hypoxia')
            except:
                pass
        
        # Respiratory rate
        rr = vitals.get('respiratoryRate') or vitals.get('rr')
        if rr:
            try:
                respiratory_rate = int(rr)
                if respiratory_rate > 20:
                    red_flags.append('Tachypnea - consider respiratory disease')
                    clues.append('Tachypnea')
                elif respiratory_rate < 12:
                    red_flags.append('Bradypnea - consider CNS issue')
            except:
                pass
        
        return {
            'clues': clues,
            'red_flags': red_flags
        }
    
    def calculate_diagnosis_probability(
        self,
        diagnosis: str,
        symptoms: List[str],
        vitals_clues: List[str],
        age: Optional[int] = None,
        gender: Optional[str] = None
    ) -> float:
        """Calculate probability score for a diagnosis"""
        base_probability = 0.1  # Base probability
        
        # Age-based adjustments
        if age:
            if 'pneumonia' in diagnosis.lower() and age >= 65:
                base_probability += 0.15
            if 'heart_failure' in diagnosis.lower() and age >= 65:
                base_probability += 0.20
            if 'migraine' in diagnosis.lower() and 15 <= age <= 50:
                base_probability += 0.10
        
        # Symptom matching boosts
        normalized_symptoms = [self.normalize_symptom(s) for s in symptoms]
        if any('cough' in s or 'fever' in s for s in normalized_symptoms):
            if 'pneumonia' in diagnosis.lower() or 'respiratory' in diagnosis.lower():
                base_probability += 0.25
        
        if any('chest_pain' in s for s in normalized_symptoms):
            if 'cardiac' in diagnosis.lower() or 'coronary' in diagnosis.lower():
                base_probability += 0.20
        
        # Vitals clues
        if vitals_clues:
            if 'hypoxia' in str(vitals_clues).lower() and 'respiratory' in diagnosis.lower():
                base_probability += 0.15
            if 'tachycardia' in str(vitals_clues).lower() and 'cardiac' in diagnosis.lower():
                base_probability += 0.10
        
        # Cap at 0.95 (leave room for uncertainty)
        return min(base_probability, 0.95)
    
    def suggest_diagnosis(
        self,
        symptoms: List[str],
        vitals: Optional[Dict[str, Any]] = None,
        age: Optional[int] = None,
        gender: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate diagnostic suggestions based on symptoms and clinical data
        
        Returns:
            suggested_diagnoses: List of potential diagnoses with probabilities
            confidence_scores: Confidence level (high, moderate, low)
            recommended_tests: Suggested diagnostic tests
            red_flags: Clinical red flags requiring urgent attention
        """
        if not symptoms:
            return {
                'suggested_diagnoses': [],
                'confidence_scores': {},
                'recommended_tests': [],
                'red_flags': ['No symptoms provided - unable to suggest diagnoses']
            }
        
        # Normalize and extract symptoms from text
        normalized_symptoms = []
        for symptom in symptoms:
            if not symptom or len(str(symptom).strip()) == 0:
                continue
                
            symptom_str = str(symptom).lower().strip()
            # If symptom is a long text string, extract keywords
            if len(symptom_str) > 20:
                # Extract symptom keywords from text
                symptom_keywords = [
                    'fever', 'cough', 'headache', 'chest pain', 'shortness of breath',
                    'dyspnea', 'abdominal pain', 'nausea', 'vomiting', 'dizziness',
                    'vertigo', 'fatigue', 'body aches', 'sore throat', 'runny nose',
                    'congestion', 'diarrhea', 'constipation', 'back pain', 'joint pain',
                    'muscle pain', 'rash', 'itching', 'sweating', 'chills', 'rigors',
                    'photophobia', 'neck stiffness', 'confusion', 'seizure', 'syncope',
                    'palpitations', 'orthopnea', 'edema', 'jaundice', 'bleeding',
                    'hemoptysis', 'dysuria', 'frequency', 'urgency', 'hematuria',
                    'sensitivity to light', 'photophobia', 'nausea', 'sweating'
                ]
                for keyword in symptom_keywords:
                    if keyword in symptom_str:
                        normalized_symptoms.append(keyword)
            else:
                # Short symptom text, normalize directly
                normalized_symptoms.append(self.normalize_symptom(symptom_str))
        
        # Remove duplicates while preserving order
        normalized_symptoms = list(dict.fromkeys(normalized_symptoms))
        
        # If still no symptoms found, try basic word matching
        if not normalized_symptoms:
            all_text = ' '.join([str(s) for s in symptoms]).lower()
            if any(word in all_text for word in ['headache', 'head', 'pain']):
                normalized_symptoms.append('headache')
            if any(word in all_text for word in ['fever', 'temperature', 'hot']):
                normalized_symptoms.append('fever')
            if any(word in all_text for word in ['cough', 'coughing']):
                normalized_symptoms.append('cough')
            if any(word in all_text for word in ['nausea', 'nauseous', 'sick']):
                normalized_symptoms.append('nausea')
            if any(word in all_text for word in ['light', 'photophobia', 'sensitivity']):
                normalized_symptoms.append('photophobia')
        
        # Analyze vitals
        vitals_analysis = self.analyze_vitals(vitals or {})
        vitals_clues = vitals_analysis.get('clues', [])
        red_flags = vitals_analysis.get('red_flags', [])
        
        # Find matching diagnoses from database
        candidate_diagnoses = []
        
        # Map extracted keywords to database keys
        keyword_to_db_key = {
            'fever': 'fever',
            'cough': 'cough',
            'headache': 'headache',
            'chest pain': 'chest_pain',
            'chest_pain': 'chest_pain',
            'shortness of breath': 'shortness_of_breath',
            'shortness_of_breath': 'shortness_of_breath',
            'dyspnea': 'shortness_of_breath',
            'abdominal pain': 'abdominal_pain',
            'abdominal_pain': 'abdominal_pain',
            'nausea': 'abdominal_pain',  # Often associated with abdominal issues
            'vomiting': 'abdominal_pain',
            'dizziness': 'dizziness',
            'vertigo': 'dizziness',
            'hip pain': 'musculoskeletal_pain',
            'leg pain': 'musculoskeletal_pain',
            'knee pain': 'musculoskeletal_pain',
            'back pain': 'musculoskeletal_pain',
            'joint pain': 'musculoskeletal_pain',
            'muscle pain': 'musculoskeletal_pain',
            'fall': 'fall_injury',
            'fell': 'fall_injury',
            'trauma': 'fall_injury',
        }
        
        # Also check for partial matches in normalized symptoms
        matched_db_keys = set()
        for symptom in normalized_symptoms:
            # Direct match
            if symptom in self.DIAGNOSTIC_DATABASE:
                matched_db_keys.add(symptom)
            # Keyword mapping
            elif symptom in keyword_to_db_key:
                matched_db_keys.add(keyword_to_db_key[symptom])
            # Partial match (check if symptom contains database keys)
            else:
                for db_key in self.DIAGNOSTIC_DATABASE.keys():
                    if db_key in symptom or symptom in db_key:
                        matched_db_keys.add(db_key)
        
        # If no matches found, try to infer from common words
        if not matched_db_keys:
            symptom_text = ' '.join(normalized_symptoms).lower()
            if any(word in symptom_text for word in ['headache', 'head']):
                matched_db_keys.add('headache')
            if any(word in symptom_text for word in ['fever', 'temperature', 'hot']):
                matched_db_keys.add('fever')
            if any(word in symptom_text for word in ['cough', 'coughing']):
                matched_db_keys.add('cough')
            if any(word in symptom_text for word in ['chest', 'heart', 'cardiac']):
                matched_db_keys.add('chest_pain')
            if any(word in symptom_text for word in ['breath', 'breathing', 'short', 'winded']):
                matched_db_keys.add('shortness_of_breath')
            if any(word in symptom_text for word in ['stomach', 'abdomen', 'belly', 'nausea', 'vomit']):
                matched_db_keys.add('abdominal_pain')
            if any(word in symptom_text for word in ['dizzy', 'vertigo', 'spinning']):
                matched_db_keys.add('dizziness')
            if 'pain' in symptom_text and not matched_db_keys:
                matched_db_keys.add('musculoskeletal_pain')
            if any(word in symptom_text for word in ['fall', 'fell', 'hit', 'trauma']):
                matched_db_keys.add('fall_injury')
        
        # Generate diagnoses from matched database keys
        for db_key in matched_db_keys:
            if db_key in self.DIAGNOSTIC_DATABASE:
                db_entry = self.DIAGNOSTIC_DATABASE[db_key]
                for diag in db_entry['common_diagnoses']:
                    # Calculate adjusted probability
                    adjusted_prob = self.calculate_diagnosis_probability(
                        diag['diagnosis'],
                        normalized_symptoms,
                        vitals_clues,
                        age,
                        gender
                    )
                    
                    candidate_diagnoses.append({
                        'diagnosis': diag['diagnosis'],
                        'base_probability': diag['probability'],
                        'adjusted_probability': adjusted_prob,
                        'matching_symptom': db_key
                    })
        
        # Remove duplicates and aggregate probabilities
        diagnosis_map = {}
        for candidate in candidate_diagnoses:
            diag_name = candidate['diagnosis']
            if diag_name not in diagnosis_map:
                diagnosis_map[diag_name] = {
                    'diagnosis': diag_name,
                    'probability': candidate['adjusted_probability'],
                    'matching_symptoms': [candidate['matching_symptom']]
                }
            else:
                # If same diagnosis from multiple symptoms, increase probability
                diagnosis_map[diag_name]['probability'] = min(
                    diagnosis_map[diag_name]['probability'] + 0.1,
                    0.95
                )
                diagnosis_map[diag_name]['matching_symptoms'].append(candidate['matching_symptom'])
        
        # Sort by probability
        suggested_diagnoses = sorted(
            diagnosis_map.values(),
            key=lambda x: x['probability'],
            reverse=True
        )[:10]  # Top 10 diagnoses
        
        # Generate confidence scores
        confidence_scores = {}
        for diag in suggested_diagnoses:
            prob = diag['probability']
            if prob >= 0.7:
                confidence = 'high'
            elif prob >= 0.5:
                confidence = 'moderate'
            else:
                confidence = 'low'
            confidence_scores[diag['diagnosis']] = confidence
        
        # Recommend diagnostic tests
        recommended_tests = []
        if any('fever' in s or 'cough' in s for s in normalized_symptoms):
            recommended_tests.append('Complete Blood Count (CBC)')
            recommended_tests.append('Chest X-ray (if respiratory symptoms)')
        
        if any('chest_pain' in s for s in normalized_symptoms):
            recommended_tests.append('ECG')
            recommended_tests.append('Troponin (if cardiac suspected)')
            recommended_tests.append('Chest X-ray')
        
        if any('abdominal_pain' in s for s in normalized_symptoms):
            recommended_tests.append('Complete Metabolic Panel (CMP)')
            recommended_tests.append('Lipase (if pancreatitis suspected)')
        
        if any('headache' in s or 'dizziness' in s for s in normalized_symptoms):
            if red_flags:
                recommended_tests.append('CT Head (if red flags present)')
        
        # Remove duplicates
        recommended_tests = list(dict.fromkeys(recommended_tests))
        
        # Enrich diagnoses with ICD-10 and SNOMED CT codes
        enriched_diagnoses = []
        for d in suggested_diagnoses:
            diag_dict = {
                'diagnosis': d['diagnosis'],
                'probability': round(d['probability'], 3),
                'confidence': confidence_scores.get(d['diagnosis'], 'low'),
                'matching_symptoms': list(set(d['matching_symptoms']))
            }
            
            # Add ICD-10 code if mapper available
            if self.icd10_mapper:
                icd10_code = self.icd10_mapper.get_icd10_code(d['diagnosis'])
                if icd10_code:
                    diag_dict['icd10'] = icd10_code
            
            # Add SNOMED CT code if mapper available
            if self.snomed_mapper:
                snomed_code = self.snomed_mapper.get_snomed_code(d['diagnosis'])
                if snomed_code:
                    diag_dict['snomed'] = snomed_code
            
            enriched_diagnoses.append(diag_dict)
        
        return {
            'suggested_diagnoses': enriched_diagnoses,
            'confidence_scores': confidence_scores,
            'recommended_tests': recommended_tests,
            'red_flags': red_flags,
            'vitals_clues': vitals_clues
        }
    
    async def intelligent_suggest(
        self,
        symptoms: List[str],
        vitals: Optional[Dict[str, Any]] = None,
        clinical_notes: Optional[str] = None,
        patient_data: Optional[Dict[str, Any]] = None,
        age: Optional[int] = None,
        gender: Optional[str] = None,
        tenant_id: Optional[str] = None,
        governance_policy: Optional[Dict[str, Any]] = None,
        model_registry: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Intelligent diagnostic suggestion combining rule-based CDSS + AI models
        
        Args:
            symptoms: List of symptoms
            vitals: Vital signs
            clinical_notes: Free-text clinical notes
            patient_data: Structured patient data (for MedBERT)
            age: Patient age
            gender: Patient gender
        
        Returns:
            Fused recommendations from rule-based + AI models
        """
        # Rule-based suggestions (existing method)
        rule_based_results = self.suggest_diagnosis(
            symptoms=symptoms,
            vitals=vitals,
            age=age,
            gender=gender
        )
        
        # Check if lightweight AI models are available (even without transformers)
        # Lightweight models work without transformers library
        has_ai_models = (self.medbert is not None) or (self.clinicalbert is not None)
        has_fusion = self.fusion_engine is not None
        has_llm = self.llm_provider is not None
        model_snapshot = model_registry or self._runtime_model_versions()
        llm_route = self._select_llm_model(tenant_id=tenant_id, model_registry=model_snapshot)
        trace_input = {
            "symptoms": symptoms,
            "vitals": vitals,
            "age": age,
            "gender": gender,
            "patient_data": patient_data,
        }
        
        # If no AI models at all, return rule-based only
        if not has_ai_models and not has_llm:
            logger.debug("AI models not available, using rule-based only")
            base = {
                **rule_based_results,
                'source': 'rule_based_only',
                'ai_enabled': False
            }
            base["model_registry"] = model_snapshot
            base["model_trace"] = self._build_model_trace(
                tenant_id=tenant_id,
                model_registry=model_snapshot,
                llm_route=llm_route,
                request_payload=trace_input,
            )
            return apply_safety_gate(base, governance_policy)

        # 1. Run Local LLM (if available)
        llm_results = None
        if has_llm and await self.llm_provider.check_availability():
            try:
                # RAG: Retrieve relevant guidelines
                guideline_context = ""
                retrieved_docs = []
                safe_notes_for_retrieval = redact_text(clinical_notes) if clinical_notes else None
                query_terms = symptoms + ([safe_notes_for_retrieval] if safe_notes_for_retrieval else [])
                query = " ".join(query_terms)[:200] # Limit query length
                requested_specialty = None
                requested_module = None
                if patient_data:
                    requested_specialty = patient_data.get("specialty")
                    requested_module = patient_data.get("module")

                if self.knowledge_registry:
                    try:
                        governed_docs = self.knowledge_registry.search(
                            query,
                            limit=3,
                            specialty=requested_specialty,
                            module=requested_module,
                        )
                        if governed_docs:
                            retrieved_docs.extend(governed_docs)
                    except Exception as e:
                        logger.warning(f"Governed knowledge retrieval failed: {e}")

                if self.rag_engine:
                    # Context-Aware Filtering (Sprint 2)
                    rag_filters = {}
                    if gender and gender.lower() in ['male', 'm']:
                        # Exclude pregnancy-related content for males
                        rag_filters["target_population"] = {"$ne": "pregnant_women"}
                        
                    try:
                        # Pass None when no filters to avoid Chroma 'where' validation errors
                        rag_docs = self.rag_engine.query(
                            query,
                            filters=rag_filters if rag_filters else None,
                            tenant_id=tenant_id
                        )
                        if rag_docs:
                            existing = {
                                (str(doc.get('title') or ''), str(doc.get('text') or ''), str(doc.get('source') or ''))
                                for doc in retrieved_docs
                            }
                            for doc in rag_docs:
                                key = (str(doc.get('title') or ''), str(doc.get('text') or ''), str(doc.get('source') or ''))
                                if key not in existing:
                                    existing.add(key)
                                    retrieved_docs.append(doc)
                            logger.info(f"RAG retrieved {len(rag_docs)} guideline chunks with filters: {rag_filters}")
                    except Exception as e:
                        logger.warning(f"RAG retrieval failed: {e}")

                if retrieved_docs:
                    guideline_texts = []
                    for doc in retrieved_docs:
                        metadata = doc.get('metadata') or {}
                        source_version = metadata.get('source_version') or doc.get('source_version')
                        version_suffix = f" v{source_version}" if source_version else ""
                        guideline_texts.append(f"{doc['text']} (Source: {doc['source']}{version_suffix})")
                    guideline_context = "\n\nRelevant Medical Guidelines:\n" + "\n---\n".join(guideline_texts)

                prompt_history = redact_value(patient_data.get('conditions', [])) if patient_data else []
                prompt_labs = redact_value(patient_data.get('labs', {})) if patient_data else {}
                safe_clinical_notes = redact_text(clinical_notes) if clinical_notes else None
                
                prompt = f"""
                Patient Case Analysis:
                - Demographics: Age {age}, Gender {gender}
                - Symptoms: {', '.join(symptoms)}
                - Vitals: {vitals}
                - Clinical Notes: {safe_clinical_notes or 'None'}
                - Medical History: {prompt_history}
                - Lab Results: {prompt_labs}
                {guideline_context}
                
                Based on the patient information and the provided guidelines (if any), provide a comprehensive clinical assessment.
                
                CRITICAL INSTRUCTION: You must think step-by-step before providing a recommendation. 
                1. Analyze the symptoms and vitals in context of demographics.
                2. Evaluate risk factors and potential red flags.
                3. Consider relevant guidelines and rule out/in conditions.
                4. SYNTHESIZE this reasoning into a clear, logical argument.
                5. ONLY THEN formulate the primary recommendation.
                """
                
                schema = """
                {
                    "reasoning": "Detailed step-by-step clinical reasoning explaining the thought process, analysis of symptoms/vitals, and justification for the recommendation.",
                    "recommendation": "Primary clinical recommendation (concise)",
                    "evidence_level": "High | Moderate | Low",
                    "diagnoses": [
                        {"name": "Diagnosis Name", "probability": 0.5, "reasoning": "Brief explanation"}
                    ],
                    "recommended_tests": ["Test Name"],
                    "red_flags": ["Warning sign"],
                    "action_items": ["Immediate actions to take"]
                }
                """
                
                llm_json = await self.llm_provider.generate_json(
                    prompt,
                    schema,
                    model_name=llm_route.get("model_name"),
                    use_case="intelligent_diagnosis",
                    tenant_id=tenant_id,
                )
                if llm_json:
                    llm_results = llm_json
                    logger.info(f"Local LLM generated {len(llm_results.get('diagnoses', []))} diagnoses")
                    
                    # Store citations for return
                    if self.rag_engine and 'retrieved_docs' in locals() and retrieved_docs:
                        llm_results['citations'] = retrieved_docs
            except Exception as e:
                logger.error(f"Local LLM execution failed: {e}")

        medbert_results = None
        clinicalbert_results = None
        
        # 2. MedBERT predictions (structured data)
        if self.medbert and patient_data:
            try:
                # Prepare patient data for MedBERT
                medbert_input = {
                    'age': age or patient_data.get('age'),
                    'gender': gender or patient_data.get('gender', ''),
                    'vitals': vitals or patient_data.get('vitals', {}),
                    'labs': patient_data.get('labs', {}),
                    'conditions': patient_data.get('conditions', [])
                }
                
                medbert_results = self.medbert.predict_disease_risk(medbert_input)
                logger.debug(f"MedBERT returned {len(medbert_results.get('predictions', []))} predictions")
            except Exception as e:
                logger.warning(f"MedBERT prediction failed: {e}")
                medbert_results = None
        
        # 3. ClinicalBERT suggestions (clinical notes)
        if self.clinicalbert and clinical_notes:
            try:
                clinicalbert_results = self.clinicalbert.suggest_diagnoses(
                    clinical_text=clinical_notes,
                    context={'age': age, 'gender': gender},
                    tenant_id=tenant_id,
                )
                logger.debug(f"ClinicalBERT returned {len(clinicalbert_results.get('suggestions', []))} suggestions")
            except Exception as e:
                logger.warning(f"ClinicalBERT prediction failed: {e}")
                clinicalbert_results = None
        
        # If no AI results, return rule-based
        if not medbert_results and not clinicalbert_results and not llm_results:
            base = {
                **rule_based_results,
                'source': 'rule_based_only',
                'ai_enabled': True,
                'ai_models_available': False
            }
            base["model_registry"] = model_snapshot
            base["model_trace"] = self._build_model_trace(
                tenant_id=tenant_id,
                model_registry=model_snapshot,
                llm_route=llm_route,
                request_payload=trace_input,
            )
            return apply_safety_gate(base, governance_policy)
        
        # 4. Fusion: Combine all results
        # If fusion engine is available, use it for MedBERT/ClinicalBERT
        fused_results = rule_based_results
        if self.fusion_engine:
            try:
                fused_results = self.fusion_engine.fuse_recommendations(
                    rule_based_results=rule_based_results,
                    medbert_results=medbert_results,
                    clinicalbert_results=clinicalbert_results
                )
            except Exception as e:
                logger.error(f"Fusion failed: {e}. Using rule-based base.")
                
        # 5. Merge LLM Results (if any)
        if llm_results:
            # Simple merge strategy: Add LLM diagnoses to the list if not present, or boost probability
            existing_diagnoses = {d['diagnosis'].lower(): d for d in fused_results.get('suggested_diagnoses', [])}
            
            for llm_diag in llm_results.get('diagnoses', []):
                name = llm_diag.get('name', '').strip()
                if not name: continue
                
                normalized_name = name.lower()
                prob = float(llm_diag.get('probability', 0.5))
                reasoning = llm_diag.get('reasoning', '')
                
                if normalized_name in existing_diagnoses:
                    # Boost existing
                    existing = existing_diagnoses[normalized_name]
                    existing['probability'] = min(0.99, existing['probability'] + 0.1)
                    existing['ai_reasoning'] = reasoning
                    existing['sources'] = existing.get('sources', []) + ['llm']
                else:
                    # Add new
                    new_diag = {
                        'diagnosis': name,
                        'probability': prob,
                        'confidence': 'moderate' if prob > 0.5 else 'low',
                        'matching_symptoms': [],
                        'ai_reasoning': reasoning,
                        'source': 'llm'
                    }
                    fused_results['suggested_diagnoses'].append(new_diag)
            
            # Re-sort
            fused_results['suggested_diagnoses'].sort(key=lambda x: x['probability'], reverse=True)
            
            # Merge tests and red flags
            fused_results['recommended_tests'] = list(set(fused_results.get('recommended_tests', []) + llm_results.get('recommended_tests', [])))
            fused_results['red_flags'] = list(set(fused_results.get('red_flags', []) + llm_results.get('red_flags', [])))
            
            fused_results['ai_models_used'] = fused_results.get('ai_models_used', {})
            fused_results['ai_models_used']['llm'] = True
            
            # Pass through citations
            if 'citations' in llm_results:
                fused_results['guideline_citations'] = llm_results['citations']
                
            # Merge Sprint 3 fields
            if 'recommendation' in llm_results:
                fused_results['clinical_recommendation'] = {
                    'text': llm_results['recommendation'],
                    'evidence_level': llm_results.get('evidence_level', 'Low'),
                    'reasoning': llm_results.get('reasoning', ''),
                    'action_items': llm_results.get('action_items', [])
                }

        final_result = {
            **fused_results,
            'recommended_tests': fused_results.get('recommended_tests', []),
            'red_flags': fused_results.get('red_flags', []),
            'vitals_clues': fused_results.get('vitals_clues', []),
            'guideline_citations': fused_results.get('guideline_citations', []),
            'clinical_recommendation': fused_results.get('clinical_recommendation'),
            'ai_enabled': True,
            'source': 'hybrid_cdss_ai_llm'
        }
        final_result["model_registry"] = model_snapshot
        final_result["model_trace"] = self._build_model_trace(
            tenant_id=tenant_id,
            model_registry=model_snapshot,
            llm_route=llm_route,
            request_payload=trace_input,
        )
        return apply_safety_gate(final_result, governance_policy)

    async def summarize_patient_history(
        self,
        clinical_notes: List[str],
        demographics: Dict[str, Any],
        recent_vitals: Optional[Dict[str, Any]] = None,
        tenant_id: Optional[str] = None,
    ) -> Dict[str, str]:
        """
        Generate a concise "One-Liner" summary of the patient's history using LLM.
        """
        if not self.llm_provider:
             return {"summary": "AI summarization unavailable (Provider missing)", "source": "fallback"}

        if not await self.llm_provider.check_availability():
             return {"summary": "AI summarization unavailable (Service down)", "source": "fallback"}

        notes_text = "\n".join(clinical_notes[-5:]) if clinical_notes else "No recent notes."
        safe_notes_text = redact_text(notes_text)
        safe_vitals = redact_value(recent_vitals)
        
        prompt = f"""
        Summarize this patient's medical status into a single professional sentence (the "One-Liner").
        
        Patient: {demographics.get('age')}yo {demographics.get('gender')}
        Recent Vitals: {safe_vitals}
        Recent Notes:
        {safe_notes_text}
        
        Format: "[Age/Sex] with [Key History] presenting with [Current Status]."
        Example: "45yo Male with history of T2DM and HTN presenting with acute chest pain and diaphoresis."
        """
        
        response = await self.llm_provider.generate_response(
            prompt,
            use_case="patient_summarization",
            tenant_id=tenant_id,
        )
        if response:
            return {
                "summary": response.strip(),
                "source": "llm"
            }
        else:
            return {
                "summary": "Failed to generate summary.",
                "source": "error"
            }
