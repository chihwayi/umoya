import { Injectable, Logger, Optional } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Vitals } from '../entities/vitals.entity';
import { TenantService } from './tenant.service';
import { CdssHookService } from './cdss-hook.service';
import { ClinicalWorkflowService } from './clinical-workflow.service';

@Injectable()
export class VitalsService {
  private readonly logger = new Logger(VitalsService.name);

  constructor(
    private tenantService: TenantService,
    private cdssHookService: CdssHookService,
    @Optional() private workflowService?: ClinicalWorkflowService,
  ) {}

  private async getRepository(tenantId: string): Promise<Repository<Vitals>> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    return connection.getRepository(Vitals);
  }

  async recordVitals(data: Partial<Vitals>, tenantId: string): Promise<Vitals & { cdssInsights?: any }> {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    const repo = tenantDb.getRepository(Vitals);
    const entity = repo.create(data as Vitals);
    const saved = await repo.save(entity);

    let cdssInsights: any = null;
    try {
      cdssInsights = await this.cdssHookService.handleVitalsRecorded({
        tenantId,
        tenantDb,
        vitals: saved,
      });
    } catch (error) {
      this.logger.warn(`CDSS hook failed for vitals: ${error instanceof Error ? error.message : error}`);
    }

    // Trigger workflow for vitals_recorded
    if (this.workflowService) {
      try {
        await this.workflowService.executeWorkflow(
          'vitals_recorded',
          {
            entityType: 'vitals',
            entityId: saved.id,
            patientId: saved.patientId,
            data: {
              bloodPressure: saved.bloodPressure,
              heartRate: saved.heartRate,
              temperature: saved.temperature,
              oxygenSaturation: saved.oxygenSaturation,
            },
          },
          tenantDb,
        );
      } catch (error) {
        this.logger.warn(`Failed to trigger workflow for vitals_recorded: ${error instanceof Error ? error.message : error}`);
      }
    }

    return {
      ...saved,
      cdssInsights,
    };
  }

  async getByPatient(patientId: string, tenantId: string, limit = 100): Promise<Vitals[]> {
    const repo = await this.getRepository(tenantId);
    return repo.find({
      where: { patientId },
      order: { recordedAt: 'DESC' },
      take: limit,
    });
  }

  async getPatientVitalTrends(patientId: string, tenantId: string, limit = 30) {
    const vitals = await this.getByPatient(patientId, tenantId, limit);
    const reverse = [...vitals].reverse();

    const formatTrend = (mapper: (v: Vitals) => number | null) =>
      reverse
        .map((vital) => {
          const value = mapper(vital);
          if (value === null || typeof value === 'undefined' || Number.isNaN(value)) return null;
          return {
            timestamp: vital.recordedAt || vital.createdAt,
            value: value,
          };
        })
        .filter(Boolean);

    return {
      patientId,
      count: vitals.length,
      latest: vitals[0] || null,
      trends: {
        systolic: formatTrend((v) => {
          if (v.bloodPressure && v.bloodPressure.includes('/')) {
            return Number(v.bloodPressure.split('/')[0]);
          }
          return null;
        }),
        diastolic: formatTrend((v) => {
          if (v.bloodPressure && v.bloodPressure.includes('/')) {
            return Number(v.bloodPressure.split('/')[1]);
          }
          return null;
        }),
        heartRate: formatTrend((v) => v.heartRate ?? null),
        temperature: formatTrend((v) => (typeof v.temperature === 'number' ? v.temperature : null)),
        oxygenSaturation: formatTrend((v) => v.oxygenSaturation ?? null),
        respiratoryRate: formatTrend((v) => v.respiratoryRate ?? null),
        weight: formatTrend((v) => (typeof v.weight === 'number' ? v.weight : null)),
        bmi: formatTrend((v) => (typeof v.bmi === 'number' ? v.bmi : null)),
      },
    };
  }
}
