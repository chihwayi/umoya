import { UseGuards, Controller, Get, Post, Patch, Body, Param, Headers } from '@nestjs/common';
import { PgxService } from '../services/pgx.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('pgx')
@UseGuards(JwtAuthGuard)
export class PgxController {
  constructor(private readonly svc: PgxService) {}

  private tenant(h: Record<string, string>): string {
    return h['x-tenant-subdomain'] || 'default';
  }

  @Post('patient/:patientId/profile')
  upsertProfile(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.upsertProfile(this.tenant(h), patientId, dto);
  }

  @Get('patient/:patientId/profile')
  getProfile(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getProfile(this.tenant(h), patientId);
  }

  @Get('patient/:patientId/alerts')
  getAlerts(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getAlerts(this.tenant(h), patientId);
  }

  @Patch('alert/:id/acknowledge')
  acknowledgeAlert(@Headers() h: Record<string, string>, @Param('id') id: string, @Body() dto: { acknowledgedBy: string }) {
    return this.svc.acknowledgeAlert(this.tenant(h), id, dto.acknowledgedBy);
  }

  @Post('check')
  cdssCheck(@Body() dto: any) {
    return this.svc.cdssCheck(dto);
  }
}
