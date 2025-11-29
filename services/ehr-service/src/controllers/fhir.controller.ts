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

  // ========== New FHIR Resources ==========

  @Get('Immunization')
  @ApiOperation({ summary: 'Search FHIR immunizations' })
  @ApiResponse({ status: 200, description: 'FHIR immunization bundle' })
  async searchImmunizations(
    @Query() query: any,
    @Request() req: RequestWithTenant
  ) {
    return this.fhirService.searchImmunizations(query, req.tenantDb);
  }

  @Get('Immunization/:id')
  @ApiOperation({ summary: 'Get FHIR immunization by ID' })
  @ApiResponse({ status: 200, description: 'FHIR immunization resource' })
  async getImmunization(
    @Param('id') id: string,
    @Request() req: RequestWithTenant
  ) {
    return this.fhirService.getImmunization(id, req.tenantDb);
  }

  @Get('Procedure')
  @ApiOperation({ summary: 'Search FHIR procedures' })
  @ApiResponse({ status: 200, description: 'FHIR procedure bundle' })
  async searchProcedures(
    @Query() query: any,
    @Request() req: RequestWithTenant
  ) {
    return this.fhirService.searchProcedures(query, req.tenantDb);
  }

  @Get('Procedure/:id')
  @ApiOperation({ summary: 'Get FHIR procedure by ID' })
  @ApiResponse({ status: 200, description: 'FHIR procedure resource' })
  async getProcedure(
    @Param('id') id: string,
    @Request() req: RequestWithTenant
  ) {
    return this.fhirService.getProcedure(id, req.tenantDb);
  }

  @Get('Location')
  @ApiOperation({ summary: 'Search FHIR locations' })
  @ApiResponse({ status: 200, description: 'FHIR location bundle' })
  async searchLocations(
    @Query() query: any,
    @Request() req: RequestWithTenant
  ) {
    return this.fhirService.searchLocations(query, req.tenantDb);
  }

  @Get('Location/:id')
  @ApiOperation({ summary: 'Get FHIR location by ID' })
  @ApiResponse({ status: 200, description: 'FHIR location resource' })
  async getLocation(
    @Param('id') id: string,
    @Request() req: RequestWithTenant
  ) {
    return this.fhirService.getLocation(id, req.tenantDb);
  }

  @Get('Organization')
  @ApiOperation({ summary: 'Search FHIR organizations' })
  @ApiResponse({ status: 200, description: 'FHIR organization bundle' })
  async searchOrganizations(
    @Query() query: any,
    @Request() req: RequestWithTenant
  ) {
    return this.fhirService.searchOrganizations(query, req.tenantDb);
  }

  @Get('Organization/:id')
  @ApiOperation({ summary: 'Get FHIR organization by ID' })
  @ApiResponse({ status: 200, description: 'FHIR organization resource' })
  async getOrganization(
    @Param('id') id: string,
    @Request() req: RequestWithTenant
  ) {
    return this.fhirService.getOrganization(id, req.tenantDb);
  }

  @Get('Practitioner')
  @ApiOperation({ summary: 'Search FHIR practitioners' })
  @ApiResponse({ status: 200, description: 'FHIR practitioner bundle' })
  async searchPractitioners(
    @Query() query: any,
    @Request() req: RequestWithTenant
  ) {
    return this.fhirService.searchPractitioners(query, req.tenantDb);
  }

  @Get('Practitioner/:id')
  @ApiOperation({ summary: 'Get FHIR practitioner by ID' })
  @ApiResponse({ status: 200, description: 'FHIR practitioner resource' })
  async getPractitioner(
    @Param('id') id: string,
    @Request() req: RequestWithTenant
  ) {
    return this.fhirService.getPractitioner(id, req.tenantDb);
  }

  @Get('PractitionerRole')
  @ApiOperation({ summary: 'Search FHIR practitioner roles' })
  @ApiResponse({ status: 200, description: 'FHIR practitioner role bundle' })
  async searchPractitionerRoles(
    @Query() query: any,
    @Request() req: RequestWithTenant
  ) {
    return this.fhirService.searchPractitionerRoles(query, req.tenantDb);
  }

  @Get('PractitionerRole/:id')
  @ApiOperation({ summary: 'Get FHIR practitioner role by ID' })
  @ApiResponse({ status: 200, description: 'FHIR practitioner role resource' })
  async getPractitionerRole(
    @Param('id') id: string,
    @Request() req: RequestWithTenant
  ) {
    return this.fhirService.getPractitionerRole(id, req.tenantDb);
  }

  @Get('CarePlan')
  @ApiOperation({ summary: 'Search FHIR care plans' })
  @ApiResponse({ status: 200, description: 'FHIR care plan bundle' })
  async searchCarePlans(
    @Query() query: any,
    @Request() req: RequestWithTenant
  ) {
    return this.fhirService.searchCarePlans(query, req.tenantDb);
  }

  @Get('CarePlan/:id')
  @ApiOperation({ summary: 'Get FHIR care plan by ID' })
  @ApiResponse({ status: 200, description: 'FHIR care plan resource' })
  async getCarePlan(
    @Param('id') id: string,
    @Request() req: RequestWithTenant
  ) {
    return this.fhirService.getCarePlan(id, req.tenantDb);
  }
}