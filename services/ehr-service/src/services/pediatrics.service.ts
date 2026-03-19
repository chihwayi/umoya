import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import axios from 'axios';
import { PediatricProfile } from '../entities/pediatric-profile.entity';
import { GrowthMeasurement } from '../entities/growth-measurement.entity';
import { DevelopmentalMilestone } from '../entities/developmental-milestone.entity';
import { NeonatalRecord } from '../entities/neonatal-record.entity';
import { SchoolHealthRecord } from '../entities/school-health-record.entity';

@Injectable()
export class PediatricsService {
  private readonly logger = new Logger(PediatricsService.name);
  private readonly cdssUrl: string;

  constructor() {
    this.cdssUrl = (process.env.CDSS_SERVICE_URL || '').replace(/\/$/, '');
  }

  // ── Pediatric Profile ─────────────────────────────────────────────────────

  async getOrCreateProfile(patientId: string, tenantDb: DataSource): Promise<PediatricProfile> {
    const repo = tenantDb.getRepository(PediatricProfile);
    const existing = await repo.findOne({ where: { patientId } });
    if (existing) return existing;
    return repo.save(repo.create({ patientId }));
  }

  async updateProfile(patientId: string, data: Partial<PediatricProfile>, tenantDb: DataSource): Promise<PediatricProfile> {
    const repo = tenantDb.getRepository(PediatricProfile);
    const existing = await repo.findOne({ where: { patientId } });
    if (existing) {
      await repo.update(existing.id, data as any);
      return repo.findOne({ where: { patientId } }) as Promise<PediatricProfile>;
    }
    return repo.save(repo.create({ ...data, patientId }));
  }

  // ── Growth ────────────────────────────────────────────────────────────────

  async addGrowthMeasurement(data: Partial<GrowthMeasurement>, tenantDb: DataSource): Promise<GrowthMeasurement> {
    const repo = tenantDb.getRepository(GrowthMeasurement);
    const saved = await repo.save(repo.create(data));

    // Auto-calculate Z-scores via CDSS (non-blocking update)
    if (this.cdssUrl && data.patientId && (data.weightKg || data.heightCm)) {
      this.assessGrowth({
        patient_id:  data.patientId,
        age_months:  data.ageMonths,
        weight_kg:   data.weightKg,
        height_cm:   data.heightCm,
        head_circ_cm: data.headCircumferenceCm,
        muac_cm:     data.muacCm,
        gender:      null,
      }).then((result) => {
        if (!result?.error) {
          repo.update(saved.id, {
            weightForAgeZ:      result.weight_for_age_z,
            heightForAgeZ:      result.height_for_age_z,
            weightForHeightZ:   result.weight_for_height_z,
            bmiForAgeZ:         result.bmi_for_age_z,
            nutritionalStatus:  result.nutritional_status,
          } as any);
        }
      }).catch(() => {});
    }

    return saved;
  }

  async getGrowthHistory(patientId: string, tenantDb: DataSource, limit = 24): Promise<GrowthMeasurement[]> {
    return tenantDb.getRepository(GrowthMeasurement).find({
      where: { patientId },
      order: { measuredAt: 'DESC' },
      take: limit,
    });
  }

  // ── Milestones ────────────────────────────────────────────────────────────

  async upsertMilestone(data: Partial<DevelopmentalMilestone>, tenantDb: DataSource): Promise<DevelopmentalMilestone> {
    const repo = tenantDb.getRepository(DevelopmentalMilestone);
    if (data.patientId && data.domain && data.milestone) {
      const existing = await repo.findOne({
        where: { patientId: data.patientId, domain: data.domain, milestone: data.milestone },
      });
      if (existing) {
        await repo.update(existing.id, data as any);
        return repo.findOne({ where: { id: existing.id } }) as Promise<DevelopmentalMilestone>;
      }
    }
    return repo.save(repo.create(data));
  }

  async getMilestones(patientId: string, tenantDb: DataSource, domain?: string): Promise<DevelopmentalMilestone[]> {
    const where: any = { patientId };
    if (domain) where.domain = domain;
    return tenantDb.getRepository(DevelopmentalMilestone).find({ where, order: { expectedAgeMonths: 'ASC' } });
  }

  // ── Neonatal ──────────────────────────────────────────────────────────────

  async getNeonatalRecord(patientId: string, tenantDb: DataSource): Promise<NeonatalRecord | null> {
    return tenantDb.getRepository(NeonatalRecord).findOne({ where: { patientId } });
  }

  async saveNeonatalRecord(data: Partial<NeonatalRecord>, tenantDb: DataSource): Promise<NeonatalRecord> {
    const repo = tenantDb.getRepository(NeonatalRecord);
    const existing = await repo.findOne({ where: { patientId: data.patientId } });
    if (existing) {
      await repo.update(existing.id, data as any);
      return repo.findOne({ where: { id: existing.id } }) as Promise<NeonatalRecord>;
    }
    return repo.save(repo.create(data));
  }

  // ── School health ─────────────────────────────────────────────────────────

  async addSchoolHealthRecord(data: Partial<SchoolHealthRecord>, tenantDb: DataSource): Promise<SchoolHealthRecord> {
    const repo = tenantDb.getRepository(SchoolHealthRecord);
    return repo.save(repo.create(data));
  }

  async getSchoolHealthRecords(patientId: string, tenantDb: DataSource): Promise<SchoolHealthRecord[]> {
    return tenantDb.getRepository(SchoolHealthRecord).find({
      where: { patientId },
      order: { assessmentDate: 'DESC' },
    });
  }

  // ── CDSS ──────────────────────────────────────────────────────────────────

  async pediatricDosing(payload: Record<string, any>): Promise<any> {
    return this.callCdss('/dosing/pediatric', payload);
  }

  async assessGrowth(payload: Record<string, any>): Promise<any> {
    return this.callCdss('/growth/assess', payload);
  }

  async assessMilestones(payload: Record<string, any>): Promise<any> {
    return this.callCdss('/milestone/assess', payload);
  }

  private async callCdss(path: string, payload: Record<string, any>): Promise<any> {
    if (!this.cdssUrl) return { error: 'CDSS not configured' };
    try {
      const resp = await axios.post(`${this.cdssUrl}${path}`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Token': process.env.CDSS_SERVICE_TOKEN || '',
        },
        timeout: 10_000,
      });
      return resp.data;
    } catch (err: any) {
      this.logger.warn(`CDSS ${path} error: ${String(err?.message || err)}`);
      return { error: String(err?.message || err) };
    }
  }
}
