import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SmsCampaignService } from './sms-campaign.service';
import { TenantService } from './tenant.service';

const NUDGE_TEMPLATES: Record<string, Record<string, string>> = {
  daily_reminder: {
    en: 'Hello {name}, this is your daily medication reminder from Newlands Clinic. Remember to take your ART today.',
    sn: 'Mhoro {name}, chirango chako chemishonga kubva kuNewlands Clinic. Rangarira kutora mishonga yako yanhasi.',
    nd: 'Sawubona {name}, lesi yisikhumbuziso sakho semithi esivela e-Newlands Clinic. Khumbula ukuthatja imithi yakho namhlanje.',
  },
  appointment_reminder: {
    en: 'Hi {name}, you have an appointment at Newlands Clinic on {date}. Please confirm via *123# or call 0800-NEWLANDS.',
    sn: 'Mhoro {name}, une musangano kuNewlands Clinic musi wa{date}. Ndokumbirawo usimbisi kuburikidza ne*123#.',
    nd: 'Sawubona {name}, ulemimangano e-Newlands Clinic ngomhla ka{date}. Sicela uqinisekise nge*123#.',
  },
  refill_reminder: {
    en: 'Hi {name}, your medication is due for refill soon. Dial *123# to request your refill or visit Newlands Clinic.',
    sn: 'Mhoro {name}, mishonga yako yasvika nguva yekugamuchira zvakare. Bhadha *123# kukumbira refill yako.',
    nd: 'Sawubona {name}, imithi yakho isiduze ukuphelelwa. Shayana *123# ukucela ukugcwaliswa kwayo.',
  },
};

@Injectable()
export class AdherenceNudgeService {
  private readonly logger = new Logger(AdherenceNudgeService.name);

  constructor(
    private readonly campaigns: SmsCampaignService,
    private readonly tenantService: TenantService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async sendDailyNudges(): Promise<void> {
    const tenants = await this.tenantService.getAllActiveTenants();
    for (const tenant of tenants) {
      await this.sendNudgesForTenant(tenant.databaseName).catch(
        err => this.logger.error(`Nudges failed for ${tenant.subdomain}: ${err.message}`),
      );
    }
  }

  private async sendNudgesForTenant(tenantDb: string): Promise<void> {
    const db = { query: async (sql: string, params?: any[]) => {
      throw new Error(`No db connection for ${tenantDb}`);
    } };
    await this.campaigns.processScheduledCampaigns(db);
  }

  async sendNudgesNow(db: any): Promise<{ sent: number }> {
    const due = await db.query(
      `SELECT s.id, s.patient_id, s.nudge_type, s.language, p.phone_number, p.first_name
       FROM adherence_nudge_schedules s
       JOIN patients p ON p.id = s.patient_id
       LEFT JOIN sms_opt_outs o ON o.phone_number = p.phone_number
       WHERE s.is_active = true AND s.next_send_at <= NOW() AND o.id IS NULL AND p.phone_number IS NOT NULL`,
    );

    for (const nudge of due) {
      const templates = NUDGE_TEMPLATES[nudge.nudge_type] ?? NUDGE_TEMPLATES['daily_reminder'];
      const template = templates[nudge.language] ?? templates['en'];
      const message = template.replace('{name}', nudge.first_name);

      try {
        await this.campaigns.createCampaign(
          { name: `Nudge:${nudge.nudge_type}:${nudge.patient_id}`, messageTemplate: message, audienceCriteria: {}, language: nudge.language },
          'system',
          db,
        );
        const nextSend = this.calculateNextSend(nudge.nudge_type);
        await db.query(
          `UPDATE adherence_nudge_schedules SET last_sent_at = NOW(), next_send_at = $2 WHERE id = $1`,
          [nudge.id, nextSend],
        );
      } catch (err: any) {
        this.logger.error(`Nudge ${nudge.id} failed: ${err.message}`);
      }
    }
    return { sent: due.length };
  }

  async enrollPatientInNudges(patientId: string, nudgeType: string, language: 'en' | 'sn' | 'nd', db: any): Promise<void> {
    await db.query(
      `INSERT INTO adherence_nudge_schedules (patient_id, nudge_type, language, next_send_at)
       VALUES ($1,$2,$3, NOW() + INTERVAL '1 day')
       ON CONFLICT (patient_id, nudge_type) DO UPDATE SET language = EXCLUDED.language, is_active = true, updated_at = NOW()`,
      [patientId, nudgeType, language],
    );
  }

  private calculateNextSend(nudgeType: string): Date {
    const now = new Date();
    switch (nudgeType) {
      case 'daily_reminder': now.setDate(now.getDate() + 1); break;
      case 'appointment_reminder': now.setDate(now.getDate() + 7); break;
      case 'refill_reminder': now.setDate(now.getDate() + 30); break;
      default: now.setDate(now.getDate() + 1);
    }
    return now;
  }
}
