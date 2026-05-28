import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PatientRiskScoringService } from './patient-risk-scoring.service';
import { TenantService } from './tenant.service';

@Injectable()
export class CronRiskSweepService {
  private readonly logger = new Logger(CronRiskSweepService.name);

  constructor(
    private readonly riskScoring: PatientRiskScoringService,
    @Optional() @Inject(TenantService) private readonly tenantService: TenantService,
  ) {}

  // Runs at 02:00 UTC daily
  @Cron('0 2 * * *')
  async runDailySweep(): Promise<void> {
    if (!this.tenantService) {
      this.logger.warn('TenantService not injected — skipping nightly risk sweep');
      return;
    }
    this.logger.log('Starting nightly risk scoring sweep');
    const tenants = await this.tenantService.getAllActiveTenants();
    for (const tenant of tenants) {
      try {
        const db = await this.tenantService.getTenantDatabase(tenant.subdomain);
        if (!db) continue;
        const { scored, alerts } = await this.riskScoring.runNightlySweep(db, tenant.subdomain);
        this.logger.log(`Tenant ${tenant.subdomain}: ${scored} scored, ${alerts} alerts`);
      } catch (err: any) {
        this.logger.error(`Sweep failed for tenant ${tenant.subdomain}: ${err.message}`);
      }
    }
  }
}
