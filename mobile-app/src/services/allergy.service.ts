import { ehrApi, API_ENDPOINTS } from '../config/api';

export interface Allergy {
  id?: string;
  patientId: string;
  allergen: string;
  reaction?: string;
  severity?: 'mild' | 'moderate' | 'severe';
  onsetDate?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

class AllergyService {
  /**
   * Get all allergies for a patient
   */
  async getPatientAllergies(patientId: string): Promise<Allergy[]> {
    try {
      const response = await ehrApi.get(API_ENDPOINTS.ALLERGIES.PATIENT(patientId));
      return Array.isArray(response) ? response : response.data || response.allergies || [];
    } catch (error) {
      console.error('Error fetching patient allergies:', error);
      return [];
    }
  }

  /**
   * Replace all allergies for a patient (used for updates)
   */
  async replacePatientAllergies(patientId: string, allergies: Allergy[]): Promise<Allergy[]> {
    try {
      const response = await ehrApi.put(API_ENDPOINTS.ALLERGIES.REPLACE(patientId), { allergies });
      return Array.isArray(response) ? response : response.data || response.allergies || [];
    } catch (error) {
      console.error('Error updating patient allergies:', error);
      throw error;
    }
  }

  /**
   * Add a new allergy to patient's allergy list
   */
  async addAllergy(patientId: string, allergy: Omit<Allergy, 'id' | 'patientId' | 'createdAt' | 'updatedAt'>): Promise<Allergy[]> {
    try {
      const currentAllergies = await this.getPatientAllergies(patientId);
      const newAllergy: Allergy = {
        ...allergy,
        patientId,
        id: `temp-${Date.now()}`,
      };
      const updatedAllergies = [...currentAllergies, newAllergy];
      return await this.replacePatientAllergies(patientId, updatedAllergies);
    } catch (error) {
      console.error('Error adding allergy:', error);
      throw error;
    }
  }

  /**
   * Update an existing allergy
   */
  async updateAllergy(patientId: string, allergyId: string, updates: Partial<Allergy>): Promise<Allergy[]> {
    try {
      const currentAllergies = await this.getPatientAllergies(patientId);
      const updatedAllergies = currentAllergies.map((a) =>
        a.id === allergyId ? { ...a, ...updates } : a
      );
      return await this.replacePatientAllergies(patientId, updatedAllergies);
    } catch (error) {
      console.error('Error updating allergy:', error);
      throw error;
    }
  }

  /**
   * Delete an allergy
   */
  async deleteAllergy(patientId: string, allergyId: string): Promise<Allergy[]> {
    try {
      const currentAllergies = await this.getPatientAllergies(patientId);
      const updatedAllergies = currentAllergies.filter((a) => a.id !== allergyId);
      return await this.replacePatientAllergies(patientId, updatedAllergies);
    } catch (error) {
      console.error('Error deleting allergy:', error);
      throw error;
    }
  }
}

export default new AllergyService();

