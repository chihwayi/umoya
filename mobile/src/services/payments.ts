import { api } from './api';

export interface MobileMoneyPaymentDto {
  billId: string;
  amount: number;
  phone: string;
  currency?: string;
}

export interface PaymentResult {
  transactionId: string;
  status: 'pending' | 'completed' | 'failed';
  message?: string;
  reference?: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  type: 'mobile_money' | 'card' | 'bank';
  available: boolean;
}

export const PaymentsService = {
  ecocash: (dto: MobileMoneyPaymentDto) =>
    api.post<PaymentResult>('/payments/ecocash', dto).then(r => r.data),

  onemoney: (dto: MobileMoneyPaymentDto) =>
    api.post<PaymentResult>('/payments/onemoney', dto).then(r => r.data),

  status: (transactionId: string) =>
    api.get<PaymentResult>(`/payments/status/${transactionId}`).then(r => r.data),

  methods: () =>
    api.get<PaymentMethod[]>('/payments/methods').then(r => r.data),
};
