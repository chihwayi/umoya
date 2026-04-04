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

export interface ApiBillQuote {
  billId: string;
  quoteStatus: string;
  totalCharge: number;
  estimatedPayerAmount: number;
  estimatedPatientResponsibility: number;
  copayAmount: number;
  deductibleRemaining: number;
  quoteConfidence: string;
  blockers: Array<{ code?: string; message?: string } | string>;
  recommendedNextStep: string;
}

export const BillingService = {
  forPatient: (patientId: string) =>
    api.get<ApiBill[]>(`/billing/bills?patientId=${patientId}`).then(r => r.data),

  forCurrentPatient: () =>
    api.get<any[]>('/patient-portal/bills').then(r =>
      (r.data ?? []).map((bill: any) => ({
        id: bill.id,
        billNumber: bill.billNumber,
        patientId: bill.patientId ?? '',
        description: bill.description ?? bill.billNumber ?? 'Invoice',
        serviceDate: bill.billDate ?? bill.serviceDate,
        dueDate: bill.dueDate,
        totalAmount: Number(bill.totalAmount ?? 0),
        paidAmount: Number(bill.paidAmount ?? 0),
        balance: Number(bill.balance ?? bill.totalAmount ?? 0),
        status: bill.status,
        items: Array.isArray(bill.items) ? bill.items : [],
        insurerName: bill.insurerName,
        medicalAidClaim: bill.medicalAidClaim,
        currency: bill.currency,
        payments: bill.payments,
      } as ApiBill)),
    ),

  all: (query: Record<string, string> = {}) => {
    const qs = new URLSearchParams(query).toString();
    return api.get<ApiBill[]>(`/billing/bills${qs ? '?' + qs : ''}`).then(r => r.data);
  },

  getQuote: (billId: string) =>
    api.get<ApiBillQuote>(`/patient-portal/bills/${billId}/quote`).then(r => r.data),

  addPayment: (billId: string, dto: { amount: number; method: string; phone?: string }) =>
    api.post<ApiPayment>(`/billing/bills/${billId}/payments`, dto).then(r => r.data),
};
