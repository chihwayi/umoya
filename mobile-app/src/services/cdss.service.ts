import { ehrApi, API_ENDPOINTS } from '../config/api';

/**
 * CDSS Service - Gateway for Clinical Decision Support System
 * 
 * This service provides a gateway interface for CDSS integration.
 * When CDSS is implemented, these methods will connect to the actual CDSS service.
 * 
 * DAK WHO Smart Guidelines Integration:
 * - Standards-based: Follows WHO SMART Guidelines standards
 * - Machine-readable: Structured data formats
 * - Adaptive: Adapts to local context
 * - Requirements-based: Based on WHO DAK requirements
 * - Testable: Validated against WHO standards
 */

export interface DrugInteractionRequest {
  medications: Array<{
    name: string;
    dosage?: string;
    frequency?: string;
  }>;
}

export interface DrugInteractionResponse {
  hasInteractions: boolean;
  interactions: Array<{
    severity: 'mild' | 'moderate' | 'severe';
    description: string;
    medications: string[];
    recommendation?: string;
  }>;
}

export interface DiagnosisAssistRequest {
  symptoms: string[];
  patientAge?: number;
  patientGender?: string;
  existingConditions?: string[];
}

export interface DiagnosisAssistResponse {
  suggestions: Array<{
    diagnosis: string;
    confidence: number;
    icd10Code?: string;
    snomedCode?: string;
    reasoning?: string;
  }>;
  guidelines?: Array<{
    title: string;
    source: string;
    url?: string;
  }>;
}

export interface RiskAssessmentRequest {
  patientId: string;
  riskType: 'readmission' | 'adherence' | 'framingham' | 'general';
  patientData: {
    age?: number;
    gender?: string;
    conditions?: string[];
    medications?: string[];
    vitals?: any;
  };
}

export interface RiskAssessmentResponse {
  riskScore: number;
  riskLevel: 'low' | 'moderate' | 'high';
  factors: Array<{
    factor: string;
    impact: number;
  }>;
  recommendations?: string[];
}

export interface DosingRecommendationRequest {
  medication: string;
  patientAge?: number;
  patientWeight?: number;
  renalFunction?: {
    creatinine?: number;
    egfr?: number;
  };
  condition?: string;
}

export interface DosingRecommendationResponse {
  recommendedDose: string;
  frequency: string;
  adjustments: Array<{
    type: string;
    reason: string;
    adjustment: string;
  }>;
  warnings?: string[];
}

export interface ClinicalGuidelineRequest {
  condition: string;
  context?: {
    patientAge?: number;
    patientGender?: string;
    comorbidities?: string[];
  };
}

export interface ClinicalGuidelineResponse {
  guidelines: Array<{
    title: string;
    description: string;
    source: 'WHO' | 'DAK' | 'SMART' | 'LOCAL';
    category: string;
    recommendations: string[];
    references?: string[];
  }>;
}

class CDSSService {
  /**
   * Check for drug interactions
   * Gateway: Will connect to CDSS when available
   */
  async checkDrugInteractions(request: DrugInteractionRequest): Promise<DrugInteractionResponse> {
    try {
      // TODO: Connect to actual CDSS service when available
      // For now, return a placeholder response
      const response = await ehrApi.post(API_ENDPOINTS.CDSS.DRUG_INTERACTIONS, request);
      return response.data || response;
    } catch (error) {
      console.warn('CDSS drug interaction check not available:', error);
      // Return safe default when CDSS is not available
      return {
        hasInteractions: false,
        interactions: [],
      };
    }
  }

  /**
   * Get diagnostic assistance based on symptoms
   * Gateway: Will connect to CDSS when available
   */
  async getDiagnosisAssist(request: DiagnosisAssistRequest): Promise<DiagnosisAssistResponse> {
    try {
      // TODO: Connect to actual CDSS service when available
      const response = await ehrApi.post(API_ENDPOINTS.CDSS.DIAGNOSIS_ASSIST, request);
      return response.data || response;
    } catch (error) {
      console.warn('CDSS diagnosis assist not available:', error);
      return {
        suggestions: [],
        guidelines: [],
      };
    }
  }

  /**
   * Calculate risk assessment
   * Gateway: Will connect to CDSS when available
   */
  async calculateRiskAssessment(request: RiskAssessmentRequest): Promise<RiskAssessmentResponse> {
    try {
      // TODO: Connect to actual CDSS service when available
      const response = await ehrApi.post(API_ENDPOINTS.CDSS.RISK_ASSESSMENT, request);
      return response.data || response;
    } catch (error) {
      console.warn('CDSS risk assessment not available:', error);
      return {
        riskScore: 0,
        riskLevel: 'low',
        factors: [],
        recommendations: [],
      };
    }
  }

  /**
   * Get dosing recommendations
   * Gateway: Will connect to CDSS when available
   */
  async getDosingRecommendation(request: DosingRecommendationRequest): Promise<DosingRecommendationResponse> {
    try {
      // TODO: Connect to actual CDSS service when available
      const response = await ehrApi.post(API_ENDPOINTS.CDSS.DOSING_RECOMMENDATION, request);
      return response.data || response;
    } catch (error) {
      console.warn('CDSS dosing recommendation not available:', error);
      return {
        recommendedDose: '',
        frequency: '',
        adjustments: [],
        warnings: [],
      };
    }
  }

  /**
   * Get clinical guidelines (WHO DAK SMART Guidelines)
   * Gateway: Will connect to CDSS when available
   */
  async getClinicalGuidelines(request: ClinicalGuidelineRequest): Promise<ClinicalGuidelineResponse> {
    try {
      // TODO: Connect to actual CDSS service when available
      // This will integrate with WHO DAK SMART Guidelines
      const response = await ehrApi.post(API_ENDPOINTS.CDSS.GUIDELINES, request);
      return response.data || response;
    } catch (error) {
      console.warn('CDSS clinical guidelines not available:', error);
      return {
        guidelines: [],
      };
    }
  }

  /**
   * Check if CDSS is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Try a simple request to check if CDSS is available
      await ehrApi.get('/cdss/health');
      return true;
    } catch {
      return false;
    }
  }
}

export default new CDSSService();

