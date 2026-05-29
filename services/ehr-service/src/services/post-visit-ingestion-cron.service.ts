import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { PostVisitService } from './post-visit.service';
import { TranscriptionService, TranscriptionResult } from './transcription.service';
import { FileStorageService } from './file-storage.service';
import { TenantService } from './tenant.service';

@Injectable()
export class PostVisitIngestionCronService {
  private readonly logger = new Logger(PostVisitIngestionCronService.name);
  private readonly inFlight = new Set<string>(); // sessionId lock

  constructor(
    private readonly postVisitService: PostVisitService,
    private readonly transcriptionService: TranscriptionService,
    @Optional() private readonly fileStorageService?: FileStorageService,
    @Optional() private readonly tenantService?: TenantService,
  ) {}

  @Cron('*/2 * * * *')
  async ingestCapturedSessions(): Promise<void> {
    if (process.env.FEATURE_POSTVISIT_INGESTION_CRON === 'false') return;

    const tenants = await this.tenantService?.getAllActiveTenants?.().catch(() => []) ?? [];

    for (const tenant of tenants) {
      const subdomain = typeof tenant === 'string' ? tenant : tenant?.subdomain;
      if (!subdomain) continue;

      const tenantDb = await this.tenantService?.getTenantDatabase(subdomain).catch(() => null);
      if (!tenantDb) continue;

      await this.processTenant(tenantDb, subdomain).catch(e =>
        this.logger.warn(`Ingestion cron failed for ${subdomain}: ${e?.message}`),
      );
    }
  }

  private async processTenant(tenantDb: DataSource, subdomain: string): Promise<void> {
    const sessions = await tenantDb.query(`
      SELECT id, source_type, ambient_session_id, recording_storage_key,
             patient_id, doctor_id, language
      FROM post_visit_sessions
      WHERE status = 'captured'
        AND (recording_storage_key IS NOT NULL OR ambient_session_id IS NOT NULL)
      ORDER BY created_at ASC
      LIMIT 10
    `).catch(() => []);

    const work: Array<Promise<void>> = [];
    for (const session of sessions) {
      if (this.inFlight.has(session.id)) continue;
      this.inFlight.add(session.id);

      work.push(
        this.processSession(tenantDb, session, subdomain)
          .catch(e =>
            this.logger.error(
              `Ingestion failed for session ${session.id} (${subdomain}): ${e?.message}`,
            ),
          )
          .finally(() => this.inFlight.delete(session.id)),
      );
    }

    await Promise.all(work);
  }

  private async processSession(
    tenantDb: DataSource,
    session: {
      id: string;
      source_type: string;
      ambient_session_id: string | null;
      recording_storage_key: string | null;
      patient_id: string;
      doctor_id: string;
      language: string | null;
    },
    subdomain: string,
  ): Promise<void> {
    this.logger.log(
      `Ingesting session ${session.id} (${session.source_type}) for tenant ${subdomain}`,
    );

    let result: TranscriptionResult;

    if (session.ambient_session_id) {
      result = await this.buildResultFromAmbientSession(tenantDb, session.ambient_session_id, session.language);
    } else if (session.recording_storage_key) {
      result = await this.buildResultFromRecording(tenantDb, session.recording_storage_key, session.language);
    } else {
      this.logger.warn(`Session ${session.id} has no ingestion source - skipping`);
      return;
    }

    await this.postVisitService.ingestTranscriptionResult(
      tenantDb,
      session.id,
      result,
      {
        tenantId: subdomain,
        actorUserId: null,
        source: `ingestion_cron_${session.source_type}`,
      },
    );

    this.logger.log(`Session ${session.id} ingested -> draft_ready`);
  }

  private async buildResultFromAmbientSession(
    tenantDb: DataSource,
    ambientSessionId: string,
    sessionLanguage: string | null,
  ): Promise<TranscriptionResult> {
    const rows = await tenantDb.query(
      `SELECT transcript_raw, structured_output, draft_note, session_started_at, session_ended_at
       FROM ambient_sessions
       WHERE id = $1 LIMIT 1`,
      [ambientSessionId],
    ).catch(() => []);

    const row = rows?.[0];
    if (!row) {
      throw new Error(`AmbientSession ${ambientSessionId} not found`);
    }

    const transcriptRaw: string = row.transcript_raw || '';
    const draftNote: Record<string, any> = row.draft_note || {};
    const language = sessionLanguage || 'en';

    const sessionDurationSecs = row.session_ended_at && row.session_started_at
      ? Math.round(
          (new Date(row.session_ended_at).getTime() - new Date(row.session_started_at).getTime()) / 1000,
        )
      : 0;

    const result: TranscriptionResult = {
      text: transcriptRaw,
      language,
      confidence: 0.9,
      segments: transcriptRaw
        ? [
            {
              start: 0,
              end: sessionDurationSecs,
              text: transcriptRaw,
              speakerRole: 'unknown',
            },
          ]
        : [],
      soap_note: draftNote
        ? {
            subjective: draftNote.subjective || '',
            objective: draftNote.objective || '',
            assessment: draftNote.assessment || '',
            plan: draftNote.plan || '',
            original_language_detected: language,
          }
        : undefined,
    };

    return result;
  }

  private async buildResultFromRecording(
    tenantDb: DataSource,
    recordingStorageKey: string,
    sessionLanguage: string | null,
  ): Promise<TranscriptionResult> {
    if (!this.fileStorageService) {
      throw new Error('FileStorageService not available - cannot transcribe recording');
    }

    const bucket = process.env.MINIO_BUCKET || 'umoya';
    const buffer = await this.fileStorageService.downloadBuffer(bucket, recordingStorageKey);

    const multerFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'recording.mp4',
      encoding: '7bit',
      mimetype: 'video/mp4',
      buffer,
      size: buffer.length,
      stream: null as any,
      destination: '',
      filename: 'recording.mp4',
      path: '',
    };

    const result = await this.transcriptionService.transcribe(
      multerFile,
      { language: (sessionLanguage as any) || 'auto' },
      {},
    );

    return result;
  }
}
