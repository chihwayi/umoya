import { NotFoundException } from '@nestjs/common';
import { PostVisitDraftService } from './post-visit-draft.service';

jest.mock('@medicore/config', () => ({ config: {} }));

// annotateTextWithEntities is a pure util — let it run for real (no mock needed)

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTenantDb(queryImpl?: jest.Mock) {
  return { query: queryImpl ?? jest.fn() } as any;
}

/** Build a mock query that returns the correct result for each of the
 *  8 parallel queries inside getSessionDraft, plus the session-exists guard. */
function makeGetSessionDraftQuery({
  artifacts = [],
  entities = [],
  segments = [],
  reviewActions = [],
  ruleCitations = [],
  actionExecutions = [],
  documentIntelligence = [],
  billingSuggestions = [],
} = {}) {
  // assertSessionExists: SELECT id FROM post_visit_sessions
  // then Promise.all fires 8 queries simultaneously — all return on the same mock
  const mock = jest.fn()
    .mockResolvedValueOnce([{ id: 'session-1' }])  // assertSessionExists
    .mockResolvedValueOnce(artifacts)
    .mockResolvedValueOnce(entities)
    .mockResolvedValueOnce(segments)
    .mockResolvedValueOnce(reviewActions)
    .mockResolvedValueOnce(ruleCitations)
    .mockResolvedValueOnce(actionExecutions)
    .mockResolvedValueOnce(documentIntelligence)
    .mockResolvedValueOnce(billingSuggestions);
  return mock;
}

function makeArtifactRow(overrides: Record<string, any> = {}) {
  return {
    id: 'art-1',
    artifact_type: 'visit_summary',
    artifact_status: 'draft',
    content: { plain_language_summary: 'Patient presents with URI.' },
    citations: [],
    confidence: 0.88,
    generated_by: 'gpt-4o',
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-01T10:00:00Z',
    ...overrides,
  };
}

function makeSegmentRow(overrides: Record<string, any> = {}) {
  return {
    id: 'seg-1',
    segment_order: 1,
    start_second: 0,
    end_second: 5,
    text: 'Patient reports coughing for 3 days.',
    confidence: 0.95,
    language: 'en',
    speaker_label: 'doctor',
    speaker_role: 'doctor',
    diarization_confidence: 0.9,
    speaker_assignment_status: 'auto',
    needs_review: false,
    reviewed_by: null,
    reviewed_at: null,
    ...overrides,
  };
}

function makeBillingSuggestionRow(overrides: Record<string, any> = {}) {
  return {
    id: 'sug-1',
    session_id: 'session-1',
    code_type: 'cpt',
    code: '99213',
    description: 'Office visit',
    confidence: 0.9,
    justification: 'Moderate complexity',
    status: 'proposed',
    approved_by: null,
    approved_at: null,
    approval_note: null,
    metadata: {},
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PostVisitDraftService', () => {
  let service: PostVisitDraftService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PostVisitDraftService();
  });

  // ── getSessionDraft ────────────────────────────────────────────────────────

  describe('getSessionDraft', () => {
    it('throws NotFoundException when session does not exist', async () => {
      const tenantDb = makeTenantDb(jest.fn().mockResolvedValue([]));

      await expect(service.getSessionDraft(tenantDb, 'missing-session')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns empty collections when session has no data yet', async () => {
      const tenantDb = makeTenantDb(makeGetSessionDraftQuery());

      const result = await service.getSessionDraft(tenantDb, 'session-1');

      expect(result.sessionId).toBe('session-1');
      expect(result.artifacts).toHaveLength(0);
      expect(result.transcript.segmentCount).toBe(0);
      expect(result.billingIntelligence.suggestions).toHaveLength(0);
    });

    it('assembles all 8 data sources into a single draft response', async () => {
      const tenantDb = makeTenantDb(
        makeGetSessionDraftQuery({
          artifacts: [makeArtifactRow()],
          segments: [makeSegmentRow(), makeSegmentRow({ id: 'seg-2', segment_order: 2 })],
          billingSuggestions: [makeBillingSuggestionRow()],
        }),
      );

      const result = await service.getSessionDraft(tenantDb, 'session-1');

      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts[0].type).toBe('visit_summary');
      expect(result.transcript.segmentCount).toBe(2);
      expect(result.billingIntelligence.suggestions).toHaveLength(1);
      expect(result.billingIntelligence.summary.total).toBe(1);
    });

    it('computes billing summary counts correctly', async () => {
      const tenantDb = makeTenantDb(
        makeGetSessionDraftQuery({
          billingSuggestions: [
            makeBillingSuggestionRow({ status: 'approved', confidence: 0.95 }),
            makeBillingSuggestionRow({ id: 'sug-2', status: 'proposed', confidence: 0.75 }),
            makeBillingSuggestionRow({ id: 'sug-3', status: 'rejected', confidence: 0.5 }),
          ],
        }),
      );

      const result = await service.getSessionDraft(tenantDb, 'session-1');
      const billing = result.billingIntelligence;

      expect(billing.summary.total).toBe(3);
      expect(billing.summary.approvedCount).toBe(1);
      expect(billing.summary.proposedCount).toBe(1);
      expect(billing.summary.rejectedCount).toBe(1);
      expect(billing.summary.highConfidenceCount).toBe(1); // only 0.95 >= 0.8
    });

    it('maps transcript segments with speaker info', async () => {
      const tenantDb = makeTenantDb(
        makeGetSessionDraftQuery({
          segments: [makeSegmentRow({ speaker_role: 'patient', speaker_label: 'patient' })],
        }),
      );

      const result = await service.getSessionDraft(tenantDb, 'session-1');

      expect(result.transcript.segments[0].speakerRole).toBe('patient');
      expect(result.transcript.segments[0].text).toBe('Patient reports coughing for 3 days.');
    });
  });

  // ── getAnnotatedDraft ──────────────────────────────────────────────────────

  describe('getAnnotatedDraft', () => {
    it('throws NotFoundException when session does not exist', async () => {
      const tenantDb = makeTenantDb(jest.fn().mockResolvedValue([]));

      await expect(service.getAnnotatedDraft('missing-session', tenantDb)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns annotated artifacts with empty spans when no entities exist', async () => {
      const query = jest.fn()
        .mockResolvedValueOnce([{ id: 'session-1' }])   // assertSessionExists
        .mockResolvedValueOnce([makeArtifactRow()])      // artifact rows
        .mockResolvedValueOnce([]);                       // entity rows → none

      const tenantDb = makeTenantDb(query);

      const result = await service.getAnnotatedDraft('session-1', tenantDb);

      expect(result.artifacts).toHaveLength(1);
      // With no entities, text fields should still be returned with spans array
      const summaryField = result.artifacts[0].content.plain_language_summary;
      expect(summaryField).toBeDefined();
      expect(summaryField.raw).toBe('Patient presents with URI.');
      expect(Array.isArray(summaryField.spans)).toBe(true);
    });

    it('returns non-string content fields unchanged', async () => {
      const query = jest.fn()
        .mockResolvedValueOnce([{ id: 'session-1' }])
        .mockResolvedValueOnce([
          makeArtifactRow({
            content: {
              plain_language_summary: 'Summary text here.',
              short_text: 'hi',            // < 10 chars — not annotated
              items: [{ text: 'Take medication', priority: 'high' }],
              flags: ['urgent'],
            },
          }),
        ])
        .mockResolvedValueOnce([]);

      const tenantDb = makeTenantDb(query);

      const result = await service.getAnnotatedDraft('session-1', tenantDb);
      const content = result.artifacts[0].content;

      // Long string → annotated
      expect(content.plain_language_summary?.raw).toBeDefined();
      // Array of objects with .text → annotated
      expect(Array.isArray(content.items)).toBe(true);
      expect(content.items[0].text).toBe('Take medication');
    });
  });
});
