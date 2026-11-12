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
}
