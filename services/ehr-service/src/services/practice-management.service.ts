import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FeeSchedule } from '../entities/fee-schedule.entity';
import { FeeScheduleItem } from '../entities/fee-schedule-item.entity';
import { SuperbillTemplate } from '../entities/superbill-template.entity';
import { InsuranceVerification } from '../entities/insurance-verification.entity';

@Injectable()
export class PracticeManagementService {
  // ==================== FEE SCHEDULES ====================

  async listFeeSchedules(tenantDb: DataSource): Promise<FeeSchedule[]> {
    return tenantDb.getRepository(FeeSchedule).find({ order: { createdAt: 'DESC' } });
  }

  async createFeeSchedule(
    body: Partial<FeeSchedule>,
    tenantDb: DataSource,
  ): Promise<FeeSchedule> {
    const repo = tenantDb.getRepository(FeeSchedule);
    const entity = repo.create({
      name: body.name!,
      payerType: (body as any).payerType ?? null,
      payerName: (body as any).payerName ?? null,
      effectiveDate: (body as any).effectiveDate ? new Date((body as any).effectiveDate as any) : new Date(),
      endDate: (body as any).endDate ? new Date((body as any).endDate as any) : null,
      isDefault: Boolean((body as any).isDefault),
    });
    return repo.save(entity);
  }

  async updateFeeSchedule(
    id: string,
    body: Partial<FeeSchedule>,
    tenantDb: DataSource,
  ): Promise<FeeSchedule> {
    const repo = tenantDb.getRepository(FeeSchedule);
    const existing = await repo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Fee schedule not found');
    Object.assign(existing, {
      ...body,
      payerType: (body as any).payerType ?? existing.payerType,
      payerName: (body as any).payerName ?? existing.payerName,
      effectiveDate: (body as any).effectiveDate ? new Date((body as any).effectiveDate as any) : existing.effectiveDate,
      endDate: (body as any).endDate ? new Date((body as any).endDate as any) : existing.endDate,
    });
    return repo.save(existing);
  }

  async deleteFeeSchedule(id: string, tenantDb: DataSource): Promise<{ ok: true }> {
    const repo = tenantDb.getRepository(FeeSchedule);
    await repo.delete({ id });
    return { ok: true };
  }

  async listFeeScheduleItems(feeScheduleId: string, tenantDb: DataSource): Promise<FeeScheduleItem[]> {
    return tenantDb.getRepository(FeeScheduleItem).find({
      where: { feeScheduleId },
      order: { cptCode: 'ASC' },
    });
  }

  async addFeeScheduleItem(
    feeScheduleId: string,
    body: Partial<FeeScheduleItem>,
    tenantDb: DataSource,
  ): Promise<FeeScheduleItem> {
    const repo = tenantDb.getRepository(FeeScheduleItem);
    const entity = repo.create({
      feeScheduleId,
      cptCode: (body as any).cptCode!,
      description: (body as any).description ?? null,
      chargeAmount: String((body as any).chargeAmount ?? '0'),
      allowedAmount: (body as any).allowedAmount != null ? String((body as any).allowedAmount) : null,
      modifier: (body as any).modifier ?? null,
      effectiveDate: (body as any).effectiveDate ? new Date((body as any).effectiveDate as any) : null,
    });
    return repo.save(entity);
  }

  async deleteFeeScheduleItem(id: string, tenantDb: DataSource): Promise<{ ok: true }> {
    const repo = tenantDb.getRepository(FeeScheduleItem);
    await repo.delete({ id });
    return { ok: true };
  }

  // ==================== SUPERBILL TEMPLATES ====================

  async listSuperbillTemplates(tenantDb: DataSource): Promise<SuperbillTemplate[]> {
    return tenantDb.getRepository(SuperbillTemplate).find({ order: { updatedAt: 'DESC' } });
  }

  async createSuperbillTemplate(
    body: Partial<SuperbillTemplate>,
    userId: string | null,
    tenantDb: DataSource,
  ): Promise<SuperbillTemplate> {
    const repo = tenantDb.getRepository(SuperbillTemplate);
    const entity = repo.create({
      name: body.name!,
      specialty: (body as any).specialty ?? null,
      sections: (body as any).sections ?? [],
      isActive: typeof (body as any).isActive === 'boolean' ? (body as any).isActive : true,
      createdBy: userId,
    });
    return repo.save(entity);
  }

  async updateSuperbillTemplate(
    id: string,
    body: Partial<SuperbillTemplate>,
    tenantDb: DataSource,
  ): Promise<SuperbillTemplate> {
    const repo = tenantDb.getRepository(SuperbillTemplate);
    const existing = await repo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Superbill template not found');
    Object.assign(existing, body);
    return repo.save(existing);
  }

  async deleteSuperbillTemplate(id: string, tenantDb: DataSource): Promise<{ ok: true }> {
    const repo = tenantDb.getRepository(SuperbillTemplate);
    await repo.delete({ id });
    return { ok: true };
  }

  // ==================== INSURANCE VERIFICATIONS ====================

  async listInsuranceVerifications(
    tenantDb: DataSource,
    filters?: { patientId?: string; appointmentId?: string; status?: string },
  ): Promise<InsuranceVerification[]> {
    const repo = tenantDb.getRepository(InsuranceVerification);
    const qb = repo.createQueryBuilder('iv').orderBy('iv.created_at', 'DESC');
    if (filters?.patientId) qb.andWhere('iv.patient_id = :pid', { pid: filters.patientId });
    if (filters?.appointmentId) qb.andWhere('iv.appointment_id = :aid', { aid: filters.appointmentId });
    if (filters?.status) qb.andWhere('iv.verification_status = :st', { st: filters.status });
    return qb.getMany();
  }

  async createInsuranceVerification(
    body: Partial<InsuranceVerification>,
    tenantDb: DataSource,
  ): Promise<InsuranceVerification> {
    const repo = tenantDb.getRepository(InsuranceVerification);
    const entity = repo.create({
      patientId: (body as any).patientId!,
      appointmentId: (body as any).appointmentId ?? null,
      payerName: (body as any).payerName ?? null,
      policyNumber: (body as any).policyNumber ?? null,
      groupNumber: (body as any).groupNumber ?? null,
      verificationStatus: (body as any).verificationStatus ?? 'pending',
      coverageDetails: (body as any).coverageDetails ?? {},
      copayAmount: (body as any).copayAmount != null ? String((body as any).copayAmount) : null,
      deductibleRemaining: (body as any).deductibleRemaining != null ? String((body as any).deductibleRemaining) : null,
      notes: (body as any).notes ?? null,
    });
    return repo.save(entity);
  }

  async updateInsuranceVerification(
    id: string,
    body: Partial<InsuranceVerification>,
    tenantDb: DataSource,
  ): Promise<InsuranceVerification> {
    const repo = tenantDb.getRepository(InsuranceVerification);
    const existing = await repo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Insurance verification not found');
    Object.assign(existing, {
      ...body,
      copayAmount: (body as any).copayAmount != null ? String((body as any).copayAmount) : existing.copayAmount,
      deductibleRemaining:
        (body as any).deductibleRemaining != null
          ? String((body as any).deductibleRemaining)
          : existing.deductibleRemaining,
    });
    return repo.save(existing);
  }

  async markInsuranceVerification(
    id: string,
    status: 'verified' | 'denied' | 'expired' | 'not_found',
    userId: string | null,
    tenantDb: DataSource,
    notes?: string,
  ): Promise<InsuranceVerification> {
    const repo = tenantDb.getRepository(InsuranceVerification);
    const existing = await repo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Insurance verification not found');
    existing.verificationStatus = status;
    existing.verifiedAt = new Date();
    existing.verifiedBy = userId;
    if (typeof notes === 'string') existing.notes = notes;
    return repo.save(existing);
  }
}

