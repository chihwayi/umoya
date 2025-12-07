import { ehrApi } from '../config/api';

export interface Bill {
  id: string;
  patientId: string;
  amount: number;
  balance: number;
  currency: string;
  status: string;
  dueDate?: string;
  items?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}

export interface PaymentMethod {
  id: string;
  provider: string;
  name: string;
  currencies: string[];
  fees?: {
    percentage: number;
    minimum: number;
    maximum: number;
  };
}

export interface PaymentMethodsResponse {
  mobileMoney: PaymentMethod[];
  bankTransfer?: PaymentMethod[];
  card?: PaymentMethod[];
}

export interface MobileMoneyPaymentData {
  billId: string;
  amount: number;
  phoneNumber: string;
  provider: 'EcoCash' | 'OneMoney';
  currency: string;
}

export interface PaymentResult {
  transactionId: string;
  instructions: string;
  status: string;
}

export interface PaymentStatus {
  transactionId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  amount?: number;
  currency?: string;
  timestamp?: string;
  message?: string;
}

class BillingService {
  /**
   * Get bill by ID
   */
  async getBill(billId: string): Promise<Bill> {
    try {
      const response = await ehrApi.get(`/billing/bills/${billId}`);
      return response.data || response;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch bill');
    }
  }

  /**
   * Get patient bills
   */
  async getPatientBills(patientId: string, filters?: { status?: string }): Promise<Bill[]> {
    try {
      const params = filters || {};
      const response = await ehrApi.get(`/billing/bills`, { params: { patientId, ...params } });
      return response.data || response;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch bills');
    }
  }

  /**
   * Get available payment methods
   */
  async getPaymentMethods(): Promise<PaymentMethodsResponse> {
    try {
      const response = await ehrApi.get('/billing/payment-methods');
      return response.data || response;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch payment methods');
    }
  }

  /**
   * Process mobile money payment
   */
  async processMobileMoneyPayment(paymentData: MobileMoneyPaymentData): Promise<PaymentResult> {
    try {
      const response = await ehrApi.post('/billing/payments/mobile-money', paymentData);
      return response.data || response;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to process payment');
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(transactionId: string): Promise<PaymentStatus> {
    try {
      const response = await ehrApi.get(`/billing/payments/${transactionId}/status`);
      return response.data || response;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch payment status');
    }
  }

  /**
   * Get payment history for patient
   */
  async getPaymentHistory(patientId: string, filters?: { limit?: number; offset?: number }): Promise<any[]> {
    try {
      const params = filters || {};
      const response = await ehrApi.get(`/billing/payments/patient/${patientId}`, { params });
      return response.data || response;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch payment history');
    }
  }
}

export default new BillingService();
