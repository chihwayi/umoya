"""
Bounded clinical-guideline fallback engine.

Canonical production guidance now lives in the governed clinical knowledge
registry (RAG + governed document search). This class is invoked by
ClinicalKnowledgeRegistry as the last-resort fallback ONLY when both the
governed registry search and RAG retrieval fail or return nothing (see
clinical_knowledge_registry.py:276) — a real, reachable code path, not dead
code. GUIDELINES intentionally covers only a handful of very common,
well-established primary-care conditions with conservative, non-dosing-
specific guidance (S268/F9) — this is a bounded safety net for an outage of
the primary systems, not a substitute for the governed knowledge registry.
Deliberately excludes precise dosing/titration (that risk profile belongs in
the governed, versioned registry, not a hardcoded last-resort fallback).
"""
from typing import Dict, List, Optional, Any


class ClinicalGuidelinesEngine:
    """Compatibility fallback and alias-normalization engine."""

    GUIDELINES: Dict[str, Dict[str, Any]] = {
        'hypertension': {
            'title': 'Hypertension — general management principles',
            'source': 'WHO HEARTS technical package (general primary-care guidance)',
            'recommendations': [
                'Confirm diagnosis with repeated blood pressure measurements on separate occasions before starting treatment',
                'Lifestyle modification (sodium reduction, physical activity, weight management, smoking cessation) for all patients',
                'Individualize target blood pressure and medication choice with the treating clinician',
                'Regular follow-up to reassess control and adjust management',
            ],
            'contraindications': {
                'pregnancy': 'ACE inhibitors and ARBs are contraindicated in pregnancy — verify current medication regimen',
                'renal_artery_stenosis': 'ACE inhibitors and ARBs require caution — risk of acute kidney injury',
            },
        },
        'diabetes_type2': {
            'title': 'Type 2 diabetes — general management principles',
            'source': 'WHO/general primary-care guidance',
            'recommendations': [
                'Confirm diagnosis per standard glycaemic criteria before initiating treatment',
                'Lifestyle modification (diet, physical activity, weight management) as first-line alongside pharmacotherapy',
                'Individualize glycaemic targets with the treating clinician based on comorbidities and hypoglycaemia risk',
                'Screen regularly for diabetes complications (retinopathy, nephropathy, neuropathy, cardiovascular risk)',
            ],
            'contraindications': {
                'renal_impairment': 'Metformin and some other agents require dose adjustment or avoidance in significant renal impairment',
            },
        },
        'pneumonia': {
            'title': 'Community-acquired pneumonia — general management principles',
            'source': 'WHO/general primary-care guidance',
            'recommendations': [
                'Assess severity (e.g. CURB-65 or local equivalent) to guide site-of-care decision (outpatient vs. admission)',
                'Empiric antibiotic choice should follow local antimicrobial guidelines and resistance patterns',
                'Reassess response to treatment within 48-72 hours',
                'Advise supportive care: hydration, antipyretics, and monitoring for deterioration',
            ],
            'contraindications': {},
        },
        'uti': {
            'title': 'Urinary tract infection — general management principles',
            'source': 'WHO/general primary-care guidance',
            'recommendations': [
                'Confirm diagnosis with symptoms plus urinalysis/culture where available before treating',
                'Empiric antibiotic choice should follow local antimicrobial guidelines and resistance patterns',
                'Advise adequate fluid intake',
                'Investigate for complicating factors (recurrent infection, structural abnormality, pregnancy) if symptoms persist or recur',
            ],
            'contraindications': {},
        },
        'heart_failure': {
            'title': 'Heart failure — general management principles',
            'source': 'WHO/general primary-care guidance',
            'recommendations': [
                'Confirm diagnosis (clinical assessment plus echocardiography where available) before initiating chronic therapy',
                'Guideline-directed medical therapy should be individualized with the treating clinician based on ejection fraction and comorbidities',
                'Advise sodium and fluid intake moderation as clinically appropriate',
                'Monitor weight and symptoms for early signs of decompensation',
            ],
            'contraindications': {
                'nsaid_use': 'NSAIDs can worsen heart failure and should generally be avoided',
            },
        },
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
