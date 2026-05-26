import { Injectable, Logger } from '@nestjs/common';
import { SmsService } from './sms.service';

export interface CreateCampaignDto {
  name: string;
  messageTemplate: string;
  audienceCriteria: {
    nudge_type?: 'appointment_reminder' | 'refill_reminder' | 'vl_due' | 'general';
    age_min?: number;
    age_max?: number;
    on_mmd?: boolean;
    days_before_appointment?: number;
  };
  language: 'en' | 'sn' | 'nd';
  scheduledAt?: string;
}

@Injectable()
export class SmsCampaignService {
  private readonly logger = new Logger(SmsCampaignService.name);

  constructor(private readonly sms: SmsService) {}

  async createCampaign(dto: CreateCampaignDto, createdBy: string, db: any): Promise<{ id: string }> {
    const recipients = await this.resolveAudience(dto.audienceCriteria, db);
    const [campaign] = await db.query(
      `INSERT INTO sms_campaigns (name, message_template, audience_criteria, language, scheduled_at, status, total_recipients, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [
        dto.name, dto.messageTemplate, JSON.stringify(dto.audienceCriteria),
        dto.language, dto.scheduledAt ?? null,
        dto.scheduledAt ? 'scheduled' : 'sending',
        recipients.length, createdBy,
      ],
    );

    if (!dto.scheduledAt) {
      this.dispatchAsync(campaign.id, recipients, dto.messageTemplate, db).catch(
        err => this.logger.error(`Campaign ${campaign.id} dispatch error: ${err.message}`),
      );
    }
    return campaign;
  }

  async listCampaigns(db: any) {
    return db.query(`SELECT * FROM sms_campaigns ORDER BY created_at DESC LIMIT 50`);
  }

  async getCampaignStats(campaignId: string, db: any) {
    const [row] = await db.query(
      `SELECT c.*,
              COUNT(d.id) FILTER (WHERE d.status = 'delivered') as actual_delivered,
              COUNT(d.id) FILTER (WHERE d.status = 'failed') as actual_failed
       FROM sms_campaigns c
       LEFT JOIN sms_dispatch_log d ON d.campaign_id = c.id
       WHERE c.id = $1 GROUP BY c.id`,
      [campaignId],
    );
    return row;
  }

  async processScheduledCampaigns(db: any): Promise<void> {
    const due = await db.query(
      `SELECT id, message_template, audience_criteria FROM sms_campaigns WHERE status = 'scheduled' AND scheduled_at <= NOW()`,
    );
    for (const campaign of due) {
      const recipients = await this.resolveAudience(campaign.audience_criteria, db);
      await db.query(
        `UPDATE sms_campaigns SET status = 'sending', sent_at = NOW(), total_recipients = $2 WHERE id = $1`,
        [campaign.id, recipients.length],
      );
      this.dispatchAsync(campaign.id, recipients, campaign.message_template, db).catch(
        err => this.logger.error(`Scheduled campaign ${campaign.id} error: ${err.message}`),
      );
    }
  }

  private async dispatchAsync(
    campaignId: string,
    recipients: Array<{ patient_id: string; phone: string; name: string }>,
    template: string,
    db: any,
  ): Promise<void> {
    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      const message = template.replace('{name}', recipient.name).replace('{clinic}', 'Newlands Clinic');
      const [log] = await db.query(
        `INSERT INTO sms_dispatch_log (campaign_id, patient_id, phone_number, message, status) VALUES ($1,$2,$3,$4,'pending') RETURNING id`,
        [campaignId, recipient.patient_id, recipient.phone, message],
      );
      try {
        await this.sms.sendSms(recipient.phone, message);
        await db.query(`UPDATE sms_dispatch_log SET status = 'sent', sent_at = NOW() WHERE id = $1`, [log.id]);
        sentCount++;
      } catch (err: any) {
        this.logger.warn(`AT failed for ${recipient.phone}: ${err.message} — trying Twilio`);
        try {
          await this.sms.sendSmsFallback(recipient.phone, message);
          await db.query(`UPDATE sms_dispatch_log SET status = 'sent', provider = 'twilio', sent_at = NOW() WHERE id = $1`, [log.id]);
          sentCount++;
        } catch (fallbackErr: any) {
          await db.query(`UPDATE sms_dispatch_log SET status = 'failed', error_message = $2 WHERE id = $1`, [log.id, fallbackErr.message]);
          failedCount++;
        }
      }
    }

    await db.query(
      `UPDATE sms_campaigns SET status = 'sent', sent_count = $2, failed_count = $3, sent_at = NOW() WHERE id = $1`,
      [campaignId, sentCount, failedCount],
    );
  }

  private async resolveAudience(
    criteria: CreateCampaignDto['audienceCriteria'],
    db: any,
  ): Promise<Array<{ patient_id: string; phone: string; name: string }>> {
    let sql = `
      SELECT p.id as patient_id, p.phone_number as phone,
             p.first_name || ' ' || p.last_name as name
      FROM patients p
      LEFT JOIN sms_opt_outs o ON o.phone_number = p.phone_number
      WHERE o.id IS NULL AND p.phone_number IS NOT NULL
    `;
    const params: unknown[] = [];
    let idx = 1;

    if (criteria.age_min !== undefined) {
      sql += ` AND DATE_PART('year', AGE(p.date_of_birth)) >= $${idx++}`;
      params.push(criteria.age_min);
    }
    if (criteria.age_max !== undefined) {
      sql += ` AND DATE_PART('year', AGE(p.date_of_birth)) <= $${idx++}`;
      params.push(criteria.age_max);
    }
    if (criteria.on_mmd) {
      sql += ` AND EXISTS (SELECT 1 FROM hiv_mmd_schedules m WHERE m.patient_id = p.id AND m.is_active = true)`;
    }
    if (criteria.days_before_appointment !== undefined) {
      sql += ` AND EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = p.id AND a.appointment_date::date = CURRENT_DATE + $${idx++} AND a.status = 'scheduled')`;
      params.push(criteria.days_before_appointment);
    }

    return db.query(sql, params);
  }
}
