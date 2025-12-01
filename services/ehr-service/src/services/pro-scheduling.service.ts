import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { TenantService } from './tenant.service';
import { PatientProService } from './patient-pro.service';

@Injectable()
export class ProSchedulingService {
  private readonly logger = new Logger(ProSchedulingService.name);

  constructor(
    private tenantService: TenantService,
    private patientProService: PatientProService,
  ) {}

  /**
   * Cron job that runs daily at 6 AM to process scheduled questionnaires
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async processScheduledQuestionnaires() {
    this.logger.log('Processing scheduled PRO questionnaires...');

    try {
      // Get all active tenants
      const activeTenants = await this.tenantService.getAllActiveTenants();

      let totalProcessed = 0;
      let totalAssigned = 0;

      for (const tenant of activeTenants) {
        try {
          const connection = await this.tenantService.getTenantDatabase(tenant.id);
          if (!connection) {
            this.logger.warn(`Failed to connect to tenant database: ${tenant.id}`);
            continue;
          }

          const result = await this.patientProService.processScheduledQuestionnaires(connection);
          totalProcessed += result.processed;
          totalAssigned += result.assigned;

          this.logger.log(
            `Tenant ${tenant.id}: Processed ${result.processed} schedules, assigned ${result.assigned} questionnaires`,
          );
        } catch (error) {
          this.logger.error(`Error processing schedules for tenant ${tenant.id}: ${error.message}`);
        }
      }

      this.logger.log(
        `PRO scheduling completed: ${totalProcessed} schedules processed, ${totalAssigned} questionnaires assigned across ${activeTenants.length} tenants`,
      );
    } catch (error) {
      this.logger.error(`Error in PRO scheduling cron job: ${error.message}`);
    }
  }
}

