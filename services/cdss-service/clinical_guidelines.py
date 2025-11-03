"""
Clinical Guidelines Engine
Provides evidence-based clinical recommendations based on diagnosis, patient factors, and guidelines
"""
from typing import Dict, List, Optional, Any


class ClinicalGuidelinesEngine:
    """Clinical guidelines and protocol matching engine"""
    
    # Common clinical guidelines database
    GUIDELINES = {
        'hypertension': {
            'title': 'Hypertension Management Guidelines',
            'source': 'WHO/AHA 2023',
            'recommendations': [
                'Target BP <140/90 mmHg for adults <60 years',
                'Target BP <130/80 mmHg for adults with diabetes or CKD',
                'Lifestyle modifications: DASH diet, exercise, weight loss',
                'First-line: ACE inhibitor or ARB',
                'Monitor BP every 3-6 months if controlled'
            ],
            'contraindications': {
                'pregnancy': 'Avoid ACE inhibitors/ARBs - use methyldopa, labetalol',
                'renal_impairment': 'Adjust doses, monitor renal function',
                'hyperkalemia': 'Avoid ACE inhibitors/ARBs, potassium-sparing diuretics'
            }
        },
        'diabetes_type2': {
            'title': 'Type 2 Diabetes Management',
            'source': 'ADA 2024',
            'recommendations': [
                'Target HbA1c <7% for most patients',
                'Target HbA1c <6.5% if no CVD, newly diagnosed',
                'First-line: Metformin unless contraindicated',
                'SGLT2 inhibitors or GLP-1 agonists if CVD or CKD present',
                'Monitor: HbA1c q3-6mo, foot exam annually, eye exam annually'
            ],
            'contraindications': {
                'renal_impairment': 'Metformin contraindicated if eGFR <30',
                'heart_failure': 'Consider SGLT2 inhibitors',
                'weight_loss_needed': 'Consider GLP-1 agonists'
            }
        },
        'asthma': {
            'title': 'Asthma Management',
            'source': 'GINA 2024',
            'recommendations': [
                'Step 1: SABA as needed for mild intermittent',
                'Step 2: Low-dose ICS + SABA as needed',
                'Step 3: Low-dose ICS-LABA maintenance',
                'Avoid triggers: allergens, smoke, exercise',
                'Monitor PEFR, adjust therapy based on control'
            ],
            'contraindications': {
                'pregnancy': 'Prefer budesonide (safest ICS)',
                'osteoporosis': 'Monitor bone density with long-term ICS',
                'cataracts': 'Regular eye exams with ICS use'
            }
        },
        'copd': {
            'title': 'COPD Management',
            'source': 'GOLD 2024',
            'recommendations': [
                'Smoking cessation essential',
                'Bronchodilators: LAMA or LABA for maintenance',
                'ICS-LABA for frequent exacerbations',
                'Pulmonary rehabilitation',
                'Annual flu and pneumococcal vaccination'
            ],
            'contraindications': {
                'severe_cardiovascular_disease': 'Caution with beta-agonists',
                'narrow_angle_glaucoma': 'Caution with anticholinergics'
            }
        },
        'heart_failure': {
            'title': 'Heart Failure Management',
            'source': 'ACC/AHA 2022',
            'recommendations': [
                'ACE inhibitor/ARB + beta-blocker as foundation',
                'Add SGLT2 inhibitor (dapagliflozin/empagliflozin)',
                'Avoid NSAIDs - worsen heart failure',
                'Salt restriction <2g/day',
                'Monitor: BNP, EF, symptoms, weight'
            ],
            'contraindications': {
                'pregnancy': 'Avoid ACE inhibitors/ARBs',
                'hyperkalemia': 'Monitor K+ with RAAS inhibitors',
                'renal_impairment': 'Adjust doses, monitor closely'
            }
        },
        'pneumonia': {
            'title': 'Community-Acquired Pneumonia',
            'source': 'IDSA/ATS 2019',
            'recommendations': [
                'CURB-65 or PSI score for severity assessment',
                'Outpatient: Amoxicillin-clavulanate or azithromycin',
                'Inpatient: Ceftriaxone + azithromycin',
                'Duration: 5-7 days for typical, 7-10 days for atypical',
                'Reassess at 48-72 hours'
            ],
            'contraindications': {
                'penicillin_allergy': 'Use macrolide or fluoroquinolone',
                'pregnancy': 'Avoid tetracyclines, fluoroquinolones',
                'renal_impairment': 'Adjust antibiotic doses'
            }
        },
        'uti': {
            'title': 'Urinary Tract Infection',
            'source': 'IDSA 2022',
            'recommendations': [
                'Uncomplicated: Nitrofurantoin 5 days or trimethoprim-sulfa 3 days',
                'Pyelonephritis: Ciprofloxacin or ceftriaxone',
                'Recurrent: Prophylaxis or post-coital antibiotics',
                'Pregnancy: Nitrofurantoin or cephalexin (avoid TMP-SMX)'
            ],
            'contraindications': {
                'pregnancy': 'Avoid TMP-SMX, fluoroquinolones',
                'renal_impairment': 'Avoid nitrofurantoin if CrCl <60',
                'sulfa_allergy': 'Avoid TMP-SMX'
            }
        }
    }
    
    def normalize_condition(self, condition: str) -> str:
        """Normalize condition name for matching"""
        condition_lower = condition.lower().strip()
        
        # Map variations to standard names
        condition_map = {
            'htn': 'hypertension',
            'high blood pressure': 'hypertension',
            'bp': 'hypertension',
            'dm2': 'diabetes_type2',
            'type 2 diabetes': 'diabetes_type2',
            't2dm': 'diabetes_type2',
            'community acquired pneumonia': 'pneumonia',
            'cap': 'pneumonia',
            'urinary tract infection': 'uti',
            'cystitis': 'uti',
            'hf': 'heart_failure',
            'congestive heart failure': 'heart_failure',
            'chf': 'heart_failure'
        }
        
        if condition_lower in condition_map:
            return condition_map[condition_lower]
        
        # Try partial matching
        for key, value in condition_map.items():
            if key in condition_lower or condition_lower in key:
                return value
        
        # Return normalized version
        return condition_lower.replace(' ', '_')
    
    def check_guidelines(
        self,
        condition: str,
        patient_age: Optional[int] = None,
        patient_gender: Optional[str] = None,
        comorbidities: Optional[List[str]] = None,
        medications: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Check clinical guidelines for a condition
        
        Returns:
            guidelines: List of relevant guidelines
            recommendations: Action items
            contraindications: Things to avoid
            evidence_level: Quality of evidence
        """
        normalized_condition = self.normalize_condition(condition)
        
        # Find matching guideline
        guideline = self.GUIDELINES.get(normalized_condition)
        
        if not guideline:
            return {
                'guidelines': [],
                'recommendations': [
                    f'No specific guidelines found for "{condition}". Consult clinical references.'
                ],
                'contraindications': [],
                'evidence_level': 'unknown',
                'matched_condition': normalized_condition
            }
        
        # Build recommendations based on patient factors
        recommendations = guideline['recommendations'].copy()
        contraindications = []
        
        # Age-based adjustments
        if patient_age:
            if patient_age >= 65:
                recommendations.append('Consider age-related dose reductions')
                recommendations.append('Monitor for drug interactions (polypharmacy risk)')
            if patient_age < 18:
                recommendations.append('Pediatric dosing may differ - consult pediatric guidelines')
        
        # Gender-specific considerations
        if patient_gender and patient_gender.lower() in ['female', 'f']:
            if patient_age and 15 <= patient_age <= 50:
                recommendations.append('Consider pregnancy status before prescribing')
        
        # Comorbidity-based contraindications
        if comorbidities:
            for comorbidity in comorbidities:
                comorbidity_lower = comorbidity.lower()
                if comorbidity_lower in guideline.get('contraindications', {}):
                    contraindications.append({
                        'condition': comorbidity,
                        'reason': guideline['contraindications'][comorbidity_lower],
                        'severity': 'moderate'
                    })
        
        # Medication-based considerations
        medication_warnings = []
        if medications:
            meds_lower = [m.lower() for m in medications]
            
            # Check for common drug-condition interactions
            if 'warfarin' in meds_lower and normalized_condition == 'pneumonia':
                medication_warnings.append('Monitor INR closely - antibiotics may affect warfarin')
            if any('nsaid' in m or 'ibuprofen' in m or 'naproxen' in m for m in meds_lower):
                if normalized_condition == 'heart_failure':
                    contraindications.append({
                        'condition': 'NSAID use',
                        'reason': 'NSAIDs worsen heart failure - avoid',
                        'severity': 'major'
                    })
        
        return {
            'guidelines': [{
                'title': guideline['title'],
                'source': guideline['source'],
                'condition': normalized_condition
            }],
            'recommendations': recommendations,
            'contraindications': contraindications,
            'medication_warnings': medication_warnings,
            'evidence_level': 'high' if guideline.get('source', '').startswith('WHO') else 'moderate',
            'matched_condition': normalized_condition
        }
    
    def get_diagnosis_guidelines(self, diagnosis_code: Optional[str] = None, diagnosis_name: str = '') -> List[Dict[str, Any]]:
        """Get guidelines by ICD-10 code or diagnosis name"""
        # Simple implementation - can be expanded with ICD-10 code mapping
        condition = diagnosis_name or diagnosis_code or ''
        return self.check_guidelines(condition)

