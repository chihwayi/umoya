"""
Diagnostic Assistant
Provides differential diagnosis suggestions based on symptoms, vitals, and patient demographics
Uses pattern matching and clinical decision rules
Enhanced with AI models (MedBERT, ClinicalBERT) for intelligent diagnostics
Includes SNOMED CT and ICD-10 code mapping
"""
from typing import Dict, List, Optional, Any, Tuple
from collections import Counter
import importlib
import re
import logging
import hashlib
import json
import os
import threading
from privacy_guard import redact_text, redact_value
from ai_governance import apply_safety_gate, compute_request_hash

logger = logging.getLogger(__name__)

# Import heavyweight AI modules lazily so the CDSS API can start before
# model stacks are actually needed by a clinical request.
AI_AVAILABLE = True

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
        self.ai_enabled = os.getenv("CDSS_ENABLE_AI", "false").strip().lower() == "true"
        self._rag_init_lock = threading.Lock()
        self._ai_init_lock = threading.Lock()
        self._rag_initialized = False
        self._ai_initialized = False

        if not self.ai_enabled:
            logger.info("CDSS_ENABLE_AI=false; skipping heavy diagnostic AI initialization and using rule-based mode only.")
        elif not AI_AVAILABLE:
            logger.info("AI dependencies unavailable. Diagnostic assistant will stay in rule-based mode.")
        else:
            logger.info("CDSS AI runtime will initialize lazily on first clinical use.")
        
        if TERMINOLOGY_AVAILABLE:
            try:
                self.icd10_mapper = Icd10Mapper()
                self.snomed_mapper = SnomedMapper()
                logger.info("Terminology mappers initialized for code mapping")
            except Exception as e:
                logger.warning(f"Failed to initialize terminology mappers: {e}")
                self.icd10_mapper = None
                self.snomed_mapper = None

    def ensure_rag_engine_initialized(self) -> None:
        if not self.ai_enabled or not AI_AVAILABLE or self.rag_engine is not None:
            return

        with self._rag_init_lock:
            if self.rag_engine is not None:
                return
            try:
                llm_provider_cls = importlib.import_module("ai_models.llm_provider").LLMProvider
                rag_engine_cls = importlib.import_module("ai_models.rag_engine").RAGEngine
                knowledge_registry_cls = importlib.import_module("clinical_knowledge_registry").ClinicalKnowledgeRegistry
                if self.llm_provider is None:
                    self.llm_provider = llm_provider_cls()
                if self.rag_engine is None:
                    self.rag_engine = rag_engine_cls()
                if self.knowledge_registry is None:
                    self.knowledge_registry = knowledge_registry_cls()
                self._rag_initialized = True
                logger.info("Deferred CDSS RAG/LLM runtime initialized.")
            except ImportError as e:
                logger.info(f"Deferred RAG runtime dependencies unavailable: {e}")
            except Exception as e:
                logger.warning(f"Failed to initialize deferred RAG runtime: {e}")

    def ensure_ai_initialized(self) -> None:
        if not self.ai_enabled or not AI_AVAILABLE or self._ai_initialized:
            return

        self.ensure_rag_engine_initialized()
        with self._ai_init_lock:
            if self._ai_initialized:
                return
            try:
                medbert_cls = importlib.import_module("ai_models.medbert_predictor").MedBERTPredictor
                clinicalbert_cls = importlib.import_module("ai_models.clinicalbert_diagnostic").ClinicalBERTDiagnostic
                fusion_engine_cls = importlib.import_module("ai_models.fusion_engine").IntelligentFusionEngine
                llm_provider_cls = importlib.import_module("ai_models.llm_provider").LLMProvider
                knowledge_registry_cls = importlib.import_module("clinical_knowledge_registry").ClinicalKnowledgeRegistry
                if self.medbert is None:
                    self.medbert = medbert_cls()
                if self.clinicalbert is None:
                    self.clinicalbert = clinicalbert_cls()
                if self.fusion_engine is None:
                    self.fusion_engine = fusion_engine_cls()
                if self.llm_provider is None:
                    self.llm_provider = llm_provider_cls()
                if self.knowledge_registry is None:
                    self.knowledge_registry = knowledge_registry_cls()
                self._ai_initialized = True
                logger.info("Deferred CDSS diagnostic AI models initialized.")
            except ImportError as e:
                logger.info(f"Deferred diagnostic AI dependencies unavailable: {e}")
            except Exception as e:
                logger.warning(f"Failed to initialize deferred diagnostic AI models: {e}")

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
    
    # Symptom-diagnosis mapping database (clinical knowledge base, Zimbabwe/Africa context)
    DIAGNOSTIC_DATABASE = {
        'fever': {
            'common_diagnoses': [
                {'diagnosis': 'Malaria', 'probability': 0.55},
                {'diagnosis': 'Viral Upper Respiratory Infection', 'probability': 0.20},
                {'diagnosis': 'Typhoid Fever', 'probability': 0.12},
                {'diagnosis': 'Bacterial Pneumonia', 'probability': 0.10},
                {'diagnosis': 'Urinary Tract Infection', 'probability': 0.08},
                {'diagnosis': 'Sepsis', 'probability': 0.06}
            ],
            'key_symptoms': ['fever', 'fatigue', 'body aches'],
            'alarming_signs': ['high_fever', 'rigors', 'altered_mental_status']
        },
        'cough': {
            'common_diagnoses': [
                {'diagnosis': 'Pulmonary Tuberculosis', 'probability': 0.35},
                {'diagnosis': 'Pneumonia', 'probability': 0.28},
                {'diagnosis': 'Acute Bronchitis', 'probability': 0.18},
                {'diagnosis': 'Asthma Exacerbation', 'probability': 0.12},
                {'diagnosis': 'COPD Exacerbation', 'probability': 0.08}
            ],
            'key_symptoms': ['cough', 'sputum', 'shortness_of_breath'],
            'alarming_signs': ['hemoptysis', 'chest_pain', 'respiratory_distress']
        },
        'chest_pain': {
            'common_diagnoses': [
                {'diagnosis': 'Acute Coronary Syndrome', 'probability': 0.25},
                {'diagnosis': 'Pneumonia', 'probability': 0.20},
                {'diagnosis': 'Musculoskeletal Pain', 'probability': 0.18},
                {'diagnosis': 'GERD/Reflux', 'probability': 0.15},
                {'diagnosis': 'Pulmonary Embolism', 'probability': 0.12},
                {'diagnosis': 'Pericarditis', 'probability': 0.07}
            ],
            'key_symptoms': ['chest_pain', 'dyspnea', 'diaphoresis'],
            'alarming_signs': ['crushing_pain', 'radiating_pain', 'syncope']
        },
        'shortness_of_breath': {
            'common_diagnoses': [
                {'diagnosis': 'Severe Anaemia', 'probability': 0.35},
                {'diagnosis': 'Heart Failure', 'probability': 0.22},
                {'diagnosis': 'Pneumonia', 'probability': 0.18},
                {'diagnosis': 'Asthma', 'probability': 0.12},
                {'diagnosis': 'Pulmonary Embolism', 'probability': 0.08},
                {'diagnosis': 'COPD Exacerbation', 'probability': 0.06}
            ],
            'key_symptoms': ['dyspnea', 'orthopnea', 'cough'],
            'alarming_signs': ['sudden_onset', 'cyanosis', 'respiratory_distress']
        },
        'fatigue': {
            'common_diagnoses': [
                {'diagnosis': 'Severe Anaemia', 'probability': 0.45},
                {'diagnosis': 'Malaria', 'probability': 0.35},
                {'diagnosis': 'Pulmonary Tuberculosis', 'probability': 0.20},
                {'diagnosis': 'Heart Failure', 'probability': 0.15},
                {'diagnosis': 'HIV/AIDS', 'probability': 0.12},
                {'diagnosis': 'Hypothyroidism', 'probability': 0.08}
            ],
            'key_symptoms': ['fatigue', 'weakness', 'lethargy'],
            'alarming_signs': ['severe_fatigue', 'pallor', 'syncope']
        },
        'vomiting': {
            'common_diagnoses': [
                {'diagnosis': 'Malaria', 'probability': 0.40},
                {'diagnosis': 'Gastroenteritis', 'probability': 0.30},
                {'diagnosis': 'Typhoid Fever', 'probability': 0.15},
                {'diagnosis': 'Meningitis', 'probability': 0.10},
                {'diagnosis': 'Diabetic Ketoacidosis', 'probability': 0.06}
            ],
            'key_symptoms': ['vomiting', 'nausea', 'abdominal_pain'],
            'alarming_signs': ['projectile_vomiting', 'blood_in_vomit', 'altered_consciousness']
        },
        'abdominal_pain': {
            'common_diagnoses': [
                {'diagnosis': 'Gastroenteritis', 'probability': 0.30},
                {'diagnosis': 'Appendicitis', 'probability': 0.18},
                {'diagnosis': 'Peptic Ulcer Disease', 'probability': 0.14},
                {'diagnosis': 'Gallstones/Cholecystitis', 'probability': 0.12},
                {'diagnosis': 'Irritable Bowel Syndrome', 'probability': 0.10},
                {'diagnosis': 'Ectopic Pregnancy', 'probability': 0.08}
            ],
            'key_symptoms': ['abdominal_pain', 'nausea', 'vomiting'],
            'alarming_signs': ['rebound_tenderness', 'rigid_abdomen', 'fever']
        },
        'headache': {
            'common_diagnoses': [
                {'diagnosis': 'Malaria', 'probability': 0.40},
                {'diagnosis': 'Hypertensive Emergency', 'probability': 0.20},
                {'diagnosis': 'Meningitis', 'probability': 0.15},
                {'diagnosis': 'Migraine', 'probability': 0.12},
                {'diagnosis': 'Tension Headache', 'probability': 0.10},
                {'diagnosis': 'Sinusitis', 'probability': 0.06}
            ],
            'key_symptoms': ['headache', 'photophobia', 'fever'],
            'alarming_signs': ['sudden_severe', 'neck_stiffness', 'focal_neurologic', 'worst_headache_of_life']
        },
        'dizziness': {
            'common_diagnoses': [
                {'diagnosis': 'Severe Anaemia', 'probability': 0.35},
                {'diagnosis': 'Orthostatic Hypotension', 'probability': 0.22},
                {'diagnosis': 'Malaria', 'probability': 0.18},
                {'diagnosis': 'Benign Paroxysmal Positional Vertigo', 'probability': 0.12},
                {'diagnosis': 'Arrhythmia', 'probability': 0.08},
                {'diagnosis': 'Stroke/TIA', 'probability': 0.05}
            ],
            'key_symptoms': ['dizziness', 'vertigo', 'nausea'],
            'alarming_signs': ['focal_neurologic', 'syncope', 'chest_pain']
        },
        'musculoskeletal_pain': {
            'common_diagnoses': [
                {'diagnosis': 'Muscle Strain', 'probability': 0.35},
                {'diagnosis': 'Arthritis', 'probability': 0.20},
                {'diagnosis': 'Contusion', 'probability': 0.18},
                {'diagnosis': 'Fracture', 'probability': 0.15},
                {'diagnosis': 'Tendinitis', 'probability': 0.10}
            ],
            'key_symptoms': ['pain', 'swelling', 'limited_range_of_motion'],
            'alarming_signs': ['deformity', 'inability_to_bear_weight', 'severe_pain']
        },
        'fall_injury': {
            'common_diagnoses': [
                {'diagnosis': 'Contusion', 'probability': 0.30},
                {'diagnosis': 'Fracture', 'probability': 0.25},
                {'diagnosis': 'Head Injury', 'probability': 0.20},
                {'diagnosis': 'Sprain/Strain', 'probability': 0.18},
                {'diagnosis': 'Laceration', 'probability': 0.08}
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
        """Calculate probability score for a diagnosis based on symptom clusters and context."""
        diag_lower = diagnosis.lower()
        sym_text = ' '.join(symptoms).lower()
        vitals_text = ' '.join(str(v) for v in vitals_clues).lower()

        # Start from the DB base_probability (caller adds 0.1 minimum; we adjust from there)
        base_probability = 0.1

        # ── Malaria (Zimbabwe endemic — always considered with fever/headache/fatigue) ──
        if 'malaria' in diag_lower:
            if any(w in sym_text for w in ['fever', 'headache', 'fatigue', 'vomiting', 'chills', 'rigors']):
                base_probability += 0.30
            if sum(1 for w in ['fever', 'headache', 'vomiting', 'fatigue'] if w in sym_text) >= 3:
                base_probability += 0.20

        # ── Anaemia ──
        if 'anaemia' in diag_lower or 'anemia' in diag_lower:
            if 'fatigue' in sym_text or 'tired' in sym_text:
                base_probability += 0.25
            if 'shortness' in sym_text or 'dyspnea' in sym_text:
                base_probability += 0.15
            if 'dizziness' in sym_text:
                base_probability += 0.10

        # ── Meningitis ──
        if 'meningitis' in diag_lower:
            if 'headache' in sym_text and ('vomiting' in sym_text or 'nausea' in sym_text):
                base_probability += 0.30
            if 'fever' in sym_text:
                base_probability += 0.15
            if 'neck stiffness' in sym_text or 'photophobia' in sym_text or 'confusion' in sym_text:
                base_probability += 0.25

        # ── Hypertensive Emergency / Pre-eclampsia ──
        if 'hypertensive' in diag_lower or 'eclampsia' in diag_lower or 'pre-eclampsia' in diag_lower:
            if 'headache' in sym_text and ('vomiting' in sym_text or 'shortness' in sym_text):
                base_probability += 0.35
            if 'hypertension' in vitals_text or 'high blood pressure' in vitals_text:
                base_probability += 0.25

        # ── TB ──
        if 'tuberculosis' in diag_lower or ' tb' in diag_lower:
            if 'cough' in sym_text and ('fatigue' in sym_text or 'weight' in sym_text or 'sweating' in sym_text):
                base_probability += 0.30

        # ── Pneumonia ──
        if 'pneumonia' in diag_lower:
            if 'cough' in sym_text and 'fever' in sym_text:
                base_probability += 0.25
            if 'shortness' in sym_text or 'dyspnea' in sym_text:
                base_probability += 0.15
            if age and age >= 65:
                base_probability += 0.10

        # ── Heart Failure ──
        if 'heart failure' in diag_lower:
            if 'shortness' in sym_text and 'fatigue' in sym_text:
                base_probability += 0.25
            if age and age >= 60:
                base_probability += 0.15
            if 'edema' in sym_text or 'orthopnea' in sym_text:
                base_probability += 0.15

        # ── Cardiac / ACS ──
        if 'coronary' in diag_lower or 'cardiac' in diag_lower or 'infarction' in diag_lower:
            if 'chest pain' in sym_text or 'chest_pain' in sym_text:
                base_probability += 0.20

        # ── Vitals boosts ──
        if vitals_clues:
            if 'hypoxia' in vitals_text and ('respiratory' in diag_lower or 'pneumonia' in diag_lower or 'heart failure' in diag_lower):
                base_probability += 0.15
            if 'tachycardia' in vitals_text and ('cardiac' in diag_lower or 'sepsis' in diag_lower or 'malaria' in diag_lower):
                base_probability += 0.10

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
                # Normalise common free-text synonyms before keyword scanning
                expanded = symptom_str
                for src, dst in [
                    ('shortness breath', 'shortness of breath'),
                    ('short of breath', 'shortness of breath'),
                    ('breathlessness', 'shortness of breath'),
                    ('difficulty breath', 'shortness of breath'),
                    ('difficulty breathing', 'shortness of breath'),
                    ('can\'t breathe', 'shortness of breath'),
                    ('cannot breathe', 'shortness of breath'),
                    ('extremely tired', 'fatigue'),
                    ('very tired', 'fatigue'),
                    ('feeling tired', 'fatigue'),
                    ('feeling weak', 'fatigue'),
                    ('weakness', 'fatigue'),
                    ('lethargy', 'fatigue'),
                    ('lethargic', 'fatigue'),
                    ('exhausted', 'fatigue'),
                    ('tiredness', 'fatigue'),
                    (' tired', ' fatigue'),
                    ('throwing up', 'vomiting'),
                    ('been sick', 'vomiting'),
                    ('nausea', 'nausea'),
                    ('rigors', 'chills'),
                    ('photophobia', 'sensitivity to light'),
                ]:
                    expanded = expanded.replace(src, dst)

                symptom_keywords = [
                    'fever', 'cough', 'headache', 'chest pain', 'shortness of breath',
                    'dyspnea', 'abdominal pain', 'nausea', 'vomiting', 'dizziness',
                    'vertigo', 'fatigue', 'body aches', 'sore throat', 'runny nose',
                    'congestion', 'diarrhea', 'constipation', 'back pain', 'joint pain',
                    'muscle pain', 'rash', 'itching', 'sweating', 'chills', 'rigors',
                    'neck stiffness', 'confusion', 'seizure', 'syncope',
                    'palpitations', 'orthopnea', 'edema', 'jaundice', 'bleeding',
                    'hemoptysis', 'dysuria', 'frequency', 'urgency', 'hematuria',
                    'sensitivity to light',
                ]
                for keyword in symptom_keywords:
                    if keyword in expanded:
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
            'stomach pain': 'abdominal_pain',
            'nausea': 'vomiting',
            'vomiting': 'vomiting',
            'fatigue': 'fatigue',
            'tiredness': 'fatigue',
            'weakness': 'fatigue',
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
            if any(word in symptom_text for word in ['breath', 'breathing', 'short', 'winded', 'dyspnea']):
                matched_db_keys.add('shortness_of_breath')
            if any(word in symptom_text for word in ['stomach', 'abdomen', 'belly', 'abdominal']):
                matched_db_keys.add('abdominal_pain')
            if any(word in symptom_text for word in ['vomit', 'nausea', 'sick']):
                matched_db_keys.add('vomiting')
            if any(word in symptom_text for word in ['fatigue', 'tired', 'weak', 'exhaust', 'lethargy']):
                matched_db_keys.add('fatigue')
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
        
        # ── Combination red flags (symptom cluster logic) ──
        sym_joined = ' '.join(normalized_symptoms).lower()
        has_headache = 'headache' in sym_joined
        has_vomiting = any(w in sym_joined for w in ['vomiting', 'nausea'])
        has_fever    = 'fever' in sym_joined
        has_sob      = any(w in sym_joined for w in ['shortness of breath', 'shortness_of_breath', 'dyspnea', 'breath'])
        has_fatigue  = any(w in sym_joined for w in ['fatigue', 'tired', 'weak'])
        has_severe   = 'severe' in ' '.join([str(s) for s in symptoms]).lower()

        if has_headache and has_vomiting and has_fever:
            red_flags.append('Headache + vomiting + fever: exclude Malaria (urgent RDT) and Meningitis (lumbar puncture if neck stiffness or photophobia).')
        elif has_headache and has_vomiting and has_severe:
            red_flags.append('Severe headache with vomiting: meningism pattern — assess for neck stiffness, photophobia, altered consciousness. Also consider hypertensive emergency (check BP urgently).')
        elif has_headache and has_vomiting:
            red_flags.append('Headache with vomiting: check blood pressure urgently and assess for meningism signs.')

        if has_fatigue and has_sob:
            red_flags.append('Fatigue with shortness of breath: assess for severe anaemia (FBC + peripheral smear), heart failure (clinical exam, ECG), and malaria RDT.')

        if has_sob and has_headache and has_vomiting:
            red_flags.append('Triad of shortness of breath + severe headache + vomiting: consider hypertensive emergency or pre-eclampsia — check blood pressure immediately.')

        # ── Recommended tests based on matched symptom categories ──
        recommended_tests = []
        if has_fever or 'fever' in matched_db_keys:
            recommended_tests.append('Malaria RDT (or thick/thin blood film)')
            recommended_tests.append('Full Blood Count (FBC)')
        if has_fatigue or 'fatigue' in matched_db_keys or has_sob or 'shortness_of_breath' in matched_db_keys:
            recommended_tests.append('Full Blood Count (FBC) — haemoglobin, MCV for anaemia')
        if has_headache and has_vomiting:
            recommended_tests.append('Blood pressure measurement (urgent)')
            recommended_tests.append('Malaria RDT')
            if has_severe:
                recommended_tests.append('Lumbar puncture (after excluding raised ICP) if meningism signs present')
        if 'cough' in matched_db_keys:
            recommended_tests.append('Chest X-ray')
            recommended_tests.append('Sputum GeneXpert MTB/RIF (if cough ≥2 weeks)')
        if 'chest_pain' in matched_db_keys:
            recommended_tests.append('12-lead ECG (urgent)')
            recommended_tests.append('Troponin')
            recommended_tests.append('Chest X-ray')
        if 'abdominal_pain' in matched_db_keys:
            recommended_tests.append('Urine pregnancy test (if female, reproductive age)')
            recommended_tests.append('Complete Metabolic Panel (CMP)')
        if has_headache and red_flags:
            recommended_tests.append('CT Head (if focal neurology or altered consciousness)')

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
        self.ensure_ai_initialized()

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
        
        # F8 fix (S268): tracks whether guideline retrieval actually grounded this
        # generation, so the response can honestly say so instead of silently
        # proceeding with empty context. Set on every return path.
        grounding_status = 'not_attempted'
        grounding_reason = 'No retrieval engine configured or AI generation not reached'

        # If no AI models at all, return rule-based only
        if not has_ai_models and not has_llm:
            logger.debug("AI models not available, using rule-based only")
            base = {
                **rule_based_results,
                'source': 'rule_based_only',
                'ai_enabled': False,
                'grounding_status': grounding_status,
                'grounding_reason': grounding_reason,
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
                retrieval_attempted = False
                retrieval_failed = False
                safe_notes_for_retrieval = redact_text(clinical_notes) if clinical_notes else None
                query_terms = symptoms + ([safe_notes_for_retrieval] if safe_notes_for_retrieval else [])
                query = " ".join(query_terms)[:200] # Limit query length
                requested_specialty = None
                requested_module = None
                if patient_data:
                    requested_specialty = patient_data.get("specialty")
                    requested_module = patient_data.get("module")

                if self.knowledge_registry:
                    retrieval_attempted = True
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
                        retrieval_failed = True

                if self.rag_engine:
                    retrieval_attempted = True
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
                        retrieval_failed = True

                if retrieved_docs:
                    grounding_status = 'grounded'
                    grounding_reason = f'{len(retrieved_docs)} guideline chunk(s) retrieved and included in the prompt'
                elif not retrieval_attempted:
                    grounding_status = 'not_attempted'
                    grounding_reason = 'No knowledge registry or RAG engine configured'
                elif retrieval_failed:
                    grounding_status = 'ungrounded_retrieval_failed'
                    grounding_reason = 'Guideline retrieval raised an exception — generation proceeded without grounding'
                else:
                    grounding_status = 'ungrounded_no_results'
                    grounding_reason = 'Guideline retrieval ran but found no relevant chunks for this query'

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
                    
                    # Store citations for return. Previously gated on `self.rag_engine`
                    # truthy even when retrieved_docs came from knowledge_registry alone
                    # (S268/F8 fix) — a knowledge-registry-only-grounded answer would
                    # silently lose its citations and incorrectly fail the governance
                    # gate's citation-count requirement.
                    if retrieved_docs:
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
                'ai_models_available': False,
                'grounding_status': grounding_status,
                'grounding_reason': grounding_reason,
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
            'source': 'hybrid_cdss_ai_llm',
            'grounding_status': grounding_status,
            'grounding_reason': grounding_reason,
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
        self.ensure_ai_initialized()

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
