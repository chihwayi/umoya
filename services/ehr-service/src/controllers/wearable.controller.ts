import { UseGuards, Controller, Post, Get, Patch, Body, Param, Query, Req } from '@nestjs/common';
import { WearableSyncService, WearableReadingDto } from '../services/wearable-sync.service';
import { ReadingType } from '../constants/wearable-ranges';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('wearable')
@UseGuards(JwtAuthGuard)
export class WearableController {
  constructor(private readonly wearable: WearableSyncService) {}

  @Post('devices')
  registerDevice(
    @Req() req: any,
    @Body() body: {
      patientId: string;
      deviceType: string;
      deviceName?: string;
      bleAddress?: string;
      externalId?: string;
    },
  ) {
    return this.wearable.registerDevice(req.tenantDb, body.patientId, body);
  }

  @Get('devices/:patientId')
  listDevices(@Req() req: any, @Param('patientId') patientId: string) {
    return this.wearable.listDevices(req.tenantDb, patientId);
  }

  @Post('readings')
  ingestReadings(
    @Req() req: any,
    @Body() body: { patientId: string; readings: WearableReadingDto[] },
  ) {
    return this.wearable.ingestReadings(req.tenantDb, body.patientId, body.readings);
  }

  @Get('timeline/:patientId')
  getTimeline(
    @Req() req: any,
    @Param('patientId') patientId: string,
    @Query('type') type: ReadingType,
    @Query('days') days?: string,
  ) {
    return this.wearable.getTimeline(req.tenantDb, patientId, type, days ? +days : 7);
  }

  @Get('alerts')
  getPendingAlerts(@Req() req: any, @Query('patientId') patientId?: string) {
    return this.wearable.getPendingAlerts(req.tenantDb, patientId);
  }

  @Patch('alerts/:alertId/acknowledge')
  acknowledgeAlert(
    @Req() req: any,
    @Param('alertId') alertId: string,
    @Body() body: { userId: string },
  ) {
    return this.wearable.acknowledgeAlert(req.tenantDb, alertId, body.userId ?? req.user?.id);
  }
}
