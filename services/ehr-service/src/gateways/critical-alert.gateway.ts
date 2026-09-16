import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AlertDeliveryService } from '../services/alert-delivery.service';
import { authenticateSocket, getWsUser } from './ws-auth.util';

@WebSocketGateway({ namespace: 'alerts', cors: { origin: '*' } })
export class CriticalAlertGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(CriticalAlertGateway.name);
  private userSockets = new Map<string, string[]>(); // userId → socketIds

  constructor(
    private readonly alertDelivery: AlertDeliveryService,
    private readonly jwtService: JwtService,
  ) {}

  onModuleInit() {
    this.alertDelivery.setGateway(this);
  }

  handleConnection(client: Socket) {
    const user = authenticateSocket(client, this.jwtService);
    if (!user) return;

    const existing = this.userSockets.get(user.id) || [];
    this.userSockets.set(user.id, [...existing, client.id]);
    // Room is scoped by both tenant and user id — a valid token for tenant A
    // can never land in tenant B's alert room even if the user ids collided.
    client.join(`tenant:${user.tenantId}:user:${user.id}`);
    this.logger.debug(`Alert WS connected: user=${user.id} tenant=${user.tenantId} socket=${client.id}`);
  }

  handleDisconnect(client: Socket) {
    for (const [userId, sockets] of this.userSockets.entries()) {
      const filtered = sockets.filter(s => s !== client.id);
      if (filtered.length) this.userSockets.set(userId, filtered);
      else this.userSockets.delete(userId);
    }
  }

  sendToUser(userId: string, tenantId: string, payload: any) {
    this.server.to(`tenant:${tenantId}:user:${userId}`).emit('clinical_alert', payload);
  }

  @SubscribeMessage('acknowledge')
  handleAcknowledge(@MessageBody() data: { alertId: string; subdomain: string }, @ConnectedSocket() client: Socket) {
    const user = getWsUser(client);
    if (!user) return { status: 'unauthorized' };
    this.logger.debug(`Alert ${data.alertId} acknowledged by ${user.id}`);
    // Acknowledgement persisted via HTTP endpoint
    return { status: 'ok' };
  }
}
