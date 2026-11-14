import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ClinicianIdentityService } from './clinician-identity.service';
import { ClinicianNetworkMasterDbService } from './clinician-network-master-db.service';
import { AGE_BANDS, CreateReplyDto, CreateTopicDto } from './dto/create-topic.dto';
import { containsPHI, findBareDateMatch, findPhiMatch, redactText } from './privacy-guard';
import { CdssService } from '../services/cdss.service';

// S286 — PHI-safe case composer + duplicate detection.
//
// Enforcement lives in this service layer (not a controller): every free-text
// field passes through the ported PHI guard, and NOTHING writes to
// clinician_network.topics/replies except via createTopic()/createReply().
// PHI checks here are unconditional — they do not consult
// CDSS_PHI_REDACTION_ENABLED (see privacy-guard.ts note).

export interface SimilarTopic {
  id: string;
  title: string;
  similarity: number;
}

export interface TopicRow {
  id: string;
  panel_id: string;
  title: string;
  body_redacted: string;
  structured_fields: Record<string, unknown>;
  tags: string[];
  status: string;
  resolved_reply_id: string | null;
  created_at: string;
}

export interface ReplyRow {
  id: string;
  topic_id: string;
  parent_reply_id: string | null;
  body_redacted: string;
  created_at: string;
}

export type CreateTopicResult =
  | { created: true; topic: TopicRow }
  | { created: false; similarTopics: SimilarTopic[] };

// S287 — anonymized view shapes. author_clinician_id NEVER appears in these:
// the backend computes isOwnPost server-side against the caller's own
// clinicianId and exposes only the pseudonymous display_handle. See
// docs/CLINICIAN-NETWORK-ARCHITECTURE.md (anonymous-to-panel posting).
export interface PanelView {
  id: string;
  name: string;
  specialty: string;
  description: string | null;
  visibility: string;
  memberCount: number;
  topicCount: number;
  isJoined: boolean;
}

export interface TopicView {
  id: string;
  panel_id: string;
  title: string;
  body_redacted: string;
  structured_fields: Record<string, unknown>;
  tags: string[];
  status: string;
  resolved_reply_id: string | null;
  created_at: string;
  authorHandle: string;
  replyCount: number;
  isOwnPost: boolean;
}

export interface ReplyView {
  id: string;
  topic_id: string;
  parent_reply_id: string | null;
  body_redacted: string;
  created_at: string;
  authorHandle: string;
  isOwnPost: boolean;
}

export type TopicSort = 'recent' | 'discussed' | 'unresolved';

// Stricter than CDSS's own 0.6 guideline-match threshold: a false positive here
// costs only a "please check this first" prompt, a false negative a duplicate thread.
const SIMILARITY_THRESHOLD = 0.8;
const SIMILAR_TOPIC_LIMIT = 3;

const AGE_BAND_VALUES: readonly string[] = AGE_BANDS;

@Injectable()
export class ClinicianNetworkService {
  private readonly logger = new Logger(ClinicianNetworkService.name);

  constructor(
    private readonly clinicianIdentityService: ClinicianIdentityService,
    private readonly masterDbService: ClinicianNetworkMasterDbService,
    private readonly cdssService: CdssService,
  ) {}

  private assertNoPhi(field: string, value: string): void {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException({
        message: `Field '${field}' is required.`,
        field,
      });
    }
    if (containsPHI(value)) {
      const found = findPhiMatch(value);
      throw new BadRequestException({
        message: `Field '${field}' appears to contain patient-identifying information and was not posted. Remove the highlighted text and resubmit.`,
        field,
        phiKind: found?.kind,
        matchedSpan: found?.match,
      });
    }
    // Additive Clinician-Network-only layer (see privacy-guard.ts): exact
    // calendar dates are never legitimate in these fields.
    const bareDate = findBareDateMatch(value);
    if (bareDate) {
      throw new BadRequestException({
        message: `Field '${field}' appears to contain a date that could identify a patient and was not posted. Use the age band field instead of exact dates, then resubmit.`,
        field,
        phiKind: bareDate.kind,
        matchedSpan: bareDate.match,
      });
    }
  }

  async findSimilarTopics(panelId: string, title: string, body: string): Promise<SimilarTopic[]> {
    const embedding = await this.cdssService.getEmbedding(`${title} ${body}`);
    // Pass the vector as its '[v,v,...]' text form with an explicit ::vector cast —
    // avoids driver array-literal formatting issues for the pgvector column.
    const vectorLiteral = `[${embedding.join(',')}]`;
    const rows: Array<{ id: string; title: string; similarity: number }> =
      await this.masterDbService.query(
        `SELECT id, title, 1 - (embedding <=> $1::vector) AS similarity
         FROM clinician_network.topics
         WHERE panel_id = $2 AND status = 'open'
         ORDER BY embedding <=> $1::vector
         LIMIT $3`,
        [vectorLiteral, panelId, SIMILAR_TOPIC_LIMIT],
      );
    // Topics seeded before S286 (or rows with NULL embeddings) have no vector;
    // the distance operator yields NULL similarity for them — exclude those.
    return rows
      .filter((row) => typeof row.similarity === 'number' && row.similarity > SIMILARITY_THRESHOLD)
      .map((row) => ({ id: String(row.id), title: String(row.title), similarity: Number(row.similarity) }));
  }

  async createTopic(
    tenantDb: DataSource,
    userId: string,
    dto: CreateTopicDto,
    forcePost = false,
  ): Promise<CreateTopicResult> {
    if (!dto || typeof dto.panelId !== 'string' || !dto.panelId.trim()) {
      throw new BadRequestException('panelId is required.');
    }
    if (!AGE_BAND_VALUES.includes(dto.ageBand)) {
      throw new BadRequestException(
        `ageBand must be one of: ${AGE_BAND_VALUES.join(', ')}. Exact ages and dates of birth are not accepted.`,
      );
    }
    if (dto.sex !== 'male' && dto.sex !== 'female' && dto.sex !== 'other') {
      throw new BadRequestException(`sex must be one of: male, female, other.`);
    }
    this.assertNoPhi('title', dto.title);
    this.assertNoPhi('presentingComplaint', dto.presentingComplaint);
    this.assertNoPhi('relevantHistory', dto.relevantHistory);
    this.assertNoPhi('question', dto.question);

    const { clinicianId } =
      await this.clinicianIdentityService.resolveOrCreateClinicianIdentity(tenantDb, userId);

    const panelRows: Array<{ id: string }> = await this.masterDbService.query(
      `SELECT id FROM clinician_network.panels WHERE id = $1`,
      [dto.panelId],
    );
    if (!panelRows || panelRows.length === 0) {
      throw new NotFoundException('Panel not found.');
    }

    const structuredFields = {
      ageBand: dto.ageBand,
      sex: dto.sex,
      presentingComplaint: dto.presentingComplaint,
      relevantHistory: dto.relevantHistory,
      question: dto.question,
    };
    // Defense-in-depth second pass: fields already passed individually, but a
    // field-boundary concatenation edge case must not slip through either.
    const bodyRedacted = redactText(
      `Age band: ${dto.ageBand}. Sex: ${dto.sex}. ` +
        `Presenting complaint: ${dto.presentingComplaint} ` +
        `Relevant history: ${dto.relevantHistory} ` +
        `Question: ${dto.question}`,
    );
    const tags = Array.isArray(dto.tags)
      ? dto.tags.map((tag) => String(tag).trim()).filter((tag) => tag.length > 0)
      : [];

    if (!forcePost) {
      const similarTopics = await this.findSimilarTopics(dto.panelId, dto.title, bodyRedacted);
      if (similarTopics.length > 0) {
        return { created: false, similarTopics };
      }
    }

    const embedding = await this.cdssService.getEmbedding(`${dto.title} ${bodyRedacted}`);
    const vectorLiteral = `[${embedding.join(',')}]`;
    const inserted: TopicRow[] = await this.masterDbService.query(
      `INSERT INTO clinician_network.topics
         (panel_id, author_clinician_id, title, body_redacted, structured_fields, tags, embedding, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7::vector, 'open')
       RETURNING id, panel_id, title, body_redacted, structured_fields, tags, status, resolved_reply_id, created_at`,
      [dto.panelId, clinicianId, dto.title, bodyRedacted, JSON.stringify(structuredFields), tags, vectorLiteral],
    );
    const topic = inserted[0];
    this.logger.log(`Clinician Network topic created: ${topic.id} (panel ${dto.panelId})`);
    return { created: true, topic };
  }

  async createReply(tenantDb: DataSource, userId: string, dto: CreateReplyDto): Promise<ReplyRow> {
    if (!dto || typeof dto.topicId !== 'string' || !dto.topicId.trim()) {
      throw new BadRequestException('topicId is required.');
    }
    this.assertNoPhi('body', dto.body);

    const { clinicianId } =
      await this.clinicianIdentityService.resolveOrCreateClinicianIdentity(tenantDb, userId);

    const topicRows: Array<{ id: string }> = await this.masterDbService.query(
      `SELECT id FROM clinician_network.topics WHERE id = $1`,
      [dto.topicId],
    );
    if (!topicRows || topicRows.length === 0) {
      throw new NotFoundException('Topic not found.');
    }
    if (dto.parentReplyId) {
      const parentRows: Array<{ id: string }> = await this.masterDbService.query(
        `SELECT id FROM clinician_network.replies WHERE id = $1 AND topic_id = $2`,
        [dto.parentReplyId, dto.topicId],
      );
      if (!parentRows || parentRows.length === 0) {
        throw new NotFoundException('Parent reply not found in this topic.');
      }
    }

    // Defense-in-depth second pass, same as topics.
    const bodyRedacted = redactText(dto.body);
    const inserted: ReplyRow[] = await this.masterDbService.query(
      `INSERT INTO clinician_network.replies (topic_id, parent_reply_id, author_clinician_id, body_redacted)
       VALUES ($1, $2, $3, $4)
       RETURNING id, topic_id, parent_reply_id, body_redacted, created_at`,
      [dto.topicId, dto.parentReplyId ?? null, clinicianId, bodyRedacted],
    );
    return inserted[0];
  }

  // ---- S287: panels / topics / threaded replies (anonymized views) ----

  async getMe(
    tenantDb: DataSource,
    userId: string,
  ): Promise<{ clinicianId: string; displayHandle: string }> {
    const { clinicianId } =
      await this.clinicianIdentityService.resolveOrCreateClinicianIdentity(tenantDb, userId);
    const rows: Array<{ display_handle: string }> = await this.masterDbService.query(
      `SELECT display_handle FROM clinician_network.clinicians WHERE id = $1`,
      [clinicianId],
    );
    if (!rows || rows.length === 0) {
      throw new NotFoundException('Clinician identity not found.');
    }
    return { clinicianId, displayHandle: rows[0].display_handle };
  }

  async listPanels(viewerClinicianId: string | null): Promise<PanelView[]> {
    const rows: Array<{
      id: string;
      name: string;
      specialty: string;
      description: string | null;
      visibility: string;
      member_count: string;
      topic_count: string;
      is_joined: boolean;
    }> = await this.masterDbService.query(
      `SELECT p.id, p.name, p.specialty, p.description, p.visibility,
              COUNT(DISTINCT CASE WHEN m.left_at IS NULL THEN m.clinician_id END)::int AS member_count,
              COUNT(DISTINCT t.id)::int AS topic_count,
              BOOL_OR(m.clinician_id = $1 AND m.left_at IS NULL) AS is_joined
         FROM clinician_network.panels p
         LEFT JOIN clinician_network.panel_memberships m ON m.panel_id = p.id
         LEFT JOIN clinician_network.topics t ON t.panel_id = p.id
        GROUP BY p.id
        ORDER BY p.name ASC`,
      [viewerClinicianId],
    );
    return rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      specialty: String(row.specialty),
      description: row.description ?? null,
      visibility: String(row.visibility),
      memberCount: Number(row.member_count),
      topicCount: Number(row.topic_count),
      isJoined: row.is_joined === true,
    }));
  }

  async joinPanel(
    tenantDb: DataSource,
    userId: string,
    panelId: string,
    inviteToken?: string,
  ): Promise<{ joined: boolean }> {
    const { clinicianId } =
      await this.clinicianIdentityService.resolveOrCreateClinicianIdentity(tenantDb, userId);
    const panelRows: Array<{ id: string; visibility: string; invite_token: string | null }> =
      await this.masterDbService.query(
        `SELECT id, visibility, invite_token FROM clinician_network.panels WHERE id = $1`,
        [panelId],
      );
    if (!panelRows || panelRows.length === 0) {
      throw new NotFoundException('Panel not found.');
    }
    const panel = panelRows[0];
    if (panel.visibility === 'invite' && panel.invite_token !== (inviteToken ?? null)) {
      throw new BadRequestException(
        'This panel is invite-only. Provide a valid invite token to join.',
      );
    }
    // Re-join friendly: a previous left_at is cleared on conflict.
    await this.masterDbService.query(
      `INSERT INTO clinician_network.panel_memberships (panel_id, clinician_id)
       VALUES ($1, $2)
       ON CONFLICT (panel_id, clinician_id)
       DO UPDATE SET left_at = NULL, joined_at = now()`,
      [panelId, clinicianId],
    );
    return { joined: true };
  }

  async listTopics(
    panelId: string,
    viewerClinicianId: string | null,
    sort: TopicSort = 'recent',
  ): Promise<TopicView[]> {
    const orderBy =
      sort === 'discussed'
        ? `reply_count DESC, t.created_at DESC`
        : `t.created_at DESC`;
    const statusFilter = sort === 'unresolved' ? `AND t.status = 'open'` : '';
    const rows: Array<{
      id: string;
      panel_id: string;
      title: string;
      body_redacted: string;
      structured_fields: Record<string, unknown>;
      tags: string[];
      status: string;
      resolved_reply_id: string | null;
      created_at: string;
      author_handle: string;
      reply_count: string;
      is_own_post: boolean;
    }> = await this.masterDbService.query(
      `SELECT t.id, t.panel_id, t.title, t.body_redacted, t.structured_fields, t.tags,
              t.status, t.resolved_reply_id, t.created_at,
              c.display_handle AS author_handle,
              COUNT(r.id)::int AS reply_count,
              (t.author_clinician_id = $2) AS is_own_post
         FROM clinician_network.topics t
         JOIN clinician_network.clinicians c ON c.id = t.author_clinician_id
         LEFT JOIN clinician_network.replies r ON r.topic_id = t.id
        WHERE t.panel_id = $1 ${statusFilter}
        GROUP BY t.id, c.display_handle
        ORDER BY ${orderBy}`,
      [panelId, viewerClinicianId],
    );
    return rows.map((row) => this.toTopicView(row));
  }

  async getTopic(topicId: string, viewerClinicianId: string | null): Promise<TopicView> {
    const rows: Array<{
      id: string;
      panel_id: string;
      title: string;
      body_redacted: string;
      structured_fields: Record<string, unknown>;
      tags: string[];
      status: string;
      resolved_reply_id: string | null;
      created_at: string;
      author_handle: string;
      reply_count: string;
      is_own_post: boolean;
    }> = await this.masterDbService.query(
      `SELECT t.id, t.panel_id, t.title, t.body_redacted, t.structured_fields, t.tags,
              t.status, t.resolved_reply_id, t.created_at,
              c.display_handle AS author_handle,
              (SELECT COUNT(*)::int FROM clinician_network.replies r WHERE r.topic_id = t.id) AS reply_count,
              (t.author_clinician_id = $2) AS is_own_post
         FROM clinician_network.topics t
         JOIN clinician_network.clinicians c ON c.id = t.author_clinician_id
        WHERE t.id = $1`,
      [topicId, viewerClinicianId],
    );
    if (!rows || rows.length === 0) {
      throw new NotFoundException('Topic not found.');
    }
    return this.toTopicView(rows[0]);
  }

  async listReplies(topicId: string, viewerClinicianId: string | null): Promise<ReplyView[]> {
    const topicRows: Array<{ id: string }> = await this.masterDbService.query(
      `SELECT id FROM clinician_network.topics WHERE id = $1`,
      [topicId],
    );
    if (!topicRows || topicRows.length === 0) {
      throw new NotFoundException('Topic not found.');
    }
    const rows: Array<{
      id: string;
      topic_id: string;
      parent_reply_id: string | null;
      body_redacted: string;
      created_at: string;
      author_handle: string;
      is_own_post: boolean;
    }> = await this.masterDbService.query(
      `SELECT r.id, r.topic_id, r.parent_reply_id, r.body_redacted, r.created_at,
              c.display_handle AS author_handle,
              (r.author_clinician_id = $2) AS is_own_post
         FROM clinician_network.replies r
         JOIN clinician_network.clinicians c ON c.id = r.author_clinician_id
        WHERE r.topic_id = $1
        ORDER BY r.created_at ASC`,
      [topicId, viewerClinicianId],
    );
    // author_clinician_id is used only inside the SQL boolean above — it is
    // never selected, so it cannot leak into the API response.
    return rows.map((row) => ({
      id: String(row.id),
      topic_id: String(row.topic_id),
      parent_reply_id: row.parent_reply_id ? String(row.parent_reply_id) : null,
      body_redacted: String(row.body_redacted),
      created_at: String(row.created_at),
      authorHandle: String(row.author_handle),
      isOwnPost: row.is_own_post === true,
    }));
  }

  async resolveTopic(
    tenantDb: DataSource,
    userId: string,
    topicId: string,
    resolvedReplyId?: string | null,
  ): Promise<TopicView> {
    const { clinicianId } =
      await this.clinicianIdentityService.resolveOrCreateClinicianIdentity(tenantDb, userId);
    const topicRows: Array<{ id: string; author_clinician_id: string }> =
      await this.masterDbService.query(
        `SELECT id, author_clinician_id FROM clinician_network.topics WHERE id = $1`,
        [topicId],
      );
    if (!topicRows || topicRows.length === 0) {
      throw new NotFoundException('Topic not found.');
    }
    if (String(topicRows[0].author_clinician_id) !== clinicianId) {
      throw new BadRequestException('Only the topic author can mark it resolved.');
    }
    if (resolvedReplyId) {
      const replyRows: Array<{ id: string }> = await this.masterDbService.query(
        `SELECT id FROM clinician_network.replies WHERE id = $1 AND topic_id = $2`,
        [resolvedReplyId, topicId],
      );
      if (!replyRows || replyRows.length === 0) {
        throw new NotFoundException('Resolving reply not found in this topic.');
      }
    }
    await this.masterDbService.query(
      `UPDATE clinician_network.topics
          SET status = 'resolved', resolved_reply_id = $2
        WHERE id = $1`,
      [topicId, resolvedReplyId ?? null],
    );
    return this.getTopic(topicId, clinicianId);
  }

  private toTopicView(row: {
    id: string;
    panel_id: string;
    title: string;
    body_redacted: string;
    structured_fields: Record<string, unknown>;
    tags: string[];
    status: string;
    resolved_reply_id: string | null;
    created_at: string;
    author_handle: string;
    reply_count: string | number;
    is_own_post: boolean;
  }): TopicView {
    // author_clinician_id is used only inside the SQL boolean above — it is
    // never selected, so it cannot leak into the API response.
    return {
      id: String(row.id),
      panel_id: String(row.panel_id),
      title: String(row.title),
      body_redacted: String(row.body_redacted),
      structured_fields: (row.structured_fields ?? {}) as Record<string, unknown>,
      tags: Array.isArray(row.tags) ? row.tags.map((tag) => String(tag)) : [],
      status: String(row.status),
      resolved_reply_id: row.resolved_reply_id ? String(row.resolved_reply_id) : null,
      created_at: String(row.created_at),
      authorHandle: String(row.author_handle),
      replyCount: Number(row.reply_count),
      isOwnPost: row.is_own_post === true,
    };
  }
}
