import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Bill } from '../entities/billing.entity';
import { PatientPortalPayment } from '../entities/patient-portal-payment.entity';
import { HealthEducationContent } from '../entities/health-education-content.entity';
import { PatientFamilyAccess } from '../entities/patient-family-access.entity';

@Injectable()
export class PatientPortalH3Service {
  async listBillsForPatient(patientId: string, tenantDb: DataSource): Promise<Bill[]> {
    return tenantDb.getRepository(Bill).find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async createPortalPayment(
    patientId: string,
    body: {
      billId?: string;
      amount: number;
      paymentMethod: 'ecocash' | 'onemoney' | 'card' | 'bank_transfer';
      paymentReference?: string;
    },
    tenantDb: DataSource,
  ): Promise<PatientPortalPayment> {
    if (!body.amount || Number(body.amount) <= 0) {
      throw new BadRequestException('amount must be > 0');
    }
    const repo = tenantDb.getRepository(PatientPortalPayment);
    const entity = repo.create({
      patientId,
      billId: body.billId ?? null,
      amount: String(body.amount),
      paymentMethod: body.paymentMethod,
      paymentReference: body.paymentReference ?? null,
      status: 'pending',
      paidAt: null,
    });
    return repo.save(entity);
  }

  async listEducation(
    tenantDb: DataSource,
    filters?: { category?: string; language?: string; publishedOnly?: boolean },
  ): Promise<HealthEducationContent[]> {
    const repo = tenantDb.getRepository(HealthEducationContent);
    const qb = repo.createQueryBuilder('c').orderBy('c.created_at', 'DESC');
    if (filters?.category) qb.andWhere('c.category = :cat', { cat: filters.category });
    if (filters?.language) qb.andWhere('c.language = :lang', { lang: filters.language });
    if (filters?.publishedOnly !== false) qb.andWhere('c.is_published = true');
    return qb.getMany();
  }

  async getEducationById(tenantDb: DataSource, id: string): Promise<HealthEducationContent> {
    const repo = tenantDb.getRepository(HealthEducationContent);
    const item = await repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Content not found');
    if (!item.isPublished) throw new NotFoundException('Content not found');
    return item;
  }

  async listFamilyAccess(patientId: string, tenantDb: DataSource): Promise<PatientFamilyAccess[]> {
    return tenantDb.getRepository(PatientFamilyAccess).find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async createFamilyAccess(
    patientId: string,
    body: {
      proxyName: string;
      proxyEmail: string;
      proxyPhone?: string;
      relationship?: string;
      accessLevel?: 'view_only' | 'full' | 'emergency_only';
      expiresAt?: string;
    },
    tenantDb: DataSource,
  ): Promise<PatientFamilyAccess> {
    if (!body.proxyName?.trim()) throw new BadRequestException('proxyName is required');
    if (!body.proxyEmail?.trim()) throw new BadRequestException('proxyEmail is required');

    const repo = tenantDb.getRepository(PatientFamilyAccess);
    const entity = repo.create({
      patientId,
      proxyName: body.proxyName.trim(),
      proxyEmail: body.proxyEmail.trim(),
      proxyPhone: body.proxyPhone ?? null,
      relationship: body.relationship ?? null,
      accessLevel: body.accessLevel ?? 'view_only',
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      isActive: true,
    });
    return repo.save(entity);
  }

  async revokeFamilyAccess(patientId: string, id: string, tenantDb: DataSource): Promise<PatientFamilyAccess> {
    const repo = tenantDb.getRepository(PatientFamilyAccess);
    const existing = await repo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Family access not found');
    if (existing.patientId !== patientId) throw new NotFoundException('Family access not found');
    existing.isActive = false;
    return repo.save(existing);
  }
}

