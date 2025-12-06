import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { FhirService } from '../services/fhir.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TenantService } from '../services/tenant.service';
import { DataSource } from 'typeorm';

@ApiTags('FHIR R4 Compliance')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fhir')
export class FhirController {
  constructor(
    private fhirService: FhirService,
    private tenantService: TenantService
  ) {}

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
    @Headers('x-tenant-id') tenantId: string
  ) {
    console.log('🎯 [FHIR Controller] searchPatients called');
    console.log('🎯 [FHIR Controller] Query:', JSON.stringify(query));
    console.log('🎯 [FHIR Controller] Tenant ID from header:', tenantId);
    
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    
    console.log('🎯 [FHIR Controller] Tenant DB exists:', !!tenantDb);
    
    try {
      console.log('🎯 [FHIR Controller] Calling fhirService.searchPatients...');
      const result = await this.fhirService.searchPatients(query, tenantDb, tenantId);
      console.log('🎯 [FHIR Controller] Service returned, result type:', typeof result);
      console.log('🎯 [FHIR Controller] Result has entries:', result?.entry?.length || 0);
      return result;
    } catch (error: any) {
      console.error('❌ [FHIR Controller] Error in searchPatients:', error);
      console.error('❌ [FHIR Controller] Error message:', error?.message);
      console.error('❌ [FHIR Controller] Error name:', error?.name);
      console.error('❌ [FHIR Controller] Error stack:', error?.stack?.substring(0, 500));
      throw error;
    }
  }

  @Get('Patient/:id')
  @ApiOperation({ summary: 'Get FHIR patient by ID' })
  @ApiResponse({ status: 200, description: 'FHIR patient resource' })
  async getPatient(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.getPatient(id, tenantDb, tenantId);
  }

  @Post('Patient')
  @ApiOperation({ summary: 'Create FHIR patient' })
  @ApiResponse({ status: 201, description: 'FHIR patient created' })
  async createPatient(
    @Body() fhirPatient: any,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.createPatient(fhirPatient, tenantDb, tenantId);
  }

  @Put('Patient/:id')
  @ApiOperation({ summary: 'Update FHIR patient' })
  @ApiResponse({ status: 200, description: 'FHIR patient updated' })
  async updatePatient(
    @Param('id') id: string,
    @Body() fhirPatient: any,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.updatePatient(id, fhirPatient, tenantDb, tenantId);
  }

  @Get('Observation')
  @ApiOperation({ summary: 'Search FHIR observations' })
  @ApiResponse({ status: 200, description: 'FHIR observation bundle' })
  async searchObservations(
    @Query() query: any,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.searchObservations(query, tenantDb, tenantId);
  }

  @Get('Encounter')
  @ApiOperation({ summary: 'Search FHIR encounters' })
  @ApiResponse({ status: 200, description: 'FHIR encounter bundle' })
  async searchEncounters(
    @Query() query: any,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.searchEncounters(query, tenantDb, tenantId);
  }

  @Get('MedicationRequest')
  @ApiOperation({ summary: 'Search FHIR medication requests' })
  @ApiResponse({ status: 200, description: 'FHIR medication request bundle' })
  async searchMedicationRequests(
    @Query() query: any,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.searchMedicationRequests(query, tenantDb, tenantId);
  }

  @Get('MedicationRequest/:id')
  @ApiOperation({ summary: 'Get FHIR medication request by ID' })
  @ApiResponse({ status: 200, description: 'FHIR medication request resource' })
  async getMedicationRequest(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.getMedicationRequest(id, tenantDb, tenantId);
  }

  @Post('MedicationRequest')
  @ApiOperation({ summary: 'Create FHIR medication request' })
  @ApiResponse({ status: 201, description: 'FHIR medication request created' })
  async createMedicationRequest(
    @Body() fhirMedicationRequest: any,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.createMedicationRequest(fhirMedicationRequest, tenantDb, tenantId);
  }

  @Put('MedicationRequest/:id')
  @ApiOperation({ summary: 'Update FHIR medication request' })
  @ApiResponse({ status: 200, description: 'FHIR medication request updated' })
  async updateMedicationRequest(
    @Param('id') id: string,
    @Body() fhirMedicationRequest: any,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.updateMedicationRequest(id, fhirMedicationRequest, tenantDb, tenantId);
  }

  @Delete('MedicationRequest/:id')
  @ApiOperation({ summary: 'Cancel FHIR medication request' })
  @ApiResponse({ status: 200, description: 'FHIR medication request cancelled' })
  async deleteMedicationRequest(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.deleteMedicationRequest(id, tenantDb, tenantId);
  }

  @Get('Medication')
  @ApiOperation({ summary: 'Search FHIR medications' })
  @ApiResponse({ status: 200, description: 'FHIR medication bundle' })
  async searchMedications(
    @Query() query: any,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.searchMedications(query, tenantDb, tenantId);
  }

  @Get('Medication/:id')
  @ApiOperation({ summary: 'Get FHIR medication by ID' })
  @ApiResponse({ status: 200, description: 'FHIR medication resource' })
  async getMedication(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.getMedication(id, tenantDb, tenantId);
  }

  @Post('Medication')
  @ApiOperation({ summary: 'Create FHIR medication' })
  @ApiResponse({ status: 201, description: 'FHIR medication created' })
  async createMedication(
    @Body() fhirMedication: any,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.createMedication(fhirMedication, tenantDb, tenantId);
  }

  @Put('Medication/:id')
  @ApiOperation({ summary: 'Update FHIR medication' })
  @ApiResponse({ status: 200, description: 'FHIR medication updated' })
  async updateMedication(
    @Param('id') id: string,
    @Body() fhirMedication: any,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.updateMedication(id, fhirMedication, tenantDb, tenantId);
  }

  @Delete('Medication/:id')
  @ApiOperation({ summary: 'Delete FHIR medication' })
  @ApiResponse({ status: 200, description: 'FHIR medication deleted' })
  async deleteMedication(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.deleteMedication(id, tenantDb);
  }

  @Get('DiagnosticReport')
  @ApiOperation({ summary: 'Search FHIR diagnostic reports' })
  @ApiResponse({ status: 200, description: 'FHIR diagnostic report bundle' })
  async searchDiagnosticReports(
    @Query() query: any,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.searchDiagnosticReports(query, tenantDb, tenantId);
  }

  @Get('DiagnosticReport/:id')
  @ApiOperation({ summary: 'Get FHIR diagnostic report by ID' })
  @ApiResponse({ status: 200, description: 'FHIR diagnostic report resource' })
  async getDiagnosticReport(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.getDiagnosticReport(id, tenantDb, tenantId);
  }

  @Post('DiagnosticReport')
  @ApiOperation({ summary: 'Create FHIR diagnostic report' })
  @ApiResponse({ status: 201, description: 'FHIR diagnostic report created' })
  async createDiagnosticReport(
    @Body() fhirDiagnosticReport: any,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.createDiagnosticReport(fhirDiagnosticReport, tenantDb, tenantId);
  }

  @Put('DiagnosticReport/:id')
  @ApiOperation({ summary: 'Update FHIR diagnostic report' })
  @ApiResponse({ status: 200, description: 'FHIR diagnostic report updated' })
  async updateDiagnosticReport(
    @Param('id') id: string,
    @Body() fhirDiagnosticReport: any,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.updateDiagnosticReport(id, fhirDiagnosticReport, tenantDb, tenantId);
  }

  // ========== New FHIR Resources ==========

  @Get('Condition')
  @ApiOperation({ summary: 'Search FHIR conditions' })
  @ApiResponse({ status: 200, description: 'FHIR condition bundle' })
  async searchConditions(
    @Query() query: any,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.searchConditions(query, tenantDb, tenantId);
  }

  @Get('Condition/:id')
  @ApiOperation({ summary: 'Get FHIR condition by ID' })
  @ApiResponse({ status: 200, description: 'FHIR condition resource' })
  async getCondition(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.getCondition(id, tenantDb, tenantId);
  }

  @Post('Condition')
  @ApiOperation({ summary: 'Create FHIR condition' })
  @ApiResponse({ status: 201, description: 'FHIR condition created' })
  async createCondition(
    @Body() fhirCondition: any,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.createCondition(fhirCondition, tenantDb, tenantId);
  }

  @Put('Condition/:id')
  @ApiOperation({ summary: 'Update FHIR condition' })
  @ApiResponse({ status: 200, description: 'FHIR condition updated' })
  async updateCondition(
    @Param('id') id: string,
    @Body() fhirCondition: any,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.updateCondition(id, fhirCondition, tenantDb, tenantId);
  }

  @Get('Immunization')
  @ApiOperation({ summary: 'Search FHIR immunizations' })
  @ApiResponse({ status: 200, description: 'FHIR immunization bundle' })
  async searchImmunizations(
    @Query() query: any,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.searchImmunizations(query, tenantDb);
  }

  @Get('Immunization/:id')
  @ApiOperation({ summary: 'Get FHIR immunization by ID' })
  @ApiResponse({ status: 200, description: 'FHIR immunization resource' })
  async getImmunization(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.getImmunization(id, tenantDb);
  }

  @Get('Procedure')
  @ApiOperation({ summary: 'Search FHIR procedures' })
  @ApiResponse({ status: 200, description: 'FHIR procedure bundle' })
  async searchProcedures(
    @Query() query: any,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.searchProcedures(query, tenantDb);
  }

  @Get('Procedure/:id')
  @ApiOperation({ summary: 'Get FHIR procedure by ID' })
  @ApiResponse({ status: 200, description: 'FHIR procedure resource' })
  async getProcedure(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.getProcedure(id, tenantDb);
  }

  @Get('Location')
  @ApiOperation({ summary: 'Search FHIR locations' })
  @ApiResponse({ status: 200, description: 'FHIR location bundle' })
  async searchLocations(
    @Query() query: any,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.searchLocations(query, tenantDb);
  }

  @Get('Location/:id')
  @ApiOperation({ summary: 'Get FHIR location by ID' })
  @ApiResponse({ status: 200, description: 'FHIR location resource' })
  async getLocation(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.getLocation(id, tenantDb);
  }

  @Get('Organization')
  @ApiOperation({ summary: 'Search FHIR organizations' })
  @ApiResponse({ status: 200, description: 'FHIR organization bundle' })
  async searchOrganizations(
    @Query() query: any,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.searchOrganizations(query, tenantDb);
  }

  @Get('Organization/:id')
  @ApiOperation({ summary: 'Get FHIR organization by ID' })
  @ApiResponse({ status: 200, description: 'FHIR organization resource' })
  async getOrganization(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.getOrganization(id, tenantDb);
  }

  @Get('Practitioner')
  @ApiOperation({ summary: 'Search FHIR practitioners' })
  @ApiResponse({ status: 200, description: 'FHIR practitioner bundle' })
  async searchPractitioners(
    @Query() query: any,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.searchPractitioners(query, tenantDb);
  }

  @Get('Practitioner/:id')
  @ApiOperation({ summary: 'Get FHIR practitioner by ID' })
  @ApiResponse({ status: 200, description: 'FHIR practitioner resource' })
  async getPractitioner(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.getPractitioner(id, tenantDb);
  }

  @Get('PractitionerRole')
  @ApiOperation({ summary: 'Search FHIR practitioner roles' })
  @ApiResponse({ status: 200, description: 'FHIR practitioner role bundle' })
  async searchPractitionerRoles(
    @Query() query: any,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.searchPractitionerRoles(query, tenantDb);
  }

  @Get('PractitionerRole/:id')
  @ApiOperation({ summary: 'Get FHIR practitioner role by ID' })
  @ApiResponse({ status: 200, description: 'FHIR practitioner role resource' })
  async getPractitionerRole(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.getPractitionerRole(id, tenantDb);
  }

  @Get('CarePlan')
  @ApiOperation({ summary: 'Search FHIR care plans' })
  @ApiResponse({ status: 200, description: 'FHIR care plan bundle' })
  async searchCarePlans(
    @Query() query: any,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.searchCarePlans(query, tenantDb);
  }

  @Get('CarePlan/:id')
  @ApiOperation({ summary: 'Get FHIR care plan by ID' })
  @ApiResponse({ status: 200, description: 'FHIR care plan resource' })
  async getCarePlan(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.getCarePlan(id, tenantDb);
  }
}