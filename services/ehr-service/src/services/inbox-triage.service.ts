import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InboxItem } from '../entities/inbox-item.entity';
import { InboxGateway } from '../gateways/inbox.gateway';
import { CdssService } from './cdss.service';

export interface TriageInput {
  userId: string;       // recipient provider
  patientId?: string;
  sourceType: 'lab_result' | 'imaging_result' | 'patient_message' | 'critical_alert' | 'task' | 'referral_response';
  sourceId?: string;
  title: string;
  content: string;      // full text used for triage (preview will be truncated from this)
}

interface CdssTriageResult {
  priority: 'critical' | 'urgent' | 'routine' | 'informational' | 'pending_review';
  priority_reason: string;
  triage_score: number | null;
  triage_model: string;
  due_by_hours?: number;
  draft_reply?: string;
}

@Injectable()
export class InboxTriageService {
  private readonly logger = new Logger(InboxTriageService.name);

  constructor(
    private readonly inboxGateway: InboxGateway,
    private readonly cdssService: CdssService,
  ) {}

  /**
   * Create a triaged inbox item. Call this from any service that produces
   * content a provider needs to action (lab results, imaging, messages, alerts).
   * Non-blocking — caller should not await if it's on a hot path.
   */
  async triage(input: TriageInput, tenantDb: DataSource): Promise<InboxItem> {
    const preview = input.content.slice(0, 200);

    let triageResult: CdssTriageResult = {
      priority:        'pending_review',
      priority_reason: 'CDSS unavailable — manual review required',
      triage_score:    null,
      triage_model:    'fallback',
    };

    try {
      triageResult = await this.cdssService.triageInboxItem(
        {
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          title: input.title,
          content: input.content,
          patientId: input.patientId,
        },
        undefined,
        tenantDb,
      ) as CdssTriageResult;
    } catch (err: any) {
      this.logger.warn(`CDSS inbox triage error: ${String(err?.message || err)}`);
    }

    const repo = tenantDb.getRepository(InboxItem);
    const item = repo.create({
      userId:           input.userId,
      patientId:        input.patientId,
      sourceType:       input.sourceType,
      sourceId:         input.sourceId,
      title:            input.title,
      preview,
      aiPriority:       triageResult.priority,
      aiPriorityReason: triageResult.priority_reason,
      aiDraftReply:     triageResult.draft_reply,
      triageScore:      triageResult.triage_score,
      triageModel:      triageResult.triage_model,
      dueBy: triageResult.due_by_hours
        ? new Date(Date.now() + triageResult.due_by_hours * 3_600_000)
        : triageResult.priority === 'pending_review'
          ? new Date(Date.now() + 30 * 60 * 1000)
          : undefined,
      isRead:     false,
      isActioned: false,
    });

    const saved = await repo.save(item);

    // Notify staff if item requires manual review (Sprint 112 P0-5)
    if (saved.aiPriority === 'pending_review') {
      this.logger.warn(
        `Inbox item ${saved.id} requires manual triage (CDSS unavailable). ` +
        `Due: ${saved.dueBy?.toISOString() ?? 'immediately'}`,
      );
    }

    // WebSocket push to the recipient
    this.inboxGateway.pushToUser(input.userId, saved);

    return saved;
  }

  async getInbox(
    userId: string,
    tenantDb: DataSource,
    opts: { unreadOnly?: boolean; priority?: string; limit?: number } = {},
  ): Promise<InboxItem[]> {
    const qb = tenantDb.getRepository(InboxItem)
      .createQueryBuilder('i')
      .where('i.user_id = :userId', { userId })
      .orderBy('i.triage_score', 'DESC')
      .addOrderBy('i.created_at', 'DESC')
      .take(opts.limit ?? 50);

    if (opts.unreadOnly) qb.andWhere('i.is_read = false');
    if (opts.priority)   qb.andWhere('i.ai_priority = :priority', { priority: opts.priority });

    return qb.getMany();
  }

  async markRead(itemId: string, userId: string, tenantDb: DataSource): Promise<void> {
    await tenantDb.getRepository(InboxItem).update(
      { id: itemId, userId },
      { isRead: true },
    );
  }

  async markActioned(itemId: string, userId: string, tenantDb: DataSource): Promise<void> {
    await tenantDb.getRepository(InboxItem).update(
      { id: itemId, userId },
      { isActioned: true, actionedAt: new Date(), isRead: true },
    );
  }

  async markAllRead(userId: string, tenantDb: DataSource): Promise<void> {
    await tenantDb.getRepository(InboxItem).update(
      { userId, isRead: false },
      { isRead: true },
    );
  }

  async getUnreadCounts(userId: string, tenantDb: DataSource): Promise<Record<string, number>> {
    const rows = await tenantDb.getRepository(InboxItem)
      .createQueryBuilder('i')
      .select('i.ai_priority', 'priority')
      .addSelect('COUNT(*)', 'count')
      .where('i.user_id = :userId AND i.is_read = false', { userId })
      .groupBy('i.ai_priority')
      .getRawMany();

    return rows.reduce((acc: Record<string, number>, r) => {
      acc[r.priority] = Number(r.count);
      return acc;
    }, {});
  }
}
