import { Injectable, Logger, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TelemedicineVideoService } from './telemedicine-video.service';
import { TelemedicineGateway } from '../gateways/telemedicine.gateway';
import { MinioService } from './minio.service';

/**
 * TelemedicinePostVisitBridgeService — Sprint 107
 *
 * Called by TelemedicineService.endConsultation() after the DB row is marked
 * completed. Responsible for:
 *
 *   1. Creating a post_visit_sessions row linked to the consultation
 *   2. Polling Daily.co for the recording (up to 3 attempts × 30 s)
 *   3. Downloading the recording and uploading it to MinIO
 *   4. Updating the session with recording_storage_key + sha256 integrity hash
 *   5. Emitting tele:postvisit_ready so both clients navigate to the summary
 *
 * PostVisitService.ingestTranscription() is NOT called here — the post-visit
 * service detects pending sessions via its own pipeline. This keeps the bridge
 * simple and avoids circular DI.
 */
@Injectable()
export class TelemedicinePostVisitBridgeService {
  private readonly logger = new Logger(TelemedicinePostVisitBridgeService.name);
  private readonly bucket = process.env.MINIO_BUCKET || 'medicore';

  constructor(
    private readonly videoService: TelemedicineVideoService,
    @Optional() private readonly minioService?: MinioService,
    @Optional() private readonly teleGateway?: TelemedicineGateway,
  ) {}

  /**
   * Entry point called by TelemedicineService.endConsultation().
   * Runs asynchronously — never throws back to the caller.
   */
  async onConsultationEnded(tenantDb: DataSource, consultation: ConsultationRow): Promise<void> {
    try {
      const sessionId = await this.createPostVisitSession(tenantDb, consultation);
      this.logger.log(
        `Post-visit session ${sessionId} created for consultation ${consultation.id}`,
      );

      // Recording processing runs async — do not block the HTTP response
      this.fetchAndAttachRecording(tenantDb, consultation, sessionId).catch(e =>
        this.logger.warn(
          `Recording attachment failed for session ${sessionId}: ${e?.message}`,
        ),
      );
    } catch (e: any) {
      this.logger.error(
        `Bridge failed to create post-visit session for consultation ${consultation.id}: ${e?.message}`,
      );
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async createPostVisitSession(
    tenantDb: DataSource,
    c: ConsultationRow,
  ): Promise<string> {
    // Upsert: if a session for this consultation already exists (e.g. retry), return it
    const [existing] = await tenantDb.query(
      `SELECT id FROM post_visit_sessions WHERE consultation_id = $1 LIMIT 1`,
      [c.id],
    ).catch(() => [null]);

    if (existing?.id) return existing.id;

    const [row] = await tenantDb.query(
      `INSERT INTO post_visit_sessions (
         patient_id, doctor_id, appointment_id, consultation_id,
         source_type, status, language,
         started_at, completed_at,
         created_at, updated_at
       ) VALUES ($1, $2, $3, $4, 'telemedicine', 'captured', $5, $6, $7, NOW(), NOW())
       RETURNING id`,
      [
        c.patient_id,
        c.doctor_id,
        c.appointment_id ?? null,
        c.id,
        c.language ?? 'en',
        c.actual_start_time ?? c.scheduled_start_time,
        c.actual_end_time ?? new Date().toISOString(),
      ],
    );

    return row.id;
  }

  private async fetchAndAttachRecording(
    tenantDb: DataSource,
    c: ConsultationRow,
    sessionId: string,
  ): Promise<void> {
    if (!c.meeting_room_id) return;

    const downloadUrl = await this.videoService.getRecordingWithRetry(
      c.id,
      c.meeting_room_id,
      3,  // max attempts
      30, // seconds between attempts
    );

    if (!downloadUrl) {
      this.logger.warn(
        `No recording available for consultation ${c.id} after retries — session ${sessionId} will proceed without recording`,
      );
      this.teleGateway?.broadcastToConsultation(c.id, 'tele:postvisit_ready', {
        sessionId,
        hasRecording: false,
      });
      return;
    }

    // Download recording bytes from Daily.co
    const recordingBytes = await this.downloadBytes(downloadUrl);
    const sha256 = await this.computeSha256(recordingBytes);

    // Upload to MinIO
    let storageKey: string | null = null;
    if (this.minioService) {
      storageKey = `post-visit/recordings/${sessionId}/recording.mp4`;
      await this.minioService.uploadBuffer(this.bucket, storageKey, recordingBytes, 'video/mp4');
      this.logger.log(`Recording uploaded to MinIO: ${storageKey}`);
    } else {
      // MinIO not configured — store the Daily.co URL directly as a fallback
      storageKey = downloadUrl;
      this.logger.warn('MinioService not available — storing recording download URL directly');
    }

    // Persist storage key and integrity hash on the session
    await tenantDb.query(
      `UPDATE post_visit_sessions
       SET recording_storage_key = $1,
           recording_sha256      = $2,
           updated_at            = NOW()
       WHERE id = $3`,
      [storageKey, sha256, sessionId],
    ).catch(e =>
      // Columns may not exist on older tenants — non-fatal
      this.logger.warn(`Could not update recording fields on session ${sessionId}: ${e?.message}`),
    );

    // Also save the download URL back on the consultation row for audit
    await tenantDb.query(
      `UPDATE telemedicine_consultations
       SET recording_download_url = $1, recording_fetched_at = NOW()
       WHERE id = $2`,
      [downloadUrl, c.id],
    ).catch(() => {});

    // Notify both participants the post-visit summary (with recording) is ready
    this.teleGateway?.broadcastToConsultation(c.id, 'tele:postvisit_ready', {
      sessionId,
      hasRecording: true,
    });

    this.logger.log(
      `Recording attached to post-visit session ${sessionId} (sha256: ${sha256.slice(0, 16)}…)`,
    );
  }

  private async downloadBytes(url: string): Promise<Buffer> {
    const { default: axios } = await import('axios');
    const response = await axios.get<Buffer>(url, {
      responseType: 'arraybuffer',
      timeout: 300_000, // 5 min — recordings can be large
    });
    return Buffer.from(response.data);
  }

  private async computeSha256(buf: Buffer): Promise<string> {
    const { createHash } = await import('crypto');
    return createHash('sha256').update(buf).digest('hex');
  }
}

// Shape of the consultation row passed from TelemedicineService.endConsultation
export interface ConsultationRow {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id?: string | null;
  consultation_id?: string | null;
  meeting_room_id?: string | null;
  actual_start_time?: string | null;
  actual_end_time?: string | null;
  scheduled_start_time: string;
  language?: string | null;
  doctor_name?: string | null;
  patient_name?: string | null;
}
