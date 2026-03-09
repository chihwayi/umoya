import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationCampaign } from '../entities/notification-campaign.entity';
import { NotificationCampaignRecipient } from '../entities/notification-campaign-recipient.entity';

type CampaignChannel = 'sms' | 'email';
type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'completed' | 'cancelled' | 'failed';
type TargetType = 'manual' | 'recall_list' | 'query';

@Injectable()
export class NotificationCampaignService {
  constructor(private readonly notificationsService: NotificationsService) {}

  async listCampaigns(tenantDb: DataSource): Promise<NotificationCampaign[]> {
    return tenantDb.getRepository(NotificationCampaign).find({ order: { createdAt: 'DESC' } });
  }

  async getCampaign(tenantDb: DataSource, id: string): Promise<NotificationCampaign> {
    const repo = tenantDb.getRepository(NotificationCampaign);
    const campaign = await repo.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async listRecipients(tenantDb: DataSource, campaignId: string): Promise<NotificationCampaignRecipient[]> {
    return tenantDb.getRepository(NotificationCampaignRecipient).find({
      where: { campaignId },
      order: { createdAt: 'ASC' },
    });
  }

  async createCampaign(
    tenantDb: DataSource,
    createdBy: string | null,
    body: {
      name: string;
      channel?: CampaignChannel;
      messageTemplate: string;
      targetType?: TargetType;
      targetRefId?: string;
      criteria?: Record<string, any>;
      scheduledAt?: string;
    },
  ): Promise<NotificationCampaign> {
    if (!body.name?.trim()) throw new BadRequestException('name is required');
    if (!body.messageTemplate?.trim()) throw new BadRequestException('messageTemplate is required');

    const repo = tenantDb.getRepository(NotificationCampaign);
    const entity = repo.create({
      name: body.name.trim(),
      channel: body.channel ?? 'sms',
      messageTemplate: body.messageTemplate,
      targetType: body.targetType ?? 'manual',
      targetRefId: body.targetRefId ?? null,
      criteria: body.criteria ?? {},
      status: body.scheduledAt ? 'scheduled' : 'draft',
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      createdBy,
    });
    return repo.save(entity);
  }

  async updateCampaign(
    tenantDb: DataSource,
    id: string,
    body: Partial<NotificationCampaign> & { scheduledAt?: string | null },
  ): Promise<NotificationCampaign> {
    const repo = tenantDb.getRepository(NotificationCampaign);
    const existing = await repo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Campaign not found');
    if (existing.status !== 'draft' && existing.status !== 'scheduled') {
      throw new BadRequestException('Only draft/scheduled campaigns can be updated');
    }

    Object.assign(existing, body as any);
    if (body.scheduledAt !== undefined) {
      existing.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
      existing.status = existing.scheduledAt ? 'scheduled' : 'draft';
    }
    return repo.save(existing);
  }

  async cancelCampaign(tenantDb: DataSource, id: string): Promise<NotificationCampaign> {
    const repo = tenantDb.getRepository(NotificationCampaign);
    const existing = await repo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Campaign not found');
    if (existing.status === 'completed') throw new BadRequestException('Cannot cancel completed campaign');
    existing.status = 'cancelled';
    return repo.save(existing);
  }

  async prepareRecipients(
    tenantDb: DataSource,
    campaignId: string,
    body: { patientIds?: string[] },
  ): Promise<{ queued: number }> {
    const campaign = await this.getCampaign(tenantDb, campaignId);
    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      throw new BadRequestException('Campaign is not editable');
    }

    let patientIds: string[] = [];

    if (campaign.targetType === 'manual') {
      patientIds = (body.patientIds ?? []).filter(Boolean);
      if (patientIds.length === 0) throw new BadRequestException('patientIds required for manual targeting');
    } else if (campaign.targetType === 'recall_list') {
      if (!campaign.targetRefId) throw new BadRequestException('targetRefId required for recall_list');
      const rows = await tenantDb.query(
        `SELECT DISTINCT patient_id FROM preventive_care_reminders WHERE status IN ('due','overdue') AND (due_date IS NULL OR due_date <= CURRENT_DATE)`,
      );
      patientIds = (rows as any[]).map((r) => r.patient_id);
      // If recall list has criteria.conditionType, narrow further
      try {
        const [list] = (await tenantDb.query(`SELECT criteria FROM recall_lists WHERE id = $1`, [campaign.targetRefId])) as any[];
        const criteria = list?.criteria || {};
        if (criteria?.conditionType) {
          const rows2 = await tenantDb.query(
            `SELECT DISTINCT patient_id FROM chronic_disease_registry WHERE condition_type = $1`,
            [criteria.conditionType],
          );
          const fromCond = (rows2 as any[]).map((r) => r.patient_id);
          patientIds = patientIds.filter((id) => fromCond.includes(id));
        }
      } catch {}
    } else if (campaign.targetType === 'query') {
      // Minimal: criteria can include { overdueScreenings: true, conditionType?: string }
      const criteria = campaign.criteria || {};
      if (criteria.overdueScreenings) {
        const rows = await tenantDb.query(
          `SELECT DISTINCT patient_id FROM preventive_care_reminders WHERE status IN ('due','overdue') AND (due_date IS NULL OR due_date <= CURRENT_DATE)`,
        );
        patientIds = (rows as any[]).map((r) => r.patient_id);
      }
      if (criteria.conditionType) {
        const rows = await tenantDb.query(
          `SELECT DISTINCT patient_id FROM chronic_disease_registry WHERE condition_type = $1`,
          [criteria.conditionType],
        );
        const fromCond = (rows as any[]).map((r) => r.patient_id);
        patientIds = patientIds.length ? patientIds.filter((id) => fromCond.includes(id)) : fromCond;
      }
      if (patientIds.length === 0) throw new BadRequestException('criteria produced no recipients');
    }

    patientIds = [...new Set(patientIds)];

    const repo = tenantDb.getRepository(NotificationCampaignRecipient);
    let queued = 0;
    for (const pid of patientIds) {
      const exists = await repo.findOne({ where: { campaignId, patientId: pid } });
      if (exists) continue;

      const dest = await this.resolveDestination(tenantDb, campaign.channel as CampaignChannel, pid);
      await repo.save(
        repo.create({
          campaignId,
          patientId: pid,
          destination: dest,
          status: dest ? 'queued' : 'skipped',
        }),
      );
      queued++;
    }
    return { queued };
  }

  async sendCampaignNow(tenantDb: DataSource, campaignId: string): Promise<{ sent: number; failed: number; skipped: number }> {
    const campaignRepo = tenantDb.getRepository(NotificationCampaign);
    const recipRepo = tenantDb.getRepository(NotificationCampaignRecipient);

    const campaign = await campaignRepo.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status === 'cancelled') throw new BadRequestException('Campaign cancelled');
    if (campaign.status === 'completed') throw new BadRequestException('Campaign already completed');

    campaign.status = 'sending';
    campaign.startedAt = new Date();
    await campaignRepo.save(campaign);

    const recipients = await recipRepo.find({ where: { campaignId }, order: { createdAt: 'ASC' } });
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const r of recipients) {
      if (r.status === 'skipped') {
        skipped++;
        continue;
      }
      if (r.status === 'sent' || r.status === 'delivered') continue;
      if (!r.destination) {
        r.status = 'skipped';
        await recipRepo.save(r);
        skipped++;
        continue;
      }

      try {
        if ((campaign.channel as CampaignChannel) === 'sms') {
          const payload = await this.notificationsService.sendSms(
            { phone: r.destination, message: campaign.messageTemplate },
            tenantDb,
          );
          r.status = 'sent';
          r.messageId = payload?.messageId ?? null;
          r.sentAt = new Date();
          await recipRepo.save(r);
          sent++;
        } else {
          // Email not implemented in NotificationsService; mark failed for now
          r.status = 'failed';
          r.error = 'Email channel not implemented';
          await recipRepo.save(r);
          failed++;
        }
      } catch (e: any) {
        r.status = 'failed';
        r.error = e?.message || 'send failed';
        await recipRepo.save(r);
        failed++;
      }
    }

    campaign.status = failed > 0 ? 'completed' : 'completed';
    campaign.completedAt = new Date();
    await campaignRepo.save(campaign);

    return { sent, failed, skipped };
  }

  private async resolveDestination(tenantDb: DataSource, channel: CampaignChannel, patientId: string): Promise<string | null> {
    if (channel === 'sms') {
      const rows = await tenantDb.query(`SELECT phone FROM patients WHERE id = $1`, [patientId]);
      const phone = rows?.[0]?.phone;
      return phone || null;
    }
    if (channel === 'email') {
      const rows = await tenantDb.query(`SELECT email FROM patients WHERE id = $1`, [patientId]);
      const email = rows?.[0]?.email;
      return email || null;
    }
    return null;
  }
}

