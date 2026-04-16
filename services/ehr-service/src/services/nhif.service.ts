import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { NhifScheme } from '../entities/nhif-scheme.entity';
import { SchemeMember } from '../entities/scheme-member.entity';
import { NhifClaim } from '../entities/nhif-claim.entity';
import { CapitationPayment } from '../entities/capitation-payment.entity';
import { NhifMember } from '../entities/nhif-member.entity';
import { CapitationClaim } from '../entities/capitation-claim.entity';
import { SchemeTariffSchedule } from '../entities/scheme-tariff-schedule.entity';

@Injectable()
export class NhifService {
  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  async createScheme(tenantId: string, body: any): Promise<NhifScheme> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(NhifScheme);
    const entity = repo.create(body);
    return repo.save(entity) as unknown as NhifScheme;
  }

  async getSchemes(tenantId: string, countryCode?: string): Promise<NhifScheme[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const where: any = { isActive: true };
    if (countryCode) where.countryCode = countryCode;
    return db.getRepository(NhifScheme).find({ where, order: { schemeName: 'ASC' } });
  }

  async enrollMember(tenantId: string, body: any): Promise<SchemeMember> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(SchemeMember);
    const entity = repo.create(body);
    return repo.save(entity) as unknown as SchemeMember;
  }

  async getMembersByPatient(tenantId: string, patientId: string): Promise<SchemeMember[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(SchemeMember).find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async submitClaim(tenantId: string, body: any): Promise<NhifClaim> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(NhifClaim);
    const entity = repo.create({ ...body, submittedAt: new Date() });
    return repo.save(entity) as unknown as NhifClaim;
  }

  async getClaims(
    tenantId: string,
    filters: { status?: string; schemeId?: string; from?: string; to?: string; page: number; limit: number },
  ): Promise<{ data: NhifClaim[]; total: number; page: number; limit: number }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const qb = db.getRepository(NhifClaim).createQueryBuilder('c').orderBy('c.claim_date', 'DESC');

    if (filters.status) {
      qb.andWhere('c.status = :status', { status: filters.status });
    }
    if (filters.schemeId) {
      qb.andWhere('c.nhif_scheme_id = :schemeId', { schemeId: filters.schemeId });
    }
    if (filters.from) {
      qb.andWhere('c.claim_date >= :from', { from: filters.from });
    }
    if (filters.to) {
      qb.andWhere('c.claim_date <= :to', { to: filters.to });
    }

    const total = await qb.getCount();
    const data = await qb.skip((filters.page - 1) * filters.limit).take(filters.limit).getMany();
    return { data, total, page: filters.page, limit: filters.limit };
  }

  async updateClaim(tenantId: string, id: string, body: any): Promise<NhifClaim | null> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(NhifClaim);
    await repo.update(id, body);
    return repo.findOne({ where: { id } });
  }

  async recordCapitationPayment(tenantId: string, body: any): Promise<CapitationPayment> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(CapitationPayment);
    const totalAmount = body.totalAmount ?? Number(body.memberCount || 0) * Number(body.ratePerMember || 0);
    const entity = repo.create({ ...body, totalAmount });
    return repo.save(entity) as unknown as CapitationPayment;
  }

  async getCapitationReport(tenantId: string, schemeId?: string): Promise<any[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const params: any[] = [];
    let where = '';
    if (schemeId) {
      where = 'WHERE nhif_scheme_id = $1';
      params.push(schemeId);
    }

    const rows: any[] = await db.query(
      `SELECT nhif_scheme_id, payment_month, member_count, rate_per_member, total_amount, currency, received_date, reference
       FROM capitation_payments ${where}
       ORDER BY payment_month DESC
       LIMIT 24`,
      params,
    );
    return rows;
  }

  async checkEligibility(tenantId: string, memberId: string): Promise<any> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const member = await db.getRepository(SchemeMember).findOne({ where: { id: memberId } });
    if (!member) return { eligible: false, reason: 'Member not found' };

    const scheme = await db.getRepository(NhifScheme).findOne({ where: { id: member.nhifSchemeId ?? '' } });
    if (!scheme || !scheme.apiBaseUrl) {
      const now = new Date().toISOString().slice(0, 10);
      const active = member.status === 'active' && (!member.expiryDate || member.expiryDate >= now);
      return { eligible: active, memberNumber: member.memberNumber, source: 'local' };
    }

    const apiKey = scheme.apiKeyEnvVar ? process.env[scheme.apiKeyEnvVar] || '' : '';
    const countryCode = scheme.countryCode.toUpperCase();

    try {
      let response: any;
      if (countryCode === 'KEN') {
        response = await axios.post(
          `${scheme.apiBaseUrl.replace(/\/$/, '')}/claimsAPI/api/eligibility`,
          { memberNumber: member.memberNumber },
          { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 10000 },
        );
      } else {
        response = await axios.post(
          `${scheme.apiBaseUrl.replace(/\/$/, '')}/api/member/verify`,
          { memberNumber: member.memberNumber },
          { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 10000 },
        );
      }

      return { eligible: true, source: 'api', data: response.data };
    } catch (err: any) {
      return {
        eligible: null,
        source: 'api_error',
        error: err?.response?.data ?? err?.message ?? 'Eligibility API unreachable',
      };
    }
  }

  /* Sprint 149: Capitation Billing Methods */

  async enrollMemberCapitation(tenantId: string, patientId: string, body: any): Promise<NhifMember> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(NhifMember);
    const existing = await repo.findOne({ where: { patientId, schemeCode: body.schemeCode } });
    if (existing) {
      Object.assign(existing, { membershipNumber: body.membershipNumber, nationalId: body.nationalId, enrollmentDate: body.enrollmentDate, expiryDate: body.expiryDate, status: 'active' });
      return repo.save(existing);
    }
    const member = repo.create({ patientId, ...body } as any) as unknown as NhifMember;
    return repo.save(member);
  }

  async getMemberCapitation(tenantId: string, patientId: string): Promise<NhifMember | null> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(NhifMember).findOne({ where: { patientId, status: 'active' } });
  }

  async createCapitationClaim(tenantId: string, patientId: string, userId: string, body: any): Promise<CapitationClaim> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(CapitationClaim);
    const claim = repo.create({ patientId, createdBy: userId, claimStatus: 'draft', ...body } as any) as unknown as CapitationClaim;
    try {
      const copay = await this.cdssService.nhifCalculateCopay({ scheme_code: body.schemeCode, service_codes: body.serviceCodes ?? [] }, tenantId);
      if (copay) {
        claim.coPayAmount = copay.co_pay_amount ?? 0;
        claim.capitationAmount = copay.capitation_amount ?? null;
      }
    } catch {}
    return repo.save(claim);
  }

  async submitCapitationClaim(tenantId: string, claimId: string): Promise<CapitationClaim> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(CapitationClaim);
    const claim = await repo.findOneOrFail({ where: { id: claimId } });
    claim.claimStatus = 'submitted';
    claim.submissionDate = new Date().toISOString().split('T')[0];
    return repo.save(claim);
  }

  async getClaimsByPatient(tenantId: string, patientId: string): Promise<CapitationClaim[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(CapitationClaim).find({ where: { patientId }, order: { createdAt: 'DESC' } });
  }

  async getTariffSchedule(tenantId: string, schemeCode: string): Promise<SchemeTariffSchedule[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(SchemeTariffSchedule).find({ where: { schemeCode } });
  }

  async verifyEligibilityCapitation(tenantId: string, body: any): Promise<Record<string, any>> {
    try {
      return await this.cdssService.nhifCheckEligibility(body, tenantId);
    } catch {
      return { eligible: false, error: 'Eligibility check unavailable' };
    }
  }
}
