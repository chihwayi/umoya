"""
ICD-10 Code Mapper
Maps diagnoses to ICD-10 codes for standardized coding
"""

from typing import Dict, Optional, List
import logging

logger = logging.getLogger(__name__)


class Icd10Mapper:
    """Maps clinical diagnoses to ICD-10 codes"""
    
    # Comprehensive ICD-10 diagnosis mapping
    DIAGNOSIS_TO_ICD10 = {
        # Infectious Diseases
        'Viral Upper Respiratory Infection': 'J06.9',
        'Bacterial Pneumonia': 'J15.9',
        'Urinary Tract Infection': 'N39.0',
        'COVID-19': 'U07.1',
        'Influenza': 'J11.1',
        'Sepsis': 'A41.9',
        'Acute Bronchitis': 'J20.9',
        'Pneumonia': 'J18.9',
        'Gastroenteritis': 'A09',
        
        # Respiratory
        'Asthma Exacerbation': 'J45.901',
        'COPD Exacerbation': 'J44.1',
        'Post-nasal Drip': 'R09.81',
        'Upper Respiratory Tract Infection': 'J06.9',
        
        # Cardiovascular
        'Heart Failure': 'I50.9',
        'Acute Coronary Syndrome': 'I21.9',
        'Hypertension': 'I10',
        'Arrhythmia': 'I49.9',
        'Pulmonary Embolism': 'I26.99',
        'Pericarditis': 'I30.9',
        
        # Neurological
        'Tension Headache': 'G44.209',
        'Migraine': 'G43.909',
        'Meningitis': 'G03.9',
        'Stroke/TIA': 'I64',
        'Benign Paroxysmal Positional Vertigo': 'H81.1',
        
        # Gastrointestinal
        'GERD/Reflux': 'K21.9',
        'GERD': 'K21.9',
        'Peptic Ulcer Disease': 'K27.9',
        'Appendicitis': 'K35.80',
        'Gallstones/Cholecystitis': 'K80.20',
        'Constipation': 'K59.00',
        'Irritable Bowel Syndrome': 'K58.9',
        
        # Mental Health
        'Anxiety/Panic Attack': 'F41.9',
        'Anxiety': 'F41.9',
        'Medication Overuse Headache': 'G44.41',
        
        # Other
        'Sinusitis': 'J32.9',
        'Orthostatic Hypotension': 'I95.1',
        'Medication Side Effect': 'T50.901A',
        'Anemia': 'D64.9',
        'Musculoskeletal Pain': 'M79.3',
        'Musculoskeletal Chest Pain': 'M79.3',
    }
    
    # Symptom to ICD-10 mapping (for chief complaints)
    SYMPTOM_TO_ICD10 = {
        'fever': 'R50.9',
        'cough': 'R05.9',
        'chest_pain': 'R06.02',
        'shortness_of_breath': 'R06.02',
        'abdominal_pain': 'R10.9',
        'headache': 'R51.9',
        'dizziness': 'R42',
        'nausea': 'R11.0',
        'vomiting': 'R11.2',
    }
    
    def __init__(self):
        """Initialize ICD-10 mapper"""
        logger.info("ICD-10 Mapper initialized")
    
    def get_icd10_code(self, diagnosis: str) -> Optional[str]:
        """
        Get ICD-10 code for a diagnosis
        
        Args:
            diagnosis: Diagnosis name
            
        Returns:
            ICD-10 code or None if not found
        """
        # Direct lookup
        code = self.DIAGNOSIS_TO_ICD10.get(diagnosis)
        if code:
            return code
        
        # Fuzzy matching (case-insensitive)
        diagnosis_lower = diagnosis.lower()
        for diag, code in self.DIAGNOSIS_TO_ICD10.items():
            if diag.lower() in diagnosis_lower or diagnosis_lower in diag.lower():
                return code
        
        # Partial matching
        for diag, code in self.DIAGNOSIS_TO_ICD10.items():
            diag_words = set(diag.lower().split())
            diag_input_words = set(diagnosis_lower.split())
            if len(diag_words.intersection(diag_input_words)) >= 2:
                return code
        
        logger.debug(f"No ICD-10 code found for diagnosis: {diagnosis}")
        return None
    
    def get_icd10_for_symptom(self, symptom: str) -> Optional[str]:
        """
        Get ICD-10 code for a symptom/chief complaint
        
        Args:
            symptom: Symptom name
            
        Returns:
            ICD-10 code or None if not found
        """
        symptom_lower = symptom.lower().strip()
        
        # Direct lookup
        code = self.SYMPTOM_TO_ICD10.get(symptom_lower)
        if code:
            return code
        
        # Check if symptom contains any mapped symptom keywords
        for mapped_symptom, code in self.SYMPTOM_TO_ICD10.items():
            if mapped_symptom in symptom_lower:
                return code
        
        return None
    
    def get_icd10_codes_batch(self, diagnoses: List[str]) -> Dict[str, Optional[str]]:
        """
        Get ICD-10 codes for multiple diagnoses
        
        Args:
            diagnoses: List of diagnosis names
            
        Returns:
            Dictionary mapping diagnosis to ICD-10 code
        """
        return {diag: self.get_icd10_code(diag) for diag in diagnoses}
    
    def get_code_description(self, code: str) -> Optional[str]:
        """
        Get description for an ICD-10 code (simplified - in production, use full ICD-10 database)
        
        Args:
            code: ICD-10 code
            
        Returns:
            Code description or None
        """
        # Reverse lookup
        for diag, icd_code in self.DIAGNOSIS_TO_ICD10.items():
            if icd_code == code:
                return diag
        
        return None


