import { TelemedicinePostVisitBridgeService, ConsultationRow } from './telemedicine-postvisit-bridge.service';
import { TelemedicineVideoService } from './telemedicine-video.service';

// ── Mock axios (used by downloadBytes) ────────────────────────────────────────
// downloadBytes uses `const { default: axios } = await import('axios')` then axios.get
// so default.get and top-level get must be the same mock function

jest.mock('axios', () => {
  const getFunc = jest.fn();
  return {
    get: getFunc,
    create: jest.fn(() => ({ post: jest.fn(), get: jest.fn(), delete: jest.fn() })),
    default: { get: getFunc },
  };
});

const mockAxiosGet = (require('axios') as any).get as jest.Mock;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTenantDb(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    query: jest.fn(),
    getRepository: jest.fn(),
    ...overrides,
  } as any;
}

function makeConsultation(overrides: Partial<ConsultationRow> = {}): ConsultationRow {
  return {
    id: 'consult-1',
    patient_id: 'patient-1',
    doctor_id: 'doctor-1',
    appointment_id: 'appt-1',
    meeting_room_id: 'room-abc',
    scheduled_start_time: '2026-01-01T09:00:00Z',
    actual_start_time: '2026-01-01T09:01:00Z',
    actual_end_time: '2026-01-01T09:45:00Z',
    language: 'en',
    ...overrides,
  };
}

function makeVideoService(overrides: Partial<TelemedicineVideoService> = {}) {
  return {
    getRecordingWithRetry: jest.fn().mockResolvedValue(null),
    ...overrides,
  } as unknown as TelemedicineVideoService;
}

function makeMinioService() {
  return { uploadBuffer: jest.fn().mockResolvedValue(undefined) } as any;
}

function makeGateway() {
  return { broadcastToConsultation: jest.fn() } as any;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TelemedicinePostVisitBridgeService', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── onConsultationEnded ──────────────────────────────────────────────────

  describe('onConsultationEnded', () => {
    it('creates a post-visit session row', async () => {
      const tenantDb = makeTenantDb();
      // No existing session
      tenantDb.query
        .mockResolvedValueOnce([])         // SELECT existing session → none
        .mockResolvedValueOnce([{ id: 'session-1' }]) // INSERT session → new row
        .mockResolvedValue([]);            // any subsequent queries (recording update etc.)

      const videoService = makeVideoService();
      const service = new TelemedicinePostVisitBridgeService(videoService);

      await service.onConsultationEnded(tenantDb, makeConsultation());

      // First query must be the upsert SELECT
      expect(tenantDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id FROM post_visit_sessions WHERE consultation_id'),
        ['consult-1'],
      );
    });

    it('returns existing session id when a session already exists (upsert behaviour)', async () => {
      const tenantDb = makeTenantDb();
      tenantDb.query
        .mockResolvedValueOnce([{ id: 'existing-session' }]) // SELECT → existing
        .mockResolvedValue([]);

      const videoService = makeVideoService();
      const service = new TelemedicinePostVisitBridgeService(videoService);

      await service.onConsultationEnded(tenantDb, makeConsultation());

      // INSERT should NOT be called after an existing row is found
      const insertCalls = (tenantDb.query as jest.Mock).mock.calls.filter(
        ([sql]: [string]) => sql?.includes('INSERT INTO post_visit_sessions'),
      );
      expect(insertCalls).toHaveLength(0);
    });

    it('does not throw when session creation fails — error is swallowed', async () => {
      const tenantDb = makeTenantDb();
      tenantDb.query.mockRejectedValue(new Error('DB down'));

      const videoService = makeVideoService();
      const service = new TelemedicinePostVisitBridgeService(videoService);

      await expect(
        service.onConsultationEnded(tenantDb, makeConsultation()),
      ).resolves.not.toThrow();
    });
  });

  // ── Recording attachment ─────────────────────────────────────────────────

  describe('recording attachment (via onConsultationEnded)', () => {
    it('broadcasts tele:postvisit_ready with hasRecording=false when no recording available', async () => {
      const tenantDb = makeTenantDb();
      tenantDb.query
        .mockResolvedValueOnce([])              // no existing session
        .mockResolvedValueOnce([{ id: 'session-1' }]) // INSERT session
        .mockResolvedValue([]);

      const videoService = makeVideoService({
        getRecordingWithRetry: jest.fn().mockResolvedValue(null),
      });
      const gateway = makeGateway();
      const service = new TelemedicinePostVisitBridgeService(videoService, undefined, gateway);

      await service.onConsultationEnded(tenantDb, makeConsultation());

      // Allow the async recording task to settle
      await new Promise(r => setImmediate(r));

      expect(gateway.broadcastToConsultation).toHaveBeenCalledWith(
        'consult-1',
        'tele:postvisit_ready',
        expect.objectContaining({ hasRecording: false }),
      );
    });

    it('skips recording fetch entirely when consultation has no meeting_room_id', async () => {
      const tenantDb = makeTenantDb();
      tenantDb.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'session-1' }])
        .mockResolvedValue([]);

      const videoService = makeVideoService();
      const service = new TelemedicinePostVisitBridgeService(videoService);

      await service.onConsultationEnded(
        tenantDb,
        makeConsultation({ meeting_room_id: null }),
      );
      await new Promise(r => setImmediate(r));

      expect(videoService.getRecordingWithRetry).not.toHaveBeenCalled();
    });

    it('broadcasts tele:postvisit_ready with hasRecording=true when recording arrives', async () => {
      const tenantDb = makeTenantDb();
      tenantDb.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'session-2' }])
        .mockResolvedValue([]); // UPDATE post_visit_sessions, UPDATE telemedicine_consultations

      const downloadUrl = 'https://cdn.daily.co/rec-1.mp4';
      const fakeBuffer = Buffer.from('fake-video-data');

      mockAxiosGet.mockResolvedValue({ data: fakeBuffer.buffer });

      const videoService = makeVideoService({
        getRecordingWithRetry: jest.fn().mockResolvedValue(downloadUrl),
      });
      const minio = makeMinioService();
      const gateway = makeGateway();
      const service = new TelemedicinePostVisitBridgeService(videoService, minio, gateway);

      await service.onConsultationEnded(tenantDb, makeConsultation());
      await new Promise(r => setImmediate(r));

      expect(gateway.broadcastToConsultation).toHaveBeenCalledWith(
        'consult-1',
        'tele:postvisit_ready',
        expect.objectContaining({ hasRecording: true, sessionId: 'session-2' }),
      );
    });

    it('uses download URL directly as storage key when MinioService is not available', async () => {
      const tenantDb = makeTenantDb();
      tenantDb.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'session-3' }])
        .mockResolvedValue([]);

      const downloadUrl = 'https://cdn.daily.co/rec-2.mp4';
      mockAxiosGet.mockResolvedValue({ data: Buffer.from('vid').buffer });

      const videoService = makeVideoService({
        getRecordingWithRetry: jest.fn().mockResolvedValue(downloadUrl),
      });
      // No MinIO service passed
      const service = new TelemedicinePostVisitBridgeService(videoService);

      await service.onConsultationEnded(tenantDb, makeConsultation());
      await new Promise(r => setImmediate(r));

      // The UPDATE should use the download URL as recording_storage_key
      const updateCall = (tenantDb.query as jest.Mock).mock.calls.find(
        ([sql]: [string]) => sql?.includes('SET recording_storage_key'),
      );
      expect(updateCall).toBeDefined();
      expect(updateCall[1][0]).toBe(downloadUrl);
    });
  });
});
