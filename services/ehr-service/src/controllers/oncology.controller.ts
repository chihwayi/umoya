import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { OncologyService } from '../services/oncology.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import {
  CreateOncologyImagingFindingDto,
  CreateOncologyPathologyDto,
  CreateResponseAssessmentDto,
  UpdateOncologyBiomarkersDto,
  CalculateAssessmentRecistDto,
  CreateSurvivorshipPlanDto,
  UpdateSurvivorshipPlanDto,
  EnrollClinicalTrialDto,
  UpdateClinicalTrialStatusDto,
  RecordTrialComplianceDto,
  RecordPatientReportedOutcomeDto,
  ProHistoryQueryDto,
  RecordGenomicDataDto,
  RecordFinancialToxicityDto,
  OncologyAnalyticsQueryDto,
  OncologyAlertCheckDto,
} from '../dto/oncology.dto';

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

  @Post('cases/:id/imaging-findings')
  @ApiOperation({ summary: 'Record imaging finding' })
  async recordImagingFinding(
    @Request() req: RequestWithTenant,
    @Param('id') caseId: string,
    @Body() body: CreateOncologyImagingFindingDto,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.oncologyService.recordImagingFinding(req.tenantDb, caseId, body, userId);
  }

  @Get('cases/:id/imaging-findings')
  @ApiOperation({ summary: 'List imaging findings for a case' })
  async listImagingFindings(@Request() req: RequestWithTenant, @Param('id') caseId: string) {
    return this.oncologyService.getImagingFindings(req.tenantDb, caseId);
  }

  @Get('cases/:id/imaging-findings/timeline')
  @ApiOperation({ summary: 'Get imaging timeline for tumor measurements' })
  async imagingTimeline(@Request() req: RequestWithTenant, @Param('id') caseId: string) {
    return this.oncologyService.getImagingTimeline(req.tenantDb, caseId);
  }

  @Post('imaging-findings/:findingId/calculate-recist')
  @ApiOperation({ summary: 'Calculate RECIST response for an imaging finding' })
  async calculateRecist(
    @Request() req: RequestWithTenant,
    @Param('findingId') findingId: string,
  ) {
    return this.oncologyService.calculateRecistResponse(req.tenantDb, findingId);
  }

  @Post('cases/:id/response-assessments')
  @ApiOperation({ summary: 'Record treatment response assessment' })
  async createResponseAssessment(
    @Request() req: RequestWithTenant,
    @Param('id') caseId: string,
    @Body() body: CreateResponseAssessmentDto,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.oncologyService.recordResponseAssessment(req.tenantDb, caseId, body, userId);
  }

  @Get('cases/:id/response-assessments')
  @ApiOperation({ summary: 'List response assessments for a case' })
  async listResponseAssessments(@Request() req: RequestWithTenant, @Param('id') caseId: string) {
    return this.oncologyService.getResponseHistory(req.tenantDb, caseId);
  }

  @Post('cases/:caseId/response-assessments/:assessmentId/calculate-recist')
  @ApiOperation({ summary: 'Calculate RECIST based on target lesion change' })
  async calculateResponseRecist(
    @Request() req: RequestWithTenant,
    @Param('caseId') caseId: string,
    @Param('assessmentId') assessmentId: string,
    @Body() body: CalculateAssessmentRecistDto,
  ) {
    return this.oncologyService.calculateResponseAssessmentRecist(req.tenantDb, caseId, assessmentId, body);
  }

  @Get('cases/:id/best-response')
  @ApiOperation({ summary: 'Get best overall response summary' })
  async getBestResponse(@Request() req: RequestWithTenant, @Param('id') caseId: string) {
    return this.oncologyService.getBestOverallResponse(req.tenantDb, caseId);
  }

  @Get('cases/:id/survival-metrics')
  @ApiOperation({ summary: 'Get PFS/OS survival estimates' })
  async getSurvivalMetrics(@Request() req: RequestWithTenant, @Param('id') caseId: string) {
    return this.oncologyService.getSurvivalMetrics(req.tenantDb, caseId);
  }

  @Post('cases/:id/pathology')
  @ApiOperation({ summary: 'Record pathology and biomarker data' })
  async recordPathology(
    @Request() req: RequestWithTenant,
    @Param('id') caseId: string,
    @Body() body: CreateOncologyPathologyDto,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.oncologyService.recordPathology(req.tenantDb, caseId, body, userId);
  }

  @Get('cases/:id/pathology')
  @ApiOperation({ summary: 'Get latest pathology entry' })
  async getPathology(@Request() req: RequestWithTenant, @Param('id') caseId: string) {
    return this.oncologyService.getPathology(req.tenantDb, caseId);
  }

  @Patch('pathology/:pathologyId/biomarkers')
  @ApiOperation({ summary: 'Update biomarkers/genomics for a pathology record' })
  async updateBiomarkers(
    @Request() req: RequestWithTenant,
    @Param('pathologyId') pathologyId: string,
    @Body() body: UpdateOncologyBiomarkersDto,
  ) {
    return this.oncologyService.updatePathologyBiomarkers(req.tenantDb, pathologyId, body);
  }

  @Get('cases/:id/biomarkers')
  @ApiOperation({ summary: 'Get biomarker history for a case' })
  async biomarkerSummary(@Request() req: RequestWithTenant, @Param('id') caseId: string) {
    return this.oncologyService.getBiomarkerSummary(req.tenantDb, caseId);
  }

  @Post('cases/:id/survivorship-plan')
  @ApiOperation({ summary: 'Create or replace survivorship plan' })
  async createSurvivorshipPlan(
    @Request() req: RequestWithTenant,
    @Param('id') caseId: string,
    @Body() body: CreateSurvivorshipPlanDto,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.oncologyService.createSurvivorshipPlan(req.tenantDb, caseId, body, userId);
  }

  @Get('cases/:id/survivorship-plan')
  @ApiOperation({ summary: 'Get survivorship plan' })
  async getSurvivorshipPlan(@Request() req: RequestWithTenant, @Param('id') caseId: string) {
    return this.oncologyService.getSurvivorshipPlan(req.tenantDb, caseId);
  }

  @Patch('survivorship-plans/:planId')
  @ApiOperation({ summary: 'Update survivorship plan' })
  async updateSurvivorshipPlan(
    @Request() req: RequestWithTenant,
    @Param('planId') planId: string,
    @Body() body: UpdateSurvivorshipPlanDto,
  ) {
    return this.oncologyService.updateSurvivorshipPlan(req.tenantDb, planId, body);
  }

  @Get('cases/:id/follow-ups/upcoming')
  @ApiOperation({ summary: 'Upcoming survivorship follow-up events' })
  async upcomingFollowUps(@Request() req: RequestWithTenant, @Param('id') caseId: string) {
    return this.oncologyService.getUpcomingFollowUps(req.tenantDb, caseId);
  }

  @Get('cases/:id/survivorship-report')
  @ApiOperation({ summary: 'Generate survivorship care report' })
  async generateSurvivorshipReport(@Request() req: RequestWithTenant, @Param('id') caseId: string) {
    return this.oncologyService.generateSurvivorshipReport(req.tenantDb, caseId);
  }

  @Post('cases/:id/clinical-trials')
  @ApiOperation({ summary: 'Enroll patient in a clinical trial' })
  async enrollClinicalTrial(
    @Request() req: RequestWithTenant,
    @Param('id') caseId: string,
    @Body() body: EnrollClinicalTrialDto,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.oncologyService.enrollInTrial(req.tenantDb, caseId, body, userId);
  }

  @Get('cases/:id/clinical-trials')
  @ApiOperation({ summary: 'List clinical trial enrollments for case' })
  async listClinicalTrials(@Request() req: RequestWithTenant, @Param('id') caseId: string) {
    return this.oncologyService.getTrialHistory(req.tenantDb, caseId);
  }

  @Patch('clinical-trials/:trialId/status')
  @ApiOperation({ summary: 'Update clinical trial status' })
  async updateClinicalTrialStatus(
    @Request() req: RequestWithTenant,
    @Param('trialId') trialId: string,
    @Body() body: UpdateClinicalTrialStatusDto,
  ) {
    return this.oncologyService.updateTrialStatus(req.tenantDb, trialId, body);
  }

  @Post('clinical-trials/:trialId/compliance')
  @ApiOperation({ summary: 'Track trial protocol compliance' })
  async trackTrialCompliance(
    @Request() req: RequestWithTenant,
    @Param('trialId') trialId: string,
    @Body() body: RecordTrialComplianceDto,
  ) {
    return this.oncologyService.trackTrialCompliance(req.tenantDb, trialId, body);
  }

  @Get('clinical-trials/:trialId/endpoints')
  @ApiOperation({ summary: 'Get clinical trial endpoints' })
  async getTrialEndpoints(@Request() req: RequestWithTenant, @Param('trialId') trialId: string) {
    return this.oncologyService.getTrialEndpoints(req.tenantDb, trialId);
  }

  @Post('cases/:id/pros')
  @ApiOperation({ summary: 'Record patient reported outcome' })
  async recordPro(
    @Request() req: RequestWithTenant,
    @Param('id') caseId: string,
    @Body() body: RecordPatientReportedOutcomeDto,
  ) {
    return this.oncologyService.recordPatientReportedOutcome(req.tenantDb, caseId, body);
  }

  @Get('cases/:id/pros')
  @ApiOperation({ summary: 'Get patient reported outcome history' })
  async getProHistory(
    @Request() req: RequestWithTenant,
    @Param('id') caseId: string,
    @Query() query: ProHistoryQueryDto,
  ) {
    return this.oncologyService.getProHistory(req.tenantDb, caseId, query);
  }

  @Get('cases/:id/pros/trends')
  @ApiOperation({ summary: 'Get PRO trends over time' })
  async getProTrends(@Request() req: RequestWithTenant, @Param('id') caseId: string) {
    return this.oncologyService.getProTrends(req.tenantDb, caseId);
  }

  @Post('pros/:proId/calculate-scores')
  @ApiOperation({ summary: 'Calculate PRO score for record' })
  async calculateProScore(@Request() req: RequestWithTenant, @Param('proId') proId: string) {
    return this.oncologyService.calculateProScore(req.tenantDb, proId);
  }

  @Post('cases/:id/genomic-data')
  @ApiOperation({ summary: 'Record genomic data for pathology' })
  async recordGenomicData(
    @Request() req: RequestWithTenant,
    @Param('id') caseId: string,
    @Body() body: RecordGenomicDataDto,
  ) {
    return this.oncologyService.recordGenomicData(req.tenantDb, caseId, body);
  }

  @Get('cases/:id/genomic-summary')
  @ApiOperation({ summary: 'Get genomic summary for case' })
  async getGenomicSummary(@Request() req: RequestWithTenant, @Param('id') caseId: string) {
    return this.oncologyService.getGenomicSummary(req.tenantDb, caseId);
  }

  @Get('cases/:id/targeted-therapies')
  @ApiOperation({ summary: 'Suggest targeted therapies based on genomics' })
  async getTargetedTherapies(@Request() req: RequestWithTenant, @Param('id') caseId: string) {
    return this.oncologyService.matchTargetedTherapies(req.tenantDb, caseId);
  }

  @Get('analytics/response-rates')
  @ApiOperation({ summary: 'Aggregate response rates across cases' })
  async getResponseAnalytics(@Request() req: RequestWithTenant, @Query() query: OncologyAnalyticsQueryDto) {
    return this.oncologyService.getResponseRates(req.tenantDb, query);
  }

  @Get('analytics/survival')
  @ApiOperation({ summary: 'Aggregate survival metrics across cases' })
  async getSurvivalAnalytics(@Request() req: RequestWithTenant, @Query() query: OncologyAnalyticsQueryDto) {
    return this.oncologyService.getSurvivalAnalytics(req.tenantDb, query);
  }

  @Get('analytics/biomarkers')
  @ApiOperation({ summary: 'Aggregate biomarker/genomic analytics' })
  async getBiomarkerAnalytics(@Request() req: RequestWithTenant, @Query() query: OncologyAnalyticsQueryDto) {
    return this.oncologyService.getBiomarkerAnalytics(req.tenantDb, query);
  }

  @Get('analytics/trials')
  @ApiOperation({ summary: 'Clinical trial analytics' })
  async getTrialAnalytics(@Request() req: RequestWithTenant, @Query() query: OncologyAnalyticsQueryDto) {
    return this.oncologyService.getTrialAnalytics(req.tenantDb, query);
  }

  @Post('cases/:id/financial-toxicity')
  @ApiOperation({ summary: 'Record financial toxicity assessment' })
  async recordFinancialToxicity(
    @Request() req: RequestWithTenant,
    @Param('id') caseId: string,
    @Body() body: RecordFinancialToxicityDto,
  ) {
    return this.oncologyService.trackFinancialToxicity(req.tenantDb, caseId, body);
  }

  @Get('cases/:id/financial-summary')
  @ApiOperation({ summary: 'Get financial toxicity summary' })
  async getFinancialSummary(@Request() req: RequestWithTenant, @Param('id') caseId: string) {
    return this.oncologyService.getFinancialSummary(req.tenantDb, caseId);
  }

  @Get('cases/:id/financial-assistance')
  @ApiOperation({ summary: 'Get financial assistance programs' })
  async getFinancialAssistance(@Request() req: RequestWithTenant, @Param('id') caseId: string) {
    return this.oncologyService.getFinancialAssistancePrograms(req.tenantDb, caseId);
  }

  @Get('cases/:id/treatment-recommendations')
  @ApiOperation({ summary: 'Generate treatment recommendations for a case' })
  async getTreatmentRecommendations(@Request() req: RequestWithTenant, @Param('id') caseId: string) {
    return this.oncologyService.generateTreatmentRecommendations(req.tenantDb, caseId);
  }

  @Get('cases/:id/protocol-bundle')
  @ApiOperation({ summary: 'Generate executable oncology doctor protocol bundle for a case' })
  async getProtocolBundle(@Request() req: RequestWithTenant, @Param('id') caseId: string) {
    return this.oncologyService.getProtocolAutomationBundle(req.tenantDb, caseId);
  }

  @Post('cases/:id/protocol-bundle/actions/:actionId/execute')
  @ApiOperation({ summary: 'Execute an oncology doctor protocol bundle action' })
  async executeProtocolBundleAction(
    @Request() req: RequestWithTenant,
    @Param('id') caseId: string,
    @Param('actionId') actionId: string,
    @Body() body: { note?: string; actionPayload?: any },
  ) {
    const requestUser = (req.user as any) || {};
    const user = {
      id: requestUser.id || requestUser.userId,
      fullName: requestUser.fullName || requestUser.name,
      firstName: requestUser.firstName,
      lastName: requestUser.lastName,
      email: requestUser.email,
    };
    return this.oncologyService.executeProtocolBundleAction(
      req.tenantDb,
      caseId,
      actionId,
      user,
      body || {},
    );
  }

  @Get('cases/:id/surveillance-reminders')
  @ApiOperation({ summary: 'Generate surveillance reminders' })
  async getSurveillanceReminders(@Request() req: RequestWithTenant, @Param('id') caseId: string) {
    return this.oncologyService.generateSurveillanceReminders(req.tenantDb, caseId);
  }

  @Post('cases/:id/check-alerts')
  @ApiOperation({ summary: 'Run CDS alert checks (response/surveillance/toxicity)' })
  async checkCaseAlerts(
    @Request() req: RequestWithTenant,
    @Param('id') caseId: string,
    @Body() body: OncologyAlertCheckDto,
  ) {
    return this.oncologyService.checkCaseAlerts(req.tenantDb, caseId, body);
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

  @Get('mobile/protocol-snapshot')
  @ApiOperation({ summary: 'Get a compact oncology protocol snapshot for mobile clinician workflows' })
  @ApiResponse({ status: 200, description: 'Mobile oncology protocol snapshot' })
  async getMobileProtocolSnapshot(@Request() req: RequestWithTenant) {
    return this.oncologyService.getMobileProtocolSnapshot(req.tenantDb);
  }
}
