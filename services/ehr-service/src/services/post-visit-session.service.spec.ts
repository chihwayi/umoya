import { NotFoundException } from '@nestjs/common';
import { PostVisitSessionService } from './post-visit-session.service';

// ── Mock @umoya/config ─────────────────────────────────────────────────────

jest.mock('@umoya/config', () => ({ config: {} }));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTenantDb(queryImpl?: jest.Mock) {
  const query = queryImpl ?? jest.fn();
  return {
    query,
    getRepository: jest.fn(),
  } as any;
}

/** Minimal DB row that mapSession can handle */
function makeSessionRow(overrides: Record<string, any> = {}) {
  return {
    id: 'session-1',
    tenant_id: 'tenant-1',
    patient_id: 'patient-1',
    doctor_id: 'doctor-1',
    appointment_id: null,
    consultation_id: null,
    status: 'captured',
    source_type: 'in_person',
    language: 'en',
    started_at: '2026-01-01T09:00:00Z',
    completed_at: null,
    published_at: null,
    created_at: '2026-01-01T08:59:00Z',
    updated_at: '2026-01-01T09:00:00Z',
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PostVisitSessionService', () => {
  let service: PostVisitSessionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PostVisitSessionService();
  });

  // ── createSession ──────────────────────────────────────────────────────────

  describe('createSession', () => {
    it('throws NotFoundException when patient does not exist', async () => {
      const tenantDb = makeTenantDb(jest.fn().mockResolvedValue([]));

      await expect(
        service.createSession(tenantDb, { patientId: 'unknown', sourceType: 'in_person' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('inserts a new session and returns the mapped row', async () => {
      const query = jest.fn()
        .mockResolvedValueOnce([{ id: 'patient-1' }])    // patient check
        .mockResolvedValueOnce([makeSessionRow()]);        // INSERT RETURNING

      const tenantDb = makeTenantDb(query);

      const result = await service.createSession(
        tenantDb,
        {
          patientId: 'patient-1',
          doctorId: 'doctor-1',
          sourceType: 'in_person',
          language: 'en',
        } as any,
        { tenantId: 'tenant-1', actorUserId: 'doctor-1' },
      );

      expect(result).toMatchObject({ id: 'session-1', status: 'captured' });
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO post_visit_sessions'),
        expect.any(Array),
      );
    });

    it('uses actorUserId as doctorId when dto.doctorId is absent', async () => {
      const query = jest.fn()
        .mockResolvedValueOnce([{ id: 'patient-1' }])
        .mockResolvedValueOnce([makeSessionRow({ doctor_id: 'actor-doc' })]);

      const tenantDb = makeTenantDb(query);

      await service.createSession(
        tenantDb,
        { patientId: 'patient-1', sourceType: 'in_person' } as any,
        { actorUserId: 'actor-doc' },
      );

      // The INSERT params should include 'actor-doc' as doctor_id (index 2 in array)
      const insertCall = (query as jest.Mock).mock.calls.find(
        ([sql]: [string]) => sql?.includes('INSERT INTO post_visit_sessions'),
      );
      expect(insertCall[1][2]).toBe('actor-doc');
    });
  });

  // ── getSession ─────────────────────────────────────────────────────────────

  describe('getSession', () => {
    it('throws NotFoundException when session is not found', async () => {
      const tenantDb = makeTenantDb(jest.fn().mockResolvedValue([]));

      await expect(service.getSession(tenantDb, 'missing-id')).rejects.toThrow(NotFoundException);
    });

    it('returns the mapped session when found', async () => {
      const tenantDb = makeTenantDb(
        jest.fn().mockResolvedValue([makeSessionRow({ id: 'session-42' })]),
      );

      const result = await service.getSession(tenantDb, 'session-42');

      expect(result).toMatchObject({ id: 'session-42', status: 'captured' });
    });
  });

  // ── listSessions ───────────────────────────────────────────────────────────

  describe('listSessions', () => {
    it('returns sessions list with paging metadata', async () => {
      const query = jest.fn()
        .mockResolvedValueOnce([makeSessionRow(), makeSessionRow({ id: 'session-2' })]) // SELECT rows
        .mockResolvedValueOnce([{ total: 2 }]);                                          // COUNT

      const tenantDb = makeTenantDb(query);

      const result = await service.listSessions(tenantDb, { limit: 10, offset: 0 });

      expect(result.sessions).toHaveLength(2);
      expect(result.paging.total).toBe(2);
      expect(result.paging.limit).toBe(10);
    });

    it('caps limit at 100', async () => {
      const query = jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: 0 }]);
      const tenantDb = makeTenantDb(query);

      const result = await service.listSessions(tenantDb, { limit: 9999 });
      expect(result.paging.limit).toBe(100);
    });

    it('filters by patientId when provided', async () => {
      const query = jest.fn()
        .mockResolvedValueOnce([makeSessionRow()])
        .mockResolvedValueOnce([{ total: 1 }]);
      const tenantDb = makeTenantDb(query);

      await service.listSessions(tenantDb, { patientId: 'patient-999' });

      const listCall = (query as jest.Mock).mock.calls[0];
      expect(listCall[1]).toContain('patient-999');
    });

    it('ignores invalid status values', async () => {
      const query = jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: 0 }]);
      const tenantDb = makeTenantDb(query);

      // 'invalid_status' is not in the allowed list — should be silently ignored
      await service.listSessions(tenantDb, { status: 'invalid_status' as any });

      const listCall = (query as jest.Mock).mock.calls[0];
      expect(listCall[0]).not.toContain('invalid_status');
    });
  });

  // ── listPatientSessions ────────────────────────────────────────────────────

  describe('listPatientSessions', () => {
    it('returns only published/closed sessions with a summary snippet', async () => {
      const query = jest.fn().mockResolvedValue([
        {
          id: 'session-1',
          status: 'published',
          source_type: 'in_person',
          language: 'en',
          started_at: '2026-01-01T09:00:00Z',
          completed_at: null,
          published_at: '2026-01-01T10:00:00Z',
          updated_at: '2026-01-01T10:00:00Z',
          visit_summary_content: { plain_language_summary: 'Follow-up in 2 weeks.' },
          recommendation_bundle_content: { items: [{ text: 'Take aspirin' }] },
        },
      ]);
      const tenantDb = makeTenantDb(query);

      const result = await service.listPatientSessions(tenantDb, 'patient-1');

      expect(result.sessions[0].summarySnippet).toBe('Follow-up in 2 weeks.');
      expect(result.sessions[0].checklistCount).toBe(1);
    });
  });

  // ── getPatientStoryLatest ──────────────────────────────────────────────────

  describe('getPatientStoryLatest', () => {
    it('returns featureEnabled=false when feature is disabled', async () => {
      const tenantDb = makeTenantDb(jest.fn().mockResolvedValue([]));
      process.env.FEATURE_POSTVISIT_PATIENT_STORY = 'false';

      const result = await service.getPatientStoryLatest(tenantDb, 'patient-1');

      expect(result).toMatchObject({ featureEnabled: false, story: null });
      delete process.env.FEATURE_POSTVISIT_PATIENT_STORY;
    });

    it('returns story:null when no story row exists yet', async () => {
      process.env.FEATURE_POSTVISIT_PATIENT_STORY = 'true';
      const tenantDb = makeTenantDb(jest.fn().mockResolvedValue([]));

      const result = await service.getPatientStoryLatest(tenantDb, 'patient-1');

      expect(result).toMatchObject({ featureEnabled: true, story: null });
      delete process.env.FEATURE_POSTVISIT_PATIENT_STORY;
    });

    it('returns the latest story row when available', async () => {
      process.env.FEATURE_POSTVISIT_PATIENT_STORY = 'true';
      const tenantDb = makeTenantDb(
        jest.fn().mockResolvedValue([
          {
            id: 'story-1',
            patient_id: 'patient-1',
            version: 3,
            session_id: 'session-1',
            content: { timeline: [] },
            created_at: '2026-01-10T08:00:00Z',
          },
        ]),
      );

      const result = await service.getPatientStoryLatest(tenantDb, 'patient-1');

      expect(result.story?.version).toBe(3);
      expect(result.version).toBe(3);
      delete process.env.FEATURE_POSTVISIT_PATIENT_STORY;
    });
  });

  // ── getPatientStoryVersions ────────────────────────────────────────────────

  describe('getPatientStoryVersions', () => {
    it('returns empty list when feature is disabled', async () => {
      const tenantDb = makeTenantDb(jest.fn().mockResolvedValue([]));
      process.env.FEATURE_POSTVISIT_PATIENT_STORY = 'false';

      const result = await service.getPatientStoryVersions(tenantDb, 'patient-1');

      expect(result).toMatchObject({ featureEnabled: false, versions: [] });
      delete process.env.FEATURE_POSTVISIT_PATIENT_STORY;
    });

    it('returns version list ordered by version DESC', async () => {
      process.env.FEATURE_POSTVISIT_PATIENT_STORY = 'true';
      const tenantDb = makeTenantDb(
        jest.fn().mockResolvedValue([
          { id: 'story-3', version: 3, session_id: 's3', created_at: '' },
          { id: 'story-2', version: 2, session_id: 's2', created_at: '' },
          { id: 'story-1', version: 1, session_id: 's1', created_at: '' },
        ]),
      );

      const result = await service.getPatientStoryVersions(tenantDb, 'patient-1');

      expect(result.versions).toHaveLength(3);
      expect(result.versions[0].version).toBe(3);
      delete process.env.FEATURE_POSTVISIT_PATIENT_STORY;
    });
  });

  // ── getPatientStoryVersion ─────────────────────────────────────────────────

  describe('getPatientStoryVersion', () => {
    it('returns story:null when the requested version does not exist', async () => {
      process.env.FEATURE_POSTVISIT_PATIENT_STORY = 'true';
      const tenantDb = makeTenantDb(jest.fn().mockResolvedValue([]));

      const result = await service.getPatientStoryVersion(tenantDb, 'patient-1', 99);

      expect(result).toMatchObject({ featureEnabled: true, story: null });
      delete process.env.FEATURE_POSTVISIT_PATIENT_STORY;
    });

    it('returns the specific story version', async () => {
      process.env.FEATURE_POSTVISIT_PATIENT_STORY = 'true';
      const tenantDb = makeTenantDb(
        jest.fn().mockResolvedValue([
          {
            id: 'story-2',
            patient_id: 'patient-1',
            version: 2,
            session_id: 'session-1',
            content: {},
            created_at: '',
          },
        ]),
      );

      const result = await service.getPatientStoryVersion(tenantDb, 'patient-1', 2);

      expect(result.story?.version).toBe(2);
      delete process.env.FEATURE_POSTVISIT_PATIENT_STORY;
    });
  });
});
