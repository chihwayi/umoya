import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { PgxProfile } from '../entities/pgx-profile.entity';
import { PgxAlert } from '../entities/pgx-alert.entity';
import { CdssService } from './cdss.service';

@Injectable()
export class PgxService {
  private readonly logger = new Logger(PgxService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  private normalizePhenotype(value?: string | null): string | null {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return null;
    if (['pm', 'poor'].includes(normalized)) return 'PM';
    if (['im', 'intermediate', 'reduced'].includes(normalized)) return 'IM';
    if (['nm', 'normal'].includes(normalized)) return 'NM';
    if (['um', 'ultrarapid', 'ultra_rapid'].includes(normalized)) return 'UM';
    if (['rm', 'rapid'].includes(normalized)) return 'RM';
    if (['deficient', 'severe_deficiency'].includes(normalized)) return 'deficient';
    return value || null;
  }

  private buildPgxPayload(patientId: string, drug: string, profile: PgxProfile): Record<string, any> {
    const raw = profile.rawGenotypingData || {};
    return {
      patientId,
      drug,
      cyp2d6: this.normalizePhenotype(profile.cyp2d6Phenotype),
      cyp2c19: this.normalizePhenotype(profile.cyp2c19Phenotype),
      cyp2c9: this.normalizePhenotype(profile.cyp2c9Phenotype),
      vkorc1: profile.vkorc1Variant || raw.vkorc1 || null,
      slco1b1: this.normalizePhenotype(profile.slco1b1Variant),
      tpmt: this.normalizePhenotype(profile.tpmtPhenotype),
      dpyd: this.normalizePhenotype(raw.dpydPhenotype || raw.dpyd || null),
      hla_b5701: String(profile.hlaB5701 || '').toLowerCase() === 'positive',
      hla_b1502: String(profile.hlaB1502 || '').toLowerCase() === 'positive',
      g6pd: this.normalizePhenotype(profile.g6pdStatus),
    };
  }

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
      const data = await this.cdssService.checkPgx(
        this.buildPgxPayload(patientId, drug, profile),
        subdomain,
        ds,
      );
      const topAlert = Array.isArray(data.alerts) ? data.alerts[0] : null;
      if (topAlert) {
        const alertEntity = ds.getRepository(PgxAlert).create({
          patientId,
          drug,
          pgxInteraction: topAlert.interaction,
          clinicalImplication: topAlert.interaction,
          alternativeRecommended: topAlert.alternative,
          severity: topAlert.severity || 'moderate',
          geneInvolved: topAlert.gene,
        });
        return ds.getRepository(PgxAlert).save(alertEntity);
      }
    } catch (e: any) {
      this.logger.warn(`PGx check failed for ${drug}/${patientId}: ${e?.message}`);
    }
    return null;
  }

  // ── CDSS proxy ────────────────────────────────────────────────────────────

  async cdssCheck(payload: any) {
    return this.cdssService.checkPgx(payload);
  }
}
