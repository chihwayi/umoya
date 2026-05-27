import { Controller, Get, Post, Patch, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ConsentRecordsService } from '../services/consent-records.service';
import { TeleconsultBridgeService } from '../services/teleconsult-bridge.service';

@Controller('consent-records')
@UseGuards(JwtAuthGuard)
export class ConsentRecordsController {
  constructor(
    private readonly consent: ConsentRecordsService,
    private readonly telebridge: TeleconsultBridgeService,
  ) {}

  @Post('grant')
  grantConsent(@Body() body: any, @Req() req: any) {
    return this.consent.grantConsent({ ...body, collectedBy: req.user?.sub, ipAddress: req.ip }, req.tenantDb);
  }

  @Patch(':id/withdraw')
  withdrawConsent(@Param('id') id: string, @Body() body: { reason: string }, @Req() req: any) {
    return this.consent.withdrawConsent(id, body.reason, req.tenantDb);
  }

  @Get('patients/:patientId')
  getPatientConsents(@Param('patientId') patientId: string, @Req() req: any) {
    return this.consent.getPatientConsents(patientId, req.tenantDb);
  }

  @Get('expiring')
  getExpiringConsents(@Query('daysAhead') daysAhead = 30, @Req() req: any) {
    return this.consent.getExpiringConsents(+daysAhead, req.tenantDb);
  }

  @Post('teleconsult/link')
  linkTeleconsultToEhr(
    @Body() body: { teleconsultId: string; patientId: string; formData: any },
    @Req() req: any,
  ) {
    return this.telebridge.linkPreConsultToEhr(body.teleconsultId, body.patientId, body.formData, req.tenantDb);
  }

  @Get('teleconsult/:teleconsultId/ehr-draft')
  getEhrDraft(@Param('teleconsultId') teleconsultId: string, @Req() req: any) {
    return this.telebridge.getEhrDraftForTeleconsult(teleconsultId, req.tenantDb);
  }
}
