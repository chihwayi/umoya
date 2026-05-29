/**
 * PostVisitSessionService
 *
 * S108 extraction: session lifecycle, patient session listing,
 * patient story versioning (create/list/diff), and recording URL.
 *
 * Extracted from PostVisitService (god class decomposition).
 * PostVisitService delegates via @Optional() injection.
 */

import {
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { config } from '@umoya/config';
import { CreatePostVisitSessionDto } from '../dto/post-visit.dto';
import { HipaaAuditService, HipaaAuditAction } from './hipaa-audit.service';
import { FileStorageService } from './file-storage.service';
import { PostVisitSession } from '../entities/post-visit-session.entity';

// ── Local types ──────────────────────────────────────────────────────────────

type PostVisitSessionStatus =
  | 'captured'
  | 'processing'
  | 'draft_ready'
  | 'doctor_reviewed'
  | 'published'
  | 'closed';

interface ListPostVisitSessionsOptions {
  status?: PostVisitSessionStatus;
  patientId?: string;
  doctorId?: string;
  sourceType?: 'in_person' | 'telemedicine' | 'hybrid';
  includePublishedOnly?: boolean;
  limit?: number;
  offset?: number;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class PostVisitSessionService {
  constructor(
    @Optional() private readonly hipaaAuditService?: HipaaAuditService,
    @Optional() private readonly fileStorageService?: FileStorageService,
  ) {}

  // ── Public API ─────────────────────────────────────────────────────────────

  async createSession(
    tenantDb: DataSource,
    dto: CreatePostVisitSessionDto,
    requestContext: { tenantId?: string; actorUserId?: string | null } = {},
  ) {
    const patientRows = await tenantDb.query(
      `SELECT id FROM patients WHERE id = $1 LIMIT 1`,
      [dto.patientId],
    );
    if (!patientRows?.length) {
      throw new NotFoundException('Patient not found for post-visit session');
    }

    const resolvedDoctorId = dto.doctorId || requestContext.actorUserId || null;

    const inserted = await tenantDb.query(
      `
        INSERT INTO post_visit_sessions (
          tenant_id,
          patient_id,
          doctor_id,
          appointment_id,
          consultation_id,
          status,
          source_type,
          language,
          started_at
        ) VALUES ($1,$2,$3,$4,$5,'captured',$6,$7,$8)
        RETURNING *
      `,
      [
        requestContext.tenantId || null,
        dto.patientId,
        resolvedDoctorId,
        dto.appointmentId || null,
        dto.consultationId || null,
        dto.sourceType || 'in_person',
        this.normalizeLanguage(dto.language || 'en'),
        dto.startedAt || null,
      ],
    );

    return this.mapSession(inserted[0]);
  }

  async getSession(tenantDb: DataSource, sessionId: string) {
    const row = await this.getSessionRow(tenantDb, sessionId);
    return this.mapSession(row);
  }

  async listSessions(
    tenantDb: DataSource,
    options: ListPostVisitSessionsOptions = {},
  ) {
    const limit = Math.min(Math.max(Number(options.limit || 25), 1), 100);
    const offset = Math.max(Number(options.offset || 0), 0);
    const whereClauses: string[] = [];
    const whereParams: any[] = [];
    const allowedStatuses: PostVisitSessionStatus[] = [
      'captured',
      'processing',
      'draft_ready',
      'doctor_reviewed',
      'published',
      'closed',
    ];
    const allowedSourceTypes = new Set(['in_person', 'telemedicine', 'hybrid']);

    if (options.includePublishedOnly) {
      whereClauses.push(`s.status IN ('published','closed')`);
    }
    if (options.status && allowedStatuses.includes(options.status)) {
      whereParams.push(options.status);
      whereClauses.push(`s.status = $${whereParams.length}`);
    }
    if (options.patientId) {
      whereParams.push(options.patientId);
      whereClauses.push(`s.patient_id = $${whereParams.length}`);
    }
    if (options.doctorId) {
      whereParams.push(options.doctorId);
      whereClauses.push(`s.doctor_id = $${whereParams.length}`);
    }
    if (options.sourceType && allowedSourceTypes.has(options.sourceType)) {
      whereParams.push(options.sourceType);
      whereClauses.push(`s.source_type = $${whereParams.length}`);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const rows = await tenantDb.query(
      `
        SELECT
          s.*,
          p.first_name AS patient_first_name,
          p.last_name AS patient_last_name,
          p.patient_number AS patient_number,
          d.first_name AS doctor_first_name,
          d.last_name AS doctor_last_name,
          vs.artifact_status AS visit_summary_status,
          rb.artifact_status AS recommendation_bundle_status,
          COALESCE(seg.segment_count, 0) AS transcript_segment_count,
          COALESCE(msg.message_count, 0) AS companion_message_count
        FROM post_visit_sessions s
        LEFT JOIN patients p ON p.id = s.patient_id
        LEFT JOIN users d ON d.id = s.doctor_id
        LEFT JOIN post_visit_draft_artifacts vs
          ON vs.session_id = s.id
         AND vs.artifact_type = 'visit_summary'
        LEFT JOIN post_visit_draft_artifacts rb
          ON rb.session_id = s.id
         AND rb.artifact_type = 'recommendation_bundle'
        LEFT JOIN (
          SELECT session_id, COUNT(*)::int AS segment_count
          FROM post_visit_transcript_segments
          GROUP BY session_id
        ) seg ON seg.session_id = s.id
        LEFT JOIN (
          SELECT session_id, COUNT(*)::int AS message_count
          FROM post_visit_companion_messages
          GROUP BY session_id
        ) msg ON msg.session_id = s.id
        ${whereSql}
        ORDER BY COALESCE(s.started_at, s.created_at) DESC
        LIMIT $${whereParams.length + 1}
        OFFSET $${whereParams.length + 2}
      `,
      [...whereParams, limit, offset],
    );

    const totalRows = await tenantDb.query(
      `
        SELECT COUNT(*)::int AS total
        FROM post_visit_sessions s
        ${whereSql}
      `,
      whereParams,
    );

    return {
      sessions: rows.map((row: any) => ({
        ...this.mapSession(row),
        patient: {
          id: row.patient_id,
          firstName: row.patient_first_name || null,
          lastName: row.patient_last_name || null,
          patientNumber: row.patient_number || null,
        },
        doctor: {
          id: row.doctor_id || null,
          firstName: row.doctor_first_name || null,
          lastName: row.doctor_last_name || null,
        },
        artifacts: {
          visitSummaryStatus: row.visit_summary_status || null,
          recommendationBundleStatus: row.recommendation_bundle_status || null,
        },
        telemetry: {
          transcriptSegmentCount: Number(row.transcript_segment_count || 0),
          companionMessageCount: Number(row.companion_message_count || 0),
        },
      })),
      paging: {
        limit,
        offset,
        total: Number(totalRows?.[0]?.total || 0),
      },
    };
  }

  async listPatientSessions(
    tenantDb: DataSource,
    patientId: string,
    options: { limit?: number; offset?: number } = {},
  ) {
    const limit = Math.min(Math.max(Number(options.limit || 20), 1), 100);
    const offset = Math.max(Number(options.offset || 0), 0);

    const rows = await tenantDb.query(
      `
        SELECT
          s.id,
          s.status,
          s.source_type,
          s.language,
          s.started_at,
          s.completed_at,
          s.published_at,
          s.updated_at,
          vs.content AS visit_summary_content,
          rb.content AS recommendation_bundle_content
        FROM post_visit_sessions s
        LEFT JOIN post_visit_draft_artifacts vs
          ON vs.session_id = s.id
         AND vs.artifact_type = 'visit_summary'
         AND vs.artifact_status = 'published'
        LEFT JOIN post_visit_draft_artifacts rb
          ON rb.session_id = s.id
         AND rb.artifact_type = 'recommendation_bundle'
         AND rb.artifact_status = 'published'
        WHERE s.patient_id = $1
          AND s.status IN ('published','closed')
        ORDER BY COALESCE(s.published_at, s.updated_at) DESC
        LIMIT $2
        OFFSET $3
      `,
      [patientId, limit, offset],
    );

    const sessions = rows.map((row: any) => {
      const checklistItems = Array.isArray(row.recommendation_bundle_content?.items)
        ? row.recommendation_bundle_content.items
        : [];
      return {
        id: row.id,
        status: row.status,
        sourceType: row.source_type,
        language: row.language,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        publishedAt: row.published_at,
        updatedAt: row.updated_at,
        summarySnippet: row.visit_summary_content?.plain_language_summary || null,
        checklistCount: checklistItems.length,
      };
    });

    return {
      patientId,
      sessions,
      paging: { limit, offset },
    };
  }

  async getSessionForPatient(
    sessionId: string,
    patientId: string,
    tenantDb: DataSource,
  ): Promise<PostVisitSession | null> {
    const repo = tenantDb.getRepository(PostVisitSession);
    return repo.findOne({ where: { id: sessionId, patientId } });
  }

  async getSessionRecordingUrl(
    sessionId: string,
    tenantDb: DataSource,
  ): Promise<{ url: string; mimeType: string; durationMs: number | null } | { url: null }> {
    const repo = tenantDb.getRepository(PostVisitSession);
    const session = await repo.findOne({ where: { id: sessionId } });
    if (!session?.recordingStorageKey || !this.fileStorageService) {
      return { url: null };
    }
    const url = await this.fileStorageService.getSignedDownloadUrl(
      session.recordingBucket || 'post-visit-recordings',
      session.recordingStorageKey,
      900,
    );
    return {
      url,
      mimeType: session.recordingMimeType || 'audio/webm',
      durationMs: session.recordingDurationMs ?? null,
    };
  }

  // ── Patient story ──────────────────────────────────────────────────────────

  async getPatientStoryLatest(
    tenantDb: DataSource,
    patientId: string,
    options: { actorUserId?: string | null } = {},
  ) {
    if (!this.isPatientStoryEnabled()) {
      return { featureEnabled: false, story: null, version: null };
    }
    const rows = await tenantDb.query(
      `
        SELECT id, patient_id, version, session_id, content, created_at
        FROM post_visit_patient_story
        WHERE patient_id = $1
        ORDER BY version DESC
        LIMIT 1
      `,
      [patientId],
    );
    const row = rows?.[0];
    if (!row) {
      return { featureEnabled: true, story: null, version: null };
    }
    if (this.hipaaAuditService && options.actorUserId && patientId) {
      await this.hipaaAuditService
        .logPhiAccess(
          tenantDb,
          options.actorUserId,
          '',
          undefined,
          HipaaAuditAction.MEDICAL_RECORD_VIEW,
          'post_visit_patient_story',
          row.id,
          patientId,
          undefined,
          undefined,
          undefined,
          { fields: ['timeline', 'content'], recordCount: 1 },
          { action: 'get_latest' },
        )
        .catch(() => {});
    }
    return {
      featureEnabled: true,
      story: {
        id: row.id,
        patientId: row.patient_id,
        version: row.version,
        sessionId: row.session_id,
        content: row.content || {},
        createdAt: row.created_at,
      },
      version: row.version,
    };
  }

  async getPatientStoryVersions(tenantDb: DataSource, patientId: string, limit = 20) {
    if (!this.isPatientStoryEnabled()) {
      return { featureEnabled: false, versions: [] };
    }
    const rows = await tenantDb.query(
      `
        SELECT id, version, session_id, created_at
        FROM post_visit_patient_story
        WHERE patient_id = $1
        ORDER BY version DESC
        LIMIT $2
      `,
      [patientId, Math.min(Math.max(Number(limit), 1), 100)],
    );
    return {
      featureEnabled: true,
      versions: (rows || []).map((r: any) => ({
        id: r.id,
        version: r.version,
        sessionId: r.session_id,
        createdAt: r.created_at,
      })),
    };
  }

  async getPatientStoryVersion(tenantDb: DataSource, patientId: string, version: number) {
    if (!this.isPatientStoryEnabled()) {
      return { featureEnabled: false, story: null };
    }
    const [row] = await tenantDb.query(
      `
        SELECT id, patient_id, version, session_id, content, created_at
        FROM post_visit_patient_story
        WHERE patient_id = $1 AND version = $2
        LIMIT 1
      `,
      [patientId, version],
    );
    if (!row) {
      return { featureEnabled: true, story: null };
    }
    return {
      featureEnabled: true,
      story: {
        id: row.id,
        patientId: row.patient_id,
        version: row.version,
        sessionId: row.session_id,
        content: row.content || {},
        createdAt: row.created_at,
      },
    };
  }

  async getPatientStoryDiff(
    tenantDb: DataSource,
    patientId: string,
    fromVersion: number,
    toVersion: number,
  ) {
    if (!this.isPatientStoryEnabled()) {
      return { featureEnabled: false, from: null, to: null, diff: null };
    }
    const [fromRows, toRows] = await Promise.all([
      tenantDb.query(
        `SELECT version, content, created_at FROM post_visit_patient_story WHERE patient_id = $1 AND version = $2 LIMIT 1`,
        [patientId, fromVersion],
      ),
      tenantDb.query(
        `SELECT version, content, created_at FROM post_visit_patient_story WHERE patient_id = $1 AND version = $2 LIMIT 1`,
        [patientId, toVersion],
      ),
    ]);
    const from = fromRows?.[0];
    const to = toRows?.[0];
    if (!from || !to) {
      return {
        featureEnabled: true,
        from: from ? { version: from.version, content: from.content, createdAt: from.created_at } : null,
        to: to ? { version: to.version, content: to.content, createdAt: to.created_at } : null,
        diff: null,
      };
    }
    const fromTimeline = Array.isArray(from.content?.timeline) ? from.content.timeline : [];
    const toTimeline = Array.isArray(to.content?.timeline) ? to.content.timeline : [];
    const diff = {
      timelineAdded: toTimeline.filter((t: any) => !fromTimeline.some((f: any) => f.sessionId === t.sessionId)),
      timelineRemoved: fromTimeline.filter((f: any) => !toTimeline.some((t: any) => t.sessionId === f.sessionId)),
      fromVersion: from.version,
      toVersion: to.version,
    };
    return {
      featureEnabled: true,
      from: { version: from.version, content: from.content, createdAt: from.created_at },
      to: { version: to.version, content: to.content, createdAt: to.created_at },
      diff,
    };
  }

  async regeneratePatientStoryForPatient(
    tenantDb: DataSource,
    patientId: string,
    triggerSessionId?: string,
  ): Promise<void> {
    const [versionRows] = await tenantDb.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM post_visit_patient_story WHERE patient_id = $1`,
      [patientId],
    );
    const nextVersion = Number(versionRows?.next_version ?? 1);

    const sessionRows = await tenantDb.query(
      `
        SELECT s.id, s.published_at, s.updated_at
        FROM post_visit_sessions s
        WHERE s.patient_id = $1
          AND LOWER(s.status) = 'published'
        ORDER BY COALESCE(s.published_at, s.updated_at) DESC
        LIMIT 100
      `,
      [patientId],
    );

    const timeline: Array<{ sessionId: string; publishedAt: string; summaryExcerpt: string; keyPoints: string[] }> = [];
    for (const row of sessionRows || []) {
      const artifactRows = await tenantDb.query(
        `SELECT content FROM post_visit_draft_artifacts WHERE session_id = $1 AND artifact_type = 'visit_summary' LIMIT 1`,
        [row.id],
      );
      const content = artifactRows?.[0]?.content || {};
      const summaryExcerpt = String(content.plain_language_summary || '').trim().slice(0, 500);
      const keyPoints = Array.isArray(content.key_points) ? content.key_points.slice(0, 5) : [];
      timeline.push({
        sessionId: row.id,
        publishedAt: row.published_at ? new Date(row.published_at).toISOString() : '',
        summaryExcerpt,
        keyPoints,
      });
    }

    await tenantDb.query(
      `
        INSERT INTO post_visit_patient_story (patient_id, version, session_id, content)
        VALUES ($1, $2, $3, $4::jsonb)
      `,
      [
        patientId,
        nextVersion,
        triggerSessionId || null,
        JSON.stringify({ timeline, generatedAt: new Date().toISOString(), triggerSessionId: triggerSessionId || null }),
      ],
    );
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  async getSessionRow(tenantDb: DataSource, sessionId: string) {
    const rows = await tenantDb.query(
      `SELECT * FROM post_visit_sessions WHERE id = $1 LIMIT 1`,
      [sessionId],
    );
    if (!rows?.length) {
      throw new NotFoundException('Post-visit session not found');
    }
    return rows[0];
  }

  mapSession(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id ?? null,
      patientId: row.patient_id,
      doctorId: row.doctor_id ?? null,
      appointmentId: row.appointment_id ?? null,
      consultationId: row.consultation_id ?? null,
      status: row.status as PostVisitSessionStatus,
      sourceType: row.source_type,
      language: row.language || 'en',
      startedAt: row.started_at,
      completedAt: row.completed_at,
      reviewedAt: row.reviewed_at,
      reviewedBy: row.reviewed_by ?? null,
      publishedAt: row.published_at,
      safetyLevel: row.safety_level ?? null,
      riskFlags: row.risk_flags || {},
      meta: row.meta || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private normalizeLanguage(language?: string | null): string {
    const raw = String(language || '').trim().toLowerCase();
    if (!raw) return 'en';
    if (raw === 'english' || raw === 'eng') return 'en';
    if (raw === 'shona') return 'sn';
    if (raw === 'ndebele') return 'nd';
    return raw;
  }

  private isPatientStoryEnabled(): boolean {
    const configured = (config as any)?.features?.postVisitPatientStory;
    if (typeof configured === 'boolean') {
      return configured;
    }
    return String(process.env.FEATURE_POSTVISIT_PATIENT_STORY || 'false').toLowerCase() === 'true';
  }
}
