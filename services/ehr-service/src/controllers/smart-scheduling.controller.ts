import { Controller, Get, Post, Body, Param, Headers, Query } from '@nestjs/common';
import { SmartSchedulingService } from '../services/smart-scheduling.service';

@Controller('scheduling/ai')
export class SmartSchedulingController {
  constructor(private readonly svc: SmartSchedulingService) {}

  private tenant(h: Record<string, string>): string {
    return h['x-tenant-subdomain'] || 'default';
  }

  @Post('predict/:appointmentId')
  predict(@Headers() h: Record<string, string>, @Param('appointmentId') appointmentId: string, @Body() dto: any) {
    return this.svc.predictAppointment(this.tenant(h), appointmentId, dto);
  }

  @Get('predict/:appointmentId')
  getPrediction(@Headers() h: Record<string, string>, @Param('appointmentId') appointmentId: string) {
    return this.svc.getPrediction(this.tenant(h), appointmentId);
  }

  @Get('high-risk')
  getHighRisk(@Headers() h: Record<string, string>, @Query('days') days?: string) {
    return this.svc.getHighRiskAppointments(this.tenant(h), days ? parseInt(days) : 7);
  }
}
