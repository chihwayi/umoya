import { UseGuards, Controller, Post, Get, Delete, Body, Param, Req } from '@nestjs/common';
import { IotService } from '../services/iot.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('iot')
@UseGuards(JwtAuthGuard)
export class IotController {
  constructor(private readonly svc: IotService) {}

  // ── Device Management ──────────────────────────────────────────────────────

  @Post('device')
  registerDevice(
    @Req() req: RequestWithTenant,
    @Body('patientId') patientId: string,
    @Body() dto: any,
  ) {
    return this.svc.registerDevice(req.tenantDb!, patientId, dto);
  }

  @Get('device')
  getDevices(
    @Req() req: RequestWithTenant,
    @Body('patientId') patientId: string,
  ) {
    return this.svc.getDevices(req.tenantDb!, patientId);
  }

  @Delete('device/:deviceId')
  revokeDevice(
    @Req() req: RequestWithTenant,
    @Param('deviceId') deviceId: string,
  ) {
    return this.svc.revokeDevice(req.tenantDb!, deviceId);
  }

  // ── Data Ingestion ────────────────────────────────────────────────────────

  @Post('data')
  ingestData(
    @Req() req: RequestWithTenant,
    @Body('patientId') patientId: string,
    @Body('deviceId') deviceId: string,
    @Body('readings') readings: Array<{
      measurementType: string; value: number; unit: string; measuredAt: string;
    }>,
  ) {
    return this.svc.ingestData(req.tenantDb!, req.tenantId!, patientId, deviceId, readings);
  }

  @Get('readings')
  getReadings(
    @Req() req: RequestWithTenant,
    @Body('patientId') patientId: string,
    @Body('measurementType') measurementType?: string,
  ) {
    return this.svc.getReadings(req.tenantDb!, patientId, measurementType);
  }
}
