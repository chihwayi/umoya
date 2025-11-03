"""
Diagnostic Assistant
Provides differential diagnosis suggestions based on symptoms, vitals, and patient demographics
Uses pattern matching and clinical decision rules
"""
from typing import Dict, List, Optional, Any, Tuple
from collections import Counter
import re


class DiagnosticAssistant:
    """Symptom-based diagnostic suggestion engine"""
    
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
            if any(word in symptom_text for word in ['headache', 'head', 'pain']):
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
        
        return {
            'suggested_diagnoses': [
                {
                    'diagnosis': d['diagnosis'],
                    'probability': round(d['probability'], 3),
                    'confidence': confidence_scores.get(d['diagnosis'], 'low'),
                    'matching_symptoms': list(set(d['matching_symptoms']))
                }
                for d in suggested_diagnoses
            ],
            'confidence_scores': confidence_scores,
            'recommended_tests': recommended_tests,
            'red_flags': red_flags,
            'vitals_clues': vitals_clues
        }

