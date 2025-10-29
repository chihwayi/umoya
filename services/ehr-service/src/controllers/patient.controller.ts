import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PatientService } from '../services/patient.service';
import { CreatePatientDto, UpdatePatientDto } from '../dto/patient.dto';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Patient Management')
@ApiBearerAuth()
@Controller('patients')
@UseGuards(JwtAuthGuard)
export class PatientController {
  constructor(private patientService: PatientService) {}

  @Get()
  @ApiOperation({ summary: 'Get all patients' })
  @ApiResponse({ status: 200, description: 'Patients retrieved successfully' })
  async getAllPatients(@Request() req: RequestWithTenant, @Query('page') page: string = '1', @Query('limit') limit: string = '20') {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    return this.patientService.getAllPatients(req.tenantDb, pageNum, limitNum);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search patients' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Search results retrieved successfully' })
  async searchPatients(@Query('q') query: string, @Request() req: RequestWithTenant) {
    return this.patientService.searchPatients(query, req.tenantDb);
  }

  @Get('stats')
  async getPatientStats() {
    return {
      totalPatients: 10,
      newPatientsThisMonth: 3
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get patient by ID' })
  @ApiResponse({ status: 200, description: 'Patient retrieved successfully' })
  async getPatientById(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.patientService.getPatientById(id, req.tenantDb);
  }

  @Get('mrn/:mrn')
  @ApiOperation({ summary: 'Get patient by MRN' })
  @ApiResponse({ status: 200, description: 'Patient retrieved successfully' })
  async getPatientByMRN(@Param('mrn') mrn: string, @Request() req: RequestWithTenant) {
    return this.patientService.getPatientByMRN(mrn, req.tenantDb);
  }

  @Post()
  @ApiOperation({ summary: 'Create new patient' })
  @ApiResponse({ status: 201, description: 'Patient created successfully' })
  async createPatient(@Body() createPatientDto: CreatePatientDto, @Request() req: RequestWithTenant) {
    const tenantSlug = req.headers['x-tenant-id'] as string;
    return this.patientService.createPatient(createPatientDto, req.tenantDb, tenantSlug);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update patient' })
  @ApiResponse({ status: 200, description: 'Patient updated successfully' })
  async updatePatient(
    @Param('id') id: string,
    @Body() updatePatientDto: UpdatePatientDto,
    @Request() req: RequestWithTenant
  ) {
    return this.patientService.updatePatient(id, updatePatientDto, req.tenantDb);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate patient' })
  @ApiResponse({ status: 200, description: 'Patient deactivated successfully' })
  async deactivatePatient(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.patientService.deactivatePatient(id, req.tenantDb);
  }
}