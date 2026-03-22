import { api } from './api';

export interface ApiPatientProfile {
  id: string;
  mrn?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  bloodType?: string;
  height?: number;  // cm
  weight?: number;  // kg
  phone?: string;
  email?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
}

export interface ApiCondition {
  id?: string;
  name?: string;
  diagnosisName?: string;
  icdCode?: string;
  icd10Code?: string;
  diagnosisDate?: string;
  onsetDate?: string;
  status?: string;
  severity?: 'mild' | 'moderate' | 'severe';
  resolvedAt?: string;
}

export interface ApiAllergy {
  id?: string;
  substance?: string;
  allergen?: string;
  reaction?: string;
  reactions?: string[];
  severity?: 'mild' | 'moderate' | 'severe' | 'life-threatening';
}

export const PatientProfileService = {
  /** Get the authenticated patient's full profile (via patient portal) */
  getProfile: () =>
    api.get<ApiPatientProfile>('/patient-portal/profile').then(r => r.data),

  /** Get patient demographics by ID (staff endpoint) */
  getById: (patientId: string) =>
    api.get<ApiPatientProfile>(`/patients/${patientId}`).then(r => r.data),

  /** Get medical history / active conditions */
  getConditions: (patientId: string) =>
    api.get<ApiCondition[]>(`/patients/${patientId}/history/medical`).then(r => r.data),

  /** Get allergies */
  getAllergies: (patientId: string) =>
    api.get<ApiAllergy[]>(`/allergies/patient/${patientId}`).then(r => r.data),
};
