import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { RoomServiceClient, AccessToken, Room } from 'livekit-server-sdk';

@Injectable()
export class TelemedicineVideoService {
  private readonly logger = new Logger(TelemedicineVideoService.name);
  private readonly apiKey: string;
  private readonly apiSecret: string;
  /** Public wss:// URL clients (browser/mobile) connect their LiveKit SDK to. */
  private readonly publicUrl: string;
  private readonly roomService: RoomServiceClient | null;

  constructor() {
    this.apiKey = process.env.LIVEKIT_API_KEY || '';
    this.apiSecret = process.env.LIVEKIT_API_SECRET || '';
    this.publicUrl = process.env.LIVEKIT_URL || process.env.LIVEKIT_INTERNAL_URL || '';

    // Server-to-server room management calls go over the internal docker
    // network (plain ws/http, no TLS needed) rather than out through Caddy.
    const internalUrl = (process.env.LIVEKIT_INTERNAL_URL || '').replace(/^ws/, 'http');

    this.roomService = this.apiKey && this.apiSecret && internalUrl
      ? new RoomServiceClient(internalUrl, this.apiKey, this.apiSecret)
      : null;

    if (!this.roomService) {
      this.logger.warn('LIVEKIT_API_KEY/LIVEKIT_API_SECRET/LIVEKIT_INTERNAL_URL not fully set — video calls will use placeholder rooms');
    }
  }

  // ── Room management ─────────────────────────────────────────────────────────

  async createMeetingRoom(
    consultationId: string,
    patientId: string,
    doctorId: string,
  ): Promise<{ meetingRoomId: string; meetingUrl: string; meetingPassword?: string }> {
    if (!this.roomService) {
      return this.placeholderRoom(consultationId);
    }

    const roomName = `mc-${consultationId.slice(0, 8)}-${Date.now()}`;

    let room: Room;
    try {
      room = await this.roomService.createRoom({
        name: roomName,
        emptyTimeout: 2 * 60 * 60, // seconds — room auto-closes 2h after going empty
        maxParticipants: 3, // patient + doctor + optional interpreter
      });
    } catch (err: any) {
      const message = err?.message || 'unknown error';
      this.logger.error(
        `LiveKit room creation failed for consultation ${consultationId}: ${message}`,
      );
      throw new ServiceUnavailableException({
        code: 'VIDEO_PROVIDER_UNAVAILABLE',
        message: `Self-hosted video provider (LiveKit) rejected the room-creation request: ${message}. This consultation was not created — no partial/broken state was left behind. Check the livekit container is healthy and LIVEKIT_API_KEY/SECRET are correct.`,
      });
    }

    this.logger.log(`LiveKit room created: ${room.name} for consultation ${consultationId}`);

    return {
      meetingRoomId: room.name,
      // Not a per-room URL like Daily.co — LiveKit clients connect to the one
      // server URL and are routed to the right room via the join token.
      meetingUrl: this.publicUrl,
    };
  }

  async endMeeting(consultationId: string, meetingRoomId: string): Promise<void> {
    if (!this.roomService) return;

    try {
      await this.roomService.deleteRoom(meetingRoomId);
      this.logger.log(`LiveKit room deleted: ${meetingRoomId} (consultation ${consultationId})`);
    } catch (e: any) {
      // Room may already be gone (emptyTimeout already closed it) — not a hard failure
      this.logger.warn(`Could not delete LiveKit room ${meetingRoomId}: ${e?.message}`);
    }
  }

  async getMeetingStatus(
    consultationId: string,
    meetingRoomId: string,
  ): Promise<{ isActive: boolean; participants: number }> {
    if (!this.roomService) return { isActive: false, participants: 0 };

    try {
      const participants = await this.roomService.listParticipants(meetingRoomId);
      return { isActive: participants.length > 0, participants: participants.length };
    } catch {
      return { isActive: false, participants: 0 };
    }
  }

  // ── Participant tokens ───────────────────────────────────────────────────────

  /**
   * Returns a signed LiveKit access token (JWT) for a specific participant.
   * Generated locally — no network call to the LiveKit server needed.
   * Doctor gets roomAdmin=true (can mute/remove others, end the room).
   * Patient gets roomAdmin=false.
   * Token expires in 2 hours.
   */
  async getMeetingToken(
    meetingRoomId: string,
    userId: string,
    role: 'doctor' | 'patient',
    displayName?: string,
  ): Promise<string> {
    if (!this.apiKey || !this.apiSecret) {
      throw new BadRequestException(
        'Video provider not configured — LIVEKIT_API_KEY/LIVEKIT_API_SECRET are required to generate meeting tokens',
      );
    }

    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: userId,
      name: displayName ?? (role === 'doctor' ? 'Doctor' : 'Patient'),
      ttl: '2h',
    });
    at.addGrant({
      room: meetingRoomId,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: role === 'doctor',
    });

    return at.toJwt();
  }

  // ── Recording ────────────────────────────────────────────────────────────────
  // Recording requires the separate LiveKit Egress service, not yet deployed.
  // These honestly report "no recording available" rather than faking success —
  // the post-visit bridge already has a clean no-recording code path for this.

  async enableRecording(
    consultationId: string,
    meetingRoomId: string,
  ): Promise<{ recordingEnabled: boolean; recordingId?: string }> {
    this.logger.debug(`Recording requested for room ${meetingRoomId} — LiveKit Egress is not deployed yet`);
    return { recordingEnabled: false };
  }

  async getRecording(consultationId: string, meetingRoomId: string): Promise<string | null> {
    return null;
  }

  async getRecordingWithRetry(
    consultationId: string,
    meetingRoomId: string,
    maxAttempts = 3,
    delaySecs = 30,
  ): Promise<string | null> {
    this.logger.debug(
      `No recording for ${meetingRoomId} (consultation ${consultationId}) — LiveKit Egress is not deployed yet`,
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
