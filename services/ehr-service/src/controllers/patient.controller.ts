import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity, ApiQuery } from '@nestjs/swagger';
import { PatientService } from '../services/patient.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CreatePatientDto, UpdatePatientDto, PatientSearchDto } from '../dto/patient.dto';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Patient Management')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('patients')
export class PatientController {
  constructor(private patientService: PatientService) {}

  @Post()
  @ApiOperation({ summary: 'Create new patient' })
  @ApiResponse({ status: 201, description: 'Patient created successfully' })
  async createPatient(
    @Body() createPatientDto: CreatePatientDto,
    @Request() req: RequestWithTenant
  ) {
    return this.patientService.create(createPatientDto, req.tenantDb);
  }

  @Get()
  @ApiOperation({ summary: 'Get all patients with pagination and search' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Patients retrieved successfully' })
  async getAllPatients(
    @Query() query: PatientSearchDto,
    @Request() req: RequestWithTenant
  ) {
    return this.patientService.findAll(query, req.tenantDb);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get patient by ID' })
  @ApiResponse({ status: 200, description: 'Patient retrieved successfully' })
  async getPatientById(
    @Param('id') id: string,
    @Request() req: RequestWithTenant
  ) {
    return this.patientService.findById(id, req.tenantDb);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update patient' })
  @ApiResponse({ status: 200, description: 'Patient updated successfully' })
  async updatePatient(
    @Param('id') id: string,
    @Body() updatePatientDto: UpdatePatientDto,
    @Request() req: RequestWithTenant
  ) {
    return this.patientService.update(id, updatePatientDto, req.tenantDb);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate patient' })
  @ApiResponse({ status: 200, description: 'Patient deactivated successfully' })
  async deactivatePatient(
    @Param('id') id: string,
    @Request() req: RequestWithTenant
  ) {
    return this.patientService.deactivate(id, req.tenantDb);
  }

  @Get(':id/medical-history')
  @ApiOperation({ summary: 'Get patient medical history' })
  @ApiResponse({ status: 200, description: 'Medical history retrieved successfully' })
  async getPatientMedicalHistory(
    @Param('id') id: string,
    @Request() req: RequestWithTenant
  ) {
    return this.patientService.getMedicalHistory(id, req.tenantDb);
  }
}