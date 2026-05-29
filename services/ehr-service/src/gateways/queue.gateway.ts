import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { QueueService } from '../services/queue.service';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@WebSocketGateway({ namespace: '/queue', cors: { origin: '*' } })
export class QueueGateway {
  @WebSocketServer() server: Server;

  constructor(
    private readonly queueService: QueueService,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @MessageBody() data: { patientId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`patient-${data.patientId}`);
    const entry = await this.queueService.getQueueEntry(this.db, data.patientId);
    client.emit('queue_update', entry);
  }

  @SubscribeMessage('join_nurses')
  handleJoinNurses(@ConnectedSocket() client: Socket) {
    client.join('nurses');
  }

  async broadcastQueueUpdate(patientId: string, entry: any) {
    this.server.to(`patient-${patientId}`).emit('queue_update', entry);
    if (entry?.status === 'called') {
      this.server.to(`patient-${patientId}`).emit('your_turn', {
        message: 'Please proceed to the consultation room.',
      });
    }
  }

  async broadcastNurseQueue(queue: any[]) {
    this.server.to('nurses').emit('nurse_queue_update', queue);
  }
}
