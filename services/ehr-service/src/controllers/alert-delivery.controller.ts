import { Controller, Post, Get, Patch, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { AlertDeliveryService } from '../services/alert-delivery.service';

@ApiTags('Clinical Alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('alerts')
export class AlertDeliveryController {
  constructor(private readonly svc: AlertDeliveryService) {}

  @Get('unacknowledged')
  getUnacknowledged(
    @Req() req: RequestWithTenant,
    @Query('userId') userId: string,
  ) {
    return this.svc.getUnacknowledged(req.tenantDb!, userId);
  }

  @Get('patient/:patientId/history')
  getHistory(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getAlertHistory(req.tenantDb!, patientId);
  }

  @Patch(':id/acknowledge')
  acknowledge(
    @Req() req: RequestWithTenant,
    @Param('id') id: string,
    @Body('userId') userId: string,
  ) {
    return this.svc.acknowledge(req.tenantDb!, id, userId);
  }

  @Post('broadcast')
  broadcast(
    @Req() req: RequestWithTenant,
    @Body() alert: any,
  ) {
    return this.svc.broadcastCriticalAlert(req.tenantDb!, alert);
  }
}
