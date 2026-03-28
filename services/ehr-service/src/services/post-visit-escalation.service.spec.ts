import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PostVisitEscalationService } from './post-visit-escalation.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTenantDb(queryImpl?: jest.Mock) {
  return { query: queryImpl ?? jest.fn() } as any;
}

/** Schema guard always passes by default */
function makeQuery(...responses: any[]) {
  const mock = jest.fn();
  // First call is always assertSchema → return a row with tbl set
  mock.mockResolvedValueOnce([{ tbl: 'post_visit_sessions' }]);
  for (const r of responses) {
    mock.mockResolvedValueOnce(r);
  }
  mock.mockResolvedValue([]); // fallback for any extra calls
  return mock;
}

function makeEscalationRow(overrides: Record<string, any> = {}) {
  return {
    id: 'esc-1',
    session_id: 'session-1',
    patient_id: 'patient-1',
    thread_id: null,
    message_id: null,
    status: 'open',
    severity: 'high',
    route_target: 'doctor',
    trigger_type: 'keyword',
    trigger_terms: ['chest pain'],
    signal_text: 'Patient reports chest pain',
    classification_confidence: 0.95,
    classification_temporality: 'current',
    classification_source: 'nlp',
    classification_reason: 'High confidence keyword match',
    classification_stage: 'v1',
    detected_at: '2026-01-01T09:10:00Z',
    sla_due_at: null,
    acknowledged_at: null,
    acknowledged_by: null,
    resolved_at: null,
    resolved_by: null,
    resolution_note: null,
    workflow_key: null,
    metadata: {},
    created_at: '2026-01-01T09:10:00Z',
    updated_at: '2026-01-01T09:10:00Z',
    first_name: 'Jane',
    last_name: 'Doe',
    patient_number: 'P-001',
    ...overrides,
  };
}

function makeAlertRow(overrides: Record<string, any> = {}) {
  return {
    id: 'alert-1',
    session_id: 'session-1',
    patient_id: 'patient-1',
    status: 'open',
    alert_type: 'vitals_deviation',
    severity: 'high',
    route_target: 'doctor',
    assigned_role: 'doctor',
    assigned_user_id: null,
    assigned_team: null,
    policy_version: 'c3.v1',
    routing_rationale: null,
    source: 'streamed_transcript',
    transcript_offset_seconds: 120,
    signal_text: 'O2 sat 88%',
    alert_message: 'Low oxygen saturation detected',
    suggested_action: 'Check pulse oximetry',
    confidence: 0.9,
    trigger_terms: ['O2 sat'],
    metadata: {},
    detected_at: '2026-01-01T09:05:00Z',
    sla_due_at: null,
    acknowledged_at: null,
    acknowledged_by: null,
    acknowledgment_note: null,
    resolved_at: null,
    resolved_by: null,
    resolution_note: null,
    created_at: '2026-01-01T09:05:00Z',
    updated_at: '2026-01-01T09:05:00Z',
    ...overrides,
  };
}

function makeSummaryRow(overrides: Record<string, any> = {}) {
  return { total: 1, open_count: 1, high_priority_open_count: 1, ...overrides };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PostVisitEscalationService', () => {
  let service: PostVisitEscalationService;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.POST_VISIT_INTRAVISIT_ALERTS_ENABLED;
    service = new PostVisitEscalationService();
  });

  // ── listEscalations ────────────────────────────────────────────────────────

  describe('listEscalations', () => {
    it('throws when schema (post_visit_sessions table) is missing', async () => {
      const tenantDb = makeTenantDb(jest.fn().mockResolvedValue([{ tbl: null }]));

      await expect(service.listEscalations(tenantDb)).rejects.toThrow(
        'post_visit_sessions table not found',
      );
    });

    it('returns escalations with patient info and summary counts', async () => {
      const query = makeQuery(
        [makeEscalationRow()],       // SELECT escalations
        [makeSummaryRow()],          // COUNT summary
      );
      const tenantDb = makeTenantDb(query);

      const result = await service.listEscalations(tenantDb);

      expect(result.escalations).toHaveLength(1);
      expect(result.escalations[0].patient.firstName).toBe('Jane');
      expect(result.summary.openCount).toBe(1);
      expect(result.summary.highPriorityOpenCount).toBe(1);
    });

    it('passes status filter to the query params', async () => {
      const query = makeQuery([], [{ total: 0, open_count: 0, high_priority_open_count: 0 }]);
      const tenantDb = makeTenantDb(query);

      await service.listEscalations(tenantDb, { status: 'open' });

      const escalationQueryCall = (query as jest.Mock).mock.calls[1];
      expect(escalationQueryCall[1]).toContain('open');
    });

    it('caps limit at 200', async () => {
      const query = makeQuery([], [{ total: 0, open_count: 0, high_priority_open_count: 0 }]);
      const tenantDb = makeTenantDb(query);

      const result = await service.listEscalations(tenantDb, { limit: 9999 });

      expect(result.paging.limit).toBe(200);
    });
  });

  // ── resolveEscalation ──────────────────────────────────────────────────────

  describe('resolveEscalation', () => {
    it('throws BadRequestException when actorUserId is missing', async () => {
      const tenantDb = makeTenantDb(makeQuery());

      await expect(
        service.resolveEscalation(tenantDb, 'esc-1', {}, { actorUserId: null }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when escalation is not found', async () => {
      const query = jest.fn()
        .mockResolvedValueOnce([{ tbl: 'post_visit_sessions' }]) // schema check
        .mockResolvedValueOnce([]);                              // SELECT → empty → not found

      const tenantDb = makeTenantDb(query);

      await expect(
        service.resolveEscalation(tenantDb, 'ghost', {}, { actorUserId: 'doctor-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('resolves an escalation and returns the updated row', async () => {
      const resolvedRow = makeEscalationRow({ status: 'resolved', resolved_by: 'doctor-1' });
      const query = jest.fn()
        .mockResolvedValueOnce([{ tbl: 'post_visit_sessions' }])  // assertSchema
        .mockResolvedValueOnce([makeEscalationRow()])              // SELECT existing
        .mockResolvedValueOnce([resolvedRow]);                     // UPDATE RETURNING

      const tenantDb = makeTenantDb(query);

      const result = await service.resolveEscalation(
        tenantDb,
        'esc-1',
        { status: 'resolved', resolutionNote: 'Addressed immediately' },
        { actorUserId: 'doctor-1' },
      );

      expect(result.status).toBe('resolved');
      expect(result.resolvedBy).toBe('doctor-1');
    });

    it('dismisses an escalation when status=dismissed', async () => {
      const dismissedRow = makeEscalationRow({ status: 'dismissed' });
      const query = jest.fn()
        .mockResolvedValueOnce([{ tbl: 'post_visit_sessions' }])
        .mockResolvedValueOnce([makeEscalationRow()])
        .mockResolvedValueOnce([dismissedRow]);

      const tenantDb = makeTenantDb(query);

      const result = await service.resolveEscalation(
        tenantDb,
        'esc-1',
        { status: 'dismissed' },
        { actorUserId: 'doctor-1' },
      );

      expect(result.status).toBe('dismissed');
    });

    it('also updates workflow state when escalation has a workflow_key', async () => {
      const rowWithWorkflow = makeEscalationRow({ workflow_key: 'wf-abc' });
      const resolvedRow = makeEscalationRow({ status: 'resolved', workflow_key: 'wf-abc' });
      const query = jest.fn()
        .mockResolvedValueOnce([{ tbl: 'post_visit_sessions' }])
        .mockResolvedValueOnce([rowWithWorkflow])
        .mockResolvedValueOnce([resolvedRow])   // UPDATE escalation
        .mockResolvedValueOnce([]);             // UPDATE workflow_state

      const tenantDb = makeTenantDb(query);

      await service.resolveEscalation(tenantDb, 'esc-1', {}, { actorUserId: 'doctor-1' });

      const workflowCall = (query as jest.Mock).mock.calls.find(
        ([sql]: [string]) => sql?.includes('nurse_cross_module_workflow_state'),
      );
      expect(workflowCall).toBeDefined();
      expect(workflowCall[1][0]).toBe('wf-abc');
    });
  });

  // ── listIntraVisitAlerts ───────────────────────────────────────────────────

  describe('listIntraVisitAlerts', () => {
    it('returns featureEnabled=false when alerts are disabled', async () => {
      process.env.POST_VISIT_INTRAVISIT_ALERTS_ENABLED = 'false';

      const query = jest.fn()
        .mockResolvedValueOnce([{ tbl: 'post_visit_sessions' }])
        .mockResolvedValueOnce([{ id: 'session-1', patient_id: 'p-1', status: 'draft_ready' }]); // getSessionRow

      const tenantDb = makeTenantDb(query);

      const result = await service.listIntraVisitAlerts(tenantDb, 'session-1');

      expect(result.featureEnabled).toBe(false);
      expect(result.items).toHaveLength(0);
    });

    it('returns alerts with summary when enabled', async () => {
      const alertSummary = {
        total: 1, open_count: 1, acknowledged_open_count: 0,
        overdue_unacknowledged_count: 0, critical_open_count: 0,
        high_open_count: 1, moderate_open_count: 0,
      };
      const query = jest.fn()
        .mockResolvedValueOnce([{ tbl: 'post_visit_sessions' }])
        .mockResolvedValueOnce([{ id: 'session-1', patient_id: 'p-1', status: 'draft_ready' }])
        .mockResolvedValueOnce([makeAlertRow()])
        .mockResolvedValueOnce([alertSummary]);

      const tenantDb = makeTenantDb(query);

      const result = await service.listIntraVisitAlerts(tenantDb, 'session-1');

      expect(result.featureEnabled).toBe(true);
      expect(result.items).toHaveLength(1);
      expect(result.summary.highOpenCount).toBe(1);
    });
  });

  // ── acknowledgeIntraVisitAlert ─────────────────────────────────────────────

  describe('acknowledgeIntraVisitAlert', () => {
    it('throws BadRequestException when actorUserId is missing', async () => {
      const tenantDb = makeTenantDb(makeQuery([{ id: 'session-1' }]));

      await expect(
        service.acknowledgeIntraVisitAlert(tenantDb, 'session-1', 'alert-1', {}, { actorUserId: null }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when alert does not exist', async () => {
      const query = jest.fn()
        .mockResolvedValueOnce([{ tbl: 'post_visit_sessions' }])
        .mockResolvedValueOnce([{ id: 'session-1' }])  // getSessionRow
        .mockResolvedValueOnce([]);                     // alert not found

      const tenantDb = makeTenantDb(query);

      await expect(
        service.acknowledgeIntraVisitAlert(tenantDb, 'session-1', 'ghost', {}, { actorUserId: 'doctor-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when alert is not open', async () => {
      const query = jest.fn()
        .mockResolvedValueOnce([{ tbl: 'post_visit_sessions' }])
        .mockResolvedValueOnce([{ id: 'session-1' }])
        .mockResolvedValueOnce([makeAlertRow({ status: 'confirmed' })]);

      const tenantDb = makeTenantDb(query);

      await expect(
        service.acknowledgeIntraVisitAlert(tenantDb, 'session-1', 'alert-1', {}, { actorUserId: 'doctor-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('acknowledges an open alert and returns the updated row', async () => {
      const ackRow = makeAlertRow({ acknowledged_at: new Date().toISOString(), acknowledged_by: 'doctor-1' });
      const query = jest.fn()
        .mockResolvedValueOnce([{ tbl: 'post_visit_sessions' }])
        .mockResolvedValueOnce([{ id: 'session-1' }])
        .mockResolvedValueOnce([makeAlertRow({ status: 'open' })])
        .mockResolvedValueOnce([ackRow]);

      const tenantDb = makeTenantDb(query);

      const result = await service.acknowledgeIntraVisitAlert(
        tenantDb, 'session-1', 'alert-1', { note: 'Noted' }, { actorUserId: 'doctor-1' },
      );

      expect(result.isAcknowledged).toBe(true);
      expect(result.acknowledgedBy).toBe('doctor-1');
    });
  });

  // ── resolveIntraVisitAlert ─────────────────────────────────────────────────

  describe('resolveIntraVisitAlert', () => {
    it('throws BadRequestException when actorUserId is missing', async () => {
      const tenantDb = makeTenantDb(makeQuery());

      await expect(
        service.resolveIntraVisitAlert(tenantDb, 'session-1', 'alert-1', {}, { actorUserId: null }),
      ).rejects.toThrow(BadRequestException);
    });

    it('confirms an alert by default', async () => {
      const confirmedRow = makeAlertRow({ status: 'confirmed', resolved_by: 'doctor-1' });
      const query = jest.fn()
        .mockResolvedValueOnce([{ tbl: 'post_visit_sessions' }])
        .mockResolvedValueOnce([{ id: 'session-1' }])
        .mockResolvedValueOnce([makeAlertRow()])
        .mockResolvedValueOnce([confirmedRow]);

      const tenantDb = makeTenantDb(query);

      const result = await service.resolveIntraVisitAlert(
        tenantDb, 'session-1', 'alert-1', {}, { actorUserId: 'doctor-1' },
      );

      expect(result.status).toBe('confirmed');
    });

    it('dismisses an alert when status=dismissed', async () => {
      const dismissedRow = makeAlertRow({ status: 'dismissed' });
      const query = jest.fn()
        .mockResolvedValueOnce([{ tbl: 'post_visit_sessions' }])
        .mockResolvedValueOnce([{ id: 'session-1' }])
        .mockResolvedValueOnce([makeAlertRow()])
        .mockResolvedValueOnce([dismissedRow]);

      const tenantDb = makeTenantDb(query);

      const result = await service.resolveIntraVisitAlert(
        tenantDb, 'session-1', 'alert-1', { status: 'dismissed' }, { actorUserId: 'doctor-1' },
      );

      expect(result.status).toBe('dismissed');
    });
  });
});
