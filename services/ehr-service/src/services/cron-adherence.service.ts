import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AdherenceEngineService } from './adherence-engine.service';
import { TenantService } from './tenant.service';

@Injectable()
export class CronAdherenceService {
  private readonly logger = new Logger(CronAdherenceService.name);

  constructor(
    private readonly adherence: AdherenceEngineService,
    @Optional() @Inject(TenantService) private readonly tenantService: TenantService,
  ) {}

  @Cron('0 8 * * *')
  async runDailySweep(): Promise<void> {
    if (!this.tenantService) {
      this.logger.warn('TenantService not injected — skipping daily adherence sweep');
      return;
    }
    this.logger.log('Starting daily adherence sweep');
    const tenants = await this.tenantService.getAllActiveTenants();
    for (const tenant of tenants) {
      try {
        const db = await this.tenantService.getTenantDatabase(tenant.subdomain);
        if (!db) continue;
        const { scored, nudgesSent } = await this.adherence.runDailySweep(db, tenant.subdomain);
        this.logger.log(`${tenant.subdomain}: ${scored} scored, ${nudgesSent} nudges sent`);
      } catch (err: any) {
        this.logger.error(`Adherence sweep failed for ${tenant.subdomain}: ${err.message}`);
      }
    }
  }
}
