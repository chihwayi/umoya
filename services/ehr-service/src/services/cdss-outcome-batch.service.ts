import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TenantService } from './tenant.service';
import { CdssDecisionLogService } from './cdss-decision-log.service';
import axios from 'axios';

/**
 * Weekly batch job that:
 * 1. Iterates all active tenants
 * 2. Finds CdssDecisionLog entries that have clinician actions but haven't
 *    been fed back to the CDSS yet
 * 3. Pushes them to the CDSS /feedback/outcome endpoint
 * 4. Marks entries as sent
 *
 * Sprint 61 — CDSS Outcome Feedback Loop
 */
@Injectable()
export class CdssOutcomeBatchService {
  private readonly logger = new Logger(CdssOutcomeBatchService.name);
  private readonly cdssUrl: string;

  constructor(
    @Optional() @Inject(TenantService) private readonly tenantService: TenantService,
    @Optional() @Inject(CdssDecisionLogService) private readonly decisionLogService: CdssDecisionLogService,
  ) {
    this.cdssUrl = (process.env.CDSS_SERVICE_URL || '').replace(/\/$/, '');
  }

  /**
   * Runs every Sunday at 02:00 server time.
   * Configurable via CDSS_FEEDBACK_CRON env var.
   */
  @Cron(process.env.CDSS_FEEDBACK_CRON || '0 2 * * 0')
  async runWeeklyFeedbackBatch(): Promise<void> {
    if (!this.tenantService || !this.decisionLogService) {
      this.logger.warn('CdssOutcomeBatchService: dependencies not injected, skipping batch');
      return;
    }
    if (!this.cdssUrl) {
      this.logger.warn('CDSS_SERVICE_URL not set — skipping outcome feedback batch');
      return;
    }

    this.logger.log('Starting weekly CDSS outcome feedback batch...');

    let processed = 0;
    let errors = 0;

    try {
      const tenants = await this.tenantService.getAllActiveTenants();

      for (const tenant of tenants) {
        try {
          const tenantDb = await this.tenantService.getTenantDatabase(tenant.subdomain);
          if (!tenantDb) continue;

          const pending = await this.decisionLogService.getPendingFeedback(tenantDb);

          if (!pending.length) continue;

          // Filter entries that have at least a clinician action recorded
          const actionable = pending.filter((e) => !!e.clinicianAction);
          if (!actionable.length) continue;

          const payload = actionable.map((e) => ({
            logId:               e.id,
            patientId:           e.patientId,
            decisionType:        e.decisionType,
            topRecommendation:   e.topRecommendation,
            confidenceScore:     e.confidenceScore,
            clinicianAction:     e.clinicianAction,
            overrideReason:      e.overrideReason,
            outcomeAt30Days:     e.outcomeAt30Days,
            outcomeAt90Days:     e.outcomeAt90Days,
            createdAt:           e.createdAt,
          }));

          await axios.post(`${this.cdssUrl}/feedback/outcome`, { entries: payload }, {
            headers: {
              'Content-Type': 'application/json',
              'X-Service-Token': process.env.CDSS_SERVICE_TOKEN || '',
            },
            timeout: 30_000,
          });

          await this.decisionLogService.markFeedbackSent(
            actionable.map((e) => e.id),
            tenantDb,
          );

          processed += actionable.length;
          this.logger.log(`Tenant ${tenant.subdomain}: pushed ${actionable.length} feedback entries`);
        } catch (tenantErr: any) {
          this.logger.error(`Feedback batch error for tenant: ${String(tenantErr?.message || tenantErr)}`);
          errors++;
        }
      }
    } catch (err: any) {
      this.logger.error(`Fatal error in CDSS feedback batch: ${String(err?.message || err)}`);
    }

    this.logger.log(`Weekly CDSS feedback batch complete. Processed: ${processed}, Errors: ${errors}`);
  }
}
