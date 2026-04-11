import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { HypertensionService } from '../services/hypertension.service';
import { CdssService } from '../services/cdss.service';

@Controller('hypertension')
@UseGuards(JwtAuthGuard)
export class HypertensionController {
  constructor(
    private readonly hypertensionService: HypertensionService,
    private readonly cdssService: CdssService,
  ) {}

  // ── HTN Register ────────────────────────────────────────────────────────

  @Post('patient/:patientId/register')
  enroll(
    @Param('patientId') patientId: string,
    @Body() body: any,
    @Request() req: RequestWithTenant,
  ) {
    return this.hypertensionService.enroll(
      req.tenantId!,
      req.user?.sub || req.user?.id || null,
      { ...body, patientId },
    );
  }

  @Get('patient/:patientId/register')
  getRegisterEntry(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.hypertensionService.getRegisterEntry(req.tenantId!, patientId);
  }

  @Patch('register/:id')
  updateRegisterEntry(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: RequestWithTenant,
  ) {
    return this.hypertensionService.updateRegisterEntry(req.tenantId!, id, body);
  }

  // ── BP Readings ─────────────────────────────────────────────────────────

  @Post('patient/:patientId/bp')
  recordBp(
    @Param('patientId') patientId: string,
    @Body() body: any,
    @Request() req: RequestWithTenant,
  ) {
    return this.hypertensionService.recordBp(
      req.tenantId!,
      req.user?.sub || req.user?.id || null,
      { ...body, patientId },
    );
  }

  @Get('patient/:patientId/bp')
  getBpHistory(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.hypertensionService.getBpHistory(req.tenantId!, patientId);
  }

  // ── Treatment Reviews ───────────────────────────────────────────────────

  @Post('patient/:patientId/reviews')
  recordReview(
    @Param('patientId') patientId: string,
    @Body() body: any,
    @Request() req: RequestWithTenant,
  ) {
    return this.hypertensionService.recordReview(
      req.tenantId!,
      req.user?.sub || req.user?.id || null,
      { ...body, patientId },
    );
  }

  @Get('patient/:patientId/reviews')
  getReviews(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.hypertensionService.getReviews(req.tenantId!, patientId);
  }

  // ── CDSS ────────────────────────────────────────────────────────────────

  @Post('cdss/step-therapy')
  getStepTherapy(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.cdssService.htnStepTherapy(body, req.tenantId);
  }

  @Post('cdss/cvd-risk')
  getCvdRisk(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.cdssService.htnCvdRisk(body, req.tenantId);
  }
}
