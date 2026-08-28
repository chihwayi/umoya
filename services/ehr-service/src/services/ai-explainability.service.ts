import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { AiRecommendationAudit } from '../entities/ai-recommendation-audit.entity';

export interface ExplainedRecommendation<T> {
  recommendation: T;
  confidence: number;
  reasoning: string;
  evidence: Array<{ source: string; section?: string; strength?: string }>;
  alternatives_considered: string[];
  override_logged: boolean;
}

@Injectable()
export class AiExplainabilityService {
  private readonly logger = new Logger(AiExplainabilityService.name);

  constructor(private readonly tenantService: TenantService) {}

  /**
   * Wraps any CDSS response in the ExplainedRecommendation envelope and persists an audit record.
   */
  async wrapAndAudit<T>(
    subdomain: string,
    recommendationType: string,
    recommendation: T,
    meta: {
      patientId?: string;
      decisionLogId?: string;
      confidence?: number;
      reasoning?: string;
      evidence?: any[];
      alternatives?: any[];
    },
  ): Promise<ExplainedRecommendation<T>> {
    const explained: ExplainedRecommendation<T> = {
      recommendation,
      confidence: meta.confidence ?? 0,
      reasoning: meta.reasoning ?? '',
      evidence: meta.evidence ?? [],
      alternatives_considered: meta.alternatives ?? [],
      override_logged: false,
    };

    // F18 fix (S269) — audit persistence is still fire-and-forget (the caller must
    // not block on it), but a failure here used to vanish completely with zero
    // trace anywhere, same root cause as F7. Now logged at error level.
    this.persistAudit(subdomain, recommendationType, meta, explained).catch((e: any) =>
      this.logger.error(`AI recommendation audit persistence failed for ${recommendationType} (patient ${meta.patientId || 'unknown'}): ${e?.message}`),
    );

    return explained;
  }

  async logOverride(subdomain: string, auditId: string, reason: string, overrideBy: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(AiRecommendationAudit);
    await repo.update(auditId, { overrideLogged: true, overrideReason: reason, overrideBy });
    return repo.findOneBy({ id: auditId });
  }

  async markDisplayed(subdomain: string, auditId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(AiRecommendationAudit);
    await repo.update(auditId, { displayedToUser: true, userReadAt: new Date() });
  }

  async getAuditHistory(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(AiRecommendationAudit).find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async getOverrides(subdomain: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(AiRecommendationAudit).find({
      where: { overrideLogged: true },
      order: { createdAt: 'DESC' },
    });
  }

  private async persistAudit(subdomain: string, recommendationType: string, meta: any, explained: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(AiRecommendationAudit);
    await repo.save(repo.create({
      recommendationType,
      patientId: meta.patientId,
      decisionLogId: meta.decisionLogId,
      confidence: explained.confidence,
      reasoning: explained.reasoning,
      evidence: explained.evidence,
      alternatives: explained.alternatives_considered,
    }));
  }
}
