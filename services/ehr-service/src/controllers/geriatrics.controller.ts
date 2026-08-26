import { UseGuards, Controller, Get, Post, Patch, Body, Param, Headers } from '@nestjs/common';
import { GeriatricsService } from '../services/geriatrics.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('geriatrics')
@UseGuards(JwtAuthGuard)
export class GeriatricsController {
  constructor(private readonly svc: GeriatricsService) {}

  private tenant(h: Record<string, string>): string {
    return h['x-tenant-subdomain'] || 'default';
  }

  // ── Geriatric Assessments ──────────────────────────────────────────────────

  @Post('patient/:patientId/assessments')
  addAssessment(
    @Headers() h: Record<string, string>,
    @Param('patientId') patientId: string,
    @Body() dto: any,
  ) {
    return this.svc.addAssessment(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/assessments')
  getAssessments(
    @Headers() h: Record<string, string>,
    @Param('patientId') patientId: string,
  ) {
    return this.svc.getAssessments(this.tenant(h), patientId);
  }

  @Get('patient/:patientId/assessments/latest')
  getLatestAssessment(
    @Headers() h: Record<string, string>,
    @Param('patientId') patientId: string,
  ) {
    return this.svc.getLatestAssessment(this.tenant(h), patientId);
  }

  // ── Falls ──────────────────────────────────────────────────────────────────

  @Post('patient/:patientId/falls')
  addFallsAssessment(
    @Headers() h: Record<string, string>,
    @Param('patientId') patientId: string,
    @Body() dto: any,
  ) {
    return this.svc.addFallsAssessment(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/falls')
  getFallsAssessments(
    @Headers() h: Record<string, string>,
    @Param('patientId') patientId: string,
  ) {
    return this.svc.getFallsAssessments(this.tenant(h), patientId);
  }

  // ── Pressure Injury ────────────────────────────────────────────────────────

  @Post('patient/:patientId/pressure')
  addPressureAssessment(
    @Headers() h: Record<string, string>,
    @Param('patientId') patientId: string,
    @Body() dto: any,
  ) {
    return this.svc.addPressureAssessment(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/pressure')
  getPressureAssessments(
    @Headers() h: Record<string, string>,
    @Param('patientId') patientId: string,
  ) {
    return this.svc.getPressureAssessments(this.tenant(h), patientId);
  }

  // ── Polypharmacy ───────────────────────────────────────────────────────────

  @Post('patient/:patientId/polypharmacy')
  addPolypharmacyReview(
    @Headers() h: Record<string, string>,
    @Param('patientId') patientId: string,
    @Body() dto: any,
  ) {
    return this.svc.addPolypharmacyReview(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/polypharmacy')
  getPolypharmacyReviews(
    @Headers() h: Record<string, string>,
    @Param('patientId') patientId: string,
  ) {
    return this.svc.getPolypharmacyReviews(this.tenant(h), patientId);
  }

  // ── Advance Care Planning ──────────────────────────────────────────────────

  @Post('patient/:patientId/acp')
  addAcpDocument(
    @Headers() h: Record<string, string>,
    @Param('patientId') patientId: string,
    @Body() dto: any,
  ) {
    return this.svc.addAcpDocument(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/acp')
  getAcpDocuments(
    @Headers() h: Record<string, string>,
    @Param('patientId') patientId: string,
  ) {
    return this.svc.getAcpDocuments(this.tenant(h), patientId);
  }

  @Patch('acp/:id')
  updateAcpDocument(
    @Headers() h: Record<string, string>,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.svc.updateAcpDocument(this.tenant(h), id, dto);
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
