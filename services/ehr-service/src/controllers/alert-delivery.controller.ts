import { Controller, Post, Get, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AlertDeliveryService } from '../services/alert-delivery.service';

@ApiTags('Clinical Alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('alerts')
export class AlertDeliveryController {
  constructor(private readonly svc: AlertDeliveryService) {}

  @Get('unacknowledged')
  getUnacknowledged(
    @Query('subdomain') subdomain: string,
    @Query('userId') userId: string,
  ) {
    return this.svc.getUnacknowledged(subdomain, userId);
  }

  @Get('patient/:patientId/history')
  getHistory(@Param('patientId') patientId: string, @Query('subdomain') subdomain: string) {
    return this.svc.getAlertHistory(subdomain, patientId);
  }

  @Patch(':id/acknowledge')
  acknowledge(
    @Param('id') id: string,
    @Query('subdomain') subdomain: string,
    @Body('userId') userId: string,
  ) {
    return this.svc.acknowledge(subdomain, id, userId);
  }

  @Post('broadcast')
  broadcast(
    @Query('subdomain') subdomain: string,
    @Body() alert: any,
  ) {
    return this.svc.broadcastCriticalAlert(subdomain, alert);
  }
}
