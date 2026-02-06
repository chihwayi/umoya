import { Controller, Get, Query, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { HipaaAuditService, HipaaAuditAction } from '../services/hipaa-audit.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('HIPAA Audit Logs')
@ApiBearerAuth()
@Controller('hipaa-audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HipaaAuditController {
  constructor(private readonly hipaaAuditService: HipaaAuditService) {}

  @Get('logs')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Get HIPAA audit logs with filtering' })
  @ApiQuery({ name: 'userId', description: 'Filter by user ID', required: false })
  @ApiQuery({ name: 'patientId', description: 'Filter by patient ID', required: false })
  @ApiQuery({ name: 'action', description: 'Filter by action type', required: false })
  @ApiQuery({ name: 'resourceType', description: 'Filter by resource type', required: false })
  @ApiQuery({ name: 'outcome', description: 'Filter by outcome (success/failure/denied)', required: false })
  @ApiQuery({ name: 'riskLevel', description: 'Filter by risk level (low/medium/high/critical)', required: false })
  @ApiQuery({ name: 'startDate', description: 'Start date (ISO 8601)', required: false })
  @ApiQuery({ name: 'endDate', description: 'End date (ISO 8601)', required: false })
  @ApiQuery({ name: 'limit', description: 'Maximum number of results', required: false, type: Number })
  @ApiQuery({ name: 'offset', description: 'Offset for pagination', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully' })
  async getAuditLogs(
    @Request() req: RequestWithTenant,
    @Query('userId') userId?: string,
    @Query('patientId') patientId?: string,
    @Query('action') action?: string,
    @Query('resourceType') resourceType?: string,
    @Query('outcome') outcome?: 'success' | 'failure' | 'denied',
    @Query('riskLevel') riskLevel?: 'low' | 'medium' | 'high' | 'critical',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.hipaaAuditService.getAuditLogs(req.tenantDb, {
      userId,
      patientId,
      action,
      resourceType,
      outcome,
      riskLevel,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('summary')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Get audit summary for compliance reporting' })
  @ApiQuery({ name: 'startDate', description: 'Start date (ISO 8601)', required: true })
  @ApiQuery({ name: 'endDate', description: 'End date (ISO 8601)', required: true })
  @ApiResponse({ status: 200, description: 'Audit summary retrieved successfully' })
  async getAuditSummary(
    @Request() req: RequestWithTenant,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.hipaaAuditService.getAuditSummary(
      req.tenantDb,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('detect-breaches')
  @Roles('admin')
  @ApiOperation({ summary: 'Detect potential HIPAA breaches' })
  @ApiQuery({ name: 'lookbackDays', description: 'Number of days to look back', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Breach detection results' })
  async detectBreaches(
    @Request() req: RequestWithTenant,
    @Query('lookbackDays') lookbackDays?: string,
  ) {
    return this.hipaaAuditService.detectBreaches(
      req.tenantDb,
      lookbackDays ? parseInt(lookbackDays, 10) : 30,
    );
  }

  @Get('patient/:patientId/access-report')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Get access report for a specific patient' })
  @ApiParam({ name: 'patientId', description: 'Patient ID', required: true })
  @ApiQuery({ name: 'startDate', description: 'Start date (ISO 8601)', required: false })
  @ApiQuery({ name: 'endDate', description: 'End date (ISO 8601)', required: false })
  @ApiResponse({ status: 200, description: 'Patient access report retrieved successfully' })
  async getPatientAccessReport(
    @Request() req: RequestWithTenant,
    @Param('patientId') patientId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.hipaaAuditService.getPatientAccessReport(
      req.tenantDb,
      patientId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }
}


