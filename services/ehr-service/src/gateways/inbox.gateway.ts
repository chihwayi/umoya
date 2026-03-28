import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { InboxItem } from '../entities/inbox-item.entity';

/**
 * WebSocket gateway for real-time smart inbox notifications.
 *
 * Client connects to /inbox namespace and joins a room keyed by their userId:
 *   inbox:subscribe  { userId }   → joins room `user:{userId}`
 *
 * Server pushes:
 *   inbox:item       { item: InboxItem }   — new triaged item
 *   inbox:counts     { critical, urgent, routine, informational }  — badge counts
 *
 * Sprint 65 — Smart Inbox AI Triage
 */
@WebSocketGateway({ namespace: '/inbox', cors: { origin: '*' } })
export class InboxGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(InboxGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Inbox client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Inbox client disconnected: ${client.id}`);
  }

  @SubscribeMessage('inbox:subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { userId: string },
  ) {
    if (!payload?.userId) return;
    client.join(`user:${payload.userId}`);
    this.logger.log(`User ${payload.userId} joined inbox room`);
  }

  /** Called by InboxTriageService to push a new item to the recipient. */
  pushToUser(userId: string, item: InboxItem): void {
    this.server.to(`user:${userId}`).emit('inbox:item', { item });
  }

  /** Push updated badge counts to a user. */
  pushCounts(userId: string, counts: Record<string, number>): void {
    this.server.to(`user:${userId}`).emit('inbox:counts', counts);
  }
}
