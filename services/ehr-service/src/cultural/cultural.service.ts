import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantService } from '../services/tenant.service';
import { CdssService } from '../services/cdss.service';
import { TraditionalMedicineService } from '../services/traditional-medicine.service';
import { HdiAlert } from '../entities/hdi-alert.entity';
import { Patient } from '../entities/patient.entity';
import { SocialDeterminant } from './entities/social-determinant.entity';
import { FamilyCouncilConsent } from './entities/family-council-consent.entity';
import { UbuntuWellbeingAssessment } from './entities/ubuntu-wellbeing-assessment.entity';

@Injectable()
export class CulturalService {
  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
    private readonly traditionalMedicineService: TraditionalMedicineService,
  ) {}

  async upsertSocialDeterminants(
    tenantId: string,
    dto: Partial<SocialDeterminant> & Record<string, any>,
  ): Promise<SocialDeterminant> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(SocialDeterminant);
    const patient = await db.getRepository(Patient).findOne({ where: { id: dto.patientId } });
    const existing = await repo.findOne({ where: { patientId: dto.patientId } });
    const risk = await this.assessSdohRisk(tenantId, dto, patient);

    const entity = repo.create({
      ...(existing || {}),
      ...dto,
      socialGrantTypes: Array.isArray(dto.socialGrantTypes) ? dto.socialGrantTypes : existing?.socialGrantTypes || [],
      communityGroupTypes: Array.isArray(dto.communityGroupTypes) ? dto.communityGroupTypes : existing?.communityGroupTypes || [],
      sdohRiskScore: this.toNullableNumber(risk?.sdoh_risk_score),
      sdohRiskLevel: this.toNullableString(risk?.sdoh_risk_level),
      socialWorkerReferralNeeded: Boolean(risk?.social_worker_referral_needed),
      updatedAt: new Date(),
    });

    return repo.save(entity) as unknown as SocialDeterminant;
  }

  async getSocialDeterminants(tenantId: string, patientId: string): Promise<SocialDeterminant | null> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(SocialDeterminant).findOne({ where: { patientId } });
  }

  async getSdohRisk(tenantId: string, patientId: string): Promise<Record<string, any>> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(SocialDeterminant);
    const record = await repo.findOne({ where: { patientId } });
    if (!record) {
      throw new NotFoundException('Social determinants record not found');
    }

    const stale = !record.updatedAt || Date.now() - new Date(record.updatedAt).getTime() > 30 * 24 * 60 * 60 * 1000;
    if (stale || record.sdohRiskScore === null || record.sdohRiskScore === undefined) {
      const patient = await db.getRepository(Patient).findOne({ where: { id: patientId } });
      const risk = await this.assessSdohRisk(tenantId, record, patient);
      await repo.update(record.id, {
        sdohRiskScore: this.toNullableNumber(risk?.sdoh_risk_score),
        sdohRiskLevel: this.toNullableString(risk?.sdoh_risk_level),
        socialWorkerReferralNeeded: Boolean(risk?.social_worker_referral_needed),
      });
      return risk;
    }

    return {
      sdoh_risk_score: record.sdohRiskScore,
      sdoh_risk_level: record.sdohRiskLevel,
      social_worker_referral_needed: record.socialWorkerReferralNeeded,
    };
  }

  async recordFamilyCouncilConsent(
    tenantId: string,
    userId: string | null,
    dto: Partial<FamilyCouncilConsent>,
  ): Promise<FamilyCouncilConsent> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(FamilyCouncilConsent);
    const entity = repo.create({
      ...dto,
      familyMembersPresent: Array.isArray(dto.familyMembersPresent) ? dto.familyMembersPresent : [],
      documentedBy: dto.documentedBy ?? userId,
    });
    return repo.save(entity) as unknown as FamilyCouncilConsent;
  }

  async getFamilyConsents(tenantId: string, patientId: string): Promise<FamilyCouncilConsent[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(FamilyCouncilConsent).find({
      where: { patientId },
      order: { meetingDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async getConsent(tenantId: string, id: string): Promise<FamilyCouncilConsent> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const record = await db.getRepository(FamilyCouncilConsent).findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('Family council consent not found');
    }
    return record;
  }

  async recordWellbeingAssessment(
    tenantId: string,
    userId: string | null,
    dto: Partial<UbuntuWellbeingAssessment> & Record<string, any>,
  ): Promise<UbuntuWellbeingAssessment> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(UbuntuWellbeingAssessment);
    const patient = await db.getRepository(Patient).findOne({ where: { id: dto.patientId } });
    const guidance = await this.cdssService.culturalUbuntuPsychosocial(
      {
        social_connectedness: dto.socialConnectedness,
        community_belonging: dto.communityBelonging,
        spiritual_wellbeing: dto.spiritualWellbeing,
        grief_bereavement: Boolean(dto.griefBereavement),
        grief_type: dto.griefType ?? null,
        traditional_healer_active: Boolean(dto.currentlyUsingTraditionalHealer),
        traditional_healer_treatment: dto.traditionalHealerTreatment ?? null,
        phq9_score: this.toNullableNumber(dto.phq9Score),
        gad7_score: this.toNullableNumber(dto.gad7Score),
        stigma_experienced: Boolean(dto.stigmaExperienced),
        help_seeking_barriers: Array.isArray(dto.helpSeekingBarriers) ? dto.helpSeekingBarriers : [],
        chronic_illness: Boolean(patient?.medicalHistory),
        hiv_positive: this.inferHivPositive(patient),
      },
      tenantId,
    );

    const recommendations = Array.isArray(guidance?.culturally_adapted_interventions)
      ? guidance.culturally_adapted_interventions.join('; ')
      : this.toNullableString(guidance?.referral_recommendations?.join?.('; '));

    const entity = repo.create({
      ...dto,
      assessedBy: dto.assessedBy ?? userId,
      helpSeekingBarriers: Array.isArray(dto.helpSeekingBarriers) ? dto.helpSeekingBarriers : [],
      herbDrugInteractionRisk: this.toNullableString(guidance?.herb_drug_interaction_risk),
      cdssPsychosocialRisk: this.toNullableString(guidance?.psychosocial_risk),
      cdssRecommendation: recommendations,
      cdssConfidence: this.toNullableNumber(guidance?.confidence),
    });

    const saved = await repo.save(entity) as unknown as UbuntuWellbeingAssessment;

    if (saved.herbDrugInteractionRisk === 'high' && saved.traditionalHealerTreatment) {
      const herbs = this.extractHerbTerms(saved.traditionalHealerTreatment);
      if (herbs.length > 0) {
        await this.traditionalMedicineService.checkInteractions(tenantId, saved.patientId, herbs);
      }
    }

    return saved;
  }

  async getWellbeingHistory(tenantId: string, patientId: string): Promise<UbuntuWellbeingAssessment[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(UbuntuWellbeingAssessment).find({
      where: { patientId },
      order: { assessmentDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async getWellbeingAssessment(tenantId: string, id: string): Promise<UbuntuWellbeingAssessment> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const record = await db.getRepository(UbuntuWellbeingAssessment).findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('Ubuntu wellbeing assessment not found');
    }
    return record;
  }

  async getCulturalSummary(tenantId: string, patientId: string): Promise<Record<string, any>> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const sdoh = await db.getRepository(SocialDeterminant).findOne({ where: { patientId } });
    const latestWellbeing = await db.getRepository(UbuntuWellbeingAssessment).findOne({
      where: { patientId },
      order: { assessmentDate: 'DESC', createdAt: 'DESC' },
    });
    const consentCount = await db.getRepository(FamilyCouncilConsent).count({ where: { patientId } });
    const tmHighAlertCount = await db.getRepository(HdiAlert)
      .createQueryBuilder('alert')
      .where('alert.patient_id = :patientId', { patientId })
      .andWhere("alert.severity IN ('contraindicated', 'major')")
      .getCount();

    return {
      patientId,
      sdohRiskScore: sdoh?.sdohRiskScore ?? null,
      sdohRiskLevel: sdoh?.sdohRiskLevel ?? null,
      socialWorkerReferralNeeded: sdoh?.socialWorkerReferralNeeded ?? false,
      wellbeingRisk: latestWellbeing?.cdssPsychosocialRisk ?? null,
      herbDrugInteractionRisk: latestWellbeing?.herbDrugInteractionRisk ?? null,
      familyConsentCount: consentCount,
      tmInteractionFlag: tmHighAlertCount > 0 || latestWellbeing?.herbDrugInteractionRisk === 'high',
    };
  }

  private async assessSdohRisk(
    tenantId: string,
    dto: Partial<SocialDeterminant> & Record<string, any>,
    patient: Patient | null,
  ): Promise<Record<string, any>> {
    return this.cdssService.culturalSdohRisk(
      {
        food_insecurity: dto.foodInsecurity ?? 'unknown',
        housing_type: dto.housingType ?? 'unknown',
        household_income_usd_month: this.toNullableNumber(dto.householdIncomeUsdMonth),
        employment_status: dto.employmentStatus ?? 'unknown',
        social_grant_recipient: Boolean(dto.socialGrantRecipient),
        education_level: dto.educationLevel ?? 'unknown',
        gbv_screen_positive: dto.gbvScreenPositive ?? null,
        child_protection_concern: Boolean(dto.childProtectionConcern),
        extended_family_support: dto.extendedFamilySupport ?? 'unknown',
        chronic_disease: Boolean(patient?.medicalHistory),
        hiv_positive: this.inferHivPositive(patient),
        pregnant: this.inferPregnancy(patient),
      },
      tenantId,
    );
  }

  private inferHivPositive(patient: Patient | null): boolean {
    return Boolean(patient?.medicalHistory && /hiv|art|antiretroviral/i.test(patient.medicalHistory));
  }

  private inferPregnancy(patient: Patient | null): boolean {
    return Boolean(patient?.medicalHistory && /pregnan|antenatal|obstetric/i.test(patient.medicalHistory));
  }

  private extractHerbTerms(value: string): string[] {
    return value
      .split(/[,/;]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 1)
      .slice(0, 8);
  }

  private toNullableNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  private toNullableString(value: any): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }
}
