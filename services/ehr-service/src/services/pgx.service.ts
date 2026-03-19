import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { PgxProfile } from '../entities/pgx-profile.entity';
import { PgxAlert } from '../entities/pgx-alert.entity';
import axios from 'axios';

@Injectable()
export class PgxService {
  private readonly logger = new Logger(PgxService.name);
  private cdssUrl = process.env.CDSS_SERVICE_URL || 'http://localhost:8001';

  constructor(private readonly tenantService: TenantService) {}

  // ── PGx Profiles ─────────────────────────────────────────────────────────

  async upsertProfile(subdomain: string, patientId: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(PgxProfile);
    const existing = await repo.findOneBy({ patientId });
    if (existing) {
      await repo.update(existing.id, { ...dto, patientId });
      return repo.findOneBy({ id: existing.id });
    }
    return repo.save(repo.create({ ...dto, patientId }));
  }

  async getProfile(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(PgxProfile).findOneBy({ patientId });
  }

  // ── PGx Alerts ────────────────────────────────────────────────────────────

  async getAlerts(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(PgxAlert).find({
      where: { patientId },
      order: { generatedAt: 'DESC' },
    });
  }

  async acknowledgeAlert(subdomain: string, id: string, acknowledgedBy: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(PgxAlert);
    await repo.update(id, { acknowledged: true, acknowledgedBy });
    return repo.findOneBy({ id });
  }

  /**
   * Check a drug against patient PGx profile. Called on every new prescription.
   * Fire-and-forget from PrescriptionService.
   */
  async checkDrug(subdomain: string, patientId: string, drug: string): Promise<PgxAlert | null> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const profile = await ds.getRepository(PgxProfile).findOneBy({ patientId });
    if (!profile) return null;

    try {
      const { data } = await axios.post(`${this.cdssUrl}/pgx/check`, { drug, profile });
      if (data.interaction) {
        const alert = ds.getRepository(PgxAlert).create({
          patientId,
          drug,
          pgxInteraction: data.interaction,
          clinicalImplication: data.clinical_implication,
          alternativeRecommended: data.alternative,
          severity: data.severity || 'moderate',
          geneInvolved: data.gene,
        });
        return ds.getRepository(PgxAlert).save(alert);
      }
    } catch (e: any) {
      this.logger.warn(`PGx check failed for ${drug}/${patientId}: ${e?.message}`);
    }
    return null;
  }

  // ── CDSS proxy ────────────────────────────────────────────────────────────

  async cdssCheck(payload: any) {
    const { data } = await axios.post(`${this.cdssUrl}/pgx/check`, payload);
    return data;
  }
}
