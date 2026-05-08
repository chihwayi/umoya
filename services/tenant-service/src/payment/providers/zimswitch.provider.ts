import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { IPaymentGateway, InitiatePaymentOptions, InitiatePaymentResult } from '../payment-gateway.interface';

@Injectable()
export class ZimSwitchProvider implements IPaymentGateway {
  private readonly logger = new Logger(ZimSwitchProvider.name);
  readonly providerName = 'zimswitch';

  private readonly merchantId = process.env.ZIMSWITCH_MERCHANT_ID ?? '';
  private readonly apiKey = process.env.ZIMSWITCH_API_KEY ?? '';
  private readonly endpoint = process.env.ZIMSWITCH_ENDPOINT ?? 'https://api.zimswitch.co.zw/v1';

  async initiatePayment(options: InitiatePaymentOptions): Promise<InitiatePaymentResult> {
    const timestamp = Date.now().toString();
    const signature = crypto
      .createHmac('sha256', this.apiKey)
      .update(`${this.merchantId}${options.reference}${options.amountUsd}${timestamp}`)
      .digest('hex');

    const payload = {
      merchantId: this.merchantId,
      reference: options.reference,
      amount: options.amountUsd,
      currency: 'USD',
      customerPhone: options.contactPhone,
      customerEmail: options.contactEmail,
      description: `MediCore ${options.monthsToExtend}mo subscription — ${options.clinicName}`,
      callbackUrl: options.callbackUrl,
      timestamp,
      signature,
    };

    const res = await fetch(`${this.endpoint}/payments/initiate`, {
      method: 'POST',
      headers: {
        'X-Merchant-ID': this.merchantId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`ZimSwitch initiate failed: ${res.status} ${text}`);
      throw new Error(`ZimSwitch error: ${res.status}`);
    }

    const data = await res.json() as any;
    return {
      paymentUrl: data.paymentUrl ?? data.redirectUrl,
      providerReference: data.transactionId ?? options.reference,
    };
  }

  verifyWebhook(rawBody: Buffer, signature: string): boolean {
    if (!this.apiKey) return false;
    const expected = crypto.createHmac('sha256', this.apiKey).update(rawBody).digest('hex');
    return expected === signature;
  }

  extractReference(payload: any): string | null {
    return payload?.reference ?? payload?.merchantReference ?? null;
  }
}
