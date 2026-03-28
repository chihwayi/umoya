import { Controller, Get, Post, Patch, Body, Param, Query, Headers } from '@nestjs/common';
import { MentalHealthService } from '../services/mental-health.service';

@Controller('mental-health')
export class MentalHealthController {
  constructor(private readonly mhService: MentalHealthService) {}

  private tenant(headers: Record<string, string>): string {
    return headers['x-tenant-subdomain'] || 'default';
  }

  // ── Screenings ─────────────────────────────────────────────────────────────

  @Post('patient/:patientId/screenings')
  addScreening(
    @Headers() headers: Record<string, string>,
    @Param('patientId') patientId: string,
    @Body() dto: any,
  ) {
    return this.mhService.addScreening(this.tenant(headers), { ...dto, patientId });
  }

  @Get('patient/:patientId/screenings')
  getScreenings(
    @Headers() headers: Record<string, string>,
    @Param('patientId') patientId: string,
    @Query('tool') tool?: string,
  ) {
    return this.mhService.getScreenings(this.tenant(headers), patientId, tool);
  }

  @Get('patient/:patientId/screenings/latest')
  getLatestScreening(
    @Headers() headers: Record<string, string>,
    @Param('patientId') patientId: string,
    @Query('tool') tool: string,
  ) {
    return this.mhService.getLatestScreening(this.tenant(headers), patientId, tool);
  }

  // ── Psychiatric Encounters ──────────────────────────────────────────────────

  @Post('patient/:patientId/encounters')
  addEncounter(
    @Headers() headers: Record<string, string>,
    @Param('patientId') patientId: string,
    @Body() dto: any,
  ) {
    return this.mhService.addEncounter(this.tenant(headers), { ...dto, patientId });
  }

  @Get('patient/:patientId/encounters')
  getEncounters(
    @Headers() headers: Record<string, string>,
    @Param('patientId') patientId: string,
  ) {
    return this.mhService.getEncounters(this.tenant(headers), patientId);
  }

  @Patch('encounters/:id')
  updateEncounter(
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.mhService.updateEncounter(this.tenant(headers), id, dto);
  }

  // ── Crisis Events ───────────────────────────────────────────────────────────

  @Post('patient/:patientId/crisis')
  addCrisisEvent(
    @Headers() headers: Record<string, string>,
    @Param('patientId') patientId: string,
    @Body() dto: any,
  ) {
    return this.mhService.addCrisisEvent(this.tenant(headers), { ...dto, patientId });
  }

  @Get('patient/:patientId/crisis')
  getCrisisEvents(
    @Headers() headers: Record<string, string>,
    @Param('patientId') patientId: string,
  ) {
    return this.mhService.getCrisisEvents(this.tenant(headers), patientId);
  }

  @Patch('crisis/:id')
  updateCrisisEvent(
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.mhService.updateCrisisEvent(this.tenant(headers), id, dto);
  }

  // ── Safe Plans ──────────────────────────────────────────────────────────────

  @Post('patient/:patientId/safe-plan')
  upsertSafePlan(
    @Headers() headers: Record<string, string>,
    @Param('patientId') patientId: string,
    @Body() dto: any,
  ) {
    return this.mhService.upsertSafePlan(this.tenant(headers), patientId, dto);
  }

  @Get('patient/:patientId/safe-plan')
  getActiveSafePlan(
    @Headers() headers: Record<string, string>,
    @Param('patientId') patientId: string,
  ) {
    return this.mhService.getActiveSafePlan(this.tenant(headers), patientId);
  }

  @Get('patient/:patientId/safe-plan/history')
  getSafePlanHistory(
    @Headers() headers: Record<string, string>,
    @Param('patientId') patientId: string,
  ) {
    return this.mhService.getSafePlanHistory(this.tenant(headers), patientId);
  }

  // ── Psychotropic Medications ────────────────────────────────────────────────

  @Post('patient/:patientId/medications')
  addMedication(
    @Headers() headers: Record<string, string>,
    @Param('patientId') patientId: string,
    @Body() dto: any,
  ) {
    return this.mhService.addMedication(this.tenant(headers), { ...dto, patientId });
  }

  @Get('patient/:patientId/medications')
  getMedications(
    @Headers() headers: Record<string, string>,
    @Param('patientId') patientId: string,
    @Query('active') active?: string,
  ) {
    return this.mhService.getMedications(this.tenant(headers), patientId, active === 'true');
  }

  @Patch('medications/:id')
  updateMedication(
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.mhService.updateMedication(this.tenant(headers), id, dto);
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
