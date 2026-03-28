import { Controller, Get, Post, Patch, Body, Param, Headers } from '@nestjs/common';
import { PalliativeService } from '../services/palliative.service';

@Controller('palliative')
export class PalliativeController {
  constructor(private readonly svc: PalliativeService) {}

  private tenant(h: Record<string, string>): string {
    return h['x-tenant-subdomain'] || 'default';
  }

  @Post('patient/:patientId/assessment')
  addAssessment(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addAssessment(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/assessment')
  getAssessments(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getAssessments(this.tenant(h), patientId);
  }

  @Post('patient/:patientId/esas')
  addEsas(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addSymptomScore(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/esas')
  getEsas(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getSymptomScores(this.tenant(h), patientId);
  }

  @Post('patient/:patientId/goals')
  upsertGoals(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.upsertGoalsOfCare(this.tenant(h), patientId, dto);
  }

  @Get('patient/:patientId/goals')
  getActiveGoals(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getActiveGoalsOfCare(this.tenant(h), patientId);
  }

  @Get('patient/:patientId/goals/history')
  getGoalsHistory(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getGoalsOfCareHistory(this.tenant(h), patientId);
  }

  @Post('patient/:patientId/directive')
  addDirective(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addDirective(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/directive')
  getDirectives(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getDirectives(this.tenant(h), patientId);
  }

  @Patch('directive/:id')
  updateDirective(@Headers() h: Record<string, string>, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateDirective(this.tenant(h), id, dto);
  }

  @Post('patient/:patientId/med-review')
  addMedReview(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addMedReview(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/med-review')
  getMedReviews(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getMedReviews(this.tenant(h), patientId);
  }

  @Post('cdss/prognosis')
  prognosis(@Body() body: any) { return this.svc.calcPrognosis(body); }

  @Post('cdss/opioid/convert')
  opioidConvert(@Body() body: any) { return this.svc.convertOpioid(body); }

  @Post('cdss/symptom/manage')
  symptomManage(@Body() body: any) { return this.svc.manageSymptom(body); }
}
