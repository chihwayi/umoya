import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { Dhis2Service } from './dhis2.service';
import { TenantDhis2Config, TenantService } from './tenant.service';

interface TenantSyncExecutionOptions {
  retryLimit: number;
  alertLookbackHours: number;
  alertErrorThreshold: number;
  alertWebhookUrl: string;
}

@Injectable()
export class Dhis2SchedulerService {
  private readonly logger = new Logger(Dhis2SchedulerService.name);
  private readonly enabled = String(process.env.DHIS2_SCHEDULED_SYNC_ENABLED || 'false').toLowerCase() === 'true';
  private readonly retryLimit = Math.min(
    Math.max(Number(process.env.DHIS2_SCHEDULED_RETRY_LIMIT || 20), 1),
    200,
  );
  private readonly alertLookbackHours = Math.min(
    Math.max(Number(process.env.DHIS2_ALERT_LOOKBACK_HOURS || 24), 1),
    720,
  );
  private readonly alertErrorThreshold = Math.min(
    Math.max(Number(process.env.DHIS2_ALERT_ERROR_THRESHOLD || 10), 1),
    10000,
  );
  private readonly alertWebhookUrl = String(process.env.DHIS2_ALERT_WEBHOOK_URL || '').trim();

  constructor(
    private readonly tenantService: TenantService,
    private readonly dhis2Service: Dhis2Service,
  ) {}

  private clamp(value: number, min: number, max: number, fallback: number): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }
    return Math.min(Math.max(numeric, min), max);
  }

  private resolveTenantSyncOptions(config: TenantDhis2Config): TenantSyncExecutionOptions {
    const retryLimit = this.clamp(config.scheduledRetryLimit ?? this.retryLimit, 1, 200, this.retryLimit);
    const alertLookbackHours = this.clamp(
      config.alertLookbackHours ?? this.alertLookbackHours,
      1,
      720,
      this.alertLookbackHours,
    );
    const alertErrorThreshold = this.clamp(
      config.alertErrorThreshold ?? this.alertErrorThreshold,
      1,
      10000,
      this.alertErrorThreshold,
    );
    const alertWebhookUrl =
      typeof config.alertWebhookUrl === 'string' && config.alertWebhookUrl.trim().length > 0
        ? config.alertWebhookUrl.trim()
        : this.alertWebhookUrl;

    return {
      retryLimit,
      alertLookbackHours,
      alertErrorThreshold,
      alertWebhookUrl,
    };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async runHourlyTenantSync() {
    if (!this.enabled) {
      this.logger.debug('Scheduled DHIS2 tenant sync is globally disabled.');
      return;
    }

    this.logger.log('Starting scheduled DHIS2 tenant sync cycle');
    const tenants = await this.tenantService.getAllActiveTenants();

    let completed = 0;
    let failed = 0;
    let skipped = 0;
    for (const tenant of tenants) {
      try {
        const tenantConfig = await this.tenantService.getTenantDhis2Config(tenant.id);
        if (!tenantConfig) {
          skipped += 1;
          this.logger.debug(`Skipping tenant ${tenant.id}; DHIS2 config is not set.`);
          continue;
        }

        if (!tenantConfig.enabled) {
          skipped += 1;
          this.logger.debug(`Skipping tenant ${tenant.id}; DHIS2 integration is disabled.`);
          continue;
        }

        if (!tenantConfig.scheduledSyncEnabled) {
          skipped += 1;
          this.logger.debug(`Skipping tenant ${tenant.id}; scheduled DHIS2 sync is disabled in tenant config.`);
          continue;
        }

        const tenantDb = await this.tenantService.getTenantDatabase(tenant.id);
        if (!tenantDb) {
          this.logger.warn(`Skipping tenant ${tenant.id}; database connection unavailable.`);
          failed += 1;
          continue;
        }

        const syncOptions = this.resolveTenantSyncOptions(tenantConfig);
        await this.runTenantCycle(tenant.id, tenantDb, syncOptions);
        completed += 1;
      } catch (error: any) {
        failed += 1;
        this.logger.error(`Scheduled DHIS2 sync failed for tenant ${tenant.id}: ${error?.message || error}`);
      }
    }

    this.logger.log(
      `Scheduled DHIS2 tenant sync completed. successful=${completed}, failed=${failed}, skipped=${skipped}, total=${tenants.length}`,
    );
  }

  private async runTenantCycle(
    tenantId: string,
    tenantDb: DataSource,
    options: TenantSyncExecutionOptions,
  ): Promise<void> {
    const patientResult = await this.dhis2Service.syncPatients(tenantDb, tenantId);
    const aggregateResult = await this.dhis2Service.sendAggregateReport({}, tenantDb, tenantId);
    const retryResult = await this.dhis2Service.retryFailedSync(tenantDb, tenantId, {
      limit: options.retryLimit,
    });
    const recentErrors = await this.dhis2Service.getRecentErrorCount(tenantDb, options.alertLookbackHours);

    this.logger.log(
      `Tenant ${tenantId} DHIS2 cycle: patients=${patientResult.status}, aggregate=${aggregateResult.status}, retries attempted=${retryResult.attempted}, retries failed=${retryResult.failed}, recentErrors=${recentErrors}`,
    );

    if (recentErrors >= options.alertErrorThreshold) {
      const alertPayload = {
        source: 'ehr-service.dhis2-scheduler',
        tenantId,
        severity: 'warning',
        type: 'dhis2_sync_error_threshold_exceeded',
        lookbackHours: options.alertLookbackHours,
        threshold: options.alertErrorThreshold,
        recentErrors,
        timestamp: new Date().toISOString(),
      };

      this.logger.warn(
        `DHIS2 alert threshold exceeded for tenant ${tenantId}: recentErrors=${recentErrors}, threshold=${options.alertErrorThreshold}`,
      );
      await this.sendAlertWebhook(options.alertWebhookUrl, alertPayload);
    }
  }

  private async sendAlertWebhook(webhookUrl: string, payload: Record<string, any>): Promise<void> {
    if (!webhookUrl) {
      return;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this.logger.warn(
          `DHIS2 alert webhook returned ${response.status} ${response.statusText} for url ${webhookUrl}`,
        );
      }
    } catch (error: any) {
      this.logger.warn(`Failed to send DHIS2 alert webhook: ${error?.message || error}`);
    }
  }
}
