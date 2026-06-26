import { Controller, Post, Get, Delete, Body, Query, UseGuards, Request, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { Dhis2Service } from '../services/dhis2.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { Dhis2SchedulerService } from '../services/dhis2-scheduler.service';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@ApiTags('DHIS2 Integration')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dhis2')
export class Dhis2Controller {
  constructor(
    private dhis2Service: Dhis2Service,
    private readonly dhis2SchedulerService: Dhis2SchedulerService,
  ) {}

  @Post('sync/patients')
  @ApiOperation({ summary: 'Sync patients to DHIS2' })
  @ApiResponse({ status: 200, description: 'Patients synced successfully' })
  async syncPatients(@Request() req: RequestWithTenant) {
    return this.dhis2Service.syncPatients(req.tenantDb, req.tenantId);
  }

  @Post('events')
  @ApiOperation({ summary: 'Send event to DHIS2' })
  @ApiResponse({ status: 201, description: 'Event sent successfully' })
  async sendEvent(@Body() eventData: any, @Request() req: RequestWithTenant) {
    return this.dhis2Service.sendEvent(eventData, req.tenantDb, req.tenantId);
  }

  @Post('data-values')
  @ApiOperation({ summary: 'Send data values to DHIS2' })
  @ApiResponse({ status: 201, description: 'Data values sent successfully' })
  async sendDataValues(@Body() dataValues: any, @Request() req: RequestWithTenant) {
    return this.dhis2Service.sendDataValues(dataValues, req.tenantDb, req.tenantId);
  }

  @Get('programs')
  @ApiOperation({ summary: 'Get DHIS2 programs' })
  @ApiResponse({ status: 200, description: 'Programs retrieved successfully' })
  async getPrograms(@Request() req: RequestWithTenant) {
    return this.dhis2Service.getPrograms(req.tenantId);
  }

  @Get('data-elements')
  @ApiOperation({ summary: 'Get DHIS2 data elements' })
  @ApiResponse({ status: 200, description: 'Data elements retrieved successfully' })
  async getDataElements(@Query('program') program: string, @Request() req: RequestWithTenant) {
    return this.dhis2Service.getDataElements(program, req.tenantId);
  }

  @Post('reports/aggregate')
  @ApiOperation({ summary: 'Send aggregate report to DHIS2' })
  @ApiResponse({ status: 201, description: 'Report sent successfully' })
  async sendAggregateReport(@Body() reportData: any, @Request() req: RequestWithTenant) {
    return this.dhis2Service.sendAggregateReport(reportData, req.tenantDb, req.tenantId);
  }

  @Get('sync-status')
  @ApiOperation({ summary: 'Get DHIS2 sync status' })
  @ApiResponse({ status: 200, description: 'Sync status retrieved' })
  async getSyncStatus(@Request() req: RequestWithTenant) {
    return this.dhis2Service.getSyncStatus(req.tenantDb, req.tenantId);
  }

  @Get('sync-log')
  @ApiOperation({ summary: 'Get tenant DHIS2 sync log with filters' })
  @ApiResponse({ status: 200, description: 'Sync log retrieved' })
  async getSyncLog(
    @Request() req: RequestWithTenant,
    @Query('entityType') entityType?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.dhis2Service.getSyncLog(req.tenantDb, {
      entityType: entityType || undefined,
      status: status || undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('retry-failed')
  @ApiOperation({ summary: 'Retry failed DHIS2 sync log entries for the tenant' })
  @ApiResponse({ status: 200, description: 'Retry attempt completed' })
  async retryFailed(
    @Request() req: RequestWithTenant,
    @Body()
    body: {
      entityType?: string;
      limit?: number;
      dryRun?: boolean;
    },
  ) {
    return this.dhis2Service.retryFailedSync(req.tenantDb, req.tenantId, body || {});
  }

  @Post('tracker/encounters/:encounterId/event')
  @ApiOperation({ summary: 'Push a clinical encounter as a DHIS2 tracker program stage event' })
  async syncEncounterEvent(
    @Param('encounterId') encounterId: string,
    @Body() body: { programId: string; programStageId: string },
    @Request() req: RequestWithTenant,
  ) {
    return this.dhis2Service.syncEncounterAsTrackerEvent(req.tenantDb, req.tenantId, encounterId, body.programId, body.programStageId);
  }

  @Post('tracker/lab-results/:labResultId/event')
  @ApiOperation({ summary: 'Push a lab result as a DHIS2 tracker program stage event' })
  async syncLabResultEvent(
    @Param('labResultId') labResultId: string,
    @Body() body: { programId: string; programStageId: string },
    @Request() req: RequestWithTenant,
  ) {
    return this.dhis2Service.syncLabResultAsTrackerEvent(req.tenantDb, req.tenantId, labResultId, body.programId, body.programStageId);
  }

  @Post('tracker/vital-signs/:vitalSignsId/event')
  @ApiOperation({ summary: 'Push vital signs as a DHIS2 tracker program stage event' })
  async syncVitalSignsEvent(
    @Param('vitalSignsId') vitalSignsId: string,
    @Body() body: { programId: string; programStageId: string },
    @Request() req: RequestWithTenant,
  ) {
    return this.dhis2Service.syncVitalSignsAsTrackerEvent(req.tenantDb, req.tenantId, vitalSignsId, body.programId, body.programStageId);
  }

  @Get('profiles')
  @ApiOperation({ summary: 'List all available DHIS2 aggregate report profiles' })
  getProfiles() {
    return {
      profiles: [
        { key: 'service_delivery',       label: 'Service Delivery',          period: 'monthly' },
        { key: 'maternal_newborn',        label: 'Maternal & Newborn Health', period: 'monthly' },
        { key: 'hiv_monthly',            label: 'HIV Monthly Return',        period: 'monthly' },
        { key: 'immunization_monthly',   label: 'Immunization',              period: 'monthly' },
        { key: 'pharmacy_stock',         label: 'Pharmacy & Stock',          period: 'monthly' },
        { key: 'ntd_regional',           label: 'NTD Regional',              period: 'monthly' },
        { key: 'pmtct_monthly',          label: 'PMTCT',                     period: 'monthly' },
        { key: 'tb_quarterly',           label: 'Tuberculosis',              period: 'quarterly' },
        { key: 'malaria_monthly',        label: 'Malaria',                   period: 'monthly' },
        { key: 'ncd_monthly',            label: 'Non-Communicable Diseases', period: 'monthly' },
        { key: 'outpatient_morbidity',   label: 'Outpatient Morbidity',      period: 'monthly' },
        { key: 'laboratory_monthly',     label: 'Laboratory Services',       period: 'monthly' },
        { key: 'mental_health_monthly',  label: 'Mental Health',             period: 'monthly' },
        { key: 'nutrition_monthly',      label: 'Nutrition (SAM/MAM)',        period: 'monthly' },
        { key: 'icu_monthly',            label: 'Intensive Care Unit',       period: 'monthly' },
        { key: 'hai_monthly',            label: 'Healthcare-Associated Infections', period: 'monthly' },
        { key: 'surgical_monthly',       label: 'Surgical Services',         period: 'monthly' },
        { key: 'cervical_cancer_monthly',label: 'Cervical Cancer Screening', period: 'monthly' },
        { key: 'neonatal_monthly',       label: 'Neonatal Care',             period: 'monthly' },
      ],
    };
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate data values against DHIS2 dataset validation rules before submission' })
  async validateDataValues(
    @Body() body: { dataSetId: string; dataValues: Array<{ dataElement: string; value: string }>; period: string; orgUnit?: string },
    @Request() req: RequestWithTenant,
  ) {
    return this.dhis2Service.validateBeforeSubmit(
      req.tenantId,
      body.dataSetId,
      body.dataValues,
      body.period,
      body.orgUnit || '',
    );
  }

  @Get('benchmarks/facility')
  @ApiOperation({ summary: 'Pull facility performance benchmarks from DHIS2 analytics (reverse sync)' })
  async getFacilityBenchmarks(
    @Request() req: RequestWithTenant,
    @Query('dataElement') dataElement: string,
    @Query('period') period: string,
    @Query('parentOrgUnit') parentOrgUnit?: string,
  ) {
    return this.dhis2Service.getFacilityBenchmarks(req.tenantId, {
      dataElement,
      period,
      parentOrgUnit,
    });
  }

  @Get('benchmarks/doctor-dashboard')
  @ApiOperation({ summary: 'Pull doctor performance dashboard from DHIS2 — facility vs benchmarks' })
  async getDoctorDashboard(
    @Request() req: RequestWithTenant,
    @Query('period') period: string,
    @Query('orgUnit') orgUnit?: string,
  ) {
    return this.dhis2Service.getDoctorPerformanceDashboard(req.tenantId, period, orgUnit);
  }

  @Post('sync/run-now')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Run immediate DHIS2 sync cycle for current tenant' })
  @ApiResponse({ status: 200, description: 'Immediate tenant sync completed' })
  async runSyncNow(
    @Request() req: RequestWithTenant,
    @Body()
    body: {
      retryLimit?: number;
      includeAlerts?: boolean;
    },
  ) {
    const requestId = (req.headers?.['x-request-id'] as string) || null;
    return this.dhis2SchedulerService.runTenantSyncNow(req.tenantId!, req.tenantDb, body || {}, {
      userId: req.user?.id ? String(req.user.id) : null,
      role: req.user?.role ? String(req.user.role) : null,
      email: req.user?.email ? String(req.user.email) : null,
      requestId,
    });
  }

  @Get('programme-subscriptions')
  @ApiOperation({ summary: 'List programme indicator subscriptions for this tenant' })
  listProgrammeSubscriptions(@Request() req: RequestWithTenant) {
    return this.dhis2Service.getProgrammeSubscriptions(req.tenantDb);
  }

  @Post('programme-subscriptions')
  @ApiOperation({ summary: 'Create or update a programme indicator subscription' })
  upsertProgrammeSubscription(
    @Body() body: { indicatorCode: string; indicatorName: string; thresholdOperator?: string; thresholdValue: number; alertEnabled?: boolean },
    @Request() req: RequestWithTenant,
  ) {
    return this.dhis2Service.upsertProgrammeSubscription(req.tenantDb, body);
  }

  @Delete('programme-subscriptions/:id')
  @ApiOperation({ summary: 'Delete a programme indicator subscription' })
  deleteProgrammeSubscription(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.dhis2Service.deleteProgrammeSubscription(req.tenantDb, id);
  }

  @Post('programme-subscriptions/check')
  @ApiOperation({ summary: 'Manually trigger a check against DHIS2 for all subscribed indicators' })
  checkProgrammeSubscriptions(@Request() req: RequestWithTenant) {
    return this.dhis2Service.checkProgrammeSubscriptions(req.tenantDb, req.tenantId);
  }
}
