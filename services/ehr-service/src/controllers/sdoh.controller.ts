import { Controller, Get, Post, Patch, Body, Param, Headers, Query } from '@nestjs/common';
import { SdohService } from '../services/sdoh.service';

@Controller('sdoh')
export class SdohController {
  constructor(private readonly svc: SdohService) {}

  private tenant(h: Record<string, string>): string {
    return h['x-tenant-subdomain'] || 'default';
  }

  // ── Community Resources ────────────────────────────────────────────────────

  @Post('resources')
  addResource(@Headers() h: Record<string, string>, @Body() dto: any) {
    return this.svc.addResource(this.tenant(h), dto);
  }

  @Get('resources')
  getResources(@Headers() h: Record<string, string>, @Query('category') category?: string) {
    return this.svc.getResources(this.tenant(h), category);
  }

  @Patch('resources/:id')
  updateResource(@Headers() h: Record<string, string>, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateResource(this.tenant(h), id, dto);
  }

  // ── SDOH Referrals ─────────────────────────────────────────────────────────

  @Post('patient/:patientId/referral')
  addReferral(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addReferral(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/referral')
  getReferrals(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getReferrals(this.tenant(h), patientId);
  }

  @Patch('referral/:id')
  updateReferral(@Headers() h: Record<string, string>, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateReferral(this.tenant(h), id, dto);
  }

  // ── SDOH Screening Logs ────────────────────────────────────────────────────

  @Post('patient/:patientId/screening')
  addScreeningLog(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addScreeningLog(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/screening')
  getScreeningLogs(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getScreeningLogs(this.tenant(h), patientId);
  }

  // ── CDSS ───────────────────────────────────────────────────────────────────

  @Post('cdss/screen')
  screenSdoh(@Body() dto: any) {
    return this.svc.screenSdoh(dto);
  }

  @Post('cdss/resource/match')
  matchResources(@Body() dto: any) {
    return this.svc.matchResources(dto);
  }
}
