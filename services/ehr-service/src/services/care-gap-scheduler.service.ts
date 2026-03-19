import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { TenantService } from './tenant.service';
import { NurseTaskService } from './nurse-task.service';

/**
 * Nightly proactive care gap engine.
 *
 * For every active tenant, finds patients with appointments in the next 7 days
 * and calls the CDSS /care-gaps/detect endpoint. Detected gaps are stored in
 * care_gap_detections and a corresponding nurse_task is created automatically.
 *
 * Sprint 62 — Proactive Care Gap Engine
 */
@Injectable()
export class CareGapSchedulerService {
  private readonly logger = new Logger(CareGapSchedulerService.name);
  private readonly cdssUrl: string;

  constructor(
    @Optional() @Inject(TenantService) private readonly tenantService: TenantService,
    @Optional() @Inject(NurseTaskService) private readonly nurseTaskService: NurseTaskService,
  ) {
    this.cdssUrl = (process.env.CDSS_SERVICE_URL || '').replace(/\/$/, '');
  }

  /**
   * Runs every night at 01:00 (configurable via CARE_GAP_CRON env var).
   */
  @Cron(process.env.CARE_GAP_CRON || '0 1 * * *')
  async runNightlyGapDetection(): Promise<void> {
    if (!this.tenantService || !this.nurseTaskService) {
      this.logger.warn('CareGapSchedulerService: dependencies not injected, skipping');
      return;
    }
    if (!this.cdssUrl) {
      this.logger.warn('CDSS_SERVICE_URL not configured — skipping care gap detection');
      return;
    }

    this.logger.log('Starting nightly care gap detection run...');

    let processed = 0;
    let gapsCreated = 0;
    let errors = 0;

    try {
      const tenants = await this.tenantService.getAllActiveTenants();

      for (const tenant of tenants) {
        try {
          const tenantDb = await this.tenantService.getTenantDatabase(tenant.subdomain);
          if (!tenantDb) continue;

          // Find patients with appointments in the next 7 days
          const upcoming: Array<{
            patient_id: string;
            patient_age: number;
            patient_gender: string;
          }> = await tenantDb.query(`
            SELECT DISTINCT
              a.patient_id,
              DATE_PART('year', AGE(p.date_of_birth))::int AS patient_age,
              p.gender AS patient_gender
            FROM appointments a
            JOIN patients p ON p.id = a.patient_id
            WHERE a.appointment_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
              AND a.status NOT IN ('cancelled', 'no_show')
              AND p.is_active = TRUE
            LIMIT 500
          `);

          for (const row of upcoming) {
            try {
              // Build visit history digest from recent diagnoses
              const recentDiagnoses: Array<{ code: string }> = await tenantDb.query(`
                SELECT DISTINCT code FROM problems
                WHERE patient_id = $1 AND status = 'active'
                LIMIT 20
              `, [row.patient_id]);

              const cdssPayload = {
                patient_age:    row.patient_age,
                patient_gender: row.patient_gender,
                visit_history:  [],
                diagnoses:      recentDiagnoses.map((d) => d.code),
              };

              let gapsResponse: any;
              try {
                const resp = await axios.post(
                  `${this.cdssUrl}/care-gaps/detect`,
                  cdssPayload,
                  {
                    headers: {
                      'Content-Type': 'application/json',
                      'X-Service-Token': process.env.CDSS_SERVICE_TOKEN || '',
                    },
                    timeout: 15_000,
                  },
                );
                gapsResponse = resp.data;
              } catch (cdssErr: any) {
                this.logger.warn(`CDSS care gap call failed for patient ${row.patient_id}: ${String(cdssErr?.message || cdssErr)}`);
                continue;
              }

              const gaps: Array<{
                type?: string;
                description?: string;
                recommended_action?: string;
                priority?: string;
                icd_code?: string;
                due_date?: string;
              }> = Array.isArray(gapsResponse?.gaps)
                ? gapsResponse.gaps
                : Array.isArray(gapsResponse)
                ? gapsResponse
                : [];

              for (const gap of gaps) {
                // Skip if this exact gap already exists and is open
                const existing: Array<{ id: string }> = await tenantDb.query(`
                  SELECT id FROM care_gap_detections
                  WHERE patient_id = $1
                    AND gap_type = $2
                    AND status = 'open'
                  LIMIT 1
                `, [row.patient_id, gap.type || 'unknown']);

                if (existing.length > 0) continue;

                // Persist care gap detection
                const detection = await this.nurseTaskService.createCareGap(
                  {
                    patientId:         row.patient_id,
                    detectedBy:        'cdss',
                    gapType:           gap.type || 'unknown',
                    gapDescription:    gap.description || 'Care gap detected by AI',
                    recommendedAction: gap.recommended_action,
                    priority:          gap.priority || 'medium',
                    icdCode:           gap.icd_code,
                    dueDate:           gap.due_date ? new Date(gap.due_date) : undefined,
                    status:            'open',
                  },
                  tenantDb,
                );

                // Create nurse task linked to the detection
                const task = await this.nurseTaskService.createTask(
                  {
                    patientId:       row.patient_id,
                    assignedBySystem: true,
                    taskType:        'care_gap',
                    priority:        gap.priority || 'medium',
                    title:           `Care Gap: ${gap.type || 'Review required'}`,
                    description:     gap.recommended_action || gap.description,
                    sourceType:      'cdss',
                    sourceId:        detection.id,
                  },
                  tenantDb,
                );

                // Link task back to detection
                await tenantDb.query(
                  `UPDATE care_gap_detections SET linked_task_id = $1 WHERE id = $2`,
                  [task.id, detection.id],
                );

                gapsCreated++;
              }

              processed++;
            } catch (patientErr: any) {
              this.logger.warn(
                `Care gap error for patient ${row.patient_id}: ${String(patientErr?.message || patientErr)}`,
              );
            }
          }
        } catch (tenantErr: any) {
          this.logger.error(
            `Care gap scheduler error for tenant ${tenant.subdomain}: ${String(tenantErr?.message || tenantErr)}`,
          );
          errors++;
        }
      }
    } catch (err: any) {
      this.logger.error(`Fatal error in care gap scheduler: ${String(err?.message || err)}`);
    }

    this.logger.log(
      `Nightly care gap run complete. Patients processed: ${processed}, Gaps created: ${gapsCreated}, Errors: ${errors}`,
    );
  }
}
