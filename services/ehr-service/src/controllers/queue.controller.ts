import { Controller, Post, Get, Patch, Param, Body, Req } from '@nestjs/common';
import { QueueService } from '../services/queue.service';
import { QueueGateway } from '../gateways/queue.gateway';

@Controller('queue')
export class QueueController {
  constructor(
    private readonly queue: QueueService,
    private readonly gateway: QueueGateway,
  ) {}

  @Post('enqueue')
  async enqueue(
    @Req() req: any,
    @Body() body: { patientId: string; appointmentId?: string },
  ) {
    const result = await this.queue.enqueue(req.tenantDb, body.patientId, body.appointmentId);
    const entry = await this.queue.getQueueEntry(req.tenantDb, body.patientId);
    await this.gateway.broadcastQueueUpdate(body.patientId, entry);
    const fullQueue = await this.queue.getTodayQueue(req.tenantDb);
    await this.gateway.broadcastNurseQueue(fullQueue);
    return result;
  }

  @Get('today')
  getToday(@Req() req: any) {
    return this.queue.getTodayQueue(req.tenantDb);
  }

  @Get('patient/:patientId')
  getEntry(@Req() req: any, @Param('patientId') patientId: string) {
    return this.queue.getQueueEntry(req.tenantDb, patientId);
  }

  @Patch(':queueId/status')
  async updateStatus(
    @Req() req: any,
    @Param('queueId') queueId: string,
    @Body() body: { status: 'called' | 'in_consultation' | 'done' | 'no_show' },
  ) {
    const patientId = await this.queue.getPatientIdForQueue(req.tenantDb, queueId);
    await this.queue.updateStatus(req.tenantDb, queueId, body.status);
    await this.queue.recalculateWaits(req.tenantDb);
    if (patientId) {
      const entry = await this.queue.getQueueEntry(req.tenantDb, patientId);
      await this.gateway.broadcastQueueUpdate(patientId, entry ?? { queueId, status: body.status });
    }
    const fullQueue = await this.queue.getTodayQueue(req.tenantDb);
    await this.gateway.broadcastNurseQueue(fullQueue);
    return { ok: true };
  }
}
