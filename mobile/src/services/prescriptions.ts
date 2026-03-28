import { api } from './api';

export interface ApiPrescription {
  id: string;
  patientId: string;
  drugName: string;
  genericName?: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  duration?: string;
  quantity?: number;
  refills?: number;
  instructions?: string;
  prescribedBy?: string;
  prescribedDate?: string;
  status?: 'active' | 'completed' | 'cancelled' | 'dispensed';
  dispensedDate?: string;
  sideEffects?: string[];
  contraindications?: string[];
}

export const PrescriptionsService = {
  forPatient: (patientId: string) =>
    api.get<ApiPrescription[]>(`/prescriptions/patient/${patientId}`).then(r => r.data),

  create: (dto: Partial<ApiPrescription>) =>
    api.post<ApiPrescription>('/prescriptions', dto).then(r => r.data),
};
