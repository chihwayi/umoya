import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { TenantService } from './tenant.service';
import { NutritionalScreening } from '../entities/nutritional-screening.entity';
import { NutritionalAssessment as LegacyNutritionalAssessment } from '../entities/nutritional-assessment.entity';
import { DietaryPrescription } from '../entities/dietary-prescription.entity';
import { NutritionMonitoring } from '../entities/nutrition-monitoring.entity';
import { NutritionAssessment } from '../entities/nutrition-assessment.entity';
import { RutfDispensing } from '../entities/rutf-dispensing.entity';
import { TherapeuticFeedingRecord } from '../entities/therapeutic-feeding.entity';
import { Patient } from '../entities/patient.entity';
import { CdssService } from './cdss.service';

interface RegisterFilters {
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

interface WhzThreshold {
  minus3: number;
  minus2: number;
}

type SexKey = 'M' | 'F';

const WHZ_ANCHOR_VALUES: Record<SexKey, Array<[number, WhzThreshold]>> = {
  M: [
    [45, { minus3: 1.7, minus2: 1.9 }],
    [50, { minus3: 2.2, minus2: 2.4 }],
    [55, { minus3: 2.9, minus2: 3.2 }],
    [60, { minus3: 3.8, minus2: 4.2 }],
    [65, { minus3: 4.8, minus2: 5.3 }],
    [70, { minus3: 5.8, minus2: 6.4 }],
    [75, { minus3: 6.9, minus2: 7.6 }],
    [80, { minus3: 8.0, minus2: 8.8 }],
    [85, { minus3: 9.2, minus2: 10.1 }],
    [90, { minus3: 10.4, minus2: 11.4 }],
    [95, { minus3: 11.7, minus2: 12.8 }],
    [100, { minus3: 13.0, minus2: 14.2 }],
    [105, { minus3: 14.3, minus2: 15.7 }],
    [110, { minus3: 15.8, minus2: 17.3 }],
    [115, { minus3: 17.4, minus2: 19.0 }],
    [120, { minus3: 19.1, minus2: 20.8 }],
  ],
  F: [
    [45, { minus3: 1.6, minus2: 1.8 }],
    [50, { minus3: 2.1, minus2: 2.3 }],
    [55, { minus3: 2.8, minus2: 3.1 }],
    [60, { minus3: 3.6, minus2: 4.0 }],
    [65, { minus3: 4.6, minus2: 5.1 }],
    [70, { minus3: 5.6, minus2: 6.2 }],
    [75, { minus3: 6.7, minus2: 7.4 }],
    [80, { minus3: 7.8, minus2: 8.6 }],
    [85, { minus3: 8.9, minus2: 9.8 }],
    [90, { minus3: 10.1, minus2: 11.1 }],
    [95, { minus3: 11.3, minus2: 12.4 }],
    [100, { minus3: 12.6, minus2: 13.8 }],
    [105, { minus3: 13.9, minus2: 15.2 }],
    [110, { minus3: 15.3, minus2: 16.7 }],
    [115, { minus3: 16.8, minus2: 18.3 }],
    [120, { minus3: 18.4, minus2: 20.0 }],
  ],
};

@Injectable()
export class NutritionService {
  private static readonly WHZ_THRESHOLD_TABLE = NutritionService.buildWhzThresholdTable();

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  private static buildWhzThresholdTable(): Map<string, WhzThreshold> {
    const table = new Map<string, WhzThreshold>();

    for (const sexKey of Object.keys(WHZ_ANCHOR_VALUES) as SexKey[]) {
      const anchors = WHZ_ANCHOR_VALUES[sexKey];
      for (let height = 45; height <= 120; height += 0.5) {
        const roundedHeight = Number(height.toFixed(1));
        const threshold = NutritionService.interpolateThreshold(anchors, roundedHeight);
        table.set(`${sexKey}_${roundedHeight.toFixed(1)}`, threshold);
      }
    }

    return table;
  }

  private static interpolateThreshold(
    anchors: Array<[number, WhzThreshold]>,
    height: number,
  ): WhzThreshold {
    const exact = anchors.find(([anchorHeight]) => anchorHeight === height);
    if (exact) {
      return exact[1];
    }

    let lower = anchors[0];
    let upper = anchors[anchors.length - 1];

    for (let index = 0; index < anchors.length - 1; index += 1) {
      const current = anchors[index];
      const next = anchors[index + 1];
      if (height >= current[0] && height <= next[0]) {
        lower = current;
        upper = next;
        break;
      }
    }

    const span = upper[0] - lower[0];
    const ratio = span === 0 ? 0 : (height - lower[0]) / span;

    return {
      minus3: Number((lower[1].minus3 + (upper[1].minus3 - lower[1].minus3) * ratio).toFixed(2)),
      minus2: Number((lower[1].minus2 + (upper[1].minus2 - lower[1].minus2) * ratio).toFixed(2)),
    };
  }

  private classifyMuac(muacMm: number): string {
    if (muacMm < 115) return 'SAM';
    if (muacMm < 125) return 'MAM';
    return 'normal';
  }

  private classifyWhz(whz: number, hasBilateralOedema: boolean): string {
    if (hasBilateralOedema) return 'SAM';
    if (whz < -3) return 'SAM';
    if (whz < -2) return 'MAM';
    return 'normal';
  }

  private finalClassification(muacClass: string, whzClass: string): string {
    if (muacClass === 'SAM' || whzClass === 'SAM') return 'SAM';
    if (muacClass === 'MAM' || whzClass === 'MAM') return 'MAM';
    return 'normal';
  }

  private normalizeSex(gender?: string | null): SexKey | null {
    const normalized = String(gender || '').trim().toLowerCase();
    if (['m', 'male', 'boy'].includes(normalized)) return 'M';
    if (['f', 'female', 'girl'].includes(normalized)) return 'F';
    return null;
  }

  private roundHeight(heightCm: number): number {
    return Number((Math.round(heightCm * 2) / 2).toFixed(1));
  }

  private getWhzThreshold(heightCm: number, gender?: string | null): WhzThreshold | null {
    const sex = this.normalizeSex(gender);
    if (!sex) {
      return null;
    }
    const roundedHeight = this.roundHeight(heightCm);
    return NutritionService.WHZ_THRESHOLD_TABLE.get(`${sex}_${roundedHeight.toFixed(1)}`) || null;
  }

  private calculateWhz(weightKg?: number | null, heightCm?: number | null, gender?: string | null): number | null {
    if (weightKg == null || heightCm == null) {
      return null;
    }

    const thresholds = this.getWhzThreshold(Number(heightCm), gender);
    if (!thresholds) {
      return null;
    }

    const weight = Number(weightKg);
    if (Number.isNaN(weight)) {
      return null;
    }

    const step = Math.max(0.1, thresholds.minus2 - thresholds.minus3);
    if (weight < thresholds.minus3) {
      const diff = thresholds.minus3 - weight;
      return Number((-3 - diff / step).toFixed(2));
    }
    if (weight < thresholds.minus2) {
      return Number((-3 + (weight - thresholds.minus3) / step).toFixed(2));
    }

    return Number((-2 + (weight - thresholds.minus2) / step).toFixed(2));
  }

  private inferProgramType(classification: string, oedemaGrade?: string | null): string | null {
    if (classification === 'SAM') {
      if (oedemaGrade === '++' || oedemaGrade === '+++') {
        return 'SC';
      }
      return 'OTP';
    }
    if (classification === 'MAM') {
      return 'TSFP';
    }
    return null;
  }

  private normalizeDate(value?: string | null): string {
    if (!value) {
      return new Date().toISOString().slice(0, 10);
    }
    return value;
  }

  private page(value?: number, fallback = 1): number {
    return Math.max(1, Number(value) || fallback);
  }

  private limit(value?: number, fallback = 20): number {
    return Math.max(1, Math.min(200, Number(value) || fallback));
  }

  private async getDb(tenantId: string): Promise<DataSource> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    if (!db) {
      throw new BadRequestException('Invalid tenant');
    }
    return db;
  }

  private screeningRepo(db: DataSource): Repository<NutritionalScreening> {
    return db.getRepository(NutritionalScreening);
  }

  private legacyAssessmentRepo(db: DataSource): Repository<LegacyNutritionalAssessment> {
    return db.getRepository(LegacyNutritionalAssessment);
  }

  private prescriptionRepo(db: DataSource): Repository<DietaryPrescription> {
    return db.getRepository(DietaryPrescription);
  }

  private monitoringRepo(db: DataSource): Repository<NutritionMonitoring> {
    return db.getRepository(NutritionMonitoring);
  }

  private assessmentRepo(db: DataSource): Repository<NutritionAssessment> {
    return db.getRepository(NutritionAssessment);
  }

  private rutfRepo(db: DataSource): Repository<RutfDispensing> {
    return db.getRepository(RutfDispensing);
  }

  private feedingRepo(db: DataSource): Repository<TherapeuticFeedingRecord> {
    return db.getRepository(TherapeuticFeedingRecord);
  }

  private patientRepo(db: DataSource): Repository<Patient> {
    return db.getRepository(Patient);
  }

  private async resolvePatient(db: DataSource, patientId: string): Promise<Patient | null> {
    return this.patientRepo(db).findOne({ where: { id: patientId } });
  }

  // Legacy nutrition endpoints used by patient detail flows.
  async addScreening(tenantId: string, dto: any) {
    const db = await this.getDb(tenantId);
    const repo = this.screeningRepo(db);
    return repo.save(repo.create({ ...dto, screenedAt: dto.screenedAt || new Date() }));
  }

  async getScreenings(tenantId: string, patientId: string) {
    const db = await this.getDb(tenantId);
    return this.screeningRepo(db).find({
      where: { patientId },
      order: { screenedAt: 'DESC' },
      take: 20,
    });
  }

  async addAssessment(tenantId: string, dto: any) {
    const db = await this.getDb(tenantId);
    const repo = this.legacyAssessmentRepo(db);
    return repo.save(repo.create(dto));
  }

  async getLegacyAssessments(tenantId: string, patientId: string) {
    const db = await this.getDb(tenantId);
    return this.legacyAssessmentRepo(db).find({
      where: { patientId },
      order: { assessmentDate: 'DESC' },
    });
  }

  async addPrescription(tenantId: string, dto: any) {
    const db = await this.getDb(tenantId);
    const repo = this.prescriptionRepo(db);
    return repo.save(repo.create(dto));
  }

  async getPrescriptions(tenantId: string, patientId: string) {
    const db = await this.getDb(tenantId);
    return this.prescriptionRepo(db).find({
      where: { patientId },
      order: { prescriptionDate: 'DESC' },
    });
  }

  async updatePrescription(tenantId: string, id: string, dto: any) {
    const db = await this.getDb(tenantId);
    const repo = this.prescriptionRepo(db);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  async addMonitoring(tenantId: string, dto: any) {
    const db = await this.getDb(tenantId);
    const repo = this.monitoringRepo(db);
    return repo.save(repo.create(dto));
  }

  async getMonitoring(tenantId: string, patientId: string) {
    const db = await this.getDb(tenantId);
    return this.monitoringRepo(db).find({
      where: { patientId },
      order: { monitoringDate: 'DESC' },
      take: 30,
    });
  }

  async assess(tenantId: string, userId: string | undefined, body: Record<string, any>): Promise<NutritionAssessment> {
    const db = await this.getDb(tenantId);
    const patient = await this.resolvePatient(db, body.patientId);
    const whzScore = this.calculateWhz(body.weightKg, body.heightCm, patient?.gender);
    const muacClass =
      body.muacMm != null && body.muacMm !== ''
        ? this.classifyMuac(Number(body.muacMm))
        : 'normal';
    const whzClass =
      whzScore != null
        ? this.classifyWhz(whzScore, Boolean(body.bilateralPittingOedema))
        : this.classifyWhz(0, Boolean(body.bilateralPittingOedema));
    const classification = this.finalClassification(muacClass, whzClass);

    const repo = this.assessmentRepo(db);
    const assessment = repo.create({
      patientId: body.patientId,
      assessmentDate: this.normalizeDate(body.assessmentDate),
      assessedBy: body.assessedBy || userId || null,
      muacMm: body.muacMm ?? null,
      weightKg: body.weightKg ?? null,
      heightCm: body.heightCm ?? null,
      whzScore,
      bilateralPittingOedema: Boolean(body.bilateralPittingOedema),
      oedemaGrade:
        body.oedemaGrade && body.oedemaGrade !== 'none'
          ? body.oedemaGrade
          : null,
      classification,
      programType: body.programType || this.inferProgramType(classification, body.oedemaGrade),
      admissionType: body.admissionType ?? null,
      dischargeReason: null,
      dischargeDate: null,
      outcome: null,
      notes: body.notes ?? null,
    });

    return repo.save(assessment);
  }

  async getAssessments(tenantId: string, patientId: string): Promise<NutritionAssessment[]> {
    const db = await this.getDb(tenantId);
    return this.assessmentRepo(db).find({
      where: { patientId },
      order: { assessmentDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async updateAssessmentOutcome(tenantId: string, id: string, body: Record<string, any>) {
    const db = await this.getDb(tenantId);
    const repo = this.assessmentRepo(db);
    const assessment = await repo.findOne({ where: { id } });
    if (!assessment) {
      throw new NotFoundException('Nutrition assessment not found');
    }

    assessment.dischargeReason = body.dischargeReason ?? assessment.dischargeReason ?? null;
    assessment.outcome = body.outcome ?? assessment.outcome ?? null;
    assessment.dischargeDate = body.outcome ? this.normalizeDate(body.dischargeDate) : assessment.dischargeDate;

    return repo.save(assessment);
  }

  async dispenseRutf(tenantId: string, userId: string | undefined, body: Record<string, any>): Promise<RutfDispensing> {
    const db = await this.getDb(tenantId);
    const repo = this.rutfRepo(db);
    const record = repo.create({
      patientId: body.patientId,
      nutritionAssessmentId: body.nutritionAssessmentId ?? null,
      dispensedDate: this.normalizeDate(body.dispensedDate),
      dispensedBy: body.dispensedBy || userId || null,
      productName: body.productName,
      sachetsDispensed: body.sachetsDispensed ?? null,
      weightKg: body.weightKg ?? null,
      doseSachetsPerDay: body.doseSachetsPerDay ?? null,
      lotNumber: body.lotNumber ?? null,
      expiryDate: body.expiryDate ?? null,
      nextVisitDate: body.nextVisitDate ?? null,
    });
    return repo.save(record);
  }

  async getRutfHistory(tenantId: string, patientId: string): Promise<RutfDispensing[]> {
    const db = await this.getDb(tenantId);
    return this.rutfRepo(db).find({
      where: { patientId },
      order: { dispensedDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async recordFeeding(
    tenantId: string,
    userId: string | undefined,
    body: Record<string, any>,
  ): Promise<TherapeuticFeedingRecord> {
    const db = await this.getDb(tenantId);
    const repo = this.feedingRepo(db);
    const record = repo.create({
      patientId: body.patientId,
      admissionId: body.admissionId ?? null,
      feedingDate: this.normalizeDate(body.feedingDate),
      feedingPhase: body.feedingPhase,
      formula: body.formula,
      volumeMlPerFeed: body.volumeMlPerFeed ?? null,
      feedsPerDay: body.feedsPerDay ?? null,
      weightKg: body.weightKg ?? null,
      notedBy: body.notedBy || userId || null,
      notes: body.notes ?? null,
    });
    return repo.save(record);
  }

  async getFeedingRecords(tenantId: string, patientId: string): Promise<TherapeuticFeedingRecord[]> {
    const db = await this.getDb(tenantId);
    return this.feedingRepo(db).find({
      where: { patientId },
      order: { feedingDate: 'DESC', createdAt: 'DESC' },
    });
  }

  private async getRegister(tenantId: string, programType: string, filters: RegisterFilters) {
    const db = await this.getDb(tenantId);
    const page = this.page(filters.page);
    const limit = this.limit(filters.limit);
    const offset = (page - 1) * limit;
    const repo = this.assessmentRepo(db);

    const qb = repo
      .createQueryBuilder('assessment')
      .where('assessment.program_type = :programType', { programType })
      .andWhere('assessment.outcome IS NULL')
      .orderBy('assessment.assessment_date', 'DESC')
      .addOrderBy('assessment.created_at', 'DESC');

    if (filters.from) {
      qb.andWhere('assessment.assessment_date >= :fromDate', { fromDate: filters.from });
    }
    if (filters.to) {
      qb.andWhere('assessment.assessment_date <= :toDate', { toDate: filters.to });
    }

    const total = await qb.getCount();
    const data = await qb.take(limit).skip(offset).getMany();
    return { data, total, page, limit };
  }

  async getOtpRegister(tenantId: string, filters: RegisterFilters) {
    return this.getRegister(tenantId, 'OTP', filters);
  }

  async getScRegister(tenantId: string, filters: RegisterFilters) {
    return this.getRegister(tenantId, 'SC', filters);
  }

  async getTsfpRegister(tenantId: string, filters: RegisterFilters) {
    return this.getRegister(tenantId, 'TSFP', filters);
  }

  async getCmamReport(tenantId: string, period: string) {
    if (!/^\d{4}-\d{2}$/.test(period)) {
      throw new BadRequestException('Period must be in YYYY-MM format');
    }

    const db = await this.getDb(tenantId);
    const start = `${period}-01`;
    const startDate = new Date(`${start}T00:00:00Z`);
    const endDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 1));
    const end = endDate.toISOString().slice(0, 10);

    const [rows, activeResult] = await Promise.all([
      db.query(
        `
          SELECT
            classification,
            COALESCE(outcome, 'active') AS outcome_key,
            COUNT(*)::int AS total
          FROM nutrition_assessments
          WHERE assessment_date >= $1
            AND assessment_date < $2
          GROUP BY classification, COALESCE(outcome, 'active')
        `,
        [start, end],
      ),
      db.query(
        `
          SELECT COUNT(*)::int AS active_cases
          FROM nutrition_assessments
          WHERE assessment_date >= $1
            AND assessment_date < $2
            AND outcome IS NULL
        `,
        [start, end],
      ),
    ]);

    const summary = {
      period,
      totalAdmissions: 0,
      samCount: 0,
      mamCount: 0,
      normalCount: 0,
      recovered: 0,
      defaulted: 0,
      died: 0,
      activeCases: Number(activeResult?.[0]?.active_cases ?? 0),
      coverage: 0,
      outcomes: {} as Record<string, number>,
    };

    for (const row of rows as Array<Record<string, any>>) {
      const total = Number(row.total ?? 0);
      const classification = String(row.classification || '').toUpperCase();
      const outcomeKey = String(row.outcome_key || 'active').toLowerCase();

      summary.totalAdmissions += total;
      summary.outcomes[outcomeKey] = (summary.outcomes[outcomeKey] || 0) + total;

      if (classification === 'SAM') summary.samCount += total;
      if (classification === 'MAM') summary.mamCount += total;
      if (classification === 'NORMAL') summary.normalCount += total;
      if (outcomeKey === 'recovered') summary.recovered += total;
      if (outcomeKey === 'defaulted') summary.defaulted += total;
      if (outcomeKey === 'died') summary.died += total;
    }

    summary.coverage = summary.totalAdmissions;
    return summary;
  }

  async screenNutrition(body: any, tenantId?: string, tenantDb?: any) {
    return this.cdssService.screenNutritionRisk(body, tenantId, tenantDb);
  }

  async prescribeNutrition(body: any, tenantId?: string, tenantDb?: any) {
    return this.cdssService.prescribeNutritionPlan(body, tenantId, tenantDb);
  }

  async refeedingRisk(body: any, tenantId?: string, tenantDb?: any) {
    return this.cdssService.assessNutritionRefeedingRisk(body, tenantId, tenantDb);
  }
}
