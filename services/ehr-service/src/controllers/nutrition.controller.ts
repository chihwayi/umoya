import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { NutritionService } from '../services/nutrition.service';

@Controller('nutrition')
@UseGuards(JwtAuthGuard)
export class NutritionController {
  constructor(private readonly nutritionService: NutritionService) {}

  @Post('patient/:patientId/screening')
  addScreening(@Param('patientId') patientId: string, @Body() dto: any, @Request() req: RequestWithTenant) {
    return this.nutritionService.addScreening(req.tenantId, { ...dto, patientId });
  }

  @Get('patient/:patientId/screening')
  getScreenings(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.nutritionService.getScreenings(req.tenantId, patientId);
  }

  @Post('patient/:patientId/assessment')
  addLegacyAssessment(@Param('patientId') patientId: string, @Body() dto: any, @Request() req: RequestWithTenant) {
    return this.nutritionService.addAssessment(req.tenantId, { ...dto, patientId });
  }

  @Get('patient/:patientId/assessment')
  getLegacyAssessments(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.nutritionService.getLegacyAssessments(req.tenantId, patientId);
  }

  @Post('patient/:patientId/prescription')
  addPrescription(@Param('patientId') patientId: string, @Body() dto: any, @Request() req: RequestWithTenant) {
    return this.nutritionService.addPrescription(req.tenantId, { ...dto, patientId });
  }

  @Get('patient/:patientId/prescription')
  getPrescriptions(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.nutritionService.getPrescriptions(req.tenantId, patientId);
  }

  @Patch('prescription/:id')
  updatePrescription(@Param('id') id: string, @Body() dto: any, @Request() req: RequestWithTenant) {
    return this.nutritionService.updatePrescription(req.tenantId, id, dto);
  }

  @Post('patient/:patientId/monitoring')
  addMonitoring(@Param('patientId') patientId: string, @Body() dto: any, @Request() req: RequestWithTenant) {
    return this.nutritionService.addMonitoring(req.tenantId, { ...dto, patientId });
  }

  @Get('patient/:patientId/monitoring')
  getMonitoring(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.nutritionService.getMonitoring(req.tenantId, patientId);
  }

  @Post('assess')
  assess(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.nutritionService.assess(req.tenantId, req.user?.sub || req.user?.id, body);
  }

  @Get('assessments/:patientId')
  getAssessments(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.nutritionService.getAssessments(req.tenantId, patientId);
  }

  @Patch('assess/:id')
  updateAssessmentOutcome(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.nutritionService.updateAssessmentOutcome(req.tenantId, id, body);
  }

  @Post('rutf/dispense')
  dispenseRutf(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.nutritionService.dispenseRutf(req.tenantId, req.user?.sub || req.user?.id, body);
  }

  @Get('rutf/:patientId')
  getRutfHistory(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.nutritionService.getRutfHistory(req.tenantId, patientId);
  }

  @Post('feeding')
  recordFeeding(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.nutritionService.recordFeeding(req.tenantId, req.user?.sub || req.user?.id, body);
  }

  @Get('feeding/:patientId')
  getFeedingRecords(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.nutritionService.getFeedingRecords(req.tenantId, patientId);
  }

  @Get('cmam/otp-register')
  getOtpRegister(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Request() req: RequestWithTenant,
  ) {
    return this.nutritionService.getOtpRegister(req.tenantId, {
      from,
      to,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }

  @Get('cmam/sc-register')
  getScRegister(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Request() req: RequestWithTenant,
  ) {
    return this.nutritionService.getScRegister(req.tenantId, {
      from,
      to,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }

  @Get('cmam/tsfp-register')
  getTsfpRegister(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Request() req: RequestWithTenant,
  ) {
    return this.nutritionService.getTsfpRegister(req.tenantId, {
      from,
      to,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }

  @Get('cmam/reporting')
  getCmamReport(@Query('period') period: string, @Request() req: RequestWithTenant) {
    return this.nutritionService.getCmamReport(req.tenantId, period);
  }

  @Post('cdss/screen')
  cdssScreen(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.nutritionService.screenNutrition(body, req.tenantId, req.tenantDb);
  }

  @Post('cdss/prescribe')
  cdssPrescribe(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.nutritionService.prescribeNutrition(body, req.tenantId, req.tenantDb);
  }

  @Post('cdss/refeeding-risk')
  cdssRefeeding(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.nutritionService.refeedingRisk(body, req.tenantId, req.tenantDb);
  }

  // S233 — Post-discharge follow-up
  @Post('followup')
  recordFollowUpVisit(@Body() dto: any, @Request() req: RequestWithTenant) {
    return this.nutritionService.recordFollowUpVisit(req.tenantId, dto);
  }

  @Get('followup/:admissionId')
  getFollowUpVisits(@Param('admissionId') admissionId: string, @Request() req: RequestWithTenant) {
    return this.nutritionService.getFollowUpVisits(req.tenantId, admissionId);
  }

  @Post('relapse')
  recordRelapse(@Body() dto: any, @Request() req: RequestWithTenant) {
    return this.nutritionService.recordRelapse(req.tenantId, dto);
  }

  @Get('outcomes')
  getNutritionOutcomeSummary(@Query('period') period: string, @Request() req: RequestWithTenant) {
    return this.nutritionService.getNutritionOutcomeSummary(req.tenantId, period || new Date().toISOString().slice(0, 7).replace('-', ''));
  }

  @Get('followups-due')
  getFollowUpsDue(@Query('withinDays') withinDays: string, @Request() req: RequestWithTenant) {
    return this.nutritionService.getFollowUpsDue(req.tenantId, Number(withinDays) || 7);
  }
}
