import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { ModelRegistry } from '../entities/model-registry.entity';
import axios from 'axios';

@Injectable()
export class ModelRegistryService {
  private readonly logger = new Logger(ModelRegistryService.name);
  private cdssUrl = process.env.CDSS_SERVICE_URL || 'http://localhost:8001';

  // AUC of the current production model per name — cached to avoid DB hit on every prediction
  private productionAuc = new Map<string, number>();

  constructor(private readonly tenantService: TenantService) {}

  // ── Registration ───────────────────────────────────────────────────────────

  async register(subdomain: string, dto: {
    modelName: string;
    roundId?: string;
    minioPath: string;
    aucRoc?: number;
    brierScore?: number;
    sampleCount?: number;
    tenantCount?: number;
    modelHash?: string;
    featureNames?: string[];
    framework?: string;
  }): Promise<ModelRegistry> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(ModelRegistry);

    // Determine next version number
    const latest = await repo.findOne({
      where: { modelName: dto.modelName },
      order: { createdAt: 'DESC' },
    });
    const nextVersion = latest
      ? `v${parseInt(latest.version.replace('v', ''), 10) + 1}`
      : 'v1';

    return repo.save(repo.create({
      modelName: dto.modelName,
      version: nextVersion,
      roundId: dto.roundId,
      minioPath: dto.minioPath,
      aucRoc: dto.aucRoc,
      brierScore: dto.brierScore,
      sampleCount: dto.sampleCount || 0,
      tenantCount: dto.tenantCount || 0,
      modelHash: dto.modelHash,
      featureNames: dto.featureNames || [],
      framework: dto.framework || 'sklearn',
      status: 'staging',
    }));
  }

  // ── Promotion ──────────────────────────────────────────────────────────────

  async evaluateAndPromote(subdomain: string, registryId: string): Promise<{
    promoted: boolean; reason: string; model?: ModelRegistry;
  }> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(ModelRegistry);

    const candidate = await repo.findOneBy({ id: registryId });
    if (!candidate) return { promoted: false, reason: 'Model not found' };
    if (!candidate.aucRoc) return { promoted: false, reason: 'No AUC available — cannot evaluate' };

    const current = await this.getCurrentProduction(subdomain, candidate.modelName);

    const currentAuc = current?.aucRoc ?? 0;
    const improvement = candidate.aucRoc - currentAuc;
    const MIN_IMPROVEMENT = 0.01; // 1% AUC gain required

    if (candidate.aucRoc < 0.55) {
      await repo.update(registryId, { status: 'rejected' });
      return { promoted: false, reason: `AUC ${candidate.aucRoc.toFixed(3)} below minimum threshold 0.55` };
    }

    if (current && improvement < MIN_IMPROVEMENT) {
      await repo.update(registryId, { status: 'rejected' });
      return {
        promoted: false,
        reason: `AUC improvement ${(improvement * 100).toFixed(2)}% < required 1% (current: ${currentAuc.toFixed(3)}, candidate: ${candidate.aucRoc.toFixed(3)})`,
      };
    }

    // Retire current production
    if (current) {
      await repo.update(current.id, { status: 'retired', retiredAt: new Date() });
    }

    // Promote candidate
    await repo.update(registryId, { status: 'production', promotedAt: new Date() });

    // Tell CDSS to load the new model
    await this.notifyCdssPromote(candidate.modelName, candidate.minioPath).catch(e =>
      this.logger.warn(`CDSS promote notification failed: ${e?.message}`));

    this.productionAuc.set(candidate.modelName, candidate.aucRoc);

    this.logger.log(
      `Model ${candidate.modelName} ${candidate.version} promoted to production ` +
      `(AUC ${candidate.aucRoc.toFixed(3)}, +${(improvement * 100).toFixed(2)}% vs previous)`
    );

    const promoted = await repo.findOneBy({ id: registryId });
    return { promoted: true, reason: `Promoted — AUC improved by ${(improvement * 100).toFixed(2)}%`, model: promoted! };
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  async getCurrentProduction(subdomain: string, modelName: string): Promise<ModelRegistry | null> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(ModelRegistry).findOne({
      where: { modelName, status: 'production' },
    });
  }

  async getHistory(subdomain: string, modelName: string): Promise<ModelRegistry[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(ModelRegistry).find({
      where: { modelName },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  async getAllProduction(subdomain: string): Promise<ModelRegistry[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(ModelRegistry).find({ where: { status: 'production' } });
  }

  // ── Manual rollback ────────────────────────────────────────────────────────

  async rollback(subdomain: string, modelName: string): Promise<ModelRegistry | null> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(ModelRegistry);

    const current = await repo.findOne({ where: { modelName, status: 'production' } });
    const previous = await repo.findOne({
      where: { modelName, status: 'retired' },
      order: { retiredAt: 'DESC' },
    });

    if (!previous) return null;

    if (current) await repo.update(current.id, { status: 'retired', retiredAt: new Date() });
    await repo.update(previous.id, { status: 'production', promotedAt: new Date(), retiredAt: null as any });

    await this.notifyCdssPromote(modelName, previous.minioPath).catch(() => {});

    this.logger.warn(`Model ${modelName} rolled back to ${previous.version}`);
    return repo.findOneBy({ id: previous.id });
  }

  // ── CDSS notify ────────────────────────────────────────────────────────────

  private async notifyCdssPromote(modelName: string, minioPath: string): Promise<void> {
    await axios.post(`${this.cdssUrl}/model/load`, {
      modelName,
      minioPath,
    }, { timeout: 30000 });
  }
}
