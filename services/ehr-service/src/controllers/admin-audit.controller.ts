import { BadRequestException, Controller, Get, Query, Request, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../decorators/roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { HipaaAuditService } from '../services/hipaa-audit.service';

@ApiTags('Admin Audit')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/audit')
export class AdminAuditController {
  constructor(private readonly hipaaAuditService: HipaaAuditService) {}

  @Get('disclosure-report')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Generate HIPAA accounting of disclosures report for one patient' })
  @ApiQuery({ name: 'patientId', required: true, description: 'Patient ID' })
  @ApiQuery({ name: 'from', required: false, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, description: 'End date (ISO 8601)' })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'], description: 'Response format (default: json)' })
  @ApiResponse({ status: 200, description: 'Disclosure report generated' })
  async getDisclosureReport(
    @Request() req: RequestWithTenant,
    @Res({ passthrough: true }) res: Response,
    @Query('patientId') patientId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('format') format?: string,
  ) {
    const normalizedPatientId = String(patientId || '').trim();
    if (!normalizedPatientId) {
      throw new BadRequestException('patientId is required');
    }

    const startDate = from ? new Date(from) : undefined;
    const endDate = to ? new Date(to) : undefined;

    if (startDate && Number.isNaN(startDate.getTime())) {
      throw new BadRequestException('Invalid "from" date');
    }
    if (endDate && Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid "to" date');
    }

    const report = await this.hipaaAuditService.getDisclosureReport(
      req.tenantDb,
      normalizedPatientId,
      startDate,
      endDate,
    );

    if (format === 'csv') {
      const csv = this.disclosureReportToCsv(report);
      const filename = `hipaa-disclosure-${normalizedPatientId}-${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
      return undefined as any;
    }

    return report;
  }

  private disclosureReportToCsv(report: any): string {
    const headers = [
      'Timestamp',
      'Operation',
      'Action',
      'Resource Type',
      'Resource ID',
      'Actor Name',
      'Actor Role',
      'Outcome',
      'Reason',
    ];
    const rows = (report.events || []).map((e: any) => [
      e.timestamp ? new Date(e.timestamp).toISOString() : '',
      e.operation || '',
      e.action || '',
      e.resourceType || '',
      e.resourceId || '',
      e.actor?.name || '',
      e.actor?.role || '',
      e.outcome || '',
      (e.reason || '').replace(/"/g, '""'),
    ]);
    const escape = (val: string) => (val.includes(',') || val.includes('"') || val.includes('\n') ? `"${val}"` : val);
    const lines = [headers.map(escape).join(','), ...rows.map((r: any[]) => r.map((c: any) => escape(String(c ?? ''))).join(','))];
    return lines.join('\r\n');
  }
}

