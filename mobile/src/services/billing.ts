import { api } from './api';

export interface ApiLineItem {
  description: string;
  amount: number;
  quantity?: number;
  unitPrice?: number;
}

export interface ApiBill {
  id: string;
  billNumber?: string;
  patientId: string;
  description?: string;
  serviceDate?: string;
  dueDate?: string;
  totalAmount: number;
  paidAmount?: number;
  balance?: number;
  status: 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  items?: ApiLineItem[];
  insurerName?: string;
  medicalAidClaim?: number;
  currency?: string;
  payments?: ApiPayment[];
}

export interface ApiPayment {
  id: string;
  billId: string;
  amount: number;
  method: 'ecocash' | 'onemoney' | 'card' | 'bank' | 'cash' | 'medical_aid';
  status: 'pending' | 'completed' | 'failed';
  transactionId?: string;
  paidAt?: string;
}

export const BillingService = {
  forPatient: (patientId: string) =>
    api.get<ApiBill[]>(`/billing/bills?patientId=${patientId}`).then(r => r.data),

  all: (query: Record<string, string> = {}) => {
    const qs = new URLSearchParams(query).toString();
    return api.get<ApiBill[]>(`/billing/bills${qs ? '?' + qs : ''}`).then(r => r.data);
  },

  addPayment: (billId: string, dto: { amount: number; method: string; phone?: string }) =>
    api.post<ApiPayment>(`/billing/bills/${billId}/payments`, dto).then(r => r.data),
};
