import { Controller, Post, Get, Patch, Body, Param, Query, Request, UseGuards, UsePipes, ValidationPipe, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { HivService } from '../services/hiv.service';
import { HivMonthlyReturnService } from '../services/hiv-monthly-return.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('HIV/AIDS/TB')
@Controller('hiv')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class HivController {
  constructor(
    private readonly hivService: HivService,
    private readonly hivMonthlyReturnService: HivMonthlyReturnService,
  ) {}

  @Post('tests')
  @ApiOperation({ summary: 'Record HIV test result' })
  @ApiResponse({ status: 201, description: 'HIV test recorded successfully' })
  @UsePipes(new ValidationPipe({ whitelist: false, transform: true }))
  async createHivTest(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.hivService.createHivTest(body, req.tenantDb);
  }

  @Get('tests/patient/:patientId')
  @ApiOperation({ summary: 'Get HIV test history for a patient' })
  @ApiResponse({ status: 200, description: 'HIV test history retrieved' })
  async getPatientHivTests(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.hivService.getPatientHivTests(patientId, req.tenantDb);
  }

  @Post('tests/:testId/process-algorithm')
  @ApiOperation({ summary: 'Process HIV test results through Zimbabwe algorithm' })
  @ApiResponse({ status: 200, description: 'Algorithm processed successfully' })
  async processTestingAlgorithm(@Param('testId') testId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.hivService.processTestingAlgorithm(testId, req.tenantDb);
  }

  @Post('nurse-intakes')
  @ApiOperation({ summary: 'Capture or update HIV nurse intake' })
  @ApiResponse({ status: 201, description: 'Nurse intake saved successfully' })
  async saveNurseIntake(@Body() body: any, @Request() req: RequestWithTenant) {
    const userId = (req as any).user?.id;
    return this.hivService.saveNurseIntake(body, req.tenantDb, userId);
  }

  @Get('nurse-intakes/patient/:patientId')
  @ApiOperation({ summary: 'Fetch HIV nurse intakes for a patient' })
  @ApiResponse({ status: 200, description: 'Nurse intakes retrieved' })
  async getPatientNurseIntakes(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.hivService.getNurseIntakesByPatient(patientId, req.tenantDb);
  }

  @Get('nurse-intakes/appointment/:appointmentId')
  @ApiOperation({ summary: 'Fetch HIV nurse intake linked to an appointment' })
  @ApiResponse({ status: 200, description: 'Nurse intake retrieved' })
  async getNurseIntakeByAppointment(@Param('appointmentId') appointmentId: string, @Request() req: RequestWithTenant) {
    return this.hivService.getNurseIntakeByAppointment(appointmentId, req.tenantDb);
  }

  @Post('enrollments')
  @ApiOperation({ summary: 'Enroll patient in HIV care' })
  @ApiResponse({ status: 201, description: 'Patient enrolled successfully' })
  async enrollInCare(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.hivService.enrollInCare(body, req.tenantDb);
  }

  @Get('enrollments')
  @ApiOperation({ summary: 'Get all HIV care enrollments' })
  @ApiResponse({ status: 200, description: 'Enrollments retrieved' })
  async getEnrollments(@Query() query: any, @Request() req: RequestWithTenant) {
    return this.hivService.getEnrollments(query, req.tenantDb);
  }

  @Get('enrollments/patient/:patientId')
  @ApiOperation({ summary: 'Get enrollment for a specific patient' })
  @ApiResponse({ status: 200, description: 'Enrollment retrieved' })
  async getPatientEnrollment(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.hivService.getPatientEnrollment(patientId, req.tenantDb);
  }

  @Get('enrollments/:enrollmentId')
  @ApiOperation({ summary: 'Get enrollment by ID' })
  @ApiResponse({ status: 200, description: 'Enrollment retrieved' })
  async getEnrollmentById(@Param('enrollmentId') enrollmentId: string, @Request() req: RequestWithTenant) {
    return this.hivService.getEnrollmentById(enrollmentId, req.tenantDb);
  }

  @Post('visits')
  @ApiOperation({ summary: 'Record HIV clinical visit' })
  @ApiResponse({ status: 201, description: 'Clinical visit recorded' })
  async createClinicalVisit(@Body() body: any, @Request() req: RequestWithTenant) {
    const user = (req as any).user || {};
    const providerRole = user.role || body.providerRole;
    const providerId = user.id || body.providerId;

    const firstName = (user.first_name || user.firstName || '').toString().trim();
    const lastName = (user.last_name || user.lastName || '').toString().trim();
    const fullNameFromUser = `${firstName} ${lastName}`.trim();
    const providerName =
      fullNameFromUser ||
      user.full_name ||
      user.fullName ||
      user.display_name ||
      user.displayName ||
      user.username ||
      body.providerName ||
      'Unknown';

    return this.hivService.createClinicalVisit({ ...body, providerId, providerName }, req.tenantDb, providerRole, req.tenantId);
  }

  @Get('visits/enrollment/:enrollmentId')
  @ApiOperation({ summary: 'Get clinical visits for an enrollment' })
  @ApiResponse({ status: 200, description: 'Clinical visits retrieved' })
  async getClinicalVisits(@Param('enrollmentId') enrollmentId: string, @Request() req: RequestWithTenant) {
    return this.hivService.getClinicalVisits(enrollmentId, req.tenantDb);
  }

  @Get('visits/count/:enrollmentId')
  @ApiOperation({ summary: 'Get visit count and next visit number for an enrollment' })
  @ApiResponse({ status: 200, description: 'Visit count retrieved' })
  async getVisitCount(@Param('enrollmentId') enrollmentId: string, @Request() req: RequestWithTenant) {
    return this.hivService.getVisitCount(enrollmentId, req.tenantDb);
  }

  // EAC Endpoints
  @Post('eac/sessions')
  @ApiOperation({ summary: 'Record EAC session' })
  @ApiResponse({ status: 201, description: 'EAC session recorded' })
  async createEacSession(@Body() body: any, @Request() req: RequestWithTenant) {
    const user = (req as any).user || {};
    const firstName = (user.first_name || user.firstName || '').toString().trim();
    const lastName = (user.last_name || user.lastName || '').toString().trim();
    const counselorName =
      `${firstName} ${lastName}`.trim() ||
      user.full_name ||
      user.fullName ||
      user.display_name ||
      user.displayName ||
      user.username ||
      user.email ||
      body.counselorName ||
      'Unknown';

    return this.hivService.createEacSession(
      {
        ...body,
        counselorId: user.id || body.counselorId,
        counselorName,
      },
      req.tenantDb,
    );
  }

  @Get('eac/enrollment/:enrollmentId')
  @ApiOperation({ summary: 'Get EAC sessions for an enrollment' })
  @ApiResponse({ status: 200, description: 'EAC sessions retrieved' })
  async getEacSessions(@Param('enrollmentId') enrollmentId: string, @Request() req: RequestWithTenant) {
    return this.hivService.getEacSessions(enrollmentId, req.tenantDb);
  }

  @Get('eac/check/:enrollmentId')
  @ApiOperation({ summary: 'Check if patient needs EAC based on viral load' })
  @ApiResponse({ status: 200, description: 'EAC eligibility checked' })
  async checkEacEligibility(@Param('enrollmentId') enrollmentId: string, @Request() req: RequestWithTenant) {
    return this.hivService.checkEacEligibility(enrollmentId, req.tenantDb);
  }

  // ARV Change Request Endpoints
  @Post('arv-change-requests')
  @ApiOperation({ summary: 'Create ARV change request' })
  @ApiResponse({ status: 201, description: 'Change request created' })
  async createArvChangeRequest(@Body() body: any, @Request() req: RequestWithTenant) {
    const user = (req as any).user || {};
    const firstName = (user.first_name || user.firstName || '').toString().trim();
    const lastName = (user.last_name || user.lastName || '').toString().trim();
    const requestedByName =
      `${firstName} ${lastName}`.trim() ||
      user.full_name ||
      user.fullName ||
      user.display_name ||
      user.displayName ||
      user.username ||
      user.email ||
      body.requestedByName ||
      'Unknown';

    return this.hivService.createArvChangeRequest(
      {
        ...body,
        requestedBy: user.id || body.requestedBy,
        requestedByName,
      },
      req.tenantDb,
    );
  }

  @Get('arv-change-requests')
  @ApiOperation({ summary: 'Get ARV change requests (for doctors)' })
  @ApiResponse({ status: 200, description: 'Change requests retrieved' })
  async getArvChangeRequests(@Query() query: any, @Request() req: RequestWithTenant) {
    return this.hivService.getArvChangeRequests(query, req.tenantDb);
  }

  @Patch('arv-change-requests/:requestId/approve')
  @ApiOperation({ summary: 'Approve ARV change request (doctor only)' })
  @ApiResponse({ status: 200, description: 'Change request approved' })
  async approveArvChangeRequest(@Param('requestId') requestId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    const user = (req as any).user || {};
    if (String(user.role || '').toLowerCase() !== 'doctor') {
      throw new ForbiddenException('Only doctors can approve ARV change requests');
    }

    const doctorId = user.id;
    const firstName = (user.first_name || user.firstName || '').toString().trim();
    const lastName = (user.last_name || user.lastName || '').toString().trim();
    const doctorName =
      `${firstName} ${lastName}`.trim() ||
      user.full_name ||
      user.fullName ||
      user.display_name ||
      user.displayName ||
      user.username ||
      user.email ||
      'Unknown Doctor';
    return this.hivService.approveArvChangeRequest(requestId, { ...body, approvedBy: doctorId, approvedByName: doctorName }, req.tenantDb);
  }

  @Patch('arv-change-requests/:requestId/reject')
  @ApiOperation({ summary: 'Reject ARV change request (doctor only)' })
  @ApiResponse({ status: 200, description: 'Change request rejected' })
  async rejectArvChangeRequest(@Param('requestId') requestId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    const user = (req as any).user || {};
    if (String(user.role || '').toLowerCase() !== 'doctor') {
      throw new ForbiddenException('Only doctors can reject ARV change requests');
    }

    const doctorId = user.id;
    const firstName = (user.first_name || user.firstName || '').toString().trim();
    const lastName = (user.last_name || user.lastName || '').toString().trim();
    const doctorName =
      `${firstName} ${lastName}`.trim() ||
      user.full_name ||
      user.fullName ||
      user.display_name ||
      user.displayName ||
      user.username ||
      user.email ||
      'Unknown Doctor';
    return this.hivService.rejectArvChangeRequest(requestId, { ...body, approvedBy: doctorId, approvedByName: doctorName }, req.tenantDb);
  }

  @Get('arv-change-requests/enrollment/:enrollmentId/approved')
  @ApiOperation({ summary: 'Get approved ARV change for enrollment' })
  @ApiResponse({ status: 200, description: 'Approved change retrieved' })
  async getApprovedArvChange(@Param('enrollmentId') enrollmentId: string, @Request() req: RequestWithTenant) {
    return this.hivService.getApprovedArvChangeForEnrollment(enrollmentId, req.tenantDb);
  }

  @Post('tb-screenings')
  @ApiOperation({ summary: 'Record TB screening' })
  @ApiResponse({ status: 201, description: 'TB screening recorded' })
  async createTbScreening(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.hivService.createTbScreening(body, req.tenantDb);
  }

  @Post('cervical-cancer-screenings')
  @ApiOperation({ summary: 'Record cervical cancer screening' })
  @ApiResponse({ status: 201, description: 'Cervical cancer screening recorded' })
  async createCervicalCancerScreening(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.hivService.createCervicalCancerScreening(body, req.tenantDb);
  }

  @Post('art-initiation-details')
  @ApiOperation({ summary: 'Save ART initiation details' })
  @ApiResponse({ status: 201, description: 'ART initiation details saved' })
  async saveArtInitiationDetails(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.hivService.saveArtInitiationDetails(body, req.tenantDb);
  }

  @Get('lab-results/match')
  @ApiOperation({ summary: 'Get matching lab results for a visit date' })
  @ApiResponse({ status: 200, description: 'Matching lab results found' })
  async getMatchingLabResults(@Query('patientId') patientId: string, @Query('visitDate') visitDate: string, @Request() req: RequestWithTenant) {
    return this.hivService.getMatchingLabResults(patientId, visitDate, req.tenantDb);
  }

  @Get('quality-metrics')
  @ApiOperation({ summary: 'Get HIV quality metrics and outcomes' })
  @ApiResponse({ status: 200, description: 'Quality metrics retrieved' })
  async getQualityMetrics(@Request() req: RequestWithTenant) {
    return this.hivService.getQualityMetrics(req.tenantDb);
  }

  @Get('ltfu-patients')
  @ApiOperation({ summary: 'Get lost to follow-up patients' })
  @ApiResponse({ status: 200, description: 'LTFU patients retrieved' })
  async getLTFUPatients(@Query('days') days: string, @Request() req: RequestWithTenant) {
    return this.hivService.getLTFUPatients(parseInt(days) || 90, req.tenantDb);
  }

  @Get('monitoring-schedules/:enrollmentId')
  @ApiOperation({ summary: 'Get monitoring schedules for an enrollment' })
  @ApiResponse({ status: 200, description: 'Monitoring schedules retrieved' })
  async getMonitoringSchedules(@Param('enrollmentId') enrollmentId: string, @Request() req: RequestWithTenant) {
    return this.hivService.getMonitoringSchedules(enrollmentId, req.tenantDb);
  }

  @Get('vl-pathway/:enrollmentId')
  @ApiOperation({ summary: 'Get viral load pathway state for an enrollment' })
  @ApiResponse({ status: 200, description: 'Viral load pathway retrieved' })
  async getVlPathway(@Param('enrollmentId') enrollmentId: string, @Request() req: RequestWithTenant) {
    return this.hivService.getVlPathway(enrollmentId, req.tenantDb);
  }

  @Get('dsd-status/:enrollmentId')
  @ApiOperation({ summary: 'Get DSD status and eligibility for an enrollment' })
  @ApiResponse({ status: 200, description: 'DSD status retrieved' })
  async getDsdStatus(@Param('enrollmentId') enrollmentId: string, @Request() req: RequestWithTenant) {
    return this.hivService.getDsdStatus(enrollmentId, req.tenantDb);
  }

  @Get('alerts/:enrollmentId')
  @ApiOperation({ summary: 'Get clinical alerts for an enrollment' })
  @ApiResponse({ status: 200, description: 'Clinical alerts retrieved' })
  async getClinicalAlerts(@Param('enrollmentId') enrollmentId: string, @Request() req: RequestWithTenant) {
    return this.hivService.getClinicalAlerts(enrollmentId, req.tenantDb);
  }

  @Get('adherence/:enrollmentId')
  @ApiOperation({ summary: 'Get adherence tracking data for an enrollment' })
  @ApiResponse({ status: 200, description: 'Adherence data retrieved' })
  async getAdherenceTracking(@Param('enrollmentId') enrollmentId: string, @Request() req: RequestWithTenant) {
    return this.hivService.getAdherenceTracking(enrollmentId, req.tenantDb);
  }

  @Get('regimen-history/:enrollmentId')
  @ApiOperation({ summary: 'Get regimen history timeline for an enrollment' })
  @ApiResponse({ status: 200, description: 'Regimen history retrieved' })
  async getRegimenHistory(@Param('enrollmentId') enrollmentId: string, @Request() req: RequestWithTenant) {
    return this.hivService.getRegimenHistory(enrollmentId, req.tenantDb);
  }

  @Get('tpt-eligibility/:enrollmentId')
  @ApiOperation({ summary: 'Check TPT eligibility for an enrollment' })
  @ApiResponse({ status: 200, description: 'TPT eligibility status' })
  async checkTptEligibility(@Param('enrollmentId') enrollmentId: string, @Request() req: RequestWithTenant) {
    return this.hivService.checkTptEligibility(enrollmentId, req.tenantDb);
  }

  @Get('tpt-completion/:enrollmentId')
  @ApiOperation({ summary: 'Get TPT completion status for an enrollment' })
  @ApiResponse({ status: 200, description: 'TPT completion status' })
  async getTptCompletionStatus(@Param('enrollmentId') enrollmentId: string, @Request() req: RequestWithTenant) {
    return this.hivService.getTptCompletionStatus(enrollmentId, req.tenantDb);
  }

  @Get('visit-templates')
  @ApiOperation({ summary: 'Get visit templates' })
  @ApiResponse({ status: 200, description: 'Visit templates retrieved' })
  async getVisitTemplates(@Query('visitType') visitType: string, @Request() req: RequestWithTenant) {
    return this.hivService.getVisitTemplates(req.tenantDb, visitType);
  }

  @Post('calculate-pediatric-dose')
  @ApiOperation({ summary: 'Calculate pediatric ARV dose' })
  @ApiResponse({ status: 200, description: 'Pediatric dose calculated' })
  async calculatePediatricDose(@Body() body: any) {
    return this.hivService.calculatePediatricDose(
      body.regimenCode,
      body.weightKg,
      body.ageMonths,
      body.bsa
    );
  }

  // Referral Management Endpoints
  @Post('referrals')
  @ApiOperation({ summary: 'Create referral' })
  @ApiResponse({ status: 201, description: 'Referral created' })
  async createReferral(@Body() body: any, @Request() req: RequestWithTenant) {
    const userId = (req as any).user?.id;
    const userName = (req as any).user?.first_name + ' ' + (req as any).user?.last_name;
    return this.hivService.createReferral({ ...body, referredBy: userId, referredByName: userName }, req.tenantDb);
  }

  @Get('referrals')
  @ApiOperation({ summary: 'Get referrals' })
  @ApiResponse({ status: 200, description: 'Referrals retrieved' })
  async getReferrals(@Query() query: any, @Request() req: RequestWithTenant) {
    return this.hivService.getReferrals(query, req.tenantDb);
  }

  @Get('referrals/enrollment/:enrollmentId')
  @ApiOperation({ summary: 'Get referrals for enrollment' })
  @ApiResponse({ status: 200, description: 'Referrals retrieved' })
  async getEnrollmentReferrals(@Param('enrollmentId') enrollmentId: string, @Request() req: RequestWithTenant) {
    return this.hivService.getEnrollmentReferrals(enrollmentId, req.tenantDb);
  }

  @Patch('referrals/:referralId/update-status')
  @ApiOperation({ summary: 'Update referral status' })
  @ApiResponse({ status: 200, description: 'Referral updated' })
  async updateReferralStatus(@Param('referralId') referralId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    const userId = (req as any).user?.id;
    return this.hivService.updateReferralStatus(referralId, { ...body, updatedBy: userId }, req.tenantDb);
  }

  // Audit Trail Endpoints (must be before lookup route)
  @Get('audit-log/enrollment/:enrollmentId')
  @ApiOperation({ summary: 'Get audit log for enrollment' })
  @ApiResponse({ status: 200, description: 'Audit log retrieved' })
  async getAuditLog(@Param('enrollmentId') enrollmentId: string, @Request() req: RequestWithTenant) {
    return this.hivService.getAuditLog(enrollmentId, req.tenantDb);
  }

  // Monthly Return Form (must be before lookup route)
  @Get('monthly-return')
  @ApiOperation({ summary: 'Generate monthly return form (C and D sections)' })
  @ApiResponse({ status: 200, description: 'Monthly return form generated' })
  async getMonthlyReturn(@Query('year') year: string, @Query('month') month: string, @Request() req: RequestWithTenant) {
    const yearNum = parseInt(year) || new Date().getFullYear();
    const monthNum = parseInt(month) || new Date().getMonth() + 1;
    return this.hivMonthlyReturnService.generateMonthlyReturn(yearNum, monthNum, req.tenantDb);
  }

  @Get('lookup/:tableName')
  @ApiOperation({ summary: 'Get lookup table data' })
  @ApiResponse({ status: 200, description: 'Lookup data retrieved' })
  async getLookupData(@Param('tableName') tableName: string, @Query() query: any, @Request() req: RequestWithTenant) {
    return this.hivService.getLookupData(tableName, query, req.tenantDb);
  }

  // Medication Stock Management
  @Get('medication-stock')
  @ApiOperation({ summary: 'Get medication stock' })
  @ApiResponse({ status: 200, description: 'Medication stock retrieved' })
  async getMedicationStock(@Query() query: any, @Request() req: RequestWithTenant) {
    return this.hivService.getMedicationStock(query, req.tenantDb);
  }

  @Post('medication-stock')
  @ApiOperation({ summary: 'Create medication stock item' })
  @ApiResponse({ status: 201, description: 'Medication stock item created' })
  async createMedicationStock(@Body() body: any, @Request() req: RequestWithTenant) {
    const userId = (req as any).user?.id;
    return this.hivService.createMedicationStock(body, req.tenantDb, userId);
  }

  @Patch('medication-stock/:stockId')
  @ApiOperation({ summary: 'Update medication stock item' })
  @ApiResponse({ status: 200, description: 'Medication stock item updated' })
  async updateMedicationStock(@Param('stockId') stockId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    const userId = (req as any).user?.id;
    return this.hivService.updateMedicationStock(stockId, body, req.tenantDb, userId);
  }

  // Cohort Analysis
  @Get('cohort-analysis')
  @ApiOperation({ summary: 'Get cohort analysis' })
  @ApiResponse({ status: 200, description: 'Cohort analysis retrieved' })
  async getCohortAnalysis(@Query('type') type: string, @Query('range') range: string, @Request() req: RequestWithTenant) {
    return this.hivService.getCohortAnalysis(type || 'enrollment', range || '12months', req.tenantDb);
  }

  // Comparison Reports
  @Get('comparison-report')
  @ApiOperation({ summary: 'Get comparison report' })
  @ApiResponse({ status: 200, description: 'Comparison report retrieved' })
  async getComparisonReport(@Query() query: any, @Request() req: RequestWithTenant) {
    return this.hivService.getComparisonReport(query, req.tenantDb);
  }
}
