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

interface AlertSinkConfig {
  type: 'generic' | 'slack' | 'pagerduty';
  webhookUrl: string;
  pagerDutyRoutingKey?: string;
}

export interface TenantSyncCycleResult {
  tenantId: string;
  patientStatus: string;
  aggregateStatus: string;
  retryAttempted: number;
  retryFailed: number;
  recentErrors: number;
  alertTriggered: boolean;
  alertSink: string | null;
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
  private readonly pagerDutyRoutingKey = String(process.env.DHIS2_PAGERDUTY_ROUTING_KEY || '').trim();

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

  private resolveAlertSink(rawWebhookUrl: string): AlertSinkConfig | null {
    const webhookUrl = String(rawWebhookUrl || '').trim();
    if (!webhookUrl) {
      return null;
    }

    if (webhookUrl.startsWith('pagerduty://')) {
      const pagerDutyRoutingKey = webhookUrl.replace('pagerduty://', '').trim();
      if (!pagerDutyRoutingKey) {
        return null;
      }
      return {
        type: 'pagerduty',
        webhookUrl: 'https://events.pagerduty.com/v2/enqueue',
        pagerDutyRoutingKey,
      };
    }

    if (webhookUrl.includes('hooks.slack.com')) {
      return {
        type: 'slack',
        webhookUrl,
      };
    }

    if (webhookUrl.includes('events.pagerduty.com')) {
      if (!this.pagerDutyRoutingKey) {
        this.logger.warn(
          'PagerDuty events endpoint configured but DHIS2_PAGERDUTY_ROUTING_KEY is missing; skipping alert delivery.',
        );
        return null;
      }
      return {
        type: 'pagerduty',
        webhookUrl,
        pagerDutyRoutingKey: this.pagerDutyRoutingKey,
      };
    }

    return {
      type: 'generic',
      webhookUrl,
    };
  }

  private buildSlackPayload(payload: Record<string, any>) {
    const tenantId = String(payload.tenantId || 'unknown');
    const recentErrors = Number(payload.recentErrors || 0);
    const threshold = Number(payload.threshold || 0);
    const lookbackHours = Number(payload.lookbackHours || 0);
    return {
      text: `DHIS2 sync alert for tenant ${tenantId}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*DHIS2 Sync Alert*\nTenant: \`${tenantId}\`\nRecent errors: *${recentErrors}* (threshold ${threshold}) in last ${lookbackHours}h`,
          },
        },
      ],
    };
  }

  private buildPagerDutyPayload(payload: Record<string, any>, routingKey: string) {
    const tenantId = String(payload.tenantId || 'unknown');
    return {
      routing_key: routingKey,
      event_action: 'trigger',
      dedup_key: `dhis2-sync-${tenantId}`,
      payload: {
        summary: `DHIS2 sync errors exceeded threshold for tenant ${tenantId}`,
        source: String(payload.source || 'ehr-service.dhis2-scheduler'),
        severity: String(payload.severity || 'warning'),
        timestamp: payload.timestamp || new Date().toISOString(),
        custom_details: payload,
      },
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
        await this.runTenantCycle(tenant.id, tenantDb, syncOptions, true);
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

  async runTenantSyncNow(
    tenantId: string,
    tenantDb?: DataSource | null,
    body?: { retryLimit?: number; includeAlerts?: boolean },
  ) {
    const tenantConfig = await this.tenantService.getTenantDhis2Config(tenantId);
    if (!tenantConfig) {
      return {
        status: 'NOT_CONFIGURED',
        message: `Tenant ${tenantId} has no DHIS2 configuration.`,
      };
    }

    if (!tenantConfig.enabled) {
      return {
        status: 'DISABLED',
        message: `Tenant ${tenantId} DHIS2 integration is disabled.`,
      };
    }

    const database = tenantDb || (await this.tenantService.getTenantDatabase(tenantId));
    if (!database) {
      return {
        status: 'FAILED',
        message: `Tenant ${tenantId} database connection is unavailable.`,
      };
    }

    const syncOptions = this.resolveTenantSyncOptions(tenantConfig);
    if (body?.retryLimit !== undefined) {
      syncOptions.retryLimit = this.clamp(body.retryLimit, 1, 200, syncOptions.retryLimit);
    }

    const includeAlerts = body?.includeAlerts !== false;
    const result = await this.runTenantCycle(tenantId, database, syncOptions, includeAlerts);
    return {
      status: 'SUCCESS',
      message: `Tenant ${tenantId} DHIS2 sync cycle completed.`,
      result,
    };
  }

  private async runTenantCycle(
    tenantId: string,
    tenantDb: DataSource,
    options: TenantSyncExecutionOptions,
    includeAlerts: boolean,
  ): Promise<TenantSyncCycleResult> {
    const patientResult = await this.dhis2Service.syncPatients(tenantDb, tenantId);
    const aggregateResult = await this.dhis2Service.sendAggregateReport({}, tenantDb, tenantId);
    const retryResult = await this.dhis2Service.retryFailedSync(tenantDb, tenantId, {
      limit: options.retryLimit,
    });
    const recentErrors = await this.dhis2Service.getRecentErrorCount(tenantDb, options.alertLookbackHours);

    this.logger.log(
      `Tenant ${tenantId} DHIS2 cycle: patients=${patientResult.status}, aggregate=${aggregateResult.status}, retries attempted=${retryResult.attempted}, retries failed=${retryResult.failed}, recentErrors=${recentErrors}`,
    );

    let alertTriggered = false;
    let alertSink: string | null = null;
    if (includeAlerts && recentErrors >= options.alertErrorThreshold) {
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
      const sink = await this.sendAlertWebhook(options.alertWebhookUrl, alertPayload);
      alertTriggered = sink !== null;
      alertSink = sink;
    }

    return {
      tenantId,
      patientStatus: String(patientResult?.status || 'UNKNOWN'),
      aggregateStatus: String(aggregateResult?.status || 'UNKNOWN'),
      retryAttempted: Number(retryResult?.attempted || 0),
      retryFailed: Number(retryResult?.failed || 0),
      recentErrors: Number(recentErrors || 0),
      alertTriggered,
      alertSink,
    };
  }

  private async sendAlertWebhook(webhookUrl: string, payload: Record<string, any>): Promise<string | null> {
    const sink = this.resolveAlertSink(webhookUrl);
    if (!sink) {
      return null;
    }

    let requestBody: Record<string, any> = payload;
    if (sink.type === 'slack') {
      requestBody = this.buildSlackPayload(payload);
    } else if (sink.type === 'pagerduty') {
      if (!sink.pagerDutyRoutingKey) {
        return null;
      }
      requestBody = this.buildPagerDutyPayload(payload, sink.pagerDutyRoutingKey);
    }

    try {
      const response = await fetch(sink.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        this.logger.warn(
          `DHIS2 alert ${sink.type} sink returned ${response.status} ${response.statusText} for url ${sink.webhookUrl}`,
        );
        return null;
      }
      return sink.type;
    } catch (error: any) {
      this.logger.warn(`Failed to send DHIS2 alert (${sink.type}) webhook: ${error?.message || error}`);
      return null;
    }
  }
}
