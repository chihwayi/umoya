import { UseGuards, Controller, Post, Get, Patch, Body, Param, Query, Req, ForbiddenException } from '@nestjs/common';
import { WearableSyncService, WearableReadingDto } from '../services/wearable-sync.service';
import { ReadingType } from '../constants/wearable-ranges';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('wearable')
@UseGuards(JwtAuthGuard)
export class WearableController {
  constructor(private readonly wearable: WearableSyncService) {}

  /**
   * A patient-role token may only ever act on its own patientId — resolves
   * the effective patientId for the request, throwing if a patient caller
   * names someone else's id. Staff callers pass through unrestricted.
   */
  private scopedPatientId(req: any, requested?: string): string | undefined {
    if (String(req.user?.role || '').toLowerCase() === 'patient') {
      const own = req.user?.sub || req.user?.id;
      if (requested && requested !== own) {
        throw new ForbiddenException('Cannot access another patient\'s wearable data');
      }
      return own;
    }
    return requested;
  }

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
    const patientId = this.scopedPatientId(req, body.patientId);
    return this.wearable.registerDevice(req.tenantDb, patientId!, body);
  }

  @Get('devices/:patientId')
  listDevices(@Req() req: any, @Param('patientId') patientId: string) {
    return this.wearable.listDevices(req.tenantDb, this.scopedPatientId(req, patientId)!);
  }

  @Post('readings')
  ingestReadings(
    @Req() req: any,
    @Body() body: { patientId: string; readings: WearableReadingDto[] },
  ) {
    const patientId = this.scopedPatientId(req, body.patientId);
    return this.wearable.ingestReadings(req.tenantDb, patientId!, body.readings);
  }

  @Get('timeline/:patientId')
  getTimeline(
    @Req() req: any,
    @Param('patientId') patientId: string,
    @Query('type') type: ReadingType,
    @Query('days') days?: string,
  ) {
    return this.wearable.getTimeline(req.tenantDb, this.scopedPatientId(req, patientId)!, type, days ? +days : 7);
  }

  @Get('alerts')
  getPendingAlerts(@Req() req: any, @Query('patientId') patientId?: string) {
    return this.wearable.getPendingAlerts(req.tenantDb, this.scopedPatientId(req, patientId));
  }

  @Patch('alerts/:alertId/acknowledge')
  acknowledgeAlert(
    @Req() req: any,
    @Param('alertId') alertId: string,
  ) {
    return this.wearable.acknowledgeAlert(req.tenantDb, alertId, req.user?.sub || req.user?.id);
  }
}
