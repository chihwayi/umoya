import { Controller, Get, Post, Param, Body, Req } from '@nestjs/common';
import { DigitalConsentService } from '../services/digital-consent.service';

@Controller('consent')
export class DigitalConsentController {
  constructor(private readonly consent: DigitalConsentService) {}

  @Post('request')
  createRequest(
    @Req() req: any,
    @Body() body: { encounterId: string; patientId: string; templateId: string },
  ) {
    return this.consent.createRequest(req.tenantDb, body.encounterId, body.patientId, body.templateId, req.user.id);
  }

  @Get('form/:token')
  getForm(@Req() req: any, @Param('token') token: string) {
    return this.consent.getRequestByToken(req.tenantDb, token);
  }

  @Post('form/:token/sign')
  sign(
    @Req() req: any,
    @Param('token') token: string,
    @Body() body: { signatureSvg: string; witnessName?: string; patientStatement?: string },
  ) {
    return this.consent.sign(req.tenantDb, token, body.signatureSvg, body.witnessName, body.patientStatement);
  }

  @Post('form/:token/decline')
  decline(@Req() req: any, @Param('token') token: string) {
    return this.consent.decline(req.tenantDb, token);
  }

  @Get('encounter/:encounterId')
  getEncounterConsents(@Req() req: any, @Param('encounterId') id: string) {
    return this.consent.getEncounterConsents(req.tenantDb, id);
  }

  @Get('requests/:id/pdf')
  getPdfUrl(@Req() req: any, @Param('id') id: string) {
    return this.consent.getConsentPdfUrl(req.tenantDb, id).then((url) => ({ url }));
  }
}
