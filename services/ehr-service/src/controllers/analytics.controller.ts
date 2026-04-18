import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { ReportBuilderService } from '../services/report-builder.service';
import { ScheduledReportsService } from '../services/scheduled-reports.service';
import { ClinicalOutcomesService } from '../services/clinical-outcomes.service';
import { AnalyticsService } from '../services/analytics.service';
import {
  CreateReportTemplateDto,
  UpdateReportTemplateDto,
  ReportTemplateQueryDto,
  ExecuteReportDto,
  CreateScheduledReportDto,
  UpdateScheduledReportDto,
  ScheduledReportQueryDto,
  CreateClinicalOutcomeDto,
  UpdateClinicalOutcomeDto,
  ClinicalOutcomeQueryDto,
  CreateAnalyticsMetricDto,
  AnalyticsMetricQueryDto,
  GetMetricTrendsDto,
  CompareMetricsDto,
} from '../dto/analytics.dto';

@ApiTags('Analytics & Reporting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly reportBuilderService: ReportBuilderService,
    private readonly scheduledReportsService: ScheduledReportsService,
    private readonly clinicalOutcomesService: ClinicalOutcomesService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  // Report Templates Endpoints
  @Post('templates')
  @ApiOperation({ summary: 'Create a report template' })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  async createTemplate(@Body() dto: CreateReportTemplateDto, @Req() req: RequestWithTenant) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.reportBuilderService.createTemplate(req.tenantDb, dto, userId);
  }

  @Get('templates')
  @ApiOperation({ summary: 'List report templates' })
  @ApiResponse({ status: 200, description: 'Templates retrieved successfully' })
  async listTemplates(@Query() query: ReportTemplateQueryDto, @Req() req: RequestWithTenant) {
    return this.reportBuilderService.listTemplates(req.tenantDb, query);
  }

  @Get('templates/default')
  @ApiOperation({ summary: 'Get default analytics templates' })
  @ApiResponse({ status: 200, description: 'Default analytics templates retrieved successfully' })
  async getDefaultTemplates(@Req() req: RequestWithTenant) {
    return this.analyticsService.getDefaultTemplates(req.tenantDb);
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Get a report template by ID' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template retrieved successfully' })
  async getTemplate(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.reportBuilderService.getTemplate(req.tenantDb, id);
  }

  @Put('templates/:id')
  @ApiOperation({ summary: 'Update a report template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template updated successfully' })
  async updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateReportTemplateDto,
    @Req() req: RequestWithTenant,
  ) {
    return this.reportBuilderService.updateTemplate(req.tenantDb, id, dto);
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: 'Delete a report template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template deleted successfully' })
  async deleteTemplate(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.reportBuilderService.deleteTemplate(req.tenantDb, id);
  }

  @Post('templates/:id/execute')
  @ApiOperation({ summary: 'Execute a report template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Report executed successfully' })
  async executeTemplate(
    @Param('id') id: string,
    @Body() dto: ExecuteReportDto,
    @Req() req: RequestWithTenant,
    @Res() res: Response,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    const result = await this.reportBuilderService.executeTemplate(req.tenantDb, id, dto, userId);

    // If format is not JSON, return file download
    if (result.fileBuffer && dto.format && dto.format !== 'json') {
      const contentType =
        dto.format === 'pdf'
          ? 'application/pdf'
          : dto.format === 'excel'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'text/csv';
      const extension = dto.format === 'pdf' ? 'pdf' : dto.format === 'excel' ? 'xlsx' : 'csv';
      const filename = `report-${id}-${Date.now()}.${extension}`;

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(result.fileBuffer);
      return;
    }

    // Return JSON response
    return res.json(result);
  }

  @Post('templates/:id/clone')
  @ApiOperation({ summary: 'Clone a report template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiQuery({ name: 'newName', required: true, description: 'Name for cloned template' })
  @ApiResponse({ status: 201, description: 'Template cloned successfully' })
  async cloneTemplate(
    @Param('id') id: string,
    @Query('newName') newName: string,
    @Req() req: RequestWithTenant,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.reportBuilderService.cloneTemplate(req.tenantDb, id, newName, userId);
  }

  @Get('templates/:id/executions')
  @ApiOperation({ summary: 'Get execution history for a template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Execution history retrieved successfully' })
  async getTemplateExecutions(
    @Param('id') id: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Req() req: RequestWithTenant,
  ) {
    return this.reportBuilderService.getExecutionHistory(req.tenantDb, id, page, limit);
  }

  @Post('seed-default-templates')
  @ApiOperation({ summary: 'Seed default report templates for this tenant (idempotent)' })
  @ApiResponse({ status: 200, description: 'Default templates seeded' })
  async seedDefaultTemplates(@Req() req: RequestWithTenant) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.reportBuilderService.seedDefaultTemplates(req.tenantDb, userId);
  }

  // Scheduled Reports Endpoints
  @Post('schedules')
  @ApiOperation({ summary: 'Create a scheduled report' })
  @ApiResponse({ status: 201, description: 'Scheduled report created successfully' })
  async createSchedule(@Body() dto: CreateScheduledReportDto, @Req() req: RequestWithTenant) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.scheduledReportsService.createSchedule(req.tenantDb, dto, userId);
  }

  @Get('schedules')
  @ApiOperation({ summary: 'List scheduled reports' })
  @ApiResponse({ status: 200, description: 'Scheduled reports retrieved successfully' })
  async listSchedules(@Query() query: ScheduledReportQueryDto, @Req() req: RequestWithTenant) {
    return this.scheduledReportsService.listSchedules(req.tenantDb, query);
  }

  @Get('schedules/:id')
  @ApiOperation({ summary: 'Get a scheduled report by ID' })
  @ApiParam({ name: 'id', description: 'Schedule ID' })
  @ApiResponse({ status: 200, description: 'Scheduled report retrieved successfully' })
  async getSchedule(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.scheduledReportsService.getSchedule(req.tenantDb, id);
  }

  @Put('schedules/:id')
  @ApiOperation({ summary: 'Update a scheduled report' })
  @ApiParam({ name: 'id', description: 'Schedule ID' })
  @ApiResponse({ status: 200, description: 'Scheduled report updated successfully' })
  async updateSchedule(
    @Param('id') id: string,
    @Body() dto: UpdateScheduledReportDto,
    @Req() req: RequestWithTenant,
  ) {
    return this.scheduledReportsService.updateSchedule(req.tenantDb, id, dto);
  }

  @Delete('schedules/:id')
  @ApiOperation({ summary: 'Delete a scheduled report' })
  @ApiParam({ name: 'id', description: 'Schedule ID' })
  @ApiResponse({ status: 200, description: 'Scheduled report deleted successfully' })
  async deleteSchedule(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.scheduledReportsService.deleteSchedule(req.tenantDb, id);
  }

  @Post('schedules/:id/execute')
  @ApiOperation({ summary: 'Manually trigger a scheduled report' })
  @ApiParam({ name: 'id', description: 'Schedule ID' })
  @ApiResponse({ status: 200, description: 'Report executed successfully' })
  async executeSchedule(@Param('id') id: string, @Req() req: RequestWithTenant) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.scheduledReportsService.executeSchedule(req.tenantDb, id, userId);
  }

  @Post('schedules/:id/pause')
  @ApiOperation({ summary: 'Pause a scheduled report' })
  @ApiParam({ name: 'id', description: 'Schedule ID' })
  @ApiResponse({ status: 200, description: 'Schedule paused successfully' })
  async pauseSchedule(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.scheduledReportsService.pauseSchedule(req.tenantDb, id);
  }

  @Post('schedules/:id/resume')
  @ApiOperation({ summary: 'Resume a scheduled report' })
  @ApiParam({ name: 'id', description: 'Schedule ID' })
  @ApiResponse({ status: 200, description: 'Schedule resumed successfully' })
  async resumeSchedule(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.scheduledReportsService.resumeSchedule(req.tenantDb, id);
  }

  @Get('schedules/:id/history')
  @ApiOperation({ summary: 'Get execution history for a scheduled report' })
  @ApiParam({ name: 'id', description: 'Schedule ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Execution history retrieved successfully' })
  async getScheduleHistory(
    @Param('id') id: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Req() req: RequestWithTenant,
  ) {
    return this.scheduledReportsService.getScheduleHistory(req.tenantDb, id, page, limit);
  }

  // Clinical Outcomes Endpoints
  @Post('outcomes')
  @ApiOperation({ summary: 'Record a clinical outcome' })
  @ApiResponse({ status: 201, description: 'Outcome recorded successfully' })
  async recordOutcome(@Body() dto: CreateClinicalOutcomeDto, @Req() req: RequestWithTenant) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.clinicalOutcomesService.recordOutcome(req.tenantDb, dto, userId);
  }

  @Get('outcomes')
  @ApiOperation({ summary: 'Get clinical outcomes' })
  @ApiResponse({ status: 200, description: 'Outcomes retrieved successfully' })
  async getOutcomes(@Query() query: ClinicalOutcomeQueryDto, @Req() req: RequestWithTenant) {
    return this.clinicalOutcomesService.getOutcomes(req.tenantDb, query);
  }

  @Get('outcomes/patient/:patientId')
  @ApiOperation({ summary: 'Get outcomes for a specific patient' })
  @ApiParam({ name: 'patientId', description: 'Patient ID' })
  @ApiResponse({ status: 200, description: 'Patient outcomes retrieved successfully' })
  async getPatientOutcomes(@Param('patientId') patientId: string, @Req() req: RequestWithTenant) {
    return this.clinicalOutcomesService.getPatientOutcomes(req.tenantDb, patientId);
  }

  @Get('outcomes/trends')
  @ApiOperation({ summary: 'Get outcome trends' })
  @ApiQuery({ name: 'condition', required: true })
  @ApiQuery({ name: 'dateFrom', required: true })
  @ApiQuery({ name: 'dateTo', required: true })
  @ApiResponse({ status: 200, description: 'Trends retrieved successfully' })
  async getOutcomeTrends(
    @Query('condition') condition: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Req() req: RequestWithTenant,
  ) {
    return this.clinicalOutcomesService.getOutcomeTrends(req.tenantDb, condition, {
      from: dateFrom,
      to: dateTo,
    });
  }

  @Get('outcomes/metrics')
  @ApiOperation({ summary: 'Get outcome metrics' })
  @ApiQuery({ name: 'condition', required: true })
  @ApiQuery({ name: 'period', required: false, description: 'Period (default: 30d)' })
  @ApiResponse({ status: 200, description: 'Metrics retrieved successfully' })
  async getOutcomeMetrics(
    @Query('condition') condition: string,
    @Query('period') period: string,
    @Req() req: RequestWithTenant,
  ) {
    return this.clinicalOutcomesService.calculateOutcomeMetrics(req.tenantDb, condition, period);
  }

  @Get('outcomes/comparisons')
  @ApiOperation({ summary: 'Get outcome comparisons' })
  @ApiQuery({ name: 'condition', required: true })
  @ApiQuery({ name: 'groups', required: false, type: [String] })
  @ApiResponse({ status: 200, description: 'Comparisons retrieved successfully' })
  async getOutcomeComparisons(
    @Query('condition') condition: string,
    @Query('groups') groups: string[],
    @Req() req: RequestWithTenant,
  ) {
    return this.clinicalOutcomesService.getOutcomeComparisons(req.tenantDb, condition, groups || []);
  }

  @Put('outcomes/:id')
  @ApiOperation({ summary: 'Update a clinical outcome' })
  @ApiParam({ name: 'id', description: 'Outcome ID' })
  @ApiResponse({ status: 200, description: 'Outcome updated successfully' })
  async updateOutcome(
    @Param('id') id: string,
    @Body() dto: UpdateClinicalOutcomeDto,
    @Req() req: RequestWithTenant,
  ) {
    return this.clinicalOutcomesService.updateOutcome(req.tenantDb, id, dto);
  }

  @Delete('outcomes/:id')
  @ApiOperation({ summary: 'Delete a clinical outcome' })
  @ApiParam({ name: 'id', description: 'Outcome ID' })
  @ApiResponse({ status: 200, description: 'Outcome deleted successfully' })
  async deleteOutcome(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.clinicalOutcomesService.deleteOutcome(req.tenantDb, id);
  }

  // Analytics Metrics Endpoints
  @Post('metrics')
  @ApiOperation({ summary: 'Create or update an analytics metric' })
  @ApiResponse({ status: 201, description: 'Metric created successfully' })
  async createMetric(@Body() dto: CreateAnalyticsMetricDto, @Req() req: RequestWithTenant) {
    return this.analyticsService.createMetric(req.tenantDb, dto);
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get analytics metrics' })
  @ApiResponse({ status: 200, description: 'Metrics retrieved successfully' })
  async getMetrics(@Query() query: AnalyticsMetricQueryDto, @Req() req: RequestWithTenant) {
    return this.analyticsService.getMetrics(req.tenantDb, query);
  }

  @Get('metrics/calculate')
  @ApiOperation({ summary: 'Calculate metrics' })
  @ApiQuery({ name: 'metricNames', required: true, type: [String] })
  @ApiQuery({ name: 'dateFrom', required: true })
  @ApiQuery({ name: 'dateTo', required: true })
  @ApiResponse({ status: 200, description: 'Metrics calculated successfully' })
  async calculateMetrics(
    @Query('metricNames') metricNames: string[],
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Req() req: RequestWithTenant,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.analyticsService.calculateMetrics(
      req.tenantDb,
      metricNames,
      {
        from: dateFrom,
        to: dateTo,
      },
      { userId },
    );
  }

  @Get('metrics/trends')
  @ApiOperation({ summary: 'Get metric trends' })
  @ApiResponse({ status: 200, description: 'Trends retrieved successfully' })
  async getMetricTrends(@Query() dto: GetMetricTrendsDto, @Req() req: RequestWithTenant) {
    return this.analyticsService.getMetricTrends(req.tenantDb, dto);
  }

  @Get('metrics/compare')
  @ApiOperation({ summary: 'Compare metrics across periods' })
  @ApiResponse({ status: 200, description: 'Comparison retrieved successfully' })
  async compareMetrics(@Query() dto: CompareMetricsDto, @Req() req: RequestWithTenant) {
    return this.analyticsService.compareMetrics(req.tenantDb, dto);
  }

  @Get('metrics/benchmarks')
  @ApiOperation({ summary: 'Get metric benchmarks' })
  @ApiQuery({ name: 'metricName', required: true })
  @ApiResponse({ status: 200, description: 'Benchmarks retrieved successfully' })
  async getBenchmarks(@Query('metricName') metricName: string, @Req() req: RequestWithTenant) {
    return this.analyticsService.getBenchmarks(req.tenantDb, metricName);
  }
}
