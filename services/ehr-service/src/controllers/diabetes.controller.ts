import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { DiabetesService } from '../services/diabetes.service';
import {
  CreateDiabetesRegistryDto,
  UpdateDiabetesRegistryDto,
  CreateDiabetesCareBundleDto,
  RecordGlucoseDto,
  CreateCgmSummaryDto,
  CreateDiabetesMedicationDto,
  CreateInsulinRegimenDto,
  RecordComplicationScreeningDto,
  RecordEducationSessionDto,
  CreateDiabetesAlertDto,
  CreateDeviceIntegrationDto,
  PaginationQueryDto,
  UpdateDiabetesMedicationDto,
  TrackMedicationAdherenceDto,
  UpdateInsulinRegimenDto,
  CalculateInsulinDoseDto,
  GlucoseTrendsQueryDto,
  SyncCgmDataDto,
  ScreeningHistoryQueryDto,
  AcknowledgeAlertDto,
  ResolveAlertDto,
  UpdateDeviceIntegrationDto,
} from '../dto/diabetes.dto';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { DiabetesCdsService } from '../services/diabetes-cds.service';
import { DiabetesDeviceIntegrationService } from '../services/diabetes-device-integration.service';

@ApiTags('Diabetes')
@Controller('diabetes')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DiabetesController {
  constructor(
    private readonly diabetesService: DiabetesService,
    private readonly diabetesCdsService: DiabetesCdsService,
    private readonly diabetesDeviceIntegrationService: DiabetesDeviceIntegrationService,
  ) {}

  private getUserId(req: RequestWithTenant) {
    return ((req.user as any)?.id || (req.user as any)?.userId) ?? null;
  }

  @Get('registry')
  @ApiOperation({ summary: 'List diabetes registries' })
  async listRegistries(
    @Request() req: RequestWithTenant,
    @Query() query: PaginationQueryDto & { status?: string; diabetesType?: string; search?: string },
  ) {
    return this.diabetesService.listRegistries(req.tenantDb, query);
  }

  @Post('registry')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Create diabetes registry' })
  @ApiResponse({ status: 201 })
  async createRegistry(
    @Request() req: RequestWithTenant,
    @Body() body: CreateDiabetesRegistryDto,
  ) {
    const registry = await this.diabetesService.createRegistry(req.tenantDb, body, this.getUserId(req));
    return registry;
  }

  @Get('registry/:patientId')
  @ApiOperation({ summary: 'Get diabetes registry by patient' })
  async getRegistry(
    @Request() req: RequestWithTenant,
    @Param('patientId') patientId: string,
  ) {
    return this.diabetesService.getRegistryByPatient(req.tenantDb, patientId);
  }

  @Patch('registry/:patientId')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Update diabetes registry by patient' })
  async updateRegistry(
    @Request() req: RequestWithTenant,
    @Param('patientId') patientId: string,
    @Body() body: UpdateDiabetesRegistryDto,
  ) {
    return this.diabetesService.updateRegistry(req.tenantDb, patientId, body);
  }

  @Post('registry/:registryId/care-bundle')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Record care bundle entry' })
  async createCareBundle(
    @Request() req: RequestWithTenant,
    @Param('registryId') registryId: string,
    @Body() body: CreateDiabetesCareBundleDto & { patientId: string },
  ) {
    if (!body.patientId) {
      throw new BadRequestException('patientId is required');
    }
    return this.diabetesService.createCareBundle(req.tenantDb, registryId, body.patientId, body);
  }

  @Get('registry/:registryId/care-bundle')
  @ApiOperation({ summary: 'Care bundle history' })
  async careBundleHistory(
    @Request() req: RequestWithTenant,
    @Param('registryId') registryId: string,
  ) {
    return this.diabetesService.getCareBundleHistory(req.tenantDb, registryId);
  }

  @Get('registry/:registryId/care-bundle/latest')
  @ApiOperation({ summary: 'Latest care bundle snapshot' })
  async getLatestCareBundle(
    @Request() req: RequestWithTenant,
    @Param('registryId') registryId: string,
  ) {
    return this.diabetesService.getLatestCareBundle(req.tenantDb, registryId);
  }

  @Get('registry/:registryId/care-bundle/completion')
  @ApiOperation({ summary: 'Care bundle completion analysis' })
  async getCareBundleCompletion(
    @Request() req: RequestWithTenant,
    @Param('registryId') registryId: string,
  ) {
    return this.diabetesService.calculateCareBundleCompletion(req.tenantDb, registryId);
  }

  @Post('registry/:registryId/glucose')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Record glucose reading' })
  async recordGlucose(
    @Request() req: RequestWithTenant,
    @Param('registryId') registryId: string,
    @Body() body: RecordGlucoseDto & { patientId: string },
  ) {
    return this.diabetesService.recordGlucose(
      req.tenantDb,
      registryId,
      body.patientId,
      body,
      this.getUserId(req),
    );
  }

  @Get('registry/:registryId/glucose')
  @ApiOperation({ summary: 'Glucose history' })
  async getGlucoseHistory(
    @Request() req: RequestWithTenant,
    @Param('registryId') registryId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.diabetesService.getGlucoseHistory(req.tenantDb, registryId, query);
  }

  @Get('registry/:registryId/glucose/trends')
  @ApiOperation({ summary: 'Glucose trends summary' })
  async getGlucoseTrends(
    @Request() req: RequestWithTenant,
    @Param('registryId') registryId: string,
    @Query() query: GlucoseTrendsQueryDto,
  ) {
    return this.diabetesService.getGlucoseTrends(req.tenantDb, registryId, query);
  }

  @Post('registry/:registryId/glucose/sync-cgm')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Sync CGM data payload' })
  async syncCgmData(
    @Request() req: RequestWithTenant,
    @Param('registryId') registryId: string,
    @Body() body: SyncCgmDataDto & { patientId: string },
  ) {
    return this.diabetesDeviceIntegrationService.syncCgmData(
      req.tenantDb,
      registryId,
      body.patientId,
      body,
      this.getUserId(req),
    );
  }

  @Post('registry/:registryId/cgm-summary')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Record CGM summary' })
  async createCgmSummary(
    @Request() req: RequestWithTenant,
    @Param('registryId') registryId: string,
    @Body() body: CreateCgmSummaryDto & { patientId: string },
  ) {
    return this.diabetesService.createCgmSummary(req.tenantDb, registryId, body.patientId, body);
  }

  @Get('registry/:registryId/cgm-summary')
  @ApiOperation({ summary: 'List CGM summaries' })
  async listCgmSummaries(
    @Request() req: RequestWithTenant,
    @Param('registryId') registryId: string,
  ) {
    return this.diabetesService.getCgmSummaries(req.tenantDb, registryId);
  }

  @Post('registry/:registryId/medications')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Add diabetes medication' })
  async addMedication(
    @Request() req: RequestWithTenant,
    @Param('registryId') registryId: string,
    @Body() body: CreateDiabetesMedicationDto & { patientId: string },
  ) {
    return this.diabetesService.createMedication(
      req.tenantDb,
      registryId,
      body.patientId,
      body,
      this.getUserId(req),
    );
  }

  @Get('registry/:registryId/medications')
  @ApiOperation({ summary: 'List diabetes medications' })
  async listMedications(
    @Request() req: RequestWithTenant,
    @Param('registryId') registryId: string,
  ) {
    return this.diabetesService.listMedications(req.tenantDb, registryId);
  }

  @Patch('medications/:medicationId')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Update diabetes medication' })
  async updateMedication(
    @Request() req: RequestWithTenant,
    @Param('medicationId') medicationId: string,
    @Body() body: UpdateDiabetesMedicationDto,
  ) {
    return this.diabetesService.updateMedication(req.tenantDb, medicationId, body);
  }

  @Post('medications/:medicationId/adherence')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Track medication adherence' })
  async trackMedicationAdherence(
    @Request() req: RequestWithTenant,
    @Param('medicationId') medicationId: string,
    @Body() body: TrackMedicationAdherenceDto,
  ) {
    return this.diabetesService.trackMedicationAdherence(req.tenantDb, medicationId, body);
  }

  @Post('registry/:registryId/insulin-regimens')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Add insulin regimen' })
  async addInsulinRegimen(
    @Request() req: RequestWithTenant,
    @Param('registryId') registryId: string,
    @Body() body: CreateInsulinRegimenDto & { patientId: string },
  ) {
    return this.diabetesService.createInsulinRegimen(
      req.tenantDb,
      registryId,
      body.patientId,
      body,
      this.getUserId(req),
    );
  }

  @Patch('insulin-regimens/:regimenId')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Update insulin regimen' })
  async updateInsulinRegimen(
    @Request() req: RequestWithTenant,
    @Param('regimenId') regimenId: string,
    @Body() body: UpdateInsulinRegimenDto,
  ) {
    return this.diabetesService.updateInsulinRegimen(req.tenantDb, regimenId, body);
  }

  @Get('registry/:registryId/insulin-regimens/active')
  @ApiOperation({ summary: 'Get active insulin regimen' })
  async getActiveRegimen(
    @Request() req: RequestWithTenant,
    @Param('registryId') registryId: string,
  ) {
    return this.diabetesService.getActiveRegimen(req.tenantDb, registryId);
  }

  @Post('insulin-regimens/:regimenId/calculate-dose')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Calculate insulin dose recommendation' })
  async calculateInsulinDose(
    @Request() req: RequestWithTenant,
    @Param('regimenId') regimenId: string,
    @Body() body: CalculateInsulinDoseDto,
  ) {
    return this.diabetesService.calculateInsulinDose(req.tenantDb, regimenId, body);
  }

  @Post('registry/:registryId/screenings')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Record complication screening' })
  async recordScreening(
    @Request() req: RequestWithTenant,
    @Param('registryId') registryId: string,
    @Body() body: RecordComplicationScreeningDto & { patientId: string },
  ) {
    return this.diabetesService.recordScreening(
      req.tenantDb,
      registryId,
      body.patientId,
      body,
      this.getUserId(req),
    );
  }

  @Get('registry/:registryId/screenings')
  @ApiOperation({ summary: 'Complication screening history' })
  async getScreeningHistory(
    @Request() req: RequestWithTenant,
    @Param('registryId') registryId: string,
    @Query() query: ScreeningHistoryQueryDto,
  ) {
    return this.diabetesService.getScreeningHistory(req.tenantDb, registryId, query);
  }

  @Get('registry/:registryId/screenings/upcoming')
  @ApiOperation({ summary: 'Upcoming screenings for registry' })
  async getUpcomingScreenings(
    @Request() req: RequestWithTenant,
    @Param('registryId') registryId: string,
  ) {
    return this.diabetesService.getUpcomingScreenings(req.tenantDb, registryId);
  }

  @Get('registry/:registryId/screenings/due')
  @ApiOperation({ summary: 'Screenings due/overdue status' })
  async getScreeningDueStatus(
    @Request() req: RequestWithTenant,
    @Param('registryId') registryId: string,
  ) {
    return this.diabetesService.checkScreeningDue(req.tenantDb, registryId);
  }

  @Post('registry/:registryId/education')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Record education session' })
  async recordEducation(
    @Request() req: RequestWithTenant,
    @Param('registryId') registryId: string,
    @Body() body: RecordEducationSessionDto & { patientId: string },
  ) {
    return this.diabetesService.recordEducationSession(req.tenantDb, registryId, body.patientId, body);
  }

  @Get('registry/:registryId/education')
  @ApiOperation({ summary: 'Education session history' })
  async getEducationHistory(
    @Request() req: RequestWithTenant,
    @Param('registryId') registryId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.diabetesService.getEducationHistory(req.tenantDb, registryId, query);
  }

  @Get('registry/:registryId/education/due')
  @ApiOperation({ summary: 'Education due status' })
  async checkEducationDue(
    @Request() req: RequestWithTenant,
    @Param('registryId') registryId: string,
  ) {
    return this.diabetesService.checkEducationDue(req.tenantDb, registryId);
  }

  @Post('registry/:registryId/alerts')
  @ApiOperation({ summary: 'Create diabetes alert' })
  async createAlert(
    @Request() req: RequestWithTenant,
    @Param('registryId') registryId: string,
    @Body() body: CreateDiabetesAlertDto & { patientId: string },
  ) {
    return this.diabetesService.createAlert(
      req.tenantDb,
      registryId,
      body.patientId,
      body,
      this.getUserId(req),
    );
  }

  @Get('registry/:registryId/alerts')
  @ApiOperation({ summary: 'List active diabetes alerts' })
  async getActiveAlerts(
    @Request() req: RequestWithTenant,
    @Param('registryId') registryId: string,
  ) {
    return this.diabetesCdsService.getActiveAlerts(req.tenantDb, registryId);
  }

  @Post('alerts/:alertId/acknowledge')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Acknowledge an alert' })
  async acknowledgeAlert(
    @Request() req: RequestWithTenant,
    @Param('alertId') alertId: string,
    @Body() body: AcknowledgeAlertDto,
  ) {
    return this.diabetesCdsService.acknowledgeAlert(req.tenantDb, alertId, this.getUserId(req), body);
  }

  @Post('alerts/:alertId/resolve')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Resolve an alert' })
  async resolveAlert(
    @Request() req: RequestWithTenant,
    @Param('alertId') alertId: string,
    @Body() body: ResolveAlertDto,
  ) {
    return this.diabetesCdsService.resolveAlert(req.tenantDb, alertId, this.getUserId(req), body);
  }

  @Post('registry/:registryId/alerts/generate')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Run CDS alert generation' })
  async runAlertGeneration(
    @Request() req: RequestWithTenant,
    @Param('registryId') registryId: string,
  ) {
    return this.diabetesCdsService.generateAlerts(req.tenantDb, registryId, this.getUserId(req) ?? undefined);
  }

  @Post('registry/:registryId/devices')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Register diabetes device integration' })
  async registerDevice(
    @Request() req: RequestWithTenant,
    @Param('registryId') registryId: string,
    @Body() body: CreateDeviceIntegrationDto & { patientId: string },
  ) {
    return this.diabetesDeviceIntegrationService.registerDevice(
      req.tenantDb,
      registryId,
      body.patientId,
      body,
    );
  }

  @Get('registry/:registryId/devices')
  @ApiOperation({ summary: 'List connected diabetes devices' })
  async listDevices(
    @Request() req: RequestWithTenant,
    @Param('registryId') registryId: string,
  ) {
    return this.diabetesDeviceIntegrationService.listDevices(req.tenantDb, registryId);
  }

  @Patch('devices/:deviceIntegrationId')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Update device integration metadata' })
  async updateDevice(
    @Request() req: RequestWithTenant,
    @Param('deviceIntegrationId') deviceIntegrationId: string,
    @Body() body: UpdateDeviceIntegrationDto,
  ) {
    return this.diabetesDeviceIntegrationService.updateDevice(req.tenantDb, deviceIntegrationId, body);
  }

  @Get('dashboard/summary')
  @ApiOperation({ summary: 'Diabetes dashboard summary' })
  async dashboardSummary(
    @Request() req: RequestWithTenant,
  ) {
    return this.diabetesService.getDashboardSummary(req.tenantDb);
  }
}


