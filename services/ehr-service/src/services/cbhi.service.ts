import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { CbhiHousehold } from '../cbhi/entities/cbhi-household.entity';
import { CbhiHouseholdMember } from '../cbhi/entities/cbhi-household-member.entity';
import { CbhiContribution } from '../cbhi/entities/cbhi-contribution.entity';
import { CbhiClaim } from '../cbhi/entities/cbhi-claim.entity';
import { Patient } from '../entities/patient.entity';

@Injectable()
export class CbhiService {
  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  async registerHousehold(tenantId: string, dto: Partial<CbhiHousehold>): Promise<CbhiHousehold> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(CbhiHousehold);
    const entity = repo.create(dto);
    return repo.save(entity) as unknown as CbhiHousehold;
  }

  async getHouseholds(tenantId: string, schemeId?: string): Promise<CbhiHousehold[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(CbhiHousehold).find({
      where: schemeId ? { schemeId } : {},
      order: { createdAt: 'DESC' },
    });
  }

  async getHousehold(tenantId: string, id: string): Promise<any> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const householdRepo = db.getRepository(CbhiHousehold);
    const memberRepo = db.getRepository(CbhiHouseholdMember);
    const contributionRepo = db.getRepository(CbhiContribution);
    const claimRepo = db.getRepository(CbhiClaim);
    const household = await householdRepo.findOne({ where: { id } });
    if (!household) {
      throw new NotFoundException('CBHI household not found');
    }
    const [members, contributions, claims] = await Promise.all([
      memberRepo.find({ where: { householdId: id }, order: { createdAt: 'DESC' } }),
      contributionRepo.find({ where: { householdId: id }, order: { paymentDate: 'DESC' } }),
      claimRepo.find({ where: { householdId: id }, order: { submittedAt: 'DESC' } }),
    ]);
    return { ...household, members, contributions, claims };
  }

  async updateHousehold(tenantId: string, id: string, dto: Partial<CbhiHousehold>): Promise<CbhiHousehold> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(CbhiHousehold);
    await repo.update(id, dto as object);
    const updated = await repo.findOne({ where: { id } });
    if (!updated) {
      throw new NotFoundException('CBHI household not found');
    }
    return updated;
  }

  async verifyMembership(
    tenantId: string,
    patientId: string,
  ): Promise<{ active: boolean; household: CbhiHousehold | null; message: string }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const member = await db.getRepository(CbhiHouseholdMember).findOne({
      where: { patientId, memberStatus: 'active' },
    });
    if (!member) {
      return { active: false, household: null, message: 'Patient not enrolled in CBHI' };
    }
    const household = await db.getRepository(CbhiHousehold).findOne({ where: { id: member.householdId } });
    if (!household) {
      return { active: false, household: null, message: 'Household record missing' };
    }
    if (household.membershipStatus !== 'active' && household.membershipStatus !== 'exempted') {
      return { active: false, household, message: `Household membership is ${household.membershipStatus}` };
    }
    if (household.membershipExpiryDate && new Date(household.membershipExpiryDate) < new Date()) {
      return { active: false, household, message: 'Membership expired' };
    }
    return { active: true, household, message: 'Active CBHI member' };
  }

  async addMember(
    tenantId: string,
    householdId: string,
    dto: Partial<CbhiHouseholdMember>,
  ): Promise<CbhiHouseholdMember> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const memberRepo = db.getRepository(CbhiHouseholdMember);
    const householdRepo = db.getRepository(CbhiHousehold);
    const entity = memberRepo.create({
      ...dto,
      householdId,
      joinedDate: dto.joinedDate || new Date().toISOString().slice(0, 10),
    });
    const saved = await memberRepo.save(entity) as unknown as CbhiHouseholdMember;
    const count = await memberRepo.count({ where: { householdId, memberStatus: 'active' } });
    await householdRepo.update(householdId, { memberCount: count });
    return saved;
  }

  async recordContribution(tenantId: string, dto: Partial<CbhiContribution>): Promise<CbhiContribution> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(CbhiContribution);
    const householdRepo = db.getRepository(CbhiHousehold);
    const entity = repo.create(dto);
    const saved = await repo.save(entity) as unknown as CbhiContribution;
    const total = await this.getHouseholdContributionTotal(tenantId, dto.householdId!);
    if (total > 0) {
      await householdRepo.update(dto.householdId!, { membershipStatus: 'active' });
    }
    return saved;
  }

  async getContributions(tenantId: string, householdId: string): Promise<CbhiContribution[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(CbhiContribution).find({
      where: { householdId },
      order: { paymentDate: 'DESC' },
    });
  }

  async getHouseholdContributionTotal(tenantId: string, householdId: string): Promise<number> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const result = await db.getRepository(CbhiContribution)
      .createQueryBuilder('c')
      .select('SUM(c.amount_paid)', 'total')
      .where('c.household_id = :householdId', { householdId })
      .andWhere('c.payment_status = :status', { status: 'confirmed' })
      .getRawOne();
    return parseFloat(result?.total ?? '0');
  }

  async submitClaim(tenantId: string, dto: Partial<CbhiClaim>): Promise<CbhiClaim> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(CbhiClaim);
    const patientRepo = db.getRepository(Patient);
    const claimNumber = `CLM-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const entity = repo.create({
      ...dto,
      claimNumber,
      submittedAt: new Date(),
    });
    const saved = await repo.save(entity) as unknown as CbhiClaim;

    try {
      const [patient, claimHistory] = await Promise.all([
        patientRepo.findOne({ where: { id: saved.patientId } }),
        repo.createQueryBuilder('claim')
          .where('claim.patient_id = :patientId', { patientId: saved.patientId })
          .andWhere('claim.scheme_id = :schemeId', { schemeId: saved.schemeId })
          .andWhere('claim.principal_diagnosis_icd = :diagnosis', { diagnosis: saved.principalDiagnosisIcd })
          .andWhere("claim.submitted_at >= NOW() - INTERVAL '90 days'")
          .getCount(),
      ]);
      const adjudication = await this.cdssService.cbhiClaimAdjudication(
        {
          claim_number: claimNumber,
          scheme_id: saved.schemeId,
          principal_diagnosis_icd: saved.principalDiagnosisIcd,
          secondary_diagnoses: Array.isArray(saved.secondaryDiagnoses) ? saved.secondaryDiagnoses : [],
          procedures: Array.isArray(saved.procedures) ? saved.procedures : [],
          total_billed: Number(saved.totalBilled || 0),
          claimed_amount: Number(saved.claimedAmount || 0),
          length_of_stay_days: this.lengthOfStay(saved.admissionDate, saved.dischargeDate),
          patient_age_years: patient ? this.calculateAge(patient.dateOfBirth) : 0,
          similar_claims_last_90_days: Math.max(0, claimHistory - 1),
          procedure_count: Array.isArray(saved.procedures) ? saved.procedures.length : 0,
        },
        tenantId,
      );
      await repo.update(saved.id, {
        cdssFraudScore: adjudication?.fraud_score ?? null,
        cdssApprovalRecommendation: adjudication?.approval_recommendation ?? null,
        cdssConfidence: adjudication?.confidence ?? null,
        cdssFlags: Array.isArray(adjudication?.flags) ? adjudication.flags : [],
        claimStatus: adjudication?.approval_recommendation === 'approve' ? 'approved' : 'under_review',
        approvedAmount: adjudication?.recommended_approved_amount ?? null,
      });
    } catch {}

    return repo.findOneOrFail({ where: { id: saved.id } });
  }

  async getClaims(
    tenantId: string,
    filters?: { schemeId?: string; status?: string },
  ): Promise<CbhiClaim[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const qb = db.getRepository(CbhiClaim).createQueryBuilder('c').orderBy('c.submitted_at', 'DESC');
    if (filters?.schemeId) qb.andWhere('c.scheme_id = :s', { s: filters.schemeId });
    if (filters?.status) qb.andWhere('c.claim_status = :st', { st: filters.status });
    return qb.getMany();
  }

  async adjudicateClaim(
    tenantId: string,
    id: string,
    decision: { status: string; approvedAmount: number; rejectionReason?: string; reviewedBy: string },
  ): Promise<CbhiClaim> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(CbhiClaim);
    await repo.update(id, {
      claimStatus: decision.status,
      approvedAmount: decision.approvedAmount,
      rejectionReason: decision.rejectionReason ?? null,
      reviewedBy: decision.reviewedBy,
      reviewedAt: new Date(),
      adjudicatedAt: new Date(),
    });
    return repo.findOneOrFail({ where: { id } });
  }

  async getCbhiSummary(tenantId: string, schemeId: string): Promise<Record<string, any>> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const householdRepo = db.getRepository(CbhiHousehold);
    const claimRepo = db.getRepository(CbhiClaim);
    const [households, activeHouseholds, indigent, claims, pendingClaims, flaggedClaims] = await Promise.all([
      householdRepo.count({ where: { schemeId } }),
      householdRepo.count({ where: { schemeId, membershipStatus: 'active' } }),
      householdRepo.count({ where: { schemeId, indigentStatus: true } }),
      claimRepo.count({ where: { schemeId } }),
      claimRepo.count({ where: { schemeId, claimStatus: 'submitted' } }),
      claimRepo.createQueryBuilder('c')
        .where('c.scheme_id = :schemeId', { schemeId })
        .andWhere("jsonb_array_length(COALESCE(c.cdss_flags, '[]'::jsonb)) > 0")
        .getCount(),
    ]);
    return { households, activeHouseholds, indigent, claims, pendingClaims, flaggedClaims };
  }

  private lengthOfStay(admissionDate?: string | null, dischargeDate?: string | null): number | null {
    if (!admissionDate || !dischargeDate) return null;
    const start = new Date(admissionDate);
    const end = new Date(dischargeDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
  }

  private calculateAge(dateOfBirth?: Date | string | null): number {
    if (!dateOfBirth) return 0;
    const birth = new Date(dateOfBirth);
    if (Number.isNaN(birth.getTime())) return 0;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age -= 1;
    }
    return Math.max(age, 0);
  }
}
