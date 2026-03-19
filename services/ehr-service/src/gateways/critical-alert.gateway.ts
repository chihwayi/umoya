import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, OnModuleInit } from '@nestjs/common';
import { AlertDeliveryService } from '../services/alert-delivery.service';

@WebSocketGateway({ namespace: 'alerts', cors: { origin: '*' } })
export class CriticalAlertGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(CriticalAlertGateway.name);
  private userSockets = new Map<string, string[]>(); // userId → socketIds

  constructor(private readonly alertDelivery: AlertDeliveryService) {}

  onModuleInit() {
    this.alertDelivery.setGateway(this);
  }

  handleConnection(client: Socket) {
    const userId = client.handshake.auth?.userId as string;
    if (userId) {
      const existing = this.userSockets.get(userId) || [];
      this.userSockets.set(userId, [...existing, client.id]);
      client.join(`user:${userId}`);
      this.logger.debug(`Alert WS connected: user=${userId} socket=${client.id}`);
    }
  }

  handleDisconnect(client: Socket) {
    for (const [userId, sockets] of this.userSockets.entries()) {
      const filtered = sockets.filter(s => s !== client.id);
      if (filtered.length) this.userSockets.set(userId, filtered);
      else this.userSockets.delete(userId);
    }
  }

  sendToUser(userId: string, payload: any) {
    this.server.to(`user:${userId}`).emit('clinical_alert', payload);
  }

  @SubscribeMessage('acknowledge')
  handleAcknowledge(@MessageBody() data: { alertId: string; subdomain: string }, @ConnectedSocket() client: Socket) {
    const userId = client.handshake.auth?.userId;
    this.logger.debug(`Alert ${data.alertId} acknowledged by ${userId}`);
    // Acknowledgement persisted via HTTP endpoint
    return { status: 'ok' };
  }
}
