import { Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { TenantService } from './tenant.service';
import { BirthNotification } from '../entities/birth-notification.entity';
import { DeathCertificate } from '../entities/death-certificate.entity';
import { MdsrNotification } from '../entities/mdsr-notification.entity';

@Injectable()
export class CrvsService {
  constructor(private readonly tenantService: TenantService) {}

  async registerBirth(tenantId: string, body: any): Promise<BirthNotification> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(BirthNotification);

    const entity = repo.create({
      patientId: body.patientId,
      motherPatientId: body.motherPatientId ?? null,
      maternityRecordId: body.maternityRecordId ?? null,
      birthDate: body.birthDate ? new Date(body.birthDate) : new Date(),
      birthType: body.birthType,
      gestationalAgeWeeks: this.toNullableNumber(body.gestationalAgeWeeks),
      birthWeightGrams: this.toNullableNumber(body.birthWeightGrams),
      deliveryMode: body.deliveryMode ?? null,
      birthOrder: Number(body.birthOrder) || 1,
      plurality: body.plurality ?? null,
      placeOfBirth: body.placeOfBirth ?? null,
      submittedToCrvs: false,
      submittedAt: null,
      errorMessage: null,
    });

    let saved = await repo.save(entity) as unknown as BirthNotification;

    const payload = {
      eventType: 'birth',
      patientId: saved.patientId,
      motherPatientId: saved.motherPatientId,
      maternityRecordId: saved.maternityRecordId,
      birthDate: saved.birthDate.toISOString(),
      birthType: saved.birthType,
      gestationalAgeWeeks: saved.gestationalAgeWeeks,
      birthWeightGrams: saved.birthWeightGrams,
      deliveryMode: saved.deliveryMode,
      birthOrder: saved.birthOrder,
      plurality: saved.plurality,
      placeOfBirth: saved.placeOfBirth,
    };

    try {
      const reference = await this.submitToCrvsApi(payload, 'birth');
      if (reference) {
        await repo.update(saved.id, {
          crvsReference: reference,
          submittedToCrvs: true,
          submittedAt: new Date(),
          errorMessage: null,
        });
      } else {
        await repo.update(saved.id, {
          submittedToCrvs: false,
          errorMessage: 'CRVS not configured',
        });
      }
    } catch (error: any) {
      await repo.update(saved.id, {
        submittedToCrvs: false,
        errorMessage: this.errorMessage(error),
      });
    }

    saved = await repo.findOne({ where: { id: saved.id } }) as BirthNotification;
    return saved;
  }

  async listBirths(tenantId: string): Promise<BirthNotification[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(BirthNotification).find({
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async notifyHomeBirth(tenantId: string, body: any): Promise<string | null> {
    const payload = {
      eventType: 'birth',
      patientId: body.patientId ?? body.motherPatientId ?? null,
      motherPatientId: body.motherPatientId ?? null,
      motherName: body.motherName ?? null,
      birthDate: body.birthDate,
      birthType: body.birthType,
      gestationalAgeWeeks: this.toNullableNumber(body.gestationalAgeWeeks),
      birthWeightGrams: this.toNullableNumber(body.birthWeightGrams),
      deliveryMode: body.deliveryMode ?? 'home_delivery',
      birthOrder: Number(body.birthOrder) || 1,
      plurality: body.plurality ?? null,
      placeOfBirth: body.placeOfBirth ?? 'home',
      babySex: body.babySex ?? null,
      babyAlive: typeof body.babyAlive === 'boolean' ? body.babyAlive : null,
    };

    try {
      return await this.submitToCrvsApi(payload, 'birth');
    } catch (error: any) {
      throw new NotFoundException(this.errorMessage(error));
    }
  }

  async registerDeath(tenantId: string, body: any): Promise<DeathCertificate> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(DeathCertificate);

    const entity = repo.create({
      patientId: body.patientId,
      deathDate: body.deathDate,
      deathTime: body.deathTime ?? null,
      placeOfDeath: body.placeOfDeath ?? null,
      causeOfDeathPrimary: body.causeOfDeathPrimary,
      causeOfDeathIcd10: body.causeOfDeathIcd10,
      causeOfDeathSecondary: body.causeOfDeathSecondary ?? null,
      causeOfDeathSecondaryIcd10: body.causeOfDeathSecondaryIcd10 ?? null,
      mannerOfDeath: body.mannerOfDeath ?? null,
      certifyingProvider: body.certifyingProvider ?? null,
      submittedToCrvs: false,
      submittedAt: null,
      pdfPath: this.generateDeathCertificateText(body),
    });

    let saved = await repo.save(entity) as unknown as DeathCertificate;

    const payload = {
      eventType: 'death',
      patientId: saved.patientId,
      deathDate: saved.deathDate,
      deathTime: saved.deathTime,
      placeOfDeath: saved.placeOfDeath,
      causeOfDeathPrimary: saved.causeOfDeathPrimary,
      causeOfDeathIcd10: saved.causeOfDeathIcd10,
      causeOfDeathSecondary: saved.causeOfDeathSecondary,
      causeOfDeathSecondaryIcd10: saved.causeOfDeathSecondaryIcd10,
      mannerOfDeath: saved.mannerOfDeath,
      certifyingProvider: saved.certifyingProvider,
    };

    try {
      const reference = await this.submitToCrvsApi(payload, 'death');
      if (reference) {
        await repo.update(saved.id, {
          crvsReference: reference,
          submittedToCrvs: true,
          submittedAt: new Date(),
        });
      }
    } catch {
      // registerDeath should not fail the endpoint on external API issues
    }

    saved = await repo.findOne({ where: { id: saved.id } }) as DeathCertificate;
    return saved;
  }

  async listDeaths(tenantId: string): Promise<DeathCertificate[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(DeathCertificate).find({
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async getDeathCertificate(tenantId: string, patientId: string): Promise<DeathCertificate | null> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(DeathCertificate).findOne({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async submitMdsr(tenantId: string, body: any): Promise<MdsrNotification> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(MdsrNotification);
    const entity = repo.create({
      patientId: body.patientId,
      deathCertificateId: body.deathCertificateId ?? null,
      deathDate: body.deathDate,
      weeksGestationAtDeath: this.toNullableNumber(body.weeksGestationAtDeath),
      primaryCause: body.primaryCause ?? null,
      primaryCauseIcd10: body.primaryCauseIcd10 ?? null,
      avoidable: typeof body.avoidable === 'boolean' ? body.avoidable : null,
      avoidanceFactors: body.avoidanceFactors ?? null,
      committeeReviewDate: body.committeeReviewDate ?? null,
      reviewedBy: body.reviewedBy ?? null,
      actionPoints: body.actionPoints ?? null,
      submittedToMoh: true,
    });
    return repo.save(entity) as unknown as MdsrNotification;
  }

  async listMdsr(tenantId: string): Promise<MdsrNotification[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(MdsrNotification).find({
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async reviewMdsr(tenantId: string, id: string, body: any): Promise<MdsrNotification> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(MdsrNotification);
    const existing = await repo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('MDSR notification not found');
    }

    await repo.update(id, {
      committeeReviewDate: body.committeeReviewDate ?? existing.committeeReviewDate,
      reviewedBy: body.reviewedBy ?? existing.reviewedBy,
      actionPoints: body.actionPoints ?? existing.actionPoints,
      avoidable: typeof body.avoidable === 'boolean' ? body.avoidable : existing.avoidable,
      avoidanceFactors: body.avoidanceFactors ?? existing.avoidanceFactors,
    });

    return await repo.findOne({ where: { id } }) as MdsrNotification;
  }

  private async submitToCrvsApi(payload: any, eventType: 'birth' | 'death'): Promise<string | null> {
    const baseUrl = String(process.env.CRVS_BASE_URL || '').trim();
    const apiKey = String(process.env.CRVS_API_KEY || '').trim();
    const countryCode = String(process.env.CRVS_COUNTRY_CODE || '').trim().toUpperCase();

    if (!baseUrl || !apiKey) return null;

    let endpoint = `${baseUrl}/api/vital-events`;
    if (countryCode === 'ZW' && process.env.ZIMSTAT_BASE_URL) {
      endpoint = `${String(process.env.ZIMSTAT_BASE_URL).trim()}/api/${eventType}-notification`;
    } else if (countryCode === 'ZA' && process.env.DHA_BASE_URL) {
      endpoint = `${String(process.env.DHA_BASE_URL).trim()}/api/notifications/${eventType}`;
    }

    const response = await axios.post(endpoint, payload, {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
    return response.data?.reference ?? response.data?.id ?? null;
  }

  private generateDeathCertificateText(body: any): string | null {
    const lines = [
      'Umoya Death Certificate',
      `Patient ID: ${body.patientId}`,
      `Death date: ${body.deathDate}`,
      `Death time: ${body.deathTime || 'N/A'}`,
      `Place of death: ${body.placeOfDeath || 'N/A'}`,
      `Primary cause: ${body.causeOfDeathPrimary} (${body.causeOfDeathIcd10})`,
      `Secondary cause: ${body.causeOfDeathSecondary || 'N/A'}${body.causeOfDeathSecondaryIcd10 ? ` (${body.causeOfDeathSecondaryIcd10})` : ''}`,
      `Manner of death: ${body.mannerOfDeath || 'N/A'}`,
      `Certifying provider: ${body.certifyingProvider || 'N/A'}`,
    ];
    return lines.join('\n');
  }

  private errorMessage(error: any): string {
    const responseData = error?.response?.data;
    if (typeof responseData === 'string' && responseData.trim()) {
      return responseData;
    }
    if (responseData?.message) {
      return String(responseData.message);
    }
    return String(error?.message || 'Unknown CRVS submission error');
  }

  private toNullableNumber(value: any): number | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
