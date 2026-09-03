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

  /** Threshold past which a `'captured'` session with a valid ingestion source is
   * considered stuck rather than merely queued — the cron runs every 2 minutes, so
   * surviving 5 cycles unprocessed means ingestion itself has stalled for it. */
  private static readonly STUCK_SESSION_THRESHOLD_MINUTES = 15;

  @Cron('*/2 * * * *')
  async ingestCapturedSessions(): Promise<void> {
    if (process.env.FEATURE_POSTVISIT_INGESTION_CRON === 'false') return;

    let tenants: any[] = [];
    try {
      tenants = (await this.tenantService?.getAllActiveTenants?.()) ?? [];
    } catch (e: any) {
      // Was previously a silent .catch(() => []) — a tenant-service outage meant
      // zero tenants processed with no operator-visible trace whatsoever. This is
      // the single most severe failure mode of this cron (F6): surface it loudly.
      this.logger.error(`PostVisit ingestion cron: getAllActiveTenants() failed — no tenants will be processed this cycle: ${e?.message}`);
      return;
    }

    if (tenants.length === 0) {
      this.logger.warn('PostVisit ingestion cron: getAllActiveTenants() returned zero tenants — nothing to process this cycle');
      return;
    }

    for (const tenant of tenants) {
      const subdomain = typeof tenant === 'string' ? tenant : tenant?.subdomain;
      if (!subdomain) continue;

      let tenantDb: DataSource | null = null;
      try {
        tenantDb = await this.tenantService?.getTenantDatabase(subdomain) ?? null;
      } catch (e: any) {
        this.logger.error(`PostVisit ingestion cron: DB connection failed for tenant ${subdomain} — skipping this cycle: ${e?.message}`);
        continue;
      }
      if (!tenantDb) {
        this.logger.error(`PostVisit ingestion cron: getTenantDatabase(${subdomain}) returned null — skipping this cycle`);
        continue;
      }

      await this.processTenant(tenantDb, subdomain).catch(e =>
        this.logger.error(`Ingestion cron failed for ${subdomain}: ${e?.message}`),
      );
      await this.detectStuckSessions(tenantDb, subdomain).catch(e =>
        this.logger.warn(`Stuck-session detection failed for ${subdomain}: ${e?.message}`),
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
    `).catch((e: any) => {
      this.logger.error(`PostVisit ingestion cron: failed to query captured sessions for ${subdomain}: ${e?.message}`);
      return [];
    });

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

  /** Flags sessions that have sat in `'captured'` status past the stall threshold —
   * these represent ingestion having stopped working for that item specifically
   * (as opposed to merely being queued behind others). Logged at error level so
   * it surfaces in operator-facing log monitoring/alerting. */
  private async detectStuckSessions(tenantDb: DataSource, subdomain: string): Promise<void> {
    const stuck = await tenantDb.query(
      `SELECT id, source_type, created_at
       FROM post_visit_sessions
       WHERE status = 'captured'
         AND (recording_storage_key IS NOT NULL OR ambient_session_id IS NOT NULL)
         AND created_at < NOW() - INTERVAL '${PostVisitIngestionCronService.STUCK_SESSION_THRESHOLD_MINUTES} minutes'
       ORDER BY created_at ASC
       LIMIT 50`,
    );

    if (stuck.length > 0) {
      this.logger.error(
        `PostVisit ingestion cron: ${stuck.length} session(s) stuck in 'captured' status for over ` +
        `${PostVisitIngestionCronService.STUCK_SESSION_THRESHOLD_MINUTES} minutes for tenant ${subdomain} — ` +
        `ingestion appears stalled. Session IDs: ${stuck.map((s: any) => s.id).join(', ')}`,
      );
    }
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
    ).catch((e: any) => { this.logger.warn(`Query for ambient session ${ambientSessionId} failed: ${e?.message}`); return []; });

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
