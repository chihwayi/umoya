/**
 * PostVisitCompanionMemoryService
 *
 * S108 extraction: companion memory listing and curation (promote/retire/reactivate).
 *
 * Extracted from PostVisitService (god class decomposition).
 * PostVisitService delegates via @Optional() injection.
 */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { config } from '@medicore/config';
import { CuratePostVisitCompanionMemoryDto } from '../dto/post-visit.dto';

type PostVisitCompanionMemoryCurationAction = 'promote' | 'retire' | 'reactivate';

@Injectable()
export class PostVisitCompanionMemoryService {
  // ── Feature flag ───────────────────────────────────────────────────────────

  isCompanionMemoryEnabled(): boolean {
    const configured = (config as any)?.features?.postVisitCompanionMemory;
    if (typeof configured === 'boolean') {
      return configured;
    }
    return String(process.env.FEATURE_POSTVISIT_COMPANION_MEMORY || 'true').toLowerCase() !== 'false';
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async listSessionCompanionMemory(
    tenantDb: DataSource,
    sessionId: string,
    options: { limit?: number; includeInactive?: boolean } = {},
  ) {
    const sessionRow = await this.getSessionRow(tenantDb, sessionId);
    if (!this.isCompanionMemoryEnabled()) {
      return {
        featureEnabled: false,
        sessionId,
        memories: [],
        message: 'Companion memory is disabled by feature flag.',
      };
    }

    const limit = Math.min(Math.max(Number(options.limit || 30), 1), 120);
    const includeInactive = options.includeInactive === true;
    const rows = await tenantDb.query(
      `
        SELECT *
        FROM post_visit_companion_memory
        WHERE patient_id = $1
          AND ($3::boolean = TRUE OR is_active = TRUE)
        ORDER BY is_active DESC, updated_at DESC, created_at DESC
        LIMIT $2
      `,
      [sessionRow.patient_id, limit, includeInactive],
    );

    const memories = rows.map((row: any) => this.mapCompanionMemory(row));
    return {
      featureEnabled: true,
      sessionId,
      patientId: sessionRow.patient_id,
      memories,
      summary: {
        total: memories.length,
        active: memories.filter((item: any) => item.isActive !== false).length,
        retired: memories.filter((item: any) => item.isActive === false).length,
      },
    };
  }

  async curateCompanionMemory(
    tenantDb: DataSource,
    sessionId: string,
    memoryId: string,
    payload: CuratePostVisitCompanionMemoryDto,
    options: { actorUserId?: string | null } = {},
  ) {
    if (!this.isCompanionMemoryEnabled()) {
      throw new BadRequestException('Companion memory is disabled by feature flag');
    }
    const sessionRow = await this.getSessionRow(tenantDb, sessionId);
    const action = String(payload.action || '').toLowerCase() as PostVisitCompanionMemoryCurationAction;
    if (!['promote', 'retire', 'reactivate'].includes(action)) {
      throw new BadRequestException('Invalid companion memory curation action');
    }

    const existingRows = await tenantDb.query(
      `
        SELECT *
        FROM post_visit_companion_memory
        WHERE id = $1
          AND patient_id = $2
        LIMIT 1
      `,
      [memoryId, sessionRow.patient_id],
    );
    const existing = existingRows?.[0];
    if (!existing) {
      throw new NotFoundException('Companion memory entry not found for this session patient');
    }

    const shouldRetire = action === 'retire';
    const metadataPatch =
      action === 'retire'
        ? {
            retired_via: 'doctor_workspace',
            retired_at: new Date().toISOString(),
            retired_by: options.actorUserId || null,
          }
        : {
            promoted_via: 'doctor_workspace',
            promoted_at: new Date().toISOString(),
            promoted_by: options.actorUserId || null,
          };

    const rows = await tenantDb.query(
      `
        UPDATE post_visit_companion_memory
        SET is_active = $3,
            promoted_at = CASE WHEN $4::boolean = TRUE THEN NOW() ELSE promoted_at END,
            promoted_by = CASE WHEN $4::boolean = TRUE THEN $5 ELSE promoted_by END,
            retired_at = CASE WHEN $6::boolean = TRUE THEN NOW() ELSE NULL END,
            retired_by = CASE WHEN $6::boolean = TRUE THEN $5 ELSE NULL END,
            curation_note = $7,
            metadata = COALESCE(metadata, '{}'::jsonb) || $8::jsonb,
            updated_at = NOW()
        WHERE id = $1
          AND patient_id = $2
        RETURNING *
      `,
      [
        memoryId,
        sessionRow.patient_id,
        !shouldRetire,
        !shouldRetire,
        options.actorUserId || null,
        shouldRetire,
        payload.note || null,
        JSON.stringify(metadataPatch),
      ],
    );
    if (!rows?.length) {
      throw new NotFoundException('Companion memory entry not found for this session patient');
    }

    return {
      sessionId,
      patientId: sessionRow.patient_id,
      action,
      memory: this.mapCompanionMemory(rows[0]),
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async getSessionRow(tenantDb: DataSource, sessionId: string) {
    const rows = await tenantDb.query(
      `SELECT * FROM post_visit_sessions WHERE id = $1 LIMIT 1`,
      [sessionId],
    );
    if (!rows?.length) {
      throw new NotFoundException('Post-visit session not found');
    }
    return rows[0];
  }

  mapCompanionMemory(row: any) {
    return {
      id: row.id,
      sessionId: row.session_id,
      patientId: row.patient_id,
      memoryType: row.memory_type,
      memoryKey: row.memory_key,
      memoryValue: row.memory_value,
      confidence:
        row.confidence === null || row.confidence === undefined ? null : Number(row.confidence),
      sourceMessageId: row.source_message_id || null,
      createdBy: row.created_by || null,
      isActive: row.is_active !== false,
      promotedAt: row.promoted_at || null,
      promotedBy: row.promoted_by || null,
      retiredAt: row.retired_at || null,
      retiredBy: row.retired_by || null,
      curationNote: row.curation_note || null,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
