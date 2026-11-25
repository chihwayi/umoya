import {
  WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { QueueService } from '../services/queue.service';
import { TenantService } from '../services/tenant.service';
import { PatientAccessService } from '../services/patient-access.service';
import { authenticateSocket, getWsUser } from './ws-auth.util';

const NURSE_ROLES = ['nurse', 'doctor', 'admin'];

@WebSocketGateway({ namespace: '/queue', cors: { origin: '*' } })
export class QueueGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  constructor(
    private readonly queueService: QueueService,
    private readonly jwtService: JwtService,
    private readonly tenantService: TenantService,
    private readonly patientAccess: PatientAccessService,
  ) {}

  handleConnection(client: Socket) {
    authenticateSocket(client, this.jwtService);
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(@MessageBody() data: { patientId: string }, @ConnectedSocket() client: Socket) {
    const user = getWsUser(client);
    if (!user) return;
    // R2 / FX-011: patient rooms carry queue entries with names — joining a
    // stranger's room is the socket equivalent of the S-001 IDOR. Check first.
    try {
      const db = await this.tenantService.getTenantDatabase(user.tenantId);
      if (!db) { client.emit('queue:error', { message: 'Invalid tenant' }); return; }
      await this.patientAccess.assertCanAccess(
        db,
        { userId: user.id, role: user.role, facilityId: null },
        data.patientId,
        'queue-subscribe',
      );
    } catch {
      client.emit('queue:error', { message: 'Forbidden' });
      return;
    }
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
