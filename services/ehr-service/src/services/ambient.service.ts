import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import axios from 'axios';
import { AmbientSession } from '../entities/ambient-session.entity';

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

@Injectable()
export class AmbientService {
  private readonly logger = new Logger(AmbientService.name);
  private readonly cdssUrl: string;

  constructor() {
    this.cdssUrl = (process.env.CDSS_SERVICE_URL || '').replace(/\/$/, '');
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

    if (this.cdssUrl) {
      try {
        const resp = await axios.post(
          `${this.cdssUrl}/transcription/stream`,
          { audio: audioBase64, session_id: sessionId, context: session.structuredOutput },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Service-Token': process.env.CDSS_SERVICE_TOKEN || '',
            },
            timeout: 20_000,
          },
        );
        result = resp.data as ProcessChunkResult;
      } catch (err: any) {
        this.logger.warn(`CDSS /transcription/stream error: ${String(err?.message || err)}`);
      }
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
  ): Promise<AmbientSession> {
    await tenantDb.getRepository(AmbientSession).update(sessionId, {
      status:         'completed',
      sessionEndedAt: new Date(),
    });
    return this.getSession(sessionId, tenantDb);
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
