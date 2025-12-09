import { ehrApi, API_ENDPOINTS } from '../config/api';

export interface Drug {
  id: string;
  genericName: string;
  brandNames?: string[];
  atcCode?: string;
  drugClass?: string;
  activeIngredients?: string[];
  dosageForms?: string[];
  routeOfAdministration?: string[];
  description?: string;
  strength?: string;
  unit?: string;
  rxnormCode?: string;
  snomedCode?: string;
  ndcCode?: string;
}

class DrugService {
  /**
   * Search drugs by name (generic or brand)
   * Matches EHR implementation: GET /drugs?search=...
   */
  async searchDrugs(query: string): Promise<Drug[]> {
    try {
      if (!query || query.trim().length < 2) {
        return [];
      }
      
      // Match EHR: GET /drugs?search=...
      // Backend returns Drug[] directly, ehrApi.get returns response.data
      const response = await ehrApi.get(`${API_ENDPOINTS.DRUG.SEARCH}?search=${encodeURIComponent(query.trim())}`);
      
      console.log(`🔍 [DrugService] Raw response type:`, typeof response, Array.isArray(response));
      console.log(`🔍 [DrugService] Raw response:`, JSON.stringify(response, null, 2));
      
      // Backend findAll returns Drug[] directly, ehrApi.get returns response.data
      // So response should already be the array
      let drugs: Drug[] = [];
      
      if (Array.isArray(response)) {
        // Direct array response
        drugs = response;
      } else if (response && typeof response === 'object') {
        // Try nested data property
        if (Array.isArray(response.data)) {
          drugs = response.data;
        } else if (Array.isArray(response.drugs)) {
          drugs = response.drugs;
        } else if (Array.isArray(response.results)) {
          drugs = response.results;
        } else {
          // If response is an object but not an array, log it
          console.warn('⚠️ [DrugService] Unexpected response format:', response);
        }
      }
      
      // Ensure it's an array
      if (!Array.isArray(drugs)) {
        console.warn('⚠️ [DrugService] Response is not an array, converting:', drugs);
        drugs = [];
      }
      
      console.log(`✅ [DrugService] Found ${drugs.length} drugs for query: "${query}"`);
      if (drugs.length > 0) {
        console.log(`📋 [DrugService] First drug:`, JSON.stringify(drugs[0], null, 2));
      } else {
        console.log(`⚠️ [DrugService] No drugs found for query: "${query}"`);
      }
      
      return drugs;
    } catch (error: any) {
      console.error('❌ [DrugService] Error searching drugs:', error);
      console.error('❌ [DrugService] Error details:', {
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
   * Get drug by ID
   */
  async getDrugById(drugId: string): Promise<Drug | null> {
    try {
      const response = await ehrApi.get(API_ENDPOINTS.DRUG.BY_ID(drugId));
      return response.data || response;
    } catch (error: any) {
      console.error('Error getting drug:', error);
      return null;
    }
  }

  /**
   * Check drug interactions
   */
  async checkInteractions(drugIds: string[]): Promise<any[]> {
    try {
      const response = await ehrApi.post(API_ENDPOINTS.DRUG.CHECK_INTERACTIONS, { drugIds });
      return response.interactions || response.data || [];
    } catch (error: any) {
      console.error('Error checking interactions:', error);
      return [];
    }
  }
}

export default new DrugService();
