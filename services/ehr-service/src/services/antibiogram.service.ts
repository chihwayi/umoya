import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { TenantService } from './tenant.service';
import { AntibiogramEntry } from '../entities/antibiogram-entry.entity';
import { AntibiogramSummary } from '../entities/antibiogram-summary.entity';
import { CultureSensitivityResult } from '../entities/culture-sensitivity-result.entity';
import { CdssService } from './cdss.service';

@Injectable()
export class AntibiogramService {
  private readonly logger = new Logger(AntibiogramService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  // ── Antibiogram Entries ───────────────────────────────────────────────────

  async addEntry(ds: DataSource, dto: any) {
    return ds.getRepository(AntibiogramEntry).save(ds.getRepository(AntibiogramEntry).create(dto));
  }

  async getEntries(ds: DataSource, organism?: string, specimenType?: string) {
    const qb = ds.getRepository(AntibiogramEntry).createQueryBuilder('e').orderBy('e.year', 'DESC');
    if (organism) qb.andWhere('e.organism = :organism', { organism });
    if (specimenType) qb.andWhere('e.specimen_type = :specimenType', { specimenType });
    return qb.getMany();
  }

  // ── Culture Sensitivity Results ───────────────────────────────────────────

  async addCultureResult(tenantId: string, ds: DataSource, dto: any) {
    const repo = ds.getRepository(CultureSensitivityResult);
    const saved = await repo.save(
      repo.create(dto) as unknown as CultureSensitivityResult
    );
    // Ingest into antibiogram entries (fire-and-forget)
    this.ingestCultureIntoAntibiogram(ds, saved).catch(e =>
      this.logger.warn(`Antibiogram ingest failed: ${e?.message}`));
    return saved;
  }

  async getCultureResults(ds: DataSource, patientId: string) {
    return ds.getRepository(CultureSensitivityResult).find({
      where: { patientId },
      order: { collectionDate: 'DESC' },
    });
  }

  // ── Summaries ─────────────────────────────────────────────────────────────

  async getLatestSummary(ds: DataSource, specimenType?: string) {
    const qb = ds.getRepository(AntibiogramSummary).createQueryBuilder('s').orderBy('s.generated_at', 'DESC').limit(1);
    if (specimenType) qb.where('s.specimen_type = :specimenType', { specimenType });
    return qb.getOne();
  }

  // ── CDSS ──────────────────────────────────────────────────────────────────

  async empiricalRecommendation(tenantId: string, ds: DataSource, payload: any) {
    return this.cdssService.recommendEmpiricalAntimicrobial(payload, tenantId, ds);
  }

  async deescalateRecommendation(tenantId: string, ds: DataSource, payload: any) {
    return this.cdssService.recommendAntimicrobialDeescalation(payload, tenantId, ds);
  }

  // ── Monthly recalculation (background job) ────────────────────────────────

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async recalculateAllTenants() {
    this.logger.log('Starting monthly antibiogram recalculation…');
    try {
      const tenants = await this.tenantService.getAllActiveTenants?.() ?? [];
      for (const tenant of tenants) {
        const subdomain = typeof tenant === 'string' ? tenant : tenant?.subdomain;
        if (!subdomain) {
          continue;
        }
        try {
          const ds = await this.tenantService.getTenantDatabase(subdomain);
          if (!ds) continue;
          await this.recalculate(ds);
        } catch (e: any) {
          this.logger.error(`Antibiogram recalc failed for ${subdomain}: ${e?.message}`);
        }
      }
    } catch (e: any) {
      this.logger.error(`Antibiogram recalc error: ${e?.message}`);
    }
  }

  async recalculate(ds: DataSource) {
    const specimenTypes = ['blood', 'urine', 'wound', 'sputum', 'stool'];
    const now = new Date();
    const periodLabel = `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;

    for (const specimenType of specimenTypes) {
      const results = await ds.getRepository(CultureSensitivityResult).find({ where: { specimenType } });
      if (!results.length) continue;

      const data: Record<string, any> = {};
      for (const r of results) {
        if (!r.organismIsolated || r.noGrowth) continue;
        if (!data[r.organismIsolated]) data[r.organismIsolated] = {};
        for (const [ab, info] of Object.entries(r.diskDiffusionResults || {})) {
          if (!data[r.organismIsolated][ab]) data[r.organismIsolated][ab] = { S: 0, I: 0, R: 0, total: 0 };
          data[r.organismIsolated][ab][(info as any).interpretation]++;
          data[r.organismIsolated][ab].total++;
        }
      }

      const repo = ds.getRepository(AntibiogramSummary);
      const existing = await repo.findOne({ where: { periodLabel, specimenType } });
      const summary = { periodLabel, specimenType, data, topResistantOrganisms: [], recommendedEmpiricalChoices: {}, generatedAt: now };
      if (existing) await repo.update(existing.id, summary);
      else await repo.save(repo.create(summary));
    }
    this.logger.log(`Antibiogram recalculated for ${periodLabel}`);
  }

  private async ingestCultureIntoAntibiogram(ds: DataSource, result: CultureSensitivityResult) {
    if (!result.organismIsolated || result.noGrowth) return;
    const now = new Date();
    const year = now.getFullYear();
    const quarter = Math.ceil((now.getMonth() + 1) / 3);

    for (const [antibiotic, info] of Object.entries(result.diskDiffusionResults || {})) {
      const interp = (info as any).interpretation as string;
      if (!['S', 'I', 'R'].includes(interp)) continue;
      const repo = ds.getRepository(AntibiogramEntry);
      const existing = await repo.findOne({
        where: { organism: result.organismIsolated, antibiotic, year, quarter, specimenType: result.specimenType }
      });
      if (existing) {
        const newTotal = existing.totalIsolates + 1;
        const sCount = Math.round(existing.susceptiblePercent * existing.totalIsolates / 100) + (interp === 'S' ? 1 : 0);
        const rCount = Math.round(existing.resistantPercent * existing.totalIsolates / 100) + (interp === 'R' ? 1 : 0);
        await repo.update(existing.id, {
          totalIsolates: newTotal,
          susceptiblePercent: Math.round(sCount * 100 / newTotal),
          resistantPercent: Math.round(rCount * 100 / newTotal),
          intermediatePercent: Math.round((newTotal - sCount - rCount) * 100 / newTotal),
        });
      } else {
        await repo.save(repo.create({
          organism: result.organismIsolated, antibiotic, year, quarter,
          specimenType: result.specimenType, totalIsolates: 1,
          susceptiblePercent: interp === 'S' ? 100 : 0,
          intermediatePercent: interp === 'I' ? 100 : 0,
          resistantPercent: interp === 'R' ? 100 : 0,
        }));
      }
    }
  }
}
