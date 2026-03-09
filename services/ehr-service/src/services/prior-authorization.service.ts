import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PriorAuthorization } from '../entities/prior-authorization.entity';

const ALLOWED_STATUSES = ['draft', 'submitted', 'pending', 'approved', 'denied', 'expired', 'appeal'] as const;

@Injectable()
export class PriorAuthorizationService {
  async list(
    tenantDb: DataSource,
    filters?: { patientId?: string; status?: string },
  ): Promise<PriorAuthorization[]> {
    const repo = tenantDb.getRepository(PriorAuthorization);
    const qb = repo.createQueryBuilder('pa').orderBy('pa.created_at', 'DESC');
    if (filters?.patientId) qb.andWhere('pa.patient_id = :pid', { pid: filters.patientId });
    if (filters?.status) qb.andWhere('pa.status = :st', { st: filters.status });
    return qb.getMany();
  }

  async getById(tenantDb: DataSource, id: string): Promise<PriorAuthorization> {
    const repo = tenantDb.getRepository(PriorAuthorization);
    const pa = await repo.findOne({ where: { id } });
    if (!pa) throw new NotFoundException('Prior authorization not found');
    return pa;
  }

  async create(
    tenantDb: DataSource,
    requestedBy: string | null,
    body: Partial<PriorAuthorization>,
  ): Promise<PriorAuthorization> {
    if (!body.patientId) throw new BadRequestException('patientId is required');
    if (!body.serviceDescription) throw new BadRequestException('serviceDescription is required');
    const repo = tenantDb.getRepository(PriorAuthorization);
    const entity = repo.create({
      patientId: body.patientId,
      payerName: (body as any).payerName ?? null,
      authorizationType: (body as any).authorizationType ?? null,
      serviceDescription: (body as any).serviceDescription,
      cptCode: (body as any).cptCode ?? null,
      icd10Code: (body as any).icd10Code ?? null,
      status: 'draft',
      notes: (body as any).notes ?? null,
      requestedBy,
    });
    return repo.save(entity);
  }

  async update(
    tenantDb: DataSource,
    id: string,
    body: Partial<PriorAuthorization>,
  ): Promise<PriorAuthorization> {
    const repo = tenantDb.getRepository(PriorAuthorization);
    const pa = await repo.findOne({ where: { id } });
    if (!pa) throw new NotFoundException('Prior authorization not found');

    Object.assign(pa, {
      payerName: (body as any).payerName ?? pa.payerName,
      authorizationType: (body as any).authorizationType ?? pa.authorizationType,
      serviceDescription: (body as any).serviceDescription ?? pa.serviceDescription,
      cptCode: (body as any).cptCode ?? pa.cptCode,
      icd10Code: (body as any).icd10Code ?? pa.icd10Code,
      notes: (body as any).notes ?? pa.notes,
    });

    return repo.save(pa);
  }

  async delete(tenantDb: DataSource, id: string): Promise<{ ok: true }> {
    const repo = tenantDb.getRepository(PriorAuthorization);
    await repo.delete({ id });
    return { ok: true };
  }

  async setStatus(
    tenantDb: DataSource,
    id: string,
    status: string,
    body?: Record<string, any>,
  ): Promise<PriorAuthorization> {
    if (!ALLOWED_STATUSES.includes(status as any)) {
      throw new BadRequestException('Invalid status');
    }
    const repo = tenantDb.getRepository(PriorAuthorization);
    const pa = await repo.findOne({ where: { id } });
    if (!pa) throw new NotFoundException('Prior authorization not found');

    pa.status = status;
    if (status === 'submitted') pa.submittedAt = new Date();
    if (['approved', 'denied', 'expired', 'appeal'].includes(status)) pa.decisionAt = new Date();

    if (body) {
      if (body.authorizationNumber !== undefined) pa.authorizationNumber = body.authorizationNumber ?? null;
      if (body.authorizedUnits !== undefined) pa.authorizedUnits = body.authorizedUnits ?? null;
      if (body.authorizedFrom) pa.authorizedFrom = new Date(body.authorizedFrom);
      if (body.authorizedTo) pa.authorizedTo = new Date(body.authorizedTo);
      if (body.denialReason !== undefined) pa.denialReason = body.denialReason ?? null;
      if (body.appealDeadline) pa.appealDeadline = new Date(body.appealDeadline);
      if (body.notes !== undefined) pa.notes = body.notes ?? null;
    }

    return repo.save(pa);
  }
}

