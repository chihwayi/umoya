import { UseGuards, Controller, Get, Post, Patch, Body, Param, Req, Query } from '@nestjs/common';
import { SdohService } from '../services/sdoh.service';
import { SdohObservationMapper } from '../fhir/mappers/sdoh-observation.mapper';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('sdoh')
@UseGuards(JwtAuthGuard)
export class SdohController {
  constructor(private readonly svc: SdohService) {}

  // ── Community Resources ────────────────────────────────────────────────────

  @Post('resources')
  addResource(@Req() req: RequestWithTenant, @Body() dto: any) {
    return this.svc.addResource(req.tenantDb!, dto);
  }

  @Get('resources')
  getResources(@Req() req: RequestWithTenant, @Query('category') category?: string) {
    return this.svc.getResources(req.tenantDb!, category);
  }

  @Patch('resources/:id')
  updateResource(@Req() req: RequestWithTenant, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateResource(req.tenantDb!, id, dto);
  }

  // ── SDOH Referrals ─────────────────────────────────────────────────────────

  @Post('patient/:patientId/referral')
  addReferral(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addReferral(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/referral')
  getReferrals(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getReferrals(req.tenantDb!, patientId);
  }

  @Patch('referral/:id')
  updateReferral(@Req() req: RequestWithTenant, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateReferral(req.tenantDb!, id, dto);
  }

  // ── SDOH Screening Logs ────────────────────────────────────────────────────

  @Post('patient/:patientId/screening')
  addScreeningLog(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addScreeningLog(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/screening')
  getScreeningLogs(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getScreeningLogs(req.tenantDb!, patientId);
  }

  // ── CDSS ───────────────────────────────────────────────────────────────────

  @Post('cdss/screen')
  screenSdoh(@Req() req: RequestWithTenant, @Body() dto: any) {
    return this.svc.screenSdoh(req.tenantId!, req.tenantDb!, dto);
  }

  @Post('cdss/resource/match')
  matchResources(@Req() req: RequestWithTenant, @Body() dto: any) {
    return this.svc.matchResources(req.tenantId!, req.tenantDb!, dto);
  }

  // ── FHIR Export ───────────────────────────────────────────────────────────

  @Get('patient/:patientId/fhir')
  async patientFhirBundle(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    const [screenings, referrals] = await Promise.all([
      this.svc.getScreeningLogs(req.tenantDb!, patientId),
      this.svc.getReferrals(req.tenantDb!, patientId),
    ]);
    const entries = [
      ...screenings.map(r => ({ resource: SdohObservationMapper.screeningLogToFhir(r, req.tenantId!) })),
      ...referrals.map(r => ({ resource: SdohObservationMapper.referralToFhirServiceRequest(r, req.tenantId!) })),
    ];
    return { resourceType: 'Bundle', type: 'searchset', total: entries.length, entry: entries };
  }
}
