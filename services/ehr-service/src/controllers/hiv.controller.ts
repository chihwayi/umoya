import { Controller, Post, Get, Patch, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { HivService } from '../services/hiv.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('HIV/AIDS/TB')
@Controller('hiv')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class HivController {
  constructor(private readonly hivService: HivService) {}

  @Post('tests')
  @ApiOperation({ summary: 'Record HIV test result' })
  @ApiResponse({ status: 201, description: 'HIV test recorded successfully' })
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
    const providerRole = (req as any).user?.role || body.providerRole;
    const providerId = (req as any).user?.id || body.providerId;
    return this.hivService.createClinicalVisit({ ...body, providerId }, req.tenantDb, providerRole);
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
    return this.hivService.createEacSession(body, req.tenantDb);
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
    return this.hivService.createArvChangeRequest(body, req.tenantDb);
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
    const doctorId = (req as any).user?.id;
    const doctorName = (req as any).user?.first_name + ' ' + (req as any).user?.last_name;
    return this.hivService.approveArvChangeRequest(requestId, { ...body, approvedBy: doctorId, approvedByName: doctorName }, req.tenantDb);
  }

  @Patch('arv-change-requests/:requestId/reject')
  @ApiOperation({ summary: 'Reject ARV change request (doctor only)' })
  @ApiResponse({ status: 200, description: 'Change request rejected' })
  async rejectArvChangeRequest(@Param('requestId') requestId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    const doctorId = (req as any).user?.id;
    const doctorName = (req as any).user?.first_name + ' ' + (req as any).user?.last_name;
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

  @Get('lookup/:tableName')
  @ApiOperation({ summary: 'Get lookup table data' })
  @ApiResponse({ status: 200, description: 'Lookup data retrieved' })
  async getLookupData(@Param('tableName') tableName: string, @Query() query: any, @Request() req: RequestWithTenant) {
    return this.hivService.getLookupData(tableName, query, req.tenantDb);
  }
}

