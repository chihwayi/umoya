import { UseGuards, Controller, Get, Post, Patch, Body, Param, Req } from '@nestjs/common';
import { NeurologyService } from '../services/neurology.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('neurology')
@UseGuards(JwtAuthGuard)
export class NeurologyController {
  constructor(private readonly svc: NeurologyService) {}

  // ── Seizures ───────────────────────────────────────────────────────────────

  @Post('patient/:patientId/seizures')
  addSeizure(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addSeizure(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/seizures')
  getSeizures(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getSeizures(req.tenantDb!, patientId);
  }

  // ── Stroke ─────────────────────────────────────────────────────────────────

  @Post('patient/:patientId/stroke')
  addStroke(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addStrokeAssessment(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/stroke')
  getStrokes(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getStrokeAssessments(req.tenantDb!, patientId);
  }

  @Patch('stroke/:id')
  updateStroke(@Req() req: RequestWithTenant, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateStrokeAssessment(req.tenantDb!, id, dto);
  }

  // ── Headache Diary ─────────────────────────────────────────────────────────

  @Post('patient/:patientId/headache')
  addHeadache(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addHeadacheEntry(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/headache')
  getHeadaches(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getHeadacheDiary(req.tenantDb!, patientId);
  }

  // ── Exam ───────────────────────────────────────────────────────────────────

  @Post('patient/:patientId/exam')
  addExam(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addExam(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/exam')
  getExams(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getExams(req.tenantDb!, patientId);
  }

  // ── Cognitive ─────────────────────────────────────────────────────────────

  @Post('patient/:patientId/cognitive')
  addCognitive(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addCognitiveAssessment(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/cognitive')
  getCognitive(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getCognitiveAssessments(req.tenantDb!, patientId);
  }

  // ── CDSS ───────────────────────────────────────────────────────────────────

  @Post('cdss/stroke/triage')
  triageStroke(@Body() body: any) { return this.svc.triageStroke(body); }

  @Post('cdss/seizure/classify')
  classifySeizure(@Body() body: any) { return this.svc.classifySeizure(body); }

  @Post('cdss/headache/diagnose')
  diagnoseHeadache(@Body() body: any) { return this.svc.diagnoseHeadache(body); }
}
