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

  private normalizeDateOnly(value?: string): string | null {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed.toISOString().split('T')[0];
  }

  async recordVitals(data: Partial<Vitals>, tenantId: string): Promise<Vitals & { cdssInsights?: any }> {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    const repo = tenantDb.getRepository(Vitals);
    
    // Convert bloodPressureSystolic/diastolic to blood_pressure string format
    const vitalsData: any = { ...data };
    if (vitalsData.bloodPressureSystolic !== undefined || vitalsData.bloodPressureDiastolic !== undefined) {
      const systolic = vitalsData.bloodPressureSystolic;
      const diastolic = vitalsData.bloodPressureDiastolic;
      // Save BP if at least one value is provided
      if (systolic !== undefined && systolic !== null && diastolic !== undefined && diastolic !== null) {
        vitalsData.bloodPressure = `${systolic}/${diastolic}`;
      } else if (systolic !== undefined && systolic !== null) {
        vitalsData.bloodPressure = `${systolic}/--`;
      } else if (diastolic !== undefined && diastolic !== null) {
        vitalsData.bloodPressure = `--/${diastolic}`;
      }
      // Remove the separate fields as they don't exist in the entity
      delete vitalsData.bloodPressureSystolic;
      delete vitalsData.bloodPressureDiastolic;
    }
    
    // Ensure BMI and bloodGlucose are properly set (convert from camelCase if needed)
    if (vitalsData.bloodGlucose !== undefined) {
      vitalsData.bloodGlucose = vitalsData.bloodGlucose;
    }
    if (vitalsData.bmi !== undefined) {
      vitalsData.bmi = vitalsData.bmi;
    }
    
    const entity = repo.create(vitalsData as Vitals);
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

  async getByPatient(
    patientId: string,
    tenantId: string,
    options: number | { limit?: number; recordedDate?: string; latestOnDate?: boolean } = 100,
  ): Promise<Vitals[]> {
    const resolvedOptions =
      typeof options === 'number'
        ? { limit: options, recordedDate: null as string | null, latestOnDate: false }
        : {
            limit: options.limit ?? 100,
            recordedDate: this.normalizeDateOnly(options.recordedDate),
            latestOnDate: Boolean(options.latestOnDate),
          };

    const repo = await this.getRepository(tenantId);
    const query = repo
      .createQueryBuilder('vitals')
      .leftJoinAndSelect('vitals.recordedByUser', 'recordedByUser')
      .where('vitals.patientId = :patientId', { patientId })
      .orderBy('vitals.recordedAt', 'DESC');

    if (resolvedOptions.recordedDate) {
      query.andWhere(`DATE(vitals.recordedAt) = :recordedDate`, {
        recordedDate: resolvedOptions.recordedDate,
      });
    }

    query.take(resolvedOptions.latestOnDate ? 1 : resolvedOptions.limit);
    const vitals = await query.getMany();
    
    // Convert blood_pressure string to bloodPressureSystolic/diastolic for frontend compatibility
    return vitals.map((v: any) => {
      if (v.bloodPressure && typeof v.bloodPressure === 'string') {
        const bpMatch = v.bloodPressure.match(/(\d+)\s*\/\s*(\d+)/);
        if (bpMatch) {
          v.bloodPressureSystolic = parseInt(bpMatch[1], 10);
          v.bloodPressureDiastolic = parseInt(bpMatch[2], 10);
        }
      }
      return v;
    });
  }

  async getPatientVitalTrends(patientId: string, tenantId: string, limit = 30) {
    const vitals = await this.getByPatient(patientId, tenantId, { limit });
    const reverse = [...vitals].reverse();

    const formatTrend = (mapper: (v: Vitals) => number | null) =>
      reverse
        .map((vital) => {
          const value = mapper(vital);
          if (value === null || typeof value === 'undefined' || Number.isNaN(value) || value === 0) return null;
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
        temperature: formatTrend((v) => (v.temperature !== null && v.temperature !== undefined ? Number(v.temperature) : null)),
        oxygenSaturation: formatTrend((v) => v.oxygenSaturation ?? null),
        respiratoryRate: formatTrend((v) => v.respiratoryRate ?? null),
        weight: formatTrend((v) => (v.weight !== null && v.weight !== undefined ? Number(v.weight) : null)),
        bmi: formatTrend((v) => (v.bmi !== null && v.bmi !== undefined ? Number(v.bmi) : null)),
      },
    };
  }
}
