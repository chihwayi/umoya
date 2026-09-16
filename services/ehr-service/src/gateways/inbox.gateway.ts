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
import { JwtService } from '@nestjs/jwt';
import { InboxItem } from '../entities/inbox-item.entity';
import { authenticateSocket, getWsUser } from './ws-auth.util';

@WebSocketGateway({ namespace: '/inbox', cors: { origin: '*' } })
export class InboxGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(InboxGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket) {
    const user = authenticateSocket(client, this.jwtService);
    if (!user) return;
    this.logger.log(`Inbox client connected: user=${user.id} tenant=${user.tenantId} socket=${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Inbox client disconnected: ${client.id}`);
  }

  @SubscribeMessage('inbox:subscribe')
  handleSubscribe(@ConnectedSocket() client: Socket) {
    const user = getWsUser(client);
    if (!user) return;
    client.join(`tenant:${user.tenantId}:user:${user.id}`);
    this.logger.log(`User ${user.id} joined inbox room`);
  }

  /** Called by InboxTriageService to push a new item to the recipient. */
  pushToUser(tenantId: string, userId: string, item: InboxItem): void {
    this.server.to(`tenant:${tenantId}:user:${userId}`).emit('inbox:item', { item });
  }

  /** Push updated badge counts to a user. */
  pushCounts(tenantId: string, userId: string, counts: Record<string, number>): void {
    this.server.to(`tenant:${tenantId}:user:${userId}`).emit('inbox:counts', counts);
  }
}
