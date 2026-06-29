import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { PopulationHealthService } from '../services/population-health.service';

@ApiTags('Population Health')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('population-health')
export class PopulationHealthController {
  constructor(private readonly populationHealthService: PopulationHealthService) {}

  @Post('registry')
  @ApiOperation({ summary: 'Enroll patient in chronic disease registry' })
  @ApiResponse({ status: 201, description: 'Enrolled' })
  async enrollInRegistry(
    @Body()
    body: {
      patientId: string;
      conditionCode: string;
      conditionName: string;
      conditionType: string;
      onsetDate?: string;
      status?: string;
      riskLevel?: string;
      nextReviewDate?: string;
      managementPlan?: string;
      notes?: string;
    },
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = req.tenantDb;
    return this.populationHealthService.enrollInRegistry(tenantDb, body.patientId, body);
  }

  @Get('registry')
  @ApiOperation({ summary: 'Get registry dashboard (totals by condition, risk, overdue, uncontrolled)' })
  @ApiResponse({ status: 200, description: 'Dashboard data' })
  async getRegistryDashboard(
    @Query('conditionType') conditionType?: string,
    @Query('riskLevel') riskLevel?: string,
    @Query('status') status?: string,
    @Req() req?: RequestWithTenant,
  ) {
    const tenantDb = req!.tenantDb;
    const filters = [conditionType, riskLevel, status].some(Boolean)
      ? { conditionType, riskLevel, status }
      : undefined;
    return this.populationHealthService.getRegistryDashboard(tenantDb, filters);
  }

  @Get('registry/patient/:id')
  @ApiOperation({ summary: 'Get registry entries for a patient' })
  @ApiResponse({ status: 200, description: 'Registry entries' })
  async getRegistryByPatient(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.populationHealthService.getRegistryByPatient(req.tenantDb, id);
  }

  @Get('preventive-care/:patientId')
  @ApiOperation({ summary: 'Get preventive care reminders for a patient' })
  @ApiResponse({ status: 200, description: 'Reminders' })
  async getPreventiveCareReminders(
    @Param('patientId') patientId: string,
    @Req() req: RequestWithTenant,
  ) {
    return this.populationHealthService.getPreventiveCareReminders(req.tenantDb, patientId);
  }

  @Get('worklist')
  @ApiOperation({ summary: 'Doctor population health worklist with risk, SLA and care-gap prioritization' })
  @ApiResponse({ status: 200, description: 'Worklist retrieved' })
  async getDoctorWorklist(
    @Query('includeResolved') includeResolved?: string,
    @Query('limit') limit?: string,
    @Query('focus') focus?: string,
    @Query('conditionType') conditionType?: string,
    @Query('riskLevel') riskLevel?: string,
    @Req() req?: RequestWithTenant,
  ) {
    const parsedLimit = Number(limit);
    return this.populationHealthService.getDoctorWorklist(req!.tenantDb, {
      includeResolved: String(includeResolved || '').toLowerCase() === 'true',
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      focus,
      conditionType,
      riskLevel,
    });
  }

  @Get('operational-brief')
  @ApiOperation({ summary: 'Get population-health operational brief for doctor handoff' })
  @ApiResponse({ status: 200, description: 'Operational brief retrieved' })
  async getOperationalBrief(
    @Query('includeResolved') includeResolved?: string,
    @Query('limit') limit?: string,
    @Query('focus') focus?: string,
    @Query('conditionType') conditionType?: string,
    @Query('riskLevel') riskLevel?: string,
    @Req() req?: RequestWithTenant,
  ) {
    const parsedLimit = Number(limit);
    return this.populationHealthService.getOperationalBrief(req!.tenantDb, {
      includeResolved: String(includeResolved || '').toLowerCase() === 'true',
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      focus,
      conditionType,
      riskLevel,
    });
  }

  @Post('preventive-care/generate')
  @ApiOperation({ summary: 'Generate preventive care reminders (optional patientId for single patient)' })
  @ApiResponse({ status: 200, description: 'Generated count' })
  async generatePreventiveCare(
    @Body() body: { patientId?: string },
    @Req() req: RequestWithTenant,
  ) {
    return this.populationHealthService.generatePreventiveCareReminders(
      req.tenantDb,
      body?.patientId,
    );
  }

  @Put('preventive-care/:id/status')
  @ApiOperation({ summary: 'Update preventive care reminder status' })
  @ApiResponse({ status: 200, description: 'Reminder updated' })
  async updatePreventiveReminderStatus(
    @Param('id') id: string,
    @Body() body: { status: string; notes?: string; completionDate?: string },
    @Req() req: RequestWithTenant,
  ) {
    return this.populationHealthService.updatePreventiveReminderStatus(req.tenantDb, id, body);
  }

  @Put('registry/:id/review')
  @ApiOperation({ summary: 'Record chronic disease registry review and optionally update status/risk/next review' })
  @ApiResponse({ status: 200, description: 'Registry review recorded' })
  async reviewRegistryEntry(
    @Param('id') id: string,
    @Body()
    body: {
      status?: string;
      riskLevel?: string;
      nextReviewDate?: string;
      reviewIntervalDays?: number;
      managementPlan?: string;
      reviewNote?: string;
    },
    @Req() req: RequestWithTenant,
  ) {
    return this.populationHealthService.recordRegistryReview(req.tenantDb, id, body ?? {});
  }

  @Post('recall-lists')
  @ApiOperation({ summary: 'Create a recall list' })
  @ApiResponse({ status: 201, description: 'Recall list created' })
  async createRecallList(
    @Body() body: { name: string; criteria: Record<string, any> },
    @Req() req: RequestWithTenant,
  ) {
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id ?? null;
    return this.populationHealthService.createRecallList(
      req.tenantDb,
      body.name,
      body.criteria ?? {},
      userId,
    );
  }

  @Get('recall-lists')
  @ApiOperation({ summary: 'List recall lists' })
  @ApiResponse({ status: 200, description: 'Recall lists' })
  async getRecallLists(@Req() req: RequestWithTenant) {
    return this.populationHealthService.getRecallLists(req.tenantDb);
  }

  @Post('recall-lists/:id/generate')
  @ApiOperation({ summary: 'Generate/refresh patient list for a recall list' })
  @ApiResponse({ status: 200, description: 'Patient IDs' })
  async generateRecallList(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.populationHealthService.generateRecallListPatients(req.tenantDb, id);
  }

  @Post('recall-lists/:id/notify')
  @ApiOperation({ summary: 'Bulk notify recall list (placeholder)' })
  @ApiResponse({ status: 200, description: 'Notify result' })
  async notifyRecallList(
    @Param('id') id: string,
    @Body() body: { channel?: 'sms' | 'email' },
    @Req() req: RequestWithTenant,
  ) {
    return this.populationHealthService.notifyRecallList(
      req.tenantDb,
      id,
      body?.channel ?? 'sms',
    );
  }

  // S235 — Care Gap endpoints
  @Post('gaps/upsert')
  upsertGap(@Body() dto: any, @Req() req: RequestWithTenant) {
    return this.populationHealthService.upsertCareGap(req.tenantDb, req.tenantId, dto.patient_id, dto.gap_type, dto.days_overdue, dto.clinical_context);
  }

  @Post('gaps/:gapId/interventions')
  recordIntervention(@Param('gapId') gapId: string, @Body() dto: any, @Req() req: RequestWithTenant) {
    return this.populationHealthService.recordGapIntervention(req.tenantDb, req.tenantId, gapId, dto);
  }

  @Post('gaps/close')
  closeGap(@Body() dto: any, @Req() req: RequestWithTenant) {
    return this.populationHealthService.closeGapForPatient(req.tenantDb, req.tenantId, dto.patient_id, dto.gap_type, dto.closure_method);
  }

  @Get('gaps/summary')
  getGapSummary(@Query('period') period: string, @Req() req: RequestWithTenant) {
    const p = period || new Date().toISOString().slice(0, 7).replace('-', '');
    return this.populationHealthService.getGapClosureSummary(req.tenantDb, req.tenantId, p);
  }

  @Get('gaps/priority')
  getHighPriorityGaps(@Query('limit') limit: string, @Req() req: RequestWithTenant) {
    return this.populationHealthService.getHighPriorityGaps(req.tenantDb, req.tenantId, Number(limit) || 50);
  }
}
