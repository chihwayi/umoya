import { Controller, Post, Get, Query, Body } from '@nestjs/common';
import { OfflineSyncService } from '../services/offline-sync.service';

@Controller('sync')
export class OfflineSyncController {
  constructor(private readonly svc: OfflineSyncService) {}

  @Post('batch')
  processBatch(
    @Body('subdomain') subdomain: string,
    @Body('operations') operations: any[],
  ) {
    return this.svc.processBatch(subdomain, operations);
  }

  @Get('checkpoint')
  getCheckpoint(
    @Query('subdomain') subdomain: string,
    @Query('userId') userId: string,
    @Query('since') since: string,
  ) {
    return this.svc.getCheckpoint(subdomain, userId, since);
  }

  @Get('queue')
  getPendingQueue(
    @Query('subdomain') subdomain: string,
    @Query('clientId') clientId: string,
  ) {
    return this.svc.getPendingQueue(subdomain, clientId);
  }
}
