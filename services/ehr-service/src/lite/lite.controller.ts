import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { LiteService } from './lite.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('lite')
@UseGuards(JwtAuthGuard)
export class LiteController {
  constructor(private readonly liteService: LiteService) {}

  @Post('sync')
  syncOfflineQueue(@Body() dto: { items: any[] }) {
    return this.liteService.submitOfflineQueue(dto.items);
  }

  @Get('pending-sync/:deviceId')
  getPendingSync(@Param('deviceId') deviceId: string) {
    return this.liteService.getPendingSyncCount(deviceId);
  }

  @Post('ussd/clinical-entry')
  processUssdEntry(@Body() dto: any) {
    return this.liteService.processUssdEntry(dto);
  }
}
