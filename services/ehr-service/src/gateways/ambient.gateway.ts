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
import { AmbientService } from '../services/ambient.service';
import { TenantService } from '../services/tenant.service';
import { CdssDecisionLogService } from '../services/cdss-decision-log.service';

/**
 * WebSocket gateway for real-time ambient AI sessions.
 *
 * Event flow (client → server):
 *   ambient:start   { patientId, providerId, appointmentId?, tenantId }
 *   ambient:chunk   { sessionId, audio: base64, tenantId }
 *   ambient:pause   { sessionId, tenantId }
 *   ambient:resume  { sessionId, tenantId }
 *   ambient:action  { sessionId, category, itemId, action, tenantId }
 *   ambient:end     { sessionId, tenantId }
 *
 * Event flow (server → client):
 *   ambient:started   { sessionId }
 *   ambient:transcript { sessionId, transcript, entities, draftNote, alerts }
 *   ambient:ended     { sessionId, session }
 *   ambient:error     { message }
 *
 * Sprint 63 — Ambient AI
 */
@WebSocketGateway({ namespace: '/ambient', cors: { origin: '*' } })
export class AmbientGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(AmbientGateway.name);

  constructor(
    @Optional() private readonly ambientService?: AmbientService,
    @Optional() private readonly tenantService?: TenantService,
    @Optional() private readonly decisionLogService?: CdssDecisionLogService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Ambient client connected: ${client.id}`);
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
      tenantId: string;
    },
  ) {
    if (!this.ambientService || !this.tenantService) {
      client.emit('ambient:error', { message: 'Ambient service unavailable' });
      return;
    }
    try {
      const db = await this.tenantService.getTenantDatabase(payload.tenantId);
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
    @MessageBody() payload: { sessionId: string; audio: string; tenantId: string },
  ) {
    if (!this.ambientService || !this.tenantService) return;
    try {
      const db = await this.tenantService.getTenantDatabase(payload.tenantId);
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
    @MessageBody() payload: { sessionId: string; tenantId: string },
  ) {
    if (!this.ambientService || !this.tenantService) return;
    try {
      const db = await this.tenantService.getTenantDatabase(payload.tenantId);
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
    @MessageBody() payload: { sessionId: string; tenantId: string },
  ) {
    if (!this.ambientService || !this.tenantService) return;
    try {
      const db = await this.tenantService.getTenantDatabase(payload.tenantId);
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
      tenantId: string;
    },
  ) {
    if (!this.ambientService || !this.tenantService) return;
    try {
      const db = await this.tenantService.getTenantDatabase(payload.tenantId);
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
        ).catch(() => {}); // non-blocking
      }
    } catch (e: any) {
      client.emit('ambient:error', { message: String(e?.message || e) });
    }
  }

  @SubscribeMessage('ambient:end')
  async handleEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId: string; tenantId: string },
  ) {
    if (!this.ambientService || !this.tenantService) return;
    try {
      const db = await this.tenantService.getTenantDatabase(payload.tenantId);
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
