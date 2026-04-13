import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { OneHealthService } from '../services/one-health.service';

@Controller('one-health')
@UseGuards(JwtAuthGuard)
export class OneHealthController {
  constructor(private readonly oneHealthService: OneHealthService) {}

  @Post('patient/:patientId/exposures')
  recordExposure(
    @Param('patientId') patientId: string,
    @Body() body: any,
    @Request() req: RequestWithTenant,
  ) {
    const user = req.user as any;
    return this.oneHealthService.recordExposure(req.tenantId!, patientId, user?.userId ?? user?.id, body);
  }

  @Get('patient/:patientId/exposures')
  getExposures(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.oneHealthService.getExposures(req.tenantId!, patientId);
  }

  @Post('patient/:patientId/reports')
  createReport(
    @Param('patientId') patientId: string,
    @Body() body: any,
    @Request() req: RequestWithTenant,
  ) {
    const user = req.user as any;
    return this.oneHealthService.createReport(req.tenantId!, patientId, user?.userId ?? user?.id, body);
  }

  @Post('reports/:id/submit')
  submitToVetAuthority(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.oneHealthService.submitToVetAuthority(req.tenantId!, id);
  }

  @Get('patient/:patientId/reports')
  getReports(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.oneHealthService.getReports(req.tenantId!, patientId);
  }

  @Post('patient/:patientId/rabies-pep')
  startRabiesPep(
    @Param('patientId') patientId: string,
    @Body() body: any,
    @Request() req: RequestWithTenant,
  ) {
    const user = req.user as any;
    return this.oneHealthService.startRabiesPep(
      req.tenantId!,
      patientId,
      user?.userId ?? user?.id,
      body.exposureDate,
      body.protocol ?? 'essen',
      body.weightKg,
      body.facilityId,
    );
  }

  @Get('patient/:patientId/rabies-pep')
  getRabiesPepStatus(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.oneHealthService.getRabiesPepStatus(req.tenantId!, patientId);
  }

  @Post('cdss/zoonotic-assess')
  assessZoonotic(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.oneHealthService.assessZoonotic(req.tenantId!, body ?? {});
  }
}
