import { Injectable } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { MalariaEpisode } from '../entities/malaria-episode.entity';

@Injectable()
export class MalariaEpisodeService {
  constructor(private readonly tenantService: TenantService) {}

  async recordEpisode(tenantId: string, body: any): Promise<MalariaEpisode> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(MalariaEpisode);
    const entity = repo.create({
      patientId: body.patientId,
      episodeDate: body.episodeDate,
      rdtResult: body.rdtResult ?? null,
      speciesConfirmed: body.speciesConfirmed ?? null,
      parasiteDensity: this.toNullableNumber(body.parasiteDensity),
      severityCriteria: Array.isArray(body.severityCriteria) ? body.severityCriteria : null,
      severityGrade: body.severityGrade ?? null,
      g6pdTested: body.g6pdTested === true,
      g6pdResult: body.g6pdResult ?? null,
      primaquineGiven: body.primaquineGiven === true,
      treatmentRegimen: body.treatmentRegimen ?? null,
      weightKg: this.toNullableNumber(body.weightKg),
      actDoseMg: this.toNullableNumber(body.actDoseMg),
      iptpDoseNumber: this.toNullableNumber(body.iptpDoseNumber),
      iptpSpGiven: body.iptpSpGiven === true,
      admitted: body.admitted === true,
      outcome: body.outcome ?? null,
      notes: body.notes ?? null,
    });
    return repo.save(entity) as unknown as MalariaEpisode;
  }

  async getPatientEpisodes(tenantId: string, patientId: string): Promise<MalariaEpisode[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(MalariaEpisode).find({
      where: { patientId },
      order: { episodeDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async recordIptp(tenantId: string, body: any): Promise<MalariaEpisode> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(MalariaEpisode);
    const entity = repo.create({
      patientId: body.patientId,
      episodeDate: body.episodeDate,
      weightKg: this.toNullableNumber(body.weightKg),
      iptpDoseNumber: this.toNullableNumber(body.iptpDoseNumber),
      iptpSpGiven: true,
      notes: body.notes ?? null,
    });
    return repo.save(entity) as unknown as MalariaEpisode;
  }

  async getIptpHistory(tenantId: string, patientId: string): Promise<MalariaEpisode[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(MalariaEpisode).find({
      where: { patientId, iptpSpGiven: true },
      order: { episodeDate: 'DESC', createdAt: 'DESC' },
    });
  }

  private toNullableNumber(value: any): number | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
