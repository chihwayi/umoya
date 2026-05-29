import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../entities/tenant.entity';
import { PaymentGatewayFactory } from './payment-gateway.factory';
import { SmsService } from '../services/sms.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly gatewayFactory: PaymentGatewayFactory,
    private readonly smsService: SmsService,
  ) {}

  async initiatePayment(tenantId: string, monthsToExtend: number, amountUsd: number) {
    const gateway = this.gatewayFactory.getProvider();
    if (!gateway) {
      return { ok: false, message: 'No payment provider configured' };
    }

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new Error('Tenant not found');

    const reference = `MC-${tenantId.slice(0, 8).toUpperCase()}-${Date.now()}`;
    const callbackUrl = `${process.env.SERVICE_TENANT_URL ?? 'http://localhost:3001'}/payment-webhook`;

    const result = await gateway.initiatePayment({
      tenantId,
      clinicName: tenant.clinicName,
      contactEmail: tenant.contactEmail,
      contactPhone: tenant.contactPhone,
      amountUsd,
      monthsToExtend,
      reference,
      callbackUrl,
    });

    // Record pending transaction
    await this.tenantRepo.query(
      `INSERT INTO payment_transactions
         (tenant_id, provider, reference, amount_usd, months_to_extend, status, initiated_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
       ON CONFLICT (reference) DO NOTHING`,
      [tenantId, gateway.providerName, reference, amountUsd, monthsToExtend],
    );

    // SMS the payment link if available
    if (result.paymentUrl && tenant.contactPhone) {
      await this.smsService.send(
        tenant.contactPhone,
        `Umoya: Complete your ${monthsToExtend}-month subscription renewal for ${tenant.clinicName}. Pay here: ${result.paymentUrl}`,
      );
    } else if (result.instruction && tenant.contactPhone) {
      await this.smsService.send(tenant.contactPhone, `Umoya: ${result.instruction}`);
    }

    return { ok: true, reference, ...result };
  }

  async handleWebhook(rawBody: Buffer, signature: string, providerHint?: string): Promise<{ handled: boolean }> {
    const gateway = this.gatewayFactory.getProvider();
    if (!gateway) return { handled: false };

    if (!gateway.verifyWebhook(rawBody, signature)) {
      this.logger.warn(`Webhook signature verification failed for provider ${gateway.providerName}`);
      return { handled: false };
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString());
    } catch {
      return { handled: false };
    }

    const reference = gateway.extractReference(payload);
    if (!reference) {
      this.logger.warn('Could not extract reference from webhook payload');
      return { handled: false };
    }

    // Look up pending transaction
    const rows = await this.tenantRepo.query(
      `SELECT * FROM payment_transactions WHERE reference = $1 AND status = 'pending' LIMIT 1`,
      [reference],
    );
    if (!rows || rows.length === 0) {
      this.logger.warn(`No pending transaction found for reference ${reference}`);
      return { handled: true }; // Already processed or unknown — swallow
    }

    const txn = rows[0];

    // Mark transaction complete
    await this.tenantRepo.query(
      `UPDATE payment_transactions SET status = 'completed', completed_at = NOW(), raw_payload = $1 WHERE reference = $2`,
      [JSON.stringify(payload), reference],
    );

    // Extend billing using existing logic
    const tenant = await this.tenantRepo.findOne({ where: { id: txn.tenant_id } });
    if (!tenant) return { handled: true };

    const currentBase =
      tenant.billingEndsAt && new Date(tenant.billingEndsAt as any) > new Date()
        ? new Date(tenant.billingEndsAt as any)
        : new Date();
    const newBillingEndsAt = new Date(currentBase);
    newBillingEndsAt.setMonth(newBillingEndsAt.getMonth() + Number(txn.months_to_extend));

    await this.tenantRepo.update(tenant.id, {
      billingEndsAt: newBillingEndsAt,
      subscriptionMode: 'paid' as any,
      ...(tenant.status === 'suspended' && tenant.subscriptionState !== 'demo'
        ? { status: 'active' as any }
        : {}),
    });

    this.logger.log(`Payment confirmed for ${tenant.subdomain} — billing extended to ${newBillingEndsAt.toISOString()}`);

    // SMS confirmation
    if (tenant.contactPhone) {
      await this.smsService.send(
        tenant.contactPhone,
        `Umoya: Payment received for ${tenant.clinicName}. Subscription extended by ${txn.months_to_extend} month(s) until ${newBillingEndsAt.toDateString()}. Thank you.`,
      );
    }

    return { handled: true };
  }
}
