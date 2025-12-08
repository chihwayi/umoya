import { ehrApi, API_ENDPOINTS } from '../config/api';

export interface Problem {
  id?: string;
  patientId: string;
  code?: string;
  codeSystem?: string;
  snomedConceptId?: string;
  snomedTerm?: string;
  description: string;
  status: 'active' | 'resolved';
  onsetDate?: string;
  resolvedDate?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

class ProblemService {
  /**
   * Get all problems for a patient
   */
  async getPatientProblems(patientId: string): Promise<Problem[]> {
    try {
      const response = await ehrApi.get(API_ENDPOINTS.PROBLEMS.PATIENT(patientId));
      return Array.isArray(response) ? response : response.data || response.problems || [];
    } catch (error) {
      console.error('Error fetching patient problems:', error);
      return [];
    }
  }

  /**
   * Replace all problems for a patient (used for updates)
   */
  async replacePatientProblems(patientId: string, problems: Problem[]): Promise<Problem[]> {
    try {
      const response = await ehrApi.put(API_ENDPOINTS.PROBLEMS.REPLACE(patientId), { problems });
      return Array.isArray(response) ? response : response.data || response.problems || [];
    } catch (error) {
      console.error('Error updating patient problems:', error);
      throw error;
    }
  }

  /**
   * Add a new problem to patient's problem list
   */
  async addProblem(patientId: string, problem: Omit<Problem, 'id' | 'patientId' | 'createdAt' | 'updatedAt'>): Promise<Problem[]> {
    try {
      const currentProblems = await this.getPatientProblems(patientId);
      const newProblem: Problem = {
        ...problem,
        patientId,
        id: `temp-${Date.now()}`,
      };
      const updatedProblems = [...currentProblems, newProblem];
      return await this.replacePatientProblems(patientId, updatedProblems);
    } catch (error) {
      console.error('Error adding problem:', error);
      throw error;
    }
  }

  /**
   * Update an existing problem
   */
  async updateProblem(patientId: string, problemId: string, updates: Partial<Problem>): Promise<Problem[]> {
    try {
      const currentProblems = await this.getPatientProblems(patientId);
      const updatedProblems = currentProblems.map((p) =>
        p.id === problemId ? { ...p, ...updates } : p
      );
      return await this.replacePatientProblems(patientId, updatedProblems);
    } catch (error) {
      console.error('Error updating problem:', error);
      throw error;
    }
  }

  /**
   * Mark a problem as resolved
   */
  async resolveProblem(patientId: string, problemId: string): Promise<Problem[]> {
    return this.updateProblem(patientId, problemId, {
      status: 'resolved',
      resolvedDate: new Date().toISOString().split('T')[0],
    });
  }

  /**
   * Delete a problem
   */
  async deleteProblem(patientId: string, problemId: string): Promise<Problem[]> {
    try {
      const currentProblems = await this.getPatientProblems(patientId);
      const updatedProblems = currentProblems.filter((p) => p.id !== problemId);
      return await this.replacePatientProblems(patientId, updatedProblems);
    } catch (error) {
      console.error('Error deleting problem:', error);
      throw error;
    }
  }
}

export default new ProblemService();

