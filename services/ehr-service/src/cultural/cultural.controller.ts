import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { CulturalService } from './cultural.service';

@Controller('cultural')
@UseGuards(JwtAuthGuard)
export class CulturalController {
  constructor(private readonly culturalService: CulturalService) {}

  @Post('sdoh')
  upsertSdoh(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.culturalService.upsertSocialDeterminants(req.tenantId, {
      ...body,
      assessedBy: body?.assessedBy ?? req.user?.sub ?? req.user?.id ?? null,
    });
  }

  @Get('sdoh/:patientId')
  getSdoh(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.culturalService.getSocialDeterminants(req.tenantId, patientId);
  }

  @Get('sdoh/:patientId/risk')
  getSdohRisk(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.culturalService.getSdohRisk(req.tenantId, patientId);
  }

  @Post('family-consent')
  recordFamilyConsent(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.culturalService.recordFamilyCouncilConsent(
      req.tenantId,
      req.user?.sub ?? req.user?.id ?? null,
      body,
    );
  }

  @Get('family-consent/:patientId')
  getFamilyConsents(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.culturalService.getFamilyConsents(req.tenantId, patientId);
  }

  @Get('family-consent/record/:id')
  getConsent(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.culturalService.getConsent(req.tenantId, id);
  }

  @Post('wellbeing')
  recordWellbeing(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.culturalService.recordWellbeingAssessment(
      req.tenantId,
      req.user?.sub ?? req.user?.id ?? null,
      {
        ...body,
        assessedBy: body?.assessedBy ?? req.user?.sub ?? req.user?.id ?? null,
      },
    );
  }

  @Get('wellbeing/:patientId')
  getWellbeingHistory(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.culturalService.getWellbeingHistory(req.tenantId, patientId);
  }

  @Get('summary/:patientId')
  getSummary(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.culturalService.getCulturalSummary(req.tenantId, patientId);
  }
}
