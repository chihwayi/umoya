import { UseGuards, Controller, Get, Post, Patch, Body, Param, Req } from '@nestjs/common';
import { PgxService } from '../services/pgx.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('pgx')
@UseGuards(JwtAuthGuard)
export class PgxController {
  constructor(private readonly svc: PgxService) {}

  @Post('patient/:patientId/profile')
  upsertProfile(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.upsertProfile(req.tenantDb!, patientId, dto);
  }

  @Get('patient/:patientId/profile')
  getProfile(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getProfile(req.tenantDb!, patientId);
  }

  @Get('patient/:patientId/alerts')
  getAlerts(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getAlerts(req.tenantDb!, patientId);
  }

  @Patch('alert/:id/acknowledge')
  acknowledgeAlert(@Req() req: RequestWithTenant, @Param('id') id: string, @Body() dto: { acknowledgedBy: string }) {
    return this.svc.acknowledgeAlert(req.tenantDb!, id, dto.acknowledgedBy);
  }

  @Post('check')
  cdssCheck(@Body() dto: any) {
    return this.svc.cdssCheck(dto);
  }
}
