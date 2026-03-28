import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CdssDecisionLog } from '../entities/cdss-decision-log.entity';

export interface LogDecisionDto {
  patientId: string;
  encounterId?: string;
  userId?: string;
  decisionType: string;
  cdssRequestPayload: Record<string, any>;
  cdssResponsePayload: Record<string, any>;
  topRecommendation?: string;
  confidenceScore?: number;
}

export interface RecordActionDto {
  clinicianAction: 'accepted' | 'modified' | 'overridden' | 'ignored';
  overrideReason?: string;
}

export interface LinkOutcomeDto {
  patientOutcomeId: string;
  outcomeAt30Days?: Record<string, any>;
  outcomeAt90Days?: Record<string, any>;
}

@Injectable()
export class CdssDecisionLogService {
  private readonly logger = new Logger(CdssDecisionLogService.name);

  /**
   * Persist a CDSS recommendation immediately after it is served.
   * Called by the CDSS controller / hook service on every AI call.
   */
  async logDecision(dto: LogDecisionDto, tenantDb: DataSource): Promise<CdssDecisionLog> {
    const repo = tenantDb.getRepository(CdssDecisionLog);
    const entry = repo.create({
      patientId:            dto.patientId,
      encounterId:          dto.encounterId,
      userId:               dto.userId,
      decisionType:         dto.decisionType,
      cdssRequestPayload:   dto.cdssRequestPayload,
      cdssResponsePayload:  dto.cdssResponsePayload,
      topRecommendation:    dto.topRecommendation,
      confidenceScore:      dto.confidenceScore,
    });
    return repo.save(entry);
  }

  /**
   * Record the clinician's response to a recommendation.
   * Overrides REQUIRE an overrideReason.
   */
  async recordClinicianAction(
    logId: string,
    dto: RecordActionDto,
    tenantDb: DataSource,
  ): Promise<CdssDecisionLog> {
    if (dto.clinicianAction === 'overridden' && !dto.overrideReason?.trim()) {
      throw new BadRequestException('overrideReason is required when clinicianAction is overridden');
    }

    const repo  = tenantDb.getRepository(CdssDecisionLog);
    const entry = await repo.findOne({ where: { id: logId } });
    if (!entry) throw new NotFoundException(`CdssDecisionLog ${logId} not found`);

    entry.clinicianAction = dto.clinicianAction;
    entry.overrideReason  = dto.overrideReason;
    return repo.save(entry);
  }

  /**
   * Link a clinical outcome to a decision log entry and store outcome snapshots.
   */
  async linkOutcome(
    logId: string,
    dto: LinkOutcomeDto,
    tenantDb: DataSource,
  ): Promise<CdssDecisionLog> {
    const repo  = tenantDb.getRepository(CdssDecisionLog);
    const entry = await repo.findOne({ where: { id: logId } });
    if (!entry) throw new NotFoundException(`CdssDecisionLog ${logId} not found`);

    entry.patientOutcomeId  = dto.patientOutcomeId;
    entry.outcomeAt30Days   = dto.outcomeAt30Days;
    entry.outcomeAt90Days   = dto.outcomeAt90Days;
    return repo.save(entry);
  }

  /**
   * Fetch decision history for a patient — latest first.
   */
  async getForPatient(
    patientId: string,
    tenantDb: DataSource,
    limit = 20,
  ): Promise<CdssDecisionLog[]> {
    return tenantDb.getRepository(CdssDecisionLog).find({
      where: { patientId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Returns entries that have a clinician action but have NOT yet been pushed
   * back to the CDSS for model feedback.  Used by the weekly batch job.
   */
  async getPendingFeedback(
    tenantDb: DataSource,
    batchSize = 200,
  ): Promise<CdssDecisionLog[]> {
    return tenantDb.getRepository(CdssDecisionLog).find({
      where: { feedbackSentToCdss: false },
      order: { createdAt: 'ASC' },
      take: batchSize,
    });
  }

  /**
   * Mark a batch of entries as sent to CDSS.
   */
  async markFeedbackSent(ids: string[], tenantDb: DataSource): Promise<void> {
    if (!ids.length) return;
    await tenantDb
      .createQueryBuilder()
      .update(CdssDecisionLog)
      .set({ feedbackSentToCdss: true, feedbackSentAt: new Date() })
      .whereInIds(ids)
      .execute();
  }

  /**
   * Summary stats for a tenant — used by the admin/analytics views.
   */
  async getActionStats(tenantDb: DataSource): Promise<Record<string, number>> {
    const rows: { clinician_action: string; cnt: string }[] = await tenantDb.query(`
      SELECT clinician_action, COUNT(*) AS cnt
      FROM cdss_decision_log
      WHERE clinician_action IS NOT NULL
      GROUP BY clinician_action
    `);
    return rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.clinician_action] = parseInt(r.cnt, 10);
      return acc;
    }, {});
  }
}
