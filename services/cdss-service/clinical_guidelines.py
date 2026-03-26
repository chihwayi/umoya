"""
Bounded clinical-guideline fallback engine.

Canonical production guidance now lives in the governed clinical knowledge
registry. This class remains only as a compatibility fallback for uncovered
conditions and for condition-alias normalization.
"""
from typing import Dict, List, Optional, Any


class ClinicalGuidelinesEngine:
    """Compatibility fallback and alias-normalization engine."""

    GUIDELINES: Dict[str, Dict[str, Any]] = {}
    
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
