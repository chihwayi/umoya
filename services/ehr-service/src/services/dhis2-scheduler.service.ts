import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { Dhis2Service } from './dhis2.service';
import { TenantService } from './tenant.service';

@Injectable()
export class Dhis2SchedulerService {
  private readonly logger = new Logger(Dhis2SchedulerService.name);
  private readonly enabled = String(process.env.DHIS2_SCHEDULED_SYNC_ENABLED || 'false').toLowerCase() === 'true';
  private readonly retryLimit = Math.min(
    Math.max(Number(process.env.DHIS2_SCHEDULED_RETRY_LIMIT || 20), 1),
    200,
  );

  constructor(
    private readonly tenantService: TenantService,
    private readonly dhis2Service: Dhis2Service,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async runHourlyTenantSync() {
    if (!this.enabled) {
      return;
    }

    this.logger.log('Starting scheduled DHIS2 tenant sync cycle');
    const tenants = await this.tenantService.getAllActiveTenants();

    let completed = 0;
    let failed = 0;
    for (const tenant of tenants) {
      try {
        const tenantDb = await this.tenantService.getTenantDatabase(tenant.id);
        if (!tenantDb) {
          this.logger.warn(`Skipping tenant ${tenant.id}; database connection unavailable.`);
          failed += 1;
          continue;
        }

        await this.runTenantCycle(tenant.id, tenantDb);
        completed += 1;
      } catch (error: any) {
        failed += 1;
        this.logger.error(`Scheduled DHIS2 sync failed for tenant ${tenant.id}: ${error?.message || error}`);
      }
    }

    this.logger.log(
      `Scheduled DHIS2 tenant sync completed. successful=${completed}, failed=${failed}, total=${tenants.length}`,
    );
  }

  private async runTenantCycle(tenantId: string, tenantDb: DataSource): Promise<void> {
    const patientResult = await this.dhis2Service.syncPatients(tenantDb, tenantId);
    const aggregateResult = await this.dhis2Service.sendAggregateReport({}, tenantDb, tenantId);
    const retryResult = await this.dhis2Service.retryFailedSync(tenantDb, tenantId, {
      limit: this.retryLimit,
    });

    this.logger.log(
      `Tenant ${tenantId} DHIS2 cycle: patients=${patientResult.status}, aggregate=${aggregateResult.status}, retries attempted=${retryResult.attempted}, retries failed=${retryResult.failed}`,
    );
  }
}
