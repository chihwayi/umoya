import { Controller, Get, Post, Patch, Body, Param, Headers } from '@nestjs/common';
import { NeurologyService } from '../services/neurology.service';

@Controller('neurology')
export class NeurologyController {
  constructor(private readonly svc: NeurologyService) {}

  private tenant(h: Record<string, string>): string {
    return h['x-tenant-subdomain'] || 'default';
  }

  // ── Seizures ───────────────────────────────────────────────────────────────

  @Post('patient/:patientId/seizures')
  addSeizure(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addSeizure(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/seizures')
  getSeizures(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getSeizures(this.tenant(h), patientId);
  }

  // ── Stroke ─────────────────────────────────────────────────────────────────

  @Post('patient/:patientId/stroke')
  addStroke(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addStrokeAssessment(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/stroke')
  getStrokes(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getStrokeAssessments(this.tenant(h), patientId);
  }

  @Patch('stroke/:id')
  updateStroke(@Headers() h: Record<string, string>, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateStrokeAssessment(this.tenant(h), id, dto);
  }

  // ── Headache Diary ─────────────────────────────────────────────────────────

  @Post('patient/:patientId/headache')
  addHeadache(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addHeadacheEntry(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/headache')
  getHeadaches(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getHeadacheDiary(this.tenant(h), patientId);
  }

  // ── Exam ───────────────────────────────────────────────────────────────────

  @Post('patient/:patientId/exam')
  addExam(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addExam(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/exam')
  getExams(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getExams(this.tenant(h), patientId);
  }

  // ── Cognitive ─────────────────────────────────────────────────────────────

  @Post('patient/:patientId/cognitive')
  addCognitive(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addCognitiveAssessment(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/cognitive')
  getCognitive(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getCognitiveAssessments(this.tenant(h), patientId);
  }

  // ── CDSS ───────────────────────────────────────────────────────────────────

  @Post('cdss/stroke/triage')
  triageStroke(@Body() body: any) { return this.svc.triageStroke(body); }

  @Post('cdss/seizure/classify')
  classifySeizure(@Body() body: any) { return this.svc.classifySeizure(body); }

  @Post('cdss/headache/diagnose')
  diagnoseHeadache(@Body() body: any) { return this.svc.diagnoseHeadache(body); }
}
