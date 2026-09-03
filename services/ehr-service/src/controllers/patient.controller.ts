import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PatientService } from '../services/patient.service';
import { CreatePatientDto, UpdatePatientDto } from '../dto/patient.dto';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { ProactiveAiService } from '../services/proactive-ai.service';
import { PatientIntelligenceService } from '../services/patient-intelligence.service';

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
  ) {}

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

    return this.patientService.advancedSearch(filters, req!.tenantDb);
  }

  @Get('stats')
  async getPatientStats(@Request() req: RequestWithTenant) {
    return this.patientService.getStats(req.tenantDb);
  }

  @Get(':id/context')
  @ApiOperation({ summary: 'Get unified reusable patient context across modules' })
  @ApiResponse({ status: 200, description: 'Patient context retrieved successfully' })
  async getPatientContext(@Param('id') id: string, @Request() req: RequestWithTenant) {
    const context: any = await this.patientService.getPatientContext(id, req.tenantDb);

    const tenantId = req.tenantId;
    const userId = (req as any).user?.userId;

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
    return this.patientService.getPatientByMRN(mrn, req.tenantDb);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get patient by ID' })
  @ApiResponse({ status: 200, description: 'Patient retrieved successfully' })
  async getPatientById(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.patientService.getPatientById(id, req.tenantDb);
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

  // ── SDOH endpoints (Sprint 60) ─────────────────────────────────────────────

  @Get(':id/sdoh')
  @ApiOperation({ summary: 'Get SDOH assessments for a patient' })
  @ApiResponse({ status: 200, description: 'SDOH assessments retrieved successfully' })
  async getPatientSdoh(@Param('id') id: string, @Request() req: RequestWithTenant) {
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
    return this.patientService.createPatientSdoh(id, body, userId, req.tenantDb);
  }
}
