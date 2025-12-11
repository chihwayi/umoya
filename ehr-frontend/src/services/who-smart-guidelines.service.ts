/**
 * WHO Smart Guidelines Service
 * 
 * Service for interacting with WHO Smart Guidelines API
 */

import { ehrAxios } from './api';

export interface GuidelineRecommendation {
  id: string;
  title: string;
  description: string;
  priority: 'routine' | 'urgent' | 'asap' | 'stat';
  conditions?: string[];
  actions?: string[];
  source: 'who_smart_guidelines';
  fhirResourceId?: string;
}

export interface SmartForm {
  id: string;
  title: string;
  description?: string;
  items: FormItem[];
  source: 'who_smart_guidelines';
  fhirResourceId?: string;
}

export interface FormItem {
  linkId: string;
  text: string;
  type: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  items?: FormItem[];
  enableWhen?: {
    question: string;
    operator: string;
    value: any;
  }[];
}

export interface GuidelineInfo {
  id: string;
  title: string;
  description?: string;
}

class WhoSmartGuidelinesService {
  private baseUrl = '/who-smart-guidelines';

  /**
   * List available WHO Smart Guidelines
   */
  async listGuidelines(token: string, tenantSlug: string): Promise<GuidelineInfo[]> {
    const response = await ehrAxios.get(`${this.baseUrl}/guidelines`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant-Slug': tenantSlug,
      },
    });
    return response.data.guidelines || [];
  }

  /**
   * Get recommendations for a condition
   */
  async getRecommendations(
    condition: string,
    patientData?: {
      age?: number;
      gender?: string;
      vitals?: Record<string, any>;
      labs?: Record<string, any>;
      conditions?: string[];
      medications?: string[];
    },
    token?: string,
    tenantSlug?: string
  ): Promise<GuidelineRecommendation[]> {
    const response = await ehrAxios.post(
      `${this.baseUrl}/guidelines/recommendations`,
      {
        condition,
        patientData,
      },
      {
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined,
          'X-Tenant-Slug': tenantSlug || undefined,
        },
      }
    );
    return response.data.recommendations || [];
  }

  /**
   * List available Smart Forms
   */
  async listSmartForms(token: string, tenantSlug: string): Promise<GuidelineInfo[]> {
    const response = await ehrAxios.get(`${this.baseUrl}/forms`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant-Slug': tenantSlug,
      },
    });
    return response.data.forms || [];
  }

  /**
   * Get Smart Form by ID
   */
  async getSmartForm(
    formId: string,
    token: string,
    tenantSlug: string
  ): Promise<SmartForm | null> {
    try {
      const response = await ehrAxios.get(`${this.baseUrl}/forms/${formId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Slug': tenantSlug,
        },
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Reload WHO Smart Guidelines
   */
  async reloadGuidelines(token: string, tenantSlug: string): Promise<void> {
    await ehrAxios.post(
      `${this.baseUrl}/reload`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Slug': tenantSlug,
        },
      }
    );
  }
}

export const whoSmartGuidelinesService = new WhoSmartGuidelinesService();
