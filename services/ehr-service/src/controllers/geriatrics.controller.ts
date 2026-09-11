import { UseGuards, Controller, Get, Post, Patch, Body, Param, Req } from '@nestjs/common';
import { GeriatricsService } from '../services/geriatrics.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('geriatrics')
@UseGuards(JwtAuthGuard)
export class GeriatricsController {
  constructor(private readonly svc: GeriatricsService) {}

  // ── Geriatric Assessments ──────────────────────────────────────────────────

  @Post('patient/:patientId/assessments')
  addAssessment(
    @Req() req: RequestWithTenant,
    @Param('patientId') patientId: string,
    @Body() dto: any,
  ) {
    return this.svc.addAssessment(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/assessments')
  getAssessments(
    @Req() req: RequestWithTenant,
    @Param('patientId') patientId: string,
  ) {
    return this.svc.getAssessments(req.tenantDb!, patientId);
  }

  @Get('patient/:patientId/assessments/latest')
  getLatestAssessment(
    @Req() req: RequestWithTenant,
    @Param('patientId') patientId: string,
  ) {
    return this.svc.getLatestAssessment(req.tenantDb!, patientId);
  }

  // ── Falls ──────────────────────────────────────────────────────────────────

  @Post('patient/:patientId/falls')
  addFallsAssessment(
    @Req() req: RequestWithTenant,
    @Param('patientId') patientId: string,
    @Body() dto: any,
  ) {
    return this.svc.addFallsAssessment(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/falls')
  getFallsAssessments(
    @Req() req: RequestWithTenant,
    @Param('patientId') patientId: string,
  ) {
    return this.svc.getFallsAssessments(req.tenantDb!, patientId);
  }

  // ── Pressure Injury ────────────────────────────────────────────────────────

  @Post('patient/:patientId/pressure')
  addPressureAssessment(
    @Req() req: RequestWithTenant,
    @Param('patientId') patientId: string,
    @Body() dto: any,
  ) {
    return this.svc.addPressureAssessment(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/pressure')
  getPressureAssessments(
    @Req() req: RequestWithTenant,
    @Param('patientId') patientId: string,
  ) {
    return this.svc.getPressureAssessments(req.tenantDb!, patientId);
  }

  // ── Polypharmacy ───────────────────────────────────────────────────────────

  @Post('patient/:patientId/polypharmacy')
  addPolypharmacyReview(
    @Req() req: RequestWithTenant,
    @Param('patientId') patientId: string,
    @Body() dto: any,
  ) {
    return this.svc.addPolypharmacyReview(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/polypharmacy')
  getPolypharmacyReviews(
    @Req() req: RequestWithTenant,
    @Param('patientId') patientId: string,
  ) {
    return this.svc.getPolypharmacyReviews(req.tenantDb!, patientId);
  }

  // ── Advance Care Planning ──────────────────────────────────────────────────

  @Post('patient/:patientId/acp')
  addAcpDocument(
    @Req() req: RequestWithTenant,
    @Param('patientId') patientId: string,
    @Body() dto: any,
  ) {
    return this.svc.addAcpDocument(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/acp')
  getAcpDocuments(
    @Req() req: RequestWithTenant,
    @Param('patientId') patientId: string,
  ) {
    return this.svc.getAcpDocuments(req.tenantDb!, patientId);
  }

  @Patch('acp/:id')
  updateAcpDocument(
    @Req() req: RequestWithTenant,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.svc.updateAcpDocument(req.tenantDb!, id, dto);
  }

  // ── CDSS ───────────────────────────────────────────────────────────────────

  @Post('cdss/frailty')
  assessFrailty(@Body() body: any) {
    return this.svc.assessFrailty(body);
  }

  @Post('cdss/polypharmacy')
  checkPolypharmacy(@Body() body: any) {
    return this.svc.checkPolypharmacy(body);
  }

  @Post('cdss/fall-risk')
  assessFallRisk(@Body() body: any) {
    return this.svc.assessFallRisk(body);
  }
}
