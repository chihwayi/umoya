import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Tenant } from '../entities/tenant.entity';
import { SmsService } from './sms.service';

@Injectable()
export class BillingEnforcerService {
  private readonly logger = new Logger(BillingEnforcerService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly smsService: SmsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async enforce(): Promise<void> {
    const now = new Date();
    await Promise.all([
      this.expireDemos(now),
      this.startGracePeriods(now),
      this.suspendExpiredGrace(now),
      this.autoDeleteSuspended(now),
      this.warnApproachingExpiry(now),
    ]);
  }

  // Demo tenants whose demoExpiresAt has passed -> suspend
  private async expireDemos(now: Date): Promise<void> {
    const expiredDemos = await this.tenantRepo.find({
      where: {
        subscriptionMode: 'demo',
        subscriptionState: 'demo' as any,
        demoExpiresAt: LessThan(now),
      },
    });

    for (const tenant of expiredDemos) {
      tenant.subscriptionState = 'suspended' as any;
      tenant.status = 'suspended' as any;
      await this.tenantRepo.save(tenant);
      if (tenant.contactPhone) {
        await this.smsService.send(
          tenant.contactPhone,
          `Umoya: Your demo account for ${tenant.clinicName} has expired and has been suspended. Contact us to activate a paid subscription.`,
        );
      }
      this.logger.log(`Demo expired -> suspended: ${tenant.subdomain}`);
    }
  }

  // Paid tenants whose billingEndsAt has passed -> move to grace period
  private async startGracePeriods(now: Date): Promise<void> {
    const lapsed = await this.tenantRepo.find({
      where: {
        subscriptionMode: 'paid',
        subscriptionState: 'active' as any,
        billingEndsAt: LessThan(now),
      },
    });

    for (const tenant of lapsed) {
      const graceDays = (tenant as any).gracePeriodDays ?? 5;
      const graceEndsAt = new Date(now.getTime() + graceDays * 24 * 60 * 60 * 1000);
      tenant.subscriptionState = 'grace' as any;
      tenant.graceEndsAt = graceEndsAt;
      await this.tenantRepo.save(tenant);
      if (tenant.contactPhone) {
        await this.smsService.send(
          tenant.contactPhone,
          `Umoya: Your subscription for ${tenant.clinicName} has lapsed. You have ${graceDays} days to make a payment before access is suspended. Contact your Umoya account manager to pay.`,
        );
      }
      this.logger.log(`Billing lapsed -> grace: ${tenant.subdomain}, grace ends ${graceEndsAt.toISOString()}`);
    }
  }

  // Tenants in grace whose graceEndsAt has passed -> suspend
  private async suspendExpiredGrace(now: Date): Promise<void> {
    const graceExpired = await this.tenantRepo.find({
      where: {
        subscriptionState: 'grace' as any,
        graceEndsAt: LessThan(now),
      },
    });

    for (const tenant of graceExpired) {
      const autoDeleteDays = 30;
      tenant.subscriptionState = 'suspended' as any;
      tenant.status = 'suspended' as any;
      tenant.autoDeleteAt = new Date(now.getTime() + autoDeleteDays * 24 * 60 * 60 * 1000);
      await this.tenantRepo.save(tenant);
      if (tenant.contactPhone) {
        await this.smsService.send(
          tenant.contactPhone,
          `Umoya: Access to ${tenant.clinicName} has been suspended due to non-payment. Contact your account manager urgently to restore access.`,
        );
      }
      this.logger.log(`Grace expired -> suspended: ${tenant.subdomain}`);
    }
  }

  private async warnApproachingExpiry(now: Date): Promise<void> {
    const warningDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const approaching = await this.tenantRepo.find({
      where: [
        { subscriptionMode: 'demo' as any, subscriptionState: 'demo' as any },
        { subscriptionMode: 'paid' as any, subscriptionState: 'active' as any },
      ],
    });

    for (const tenant of approaching) {
      const expiryDate =
        tenant.subscriptionMode === 'demo'
          ? (tenant as any).demoExpiresAt
          : tenant.billingEndsAt;

      if (!expiryDate) continue;

      const expiry = new Date(expiryDate);
      const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

      if (daysLeft === 7 && tenant.contactPhone) {
        await this.smsService.send(
          tenant.contactPhone,
          `Umoya: Your ${tenant.subscriptionMode === 'demo' ? 'demo' : 'subscription'} for ${tenant.clinicName} expires in 7 days (${expiry.toDateString()}). Please contact your account manager to renew.`,
        );
        this.logger.log(`7-day expiry warning sent to ${tenant.subdomain}`);
      }
    }
  }

  // Suspended tenants past autoDeleteAt -> mark deleted (soft delete only)
  private async autoDeleteSuspended(now: Date): Promise<void> {
    const toDelete = await this.tenantRepo.find({
      where: {
        subscriptionState: 'suspended' as any,
        autoDeleteAt: LessThan(now),
      },
    });

    for (const tenant of toDelete) {
      tenant.subscriptionState = 'expired' as any;
      tenant.status = 'inactive' as any;
      await this.tenantRepo.save(tenant);
      this.logger.warn(`Auto-deleted (soft): ${tenant.subdomain}`);
    }
  }
}
