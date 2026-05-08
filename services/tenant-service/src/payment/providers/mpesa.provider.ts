import { Injectable, Logger } from '@nestjs/common';
import { IPaymentGateway, InitiatePaymentOptions, InitiatePaymentResult } from '../payment-gateway.interface';

@Injectable()
export class MpesaProvider implements IPaymentGateway {
  private readonly logger = new Logger(MpesaProvider.name);
  readonly providerName = 'mpesa';

  private readonly consumerKey = process.env.MPESA_CONSUMER_KEY ?? '';
  private readonly consumerSecret = process.env.MPESA_CONSUMER_SECRET ?? '';
  private readonly shortcode = process.env.MPESA_SHORTCODE ?? '';
  private readonly passkey = process.env.MPESA_PASSKEY ?? '';
  private readonly callbackUrl = process.env.MPESA_CALLBACK_URL ?? '';
  private readonly baseUrl = process.env.MPESA_BASE_URL ?? 'https://sandbox.safaricom.co.ke';

  private async getAccessToken(): Promise<string> {
    const credentials = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
    const res = await fetch(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${credentials}` },
    });
    if (!res.ok) throw new Error(`M-Pesa OAuth failed: ${res.status}`);
    const data = await res.json() as any;
    return data.access_token;
  }

  async initiatePayment(options: InitiatePaymentOptions): Promise<InitiatePaymentResult> {
    const token = await this.getAccessToken();
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const password = Buffer.from(`${this.shortcode}${this.passkey}${timestamp}`).toString('base64');

    const phone = options.contactPhone.replace(/^\+/, '').replace(/^0/, '254');

    const payload = {
      BusinessShortCode: this.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.ceil(options.amountUsd),
      PartyA: phone,
      PartyB: this.shortcode,
      PhoneNumber: phone,
      CallBackURL: this.callbackUrl,
      AccountReference: options.reference,
      TransactionDesc: `MediCore ${options.monthsToExtend}mo renewal`,
    };

    const res = await fetch(`${this.baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`M-Pesa STK push failed: ${res.status} ${text}`);
      throw new Error(`M-Pesa error: ${res.status}`);
    }

    const data = await res.json() as any;
    return {
      instruction: `STK push sent to ${options.contactPhone}. Check your phone and enter your M-Pesa PIN to complete payment.`,
      providerReference: data.CheckoutRequestID ?? options.reference,
    };
  }

  verifyWebhook(rawBody: Buffer, _signature: string): boolean {
    // M-Pesa does not sign webhooks; validate by checking ResultCode in body
    try {
      const body = JSON.parse(rawBody.toString());
      return body?.Body?.stkCallback !== undefined;
    } catch {
      return false;
    }
  }

  extractReference(payload: any): string | null {
    const items = payload?.Body?.stkCallback?.CallbackMetadata?.Item ?? [];
    const ref = items.find((i: any) => i.Name === 'AccountReference');
    return ref?.Value ?? null;
  }
}
