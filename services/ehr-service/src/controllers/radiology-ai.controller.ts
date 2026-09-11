import { UseGuards, Controller, Post, Get, Patch, Body, Param, Req } from '@nestjs/common';
import { RadiologyAiService } from '../services/radiology-ai.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('radiology-ai')
@UseGuards(JwtAuthGuard)
export class RadiologyAiController {
  constructor(private readonly svc: RadiologyAiService) {}

  @Post('study')
  registerStudy(@Req() req: RequestWithTenant, @Body() dto: any) {
    return this.svc.registerStudy(req.tenantDb!, req.tenantId!, dto);
  }

  @Get('study/:id')
  getStudy(@Req() req: RequestWithTenant, @Param('id') id: string) {
    return this.svc.getStudy(req.tenantDb!, id);
  }

  @Get('patient/:patientId/studies')
  getStudies(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getStudiesForPatient(req.tenantDb!, patientId);
  }

  @Get('study/:id/findings')
  getFindingsForStudy(@Req() req: RequestWithTenant, @Param('id') studyId: string) {
    return this.svc.getFindingsForStudy(req.tenantDb!, studyId);
  }

  @Get('patient/:patientId/findings')
  getFindingsForPatient(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getFindingsForPatient(req.tenantDb!, patientId);
  }

  @Patch('finding/:id/review')
  radiologistReview(
    @Req() req: RequestWithTenant,
    @Param('id') id: string,
    @Body('notes') notes: string,
    @Body('reviewedBy') reviewedBy: string,
  ) {
    return this.svc.radiologistReview(req.tenantDb!, id, notes, reviewedBy);
  }
}
