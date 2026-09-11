import { UseGuards, Controller, Get, Post, Body, Param, Req, Query } from '@nestjs/common';
import { SmartSchedulingService } from '../services/smart-scheduling.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('scheduling/ai')
@UseGuards(JwtAuthGuard)
export class SmartSchedulingController {
  constructor(private readonly svc: SmartSchedulingService) {}

  @Post('predict/:appointmentId')
  predict(@Req() req: RequestWithTenant, @Param('appointmentId') appointmentId: string, @Body() dto: any) {
    return this.svc.predictAppointment(req.tenantId!, req.tenantDb!, appointmentId, dto);
  }

  @Get('predict/:appointmentId')
  getPrediction(@Req() req: RequestWithTenant, @Param('appointmentId') appointmentId: string) {
    return this.svc.getPrediction(req.tenantDb!, appointmentId);
  }

  @Get('high-risk')
  getHighRisk(@Req() req: RequestWithTenant, @Query('days') days?: string) {
    return this.svc.getHighRiskAppointments(req.tenantDb!, days ? parseInt(days) : 7);
  }
}
