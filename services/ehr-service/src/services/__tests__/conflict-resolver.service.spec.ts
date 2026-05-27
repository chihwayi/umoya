import { ConflictResolverService } from '../conflict-resolver.service';

describe('ConflictResolverService', () => {
  let service: ConflictResolverService;

  beforeEach(() => {
    service = new ConflictResolverService();
  });

  describe('resolveConflict — immutable entities', () => {
    it('rejects lab_results mutation', async () => {
      const result = await service.resolveConflict('lab_results', 'id1', {}, {}, null);
      expect(result.resolution).toBe('rejected');
      expect(result.merged).toBeNull();
    });

    it('rejects hiv_resistance_assessments mutation', async () => {
      const result = await service.resolveConflict('hiv_resistance_assessments', 'id2', {}, {}, null);
      expect(result.resolution).toBe('rejected');
      expect(result.merged).toBeNull();
    });
  });

  describe('resolveConflict — server always wins', () => {
    it('returns server_wins for appointments', async () => {
      const server = { id: 'a1', appointment_date: '2026-07-01', status: 'scheduled' };
      const client = { id: 'a1', appointment_date: '2026-07-02', status: 'rescheduled' };
      const result = await service.resolveConflict('appointments', 'a1', client, server, null);
      expect(result.resolution).toBe('server_wins');
      expect(result.merged).toEqual(server);
    });
  });

  describe('fieldLevelMerge', () => {
    it('applies client change when client is newer', () => {
      const server = { id: 'v1', weight: 70, updated_at: '2026-05-01T10:00:00Z' };
      const client = { id: 'v1', weight: 72, updated_at: '2026-05-01T11:00:00Z' };
      const merged = service.fieldLevelMerge(client, server);
      expect(merged['weight']).toBe(72);
    });

    it('keeps server value when server is newer', () => {
      const server = { id: 'v1', weight: 75, updated_at: '2026-05-02T12:00:00Z' };
      const client = { id: 'v1', weight: 72, updated_at: '2026-05-01T11:00:00Z' };
      const merged = service.fieldLevelMerge(client, server);
      expect(merged['weight']).toBe(75);
    });

    it('preserves id and updated_at from server', () => {
      const server = { id: 's1', notes: 'server', updated_at: '2026-05-02T00:00:00Z' };
      const client = { id: 's1', notes: 'client', updated_at: '2026-05-03T00:00:00Z' };
      const merged = service.fieldLevelMerge(client, server);
      expect(merged['id']).toBe('s1');
      expect(merged['updated_at']).toBe('2026-05-02T00:00:00Z');
    });

    it('merges non-overlapping fields from newer client', () => {
      const server = {
        id: 'v1',
        weight: 70,
        blood_pressure: '120/80',
        updated_at: '2026-05-01T08:00:00Z',
      };
      const client = {
        id: 'v1',
        weight: 72,
        blood_pressure: '120/80',
        updated_at: '2026-05-01T09:00:00Z',
      };
      const merged = service.fieldLevelMerge(client, server);
      expect(merged['weight']).toBe(72);
      expect(merged['blood_pressure']).toBe('120/80');
    });

    it('handles missing updated_at as epoch zero', () => {
      const server = { id: 'v1', score: 5 };
      const client = { id: 'v1', score: 8 };
      const merged = service.fieldLevelMerge(client, server);
      // Both timestamps are 0 — client not strictly newer, server value preserved
      expect(merged['score']).toBe(5);
    });
  });

  describe('resolveConflict — clinical entities (merge path)', () => {
    it('returns merge resolution for hiv_clinical_visits', async () => {
      const server = { id: 'v1', weight: 70, updated_at: '2026-05-01T10:00:00Z' };
      const client = { id: 'v1', weight: 72, updated_at: '2026-05-01T11:00:00Z' };
      const result = await service.resolveConflict('hiv_clinical_visits', 'v1', client, server, null);
      expect(result.resolution).toBe('merge');
      expect((result.merged as any)['weight']).toBe(72);
    });

    it('returns merge resolution for gbv_assessments', async () => {
      const server = { id: 'g1', hits_score: 10, updated_at: '2026-04-01T00:00:00Z' };
      const client = { id: 'g1', hits_score: 14, updated_at: '2026-04-02T00:00:00Z' };
      const result = await service.resolveConflict('gbv_assessments', 'g1', client, server, null);
      expect(result.resolution).toBe('merge');
      expect((result.merged as any)['hits_score']).toBe(14);
    });
  });
});
