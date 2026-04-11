import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { CervicalCancerService } from '../services/cervical-cancer.service';

@Controller('cervical-cancer')
@UseGuards(JwtAuthGuard)
export class CervicalCancerController {
  constructor(private readonly cervicalCancerService: CervicalCancerService) {}

  @Post('patient/:patientId/screenings')
  recordScreening(
    @Param('patientId') patientId: string,
    @Body() body: any,
    @Request() req: RequestWithTenant,
  ) {
    return this.cervicalCancerService.recordScreening(
      req.tenantId!,
      req.user?.sub || req.user?.id || null,
      { ...body, patientId },
    );
  }

  @Get('patient/:patientId/screenings')
  getScreenings(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.cervicalCancerService.getScreenings(req.tenantId!, patientId);
  }

  @Get('patient/:patientId/screenings/latest')
  getLatestScreening(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.cervicalCancerService.getLatestScreening(req.tenantId!, patientId);
  }

  @Post('patient/:patientId/treatments')
  recordTreatment(
    @Param('patientId') patientId: string,
    @Body() body: any,
    @Request() req: RequestWithTenant,
  ) {
    return this.cervicalCancerService.recordTreatment(
      req.tenantId!,
      req.user?.sub || req.user?.id || null,
      { ...body, patientId },
    );
  }

  @Get('patient/:patientId/treatments')
  getTreatments(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.cervicalCancerService.getTreatments(req.tenantId!, patientId);
  }

  @Post('cdss/screen-recommend')
  getScreenRecommend(@Body() body: any) {
    return this.cervicalCancerService.getScreenTreatRecommendation(
      body.method,
      body.result,
      body.acetowhite_area_pct ?? body.acetowhiteAreaPct,
      body.hpv_genotype ?? body.hpvGenotype,
      body.lesion_location ?? body.lesionLocation,
    );
  }
}
