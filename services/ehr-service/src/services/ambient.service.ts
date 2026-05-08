import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AmbientSession } from '../entities/ambient-session.entity';
import { CdssService } from './cdss.service';
import { PostVisitSessionService } from './post-visit-session.service';

export interface StartSessionDto {
  patientId: string;
  providerId: string;
  appointmentId?: string;
}

export interface ProcessChunkResult {
  transcript: string;
  entities: {
    diagnoses: Array<{ text: string; icd?: string; confidence: number }>;
    medications: Array<{ name: string; dose?: string; route?: string }>;
    allergies: Array<{ allergen: string; reaction?: string }>;
    orders: Array<{ type: string; description: string; urgency?: string }>;
    vitals: Array<{ type: string; value: string }>;
    alerts: Array<{ type: string; message: string; severity: string }>;
  };
  draftNote: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
}

interface ChunkRetryItem {
  sessionId: string;
  audioBase64: string;
  tenantDb: DataSource;
  attempt: number;
  nextRetryAt: number;
}

@Injectable()
export class AmbientService {
  private readonly logger = new Logger(AmbientService.name);
  private readonly chunkRetryQueue: ChunkRetryItem[] = [];
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly cdssService: CdssService,
    @Optional() private readonly postVisitSessionService?: PostVisitSessionService,
  ) {}

  private scheduleRetryFlush() {
    if (this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.flushRetryQueue();
    }, 5_000);
    this.retryTimer.unref?.();
  }

  private async flushRetryQueue(): Promise<void> {
    const now = Date.now();
    const due = this.chunkRetryQueue.filter(item => item.nextRetryAt <= now);
    for (const item of due) {
      const idx = this.chunkRetryQueue.indexOf(item);
      if (idx !== -1) this.chunkRetryQueue.splice(idx, 1);

      try {
        await this.cdssService.ambientTranscriptionStream(
          { sessionId: item.sessionId, audioBase64: item.audioBase64, context: {}, patientId: '', appointmentId: undefined },
          undefined,
          item.tenantDb,
        );
        this.logger.log(`[Ambient retry] chunk reprocessed for session ${item.sessionId}`);
      } catch {
        if (item.attempt < 3) {
          this.chunkRetryQueue.push({
            ...item,
            attempt: item.attempt + 1,
            nextRetryAt: Date.now() + (item.attempt + 1) * 10_000,
          });
          this.scheduleRetryFlush();
        } else {
          this.logger.warn(`[Ambient retry] chunk dropped after 3 attempts for session ${item.sessionId}`);
        }
      }
    }
    if (this.chunkRetryQueue.length > 0) this.scheduleRetryFlush();
  }

  async startSession(dto: StartSessionDto, tenantDb: DataSource): Promise<AmbientSession> {
    const repo = tenantDb.getRepository(AmbientSession);
    const session = repo.create({
      patientId:       dto.patientId,
      providerId:      dto.providerId,
      appointmentId:   dto.appointmentId,
      status:          'active',
      sessionStartedAt: new Date(),
    });
    return repo.save(session);
  }

  async getSession(sessionId: string, tenantDb: DataSource): Promise<AmbientSession> {
    const session = await tenantDb.getRepository(AmbientSession).findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException(`AmbientSession ${sessionId} not found`);
    return session;
  }

  async getSessionsForPatient(patientId: string, tenantDb: DataSource, limit = 10): Promise<AmbientSession[]> {
    return tenantDb.getRepository(AmbientSession).find({
      where: { patientId },
      order: { sessionStartedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Send an audio chunk to the CDSS /transcription/stream endpoint.
   * Returns structured entities extracted from the conversation so far.
   */
  async processChunk(
    sessionId: string,
    audioBase64: string,
    tenantDb: DataSource,
  ): Promise<ProcessChunkResult> {
    const session = await this.getSession(sessionId, tenantDb);

    let result: ProcessChunkResult = {
      transcript: '',
      entities: { diagnoses: [], medications: [], allergies: [], orders: [], vitals: [], alerts: [] },
      draftNote: {},
    };

    try {
      result = await this.cdssService.ambientTranscriptionStream(
        {
          sessionId,
          audioBase64,
          context: session.structuredOutput,
          patientId: session.patientId,
          appointmentId: session.appointmentId,
        },
        undefined,
        tenantDb,
      ) as ProcessChunkResult;
    } catch (err: any) {
      this.logger.warn(`CDSS ambient transcription error (queuing retry): ${String(err?.message || err)}`);
      this.chunkRetryQueue.push({
        sessionId,
        audioBase64,
        tenantDb,
        attempt: 1,
        nextRetryAt: Date.now() + 10_000,
      });
      this.scheduleRetryFlush();
    }

    // Merge into session
    const repo = tenantDb.getRepository(AmbientSession);
    const currentTranscript = session.transcriptRaw || '';
    const appendedTranscript = result.transcript
      ? `${currentTranscript}${currentTranscript ? ' ' : ''}${result.transcript}`
      : currentTranscript;

    const merged = this.mergeStructuredOutput(session.structuredOutput, result.entities);

    // Merge draft note — keep existing text if AI returns empty
    const draftNote = {
      subjective: result.draftNote.subjective || session.draftNote.subjective || '',
      objective:  result.draftNote.objective  || session.draftNote.objective  || '',
      assessment: result.draftNote.assessment || session.draftNote.assessment || '',
      plan:       result.draftNote.plan       || session.draftNote.plan       || '',
    };

    await repo.update(sessionId, {
      transcriptRaw:       appendedTranscript,
      structuredOutput:    merged as any,
      draftNote:           draftNote as any,
      aiSuggestedOrders:   result.entities.orders as any,
      aiSuggestedDiagnoses: result.entities.diagnoses as any,
      alertsRaised:        [...(session.alertsRaised || []), ...result.entities.alerts] as any,
    });

    return result;
  }

  /** Record provider accepting or dismissing a suggestion */
  async recordProviderAction(
    sessionId: string,
    category: 'orders' | 'diagnoses',
    itemId: string,
    action: 'accepted' | 'dismissed',
    tenantDb: DataSource,
  ): Promise<void> {
    const session = await this.getSession(sessionId, tenantDb);
    const accepted = { ...session.providerAcceptedFields };
    if (!accepted[category]) accepted[category] = {};
    accepted[category][itemId] = action;

    await tenantDb.getRepository(AmbientSession).update(sessionId, {
      providerAcceptedFields: accepted,
    });
  }

  async endSession(
    sessionId: string,
    tenantDb: DataSource,
    requestContext: { tenantId?: string; actorUserId?: string | null } = {},
  ): Promise<AmbientSession & { postVisitSessionId?: string | null }> {
    await tenantDb.getRepository(AmbientSession).update(sessionId, {
      status:         'completed',
      sessionEndedAt: new Date(),
    });

    const session = await this.getSession(sessionId, tenantDb);

    let postVisitSessionId: string | null = null;

    if (this.postVisitSessionService) {
      try {
        // Create a captured post-visit session linked to this ambient session
        const pvSession = await this.postVisitSessionService.createSession(
          tenantDb,
          {
            patientId:     session.patientId,
            doctorId:      session.providerId,
            appointmentId: session.appointmentId ?? undefined,
            sourceType:    'in_person',
            language:      'en',
            startedAt:     session.sessionStartedAt?.toISOString(),
          },
          requestContext,
        );

        // Link the ambient session to the post-visit session
        await tenantDb.query(
          `UPDATE post_visit_sessions
           SET ambient_session_id = $1, updated_at = NOW()
           WHERE id = $2`,
          [sessionId, pvSession.id],
        );

        postVisitSessionId = pvSession.id;
        this.logger.log(
          `Post-visit session ${pvSession.id} created for ambient session ${sessionId}`,
        );
      } catch (err: any) {
        // Post-visit session creation must never break the session end flow
        this.logger.error(
          `Failed to create post-visit session for ambient session ${sessionId}: ${err?.message}`,
        );
      }
    }

    return postVisitSessionId ? { ...session, postVisitSessionId } : { ...session };
  }

  async pauseSession(sessionId: string, tenantDb: DataSource): Promise<void> {
    await tenantDb.getRepository(AmbientSession).update(sessionId, { status: 'paused' });
  }

  async resumeSession(sessionId: string, tenantDb: DataSource): Promise<void> {
    await tenantDb.getRepository(AmbientSession).update(sessionId, { status: 'active' });
  }

  private mergeStructuredOutput(
    existing: Record<string, any>,
    newEntities: ProcessChunkResult['entities'],
  ): Record<string, any> {
    return {
      diagnoses:   this.dedupeByField([...(existing.diagnoses  || []), ...newEntities.diagnoses],  'text'),
      medications: this.dedupeByField([...(existing.medications|| []), ...newEntities.medications], 'name'),
      allergies:   this.dedupeByField([...(existing.allergies  || []), ...newEntities.allergies],   'allergen'),
      vitals:      [...(existing.vitals || []), ...newEntities.vitals],
    };
  }

  private dedupeByField<T extends Record<string, any>>(arr: T[], field: string): T[] {
    const seen = new Set<string>();
    return arr.filter((item) => {
      const key = String(item[field] || '').toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
