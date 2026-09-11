import { UseGuards, Controller, Get, Post, Patch, Body, Param, Req } from '@nestjs/common';
import { PalliativeService } from '../services/palliative.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('palliative')
@UseGuards(JwtAuthGuard)
export class PalliativeController {
  constructor(private readonly svc: PalliativeService) {}

  @Post('patient/:patientId/assessment')
  addAssessment(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addAssessment(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/assessment')
  getAssessments(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getAssessments(req.tenantDb!, patientId);
  }

  @Post('patient/:patientId/esas')
  addEsas(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addSymptomScore(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/esas')
  getEsas(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getSymptomScores(req.tenantDb!, patientId);
  }

  @Post('patient/:patientId/goals')
  upsertGoals(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.upsertGoalsOfCare(req.tenantDb!, patientId, dto);
  }

  @Get('patient/:patientId/goals')
  getActiveGoals(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getActiveGoalsOfCare(req.tenantDb!, patientId);
  }

  @Get('patient/:patientId/goals/history')
  getGoalsHistory(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getGoalsOfCareHistory(req.tenantDb!, patientId);
  }

  @Post('patient/:patientId/directive')
  addDirective(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addDirective(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/directive')
  getDirectives(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getDirectives(req.tenantDb!, patientId);
  }

  @Patch('directive/:id')
  updateDirective(@Req() req: RequestWithTenant, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateDirective(req.tenantDb!, id, dto);
  }

  @Post('patient/:patientId/med-review')
  addMedReview(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addMedReview(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/med-review')
  getMedReviews(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getMedReviews(req.tenantDb!, patientId);
  }

  @Post('cdss/prognosis')
  prognosis(@Body() body: any) { return this.svc.calcPrognosis(body); }

  @Post('cdss/opioid/convert')
  opioidConvert(@Body() body: any) { return this.svc.convertOpioid(body); }

  @Post('cdss/symptom/manage')
  symptomManage(@Body() body: any) { return this.svc.manageSymptom(body); }
}
