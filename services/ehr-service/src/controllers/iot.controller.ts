import { Controller, Post, Get, Delete, Body, Param, Query } from '@nestjs/common';
import { IotService } from '../services/iot.service';

@Controller('iot')
export class IotController {
  constructor(private readonly svc: IotService) {}

  // ── Device Management ──────────────────────────────────────────────────────

  @Post('device')
  registerDevice(
    @Body('subdomain') subdomain: string,
    @Body('patientId') patientId: string,
    @Body() dto: any,
  ) {
    return this.svc.registerDevice(subdomain, patientId, dto);
  }

  @Get('device')
  getDevices(
    @Query('subdomain') subdomain: string,
    @Query('patientId') patientId: string,
  ) {
    return this.svc.getDevices(subdomain, patientId);
  }

  @Delete('device/:deviceId')
  revokeDevice(
    @Param('deviceId') deviceId: string,
    @Query('subdomain') subdomain: string,
  ) {
    return this.svc.revokeDevice(subdomain, deviceId);
  }

  // ── Data Ingestion ────────────────────────────────────────────────────────

  @Post('data')
  ingestData(
    @Body('subdomain') subdomain: string,
    @Body('patientId') patientId: string,
    @Body('deviceId') deviceId: string,
    @Body('readings') readings: Array<{
      measurementType: string; value: number; unit: string; measuredAt: string;
    }>,
  ) {
    return this.svc.ingestData(subdomain, patientId, deviceId, readings);
  }

  @Get('readings')
  getReadings(
    @Query('subdomain') subdomain: string,
    @Query('patientId') patientId: string,
    @Query('measurementType') measurementType?: string,
  ) {
    return this.svc.getReadings(subdomain, patientId, measurementType);
  }
}
