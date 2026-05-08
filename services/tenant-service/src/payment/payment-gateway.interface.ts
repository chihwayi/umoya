export interface InitiatePaymentOptions {
  tenantId: string;
  clinicName: string;
  contactEmail: string;
  contactPhone: string;
  amountUsd: number;
  monthsToExtend: number;
  reference: string;
  callbackUrl: string;
}

export interface InitiatePaymentResult {
  paymentUrl?: string;
  instruction?: string;
  providerReference: string;
}

export interface IPaymentGateway {
  readonly providerName: string;
  initiatePayment(options: InitiatePaymentOptions): Promise<InitiatePaymentResult>;
  verifyWebhook(rawBody: Buffer, signature: string): boolean;
  extractReference(payload: any): string | null;
}
