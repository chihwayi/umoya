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

  // ==================== FITNESS INTEGRATIONS ====================

  private async ensureFitnessIntegrationsTable(tenantDb: DataSource): Promise<void> {
    await tenantDb.query(`
      CREATE TABLE IF NOT EXISTS patient_fitness_integrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        app_id VARCHAR(50) NOT NULL,
        app_name VARCHAR(100) NOT NULL,
        is_connected BOOLEAN DEFAULT true,
        last_synced_at TIMESTAMP WITH TIME ZONE,
        connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
  }

  async listFitnessIntegrations(patientId: string, tenantDb: DataSource): Promise<any[]> {
    await this.ensureFitnessIntegrationsTable(tenantDb);
    const rows = await tenantDb.query(
      `SELECT * FROM patient_fitness_integrations WHERE patient_id = $1 AND is_connected = true ORDER BY connected_at DESC`,
      [patientId],
    );
    return rows;
  }

  async connectFitnessIntegration(
    patientId: string,
    body: { appId: string; appName: string },
    tenantDb: DataSource,
  ): Promise<any> {
    if (!body.appId?.trim()) throw new BadRequestException('appId is required');
    if (!body.appName?.trim()) throw new BadRequestException('appName is required');
    await this.ensureFitnessIntegrationsTable(tenantDb);
    // Upsert: disconnect previous record for same app if any, then insert fresh
    await tenantDb.query(
      `UPDATE patient_fitness_integrations SET is_connected = false WHERE patient_id = $1 AND app_id = $2`,
      [patientId, body.appId],
    );
    const rows = await tenantDb.query(
      `INSERT INTO patient_fitness_integrations (patient_id, app_id, app_name, is_connected, connected_at)
       VALUES ($1, $2, $3, true, NOW()) RETURNING *`,
      [patientId, body.appId, body.appName],
    );
    return rows[0];
  }

  async disconnectFitnessIntegration(patientId: string, appId: string, tenantDb: DataSource): Promise<void> {
    await this.ensureFitnessIntegrationsTable(tenantDb);
    await tenantDb.query(
      `UPDATE patient_fitness_integrations SET is_connected = false
       WHERE patient_id = $1 AND app_id = $2 AND is_connected = true`,
      [patientId, appId],
    );
  }

  async syncFitnessIntegration(patientId: string, appId: string, tenantDb: DataSource): Promise<any> {
    await this.ensureFitnessIntegrationsTable(tenantDb);
    const rows = await tenantDb.query(
      `UPDATE patient_fitness_integrations SET last_synced_at = NOW()
       WHERE patient_id = $1 AND app_id = $2 AND is_connected = true RETURNING *`,
      [patientId, appId],
    );
    if (!rows.length) throw new NotFoundException('Integration not found or not connected');
    return rows[0];
  }
}

