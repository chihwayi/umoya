import { Controller, Get, Post, Param, Body, Query, Req } from '@nestjs/common';
import { CsatService, CsatSubmissionDto } from '../services/csat.service';

@Controller('csat')
export class CsatController {
  constructor(private readonly csat: CsatService) {}

  @Post('send')
  sendSurvey(
    @Req() req: any,
    @Body() body: { encounterId: string; patientId: string; clinicianId?: string },
  ) {
    const subdomain = req.tenantSubdomain ?? 'app';
    return this.csat.createAndSendSurvey(req.tenantDb, body.encounterId, body.patientId, body.clinicianId, subdomain);
  }

  @Get('survey/:token')
  getSurvey(@Req() req: any, @Param('token') token: string) {
    return this.csat.getSurveyByToken(req.tenantDb, token);
  }

  @Post('survey/:token/submit')
  submitSurvey(@Req() req: any, @Param('token') token: string, @Body() body: CsatSubmissionDto) {
    return this.csat.submitSurvey(req.tenantDb, token, body);
  }

  @Get('stats')
  getStats(@Req() req: any, @Query('days') days?: string) {
    return this.csat.getAggregateStats(req.tenantDb, days ? +days : 30);
  }

  @Get('clinician/:id/stats')
  getClinicianStats(@Req() req: any, @Param('id') id: string, @Query('days') days?: string) {
    return this.csat.getClinicianStats(req.tenantDb, id, days ? +days : 30);
  }
}
