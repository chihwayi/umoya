import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { IPaymentGateway, InitiatePaymentOptions, InitiatePaymentResult } from '../payment-gateway.interface';

@Injectable()
export class FlutterwaveProvider implements IPaymentGateway {
  private readonly logger = new Logger(FlutterwaveProvider.name);
  readonly providerName = 'flutterwave';

  private readonly secretKey = process.env.FLW_SECRET_KEY ?? '';
  private readonly webhookSecret = process.env.FLW_WEBHOOK_SECRET ?? '';

  async initiatePayment(options: InitiatePaymentOptions): Promise<InitiatePaymentResult> {
    const payload = {
      tx_ref: options.reference,
      amount: options.amountUsd,
      currency: 'USD',
      redirect_url: options.callbackUrl,
      customer: {
        email: options.contactEmail,
        phonenumber: options.contactPhone,
        name: options.clinicName,
      },
      customizations: {
        title: `Umoya Subscription — ${options.clinicName}`,
        description: `${options.monthsToExtend} month(s) subscription renewal`,
      },
    };

    const res = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Flutterwave initiate failed: ${res.status} ${text}`);
      throw new Error(`Flutterwave error: ${res.status}`);
    }

    const data = await res.json() as any;
    return {
      paymentUrl: data.data?.link,
      providerReference: options.reference,
    };
  }

  verifyWebhook(rawBody: Buffer, signature: string): boolean {
    if (!this.webhookSecret) return false;
    const hash = crypto.createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    return hash === signature;
  }

  extractReference(payload: any): string | null {
    return payload?.data?.tx_ref ?? payload?.txRef ?? null;
  }
}
