import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request, Query, Logger } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { PatientService } from '../services/patient.service';
import { CreatePatientDto, UpdatePatientDto } from '../dto/patient.dto';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { ProactiveAiService } from '../services/proactive-ai.service';
import { PatientIntelligenceService } from '../services/patient-intelligence.service';
import { PatientAccessService, Accessor } from '../services/patient-access.service';

@ApiTags('Patient Management')
@ApiBearerAuth()
@Controller('patients')
@UseGuards(JwtAuthGuard)
export class PatientController {
  private readonly logger = new Logger(PatientController.name);

  constructor(
    private patientService: PatientService,
    private proactiveAiService: ProactiveAiService,
    private patientIntelligenceService: PatientIntelligenceService,
    private patientAccess: PatientAccessService,
  ) {}

  // R2 / FX-011: every patient-returning handler below derives the caller
  // from the verified JWT (never a client-supplied id) and enforces the
  // single authorization layer before touching patient data.
  private accessorOf(req: any): Accessor {
    const u = req?.user ?? {};
    return {
      userId: u.sub || u.id || u.userId,
      role: u.role,
      facilityId: u.facilityId ?? u.facility_id ?? null,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all patients' })
  @ApiResponse({ status: 200, description: 'Patients retrieved successfully' })
  async getAllPatients(@Request() req: RequestWithTenant, @Query('page') page: string = '1', @Query('limit') limit: string = '20') {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const result = await this.patientService.getAllPatients(req.tenantDb, pageNum, limitNum);
    const ids = await this.patientAccess.filterAccessiblePatientIds(
      req.tenantDb, this.accessorOf(req), result.patients.map((r) => r.id),
    );
    return { ...result, patients: result.patients.filter((r) => ids.includes(r.id)) };
  }

  // Generous enough for legitimate search-as-you-type (staff commonly fire
  // this on every keystroke), but bounded to stop a script from exhausting
  // the DB connection pool with unlimited ILIKE queries.
  @Throttle({ default: { ttl: 60000, limit: 90 } })
  @Get('search')
  @ApiOperation({ summary: 'Search patients' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Search results retrieved successfully' })
  async searchPatients(@Query('q') query: string, @Request() req: RequestWithTenant) {
    const rows: any[] = await this.patientService.searchPatients(query, req.tenantDb);
    const ids = await this.patientAccess.filterAccessiblePatientIds(
      req.tenantDb, this.accessorOf(req), rows.map((r) => r.id ?? r.patient_id),
    );
    return rows.filter((r) => ids.includes(r.id ?? r.patient_id));
  }

  @Throttle({ default: { ttl: 60000, limit: 90 } })
  @Get('search/advanced')
  @ApiOperation({ summary: 'Advanced patient search with filters' })
  @ApiQuery({ name: 'searchTerm', required: false, type: String })
  @ApiQuery({ name: 'gender', required: false, type: String })
  @ApiQuery({ name: 'ageMin', required: false, type: Number })
  @ApiQuery({ name: 'ageMax', required: false, type: Number })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiQuery({ name: 'medicalAidProvider', required: false, type: String })
  @ApiQuery({ name: 'city', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Advanced search results retrieved successfully' })
  async advancedSearch(
    @Query('searchTerm') searchTerm?: string,
    @Query('gender') gender?: string,
    @Query('ageMin') ageMin?: string,
    @Query('ageMax') ageMax?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('medicalAidProvider') medicalAidProvider?: string,
    @Query('city') city?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Request() req?: RequestWithTenant
  ) {
    const filters: any = {};
    if (searchTerm) filters.searchTerm = searchTerm;
    if (gender) filters.gender = gender;
    if (ageMin) filters.ageMin = parseInt(ageMin, 10);
    if (ageMax) filters.ageMax = parseInt(ageMax, 10);
    if (dateFrom) filters.dateFrom = new Date(dateFrom);
    if (dateTo) filters.dateTo = new Date(dateTo);
    if (medicalAidProvider) filters.medicalAidProvider = medicalAidProvider;
    if (city) filters.city = city;
    if (page) filters.page = parseInt(page, 10);
    if (limit) filters.limit = parseInt(limit, 10);

    const result = await this.patientService.advancedSearch(filters, req!.tenantDb);
    const ids = await this.patientAccess.filterAccessiblePatientIds(
      req!.tenantDb, this.accessorOf(req), result.patients.map((r: any) => r.id ?? r.patient_id),
    );
    return { ...result, patients: result.patients.filter((r: any) => ids.includes(r.id ?? r.patient_id)) };
  }

  @Get('stats')
  async getPatientStats(@Request() req: RequestWithTenant) {
    return this.patientService.getStats(req.tenantDb);
  }

  @Get(':id/context')
  @ApiOperation({ summary: 'Get unified reusable patient context across modules' })
  @ApiResponse({ status: 200, description: 'Patient context retrieved successfully' })
  async getPatientContext(@Param('id') id: string, @Request() req: RequestWithTenant) {
    await this.patientAccess.assertCanAccess(req.tenantDb, this.accessorOf(req), id, 'chart-read');
    const context: any = await this.patientService.getPatientContext(id, req.tenantDb);

    const tenantId = req.tenantId;
    const userId = (req as any).user?.sub || (req as any).user?.id;

    // Fire async proactive analysis — does NOT block this response
    this.proactiveAiService.triggerAnalysis({
      patientId: id,
      tenantId,
      triggeredByUserId: userId,
      triggerType: 'chart_open',
    }).catch((e: any) => this.logger.warn(`Proactive AI analysis trigger failed: ${e?.message}`));

    // Attach latest cached snapshot if one exists
    const snapshot = await this.proactiveAiService.getSnapshot(id, tenantId);
    if (snapshot) {
      context['aiSnapshot'] = {
        clinicalSummary: snapshot.clinicalSummary,
        riskScores: snapshot.riskScores,
        activeFlags: snapshot.activeFlags,
        news2Score: snapshot.news2Score,
        qsofaScore: snapshot.qsofaScore,
        generatedAt: snapshot.snapshotGeneratedAt,
      };
    }

    return context;
  }

  @Get(':id/intelligence')
  @ApiOperation({ summary: 'Get unified patient intelligence workspace payload' })
  @ApiResponse({ status: 200, description: 'Patient intelligence retrieved successfully' })
  async getPatientIntelligence(@Param('id') id: string, @Request() req: RequestWithTenant) {
    await this.patientAccess.assertCanAccess(req.tenantDb, this.accessorOf(req), id, 'chart-read');
    const tenantId = req.tenantId;
    const actorUserId = (req as any).user?.userId ?? (req as any).user?.id ?? null;

    return this.patientIntelligenceService.getPatientIntelligence(
      id,
      tenantId,
      req.tenantDb,
      actorUserId,
    );
  }

  @Get('mrn/:mrn')
  @ApiOperation({ summary: 'Get patient by MRN' })
  @ApiResponse({ status: 200, description: 'Patient retrieved successfully' })
  async getPatientByMRN(@Param('mrn') mrn: string, @Request() req: RequestWithTenant) {
    const row: any = await this.patientService.getPatientByMRN(mrn, req.tenantDb);
    if (row?.id) {
      await this.patientAccess.assertCanAccess(req.tenantDb, this.accessorOf(req), row.id, 'chart-read');
    }
    return row;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get patient by ID' })
  @ApiResponse({ status: 200, description: 'Patient retrieved successfully' })
  async getPatientById(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.patientService.getPatientById(id, req.tenantDb, this.accessorOf(req));
  }

  @Post()
  @ApiOperation({ summary: 'Create new patient' })
  @ApiResponse({ status: 201, description: 'Patient created successfully' })
  async createPatient(@Body() createPatientDto: CreatePatientDto, @Request() req: RequestWithTenant) {
    const tenantSlug = req.headers['x-tenant-id'] as string;
    const actingUser = req.user as any;
    return this.patientService.createPatient(createPatientDto, req.tenantDb, tenantSlug, {
      userId: actingUser?.id || actingUser?.userId,
      userName: actingUser?.email || actingUser?.name,
      userRole: actingUser?.role,
    });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update patient' })
  @ApiResponse({ status: 200, description: 'Patient updated successfully' })
  async updatePatient(
    @Param('id') id: string,
    @Body() updatePatientDto: UpdatePatientDto,
    @Request() req: RequestWithTenant
  ) {
    await this.patientAccess.assertCanAccess(req.tenantDb, this.accessorOf(req), id, 'chart-write');
    return this.patientService.updatePatient(id, updatePatientDto, req.tenantDb);
  }

  @Post(':id/deceased')
  @UseGuards(RolesGuard)
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Mark a patient deceased (suppresses outbound patient communications; does not lock the record)' })
  @ApiResponse({ status: 200, description: 'Patient marked deceased' })
  async markDeceased(
    @Param('id') id: string,
    @Body() body: { deceasedAt?: string },
    @Request() req: RequestWithTenant,
  ) {
    // R2 gap-close: marking deceased is consequential and hard to reverse —
    // relationship required, same as every sibling route in this file.
    await this.patientAccess.assertCanAccess(req.tenantDb, this.accessorOf(req), id, 'chart-write');
    const actingUser = req.user as any;
    return this.patientService.markDeceased(id, body?.deceasedAt, req.tenantDb, {
      userId: actingUser?.id || actingUser?.userId,
      userName: actingUser?.email || actingUser?.name,
      userRole: actingUser?.role,
    });
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Deactivate patient' })
  @ApiResponse({ status: 200, description: 'Patient deactivated successfully' })
  async deactivatePatient(@Param('id') id: string, @Request() req: RequestWithTenant) {
    await this.patientAccess.assertCanAccess(req.tenantDb, this.accessorOf(req), id, 'chart-write');
    return this.patientService.deactivatePatient(id, req.tenantDb);
  }

  // ── SDOH endpoints (Sprint 60) ─────────────────────────────────────────────

  @Get(':id/sdoh')
  @ApiOperation({ summary: 'Get SDOH assessments for a patient' })
  @ApiResponse({ status: 200, description: 'SDOH assessments retrieved successfully' })
  async getPatientSdoh(@Param('id') id: string, @Request() req: RequestWithTenant) {
    await this.patientAccess.assertCanAccess(req.tenantDb, this.accessorOf(req), id, 'chart-read');
    return this.patientService.getPatientSdoh(id, req.tenantDb);
  }

  @Post(':id/sdoh')
  @ApiOperation({ summary: 'Create SDOH assessment for a patient' })
  @ApiResponse({ status: 201, description: 'SDOH assessment created successfully' })
  async createPatientSdoh(
    @Param('id') id: string,
    @Body() body: Record<string, any>,
    @Request() req: RequestWithTenant
  ) {
    const userId = (req as any).user?.sub;
    await this.patientAccess.assertCanAccess(req.tenantDb, this.accessorOf(req), id, 'chart-write');
    return this.patientService.createPatientSdoh(id, body, userId, req.tenantDb);
  }

  @Post(':id/break-glass')
  @ApiOperation({ summary: 'Request time-boxed break-glass access to a patient (reason required, audited)' })
  @ApiResponse({ status: 201, description: 'Break-glass grant created' })
  async requestBreakGlass(
    @Param('id') id: string,
    @Body() body: { reason: string; minutes?: number },
    @Request() req: RequestWithTenant,
  ) {
    const acc = this.accessorOf(req);
    return this.patientAccess.grantBreakGlass(req.tenantDb, {
      userId: acc.userId,
      patientId: id,
      reason: body?.reason,
      minutes: body?.minutes ?? 60,
    });
  }
}
