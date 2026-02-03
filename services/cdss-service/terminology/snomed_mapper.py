"""
SNOMED CT Code Mapper
Maps symptoms, findings, and diagnoses to SNOMED CT codes
"""

from typing import Dict, Optional, List
import logging

logger = logging.getLogger(__name__)


class SnomedMapper:
    """Maps clinical findings to SNOMED CT codes"""
    
    # Symptom/Finding to SNOMED CT mapping
    SYMPTOM_TO_SNOMED = {
        'fever': '386661006',  # Fever (finding)
        'cough': '49727002',  # Cough (finding)
        'chest_pain': '29857009',  # Chest pain (finding)
        'shortness_of_breath': '267036007',  # Dyspnea (finding)
        'abdominal_pain': '21522001',  # Abdominal pain (finding)
        'headache': '25064002',  # Headache (finding)
        'dizziness': '404640003',  # Dizziness (finding)
        'nausea': '422587007',  # Nausea (finding)
        'vomiting': '422400008',  # Vomiting (finding)
        'fatigue': '84229001',  # Fatigue (finding)
        'chills': '43724002',  # Chills (finding)
        'sputum': '36541005',  # Sputum finding (finding)
        'hemoptysis': '396339007',  # Hemoptysis (finding)
        'photophobia': '247354009',  # Photophobia (finding)
        'neck_stiffness': '271807003',  # Neck stiffness (finding)
        'syncope': '271594007',  # Syncope (finding)
        'tachypnea': '271825005',  # Tachypnea (finding)
        'hypoxia': '404224003',  # Hypoxia (finding)
        'tachycardia': '3424008',  # Tachycardia (finding)
        'hypotension': '38341003',  # Hypotension (finding)
    }
    
    # Diagnosis to SNOMED CT mapping
    DIAGNOSIS_TO_SNOMED = {
        'Viral Upper Respiratory Infection': '54150009',  # Upper respiratory tract infection (disorder)
        'Bacterial Pneumonia': '233604007',  # Pneumonia (disorder)
        'Urinary Tract Infection': '68566005',  # Urinary tract infection (disorder)
        'COVID-19': '840539006',  # COVID-19 (disorder)
        'Influenza': '6142004',  # Influenza (disorder)
        'Sepsis': '91302008',  # Sepsis (disorder)
        'Acute Bronchitis': '32398004',  # Acute bronchitis (disorder)
        'Pneumonia': '233604007',  # Pneumonia (disorder)
        'Asthma Exacerbation': '195967001',  # Asthma (disorder)
        'COPD Exacerbation': '13645005',  # Chronic obstructive pulmonary disease (disorder)
        'Heart Failure': '84114007',  # Heart failure (disorder)
        'Acute Coronary Syndrome': '57054005',  # Acute coronary syndrome (disorder)
        'Hypertension': '38341003',  # Hypertension (disorder)
        'Tension Headache': '37796009',  # Tension headache (disorder)
        'Migraine': '37796009',  # Migraine (disorder) - Note: May need more specific code
        'Meningitis': '7180009',  # Meningitis (disorder)
        'Stroke/TIA': '230690007',  # Cerebrovascular accident (disorder)
        'GERD/Reflux': '235595009',  # Gastroesophageal reflux disease (disorder)
        'GERD': '235595009',  # Gastroesophageal reflux disease (disorder)
        'Peptic Ulcer Disease': '64766004',  # Peptic ulcer disease (disorder)
        'Appendicitis': '8186001',  # Appendicitis (disorder)
        'Gastroenteritis': '235595009',  # Gastroenteritis (disorder)
        'Anxiety': '48694002',  # Anxiety disorder (disorder)
        'Anxiety/Panic Attack': '48694002',  # Anxiety disorder (disorder)
        'Sinusitis': '36971009',  # Sinusitis (disorder)
        'Anemia': '271737000',  # Anemia (disorder)
    }
    
    def __init__(self):
        """Initialize SNOMED CT mapper"""
        logger.info("SNOMED CT Mapper initialized")
    
    def get_snomed_code(self, diagnosis: str) -> Optional[str]:
        """
        Get SNOMED CT code for a diagnosis
        
        Args:
            diagnosis: Diagnosis name
            
        Returns:
            SNOMED CT concept ID or None if not found
        """
        # Direct lookup
        code = self.DIAGNOSIS_TO_SNOMED.get(diagnosis)
        if code:
            return code
        
        # Fuzzy matching (case-insensitive)
        diagnosis_lower = diagnosis.lower()
        for diag, code in self.DIAGNOSIS_TO_SNOMED.items():
            if diag.lower() in diagnosis_lower or diagnosis_lower in diag.lower():
                return code
        
        logger.debug(f"No SNOMED CT code found for diagnosis: {diagnosis}")
        return None
    
    def get_snomed_for_symptom(self, symptom: str) -> Optional[str]:
        """
        Get SNOMED CT code for a symptom/finding
        
        Args:
            symptom: Symptom name
            
        Returns:
            SNOMED CT concept ID or None if not found
        """
        symptom_lower = symptom.lower().strip()
        
        # Direct lookup
        code = self.SYMPTOM_TO_SNOMED.get(symptom_lower)
        if code:
            return code
        
        # Check if symptom contains any mapped symptom keywords
        for mapped_symptom, code in self.SYMPTOM_TO_SNOMED.items():
            if mapped_symptom in symptom_lower:
                return code
        
        return None
    
    def get_snomed_codes_batch(self, items: List[str], item_type: str = 'diagnosis') -> Dict[str, Optional[str]]:
        """
        Get SNOMED CT codes for multiple items
        
        Args:
            items: List of diagnosis or symptom names
            item_type: 'diagnosis' or 'symptom'
            
        Returns:
            Dictionary mapping item to SNOMED CT code
        """
        if item_type == 'diagnosis':
            return {item: self.get_snomed_code(item) for item in items}
        else:
            return {item: self.get_snomed_for_symptom(item) for item in items}


