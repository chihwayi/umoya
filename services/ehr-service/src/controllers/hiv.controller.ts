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
    return this.hivService.createClinicalVisit(body, req.tenantDb);
  }

  @Get('visits/enrollment/:enrollmentId')
  @ApiOperation({ summary: 'Get clinical visits for an enrollment' })
  @ApiResponse({ status: 200, description: 'Clinical visits retrieved' })
  async getClinicalVisits(@Param('enrollmentId') enrollmentId: string, @Request() req: RequestWithTenant) {
    return this.hivService.getClinicalVisits(enrollmentId, req.tenantDb);
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
}

