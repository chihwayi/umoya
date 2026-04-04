import { api } from './api';

export interface ApiLabResult {
  id: string;
  patientId: string;
  testName: string;
  testCode?: string;
  panel?: string;
  value?: string | number;
  unit?: string;
  referenceRange?: string;
  flag?: 'normal' | 'low' | 'high' | 'critical_low' | 'critical_high';
  resultDate?: string;
  orderedBy?: string;
  notes?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

export interface ApiLabOrder {
  id: string;
  patientId: string;
  orderedBy?: string;
  orderDate?: string;
  status: string;
  tests?: string[];
  results?: ApiLabResult[];
  aiInterpretation?: string;
}

export const LabOrdersService = {
  results: (patientId: string) =>
    api.get<ApiLabOrder[]>(`/lab-orders/patient/${patientId}/results`).then(r => r.data),

  forCurrentPatient: () =>
    api.get<ApiLabOrder[]>('/patient-portal/lab-results').then(r => r.data),

  pending: () =>
    api.get<ApiLabOrder[]>('/lab-orders/pending').then(r => r.data),
};
