import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MortalityRiskService } from './mortality-risk.service';
import { TenantService } from './tenant.service';

@Injectable()
export class CronMortalityService {
  private readonly logger = new Logger(CronMortalityService.name);

  constructor(
    private readonly mortality: MortalityRiskService,
    @Optional() @Inject(TenantService) private readonly tenantService: TenantService,
  ) {}

  @Cron('0 3 * * *')
  async runDailySweep(): Promise<void> {
    if (!this.tenantService) {
      this.logger.warn('TenantService not injected — skipping mortality sweep');
      return;
    }
    const tenants = await this.tenantService.getAllActiveTenants();
    for (const tenant of tenants) {
      try {
        const db = await this.tenantService.getTenantDatabase(tenant.subdomain);
        if (!db) continue;
        const { scored } = await this.mortality.runDailySweep(db, tenant.subdomain);
        this.logger.log(`${tenant.subdomain}: ${scored} mortality scores computed`);
      } catch (err: any) {
        this.logger.error(`Mortality sweep failed for ${tenant.subdomain}: ${err.message}`);
      }
    }
  }
}
