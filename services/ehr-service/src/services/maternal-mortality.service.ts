import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { MaternalDeath } from '../entities/maternal-death.entity';
import { MaternalDeathReview } from '../entities/maternal-death-review.entity';
import { EmoncSignal } from '../entities/emonc-signal.entity';

@Injectable()
export class MaternalMortalityService {
  private readonly logger = new Logger(MaternalMortalityService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  private async getTenantDb(tenantId: string): Promise<DataSource> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    if (!db) {
      throw new ServiceUnavailableException('Tenant database connection unavailable');
    }
    return db;
  }

  async reportDeath(
    tenantId: string,
    reportedBy: string,
    dto: Partial<MaternalDeath>,
  ): Promise<{ death: MaternalDeath; auditGuidance: Record<string, any> }> {
    const db = await this.getTenantDb(tenantId);
    const repo = db.getRepository(MaternalDeath);
    const entity = repo.create({
      ...dto,
      reportedBy,
      deathDate: dto.deathDate ?? new Date().toISOString().slice(0, 10),
      contributingCauses: dto.contributingCauses ?? [],
      avoidabilityFactors: dto.avoidabilityFactors ?? [],
    } as Partial<MaternalDeath>);
    const death = (await repo.save(entity)) as MaternalDeath;

    let auditGuidance: Record<string, any> = { abstained: true };
    try {
      auditGuidance = await this.cdssService.maternalDeathAuditReview(
        {
          death_category: death.deathCategory,
          primary_cause: death.primaryCause ?? undefined,
          delay_1_recognition: death.delay1Recognition ?? undefined,
          delay_2_reaching: death.delay2Reaching ?? undefined,
          delay_3_care: death.delay3Care ?? undefined,
          gestational_age_weeks: death.gestationalAgeWeeks ?? undefined,
          mode_of_admission: death.modeOfAdmission ?? undefined,
          contributing_causes: Array.isArray(death.contributingCauses)
            ? death.contributingCauses.map((item) => (typeof item === 'string' ? item : item?.cause || JSON.stringify(item)))
            : [],
        },
        tenantId,
      );
    } catch (error: any) {
      this.logger.warn(`Maternal death audit review unavailable for ${death.id}: ${error?.message}`);
    }

    return { death, auditGuidance };
  }

  async listDeaths(
    tenantId: string,
    options: { from?: string; to?: string; reviewStatus?: string } = {},
  ): Promise<MaternalDeath[]> {
    const db = await this.getTenantDb(tenantId);
    const qb = db.getRepository(MaternalDeath).createQueryBuilder('md');

    if (options.from) {
      qb.andWhere('md.deathDate >= :from', { from: options.from });
    }
    if (options.to) {
      qb.andWhere('md.deathDate <= :to', { to: options.to });
    }
    if (options.reviewStatus) {
      qb.andWhere('md.reviewStatus = :reviewStatus', { reviewStatus: options.reviewStatus });
    }

    return qb.orderBy('md.deathDate', 'DESC').addOrderBy('md.createdAt', 'DESC').getMany();
  }

  async updateDeathReviewStatus(
    tenantId: string,
    deathId: string,
    reviewStatus: string,
  ): Promise<MaternalDeath> {
    const db = await this.getTenantDb(tenantId);
    const repo = db.getRepository(MaternalDeath);
    const death = await repo.findOneBy({ id: deathId });

    if (!death) {
      throw new NotFoundException('Maternal death record not found');
    }

    await repo.update(deathId, { reviewStatus });
    return repo.findOneByOrFail({ id: deathId });
  }

  async createReview(
    tenantId: string,
    reviewedBy: string,
    dto: Partial<MaternalDeathReview>,
  ): Promise<MaternalDeathReview> {
    const db = await this.getTenantDb(tenantId);
    const deathRepo = db.getRepository(MaternalDeath);
    const reviewRepo = db.getRepository(MaternalDeathReview);
    const parentDeath = await deathRepo.findOneBy({ id: dto.maternalDeathId! });

    if (!parentDeath) {
      throw new NotFoundException('Maternal death record not found for review');
    }

    const entity = reviewRepo.create({
      ...dto,
      reviewedBy,
      reviewDate: dto.reviewDate ?? new Date().toISOString().slice(0, 10),
      reviewTeam: dto.reviewTeam ?? [],
      recommendations: dto.recommendations ?? [],
    } as Partial<MaternalDeathReview>);

    const saved = (await reviewRepo.save(entity)) as MaternalDeathReview;
    await deathRepo.update(parentDeath.id, {
      reviewStatus: saved.reviewComplete ? 'completed' : 'under_review',
    });

    return saved;
  }

  async getReviews(tenantId: string, maternalDeathId: string): Promise<MaternalDeathReview[]> {
    const db = await this.getTenantDb(tenantId);
    return db.getRepository(MaternalDeathReview).find({
      where: { maternalDeathId },
      order: { createdAt: 'DESC' },
    });
  }

  async recordEmoncAssessment(
    tenantId: string,
    recordedBy: string,
    dto: Partial<EmoncSignal>,
  ): Promise<{ signal: EmoncSignal; classification: Record<string, any> }> {
    const db = await this.getTenantDb(tenantId);

    let classification: Record<string, any> = { abstained: true };
    try {
      classification = await this.cdssService.maternalEmoncClassify(
        {
          sf1_parenteral_antibiotics: dto.sf1ParenteralAntibiotics ?? 'unknown',
          sf2_parenteral_oxytocics: dto.sf2ParenteralOxytocics ?? 'unknown',
          sf3_parenteral_anticonvulsants: dto.sf3ParenteralAnticonvulsants ?? 'unknown',
          sf4_manual_removal_placenta: dto.sf4ManualRemovalPlacenta ?? 'unknown',
          sf5_removal_retained_products: dto.sf5RemovalRetainedProducts ?? 'unknown',
          sf6_neonatal_resuscitation: dto.sf6NeonatalResuscitation ?? 'unknown',
          sf7_assisted_vaginal_delivery: dto.sf7AssistedVaginalDelivery ?? 'unknown',
          sf8_caesarean_section: dto.sf8CaesareanSection ?? 'unknown',
          sf9_blood_transfusion: dto.sf9BloodTransfusion ?? 'unknown',
        },
        tenantId,
      );
    } catch (error: any) {
      this.logger.warn(`EmONC classification unavailable: ${error?.message}`);
    }

    const entity = db.getRepository(EmoncSignal).create({
      ...dto,
      recordedBy,
      assessmentDate: dto.assessmentDate ?? new Date().toISOString().slice(0, 10),
      barriers: dto.barriers ?? {},
      emoncClassification: classification?.classification ?? null,
    } as Partial<EmoncSignal>);
    const signal = (await db.getRepository(EmoncSignal).save(entity)) as EmoncSignal;

    return { signal, classification };
  }

  async getLatestEmoncAssessment(tenantId: string, facilityId?: string): Promise<EmoncSignal | null> {
    const db = await this.getTenantDb(tenantId);
    const qb = db.getRepository(EmoncSignal).createQueryBuilder('es').orderBy('es.assessmentDate', 'DESC').limit(1);

    if (facilityId) {
      qb.where('es.facilityId = :facilityId', { facilityId });
    }

    return qb.getOne();
  }

  async getEmoncHistory(tenantId: string, facilityId?: string): Promise<EmoncSignal[]> {
    const db = await this.getTenantDb(tenantId);
    const qb = db.getRepository(EmoncSignal).createQueryBuilder('es').orderBy('es.assessmentDate', 'DESC').limit(12);

    if (facilityId) {
      qb.where('es.facilityId = :facilityId', { facilityId });
    }

    return qb.getMany();
  }

  async getMortalitySummary(
    tenantId: string,
    year: number,
  ): Promise<{
    totalDeaths: number;
    nearMisses: number;
    byCategory: Record<string, number>;
    byDelay: { delay1: number; delay2: number; delay3: number };
    reviewCompletion: { pending: number; completed: number; total: number };
    mmr: number | null;
  }> {
    const db = await this.getTenantDb(tenantId);
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    const repo = db.getRepository(MaternalDeath);
    const records = await repo
      .createQueryBuilder('md')
      .where('md.deathDate >= :startDate AND md.deathDate <= :endDate', { startDate, endDate })
      .orderBy('md.deathDate', 'DESC')
      .getMany();

    const deaths = records.filter((record) => record.isNearMiss !== true);
    const nearMisses = records.filter((record) => record.isNearMiss === true).length;
    const byCategory: Record<string, number> = {};
    let delay1 = 0;
    let delay2 = 0;
    let delay3 = 0;

    for (const record of deaths) {
      byCategory[record.deathCategory] = (byCategory[record.deathCategory] ?? 0) + 1;
      if (record.delay1Recognition) {
        delay1 += 1;
      }
      if (record.delay2Reaching) {
        delay2 += 1;
      }
      if (record.delay3Care) {
        delay3 += 1;
      }
    }

    const pending = deaths.filter((record) => ['pending', 'under_review'].includes(record.reviewStatus)).length;
    const completed = deaths.filter((record) => record.reviewStatus === 'completed').length;

    return {
      totalDeaths: deaths.length,
      nearMisses,
      byCategory,
      byDelay: { delay1, delay2, delay3 },
      reviewCompletion: { pending, completed, total: deaths.length },
      mmr: null,
    };
  }
}
