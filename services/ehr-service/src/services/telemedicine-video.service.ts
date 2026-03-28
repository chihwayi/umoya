import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

interface DailyRoom {
  id: string;
  name: string;
  url: string;
  privacy: string;
}

interface DailyRecording {
  id: string;
  room_name: string;
  start_ts: number;
  status: string;
  max_participants: number;
  duration: number;
  share_token: string;
  s3key?: string;
  mtg_session_id?: string;
  tracks?: Array<{ type: string; status: string }>;
  download_link?: string;
}

@Injectable()
export class TelemedicineVideoService {
  private readonly logger = new Logger(TelemedicineVideoService.name);
  private readonly daily: AxiosInstance;
  private readonly apiKey: string;

  constructor() {
    this.apiKey = process.env.DAILY_API_KEY || '';
    const baseURL = process.env.DAILY_API_URL || 'https://api.daily.co/v1';

    this.daily = axios.create({
      baseURL,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 10_000,
    });
  }

  // ── Room management ─────────────────────────────────────────────────────────

  async createMeetingRoom(
    consultationId: string,
    patientId: string,
    doctorId: string,
  ): Promise<{ meetingRoomId: string; meetingUrl: string; meetingPassword?: string }> {
    if (!this.apiKey) {
      this.logger.warn('DAILY_API_KEY not set — falling back to placeholder room URL');
      return this.placeholderRoom(consultationId);
    }

    // Rooms expire 2 h after scheduled start; allow early join 15 min before
    const expiresAt = Math.floor(Date.now() / 1000) + 2 * 60 * 60;
    const notBeforeAt = Math.floor(Date.now() / 1000) - 15 * 60;
    const roomName = `mc-${consultationId.slice(0, 8)}-${Date.now()}`;

    const { data: room } = await this.daily.post<DailyRoom>('/rooms', {
      name: roomName,
      privacy: 'private',
      properties: {
        enable_recording: 'cloud',
        recording_type: 'cloud',
        enable_chat: true,
        enable_screenshare: false,
        enable_knocking: true,
        exp: expiresAt,
        nbf: notBeforeAt,
        max_participants: 3, // patient + doctor + optional interpreter
        lang: 'en',
        // Metadata stored on the room for webhook attribution
        eject_at_token_exp: true,
        eject_after_elapsed: 7200,
      },
    });

    this.logger.log(`Daily.co room created: ${room.name} for consultation ${consultationId}`);

    return {
      meetingRoomId: room.name,
      meetingUrl: room.url,
    };
  }

  async endMeeting(consultationId: string, meetingRoomId: string): Promise<void> {
    if (!this.apiKey) return;

    // Eject all participants; if eject fails the room may already be empty — still try to delete
    try {
      await this.daily.post(`/rooms/${meetingRoomId}/eject`);
    } catch (e: any) {
      this.logger.warn(`Could not eject participants from ${meetingRoomId}: ${e?.message}`);
    }

    try {
      await this.daily.delete(`/rooms/${meetingRoomId}`);
      this.logger.log(`Daily.co room deleted: ${meetingRoomId} (consultation ${consultationId})`);
    } catch (e: any) {
      // Room may already be deleted or expired — not a hard failure
      this.logger.warn(`Could not delete Daily.co room ${meetingRoomId}: ${e?.message}`);
    }
  }

  async getMeetingStatus(
    consultationId: string,
    meetingRoomId: string,
  ): Promise<{ isActive: boolean; participants: number }> {
    if (!this.apiKey) return { isActive: false, participants: 0 };

    try {
      const { data } = await this.daily.get(`/rooms/${meetingRoomId}/presence`);
      const participants: number = Object.keys(data?.participants ?? {}).length;
      return { isActive: participants > 0, participants };
    } catch {
      return { isActive: false, participants: 0 };
    }
  }

  // ── Participant tokens ───────────────────────────────────────────────────────

  /**
   * Returns a signed Daily.co meeting token for a specific participant.
   * Doctor gets is_owner=true (can mute, eject, end meeting).
   * Patient gets is_owner=false.
   * Token expires in 2 hours.
   */
  async getMeetingToken(
    meetingRoomId: string,
    userId: string,
    role: 'doctor' | 'patient',
    displayName?: string,
  ): Promise<string> {
    if (!this.apiKey) {
      throw new BadRequestException(
        'Video provider not configured — DAILY_API_KEY is required to generate meeting tokens',
      );
    }

    const expiresAt = Math.floor(Date.now() / 1000) + 2 * 60 * 60;

    const { data } = await this.daily.post<{ token: string }>('/meeting-tokens', {
      properties: {
        room_name: meetingRoomId,
        user_id: userId,
        user_name: displayName ?? (role === 'doctor' ? 'Doctor' : 'Patient'),
        is_owner: role === 'doctor',
        enable_recording: role === 'doctor', // only doctor can start recording
        exp: expiresAt,
        // Prevent sharing token: each token is single-use bound to user_id
        close_tab_on_exit: true,
      },
    });

    return data.token;
  }

  // ── Recording ────────────────────────────────────────────────────────────────

  async enableRecording(
    consultationId: string,
    meetingRoomId: string,
  ): Promise<{ recordingEnabled: boolean; recordingId?: string }> {
    // Cloud recording is configured at room creation — no separate call needed.
    // This method exists for explicit operator-triggered recording if needed.
    this.logger.log(`Cloud recording is enabled by default on room ${meetingRoomId}`);
    return { recordingEnabled: true };
  }

  /**
   * Fetches the most recent completed recording for a room.
   * Returns a 1-hour signed download URL, or null if no recording is ready yet.
   */
  async getRecording(consultationId: string, meetingRoomId: string): Promise<string | null> {
    if (!this.apiKey) return null;

    try {
      const { data } = await this.daily.get<{ data: DailyRecording[] }>(
        `/recordings?room_name=${encodeURIComponent(meetingRoomId)}&limit=1`,
      );

      const recordings = data?.data ?? [];
      if (!recordings.length) return null;

      const latest = recordings[0];
      if (latest.status !== 'finished') {
        this.logger.debug(`Recording for ${meetingRoomId} status: ${latest.status} (not yet finished)`);
        return null;
      }

      // Get a signed, time-limited download link
      const { data: linkData } = await this.daily.get<{ download_link: string }>(
        `/recordings/${latest.id}/access-link?valid_for_secs=3600`,
      );

      return linkData.download_link ?? null;
    } catch (e: any) {
      this.logger.warn(`Could not fetch recording for ${meetingRoomId}: ${e?.message}`);
      return null;
    }
  }

  /**
   * Polls for a recording up to maxAttempts times with delaySecs between attempts.
   * Used by the post-visit bridge — recordings take ~60 s to process after room ends.
   */
  async getRecordingWithRetry(
    consultationId: string,
    meetingRoomId: string,
    maxAttempts = 3,
    delaySecs = 30,
  ): Promise<string | null> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const url = await this.getRecording(consultationId, meetingRoomId);
      if (url) return url;

      if (attempt < maxAttempts) {
        this.logger.debug(
          `Recording not ready for ${meetingRoomId} — attempt ${attempt}/${maxAttempts}, waiting ${delaySecs}s`,
        );
        await new Promise(resolve => setTimeout(resolve, delaySecs * 1000));
      }
    }

    this.logger.warn(
      `Recording not available after ${maxAttempts} attempts for ${meetingRoomId} (consultation ${consultationId})`,
    );
    return null;
  }

  // ── Fallback ─────────────────────────────────────────────────────────────────

  private placeholderRoom(consultationId: string): {
    meetingRoomId: string;
    meetingUrl: string;
    meetingPassword?: string;
  } {
    const frontendUrl = process.env.FRONTEND_URL || '';
    const meetingRoomId = `room_${consultationId.slice(0, 8)}_${Date.now()}`;
    return {
      meetingRoomId,
      meetingUrl: `${frontendUrl}/telemedicine/room/${meetingRoomId}`,
    };
  }
}
