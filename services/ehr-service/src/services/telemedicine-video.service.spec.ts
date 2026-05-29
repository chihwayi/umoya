import axios from 'axios';
import { TelemedicineVideoService } from './telemedicine-video.service';

jest.mock('axios', () => {
  const mockAxios = {
    create: jest.fn(() => ({
      post: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
    })),
  };
  return { ...mockAxios, default: mockAxios, __esModule: true };
});

const mockAxiosInstance = {
  post: jest.fn(),
  get: jest.fn(),
  delete: jest.fn(),
};

(axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);

describe('TelemedicineVideoService', () => {
  let service: TelemedicineVideoService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DAILY_API_KEY = 'test-api-key';
    process.env.DAILY_API_URL = 'https://api.daily.co/v1';
    service = new TelemedicineVideoService();
  });

  afterEach(() => {
    delete process.env.DAILY_API_KEY;
    delete process.env.DAILY_API_URL;
  });

  // ── createMeetingRoom ──────────────────────────────────────────────────────

  describe('createMeetingRoom', () => {
    it('returns room name and url from Daily.co response', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { name: 'room-abc123', url: 'https://umoya.daily.co/room-abc123' },
      });

      const result = await service.createMeetingRoom('consult-1', 'patient-1', 'doctor-1');

      expect(result).toMatchObject({
        meetingRoomId: 'room-abc123',
        meetingUrl: 'https://umoya.daily.co/room-abc123',
      });
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/rooms',
        expect.objectContaining({ properties: expect.objectContaining({ enable_recording: 'cloud' }) }),
      );
    });

    it('falls back to placeholder when DAILY_API_KEY is not set', async () => {
      delete process.env.DAILY_API_KEY;
      service = new TelemedicineVideoService(); // re-create with no API key
      const result = await service.createMeetingRoom('consult-1', 'patient-1', 'doctor-1');
      expect(result.meetingUrl).toMatch(/placeholder|localhost|https:/);
      expect(mockAxiosInstance.post).not.toHaveBeenCalled();
    });

    it('propagates API errors', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce(new Error('Daily API unavailable'));
      await expect(service.createMeetingRoom('consult-fail', 'patient-1', 'doctor-1')).rejects.toThrow('Daily API unavailable');
    });
  });

  // ── getMeetingToken ────────────────────────────────────────────────────────

  describe('getMeetingToken', () => {
    it('requests owner token for doctor role', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { token: 'doctor-jwt-token' },
      });

      const result = await service.getMeetingToken('room-abc', 'user-1', 'doctor');

      expect(result).toBe('doctor-jwt-token');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/meeting-tokens',
        expect.objectContaining({ properties: expect.objectContaining({ is_owner: true }) }),
      );
    });

    it('requests non-owner token for patient role', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { token: 'patient-jwt-token' },
      });

      await service.getMeetingToken('room-abc', 'user-2', 'patient');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/meeting-tokens',
        expect.objectContaining({ properties: expect.objectContaining({ is_owner: false }) }),
      );
    });
  });

  // ── getMeetingStatus ───────────────────────────────────────────────────────

  describe('getMeetingStatus', () => {
    it('returns participant count from presence endpoint', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { participants: { 'p1': {}, 'p2': {} } },
      });

      const result = await service.getMeetingStatus('consult-1', 'room-abc');

      expect(result.participants).toBe(2);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/rooms/room-abc/presence');
    });

    it('returns zero participants when room is empty', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { participants: {} },
      });

      const result = await service.getMeetingStatus('consult-1', 'room-empty');
      expect(result.participants).toBe(0);
    });
  });

  // ── getRecording ───────────────────────────────────────────────────────────

  describe('getRecording', () => {
    it('returns recording download url when available', async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({
          data: { data: [{ id: 'rec-1', status: 'finished', room_name: 'room-abc', duration: 300, start_ts: 0, max_participants: 2, share_token: '' }] },
        })
        .mockResolvedValueOnce({
          data: { download_link: 'https://cdn.daily.co/rec-1.mp4' },
        });

      const result = await service.getRecording('consult-1', 'room-abc');

      expect(result).toBe('https://cdn.daily.co/rec-1.mp4');
    });

    it('returns null when no recordings exist yet', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: { data: [] } });

      const result = await service.getRecording('consult-1', 'room-abc');
      expect(result).toBeNull();
    });
  });

  // ── getRecordingWithRetry ──────────────────────────────────────────────────

  describe('getRecordingWithRetry', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns recording on first attempt when available immediately', async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({
          data: { data: [{ id: 'rec-1', status: 'finished', room_name: 'room-abc', duration: 180, start_ts: 0, max_participants: 2, share_token: '' }] },
        })
        .mockResolvedValueOnce({
          data: { download_link: 'https://cdn.daily.co/rec-1.mp4' },
        });

      const promise = service.getRecordingWithRetry('consult-1', 'room-abc', 3, 0);
      jest.runAllTimers();
      const result = await promise;

      expect(result).toBe('https://cdn.daily.co/rec-1.mp4');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });

    it('returns null after exhausting all retry attempts', async () => {
      jest.useRealTimers();
      mockAxiosInstance.get.mockResolvedValue({ data: { data: [] } });

      const result = await service.getRecordingWithRetry('consult-1', 'room-abc', 2, 0);

      expect(result).toBeNull();
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });
  });

  // ── endMeeting ─────────────────────────────────────────────────────────────

  describe('endMeeting', () => {
    it('ejects all participants then deletes the room', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({ data: {} }); // eject
      mockAxiosInstance.delete.mockResolvedValueOnce({ data: {} }); // delete room

      await service.endMeeting('consult-1', 'room-abc');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/rooms/room-abc/eject');
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/rooms/room-abc');
    });

    it('does not throw if eject fails (room may already be empty)', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce(new Error('no participants'));
      mockAxiosInstance.delete.mockResolvedValueOnce({ data: {} });

      await expect(service.endMeeting('consult-1', 'room-abc')).resolves.not.toThrow();
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/rooms/room-abc');
    });
  });
});
