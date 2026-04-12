import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { ScdRegister } from '../entities/scd-register.entity';
import { ScdCrisisEvent } from '../entities/scd-crisis-event.entity';
import { ScdTreatmentRecord } from '../entities/scd-treatment-record.entity';
import { ScdComplicationScreening } from '../entities/scd-complication-screening.entity';

@Injectable()
export class ScdService {
  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  async enroll(
    tenantId: string,
    patientId: string,
    enrolledBy: string,
    dto: Partial<ScdRegister>,
  ): Promise<ScdRegister> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(ScdRegister);
    const entity = repo.create({
      ...dto,
      patientId,
      enrolledBy,
      enrolledAt: dto.enrolledAt ?? new Date().toISOString().slice(0, 10),
      onMalariaProphylaxis: dto.onMalariaProphylaxis ?? false,
    } as Partial<ScdRegister>);
    return repo.save(entity) as unknown as ScdRegister;
  }

  async getRegister(tenantId: string, patientId: string): Promise<ScdRegister | null> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(ScdRegister).findOne({
      where: { patientId },
      order: { enrolledAt: 'DESC', createdAt: 'DESC' },
    });
  }

  async updateRegister(tenantId: string, id: string, dto: Partial<ScdRegister>): Promise<ScdRegister> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(ScdRegister);
    const existing = await repo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('SCD register entry not found');
    }
    await repo.update(id, dto as object);
    return (await repo.findOne({ where: { id } })) as ScdRegister;
  }

  async recordCrisis(
    tenantId: string,
    patientId: string,
    recordedBy: string,
    dto: Partial<ScdCrisisEvent> & { fever?: boolean; newChestSymptoms?: boolean; newNeuroSymptoms?: boolean },
  ): Promise<{ crisisEvent: ScdCrisisEvent; triageGuidance: Record<string, any> }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(ScdCrisisEvent);
    const register = await this.getRegister(tenantId, patientId);
    const triageGuidance = await this.cdssService.scdCrisisTriage(
      {
        crisis_type: dto.crisisType,
        pain_score: dto.painScore,
        spo2_pct: dto.spo2AtEvent,
        fever: dto.fever ?? false,
        new_chest_symptoms: dto.newChestSymptoms ?? false,
        hb_g_dl: dto.hbAtEvent,
        new_neuro_symptoms: dto.newNeuroSymptoms ?? false,
      },
      tenantId,
    );

    const entity = repo.create({
      ...dto,
      patientId,
      scdRegisterId: dto.scdRegisterId ?? register?.id ?? null,
      recordedBy,
      eventDate: dto.eventDate ?? new Date().toISOString().slice(0, 10),
      severity: dto.severity ?? triageGuidance?.severity ?? 'mild',
      management: dto.management ?? triageGuidance?.management ?? null,
    } as Partial<ScdCrisisEvent>);

    const crisisEvent = await repo.save(entity) as unknown as ScdCrisisEvent;
    return { crisisEvent, triageGuidance };
  }

  async getCrisisHistory(tenantId: string, patientId: string): Promise<ScdCrisisEvent[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(ScdCrisisEvent).find({
      where: { patientId },
      order: { eventDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async recordTreatment(
    tenantId: string,
    patientId: string,
    recordedBy: string,
    dto: Partial<ScdTreatmentRecord> & {
      patientWeightKg?: number | null;
      ageYears?: number | null;
      genotype?: string | null;
      currentDoseMg?: number | null;
      weeksOnCurrentDose?: number | null;
      reticulocytesX10_9?: number | null;
    },
  ): Promise<{ treatmentRecord: ScdTreatmentRecord; doseGuidance: Record<string, any> | null }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(ScdTreatmentRecord);
    const register = await this.getRegister(tenantId, patientId);

    let doseGuidance: Record<string, any> | null = null;
    if (dto.treatmentType === 'hydroxyurea' && dto.patientWeightKg) {
      doseGuidance = await this.cdssService.scdHydroxyureaDose(
        {
          patient_weight_kg: dto.patientWeightKg,
          age_years: dto.ageYears ?? 0,
          genotype: dto.genotype ?? register?.genotype ?? 'HbSS',
          current_dose_mg: dto.currentDoseMg ?? dto.doseMg ?? null,
          indication: dto.indication ?? 'standard',
          hb_g_dl: dto.hbGDl,
          mcv_fl: dto.mcvFl,
          wbc_x10_9: dto.wbcX10_9,
          anc_x10_9: dto.ancX10_9,
          platelets_x10_9: dto.plateletsX10_9,
          reticulocytes_x10_9: dto.reticulocytesX10_9 ?? null,
          hbf_pct: dto.hbfPct,
          weeks_on_current_dose: dto.weeksOnCurrentDose ?? null,
        },
        tenantId,
      );
    }

    const entity = repo.create({
      ...dto,
      patientId,
      scdRegisterId: dto.scdRegisterId ?? register?.id ?? null,
      recordedBy,
      recordedAt: dto.recordedAt ?? new Date().toISOString().slice(0, 10),
      action: dto.action ?? doseGuidance?.action ?? null,
      doseMg: dto.doseMg ?? doseGuidance?.recommended_dose_mg ?? null,
      doseMgPerKg: dto.doseMgPerKg ?? (
        dto.patientWeightKg && (dto.doseMg ?? doseGuidance?.recommended_dose_mg)
          ? Number(((dto.doseMg ?? doseGuidance?.recommended_dose_mg) / dto.patientWeightKg).toFixed(2))
          : null
      ),
    } as Partial<ScdTreatmentRecord>);

    const treatmentRecord = await repo.save(entity) as unknown as ScdTreatmentRecord;
    return { treatmentRecord, doseGuidance };
  }

  async getTreatmentHistory(tenantId: string, patientId: string): Promise<ScdTreatmentRecord[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(ScdTreatmentRecord).find({
      where: { patientId },
      order: { recordedAt: 'DESC', createdAt: 'DESC' },
    });
  }

  async recordScreening(
    tenantId: string,
    patientId: string,
    screenedBy: string,
    dto: Partial<ScdComplicationScreening>,
  ): Promise<ScdComplicationScreening> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(ScdComplicationScreening);
    const register = await this.getRegister(tenantId, patientId);
    const tcdVelocity = dto.tcdVelocityCmS ?? null;
    const tcdClassification = dto.tcdClassification ?? this.classifyTcd(tcdVelocity);
    const entity = repo.create({
      ...dto,
      patientId,
      scdRegisterId: dto.scdRegisterId ?? register?.id ?? null,
      screenedBy,
      screenedAt: dto.screenedAt ?? new Date().toISOString().slice(0, 10),
      tcdClassification,
    } as Partial<ScdComplicationScreening>);
    return repo.save(entity) as unknown as ScdComplicationScreening;
  }

  async getScreeningHistory(tenantId: string, patientId: string): Promise<ScdComplicationScreening[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(ScdComplicationScreening).find({
      where: { patientId },
      order: { screenedAt: 'DESC', createdAt: 'DESC' },
    });
  }

  async getComplicationRisk(
    tenantId: string,
    patientId: string,
    payload: Record<string, any>,
  ): Promise<Record<string, any>> {
    const register = await this.getRegister(tenantId, patientId);
    const crises = await this.getCrisisHistory(tenantId, patientId);

    return this.cdssService.scdComplicationRisk(
      {
        genotype: payload.genotype ?? register?.genotype ?? 'HbSS',
        age_years: payload.ageYears ?? payload.age_years ?? 0,
        tcd_velocity_cm_s: payload.tcdVelocityCmS ?? payload.tcd_velocity_cm_s ?? register?.transcranialDopplerVelocity ?? null,
        has_stroke_history: payload.hasStrokeHistory ?? register?.hasStrokeHistory ?? false,
        hb_g_dl: payload.hbGDl ?? payload.hb_g_dl ?? register?.baselineHbGDl ?? null,
        on_hydroxyurea: payload.onHydroxyurea ?? register?.onHydroxyurea ?? false,
        hbf_pct: payload.hbfPct ?? payload.hbf_pct ?? null,
        prior_acs_episodes: payload.priorAcsEpisodes ?? crises.filter((item) => item.crisisType === 'acs').length,
        has_renal_disease: payload.hasRenalDisease ?? register?.hasRenalDisease ?? false,
        systolic_bp: payload.systolicBp ?? payload.systolic_bp ?? null,
      },
      tenantId,
    );
  }

  private classifyTcd(value: number | null): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (value >= 200) {
      return 'abnormal';
    }
    if (value >= 170) {
      return 'conditional';
    }
    return 'normal';
  }
}
