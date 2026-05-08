import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

/**
 * TelemedicineGateway — Sprint 105
 *
 * Namespace: /telemedicine
 *
 * Client → Server events:
 *   tele:join     { consultationId, userId, role: 'doctor'|'patient', displayName? }
 *   tele:leave    { consultationId, userId }
 *   tele:quality  { consultationId, userId, role, quality: 'excellent'|'good'|'fair'|'poor' }
 *   tele:issue    { consultationId, userId, issueType, description }
 *   tele:ping     { consultationId } → server emits tele:pong back to caller
 *
 * Server → Client events (broadcast to room `consult:{consultationId}`):
 *   tele:participant_joined   { userId, role, displayName, timestamp }
 *   tele:participant_left     { userId, role, timestamp }
 *   tele:quality_update       { userId, role, quality, timestamp }
 *   tele:technical_issue      { userId, issueType, description, timestamp }
 *   tele:consultation_ended   { consultationId, endedAt, durationMinutes, postVisitSessionId? }
 *   tele:postvisit_ready      { sessionId }          — emitted by bridge when recording is ready
 *   tele:recording_ready      { sessionId, hasRecording }
 *
 * Usage from service layer:
 *   gateway.broadcastToConsultation(id, 'tele:participant_joined', payload)
 *   gateway.broadcastToUser(userId, 'tele:consultation_ended', payload)
 */
@WebSocketGateway({
  namespace: '/telemedicine',
  cors: {
    origin: (process.env.CORS_ORIGINS || 'http://localhost:3000')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
    credentials: true,
  },
})
export class TelemedicineGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(TelemedicineGateway.name);

  // userId → Set<socketId>
  private readonly userSockets = new Map<string, Set<string>>();
  // socketId → { consultationId, userId, role }
  private readonly socketMeta = new Map<string, { consultationId: string; userId: string; role: string }>();

  afterInit(server: Server) {
    this.logger.log('TelemedicineGateway initialised on /telemedicine');
  }

  handleConnection(client: Socket) {
    this.logger.debug(`Telemedicine WS connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const meta = this.socketMeta.get(client.id);
    if (meta) {
      const { consultationId, userId, role } = meta;
      this.socketMeta.delete(client.id);

      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (!sockets.size) this.userSockets.delete(userId);
      }

      // Broadcast leave event so the other participant knows
      this.server.to(`consult:${consultationId}`).emit('tele:participant_left', {
        userId,
        role,
        timestamp: new Date().toISOString(),
      });
    }
    this.logger.debug(`Telemedicine WS disconnected: ${client.id}`);
  }

  // ── Client → Server ──────────────────────────────────────────────────────────

  @SubscribeMessage('tele:join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { consultationId: string; userId: string; role: 'doctor' | 'patient'; displayName?: string },
  ) {
    const { consultationId, userId, role, displayName } = payload;

    client.join(`consult:${consultationId}`);
    client.join(`user:${userId}`);

    this.socketMeta.set(client.id, { consultationId, userId, role });
    const existing = this.userSockets.get(userId) ?? new Set();
    existing.add(client.id);
    this.userSockets.set(userId, existing);

    // Broadcast to room so the other participant sees the join
    this.server.to(`consult:${consultationId}`).emit('tele:participant_joined', {
      userId,
      role,
      displayName: displayName ?? null,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`tele:join — ${role} ${userId} joined consultation ${consultationId}`);
    return { status: 'joined', consultationId, room: `consult:${consultationId}` };
  }

  @SubscribeMessage('tele:leave')
  handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { consultationId: string; userId: string },
  ) {
    const { consultationId, userId } = payload;
    const meta = this.socketMeta.get(client.id);

    client.leave(`consult:${consultationId}`);
    this.socketMeta.delete(client.id);

    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(client.id);
      if (!sockets.size) this.userSockets.delete(userId);
    }

    this.server.to(`consult:${consultationId}`).emit('tele:participant_left', {
      userId,
      role: meta?.role ?? 'unknown',
      timestamp: new Date().toISOString(),
    });

    return { status: 'left' };
  }

  @SubscribeMessage('tele:quality')
  handleQuality(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      consultationId: string;
      userId: string;
      role: 'doctor' | 'patient';
      quality: 'excellent' | 'good' | 'fair' | 'poor';
    },
  ) {
    this.server.to(`consult:${payload.consultationId}`).emit('tele:quality_update', {
      ...payload,
      timestamp: new Date().toISOString(),
    });
    return { status: 'ok' };
  }

  @SubscribeMessage('tele:issue')
  handleIssue(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      consultationId: string;
      userId: string;
      issueType: string;
      description: string;
    },
  ) {
    this.server.to(`consult:${payload.consultationId}`).emit('tele:technical_issue', {
      ...payload,
      timestamp: new Date().toISOString(),
    });
    return { status: 'ok' };
  }

  @SubscribeMessage('tele:ping')
  handlePing(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { consultationId: string },
  ) {
    client.emit('tele:pong', { consultationId: payload.consultationId, ts: Date.now() });
    return { status: 'ok' };
  }

  // ── Service → Clients (used by TelemedicineService & bridge) ─────────────────

  broadcastToConsultation(consultationId: string, event: string, payload: any) {
    this.server.to(`consult:${consultationId}`).emit(event, payload);
  }

  broadcastToUser(userId: string, event: string, payload: any) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }
}
