import { Controller, Get, Post, Patch, Body, Param, Headers } from '@nestjs/common';
import { PulmonologyService } from '../services/pulmonology.service';

@Controller('pulmonology')
export class PulmonologyController {
  constructor(private readonly svc: PulmonologyService) {}

  private tenant(h: Record<string, string>): string {
    return h['x-tenant-subdomain'] || 'default';
  }

  // ── Spirometry ─────────────────────────────────────────────────────────────

  @Post('patient/:patientId/spirometry')
  addSpirometry(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addSpirometry(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/spirometry')
  getSpirometry(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getSpirometryResults(this.tenant(h), patientId);
  }

  // ── COPD ───────────────────────────────────────────────────────────────────

  @Post('patient/:patientId/copd')
  addCopd(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addCopdAssessment(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/copd')
  getCopd(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getCopdAssessments(this.tenant(h), patientId);
  }

  @Patch('copd/:id')
  updateCopd(@Headers() h: Record<string, string>, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateCopdAssessment(this.tenant(h), id, dto);
  }

  // ── Asthma ─────────────────────────────────────────────────────────────────

  @Post('patient/:patientId/asthma')
  addAsthma(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addAsthmaRecord(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/asthma')
  getAsthma(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getAsthmaRecords(this.tenant(h), patientId);
  }

  @Patch('asthma/:id')
  updateAsthma(@Headers() h: Record<string, string>, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateAsthmaRecord(this.tenant(h), id, dto);
  }

  // ── Peak Flow ──────────────────────────────────────────────────────────────

  @Post('patient/:patientId/peak-flow')
  addPeakFlow(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addPeakFlow(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/peak-flow')
  getPeakFlow(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getPeakFlowDiary(this.tenant(h), patientId);
  }

  // ── Oxygen Therapy ─────────────────────────────────────────────────────────

  @Post('patient/:patientId/oxygen')
  addOxygen(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addOxygenTherapy(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/oxygen')
  getOxygen(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getOxygenTherapy(this.tenant(h), patientId);
  }

  @Patch('oxygen/:id')
  updateOxygen(@Headers() h: Record<string, string>, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateOxygenTherapy(this.tenant(h), id, dto);
  }

  // ── CDSS ───────────────────────────────────────────────────────────────────

  @Post('cdss/spirometry/interpret')
  interpretSpirometry(@Body() body: any) { return this.svc.interpretSpirometry(body); }

  @Post('cdss/asthma/stepup')
  asthmaStepUp(@Body() body: any) { return this.svc.asthmaStepUp(body); }

  @Post('cdss/oxygen/prescribe')
  prescribeOxygen(@Body() body: any) { return this.svc.prescribeOxygen(body); }
}
