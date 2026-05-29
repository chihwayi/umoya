import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PostVisitCompanionMemoryService } from './post-visit-companion-memory.service';

jest.mock('@umoya/config', () => ({ config: {} }));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTenantDb(queryImpl?: jest.Mock) {
  return { query: queryImpl ?? jest.fn() } as any;
}

function makeSessionRow(overrides: Record<string, any> = {}) {
  return { id: 'session-1', patient_id: 'patient-1', status: 'draft_ready', ...overrides };
}

function makeMemoryRow(overrides: Record<string, any> = {}) {
  return {
    id: 'mem-1',
    session_id: 'session-1',
    patient_id: 'patient-1',
    memory_type: 'preference',
    memory_key: 'preferred_language',
    memory_value: 'Swahili',
    confidence: 0.9,
    source_message_id: null,
    created_by: 'system',
    is_active: true,
    promoted_at: null,
    promoted_by: null,
    retired_at: null,
    retired_by: null,
    curation_note: null,
    metadata: {},
    created_at: '2026-01-01T09:00:00Z',
    updated_at: '2026-01-01T09:00:00Z',
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PostVisitCompanionMemoryService', () => {
  let service: PostVisitCompanionMemoryService;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.FEATURE_POSTVISIT_COMPANION_MEMORY;
    service = new PostVisitCompanionMemoryService();
  });

  // ── isCompanionMemoryEnabled ───────────────────────────────────────────────

  describe('isCompanionMemoryEnabled', () => {
    it('returns true when env var is not set (on by default)', () => {
      expect(service.isCompanionMemoryEnabled()).toBe(true);
    });

    it('returns false when env var is "false"', () => {
      process.env.FEATURE_POSTVISIT_COMPANION_MEMORY = 'false';
      expect(service.isCompanionMemoryEnabled()).toBe(false);
    });

    it('returns true for any other value', () => {
      process.env.FEATURE_POSTVISIT_COMPANION_MEMORY = 'true';
      expect(service.isCompanionMemoryEnabled()).toBe(true);
    });
  });

  // ── listSessionCompanionMemory ─────────────────────────────────────────────

  describe('listSessionCompanionMemory', () => {
    it('throws NotFoundException when session is not found', async () => {
      const tenantDb = makeTenantDb(jest.fn().mockResolvedValue([]));

      await expect(
        service.listSessionCompanionMemory(tenantDb, 'missing-session'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns featureEnabled=false with empty memories when disabled', async () => {
      process.env.FEATURE_POSTVISIT_COMPANION_MEMORY = 'false';
      const tenantDb = makeTenantDb(
        jest.fn().mockResolvedValue([makeSessionRow()]),
      );

      const result = await service.listSessionCompanionMemory(tenantDb, 'session-1');

      expect(result.featureEnabled).toBe(false);
      expect(result.memories).toHaveLength(0);
    });

    it('returns memories with active/retired summary counts', async () => {
      const query = jest.fn()
        .mockResolvedValueOnce([makeSessionRow()])   // getSessionRow
        .mockResolvedValueOnce([                     // memories query
          makeMemoryRow({ is_active: true }),
          makeMemoryRow({ id: 'mem-2', is_active: false }),
        ]);
      const tenantDb = makeTenantDb(query);

      const result = await service.listSessionCompanionMemory(tenantDb, 'session-1');

      expect(result.featureEnabled).toBe(true);
      expect(result.memories).toHaveLength(2);
      expect(result.summary.active).toBe(1);
      expect(result.summary.retired).toBe(1);
    });

    it('caps limit at 120', async () => {
      const query = jest.fn()
        .mockResolvedValueOnce([makeSessionRow()])
        .mockResolvedValueOnce([]);
      const tenantDb = makeTenantDb(query);

      await service.listSessionCompanionMemory(tenantDb, 'session-1', { limit: 9999 });

      const memoryQuery = (query as jest.Mock).mock.calls[1];
      expect(memoryQuery[1][1]).toBe(120); // limit param capped
    });
  });

  // ── curateCompanionMemory ─────────────────────────────────────────────────

  describe('curateCompanionMemory', () => {
    it('throws BadRequestException when feature is disabled', async () => {
      process.env.FEATURE_POSTVISIT_COMPANION_MEMORY = 'false';
      const tenantDb = makeTenantDb();

      await expect(
        service.curateCompanionMemory(tenantDb, 'session-1', 'mem-1', { action: 'promote' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for invalid action', async () => {
      const tenantDb = makeTenantDb(
        jest.fn().mockResolvedValue([makeSessionRow()]),
      );

      await expect(
        service.curateCompanionMemory(tenantDb, 'session-1', 'mem-1', { action: 'delete' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when session is not found', async () => {
      const tenantDb = makeTenantDb(jest.fn().mockResolvedValue([]));

      await expect(
        service.curateCompanionMemory(tenantDb, 'missing', 'mem-1', { action: 'promote' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when memory entry does not exist for patient', async () => {
      const query = jest.fn()
        .mockResolvedValueOnce([makeSessionRow()])  // getSessionRow
        .mockResolvedValueOnce([]);                 // memory not found

      const tenantDb = makeTenantDb(query);

      await expect(
        service.curateCompanionMemory(tenantDb, 'session-1', 'ghost-mem', { action: 'retire' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('promotes a memory entry and returns the updated row', async () => {
      const updatedRow = makeMemoryRow({ is_active: true, promoted_at: new Date().toISOString() });
      const query = jest.fn()
        .mockResolvedValueOnce([makeSessionRow()])     // getSessionRow
        .mockResolvedValueOnce([makeMemoryRow()])      // SELECT existing
        .mockResolvedValueOnce([updatedRow]);           // UPDATE RETURNING

      const tenantDb = makeTenantDb(query);

      const result = await service.curateCompanionMemory(
        tenantDb,
        'session-1',
        'mem-1',
        { action: 'promote' } as any,
        { actorUserId: 'doctor-1' },
      );

      expect(result.action).toBe('promote');
      expect(result.memory.isActive).toBe(true);
    });

    it('retires a memory entry and sets is_active to false', async () => {
      const retiredRow = makeMemoryRow({ is_active: false, retired_at: new Date().toISOString() });
      const query = jest.fn()
        .mockResolvedValueOnce([makeSessionRow()])
        .mockResolvedValueOnce([makeMemoryRow()])
        .mockResolvedValueOnce([retiredRow]);

      const tenantDb = makeTenantDb(query);

      const result = await service.curateCompanionMemory(
        tenantDb,
        'session-1',
        'mem-1',
        { action: 'retire', note: 'No longer relevant' } as any,
        { actorUserId: 'doctor-1' },
      );

      expect(result.action).toBe('retire');
      expect(result.memory.isActive).toBe(false);
    });
  });
});
