import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MedicalAidProvider } from '../entities/medical-aid-provider.entity';
import { MedicalAidEligibilityCheck } from '../entities/medical-aid-eligibility-check.entity';
import { MedicalAidClaimSubmission } from '../entities/medical-aid-claim-submission.entity';
import { MedicalAidRemittance } from '../entities/medical-aid-remittance.entity';

@Injectable()
export class MedicalAidIntegrationService {
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
    const row = repo.create({
      patientId,
      providerId,
      memberNumber: body?.memberNumber ?? null,
      policyNumber: body?.policyNumber ?? null,
      status: 'pending',
      requestPayload: body?.requestPayload ?? { patientId, providerId },
      responsePayload: {},
      checkedAt: new Date(),
      checkedBy: checkedBy ?? null,
    });

    // Stub behavior: if a provider exists and member number present, mark eligible.
    if (providerId && body?.memberNumber) {
      row.status = 'eligible';
      row.responsePayload = { eligible: true, message: 'Stub eligibility response' };
    } else if (providerId && !body?.memberNumber) {
      row.status = 'ineligible';
      row.responsePayload = { eligible: false, message: 'Stub: member number missing' };
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

    row.status = 'submitted';
    row.submittedAt = new Date();
    row.response = { accepted: true, message: 'Stub submission accepted', at: new Date().toISOString() };
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

