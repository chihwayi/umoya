import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Headers, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { FhirService } from '../services/fhir.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TenantService } from '../services/tenant.service';
import { PatientAccessService, Accessor } from '../services/patient-access.service';
import { DataSource } from 'typeorm';

@ApiTags('FHIR R4 Compliance')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fhir')
export class FhirController {
  constructor(
    private fhirService: FhirService,
    private tenantService: TenantService,
    private patientAccess: PatientAccessService
  ) {}

  // R2 / FX-011: caller identity comes from the verified JWT only.
  private accessorOf(req: any): Accessor {
    const u = req?.user ?? {};
    return {
      userId: u.sub || u.id || u.userId,
      role: u.role,
      facilityId: u.facilityId ?? u.facility_id ?? null,
    };
  }

  // R2 gap-close: filter a returned FHIR Bundle to entries the caller may
  // see, via the single resource→owner mechanism in FhirService.
  private async filterFhirBundle(req: any, bundle: any, resourceType: string): Promise<any> {
    const entries: any[] = bundle?.entry ?? [];
    const ids = entries.map((e) => e?.resource?.id).filter((id) => typeof id === 'string');
    const allowed = await this.fhirService.filterResourcesByAccess(
      req.tenantDb, this.accessorOf(req), resourceType, ids,
    );
    const kept = entries.filter((e) => allowed.includes(e?.resource?.id));
    return { ...bundle, entry: kept, total: kept.length };
  }

  // R2 gap-close: extract the owning patient from a write body
  // (FHIR subject/patient reference) and enforce chart-write.
  private async assertWriteSubjectAccess(req: any, body: any): Promise<void> {
    const ref = body?.subject?.reference || body?.patient?.reference;
    const explicit = body?.subject?.id || body?.patientId || body?.patient_id;
    let subjectId: string | null = null;
    if (typeof ref === 'string' && ref.startsWith('Patient/')) subjectId = ref.slice('Patient/'.length);
    else if (typeof explicit === 'string' && explicit) subjectId = explicit;
    if (!subjectId) return; // no patient linkage in body (catalog/definitional)
    await this.fhirService.assertResourceAccess(req.tenantDb, this.accessorOf(req), 'Patient', subjectId, 'chart-write');
  }

  @Get('metadata')
  @ApiOperation({ summary: 'Get FHIR capability statement' })
  @ApiResponse({ status: 200, description: 'FHIR capability statement' })
  async getCapabilityStatement() {
    return this.fhirService.getCapabilityStatement();
  }

  @Post('\\$batch')
  @ApiOperation({ summary: 'Process FHIR batch operation' })
  @ApiResponse({ status: 200, description: 'FHIR batch response bundle' })
  async processBatch(
    @Body() bundle: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.processBatch(bundle, tenantDb, tenantId, this.accessorOf(req));
  }

  @Post('\\$transaction')
  @ApiOperation({ summary: 'Process FHIR transaction operation' })
  @ApiResponse({ status: 200, description: 'FHIR transaction response bundle' })
  async processTransaction(
    @Body() bundle: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.processTransaction(bundle, tenantDb, tenantId, this.accessorOf(req));
  }

  @Get('Patient')
  @ApiOperation({ summary: 'Search FHIR patients' })
  @ApiResponse({ status: 200, description: 'FHIR patient bundle' })
  async searchPatients(
    @Query() query: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
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
      const result = await this.fhirService.searchPatients(query, tenantDb, tenantId, this.accessorOf(req));
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
    @Query('_everything') everything: string,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    
    // Handle $everything operation via query parameter
    if (everything !== undefined || id.includes('everything')) {
      const patientId = id.replace('/everything', '').replace('everything', '');
      return this.fhirService.getPatientEverything(patientId || id, tenantDb, tenantId, this.accessorOf(req));
    }

    return this.fhirService.getPatient(id, tenantDb, tenantId, this.accessorOf(req));
  }

  @Get(['Patient/:id/\\$everything', 'Patient/:id/everything'])
  @ApiOperation({ summary: 'Get all resources for a patient (Patient $everything operation)' })
  @ApiResponse({ status: 200, description: 'FHIR bundle containing all patient resources' })
  async getPatientEverythingRoute(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.getPatientEverything(id, tenantDb, tenantId, this.accessorOf(req));
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
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.filterFhirBundle(req, await this.fhirService.searchObservations(query, tenantDb, tenantId), 'Observation');
  }

  @Get('Observation/:id')
  @ApiOperation({ summary: 'Get FHIR observation by ID' })
  @ApiResponse({ status: 200, description: 'FHIR observation resource' })
  async getObservation(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.fhirService.assertResourceAccess(req.tenantDb, this.accessorOf(req), 'Observation', id, 'chart-read');
    return this.fhirService.getObservation(id, tenantDb, tenantId);
  }

  @Post('Observation')
  @ApiOperation({ summary: 'Create FHIR observation' })
  @ApiResponse({ status: 201, description: 'FHIR observation created' })
  async createObservation(
    @Body() fhirObservation: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.assertWriteSubjectAccess(req, fhirObservation);
    return this.fhirService.createObservation(fhirObservation, tenantDb, tenantId);
  }

  @Put('Observation/:id')
  @ApiOperation({ summary: 'Update FHIR observation' })
  @ApiResponse({ status: 200, description: 'FHIR observation updated' })
  async updateObservation(
    @Param('id') id: string,
    @Body() fhirObservation: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.fhirService.assertResourceAccess(req.tenantDb, this.accessorOf(req), 'Observation', id, 'chart-write');
    return this.fhirService.updateObservation(id, fhirObservation, tenantDb, tenantId);
  }

  @Get('Encounter')
  @ApiOperation({ summary: 'Search FHIR encounters' })
  @ApiResponse({ status: 200, description: 'FHIR encounter bundle' })
  async searchEncounters(
    @Query() query: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.filterFhirBundle(req, await this.fhirService.searchEncounters(query, tenantDb, tenantId), 'Encounter');
  }

  @Get('Encounter/:id')
  @ApiOperation({ summary: 'Get FHIR encounter by ID' })
  @ApiResponse({ status: 200, description: 'FHIR encounter resource' })
  async getEncounter(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.fhirService.assertResourceAccess(req.tenantDb, this.accessorOf(req), 'Encounter', id, 'chart-read');
    return this.fhirService.getEncounter(id, tenantDb, tenantId);
  }

  @Post('Encounter')
  @ApiOperation({ summary: 'Create FHIR encounter' })
  @ApiResponse({ status: 201, description: 'FHIR encounter created' })
  async createEncounter(
    @Body() fhirEncounter: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.assertWriteSubjectAccess(req, fhirEncounter);
    return this.fhirService.createEncounter(fhirEncounter, tenantDb, tenantId);
  }

  @Put('Encounter/:id')
  @ApiOperation({ summary: 'Update FHIR encounter' })
  @ApiResponse({ status: 200, description: 'FHIR encounter updated' })
  async updateEncounter(
    @Param('id') id: string,
    @Body() fhirEncounter: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.fhirService.assertResourceAccess(req.tenantDb, this.accessorOf(req), 'Encounter', id, 'chart-write');
    return this.fhirService.updateEncounter(id, fhirEncounter, tenantDb, tenantId);
  }

  @Get('MedicationRequest')
  @ApiOperation({ summary: 'Search FHIR medication requests' })
  @ApiResponse({ status: 200, description: 'FHIR medication request bundle' })
  async searchMedicationRequests(
    @Query() query: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.filterFhirBundle(req, await this.fhirService.searchMedicationRequests(query, tenantDb, tenantId), 'MedicationRequest');
  }

  @Get('MedicationRequest/:id')
  @ApiOperation({ summary: 'Get FHIR medication request by ID' })
  @ApiResponse({ status: 200, description: 'FHIR medication request resource' })
  async getMedicationRequest(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.fhirService.assertResourceAccess(req.tenantDb, this.accessorOf(req), 'MedicationRequest', id, 'chart-read');
    return this.fhirService.getMedicationRequest(id, tenantDb, tenantId);
  }

  @Post('MedicationRequest')
  @ApiOperation({ summary: 'Create FHIR medication request' })
  @ApiResponse({ status: 201, description: 'FHIR medication request created' })
  async createMedicationRequest(
    @Body() fhirMedicationRequest: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.assertWriteSubjectAccess(req, fhirMedicationRequest);
    return this.fhirService.createMedicationRequest(fhirMedicationRequest, tenantDb, tenantId);
  }

  @Put('MedicationRequest/:id')
  @ApiOperation({ summary: 'Update FHIR medication request' })
  @ApiResponse({ status: 200, description: 'FHIR medication request updated' })
  async updateMedicationRequest(
    @Param('id') id: string,
    @Body() fhirMedicationRequest: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.fhirService.assertResourceAccess(req.tenantDb, this.accessorOf(req), 'MedicationRequest', id, 'chart-write');
    return this.fhirService.updateMedicationRequest(id, fhirMedicationRequest, tenantDb, tenantId);
  }

  @Delete('MedicationRequest/:id')
  @ApiOperation({ summary: 'Cancel FHIR medication request' })
  @ApiResponse({ status: 200, description: 'FHIR medication request cancelled' })
  async deleteMedicationRequest(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.fhirService.assertResourceAccess(req.tenantDb, this.accessorOf(req), 'MedicationRequest', id, 'chart-write');
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

  @Get('MedicationDispense')
  @ApiOperation({ summary: 'Search FHIR medication dispenses' })
  @ApiResponse({ status: 200, description: 'FHIR medication dispense bundle' })
  async searchMedicationDispenses(
    @Query() query: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.filterFhirBundle(req, await this.fhirService.searchMedicationDispenses(query, tenantDb, tenantId), 'MedicationDispense');
  }

  @Get('MedicationDispense/:id')
  @ApiOperation({ summary: 'Get FHIR medication dispense by ID' })
  @ApiResponse({ status: 200, description: 'FHIR medication dispense resource' })
  async getMedicationDispense(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.fhirService.assertResourceAccess(req.tenantDb, this.accessorOf(req), 'MedicationDispense', id, 'chart-read');
    return this.fhirService.getMedicationDispense(id, tenantDb, tenantId);
  }

  @Post('MedicationDispense')
  @ApiOperation({ summary: 'Create FHIR medication dispense' })
  @ApiResponse({ status: 201, description: 'FHIR medication dispense created' })
  async createMedicationDispense(
    @Body() fhirDispense: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.assertWriteSubjectAccess(req, fhirDispense);
    return this.fhirService.createMedicationDispense(fhirDispense, tenantDb, tenantId);
  }

  @Put('MedicationDispense/:id')
  @ApiOperation({ summary: 'Update FHIR medication dispense' })
  @ApiResponse({ status: 200, description: 'FHIR medication dispense updated' })
  async updateMedicationDispense(
    @Param('id') id: string,
    @Body() fhirDispense: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.fhirService.assertResourceAccess(req.tenantDb, this.accessorOf(req), 'MedicationDispense', id, 'chart-write');
    return this.fhirService.updateMedicationDispense(id, fhirDispense, tenantDb, tenantId);
  }

  @Delete('MedicationDispense/:id')
  @ApiOperation({ summary: 'Delete FHIR medication dispense' })
  @ApiResponse({ status: 200, description: 'FHIR medication dispense deleted' })
  async deleteMedicationDispense(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.fhirService.assertResourceAccess(req.tenantDb, this.accessorOf(req), 'MedicationDispense', id, 'chart-write');
    return this.fhirService.deleteMedicationDispense(id, tenantDb);
  }

  @Get('DiagnosticReport')
  @ApiOperation({ summary: 'Search FHIR diagnostic reports' })
  @ApiResponse({ status: 200, description: 'FHIR diagnostic report bundle' })
  async searchDiagnosticReports(
    @Query() query: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.filterFhirBundle(req, await this.fhirService.searchDiagnosticReports(query, tenantDb, tenantId), 'DiagnosticReport');
  }

  @Get('DiagnosticReport/:id')
  @ApiOperation({ summary: 'Get FHIR diagnostic report by ID' })
  @ApiResponse({ status: 200, description: 'FHIR diagnostic report resource' })
  async getDiagnosticReport(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.fhirService.assertResourceAccess(req.tenantDb, this.accessorOf(req), 'DiagnosticReport', id, 'chart-read');
    return this.fhirService.getDiagnosticReport(id, tenantDb, tenantId);
  }

  @Post('DiagnosticReport')
  @ApiOperation({ summary: 'Create FHIR diagnostic report' })
  @ApiResponse({ status: 201, description: 'FHIR diagnostic report created' })
  async createDiagnosticReport(
    @Body() fhirDiagnosticReport: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.assertWriteSubjectAccess(req, fhirDiagnosticReport);
    return this.fhirService.createDiagnosticReport(fhirDiagnosticReport, tenantDb, tenantId);
  }

  @Put('DiagnosticReport/:id')
  @ApiOperation({ summary: 'Update FHIR diagnostic report' })
  @ApiResponse({ status: 200, description: 'FHIR diagnostic report updated' })
  async updateDiagnosticReport(
    @Param('id') id: string,
    @Body() fhirDiagnosticReport: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.fhirService.assertResourceAccess(req.tenantDb, this.accessorOf(req), 'DiagnosticReport', id, 'chart-write');
    return this.fhirService.updateDiagnosticReport(id, fhirDiagnosticReport, tenantDb, tenantId);
  }

  // ========== New FHIR Resources ==========

  @Get('Condition')
  @ApiOperation({ summary: 'Search FHIR conditions' })
  @ApiResponse({ status: 200, description: 'FHIR condition bundle' })
  async searchConditions(
    @Query() query: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.filterFhirBundle(req, await this.fhirService.searchConditions(query, tenantDb, tenantId), 'Condition');
  }

  @Get('Condition/:id')
  @ApiOperation({ summary: 'Get FHIR condition by ID' })
  @ApiResponse({ status: 200, description: 'FHIR condition resource' })
  async getCondition(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.fhirService.assertResourceAccess(req.tenantDb, this.accessorOf(req), 'Condition', id, 'chart-read');
    return this.fhirService.getCondition(id, tenantDb, tenantId);
  }

  @Post('Condition')
  @ApiOperation({ summary: 'Create FHIR condition' })
  @ApiResponse({ status: 201, description: 'FHIR condition created' })
  async createCondition(
    @Body() fhirCondition: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.assertWriteSubjectAccess(req, fhirCondition);
    return this.fhirService.createCondition(fhirCondition, tenantDb, tenantId);
  }

  @Put('Condition/:id')
  @ApiOperation({ summary: 'Update FHIR condition' })
  @ApiResponse({ status: 200, description: 'FHIR condition updated' })
  async updateCondition(
    @Param('id') id: string,
    @Body() fhirCondition: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.fhirService.assertResourceAccess(req.tenantDb, this.accessorOf(req), 'Condition', id, 'chart-write');
    return this.fhirService.updateCondition(id, fhirCondition, tenantDb, tenantId);
  }

  @Get('Immunization')
  @ApiOperation({ summary: 'Search FHIR immunizations' })
  @ApiResponse({ status: 200, description: 'FHIR immunization bundle' })
  async searchImmunizations(
    @Query() query: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.filterFhirBundle(req, await this.fhirService.searchImmunizations(query, tenantDb, tenantId), 'Immunization');
  }

  @Get('Immunization/:id')
  @ApiOperation({ summary: 'Get FHIR immunization by ID' })
  @ApiResponse({ status: 200, description: 'FHIR immunization resource' })
  async getImmunization(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.fhirService.assertResourceAccess(req.tenantDb, this.accessorOf(req), 'Immunization', id, 'chart-read');
    return this.fhirService.getImmunization(id, tenantDb, tenantId);
  }

  @Post('Immunization')
  @ApiOperation({ summary: 'Create FHIR immunization' })
  @ApiResponse({ status: 201, description: 'FHIR immunization created' })
  async createImmunization(
    @Body() fhirImmunization: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.assertWriteSubjectAccess(req, fhirImmunization);
    return this.fhirService.createImmunization(fhirImmunization, tenantDb, tenantId);
  }

  @Put('Immunization/:id')
  @ApiOperation({ summary: 'Update FHIR immunization' })
  @ApiResponse({ status: 200, description: 'FHIR immunization updated' })
  async updateImmunization(
    @Param('id') id: string,
    @Body() fhirImmunization: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.fhirService.assertResourceAccess(req.tenantDb, this.accessorOf(req), 'Immunization', id, 'chart-write');
    return this.fhirService.updateImmunization(id, fhirImmunization, tenantDb, tenantId);
  }

  @Get('Procedure')
  @ApiOperation({ summary: 'Search FHIR procedures' })
  @ApiResponse({ status: 200, description: 'FHIR procedure bundle' })
  async searchProcedures(
    @Query() query: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.filterFhirBundle(req, await this.fhirService.searchProcedures(query, tenantDb, tenantId), 'Procedure');
  }

  @Get('Procedure/:id')
  @ApiOperation({ summary: 'Get FHIR procedure by ID' })
  @ApiResponse({ status: 200, description: 'FHIR procedure resource' })
  async getProcedure(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.fhirService.assertResourceAccess(req.tenantDb, this.accessorOf(req), 'Procedure', id, 'chart-read');
    return this.fhirService.getProcedure(id, tenantDb, tenantId);
  }

  @Post('Procedure')
  @ApiOperation({ summary: 'Create FHIR procedure' })
  @ApiResponse({ status: 201, description: 'FHIR procedure created' })
  async createProcedure(
    @Body() fhirProcedure: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.assertWriteSubjectAccess(req, fhirProcedure);
    return this.fhirService.createProcedure(fhirProcedure, tenantDb, tenantId);
  }

  @Put('Procedure/:id')
  @ApiOperation({ summary: 'Update FHIR procedure' })
  @ApiResponse({ status: 200, description: 'FHIR procedure updated' })
  async updateProcedure(
    @Param('id') id: string,
    @Body() fhirProcedure: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.fhirService.assertResourceAccess(req.tenantDb, this.accessorOf(req), 'Procedure', id, 'chart-write');
    return this.fhirService.updateProcedure(id, fhirProcedure, tenantDb, tenantId);
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
    return this.fhirService.searchLocations(query, tenantDb, tenantId);
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
    return this.fhirService.getLocation(id, tenantDb, tenantId);
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
    return this.fhirService.searchOrganizations(query, tenantDb, tenantId);
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
    return this.fhirService.getOrganization(id, tenantDb, tenantId);
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

  @Get('ImagingStudy')
  @ApiOperation({ summary: 'Search FHIR imaging studies' })
  @ApiResponse({ status: 200, description: 'FHIR imaging study bundle' })
  async searchImagingStudies(
    @Query() query: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.filterFhirBundle(req, await this.fhirService.searchImagingStudies(query, tenantDb, tenantId), 'ImagingStudy');
  }

  @Get('ImagingStudy/:id')
  @ApiOperation({ summary: 'Get FHIR imaging study by ID' })
  @ApiResponse({ status: 200, description: 'FHIR imaging study resource' })
  async getImagingStudy(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.fhirService.assertResourceAccess(req.tenantDb, this.accessorOf(req), 'ImagingStudy', id, 'chart-read');
    return this.fhirService.getImagingStudy(id, tenantDb, tenantId);
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

  // ========== AllergyIntolerance Resource ==========

  @Get('AllergyIntolerance')
  @ApiOperation({ summary: 'Search FHIR allergy intolerances' })
  @ApiResponse({ status: 200, description: 'FHIR allergy intolerance bundle' })
  async searchAllergyIntolerances(
    @Query() query: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.filterFhirBundle(req, await this.fhirService.searchAllergyIntolerances(query, tenantDb, tenantId), 'AllergyIntolerance');
  }

  @Get('AllergyIntolerance/:id')
  @ApiOperation({ summary: 'Get FHIR allergy intolerance by ID' })
  @ApiResponse({ status: 200, description: 'FHIR allergy intolerance resource' })
  async getAllergyIntolerance(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.fhirService.assertResourceAccess(req.tenantDb, this.accessorOf(req), 'AllergyIntolerance', id, 'chart-read');
    return this.fhirService.getAllergyIntolerance(id, tenantDb, tenantId);
  }

  @Post('AllergyIntolerance')
  @ApiOperation({ summary: 'Create FHIR allergy intolerance' })
  @ApiResponse({ status: 201, description: 'FHIR allergy intolerance created' })
  async createAllergyIntolerance(
    @Body() fhirAllergy: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.assertWriteSubjectAccess(req, fhirAllergy);
    return this.fhirService.createAllergyIntolerance(fhirAllergy, tenantDb, tenantId);
  }

  @Put('AllergyIntolerance/:id')
  @ApiOperation({ summary: 'Update FHIR allergy intolerance' })
  @ApiResponse({ status: 200, description: 'FHIR allergy intolerance updated' })
  async updateAllergyIntolerance(
    @Param('id') id: string,
    @Body() fhirAllergy: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.fhirService.assertResourceAccess(req.tenantDb, this.accessorOf(req), 'AllergyIntolerance', id, 'chart-write');
    return this.fhirService.updateAllergyIntolerance(id, fhirAllergy, tenantDb, tenantId);
  }

  @Delete('AllergyIntolerance/:id')
  @ApiOperation({ summary: 'Delete FHIR allergy intolerance' })
  @ApiResponse({ status: 200, description: 'FHIR allergy intolerance deleted' })
  async deleteAllergyIntolerance(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.fhirService.assertResourceAccess(req.tenantDb, this.accessorOf(req), 'AllergyIntolerance', id, 'chart-write');
    return this.fhirService.deleteAllergyIntolerance(id, tenantDb);
  }

  // ========== ServiceRequest Resource ==========

  @Get('ServiceRequest')
  @ApiOperation({ summary: 'Search FHIR service requests' })
  @ApiResponse({ status: 200, description: 'FHIR service request bundle' })
  async searchServiceRequests(
    @Query() query: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.filterFhirBundle(req, await this.fhirService.searchServiceRequests(query, tenantDb, tenantId), 'ServiceRequest');
  }

  @Get('ServiceRequest/:id')
  @ApiOperation({ summary: 'Get FHIR service request by ID' })
  @ApiResponse({ status: 200, description: 'FHIR service request resource' })
  async getServiceRequest(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.fhirService.assertResourceAccess(req.tenantDb, this.accessorOf(req), 'ServiceRequest', id, 'chart-read');
    return this.fhirService.getServiceRequest(id, tenantDb, tenantId);
  }

  @Post('ServiceRequest')
  @ApiOperation({ summary: 'Create FHIR service request' })
  @ApiResponse({ status: 201, description: 'FHIR service request created' })
  async createServiceRequest(
    @Body() fhirServiceRequest: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.assertWriteSubjectAccess(req, fhirServiceRequest);
    return this.fhirService.createServiceRequest(fhirServiceRequest, tenantDb, tenantId);
  }

  @Put('ServiceRequest/:id')
  @ApiOperation({ summary: 'Update FHIR service request' })
  @ApiResponse({ status: 200, description: 'FHIR service request updated' })
  async updateServiceRequest(
    @Param('id') id: string,
    @Body() fhirServiceRequest: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.fhirService.assertResourceAccess(req.tenantDb, this.accessorOf(req), 'ServiceRequest', id, 'chart-write');
    return this.fhirService.updateServiceRequest(id, fhirServiceRequest, tenantDb, tenantId);
  }

  @Delete('ServiceRequest/:id')
  @ApiOperation({ summary: 'Delete FHIR service request' })
  @ApiResponse({ status: 200, description: 'FHIR service request deleted' })
  async deleteServiceRequest(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.fhirService.assertResourceAccess(req.tenantDb, this.accessorOf(req), 'ServiceRequest', id, 'chart-write');
    return this.fhirService.deleteServiceRequest(id, tenantDb);
  }

  // ========== DocumentReference Resource ==========

  @Get('DocumentReference')
  @ApiOperation({ summary: 'Search FHIR document references' })
  @ApiResponse({ status: 200, description: 'FHIR document reference bundle' })
  async searchDocumentReferences(
    @Query() query: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.filterFhirBundle(req, await this.fhirService.searchDocumentReferences(query, tenantDb, tenantId), 'DocumentReference');
  }

  @Get('DocumentReference/:id')
  @ApiOperation({ summary: 'Get FHIR document reference by ID' })
  @ApiResponse({ status: 200, description: 'FHIR document reference resource' })
  async getDocumentReference(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.fhirService.assertResourceAccess(req.tenantDb, this.accessorOf(req), 'DocumentReference', id, 'chart-read');
    return this.fhirService.getDocumentReference(id, tenantDb, tenantId);
  }

  @Post('DocumentReference')
  @ApiOperation({ summary: 'Create FHIR document reference' })
  @ApiResponse({ status: 201, description: 'FHIR document reference created' })
  async createDocumentReference(
    @Body() fhirDocRef: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.assertWriteSubjectAccess(req, fhirDocRef);
    return this.fhirService.createDocumentReference(fhirDocRef, tenantDb, tenantId);
  }

  @Put('DocumentReference/:id')
  @ApiOperation({ summary: 'Update FHIR document reference' })
  @ApiResponse({ status: 200, description: 'FHIR document reference updated' })
  async updateDocumentReference(
    @Param('id') id: string,
    @Body() fhirDocRef: any,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.fhirService.assertResourceAccess(req.tenantDb, this.accessorOf(req), 'DocumentReference', id, 'chart-write');
    return this.fhirService.updateDocumentReference(id, fhirDocRef, tenantDb, tenantId);
  }

  @Delete('DocumentReference/:id')
  @ApiOperation({ summary: 'Delete FHIR document reference' })
  @ApiResponse({ status: 200, description: 'FHIR document reference deleted' })
  async deleteDocumentReference(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    await this.fhirService.assertResourceAccess(req.tenantDb, this.accessorOf(req), 'DocumentReference', id, 'chart-write');
    return this.fhirService.deleteDocumentReference(id, tenantDb);
  }

  // ========== FHIR Operations ==========

  @Get(':resourceType/:id/_history')
  @ApiOperation({ summary: 'Get resource history ($history operation)' })
  @ApiResponse({ status: 200, description: 'FHIR history bundle' })
  async getResourceHistory(
    @Param('resourceType') resourceType: string,
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in X-Tenant-ID header');
    }
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    return this.fhirService.getResourceHistory(resourceType, id, tenantDb, this.accessorOf(req));
  }

  @Post('\\$validate')
  @ApiOperation({ summary: 'Validate a FHIR resource ($validate operation)' })
  @ApiResponse({ status: 200, description: 'Validation result as OperationOutcome' })
  async validateResource(
    @Body() fhirResource: any,
    @Query('profile') profile?: string
  ) {
    return this.fhirService.validateResource(fhirResource, profile);
  }
}