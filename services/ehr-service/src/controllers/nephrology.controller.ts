import { UseGuards, Controller, Get, Post, Patch, Body, Param, Req } from '@nestjs/common';
import { NephrologyService } from '../services/nephrology.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('nephrology')
@UseGuards(JwtAuthGuard)
export class NephrologyController {
  constructor(private readonly svc: NephrologyService) {}

  // ── CKD ────────────────────────────────────────────────────────────────────

  @Post('patient/:patientId/ckd')
  addCkd(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    const assessedBy = dto.assessedBy || (req.user as any)?.sub || (req.user as any)?.id;
    return this.svc.addCkdAssessment(req.tenantDb!, { ...dto, patientId, assessedBy });
  }

  @Get('patient/:patientId/ckd')
  getCkd(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getCkdAssessments(req.tenantDb!, patientId);
  }

  // ── Dialysis ───────────────────────────────────────────────────────────────

  @Post('patient/:patientId/dialysis')
  addDialysis(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addDialysisRecord(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/dialysis')
  getDialysis(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getDialysisRecords(req.tenantDb!, patientId);
  }

  @Patch('dialysis/:id')
  updateDialysis(@Req() req: RequestWithTenant, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateDialysisRecord(req.tenantDb!, id, dto);
  }

  // ── Fluid Balance ──────────────────────────────────────────────────────────

  @Post('patient/:patientId/fluid')
  addFluid(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addFluidBalance(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/fluid')
  getFluid(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getFluidBalance(req.tenantDb!, patientId);
  }

  // ── Biopsy ─────────────────────────────────────────────────────────────────

  @Post('patient/:patientId/biopsy')
  addBiopsy(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addBiopsy(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/biopsy')
  getBiopsies(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getBiopsies(req.tenantDb!, patientId);
  }

  // ── Transplant ─────────────────────────────────────────────────────────────

  @Post('patient/:patientId/transplant')
  addTransplant(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addTransplantRecord(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/transplant')
  getTransplant(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getTransplantRecords(req.tenantDb!, patientId);
  }

  @Patch('transplant/:id')
  updateTransplant(@Req() req: RequestWithTenant, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateTransplantRecord(req.tenantDb!, id, dto);
  }

  // ── CDSS ───────────────────────────────────────────────────────────────────

  @Post('cdss/ckd/stage')
  stageCkd(@Body() body: any) { return this.svc.stageCkd(body); }

  @Post('cdss/dialysis/adequacy')
  dialysisAdequacy(@Body() body: any) { return this.svc.assessDialysisAdequacy(body); }

  @Post('cdss/drug-dosing/renal-adjust')
  renalDrugDosing(@Body() body: any) { return this.svc.renalDrugDosing(body); }
}
