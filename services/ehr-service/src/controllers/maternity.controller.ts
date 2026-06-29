import { Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { MaternityService } from '../services/maternity.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { OutcomeLinkageService } from '../services/outcome-linkage.service';

@ApiTags('Maternity & Obstetrics')
@Controller('maternity')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MaternityController {
  constructor(
    private readonly maternityService: MaternityService,
    private readonly outcomeLinkage: OutcomeLinkageService,
  ) {}

  // ===== ENROLLMENTS =====

  @Post('enrollments')
  @ApiOperation({ summary: 'Enroll patient in maternity care' })
  @ApiResponse({ status: 201, description: 'Patient enrolled successfully' })
  async createEnrollment(
    @Request() req: RequestWithTenant,
    @Body() enrollmentData: any,
  ) {
    const userId = req.user?.userId;
    return this.maternityService.createEnrollment(req.tenantDb, enrollmentData, userId);
  }

  @Get('enrollments')
  @ApiOperation({ summary: 'Get all maternity enrollments' })
  @ApiResponse({ status: 200, description: 'List of enrollments' })
  async getEnrollments(
    @Request() req: RequestWithTenant,
    @Query('status') status?: string,
    @Query('risk_category') riskCategory?: string,
  ) {
    return this.maternityService.getEnrollments(req.tenantDb, { status, riskCategory });
  }

  @Get('enrollments/:id')
  @ApiOperation({ summary: 'Get enrollment details' })
  @ApiResponse({ status: 200, description: 'Enrollment details with full pregnancy history' })
  async getEnrollmentById(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
  ) {
    return this.maternityService.getEnrollmentById(req.tenantDb, id);
  }

  @Get('enrollments/patient/:patientId')
  @ApiOperation({ summary: 'Get patient maternity history' })
  @ApiResponse({ status: 200, description: 'Patient maternity history' })
  async getPatientMaternityHistory(
    @Request() req: RequestWithTenant,
    @Param('patientId') patientId: string,
  ) {
    return this.maternityService.getPatientMaternityHistory(req.tenantDb, patientId);
  }

  @Patch('enrollments/:id')
  @ApiOperation({ summary: 'Update enrollment' })
  @ApiResponse({ status: 200, description: 'Enrollment updated successfully' })
  async updateEnrollment(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
    @Body() enrollmentData: any,
  ) {
    return this.maternityService.updateEnrollment(req.tenantDb, id, enrollmentData);
  }

  // ===== ANC VISITS =====

  @Post('anc-visits/precheck')
  @ApiOperation({ summary: 'Precheck ANC visit against maternity safety rules' })
  @ApiResponse({ status: 200, description: 'ANC precheck results' })
  async precheckANCVisit(
    @Request() req: RequestWithTenant,
    @Body() visitData: any,
  ) {
    return this.maternityService.precheckANCVisit(req.tenantDb, visitData);
  }

  @Post('anc-visits')
  @ApiOperation({ summary: 'Record ANC visit' })
  @ApiResponse({ status: 201, description: 'ANC visit recorded successfully' })
  async createANCVisit(
    @Request() req: RequestWithTenant,
    @Body() visitData: any,
  ) {
    const userId = req.user?.userId;
    return this.maternityService.createANCVisit(req.tenantDb, visitData, userId);
  }

  @Get('anc-visits/enrollment/:enrollmentId')
  @ApiOperation({ summary: 'Get all ANC visits for enrollment' })
  @ApiResponse({ status: 200, description: 'ANC visit history' })
  async getEnrollmentANCVisits(
    @Request() req: RequestWithTenant,
    @Param('enrollmentId') enrollmentId: string,
  ) {
    return this.maternityService.getEnrollmentANCVisits(req.tenantDb, enrollmentId);
  }

  @Get('anc-visits/:id')
  @ApiOperation({ summary: 'Get ANC visit details' })
  @ApiResponse({ status: 200, description: 'ANC visit details' })
  async getANCVisitById(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
  ) {
    return this.maternityService.getANCVisitById(req.tenantDb, id);
  }

  @Patch('anc-visits/:id')
  @ApiOperation({ summary: 'Update ANC visit' })
  @ApiResponse({ status: 200, description: 'ANC visit updated successfully' })
  async updateANCVisit(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
    @Body() visitData: any,
  ) {
    return this.maternityService.updateANCVisit(req.tenantDb, id, visitData);
  }

  // ===== ULTRASOUND SCANS =====

  @Post('ultrasound-scans')
  @ApiOperation({ summary: 'Record ultrasound scan' })
  @ApiResponse({ status: 201, description: 'Ultrasound scan recorded successfully' })
  async createUltrasoundScan(
    @Request() req: RequestWithTenant,
    @Body() scanData: any,
  ) {
    const userId = req.user?.userId;
    return this.maternityService.createUltrasoundScan(req.tenantDb, scanData, userId);
  }

  @Get('ultrasound-scans/enrollment/:enrollmentId')
  @ApiOperation({ summary: 'Get all ultrasound scans for enrollment' })
  @ApiResponse({ status: 200, description: 'Ultrasound scan history' })
  async getEnrollmentUltrasoundScans(
    @Request() req: RequestWithTenant,
    @Param('enrollmentId') enrollmentId: string,
  ) {
    return this.maternityService.getEnrollmentUltrasoundScans(req.tenantDb, enrollmentId);
  }

  @Patch('ultrasound-scans/:id')
  @ApiOperation({ summary: 'Update ultrasound scan' })
  @ApiResponse({ status: 200, description: 'Scan updated successfully' })
  async updateUltrasoundScan(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
    @Body() scanData: any,
  ) {
    return this.maternityService.updateUltrasoundScan(req.tenantDb, id, scanData);
  }

  // ===== DELIVERIES =====

  @Post('deliveries/precheck')
  @ApiOperation({ summary: 'Precheck delivery payload against maternity safety rules' })
  @ApiResponse({ status: 200, description: 'Delivery precheck results' })
  async precheckDelivery(
    @Request() req: RequestWithTenant,
    @Body() deliveryData: any,
  ) {
    return this.maternityService.precheckDelivery(req.tenantDb, deliveryData);
  }

  @Post('deliveries')
  @ApiOperation({ summary: 'Record delivery' })
  @ApiResponse({ status: 201, description: 'Delivery recorded successfully' })
  async createDelivery(
    @Request() req: RequestWithTenant,
    @Body() deliveryData: any,
  ) {
    const userId = req.user?.userId;
    const delivery = await this.maternityService.createDelivery(req.tenantDb, deliveryData, userId);
    if (delivery?.id && deliveryData?.patient_id && req.tenantId) {
      this.outcomeLinkage.scheduleFollowUpsFromDb(
        req.tenantDb, req.tenantId, delivery.id, 'delivery',
        deliveryData.patient_id, new Date(deliveryData.delivery_date ?? Date.now()),
      ).catch(() => undefined);
    }
    return delivery;
  }

  @Get('deliveries/:id')
  @ApiOperation({ summary: 'Get delivery details' })
  @ApiResponse({ status: 200, description: 'Delivery details with birth outcomes' })
  async getDeliveryById(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
  ) {
    return this.maternityService.getDeliveryById(req.tenantDb, id);
  }

  @Get('deliveries/enrollment/:enrollmentId')
  @ApiOperation({ summary: 'Get delivery record for enrollment' })
  @ApiResponse({ status: 200, description: 'Delivery record' })
  async getEnrollmentDelivery(
    @Request() req: RequestWithTenant,
    @Param('enrollmentId') enrollmentId: string,
  ) {
    return this.maternityService.getEnrollmentDelivery(req.tenantDb, enrollmentId);
  }

  @Patch('deliveries/:id')
  @ApiOperation({ summary: 'Update delivery record' })
  @ApiResponse({ status: 200, description: 'Delivery updated successfully' })
  async updateDelivery(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
    @Body() deliveryData: any,
  ) {
    return this.maternityService.updateDelivery(req.tenantDb, id, deliveryData);
  }

  @Post('deliveries/:id/birth-outcomes')
  @ApiOperation({ summary: 'Record birth outcome' })
  @ApiResponse({ status: 201, description: 'Birth outcome recorded successfully' })
  async createBirthOutcome(
    @Request() req: RequestWithTenant,
    @Param('id') deliveryId: string,
    @Body() birthData: any,
  ) {
    return this.maternityService.createBirthOutcome(req.tenantDb, deliveryId, birthData);
  }

  @Post('birth-outcomes/precheck')
  @ApiOperation({ summary: 'Precheck birth outcome payload against safety rules' })
  @ApiResponse({ status: 200, description: 'Birth outcome precheck results' })
  async precheckBirthOutcome(
    @Request() req: RequestWithTenant,
    @Body() birthData: any,
  ) {
    return this.maternityService.precheckBirthOutcome(req.tenantDb, birthData);
  }

  // ===== POSTNATAL VISITS =====

  @Post('postnatal-visits/precheck')
  @ApiOperation({ summary: 'Precheck postnatal visit against maternity safety rules' })
  @ApiResponse({ status: 200, description: 'Postnatal precheck results' })
  async precheckPostnatalVisit(
    @Request() req: RequestWithTenant,
    @Body() visitData: any,
  ) {
    return this.maternityService.precheckPostnatalVisit(req.tenantDb, visitData);
  }

  @Post('postnatal-visits')
  @ApiOperation({ summary: 'Record postnatal visit' })
  @ApiResponse({ status: 201, description: 'Postnatal visit recorded successfully' })
  async createPostnatalVisit(
    @Request() req: RequestWithTenant,
    @Body() visitData: any,
  ) {
    const userId = req.user?.userId;
    return this.maternityService.createPostnatalVisit(req.tenantDb, visitData, userId);
  }

  @Get('postnatal-visits/enrollment/:enrollmentId')
  @ApiOperation({ summary: 'Get all postnatal visits for enrollment' })
  @ApiResponse({ status: 200, description: 'Postnatal visit history' })
  async getEnrollmentPostnatalVisits(
    @Request() req: RequestWithTenant,
    @Param('enrollmentId') enrollmentId: string,
  ) {
    return this.maternityService.getEnrollmentPostnatalVisits(req.tenantDb, enrollmentId);
  }

  @Patch('postnatal-visits/:id')
  @ApiOperation({ summary: 'Update postnatal visit' })
  @ApiResponse({ status: 200, description: 'Visit updated successfully' })
  async updatePostnatalVisit(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
    @Body() visitData: any,
  ) {
    return this.maternityService.updatePostnatalVisit(req.tenantDb, id, visitData);
  }

  // ===== RISK FACTORS =====

  @Post('enrollments/:enrollmentId/risk-factors')
  @ApiOperation({ summary: 'Add risk factor to enrollment' })
  @ApiResponse({ status: 201, description: 'Risk factor added successfully' })
  async addRiskFactor(
    @Request() req: RequestWithTenant,
    @Param('enrollmentId') enrollmentId: string,
    @Body() riskData: any,
  ) {
    const userId = req.user?.userId;
    return this.maternityService.addRiskFactor(req.tenantDb, enrollmentId, riskData, userId);
  }

  @Get('enrollments/:enrollmentId/risk-factors')
  @ApiOperation({ summary: 'Get risk factors for enrollment' })
  @ApiResponse({ status: 200, description: 'Risk factors list' })
  async getEnrollmentRiskFactors(
    @Request() req: RequestWithTenant,
    @Param('enrollmentId') enrollmentId: string,
  ) {
    return this.maternityService.getEnrollmentRiskFactors(req.tenantDb, enrollmentId);
  }

  @Get('care-tasks')
  @ApiOperation({ summary: 'Get maternity escalation care tasks' })
  @ApiResponse({ status: 200, description: 'Maternity care tasks list' })
  async getMaternityCareTasks(
    @Request() req: RequestWithTenant,
    @Query('status') status?: 'open' | 'acknowledged' | 'actioned' | 'closed',
    @Query('priority') priority?: 'low' | 'medium' | 'high' | 'critical',
  ) {
    return this.maternityService.getMaternityCareTasks(req.tenantDb, { status, priority });
  }

  @Get('care-tasks/metrics')
  @ApiOperation({ summary: 'Get maternity escalation SLA and aging metrics' })
  @ApiResponse({ status: 200, description: 'Maternity care task metrics' })
  async getMaternityCareTaskMetrics(@Request() req: RequestWithTenant) {
    return this.maternityService.getMaternityCareTaskMetrics(req.tenantDb);
  }

  @Get('enrollments/:enrollmentId/care-tasks')
  @ApiOperation({ summary: 'Get maternity escalation care tasks for an enrollment' })
  @ApiResponse({ status: 200, description: 'Enrollment maternity care tasks list' })
  async getEnrollmentCareTasks(
    @Request() req: RequestWithTenant,
    @Param('enrollmentId') enrollmentId: string,
  ) {
    return this.maternityService.getEnrollmentMaternityCareTasks(req.tenantDb, enrollmentId);
  }

  @Get('enrollments/:enrollmentId/suggest-next-visit')
  @ApiOperation({ summary: 'Get backend-authoritative suggested next ANC or postnatal visit date (M4)' })
  @ApiResponse({ status: 200, description: 'Suggested next visit date and reason' })
  async suggestNextVisit(
    @Request() req: RequestWithTenant,
    @Param('enrollmentId') enrollmentId: string,
    @Query('type') type: 'anc' | 'postnatal',
    @Query('visit_date') visitDate: string,
  ) {
    if (!visitDate || !type || !['anc', 'postnatal'].includes(type)) {
      throw new BadRequestException('Query params type (anc|postnatal) and visit_date are required.');
    }
    return this.maternityService.suggestNextVisit(req.tenantDb, enrollmentId, type, visitDate);
  }

  @Patch('care-tasks/:id/status')
  @ApiOperation({ summary: 'Update maternity care task workflow status' })
  @ApiResponse({ status: 200, description: 'Maternity care task updated successfully' })
  async updateMaternityCareTaskStatus(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
    @Body() body: {
      status?: 'open' | 'acknowledged' | 'actioned' | 'closed';
      note?: string;
      assigned_to?: string;
    },
  ) {
    const userId = req.user?.userId || (req.user as any)?.id;
    return this.maternityService.updateMaternityCareTaskStatus(req.tenantDb, id, body, userId);
  }

  @Post('care-tasks/:id/apply-recommendations')
  @ApiOperation({ summary: 'Apply actionable doctor recommendations for a maternity care task' })
  @ApiResponse({ status: 200, description: 'Maternity recommendation bundle applied successfully' })
  async applyMaternityCareTaskRecommendations(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
    @Body() body: { recommendation_ids?: string[] },
  ) {
    const userId = req.user?.userId || (req.user as any)?.id || (req.user as any)?.sub;
    return this.maternityService.applyMaternityCareTaskRecommendations(
      req.tenantDb,
      req.tenantId,
      id,
      body,
      userId,
    );
  }

  // ===== INDICATORS & REPORTS =====

  @Get('indicators')
  @ApiOperation({ summary: 'Get maternal health indicators' })
  @ApiResponse({ status: 200, description: 'Maternal health indicators' })
  async getMaternityIndicators(
    @Request() req: RequestWithTenant,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.maternityService.getMaternityIndicators(req.tenantDb, startDate, endDate);
  }

  @Get('deliveries/summary')
  @ApiOperation({ summary: 'Get delivery outcomes summary' })
  @ApiResponse({ status: 200, description: 'Delivery outcomes dashboard' })
  async getDeliverySummary(
    @Request() req: RequestWithTenant,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.maternityService.getDeliverySummary(req.tenantDb, startDate, endDate);
  }

  @Get('anc-coverage')
  @ApiOperation({ summary: 'Get ANC coverage rates' })
  @ApiResponse({ status: 200, description: 'ANC coverage statistics' })
  async getANCCoverage(
    @Request() req: RequestWithTenant,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.maternityService.getANCCoverage(req.tenantDb, startDate, endDate);
  }

  @Get('high-risk-pregnancies')
  @ApiOperation({ summary: 'Get list of high-risk pregnancies' })
  @ApiResponse({ status: 200, description: 'High-risk pregnancy list' })
  async getHighRiskPregnancies(@Request() req: RequestWithTenant) {
    return this.maternityService.getHighRiskPregnancies(req.tenantDb);
  }

  @Get('upcoming-deliveries')
  @ApiOperation({ summary: 'Get upcoming deliveries (EDD within next 30 days)' })
  @ApiResponse({ status: 200, description: 'Upcoming deliveries' })
  async getUpcomingDeliveries(@Request() req: RequestWithTenant) {
    return this.maternityService.getUpcomingDeliveries(req.tenantDb);
  }

  @Get('overdue-anc')
  @ApiOperation({ summary: 'Get patients with overdue ANC visits' })
  @ApiResponse({ status: 200, description: 'Overdue ANC visits' })
  async getOverdueANCVisits(@Request() req: RequestWithTenant) {
    return this.maternityService.getOverdueANCVisits(req.tenantDb);
  }

  @Get('neonatal/recent-outcomes')
  @ApiOperation({ summary: 'Get recent neonatal outcomes' })
  @ApiResponse({ status: 200, description: 'Recent neonatal outcomes' })
  async getRecentNeonatalOutcomes(@Request() req: RequestWithTenant) {
    return this.maternityService.getRecentNeonatalOutcomes(req.tenantDb);
  }

  @Get('postnatal/recent-visits')
  @ApiOperation({ summary: 'Get recent postnatal visits' })
  @ApiResponse({ status: 200, description: 'Recent postnatal visits' })
  async getRecentPostnatalVisits(@Request() req: RequestWithTenant) {
    return this.maternityService.getRecentPostnatalVisits(req.tenantDb);
  }

  // ── S228: Digital Partograph ─────────────────────────────────────────────

  @Post('partograph')
  @ApiOperation({ summary: 'Record a partograph entry for an active delivery' })
  @ApiResponse({ status: 201, description: 'Partograph entry recorded with CDSS alerts' })
  async recordPartographEntry(
    @Request() req: RequestWithTenant,
    @Body() body: any,
  ) {
    const userId = req['user']?.id;
    return this.maternityService.recordPartographEntry(req.tenantDb, body.delivery_id, body, userId);
  }

  @Get('partograph/delivery/:deliveryId')
  @ApiOperation({ summary: 'Get full partograph data for a delivery (all entries + delivery context)' })
  @ApiResponse({ status: 200, description: 'Partograph data with ordered time-series entries' })
  async getPartographData(
    @Request() req: RequestWithTenant,
    @Param('deliveryId') deliveryId: string,
  ) {
    return this.maternityService.getPartographData(req.tenantDb, deliveryId);
  }

  @Patch('partograph/:id')
  @ApiOperation({ summary: 'Correct a partograph entry' })
  @ApiResponse({ status: 200, description: 'Entry updated with recalculated CDSS alerts' })
  async patchPartographEntry(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const userId = req['user']?.id;
    return this.maternityService.patchPartographEntry(req.tenantDb, id, body, userId);
  }
}
