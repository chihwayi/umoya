import { Injectable, Logger, Optional } from '@nestjs/common';
import { PostVisitGroundedLlmService } from './post-visit-grounded-llm.service';
import { AlertDeliveryService } from './alert-delivery.service';

export interface DailyWebhookPayload {
  event: string;
  id: string;
  payload: {
    room?: { name?: string };
    meeting?: { id?: string; duration?: number };
    participants?: unknown[];
  };
  timestamp: number;
}

@Injectable()
export class TelemedicinePostcallService {
  private readonly logger = new Logger(TelemedicinePostcallService.name);

  constructor(
    private readonly llmService: PostVisitGroundedLlmService,
    @Optional() private readonly alertDelivery?: AlertDeliveryService,
  ) {}

  async handleCallEnded(
    payload: DailyWebhookPayload,
    db: any,
    subdomain: string,
  ): Promise<void> {
    const sessionId = payload.id;
    const roomName = payload.payload?.room?.name ?? '';
    const meetingId = payload.payload?.meeting?.id ?? '';
    const duration = payload.payload?.meeting?.duration ?? 0;
    const calledAt = new Date(payload.timestamp * 1000);

    const sessions = await db.query(
      `SELECT ts.*, e.id AS encounter_id, e.patient_id, e.doctor_id
       FROM telemedicine_sessions ts
       LEFT JOIN encounters e ON e.id = ts.encounter_id
       WHERE ts.room_name = $1 AND ts.status = 'active'
       ORDER BY ts.created_at DESC LIMIT 1`,
      [roomName],
    );
    const session = sessions[0] ?? null;

    if (!session) {
      this.logger.warn(`No active session found for room ${roomName}`);
      return;
    }

    const existing = await db.query(
      `SELECT id FROM telemedicine_postcall_events WHERE session_id = $1 LIMIT 1`,
      [sessionId],
    );
    if (existing.length > 0) {
      this.logger.log(`Duplicate webhook for session ${sessionId}, skipping`);
      return;
    }

    const rows = await db.query(
      `INSERT INTO telemedicine_postcall_events
         (session_id, patient_id, doctor_id, encounter_id,
          call_ended_at, duration_seconds, daily_room_name, daily_meeting_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [
        sessionId,
        session.patient_id,
        session.doctor_id,
        session.encounter_id,
        calledAt,
        duration,
        roomName,
        meetingId,
      ],
    );
    const eventId = rows[0].id;

    await db.query(
      `UPDATE telemedicine_sessions SET status = 'completed', ended_at = $1 WHERE room_name = $2`,
      [calledAt, roomName],
    );

    this.runPipeline(eventId, session, db, subdomain).catch((err) => {
      this.logger.error(`Pipeline failed for event ${eventId}: ${err.message}`);
    });
  }

  private async runPipeline(
    eventId: string,
    session: any,
    db: any,
    subdomain: string,
  ): Promise<void> {
    try {
      const encounters = await db.query(
        `SELECT e.*, p.first_name, p.last_name, p.date_of_birth
         FROM encounters e
         JOIN patients p ON p.id = e.patient_id
         WHERE e.id = $1`,
        [session.encounter_id],
      );
      const encounter = encounters[0] ?? null;
      if (!encounter) throw new Error('Encounter not found');

      const notes = await db.query(
        `SELECT content FROM clinical_notes
         WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 5`,
        [session.patient_id],
      );
      const context = notes.map((n: any) => n.content).join('\n---\n');

      let soapNote = '';
      let escalationLevel = 'none';
      try {
        const draft = await this.llmService.draftClinicalNote({
          sessionId: session.encounter_id ?? session.id ?? 'unknown',
          transcriptText: context,
          tenantId: undefined,
        });
        soapNote = draft?.noteText ?? '';

        if (soapNote) {
          const escalation = await this.llmService.classifyEscalationSignal({
            sessionId: session.encounter_id,
            message: soapNote.slice(0, 1200),
            triggerTerms: [],
            candidateSeverity: 'low',
          });
          escalationLevel = escalation?.severity ?? 'none';

          if (['critical', 'high'].includes(escalationLevel) && this.alertDelivery) {
            await this.alertDelivery.broadcastCriticalAlert(subdomain, {
              alertType: 'telemedicine_escalation',
              sourceEntityId: eventId,
              patientId: session.patient_id,
              severity: escalationLevel as any,
              message: `Telemedicine post-call escalation: ${escalation?.rationale ?? escalationLevel}`,
              payload: { eventId, soapNoteSnippet: soapNote.slice(0, 200) },
            });
          }
        }
      } catch (llmErr: any) {
        this.logger.warn(`LLM pipeline partial failure: ${llmErr.message}`);
      }

      if (soapNote) {
        await db.query(
          `INSERT INTO clinical_notes (encounter_id, patient_id, author_id, content, note_type, source)
           VALUES ($1,$2,$3,$4,'SOAP','ai_telemedicine')
           ON CONFLICT DO NOTHING`,
          [session.encounter_id, session.patient_id, session.doctor_id, soapNote],
        );
      }

      await db
        .query(
          `UPDATE patient_notifications SET status = 'delivered'
           WHERE patient_id = $1 AND type = 'telemedicine_pending'`,
          [session.patient_id],
        )
        .catch(() => null);

      await db.query(
        `INSERT INTO patient_notifications (patient_id, type, title, body, data)
         VALUES ($1,'telemedicine_summary','Consultation Summary Ready',
                 'Your consultation summary is available. Tap to view.',
                 $2::jsonb)
         ON CONFLICT DO NOTHING`,
        [session.patient_id, JSON.stringify({ encounterId: session.encounter_id })],
      );

      await db.query(
        `UPDATE telemedicine_postcall_events
         SET status = 'completed', pipeline_completed_at = now(),
             soap_note = $2, escalation_level = $3
         WHERE id = $1`,
        [eventId, soapNote, escalationLevel],
      );
    } catch (err: any) {
      await db.query(
        `UPDATE telemedicine_postcall_events
         SET status = 'failed', error_message = $2,
             retry_count = retry_count + 1
         WHERE id = $1`,
        [eventId, err.message],
      );
      throw err;
    }
  }

  async getPostcallEvents(patientId: string, db: any, limit = 10): Promise<unknown[]> {
    return db.query(
      `SELECT id, session_id, call_ended_at, duration_seconds,
              status, soap_note, escalation_level, created_at
       FROM telemedicine_postcall_events
       WHERE patient_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [patientId, limit],
    );
  }

  async retryFailed(eventId: string, db: any, subdomain: string): Promise<void> {
    const rows = await db.query(
      `SELECT * FROM telemedicine_postcall_events WHERE id = $1`,
      [eventId],
    );
    const event = rows[0] ?? null;
    if (!event) throw new Error('Event not found');
    if (event.retry_count >= 3) throw new Error('Max retries exceeded');

    const sessions = await db.query(
      `SELECT * FROM telemedicine_sessions WHERE room_name = $1 LIMIT 1`,
      [event.daily_room_name],
    );
    await this.runPipeline(eventId, sessions[0] ?? {}, db, subdomain);
  }
}
