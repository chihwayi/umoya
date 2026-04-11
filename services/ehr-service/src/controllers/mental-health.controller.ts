import { Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { MentalHealthService } from '../services/mental-health.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('mental-health')
@UseGuards(JwtAuthGuard)
export class MentalHealthController {
  constructor(private readonly mhService: MentalHealthService) {}

  // ── Screenings ─────────────────────────────────────────────────────────────

  @Post('patient/:patientId/screenings')
  addScreening(
    @Request() req: RequestWithTenant,
    @Param('patientId') patientId: string,
    @Body() dto: any,
  ) {
    return this.mhService.addScreening(req.tenantId!, { ...dto, patientId });
  }

  @Get('patient/:patientId/screenings')
  getScreenings(
    @Request() req: RequestWithTenant,
    @Param('patientId') patientId: string,
    @Query('tool') tool?: string,
  ) {
    return this.mhService.getScreenings(req.tenantId!, patientId, tool);
  }

  @Get('patient/:patientId/screenings/latest')
  getLatestScreening(
    @Request() req: RequestWithTenant,
    @Param('patientId') patientId: string,
    @Query('tool') tool: string,
  ) {
    return this.mhService.getLatestScreening(req.tenantId!, patientId, tool);
  }

  // ── Psychiatric Encounters ──────────────────────────────────────────────────

  @Post('patient/:patientId/encounters')
  addEncounter(
    @Request() req: RequestWithTenant,
    @Param('patientId') patientId: string,
    @Body() dto: any,
  ) {
    return this.mhService.addEncounter(req.tenantId!, { ...dto, patientId });
  }

  @Get('patient/:patientId/encounters')
  getEncounters(
    @Request() req: RequestWithTenant,
    @Param('patientId') patientId: string,
  ) {
    return this.mhService.getEncounters(req.tenantId!, patientId);
  }

  @Patch('encounters/:id')
  updateEncounter(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.mhService.updateEncounter(req.tenantId!, id, dto);
  }

  // ── Crisis Events ───────────────────────────────────────────────────────────

  @Post('patient/:patientId/crisis')
  addCrisisEvent(
    @Request() req: RequestWithTenant,
    @Param('patientId') patientId: string,
    @Body() dto: any,
  ) {
    return this.mhService.addCrisisEvent(req.tenantId!, { ...dto, patientId });
  }

  @Get('patient/:patientId/crisis')
  getCrisisEvents(
    @Request() req: RequestWithTenant,
    @Param('patientId') patientId: string,
  ) {
    return this.mhService.getCrisisEvents(req.tenantId!, patientId);
  }

  @Patch('crisis/:id')
  updateCrisisEvent(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.mhService.updateCrisisEvent(req.tenantId!, id, dto);
  }

  // ── Safe Plans ──────────────────────────────────────────────────────────────

  @Post('patient/:patientId/safe-plan')
  upsertSafePlan(
    @Request() req: RequestWithTenant,
    @Param('patientId') patientId: string,
    @Body() dto: any,
  ) {
    return this.mhService.upsertSafePlan(req.tenantId!, patientId, dto);
  }

  @Get('patient/:patientId/safe-plan')
  getActiveSafePlan(
    @Request() req: RequestWithTenant,
    @Param('patientId') patientId: string,
  ) {
    return this.mhService.getActiveSafePlan(req.tenantId!, patientId);
  }

  @Get('patient/:patientId/safe-plan/history')
  getSafePlanHistory(
    @Request() req: RequestWithTenant,
    @Param('patientId') patientId: string,
  ) {
    return this.mhService.getSafePlanHistory(req.tenantId!, patientId);
  }

  // ── Psychotropic Medications ────────────────────────────────────────────────

  @Post('patient/:patientId/medications')
  addMedication(
    @Request() req: RequestWithTenant,
    @Param('patientId') patientId: string,
    @Body() dto: any,
  ) {
    return this.mhService.addMedication(req.tenantId!, { ...dto, patientId });
  }

  @Get('patient/:patientId/medications')
  getMedications(
    @Request() req: RequestWithTenant,
    @Param('patientId') patientId: string,
    @Query('active') active?: string,
  ) {
    return this.mhService.getMedications(req.tenantId!, patientId, active === 'true');
  }

  @Patch('medications/:id')
  updateMedication(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.mhService.updateMedication(req.tenantId!, id, dto);
  }

  @Post('care-plans')
  createCarePlan(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.mhService.createCarePlan(req.tenantId!, req.user?.sub || req.user?.id || null, body);
  }

  @Get('care-plans/:patientId')
  getCarePlans(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.mhService.getCarePlans(req.tenantId!, patientId);
  }

  @Patch('care-plans/:id')
  updateCarePlan(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.mhService.updateCarePlan(req.tenantId!, id, body);
  }

  @Post('followups')
  recordFollowup(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.mhService.recordFollowup(req.tenantId!, req.user?.sub || req.user?.id || null, body);
  }

  @Get('followups/:patientId')
  getFollowups(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.mhService.getFollowups(req.tenantId!, patientId);
  }

  @Get('referral-pathway')
  getReferralPathway(@Request() req: RequestWithTenant) {
    return this.mhService.getReferralPathway(req.tenantId!);
  }

  // ── CDSS ────────────────────────────────────────────────────────────────────

  @Post('cdss/screen')
  scoreScreening(@Body() body: { tool: string; responses: Record<string, number> }) {
    return this.mhService.scoreScreening(body.tool, body.responses);
  }

  @Post('cdss/risk')
  assessSuicideRisk(@Body() body: any) {
    return this.mhService.assessSuicideRisk(body);
  }

  @Post('cdss/medication/monitor')
  monitorMedication(@Body() body: any) {
    return this.mhService.monitorMedication(body);
  }
}
