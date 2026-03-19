import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TenantService } from './tenant.service';
import { FlRound } from '../entities/fl-round.entity';
import { FlParticipationLog } from '../entities/fl-participation-log.entity';
import axios from 'axios';

@Injectable()
export class FederatedLearningService {
  private readonly logger = new Logger(FederatedLearningService.name);
  private cdssUrl = process.env.CDSS_SERVICE_URL || 'http://localhost:8001';

  constructor(private readonly tenantService: TenantService) {}

  // ── Round Management ───────────────────────────────────────────────────────

  async initiateRound(subdomain: string, modelType: string): Promise<FlRound> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(FlRound);

    const lastRound = await repo.findOne({ where: { modelType }, order: { roundNumber: 'DESC' } });
    const nextRound = (lastRound?.roundNumber || 0) + 1;

    const round = await repo.save(repo.create({
      roundNumber: nextRound,
      globalModelVersion: `${modelType}-v${nextRound}`,
      modelType,
      status: 'pending',
    }));

    this.logger.log(`Initiated FL round ${nextRound} for model ${modelType}`);
    return round;
  }

  async submitLocalMetrics(
    subdomain: string,
    roundId: string,
    metrics: { localModelMetrics: any; sampleCount: number; gradientNorm?: number; privacyEpsilon?: number },
  ): Promise<FlParticipationLog> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const log = await ds.getRepository(FlParticipationLog).save(
      ds.getRepository(FlParticipationLog).create({
        roundId,
        tenantSubdomain: subdomain,
        ...metrics,
        status: 'submitted',
      }),
    );

    // Trigger aggregation fire-and-forget
    this.aggregateRound(subdomain, roundId).catch(e =>
      this.logger.warn(`FL aggregation failed for round ${roundId}: ${e?.message}`));

    return log;
  }

  async getRound(subdomain: string, roundId: string): Promise<FlRound | null> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(FlRound).findOneBy({ id: roundId });
  }

  async getRounds(subdomain: string, modelType?: string): Promise<FlRound[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const where: any = modelType ? { modelType } : {};
    return ds.getRepository(FlRound).find({ where, order: { roundNumber: 'DESC' } });
  }

  async getParticipationLogs(subdomain: string, roundId: string): Promise<FlParticipationLog[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(FlParticipationLog).find({ where: { roundId } });
  }

  // ── Aggregation ────────────────────────────────────────────────────────────

  private async aggregateRound(subdomain: string, roundId: string): Promise<void> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const roundRepo = ds.getRepository(FlRound);
    const logRepo = ds.getRepository(FlParticipationLog);

    const round = await roundRepo.findOneBy({ id: roundId });
    if (!round) return;

    await roundRepo.update(roundId, { status: 'aggregating' });

    const logs = await logRepo.find({ where: { roundId, status: 'submitted' } });
    if (!logs.length) return;

    try {
      const { data } = await axios.post(`${this.cdssUrl}/fl/aggregate`, {
        roundId,
        modelType: round.modelType,
        contributions: logs.map(l => ({
          tenant: l.tenantSubdomain,
          metrics: l.localModelMetrics,
          sampleCount: l.sampleCount,
          gradientNorm: l.gradientNorm,
          privacyEpsilon: l.privacyEpsilon,
        })),
      });

      await roundRepo.update(roundId, {
        aggregatedMetrics: data.aggregatedMetrics || {},
        modelWeightsRef: data.modelWeightsRef,
        participatingTenants: logs.map(l => l.tenantSubdomain),
        status: 'completed',
        completedAt: new Date(),
      });

      this.logger.log(`FL round ${round.roundNumber} aggregated with ${logs.length} tenants`);
    } catch (e: any) {
      this.logger.error(`FL aggregation error for round ${roundId}: ${e?.message}`);
      await roundRepo.update(roundId, { status: 'failed' });
    }
  }

  // ── Weekly auto-round for deterioration model ──────────────────────────────

  @Cron('0 2 * * 0') // Every Sunday 02:00
  async weeklyFederatedRound() {
    this.logger.log('Starting weekly federated learning round…');
    try {
      const tenants = await this.tenantService.getAllActiveTenants?.() ?? [];
      if (!tenants.length) return;
      const coordinatorSubdomain = tenants[0];
      const round = await this.initiateRound(coordinatorSubdomain, 'deterioration');
      this.logger.log(`Weekly FL round ${round.roundNumber} initiated`);
    } catch (e: any) {
      this.logger.error(`Weekly FL round failed: ${e?.message}`);
    }
  }
}
