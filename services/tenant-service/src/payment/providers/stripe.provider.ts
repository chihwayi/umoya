import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { IPaymentGateway, InitiatePaymentOptions, InitiatePaymentResult } from '../payment-gateway.interface';

@Injectable()
export class StripeProvider implements IPaymentGateway {
  private readonly logger = new Logger(StripeProvider.name);
  readonly providerName = 'stripe';

  private readonly secretKey = process.env.STRIPE_SECRET_KEY ?? '';
  private readonly webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';

  async initiatePayment(options: InitiatePaymentOptions): Promise<InitiatePaymentResult> {
    const params = new URLSearchParams({
      'payment_method_types[]': 'card',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][unit_amount]': String(Math.round(options.amountUsd * 100)),
      'line_items[0][price_data][product_data][name]': `Umoya Subscription — ${options.clinicName}`,
      'line_items[0][price_data][product_data][description]': `${options.monthsToExtend} month(s) renewal`,
      'line_items[0][quantity]': '1',
      mode: 'payment',
      success_url: `${options.callbackUrl}?session_id={CHECKOUT_SESSION_ID}&ref=${options.reference}`,
      cancel_url: options.callbackUrl,
      'metadata[reference]': options.reference,
      'metadata[tenantId]': options.tenantId,
      'customer_email': options.contactEmail,
    });

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Stripe session failed: ${res.status} ${text}`);
      throw new Error(`Stripe error: ${res.status}`);
    }

    const session = await res.json() as any;
    return {
      paymentUrl: session.url,
      providerReference: session.id,
    };
  }

  verifyWebhook(rawBody: Buffer, signature: string): boolean {
    if (!this.webhookSecret || !signature) return false;
    try {
      // Stripe signature format: t=timestamp,v1=hash
      const parts = signature.split(',');
      const t = parts.find((p) => p.startsWith('t='))?.slice(2);
      const v1 = parts.find((p) => p.startsWith('v1='))?.slice(3);
      if (!t || !v1) return false;
      const payload = `${t}.${rawBody.toString()}`;
      const expected = crypto.createHmac('sha256', this.webhookSecret).update(payload).digest('hex');
      return expected === v1;
    } catch {
      return false;
    }
  }

  extractReference(payload: any): string | null {
    return (
      payload?.data?.object?.metadata?.reference ??
      payload?.data?.object?.client_reference_id ??
      null
    );
  }
}
