import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TenantService } from '../services/tenant.service';
import { UhcAnalyticsService } from './uhc-analytics.service';

@Injectable()
export class UhcAnalyticsScheduler {
  private readonly logger = new Logger(UhcAnalyticsScheduler.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly uhcService: UhcAnalyticsService,
  ) {}

  @Cron(process.env.UHC_ANALYTICS_CRON || '0 0 1 1,4,7,10 *')
  async computeQuarterlyIndicators() {
    const disabled = String(process.env.UHC_ANALYTICS_SCHEDULER_ENABLED ?? 'true').toLowerCase() === 'false';
    if (disabled) {
      return;
    }
    const tenants = await this.tenantService.getAllActiveTenants();
    const now = new Date();
    const year = now.getFullYear();
    const quarter = Math.ceil((now.getMonth() + 1) / 3);
    for (const t of tenants) {
      try {
        await this.uhcService.computeIndicators(t.id, year, quarter);
      } catch (e: any) {
        this.logger.warn(`UHC quarterly compute failed for tenant ${t.id}: ${e?.message || e}`);
      }
    }
  }
}
