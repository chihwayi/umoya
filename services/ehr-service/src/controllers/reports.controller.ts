import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { ReportsService } from '../services/reports.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Reports & Analytics')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('patient-summary/:id')
  @ApiOperation({ summary: 'Generate patient summary report' })
  @ApiResponse({ status: 200, description: 'Patient summary generated' })
  async getPatientSummary(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.reportsService.getPatientSummary(id, req.tenantDb);
  }

  @Get('financial')
  @ApiOperation({ summary: 'Generate financial reports' })
  @ApiResponse({ status: 200, description: 'Financial report generated' })
  async getFinancialReport(@Query() query: any, @Request() req: RequestWithTenant) {
    return this.reportsService.getFinancialReport(query, req.tenantDb);
  }

  @Get('clinical')
  @ApiOperation({ summary: 'Generate clinical statistics' })
  @ApiResponse({ status: 200, description: 'Clinical statistics generated' })
  async getClinicalReport(@Query() query: any, @Request() req: RequestWithTenant) {
    return this.reportsService.getClinicalReport(query, req.tenantDb);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard analytics data' })
  @ApiResponse({ status: 200, description: 'Dashboard data retrieved' })
  async getDashboardData(@Request() req: RequestWithTenant) {
    return this.reportsService.getDashboardData(req.tenantDb);
  }

  @Get('appointments')
  @ApiOperation({ summary: 'Generate appointments report' })
  @ApiResponse({ status: 200, description: 'Appointments report generated' })
  async getAppointmentsReport(@Query() query: any, @Request() req: RequestWithTenant) {
    return this.reportsService.getAppointmentsReport(query, req.tenantDb);
  }

  @Get('prescriptions')
  @ApiOperation({ summary: 'Generate prescriptions report' })
  @ApiResponse({ status: 200, description: 'Prescriptions report generated' })
  async getPrescriptionsReport(@Query() query: any, @Request() req: RequestWithTenant) {
    return this.reportsService.getPrescriptionsReport(query, req.tenantDb);
  }

  @Get('lab-results')
  @ApiOperation({ summary: 'Generate lab results report' })
  @ApiResponse({ status: 200, description: 'Lab results report generated' })
  async getLabResultsReport(@Query() query: any, @Request() req: RequestWithTenant) {
    return this.reportsService.getLabResultsReport(query, req.tenantDb);
  }
}