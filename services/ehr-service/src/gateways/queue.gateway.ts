import {
  WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { QueueService } from '../services/queue.service';
import { authenticateSocket, getWsUser } from './ws-auth.util';

const NURSE_ROLES = ['nurse', 'doctor', 'admin'];

@WebSocketGateway({ namespace: '/queue', cors: { origin: '*' } })
export class QueueGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  constructor(
    private readonly queueService: QueueService,
    private readonly jwtService: JwtService,
  ) {}

  handleConnection(client: Socket) {
    authenticateSocket(client, this.jwtService);
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(@MessageBody() data: { patientId: string }, @ConnectedSocket() client: Socket) {
    const user = getWsUser(client);
    if (!user) return;
    client.join(`tenant:${user.tenantId}:patient-${data.patientId}`);
    client.emit('queue_update', null);
  }

  @SubscribeMessage('join_nurses')
  handleJoinNurses(@ConnectedSocket() client: Socket) {
    const user = getWsUser(client);
    if (!user || !NURSE_ROLES.includes(user.role)) return;
    client.join(`tenant:${user.tenantId}:nurses`);
  }

  async broadcastQueueUpdate(tenantId: string, patientId: string, entry: any) {
    this.server.to(`tenant:${tenantId}:patient-${patientId}`).emit('queue_update', entry);
    if (entry?.status === 'called') {
      this.server.to(`tenant:${tenantId}:patient-${patientId}`).emit('your_turn', {message: '...'});
    }
  }

  async broadcastNurseQueue(tenantId: string, queue: any[]) {
    this.server.to(`tenant:${tenantId}:nurses`).emit('nurse_queue_update', queue);
  }
}
