import { ehrApi, API_ENDPOINTS } from '../config/api';

export interface SnomedConcept {
  conceptId: string;
  term: string;
  preferredTerm?: string;
  fullySpecifiedName?: string;
  moduleId?: string;
  definitionStatus?: string;
  semanticTag?: string;
}

export interface Icd10Code {
  code: string;
  description: string;
  category?: string;
  categoryDescription?: string;
  billable?: boolean;
  validForCoding?: boolean;
}

export interface Icd10Mapping {
  conceptId: string;
  targetCode: string;
  targetDisplay: string;
  mapGroup?: number;
  mapPriority?: number;
  mapRule?: string;
  mapAdvice?: string;
  mapStatus?: string;
  active?: boolean;
}

class TerminologyService {
  /**
   * Search SNOMED CT concepts
   */
  async searchSnomed(
    term: string,
    options?: {
      limit?: number;
      offset?: number;
      activeOnly?: boolean;
      semanticTags?: string[];
      ecl?: string;
      context?: 'condition' | 'symptom' | 'encounter' | 'procedure' | 'medication';
    }
  ): Promise<SnomedConcept[]> {
    try {
      if (!term || term.trim().length < 2) {
        return [];
      }

      const params: any = { term: encodeURIComponent(term.trim()) };
      if (options?.limit) params.limit = options.limit;
      if (options?.offset) params.offset = options.offset;
      if (options?.activeOnly !== undefined) params.activeOnly = options.activeOnly;
      if (options?.semanticTags) params.semanticTags = options.semanticTags.join(',');
      if (options?.ecl) params.ecl = options.ecl;
      if (options?.context) params.context = options.context;

      const queryString = new URLSearchParams(params).toString();
      const response = await ehrApi.get(`${API_ENDPOINTS.TERMINOLOGY.SNOMED_SEARCH}?${queryString}`);
      
      let concepts: SnomedConcept[] = [];
      
      if (Array.isArray(response)) {
        concepts = response;
      } else if (response && typeof response === 'object') {
        concepts = response.data || response.concepts || [];
      }
      
      // Deduplicate by conceptId
      const seen = new Set<string>();
      const uniqueConcepts = concepts.filter((concept) => {
        if (seen.has(concept.conceptId)) {
          return false;
        }
        seen.add(concept.conceptId);
        return true;
      });
      
      console.log(`🔍 [TerminologyService] Found ${uniqueConcepts.length} unique SNOMED concepts for: "${term}" (${concepts.length} total before deduplication)`);
      return uniqueConcepts;
    } catch (error: any) {
      console.error('❌ [TerminologyService] Error searching SNOMED:', error);
      console.error('❌ [TerminologyService] Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        url: error.config?.url,
      });
      return [];
    }
  }

  /**
   * Search ICD-10 codes
   */
  async searchIcd10(
    term: string,
    options?: {
      limit?: number;
      offset?: number;
      billable?: boolean;
    }
  ): Promise<Icd10Code[]> {
    try {
      if (!term || term.trim().length < 2) {
        return [];
      }

      if (!API_ENDPOINTS.TERMINOLOGY.ICD10_SEARCH) {
        console.error('❌ [TerminologyService] ICD10_SEARCH endpoint is undefined!');
        return [];
      }

      const params: any = { term: encodeURIComponent(term.trim()) };
      if (options?.limit) params.limit = options.limit;
      if (options?.offset) params.offset = options.offset;
      if (options?.billable !== undefined) params.billableOnly = options.billable ? 'true' : 'false';

      const queryString = new URLSearchParams(params).toString();
      const url = `${API_ENDPOINTS.TERMINOLOGY.ICD10_SEARCH}?${queryString}`;
      console.log(`🔍 [TerminologyService] Searching ICD-10: ${url}`);
      
      const response = await ehrApi.get(url);
      
      let codes: Icd10Code[] = [];
      
      if (Array.isArray(response)) {
        codes = response;
      } else if (response && typeof response === 'object') {
        // Backend returns { codes: [], total, limit, offset }
        codes = response.codes || response.data || [];
      }
      
      console.log(`✅ [TerminologyService] Found ${codes.length} ICD-10 codes for: "${term}"`);
      return codes;
    } catch (error: any) {
      console.error('❌ [TerminologyService] Error searching ICD-10:', error);
      console.error('❌ [TerminologyService] Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        url: error.config?.url,
        endpoint: API_ENDPOINTS.TERMINOLOGY.ICD10_SEARCH,
      });
      return [];
    }
  }

  /**
   * Get ICD-10 mappings from SNOMED concept
   */
  async getIcd10MappingsFromSnomed(
    snomedConceptId: string,
    options?: {
      primaryOnly?: boolean;
      includeInactive?: boolean;
      limit?: number;
    }
  ): Promise<Icd10Mapping[]> {
    try {
      const params: any = {};
      if (options?.primaryOnly !== undefined) params.primaryOnly = options.primaryOnly;
      if (options?.includeInactive !== undefined) params.includeInactive = options.includeInactive;
      if (options?.limit) params.limit = options.limit;

      const queryString = new URLSearchParams(params).toString();
      const url = `${API_ENDPOINTS.TERMINOLOGY.ICD10_MAP_FROM_SNOMED(snomedConceptId)}${queryString ? `?${queryString}` : ''}`;
      const response = await ehrApi.get(url);
      
      const mappings = Array.isArray(response) ? response : (response.data || response.mappings || []);
      console.log(`🔍 [TerminologyService] Found ${mappings.length} ICD-10 mappings for SNOMED: ${snomedConceptId}`);
      return mappings;
    } catch (error: any) {
      console.error('Error getting ICD-10 mappings:', error);
      // Return empty array on error (mapping tables may not be provisioned)
      return [];
    }
  }

  /**
   * Get ICD-10 code details
   */
  async getIcd10CodeDetails(code: string): Promise<Icd10Code | null> {
    try {
      const response = await ehrApi.get(API_ENDPOINTS.TERMINOLOGY.ICD10_CODE(code));
      return response.data || response;
    } catch (error: any) {
      console.error('Error getting ICD-10 code details:', error);
      return null;
    }
  }
}

export default new TerminologyService();
