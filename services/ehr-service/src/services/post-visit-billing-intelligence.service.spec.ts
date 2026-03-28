import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PostVisitBillingIntelligenceService } from './post-visit-billing-intelligence.service';

// ── Mock @medicore/config ─────────────────────────────────────────────────────

jest.mock('@medicore/config', () => ({ config: {} }));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTenantDb(queryImpl?: jest.Mock) {
  return {
    query: queryImpl ?? jest.fn(),
    getRepository: jest.fn(),
  } as any;
}

function makeSessionRow(overrides: Record<string, any> = {}) {
  return {
    id: 'session-1',
    patient_id: 'patient-1',
    status: 'draft_ready',
    ...overrides,
  };
}

function makeSuggestionRow(overrides: Record<string, any> = {}) {
  return {
    id: 'sug-1',
    session_id: 'session-1',
    code_type: 'cpt',
    code: '99213',
    description: 'Office visit level 3',
    confidence: 0.92,
    justification: 'Moderate complexity documentation',
    status: 'proposed',
    approved_by: null,
    approved_at: null,
    approval_note: null,
    metadata: {},
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-01T10:00:00Z',
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PostVisitBillingIntelligenceService', () => {
  let service: PostVisitBillingIntelligenceService;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.FEATURE_POSTVISIT_BILLING_INTELLIGENCE;
    service = new PostVisitBillingIntelligenceService();
  });

  // ── isBillingIntelligenceEnabled ──────────────────────────────────────────

  describe('isBillingIntelligenceEnabled', () => {
    it('returns false when env var is not set', () => {
      expect(service.isBillingIntelligenceEnabled()).toBe(false);
    });

    it('returns true when env var is "true"', () => {
      process.env.FEATURE_POSTVISIT_BILLING_INTELLIGENCE = 'true';
      expect(service.isBillingIntelligenceEnabled()).toBe(true);
    });

    it('returns false for any other value', () => {
      process.env.FEATURE_POSTVISIT_BILLING_INTELLIGENCE = '1';
      expect(service.isBillingIntelligenceEnabled()).toBe(false);
    });
  });

  // ── getSessionBillingIntelligence ─────────────────────────────────────────

  describe('getSessionBillingIntelligence', () => {
    it('throws NotFoundException when session row is not found', async () => {
      const tenantDb = makeTenantDb(jest.fn().mockResolvedValue([]));

      await expect(
        service.getSessionBillingIntelligence(tenantDb, 'missing-session'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns suggestions and documentation summary when suggestions exist', async () => {
      const query = jest.fn()
        .mockResolvedValueOnce([makeSessionRow()])       // getSessionRow
        .mockResolvedValueOnce([                         // billing suggestions query
          makeSuggestionRow({ status: 'approved', confidence: 0.95 }),
          makeSuggestionRow({ id: 'sug-2', code: 'J06.9', code_type: 'icd10', confidence: 0.75, status: 'proposed' }),
        ]);

      const tenantDb = makeTenantDb(query);

      const result = await service.getSessionBillingIntelligence(tenantDb, 'session-1');

      expect(result.suggestions).toHaveLength(2);
      expect(result.summary.total).toBe(2);
      expect(result.summary.approvedCount).toBe(1);
      expect(result.summary.proposedCount).toBe(1);
      expect(result.summary.highConfidenceCount).toBe(1); // only 0.95 >= 0.8
      expect(result.sessionId).toBe('session-1');
    });

    it('returns empty suggestions when no billing rows exist yet', async () => {
      const query = jest.fn()
        .mockResolvedValueOnce([makeSessionRow()])
        .mockResolvedValueOnce([]);

      const tenantDb = makeTenantDb(query);

      const result = await service.getSessionBillingIntelligence(tenantDb, 'session-1');

      expect(result.suggestions).toHaveLength(0);
      expect(result.summary.total).toBe(0);
    });

    it('includes featureEnabled flag from env', async () => {
      process.env.FEATURE_POSTVISIT_BILLING_INTELLIGENCE = 'true';

      const query = jest.fn()
        .mockResolvedValueOnce([makeSessionRow()])
        .mockResolvedValueOnce([]);

      const tenantDb = makeTenantDb(query);
      const result = await service.getSessionBillingIntelligence(tenantDb, 'session-1');

      expect(result.featureEnabled).toBe(true);
    });
  });

  // ── reviewBillingSuggestion ───────────────────────────────────────────────

  describe('reviewBillingSuggestion', () => {
    it('throws BadRequestException when actorUserId is missing', async () => {
      const tenantDb = makeTenantDb();

      await expect(
        service.reviewBillingSuggestion(
          tenantDb,
          'session-1',
          'sug-1',
          { action: 'approve' } as any,
          { actorUserId: null },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when session is not found', async () => {
      const tenantDb = makeTenantDb(jest.fn().mockResolvedValue([]));

      await expect(
        service.reviewBillingSuggestion(
          tenantDb,
          'missing-session',
          'sug-1',
          { action: 'approve' } as any,
          { actorUserId: 'doctor-1' },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when suggestion is not found for the session', async () => {
      const query = jest.fn()
        .mockResolvedValueOnce([makeSessionRow()])  // session
        .mockResolvedValueOnce([]);                 // suggestion → not found

      const tenantDb = makeTenantDb(query);

      await expect(
        service.reviewBillingSuggestion(
          tenantDb,
          'session-1',
          'missing-sug',
          { action: 'approve' } as any,
          { actorUserId: 'doctor-1' },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('approves a suggestion and inserts audit log', async () => {
      const updatedRow = makeSuggestionRow({ status: 'approved', approved_by: 'doctor-1' });

      const query = jest.fn()
        .mockResolvedValueOnce([makeSessionRow()])          // getSessionRow
        .mockResolvedValueOnce([makeSuggestionRow()])       // SELECT suggestion
        .mockResolvedValueOnce([updatedRow])                // UPDATE status → approved
        .mockResolvedValueOnce([])                          // routeToWorkflow INSERT accounts
        .mockResolvedValueOnce([updatedRow])                // UPDATE with workflow_key
        .mockResolvedValueOnce([]);                         // INSERT audit log

      const tenantDb = makeTenantDb(query);

      const result = await service.reviewBillingSuggestion(
        tenantDb,
        'session-1',
        'sug-1',
        { action: 'approve', note: 'Looks correct' } as any,
        { actorUserId: 'doctor-1' },
      );

      expect(result).toMatchObject({
        action: 'approve',
        sessionId: 'session-1',
        suggestion: expect.objectContaining({ status: 'approved' }),
      });

      // Audit log INSERT should have been called
      const auditCall = (query as jest.Mock).mock.calls.find(
        ([sql]: [string]) => sql?.includes('INSERT INTO post_visit_billing_audit_log'),
      );
      expect(auditCall).toBeDefined();
    });

    it('rejects a suggestion and sets status to rejected', async () => {
      const rejectedRow = makeSuggestionRow({ status: 'rejected' });

      // Reject path: no workflow routing, no second UPDATE
      const query = jest.fn()
        .mockResolvedValueOnce([makeSessionRow()])        // getSessionRow
        .mockResolvedValueOnce([makeSuggestionRow()])     // SELECT suggestion
        .mockResolvedValueOnce([rejectedRow])             // UPDATE status → rejected
        .mockResolvedValue([]);                            // INSERT audit log + any remaining

      const tenantDb = makeTenantDb(query);

      const result = await service.reviewBillingSuggestion(
        tenantDb,
        'session-1',
        'sug-1',
        { action: 'reject' } as any,
        { actorUserId: 'doctor-1' },
      );

      expect(result.action).toBe('reject');
      expect(result.suggestion).toMatchObject({ status: 'rejected' });
    });
  });

  // ── refreshSessionBillingIntelligence ─────────────────────────────────────

  describe('refreshSessionBillingIntelligence', () => {
    const makeRefreshArgs = (overrides: Record<string, any> = {}) => ({
      sessionRow: makeSessionRow(),
      soapNote: { subjective: 'Cough', objective: 'Vitals stable', assessment: 'URI', plan: 'Rest' },
      summaryContent: { diagnosis_codes: [{ code: 'J06.9', description: 'URI' }], procedure_codes: [{ code: '99213' }] },
      recommendationItems: [{ text: 'Follow up in 1 week' }],
      actorUserId: 'doctor-1',
      ...overrides,
    });

    it('returns featureEnabled=false without touching DB when feature is disabled', async () => {
      const tenantDb = makeTenantDb(jest.fn());
      // Feature is disabled by default (env var not set)

      const result = await service.refreshSessionBillingIntelligence(tenantDb, makeRefreshArgs());

      expect(result.featureEnabled).toBe(false);
      expect(tenantDb.query).not.toHaveBeenCalled();
    });

    it('upserts suggestion drafts and returns updated suggestions when enabled', async () => {
      process.env.FEATURE_POSTVISIT_BILLING_INTELLIGENCE = 'true';

      const query = jest.fn()
        .mockResolvedValueOnce([])                                           // SELECT existing suggestions
        .mockResolvedValueOnce([])                                           // DELETE stale suggestions
        .mockResolvedValueOnce([makeSuggestionRow()])                        // UPSERT draft 1
        .mockResolvedValueOnce([])                                           // INSERT audit log draft 1
        .mockResolvedValueOnce([makeSuggestionRow({ id: 'sug-2', code: '99213', code_type: 'cpt' })])  // UPSERT draft 2
        .mockResolvedValueOnce([])                                           // INSERT audit log draft 2
        .mockResolvedValueOnce([makeSuggestionRow()]);                       // final SELECT for return value

      const tenantDb = makeTenantDb(query);

      const result = await service.refreshSessionBillingIntelligence(tenantDb, makeRefreshArgs());

      expect(result.featureEnabled).toBe(true);
      expect(result.suggestions).toHaveLength(1);
    });
  });
});
