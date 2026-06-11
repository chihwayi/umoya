import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MedicalAidProvider } from '../entities/medical-aid-provider.entity';
import { MedicalAidEligibilityCheck } from '../entities/medical-aid-eligibility-check.entity';
import { MedicalAidClaimSubmission } from '../entities/medical-aid-claim-submission.entity';
import { MedicalAidRemittance } from '../entities/medical-aid-remittance.entity';
import { MedicalAidApiService } from './medical-aid-api.service';

@Injectable()
export class MedicalAidIntegrationService {
  constructor(private readonly medicalAidApiService: MedicalAidApiService) {}

  /** Resolve a usable provider name for the API adapter from the request/body. */
  private async resolveProviderName(
    tenantDb: DataSource,
    providerId: string | null,
    fallbackName?: string | null,
  ): Promise<string | null> {
    if (fallbackName && String(fallbackName).trim()) return String(fallbackName).trim();
    if (!providerId) return null;
    const provider = await tenantDb.getRepository(MedicalAidProvider).findOne({ where: { id: providerId } });
    return provider?.name ? String(provider.name).trim() : null;
  }

  async listProviders(tenantDb: DataSource) {
    return await tenantDb.getRepository(MedicalAidProvider).find({ order: { name: 'ASC' as any } });
  }

  async upsertProvider(tenantDb: DataSource, body: any) {
    const name = (body?.name ?? '').trim();
    if (!name) throw new BadRequestException('name is required');
    const code = body?.code ? body.code.toString().trim() : null;
    const isActive = typeof body?.isActive === 'boolean' ? body.isActive : true;

    const repo = tenantDb.getRepository(MedicalAidProvider);
    const existing = await repo.findOne({ where: { name } });
    const row = repo.create({
      id: existing?.id,
      name,
      code,
      isActive,
      config: (body?.config ?? existing?.config ?? {}) as any,
    });
    return await repo.save(row);
  }

  async createEligibilityCheck(tenantDb: DataSource, checkedBy: string | null, body: any) {
    const patientId = body?.patientId;
    if (!patientId) throw new BadRequestException('patientId is required');
    const providerId = body?.providerId ?? null;

    const repo = tenantDb.getRepository(MedicalAidEligibilityCheck);
    const memberNumber = body?.memberNumber ?? null;
    const row = repo.create({
      patientId,
      providerId,
      memberNumber,
      policyNumber: body?.policyNumber ?? null,
      status: 'pending',
      requestPayload: body?.requestPayload ?? { patientId, providerId, memberNumber },
      responsePayload: {},
      checkedAt: new Date(),
      checkedBy: checkedBy ?? null,
    });

    if (!memberNumber) {
      row.status = 'ineligible';
      row.responsePayload = { eligible: false, message: 'Member number is required to verify eligibility.' };
      return await repo.save(row);
    }

    const providerName = await this.resolveProviderName(tenantDb, providerId, body?.medicalAidName);
    if (!providerName) {
      row.status = 'error';
      row.responsePayload = { eligible: null, message: 'No medical-aid provider specified for verification.' };
      return await repo.save(row);
    }

    // Real-time verification through the provider adapter (configured switch or
    // the env demo service). Network/config failures are surfaced as
    // "unverified" rather than a false eligible/ineligible.
    const result = await this.medicalAidApiService.verifyMember(providerName, memberNumber, tenantDb);
    if (result.valid) {
      row.status = 'eligible';
      row.responsePayload = { eligible: true, memberDetails: result.memberDetails ?? null };
    } else if (result.memberDetails) {
      row.status = 'ineligible';
      row.responsePayload = {
        eligible: false,
        memberDetails: result.memberDetails,
        message: result.error ?? 'Member is not eligible.',
      };
    } else {
      row.status = 'error';
      row.responsePayload = {
        eligible: null,
        message: result.error ?? 'Unable to verify with provider; manual confirmation required.',
      };
    }

    return await repo.save(row);
  }

  async listEligibilityChecks(tenantDb: DataSource, patientId?: string) {
    const repo = tenantDb.getRepository(MedicalAidEligibilityCheck);
    if (patientId) {
      return await repo.find({ where: { patientId }, order: { createdAt: 'DESC' as any }, take: 200 });
    }
    return await repo.find({ order: { createdAt: 'DESC' as any }, take: 200 });
  }

  async createClaimSubmission(tenantDb: DataSource, createdBy: string | null, body: any) {
    const transactionId = body?.transactionId ?? null;
    const providerId = body?.providerId ?? null;
    if (!providerId) throw new BadRequestException('providerId is required');

    const repo = tenantDb.getRepository(MedicalAidClaimSubmission);
    const row = repo.create({
      transactionId,
      providerId,
      claimNumber: body?.claimNumber ?? null,
      status: 'draft',
      submissionFormat: body?.submissionFormat ?? 'stub',
      payload: body?.payload ?? { transactionId, providerId },
      response: {},
      submittedAt: null,
      createdBy: createdBy ?? null,
    });
    return await repo.save(row);
  }

  async submitClaim(tenantDb: DataSource, id: string) {
    const repo = tenantDb.getRepository(MedicalAidClaimSubmission);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Claim submission not found');

    const payload: any = row.payload || {};
    const providerName = await this.resolveProviderName(tenantDb, row.providerId, payload?.medicalAidName);

    if (!providerName) {
      row.status = 'error';
      row.response = { accepted: false, message: 'No medical-aid provider resolved for submission.', at: new Date().toISOString() };
      return await repo.save(row);
    }

    // Submit through the real provider adapter (configured switch / demo service).
    const result = await this.medicalAidApiService.submitClaim(
      providerName,
      {
        claimId: row.claimNumber || row.id,
        patientId: payload.patientId,
        memberNumber: payload.memberNumber,
        claimAmount: Number(payload.claimAmount) || 0,
        diagnosisCodes: payload.diagnosisCodes,
        primaryDiagnosisCode: payload.primaryDiagnosisCode,
        procedureCodes: payload.procedureCodes,
        serviceCodes: payload.serviceCodes,
        claimData: payload,
      },
      tenantDb,
    );

    row.submittedAt = new Date();
    if (result.success) {
      row.status = 'submitted';
      row.response = { accepted: true, externalClaimId: result.externalClaimId ?? null, at: row.submittedAt.toISOString() };
    } else {
      row.status = 'error';
      row.response = { accepted: false, message: result.error ?? 'Submission rejected by provider.', at: row.submittedAt.toISOString() };
    }
    return await repo.save(row);
  }

  async listClaimSubmissions(tenantDb: DataSource, providerId?: string) {
    const repo = tenantDb.getRepository(MedicalAidClaimSubmission);
    if (providerId) {
      return await repo.find({ where: { providerId }, order: { createdAt: 'DESC' as any }, take: 200 });
    }
    return await repo.find({ order: { createdAt: 'DESC' as any }, take: 200 });
  }

  async createRemittance(tenantDb: DataSource, processedBy: string | null, body: any) {
    const repo = tenantDb.getRepository(MedicalAidRemittance);
    const row = repo.create({
      providerId: body?.providerId ?? null,
      remittanceReference: body?.remittanceReference ?? null,
      receivedAt: new Date(),
      status: 'received',
      payload: body?.payload ?? {},
      processedBy: processedBy ?? null,
      processedAt: null,
    });
    return await repo.save(row);
  }

  async processRemittance(tenantDb: DataSource, id: string, processedBy: string | null) {
    const repo = tenantDb.getRepository(MedicalAidRemittance);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Remittance not found');
    row.status = 'processed';
    row.processedBy = processedBy ?? null;
    row.processedAt = new Date();
    return await repo.save(row);
  }

  async listRemittances(tenantDb: DataSource, providerId?: string) {
    const repo = tenantDb.getRepository(MedicalAidRemittance);
    if (providerId) {
      return await repo.find({ where: { providerId }, order: { createdAt: 'DESC' as any }, take: 200 });
    }
    return await repo.find({ order: { createdAt: 'DESC' as any }, take: 200 });
  }
}

