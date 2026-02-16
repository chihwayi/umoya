"""
Terminology Service
Integrates with EHR terminology service for SNOMED CT and ICD-10 code lookup
Can also use local mappings as fallback
"""

from typing import Dict, Optional, List, Any
import logging
import httpx
import os

logger = logging.getLogger(__name__)

# Import local mappers
from .icd10_mapper import Icd10Mapper
from .snomed_mapper import SnomedMapper
from outbound_guard import assert_egress_allowed


class TerminologyService:
    """Service for terminology code mapping and lookup"""
    
    def __init__(self):
        """Initialize terminology service"""
        self.icd10_mapper = Icd10Mapper()
        self.snomed_mapper = SnomedMapper()
        self.ehr_service_url = os.getenv('EHR_SERVICE_URL', '').strip() or None
        if not self.ehr_service_url:
            logger.warning("EHR_SERVICE_URL not configured; remote terminology enrichment is disabled.")
            
        self.use_ehr_service = os.getenv('CDSS_USE_EHR_TERMINOLOGY', 'false').lower() == 'true'
        
        logger.info(f"Terminology Service initialized (EHR integration: {self.use_ehr_service})")
    
    async def get_icd10_code(
        self,
        diagnosis: str,
        use_ehr_service: bool = False
    ) -> Optional[str]:
        """
        Get ICD-10 code for a diagnosis
        
        Args:
            diagnosis: Diagnosis name
            use_ehr_service: Whether to query EHR service (requires auth)
            
        Returns:
            ICD-10 code or None
        """
        # Try local mapper first (fast, no network)
        code = self.icd10_mapper.get_icd10_code(diagnosis)
        if code:
            return code
        
        # Optionally query EHR service for more comprehensive lookup
        if use_ehr_service and self.use_ehr_service and self.ehr_service_url:
            try:
                endpoint = f"{self.ehr_service_url}/api/terminology/icd10/search"
                assert_egress_allowed(endpoint, purpose="terminology_icd10_lookup")
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.get(
                        endpoint,
                        params={'term': diagnosis, 'limit': 1},
                    )
                    if response.status_code == 200:
                        data = response.json()
                        if data.get('data') and len(data['data']) > 0:
                            return data['data'][0].get('code')
            except Exception as e:
                logger.debug(f"EHR service ICD-10 lookup failed: {e}")
        
        return None
    
    async def get_snomed_code(
        self,
        finding: str,
        use_ehr_service: bool = False
    ) -> Optional[str]:
        """
        Get SNOMED CT code for a finding/diagnosis
        
        Args:
            finding: Finding or diagnosis name
            use_ehr_service: Whether to query EHR service (requires auth)
            
        Returns:
            SNOMED CT concept ID or None
        """
        # Try local mapper first
        code = self.snomed_mapper.get_snomed_code(finding)
        if code:
            return code
        
        # Also try symptom mapping
        code = self.snomed_mapper.get_snomed_for_symptom(finding)
        if code:
            return code
        
        # Optionally query EHR service
        if use_ehr_service and self.use_ehr_service and self.ehr_service_url:
            try:
                endpoint = f"{self.ehr_service_url}/api/terminology/snomed/search"
                assert_egress_allowed(endpoint, purpose="terminology_snomed_lookup")
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.get(
                        endpoint,
                        params={'term': finding, 'limit': 1},
                    )
                    if response.status_code == 200:
                        data = response.json()
                        if data.get('data') and len(data['data']) > 0:
                            return data['data'][0].get('conceptId')
            except Exception as e:
                logger.debug(f"EHR service SNOMED lookup failed: {e}")
        
        return None
    
    def enrich_diagnosis_with_codes(self, diagnosis: Dict[str, Any]) -> Dict[str, Any]:
        """
        Enrich a diagnosis dictionary with ICD-10 and SNOMED CT codes
        
        Args:
            diagnosis: Diagnosis dictionary with at least 'diagnosis' key
            
        Returns:
            Enriched diagnosis dictionary
        """
        diag_name = diagnosis.get('diagnosis', '')
        if not diag_name:
            return diagnosis
        
        # Get codes (synchronous for now - can be async if needed)
        icd10_code = self.icd10_mapper.get_icd10_code(diag_name)
        snomed_code = self.snomed_mapper.get_snomed_code(diag_name)
        
        # Add codes to diagnosis
        enriched = {**diagnosis}
        if icd10_code:
            enriched['icd10'] = icd10_code
        if snomed_code:
            enriched['snomed'] = snomed_code
        
        return enriched
    
    def enrich_diagnoses_batch(self, diagnoses: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Enrich multiple diagnoses with codes
        
        Args:
            diagnoses: List of diagnosis dictionaries
            
        Returns:
            List of enriched diagnosis dictionaries
        """
        return [self.enrich_diagnosis_with_codes(diag) for diag in diagnoses]
