import { Injectable } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CervicalScreening } from '../entities/cervical-screening.entity';
import { CervicalTreatment } from '../entities/cervical-treatment.entity';

@Injectable()
export class CervicalCancerService {
  constructor(private readonly tenantService: TenantService) {}

  async recordScreening(
    tenantId: string,
    screenedBy: string | null,
    dto: Partial<CervicalScreening>,
  ): Promise<CervicalScreening> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(CervicalScreening);
    const entity = repo.create({
      ...dto,
      screenedBy: screenedBy ?? dto.screenedBy,
    } as Partial<CervicalScreening>);
    return repo.save(entity) as unknown as CervicalScreening;
  }

  async getScreenings(tenantId: string, patientId: string): Promise<CervicalScreening[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(CervicalScreening).find({
      where: { patientId },
      order: { screenedAt: 'DESC' },
    });
  }

  async getLatestScreening(tenantId: string, patientId: string): Promise<CervicalScreening | null> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(CervicalScreening).findOne({
      where: { patientId },
      order: { screenedAt: 'DESC' },
    });
  }

  async recordTreatment(
    tenantId: string,
    treatedBy: string | null,
    dto: Partial<CervicalTreatment>,
  ): Promise<CervicalTreatment> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(CervicalTreatment);
    const entity = repo.create({
      ...dto,
      treatedBy: treatedBy ?? dto.treatedBy,
    } as Partial<CervicalTreatment>);
    return repo.save(entity) as unknown as CervicalTreatment;
  }

  async getTreatments(tenantId: string, patientId: string): Promise<CervicalTreatment[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(CervicalTreatment).find({
      where: { patientId },
      order: { treatedAt: 'DESC' },
    });
  }

  async getScreenTreatRecommendation(
    method: string,
    result: string,
    acetowhiteAreaPct?: number,
    hpvGenotype?: string,
    lesionLocation?: string,
  ): Promise<Record<string, any>> {
    return this.localScreenTreatRecommend(
      method,
      result,
      acetowhiteAreaPct,
      hpvGenotype,
      lesionLocation,
    );
  }

  private localScreenTreatRecommend(
    method: string,
    result: string,
    acetowhiteAreaPct?: number,
    hpvGenotype?: string,
    lesionLocation?: string,
  ): Record<string, any> {
    const methodUpper = String(method || '').toUpperCase();
    const resultLower = String(result || '').toLowerCase();

    if (resultLower === 'suspicious_cancer') {
      return {
        recommendation: 'refer_cancer_treatment',
        action: 'Refer urgently to oncology or cancer treatment centre',
        eligible_for_ablative_treatment: false,
        refer_specialist: true,
        urgency: 'urgent',
        guideline: 'WHO Cervical Cancer Prevention & Control (2021)',
      };
    }

    if (resultLower === 'negative') {
      const genotype = String(hpvGenotype || '').toLowerCase();
      const nextYears =
        methodUpper === 'HPV' && (genotype.includes('16') || genotype.includes('18')) ? 1 : 3;
      return {
        recommendation: 'routine_rescreening',
        action: `Result negative. Rescreening recommended in ${nextYears} year(s).`,
        eligible_for_ablative_treatment: false,
        refer_specialist: false,
        urgency: 'routine',
        guideline: 'WHO Cervical Cancer Prevention & Control (2021)',
      };
    }

    if (methodUpper === 'VIA' || methodUpper === 'VILI') {
      const smallLesion = (acetowhiteAreaPct ?? 100) <= 75;
      const normalizedLocation = String(lesionLocation || '').toLowerCase();
      const ectocervixLocation =
        !normalizedLocation ||
        normalizedLocation === 'ectocervix' ||
        normalizedLocation === 'squamocolumnar_junction';
      const cryoEligible = smallLesion && ectocervixLocation;

      return {
        recommendation: cryoEligible ? 'cryotherapy' : 'refer_leep',
        action: cryoEligible
          ? 'Lesion eligible for cryotherapy. Treat same day (screen-and-treat). Schedule follow-up in 12 months.'
          : 'Lesion not eligible for cryotherapy (too large or extends into endocervix). Refer for LEEP/LLETZ.',
        eligible_for_ablative_treatment: cryoEligible,
        refer_specialist: !cryoEligible,
        urgency: 'same_day',
        guideline: 'WHO Cervical Cancer Prevention & Control (2021)',
      };
    }

    if (methodUpper === 'HPV') {
      const highRisk1618 = hpvGenotype === '16_18';
      return {
        recommendation: highRisk1618 ? 'refer_colposcopy' : 'via_triage',
        action: highRisk1618
          ? 'HPV 16/18 positive. Refer for colposcopy and biopsy.'
          : 'HPV positive (non-16/18). Perform VIA triage. If VIA positive, treat; if negative, rescreening in 12 months.',
        eligible_for_ablative_treatment: false,
        refer_specialist: highRisk1618,
        urgency: highRisk1618 ? 'within_4_weeks' : 'routine',
        guideline: 'WHO Cervical Cancer Prevention & Control (2021)',
      };
    }

    return {
      recommendation: 'clinical_review',
      action: 'Discuss results with clinician.',
      eligible_for_ablative_treatment: false,
      refer_specialist: false,
      urgency: 'routine',
      guideline: 'WHO Cervical Cancer Prevention & Control (2021)',
    };
  }
}
