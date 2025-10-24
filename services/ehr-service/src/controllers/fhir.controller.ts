import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { FhirService } from '../services/fhir.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('FHIR R4 Compliance')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fhir')
export class FhirController {
  constructor(private fhirService: FhirService) {}

  @Get('metadata')
  @ApiOperation({ summary: 'Get FHIR capability statement' })
  @ApiResponse({ status: 200, description: 'FHIR capability statement' })
  async getCapabilityStatement() {
    return this.fhirService.getCapabilityStatement();
  }

  @Get('Patient')
  @ApiOperation({ summary: 'Search FHIR patients' })
  @ApiResponse({ status: 200, description: 'FHIR patient bundle' })
  async searchPatients(
    @Query() query: any,
    @Request() req: RequestWithTenant
  ) {
    return this.fhirService.searchPatients(query, req.tenantDb);
  }

  @Get('Patient/:id')
  @ApiOperation({ summary: 'Get FHIR patient by ID' })
  @ApiResponse({ status: 200, description: 'FHIR patient resource' })
  async getPatient(
    @Param('id') id: string,
    @Request() req: RequestWithTenant
  ) {
    return this.fhirService.getPatient(id, req.tenantDb);
  }

  @Post('Patient')
  @ApiOperation({ summary: 'Create FHIR patient' })
  @ApiResponse({ status: 201, description: 'FHIR patient created' })
  async createPatient(
    @Body() fhirPatient: any,
    @Request() req: RequestWithTenant
  ) {
    return this.fhirService.createPatient(fhirPatient, req.tenantDb);
  }

  @Put('Patient/:id')
  @ApiOperation({ summary: 'Update FHIR patient' })
  @ApiResponse({ status: 200, description: 'FHIR patient updated' })
  async updatePatient(
    @Param('id') id: string,
    @Body() fhirPatient: any,
    @Request() req: RequestWithTenant
  ) {
    return this.fhirService.updatePatient(id, fhirPatient, req.tenantDb);
  }

  @Get('Observation')
  @ApiOperation({ summary: 'Search FHIR observations' })
  @ApiResponse({ status: 200, description: 'FHIR observation bundle' })
  async searchObservations(
    @Query() query: any,
    @Request() req: RequestWithTenant
  ) {
    return this.fhirService.searchObservations(query, req.tenantDb);
  }

  @Get('Encounter')
  @ApiOperation({ summary: 'Search FHIR encounters' })
  @ApiResponse({ status: 200, description: 'FHIR encounter bundle' })
  async searchEncounters(
    @Query() query: any,
    @Request() req: RequestWithTenant
  ) {
    return this.fhirService.searchEncounters(query, req.tenantDb);
  }

  @Get('MedicationRequest')
  @ApiOperation({ summary: 'Search FHIR medication requests' })
  @ApiResponse({ status: 200, description: 'FHIR medication request bundle' })
  async searchMedicationRequests(
    @Query() query: any,
    @Request() req: RequestWithTenant
  ) {
    return this.fhirService.searchMedicationRequests(query, req.tenantDb);
  }

  @Get('DiagnosticReport')
  @ApiOperation({ summary: 'Search FHIR diagnostic reports' })
  @ApiResponse({ status: 200, description: 'FHIR diagnostic report bundle' })
  async searchDiagnosticReports(
    @Query() query: any,
    @Request() req: RequestWithTenant
  ) {
    return this.fhirService.searchDiagnosticReports(query, req.tenantDb);
  }
}