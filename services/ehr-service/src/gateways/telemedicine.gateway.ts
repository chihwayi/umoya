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
import { JwtService } from '@nestjs/jwt';
import { authenticateSocket, getWsUser } from './ws-auth.util';

/**
 * TelemedicineGateway — Sprint 105
 *
 * Namespace: /telemedicine
 *
 * Client → Server events (userId/role come from the verified JWT, never the
 * payload — this previously let any connected client impersonate any
 * doctor/patient by naming their id in tele:join):
 *   tele:join     { consultationId, displayName? }
 *   tele:leave    { consultationId }
 *   tele:quality  { consultationId, quality: 'excellent'|'good'|'fair'|'poor' }
 *   tele:issue    { consultationId, issueType, description }
 *   tele:ping     { consultationId } → server emits tele:pong back to caller
 *
 * Server → Client events (broadcast to room `consult:{tenantId}:{consultationId}`):
 *   tele:participant_joined   { userId, role, displayName, timestamp }
 *   tele:participant_left     { userId, role, timestamp }
 *   tele:quality_update       { userId, role, quality, timestamp }
 *   tele:technical_issue      { userId, issueType, description, timestamp }
 *   tele:consultation_ended   { consultationId, endedAt, durationMinutes, postVisitSessionId? }
 *   tele:postvisit_ready      { sessionId }          — emitted by bridge when recording is ready
 *   tele:recording_ready      { sessionId, hasRecording }
 *
 * Usage from service layer:
 *   gateway.broadcastToConsultation(tenantId, id, 'tele:participant_joined', payload)
 *   gateway.broadcastToUser(tenantId, userId, 'tele:consultation_ended', payload)
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

  constructor(private readonly jwtService: JwtService) {}

  // userId → Set<socketId>
  private readonly userSockets = new Map<string, Set<string>>();
  // socketId → { consultationId, userId, role, tenantId }
  private readonly socketMeta = new Map<string, { consultationId: string; userId: string; role: string; tenantId: string }>();

  afterInit(server: Server) {
    this.logger.log('TelemedicineGateway initialised on /telemedicine');
  }

  handleConnection(client: Socket) {
    const user = authenticateSocket(client, this.jwtService);
    if (!user) return;
    this.logger.debug(`Telemedicine WS connected: user=${user.id} tenant=${user.tenantId} socket=${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const meta = this.socketMeta.get(client.id);
    if (meta) {
      const { consultationId, userId, role, tenantId } = meta;
      this.socketMeta.delete(client.id);

      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (!sockets.size) this.userSockets.delete(userId);
      }

      // Broadcast leave event so the other participant knows
      this.server.to(`consult:${tenantId}:${consultationId}`).emit('tele:participant_left', {
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
    @MessageBody() payload: { consultationId: string; displayName?: string },
  ) {
    const user = getWsUser(client);
    if (!user) return { status: 'unauthorized' };
    const { consultationId, displayName } = payload;
    const { id: userId, role, tenantId } = user;

    client.join(`consult:${tenantId}:${consultationId}`);
    client.join(`tenant:${tenantId}:user:${userId}`);

    this.socketMeta.set(client.id, { consultationId, userId, role, tenantId });
    const existing = this.userSockets.get(userId) ?? new Set();
    existing.add(client.id);
    this.userSockets.set(userId, existing);

    // Broadcast to room so the other participant sees the join
    this.server.to(`consult:${tenantId}:${consultationId}`).emit('tele:participant_joined', {
      userId,
      role,
      displayName: displayName ?? null,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`tele:join — ${role} ${userId} joined consultation ${consultationId}`);
    return { status: 'joined', consultationId, room: `consult:${tenantId}:${consultationId}` };
  }

  @SubscribeMessage('tele:leave')
  handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { consultationId: string },
  ) {
    const user = getWsUser(client);
    if (!user) return { status: 'unauthorized' };
    const { consultationId } = payload;
    const { id: userId, tenantId } = user;
    const meta = this.socketMeta.get(client.id);

    client.leave(`consult:${tenantId}:${consultationId}`);
    this.socketMeta.delete(client.id);

    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(client.id);
      if (!sockets.size) this.userSockets.delete(userId);
    }

    this.server.to(`consult:${tenantId}:${consultationId}`).emit('tele:participant_left', {
      userId,
      role: meta?.role ?? user.role,
      timestamp: new Date().toISOString(),
    });

    return { status: 'left' };
  }

  @SubscribeMessage('tele:quality')
  handleQuality(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { consultationId: string; quality: 'excellent' | 'good' | 'fair' | 'poor' },
  ) {
    const user = getWsUser(client);
    if (!user) return { status: 'unauthorized' };
    this.server.to(`consult:${user.tenantId}:${payload.consultationId}`).emit('tele:quality_update', {
      consultationId: payload.consultationId,
      userId: user.id,
      role: user.role,
      quality: payload.quality,
      timestamp: new Date().toISOString(),
    });
    return { status: 'ok' };
  }

  @SubscribeMessage('tele:issue')
  handleIssue(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { consultationId: string; issueType: string; description: string },
  ) {
    const user = getWsUser(client);
    if (!user) return { status: 'unauthorized' };
    this.server.to(`consult:${user.tenantId}:${payload.consultationId}`).emit('tele:technical_issue', {
      consultationId: payload.consultationId,
      userId: user.id,
      issueType: payload.issueType,
      description: payload.description,
      timestamp: new Date().toISOString(),
    });
    return { status: 'ok' };
  }

  @SubscribeMessage('tele:ping')
  handlePing(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { consultationId: string },
  ) {
    if (!getWsUser(client)) return { status: 'unauthorized' };
    client.emit('tele:pong', { consultationId: payload.consultationId, ts: Date.now() });
    return { status: 'ok' };
  }

  // ── Service → Clients (used by TelemedicineService & bridge) ─────────────────

  broadcastToConsultation(tenantId: string, consultationId: string, event: string, payload: any) {
    this.server.to(`consult:${tenantId}:${consultationId}`).emit(event, payload);
  }

  broadcastToUser(tenantId: string, userId: string, event: string, payload: any) {
    this.server.to(`tenant:${tenantId}:user:${userId}`).emit(event, payload);
  }
}
