import { Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { MaternityService } from '../services/maternity.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Maternity & Obstetrics')
@Controller('maternity')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MaternityController {
  constructor(private readonly maternityService: MaternityService) {}

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

  @Post('deliveries')
  @ApiOperation({ summary: 'Record delivery' })
  @ApiResponse({ status: 201, description: 'Delivery recorded successfully' })
  async createDelivery(
    @Request() req: RequestWithTenant,
    @Body() deliveryData: any,
  ) {
    const userId = req.user?.userId;
    return this.maternityService.createDelivery(req.tenantDb, deliveryData, userId);
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

  // ===== POSTNATAL VISITS =====

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
}

