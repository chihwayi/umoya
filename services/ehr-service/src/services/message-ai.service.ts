import { Injectable, Logger, Optional } from '@nestjs/common';
import { CdssService } from './cdss.service';

type Urgency = 'urgent' | 'routine' | 'administrative' | 'follow_up';

const PRIORITY_MAP: Record<string, Urgency> = {
  critical: 'urgent',
  urgent: 'urgent',
  routine: 'routine',
  informational: 'administrative',
};

@Injectable()
export class MessageAiService {
  private readonly logger = new Logger(MessageAiService.name);

  constructor(@Optional() private readonly cdss: CdssService) {}

  async enrichMessage(
    messageId: string,
    content: string,
    senderPatientId: string,
    _clinicianLanguage: string,
    db: any,
  ): Promise<unknown> {
    let urgency: Urgency = 'routine';
    let urgencyConfidence = 0.5;
    let replyDraft: string | null = null;

    try {
      if (this.cdss) {
        const triage = await this.cdss.triageInboxItem({
          sourceType: 'patient_message',
          title: 'Patient message',
          content,
          patientId: senderPatientId,
          sourceId: messageId,
        });

        if (!triage.abstained) {
          urgency = PRIORITY_MAP[triage.priority] ?? 'routine';
          urgencyConfidence = Math.min((triage.triage_score ?? 50) / 100, 1);
          replyDraft = triage.draft_reply ?? null;
        }
      } else {
        urgency = this.ruleBasedUrgency(content);
        urgencyConfidence = 0.6;
      }
    } catch (err: any) {
      this.logger.warn(`Message triage failed: ${err.message}`);
      urgency = this.ruleBasedUrgency(content);
    }

    const rows = await db.query(
      `INSERT INTO message_ai_enrichment
         (message_id, urgency, urgency_confidence, reply_draft,
          translated_content, detected_language, translation_language)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (message_id) DO UPDATE SET
         urgency = EXCLUDED.urgency,
         urgency_confidence = EXCLUDED.urgency_confidence,
         reply_draft = EXCLUDED.reply_draft,
         translated_content = EXCLUDED.translated_content,
         detected_language = EXCLUDED.detected_language,
         translation_language = EXCLUDED.translation_language
       RETURNING *`,
      [messageId, urgency, urgencyConfidence, replyDraft, null, null, _clinicianLanguage],
    );
    return rows[0];
  }

  private ruleBasedUrgency(content: string): Urgency {
    if (/urgent|emergency|chest pain|can't breathe|bleeding|stroke|seizure|overdose/i.test(content)) return 'urgent';
    if (/appointment|reschedule|cancel|bill|insurance|referral letter/i.test(content)) return 'administrative';
    if (/follow.?up|results|lab|how are|feeling better/i.test(content)) return 'follow_up';
    return 'routine';
  }

  async approveDraft(
    messageId: string,
    approvedBy: string,
    editedContent: string | null,
    db: any,
  ): Promise<{ replyContent: string }> {
    const enrichmentRows = await db.query(
      `SELECT reply_draft FROM message_ai_enrichment WHERE message_id = $1`,
      [messageId],
    );
    const enrichment = enrichmentRows[0] ?? null;
    const replyContent = editedContent ?? enrichment?.reply_draft ?? '';

    const messageRows = await db.query(
      `SELECT patient_id, thread_id FROM messages WHERE id = $1`,
      [messageId],
    );
    const msg = messageRows[0] ?? null;
    if (msg) {
      await db.query(
        `INSERT INTO messages
           (thread_id, sender_type, sender_id, patient_id, content, sent_by_ai)
         VALUES ($1,'staff',$2,$3,$4,false)`,
        [msg.thread_id, approvedBy, msg.patient_id, replyContent],
      );
    }

    await db.query(
      `UPDATE message_ai_enrichment
       SET draft_approved_by = $2, draft_approved_at = now(), draft_sent = true
       WHERE message_id = $1`,
      [messageId, approvedBy],
    );

    return { replyContent };
  }

  async getEnrichedInbox(doctorId: string, db: any): Promise<unknown[]> {
    return db.query(
      `SELECT m.*, mae.urgency, mae.urgency_confidence,
              mae.reply_draft, mae.translated_content, mae.detected_language,
              mae.draft_sent
       FROM messages m
       LEFT JOIN message_ai_enrichment mae ON mae.message_id = m.id
       WHERE (m.assigned_to = $1 OR m.thread_id IN (
         SELECT thread_id FROM message_thread_participants WHERE staff_id = $1
       ))
       AND m.sender_type = 'patient'
       AND m.status = 'unread'
       ORDER BY
         CASE mae.urgency WHEN 'urgent' THEN 1 WHEN 'follow_up' THEN 2
           WHEN 'routine' THEN 3 ELSE 4 END,
         m.created_at DESC
       LIMIT 50`,
      [doctorId],
    );
  }
}
