import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { OncologyService } from '../services/oncology.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Oncology')
@Controller('oncology')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OncologyController {
  constructor(private readonly oncologyService: OncologyService) {}

  @Get('cases')
  @ApiOperation({ summary: 'List oncology cases' })
  @ApiResponse({ status: 200, description: 'Oncology cases' })
  async listCases(
    @Request() req: RequestWithTenant,
    @Query('status') status?: string,
    @Query('patient_id') patientId?: string,
    @Query('oncologist_id') oncologistId?: string,
  ) {
    return this.oncologyService.listCases(req.tenantDb, { status, patientId, oncologistId });
  }

  @Get('cases/:id')
  @ApiOperation({ summary: 'Get oncology case detail with staging, regimens, infusions, adverse events, tumor board' })
  @ApiResponse({ status: 200, description: 'Oncology case detail' })
  async getCaseDetail(@Request() req: RequestWithTenant, @Param('id') caseId: string) {
    return this.oncologyService.getCaseDetail(req.tenantDb, caseId);
  }

  @Post('cases')
  @ApiOperation({ summary: 'Create oncology case' })
  @ApiResponse({ status: 201, description: 'Oncology case created' })
  async createCase(@Request() req: RequestWithTenant, @Body() body: any) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.oncologyService.createCase(req.tenantDb, body, userId);
  }

  @Patch('cases/:id')
  @ApiOperation({ summary: 'Update oncology case' })
  @ApiResponse({ status: 200, description: 'Oncology case updated' })
  async updateCase(@Request() req: RequestWithTenant, @Param('id') caseId: string, @Body() body: any) {
    return this.oncologyService.updateCase(req.tenantDb, caseId, body);
  }

  @Get('cases/:id/staging')
  @ApiOperation({ summary: 'List staging entries for a case' })
  @ApiResponse({ status: 200, description: 'Staging entries' })
  async listStaging(@Request() req: RequestWithTenant, @Param('id') caseId: string) {
    return this.oncologyService.listStagingEntries(req.tenantDb, caseId);
  }

  @Post('cases/:id/staging')
  @ApiOperation({ summary: 'Add staging entry for a case' })
  @ApiResponse({ status: 201, description: 'Staging entry created' })
  async addStaging(
    @Request() req: RequestWithTenant,
    @Param('id') caseId: string,
    @Body() body: any,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.oncologyService.addStagingEntry(req.tenantDb, caseId, body, userId);
  }

  @Get('cases/:id/regimens')
  @ApiOperation({ summary: 'List regimens for a case' })
  @ApiResponse({ status: 200, description: 'Regimens' })
  async listRegimens(@Request() req: RequestWithTenant, @Param('id') caseId: string) {
    return this.oncologyService.listRegimens(req.tenantDb, caseId);
  }

  @Post('cases/:id/regimens')
  @ApiOperation({ summary: 'Create regimen for a case' })
  @ApiResponse({ status: 201, description: 'Regimen created' })
  async createRegimen(
    @Request() req: RequestWithTenant,
    @Param('id') caseId: string,
    @Body() body: any,
  ) {
    return this.oncologyService.createRegimen(req.tenantDb, caseId, body);
  }

  @Patch('regimens/:id')
  @ApiOperation({ summary: 'Update regimen' })
  @ApiResponse({ status: 200, description: 'Regimen updated' })
  async updateRegimen(@Request() req: RequestWithTenant, @Param('id') regimenId: string, @Body() body: any) {
    return this.oncologyService.updateRegimen(req.tenantDb, regimenId, body);
  }

  @Get('regimens/:id/sessions')
  @ApiOperation({ summary: 'List infusion sessions for a regimen' })
  @ApiResponse({ status: 200, description: 'Infusion sessions' })
  async listInfusionSessions(@Request() req: RequestWithTenant, @Param('id') regimenId: string) {
    return this.oncologyService.listInfusionSessions(req.tenantDb, regimenId);
  }

  @Post('regimens/:id/sessions')
  @ApiOperation({ summary: 'Create infusion session for a regimen' })
  @ApiResponse({ status: 201, description: 'Infusion session created' })
  async createInfusionSession(
    @Request() req: RequestWithTenant,
    @Param('id') regimenId: string,
    @Body() body: any,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.oncologyService.createInfusionSession(req.tenantDb, regimenId, body, userId);
  }

  @Patch('sessions/:id')
  @ApiOperation({ summary: 'Update infusion session' })
  @ApiResponse({ status: 200, description: 'Infusion session updated' })
  async updateInfusionSession(@Request() req: RequestWithTenant, @Param('id') sessionId: string, @Body() body: any) {
    return this.oncologyService.updateInfusionSession(req.tenantDb, sessionId, body);
  }

  @Get('cases/:id/adverse-events')
  @ApiOperation({ summary: 'List adverse events for a case' })
  @ApiResponse({ status: 200, description: 'Adverse events' })
  async listAdverseEvents(@Request() req: RequestWithTenant, @Param('id') caseId: string) {
    return this.oncologyService.listAdverseEvents(req.tenantDb, caseId);
  }

  @Post('cases/:id/adverse-events')
  @ApiOperation({ summary: 'Record adverse event for a case' })
  @ApiResponse({ status: 201, description: 'Adverse event recorded' })
  async recordAdverseEvent(
    @Request() req: RequestWithTenant,
    @Param('id') caseId: string,
    @Body() body: any,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.oncologyService.recordAdverseEvent(req.tenantDb, caseId, body, userId);
  }

  @Get('tumor-board/meetings')
  @ApiOperation({ summary: 'List tumor board meetings' })
  @ApiResponse({ status: 200, description: 'Tumor board meetings' })
  async listTumorBoardMeetings(@Request() req: RequestWithTenant) {
    return this.oncologyService.listTumorBoardMeetings(req.tenantDb);
  }

  @Post('tumor-board/meetings')
  @ApiOperation({ summary: 'Create tumor board meeting' })
  @ApiResponse({ status: 201, description: 'Tumor board meeting created' })
  async createTumorBoardMeeting(@Request() req: RequestWithTenant, @Body() body: any) {
    return this.oncologyService.createTumorBoardMeeting(req.tenantDb, body);
  }

  @Post('tumor-board/meetings/:id/recommendations')
  @ApiOperation({ summary: 'Add tumor board recommendation' })
  @ApiResponse({ status: 201, description: 'Recommendation created' })
  async addTumorBoardRecommendation(
    @Request() req: RequestWithTenant,
    @Param('id') meetingId: string,
    @Body() body: any,
  ) {
    return this.oncologyService.addTumorBoardRecommendation(req.tenantDb, meetingId, body);
  }

  @Patch('tumor-board/recommendations/:id')
  @ApiOperation({ summary: 'Update tumor board recommendation' })
  @ApiResponse({ status: 200, description: 'Recommendation updated' })
  async updateTumorBoardRecommendation(
    @Request() req: RequestWithTenant,
    @Param('id') recommendationId: string,
    @Body() body: any,
  ) {
    return this.oncologyService.updateTumorBoardRecommendation(req.tenantDb, recommendationId, body);
  }

  @Get('dashboard/summary')
  @ApiOperation({ summary: 'Get oncology dashboard summary' })
  @ApiResponse({ status: 200, description: 'Dashboard summary' })
  async getDashboardSummary(@Request() req: RequestWithTenant) {
    return this.oncologyService.getDashboardSummary(req.tenantDb);
  }
}

