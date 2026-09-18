import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { RoomServiceClient, EgressClient, AccessToken, Room, EncodedFileType, EgressStatus } from 'livekit-server-sdk';

@Injectable()
export class TelemedicineVideoService {
  private readonly logger = new Logger(TelemedicineVideoService.name);
  private readonly apiKey: string;
  private readonly apiSecret: string;
  /** Public wss:// URL clients (browser/mobile) connect their LiveKit SDK to. */
  private readonly publicUrl: string;
  private readonly roomService: RoomServiceClient | null;
  private readonly egressClient: EgressClient | null;
  /** roomName -> in-progress egressId, so endMeeting() can stop a forgotten recording. */
  private readonly activeEgressByRoom = new Map<string, string>();

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
    this.egressClient = this.apiKey && this.apiSecret && internalUrl
      ? new EgressClient(internalUrl, this.apiKey, this.apiSecret)
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
    const runningEgressId = this.activeEgressByRoom.get(meetingRoomId);
    if (runningEgressId && this.egressClient) {
      try {
        await this.egressClient.stopEgress(runningEgressId);
        this.logger.log(`Stopped recording ${runningEgressId} for room ${meetingRoomId} on call end`);
      } catch (e: any) {
        this.logger.warn(`Could not stop egress ${runningEgressId}: ${e?.message}`);
      } finally {
        this.activeEgressByRoom.delete(meetingRoomId);
      }
    }

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

  // ── Recording (LiveKit Egress → MinIO) ──────────────────────────────────────
  // Room-composite egress records the whole call to an MP4 and uploads it
  // straight to the same MinIO bucket the post-visit bridge reads from —
  // no video bytes pass through this service.

  async startRecording(
    consultationId: string,
    meetingRoomId: string,
  ): Promise<{ recordingEnabled: boolean; recordingId?: string }> {
    if (!this.egressClient) {
      this.logger.warn(`Recording requested for room ${meetingRoomId} but LiveKit Egress is not configured`);
      return { recordingEnabled: false };
    }
    if (this.activeEgressByRoom.has(meetingRoomId)) {
      return { recordingEnabled: true, recordingId: this.activeEgressByRoom.get(meetingRoomId) };
    }

    const bucket = process.env.MINIO_BUCKET || process.env.STORAGE_S3_BUCKET || 'umoya';
    try {
      const info = await this.egressClient.startRoomCompositeEgress(
        meetingRoomId,
        {
          file: {
            fileType: EncodedFileType.MP4,
            filepath: `telemedicine-recordings/${meetingRoomId}-{time}.mp4`,
            output: {
              case: 's3',
              value: {
                accessKey: process.env.STORAGE_S3_ACCESS_KEY || '',
                secret: process.env.STORAGE_S3_SECRET_KEY || '',
                region: process.env.STORAGE_S3_REGION || 'us-east-1',
                endpoint: process.env.STORAGE_S3_ENDPOINT || '',
                bucket,
                forcePathStyle: process.env.STORAGE_S3_FORCE_PATH_STYLE === 'true',
              },
            },
          },
        } as any,
        { layout: 'speaker' },
      );
      this.activeEgressByRoom.set(meetingRoomId, info.egressId);
      this.logger.log(`Recording started: egress ${info.egressId} for room ${meetingRoomId}`);
      return { recordingEnabled: true, recordingId: info.egressId };
    } catch (e: any) {
      this.logger.error(`Failed to start recording for room ${meetingRoomId}: ${e?.message}`);
      throw new ServiceUnavailableException({
        code: 'RECORDING_UNAVAILABLE',
        message: `Could not start recording: ${e?.message}`,
      });
    }
  }

  async stopRecording(consultationId: string, meetingRoomId: string): Promise<{ recordingEnabled: boolean }> {
    const egressId = this.activeEgressByRoom.get(meetingRoomId);
    if (!egressId || !this.egressClient) {
      return { recordingEnabled: false };
    }
    try {
      await this.egressClient.stopEgress(egressId);
      this.logger.log(`Recording stopped: egress ${egressId} for room ${meetingRoomId}`);
    } finally {
      this.activeEgressByRoom.delete(meetingRoomId);
    }
    return { recordingEnabled: false };
  }

  /**
   * Resolves the completed recording's S3 object key once egress has
   * finished uploading. Returns null (not yet ready / no recording) rather
   * than throwing, so the post-visit bridge's existing no-recording path
   * keeps working unchanged.
   */
  async getRecording(consultationId: string, meetingRoomId: string): Promise<string | null> {
    if (!this.egressClient) return null;
    try {
      const results = await this.egressClient.listEgress({ roomName: meetingRoomId });
      const finished = results.find(r => r.fileResults?.length && r.status === EgressStatus.EGRESS_COMPLETE);
      const key = finished?.fileResults?.[0]?.filename;
      return key || null;
    } catch (e: any) {
      this.logger.warn(`Could not look up recording for room ${meetingRoomId}: ${e?.message}`);
      return null;
    }
  }

  async getRecordingWithRetry(
    consultationId: string,
    meetingRoomId: string,
    maxAttempts = 3,
    delaySecs = 30,
  ): Promise<string | null> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const key = await this.getRecording(consultationId, meetingRoomId);
      if (key) return key;
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delaySecs * 1000));
      }
    }
    this.logger.warn(`No recording found for room ${meetingRoomId} after ${maxAttempts} attempts`);
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
