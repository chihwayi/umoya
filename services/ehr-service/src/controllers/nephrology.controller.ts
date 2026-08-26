import { UseGuards, Controller, Get, Post, Patch, Body, Param, Headers } from '@nestjs/common';
import { NephrologyService } from '../services/nephrology.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('nephrology')
@UseGuards(JwtAuthGuard)
export class NephrologyController {
  constructor(private readonly svc: NephrologyService) {}

  private tenant(h: Record<string, string>): string {
    return h['x-tenant-subdomain'] || 'default';
  }

  // ── CKD ────────────────────────────────────────────────────────────────────

  @Post('patient/:patientId/ckd')
  addCkd(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addCkdAssessment(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/ckd')
  getCkd(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getCkdAssessments(this.tenant(h), patientId);
  }

  // ── Dialysis ───────────────────────────────────────────────────────────────

  @Post('patient/:patientId/dialysis')
  addDialysis(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addDialysisRecord(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/dialysis')
  getDialysis(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getDialysisRecords(this.tenant(h), patientId);
  }

  @Patch('dialysis/:id')
  updateDialysis(@Headers() h: Record<string, string>, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateDialysisRecord(this.tenant(h), id, dto);
  }

  // ── Fluid Balance ──────────────────────────────────────────────────────────

  @Post('patient/:patientId/fluid')
  addFluid(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addFluidBalance(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/fluid')
  getFluid(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getFluidBalance(this.tenant(h), patientId);
  }

  // ── Biopsy ─────────────────────────────────────────────────────────────────

  @Post('patient/:patientId/biopsy')
  addBiopsy(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addBiopsy(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/biopsy')
  getBiopsies(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getBiopsies(this.tenant(h), patientId);
  }

  // ── Transplant ─────────────────────────────────────────────────────────────

  @Post('patient/:patientId/transplant')
  addTransplant(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addTransplantRecord(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/transplant')
  getTransplant(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getTransplantRecords(this.tenant(h), patientId);
  }

  @Patch('transplant/:id')
  updateTransplant(@Headers() h: Record<string, string>, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateTransplantRecord(this.tenant(h), id, dto);
  }

  // ── CDSS ───────────────────────────────────────────────────────────────────

  @Post('cdss/ckd/stage')
  stageCkd(@Body() body: any) { return this.svc.stageCkd(body); }

  @Post('cdss/dialysis/adequacy')
  dialysisAdequacy(@Body() body: any) { return this.svc.assessDialysisAdequacy(body); }

  @Post('cdss/drug-dosing/renal-adjust')
  renalDrugDosing(@Body() body: any) { return this.svc.renalDrugDosing(body); }
}
