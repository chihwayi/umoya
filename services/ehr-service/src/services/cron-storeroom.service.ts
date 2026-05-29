import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StoreroomService } from './storeroom.service';
import { TenantService } from './tenant.service';

@Injectable()
export class CronStoreroomService {
  private readonly logger = new Logger(CronStoreroomService.name);

  constructor(
    private readonly storeroomService: StoreroomService,
    @Optional() @Inject(TenantService) private readonly tenantService: TenantService,
  ) {}

  @Cron('0 */1 * * *')
  async expireStaleReservations(): Promise<void> {
    if (!this.tenantService) {
      this.logger.warn('TenantService not injected — skipping stale reservation expiry');
      return;
    }
    const tenants = await this.tenantService.getAllActiveTenants();
    for (const tenant of tenants) {
      try {
        const db = await this.tenantService.getTenantDatabase(tenant.subdomain);
        if (!db) continue;
        const expired = await this.storeroomService.expireStaleReservations(db);
        if (expired > 0) {
          this.logger.log(`${tenant.subdomain}: expired ${expired} stale stock reservation(s)`);
        }
      } catch (err: any) {
        this.logger.error(`Stale reservation expiry failed for ${tenant.subdomain}: ${err.message}`);
      }
    }
  }

  @Cron('0 6 * * 1')
  async autoGeneratePurchaseOrders(): Promise<void> {
    if (!this.tenantService) {
      this.logger.warn('TenantService not injected — skipping auto-PO generation');
      return;
    }
    const tenants = await this.tenantService.getAllActiveTenants();
    for (const tenant of tenants) {
      try {
        const db = await this.tenantService.getTenantDatabase(tenant.subdomain);
        if (!db) continue;
        const count = await this.storeroomService.autoGeneratePOs(db);
        if (count > 0) {
          this.logger.log(`${tenant.subdomain}: auto-generated ${count} purchase order(s)`);
        }
      } catch (err: any) {
        this.logger.error(`Auto-PO generation failed for ${tenant.subdomain}: ${err.message}`);
      }
    }
  }
}
