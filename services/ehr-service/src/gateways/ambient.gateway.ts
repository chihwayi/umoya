import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, Optional } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { AmbientService } from '../services/ambient.service';
import { TenantService } from '../services/tenant.service';
import { CdssDecisionLogService } from '../services/cdss-decision-log.service';
import { authenticateSocket, getWsUser } from './ws-auth.util';

const CLINICAL_ROLES = ['doctor', 'nurse', 'admin'];

/**
 * WebSocket gateway for real-time ambient AI sessions.
 *
 * Event flow (client → server):
 *   ambient:start   { patientId, providerId, appointmentId? }
 *   ambient:chunk   { sessionId, audio: base64 }
 *   ambient:pause   { sessionId }
 *   ambient:resume  { sessionId }
 *   ambient:action  { sessionId, category, itemId, action, patientId }
 *   ambient:end     { sessionId }
 *
 * Event flow (server → client):
 *   ambient:started   { sessionId }
 *   ambient:transcript { sessionId, transcript, entities, draftNote, alerts }
 *   ambient:ended     { sessionId, session }
 *   ambient:error     { message }
 *
 * Sprint 63 — Ambient AI
 *
 * tenantId is always taken from the verified JWT on the socket, never from
 * the client payload — this gateway used to let any unauthenticated client
 * name an arbitrary tenantId and read/write that tenant's database.
 */
@WebSocketGateway({ namespace: '/ambient', cors: { origin: '*' } })
export class AmbientGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(AmbientGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    @Optional() private readonly ambientService?: AmbientService,
    @Optional() private readonly tenantService?: TenantService,
    @Optional() private readonly decisionLogService?: CdssDecisionLogService,
  ) {}

  handleConnection(client: Socket) {
    const user = authenticateSocket(client, this.jwtService);
    if (!user) return;
    this.logger.log(`Ambient client connected: user=${user.id} tenant=${user.tenantId} socket=${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Ambient client disconnected: ${client.id}`);
  }

  @SubscribeMessage('ambient:start')
  async handleStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: {
      patientId: string;
      providerId: string;
      appointmentId?: string;
    },
  ) {
    const user = getWsUser(client);
    if (!user) { client.emit('ambient:error', { message: 'Unauthorized' }); return; }
    if (!CLINICAL_ROLES.includes(user.role)) { client.emit('ambient:error', { message: 'Forbidden' }); return; }
    if (!this.ambientService || !this.tenantService) {
      client.emit('ambient:error', { message: 'Ambient service unavailable' });
      return;
    }
    try {
      const db = await this.tenantService.getTenantDatabase(user.tenantId);
      if (!db) { client.emit('ambient:error', { message: 'Tenant not found' }); return; }

      const session = await this.ambientService.startSession(
        { patientId: payload.patientId, providerId: payload.providerId, appointmentId: payload.appointmentId },
        db,
      );
      client.join(`session:${session.id}`);
      client.emit('ambient:started', { sessionId: session.id });
      this.logger.log(`Ambient session ${session.id} started for patient ${payload.patientId}`);
    } catch (e: any) {
      client.emit('ambient:error', { message: String(e?.message || e) });
    }
  }

  @SubscribeMessage('ambient:chunk')
  async handleChunk(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId: string; audio: string },
  ) {
    const user = getWsUser(client);
    if (!user || !this.ambientService || !this.tenantService) return;
    try {
      const db = await this.tenantService.getTenantDatabase(user.tenantId);
      if (!db) return;

      const result = await this.ambientService.processChunk(payload.sessionId, payload.audio, db);

      // Emit back to all clients in this session room
      this.server.to(`session:${payload.sessionId}`).emit('ambient:transcript', {
        sessionId:  payload.sessionId,
        transcript: result.transcript,
        entities:   result.entities,
        draftNote:  result.draftNote,
        alerts:     result.entities.alerts,
      });
    } catch (e: any) {
      client.emit('ambient:error', { message: String(e?.message || e) });
    }
  }

  @SubscribeMessage('ambient:pause')
  async handlePause(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId: string },
  ) {
    const user = getWsUser(client);
    if (!user || !this.ambientService || !this.tenantService) return;
    try {
      const db = await this.tenantService.getTenantDatabase(user.tenantId);
      if (!db) return;
      await this.ambientService.pauseSession(payload.sessionId, db);
      client.emit('ambient:paused', { sessionId: payload.sessionId });
    } catch (e: any) {
      client.emit('ambient:error', { message: String(e?.message || e) });
    }
  }

  @SubscribeMessage('ambient:resume')
  async handleResume(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId: string },
  ) {
    const user = getWsUser(client);
    if (!user || !this.ambientService || !this.tenantService) return;
    try {
      const db = await this.tenantService.getTenantDatabase(user.tenantId);
      if (!db) return;
      await this.ambientService.resumeSession(payload.sessionId, db);
      client.emit('ambient:resumed', { sessionId: payload.sessionId });
    } catch (e: any) {
      client.emit('ambient:error', { message: String(e?.message || e) });
    }
  }

  @SubscribeMessage('ambient:action')
  async handleProviderAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: {
      sessionId: string;
      category: 'orders' | 'diagnoses';
      itemId: string;
      action: 'accepted' | 'dismissed';
      patientId: string;
    },
  ) {
    const user = getWsUser(client);
    if (!user) { client.emit('ambient:error', { message: 'Unauthorized' }); return; }
    if (!CLINICAL_ROLES.includes(user.role)) { client.emit('ambient:error', { message: 'Forbidden' }); return; }
    if (!this.ambientService || !this.tenantService) return;
    try {
      const db = await this.tenantService.getTenantDatabase(user.tenantId);
      if (!db) return;

      await this.ambientService.recordProviderAction(
        payload.sessionId,
        payload.category,
        payload.itemId,
        payload.action,
        db,
      );

      // Log to CDSS decision log so the outcome feedback loop captures ambient actions
      if (this.decisionLogService && payload.action === 'accepted') {
        await this.decisionLogService.logDecision(
          {
            patientId:            payload.patientId,
            decisionType:         `ambient_${payload.category.slice(0, -1)}`, // order / diagnosis
            cdssRequestPayload:   { sessionId: payload.sessionId, itemId: payload.itemId },
            cdssResponsePayload:  { source: 'ambient' },
          },
          db,
        ).then((log) =>
          this.decisionLogService!.recordClinicianAction(
            log.id,
            { clinicianAction: 'accepted' },
            db,
          ),
        ).catch((e: any) => this.logger.warn(`Recording clinician action for ambient decision failed: ${e?.message}`));
      }
    } catch (e: any) {
      client.emit('ambient:error', { message: String(e?.message || e) });
    }
  }

  @SubscribeMessage('ambient:end')
  async handleEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId: string },
  ) {
    const user = getWsUser(client);
    if (!user || !this.ambientService || !this.tenantService) return;
    try {
      const db = await this.tenantService.getTenantDatabase(user.tenantId);
      if (!db) return;

      const session = await this.ambientService.endSession(payload.sessionId, db);
      this.server.to(`session:${payload.sessionId}`).emit('ambient:ended', {
        sessionId: payload.sessionId,
        session,
      });
      client.leave(`session:${payload.sessionId}`);
      this.logger.log(`Ambient session ${payload.sessionId} ended`);
    } catch (e: any) {
      client.emit('ambient:error', { message: String(e?.message || e) });
    }
  }
}
