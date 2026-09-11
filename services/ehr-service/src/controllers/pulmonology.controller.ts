import { UseGuards, Controller, Get, Post, Patch, Body, Param, Req } from '@nestjs/common';
import { PulmonologyService } from '../services/pulmonology.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('pulmonology')
@UseGuards(JwtAuthGuard)
export class PulmonologyController {
  constructor(private readonly svc: PulmonologyService) {}

  // ── Spirometry ─────────────────────────────────────────────────────────────

  @Post('patient/:patientId/spirometry')
  addSpirometry(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addSpirometry(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/spirometry')
  getSpirometry(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getSpirometryResults(req.tenantDb!, patientId);
  }

  // ── COPD ───────────────────────────────────────────────────────────────────

  @Post('patient/:patientId/copd')
  addCopd(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addCopdAssessment(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/copd')
  getCopd(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getCopdAssessments(req.tenantDb!, patientId);
  }

  @Patch('copd/:id')
  updateCopd(@Req() req: RequestWithTenant, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateCopdAssessment(req.tenantDb!, id, dto);
  }

  // ── Asthma ─────────────────────────────────────────────────────────────────

  @Post('patient/:patientId/asthma')
  addAsthma(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addAsthmaRecord(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/asthma')
  getAsthma(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getAsthmaRecords(req.tenantDb!, patientId);
  }

  @Patch('asthma/:id')
  updateAsthma(@Req() req: RequestWithTenant, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateAsthmaRecord(req.tenantDb!, id, dto);
  }

  // ── Peak Flow ──────────────────────────────────────────────────────────────

  @Post('patient/:patientId/peak-flow')
  addPeakFlow(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addPeakFlow(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/peak-flow')
  getPeakFlow(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getPeakFlowDiary(req.tenantDb!, patientId);
  }

  // ── Oxygen Therapy ─────────────────────────────────────────────────────────

  @Post('patient/:patientId/oxygen')
  addOxygen(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addOxygenTherapy(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/oxygen')
  getOxygen(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getOxygenTherapy(req.tenantDb!, patientId);
  }

  @Patch('oxygen/:id')
  updateOxygen(@Req() req: RequestWithTenant, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateOxygenTherapy(req.tenantDb!, id, dto);
  }

  // ── CDSS ───────────────────────────────────────────────────────────────────

  @Post('cdss/spirometry/interpret')
  interpretSpirometry(@Body() body: any) { return this.svc.interpretSpirometry(body); }

  @Post('cdss/asthma/stepup')
  asthmaStepUp(@Body() body: any) { return this.svc.asthmaStepUp(body); }

  @Post('cdss/oxygen/prescribe')
  prescribeOxygen(@Body() body: any) { return this.svc.prescribeOxygen(body); }
}
